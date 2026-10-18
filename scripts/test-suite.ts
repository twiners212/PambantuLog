/**
 * Testpen / Automated Test Suite for PambantuLog Server Protection & Restrictions
 *
 * Verifies:
 * 1. File Validation & Executable Blacklist
 * 2. Zod Input Schemas & API Validator Error Formatting
 * 3. Rate Limiters (Ticket, Comment, Login, Export) & HTTP 429
 * 4. Idempotency Key & Anti-Double Submission (409 Conflict)
 * 5. Strict Pagination & Query Bounds (Hard Cap 50)
 * 6. Export Date Range Guard (Max 30 Days) & Cooldown
 */

import {
  validateAttachments,
} from "../src/lib/file-compression";
import {
  createTicketSchema,
  createCommentSchema,
  normalizePriorityToDb,
  serializeAttachments,
} from "../src/lib/validations/ticket";
import {
  formatZodErrors,
  validateRequestBody,
} from "../src/lib/validations/api-validator";
import {
  checkRateLimit,
  peekRateLimit,
  LIMIT_CONFIGS,
  resetMemoryRateLimit,
  resetRateLimit,
  createRateLimitResponse,
} from "../src/lib/rate-limit";
import {
  getStartOfPeriod,
} from "../src/app/api/v1/analytics/route";
import {
  GET as exportGet,
} from "../src/app/api/v1/tickets/export/route";
import {
  encodeSession,
  SESSION_COOKIE_NAME,
} from "../src/lib/auth-session";
import { z } from "zod";
import {
  GET as legacyGet,
  POST as legacyPost,
} from "../src/app/api/tickets/route";
import {
  GET as pingGet,
} from "../src/app/api/v1/ping/route";
import {
  checkIdempotency,
  resolveIdempotency,
  generateIdempotencyToken,
} from "../src/lib/idempotency";
import {
  parsePaginationParams,
  buildPaginatedResponse,
  MAX_HARD_CAP_LIMIT,
} from "../src/lib/pagination";
import {
  validateExportDateRange,
  checkExportCooldown,
  escapeCsvField,
} from "../src/lib/export-guard";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

// Mock File helper for Node.js test environment
function createMockFile(name: string, sizeBytes: number, type: string): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  PAMBANTULOG RESTRICTIONS & PROTECTION TEST SUITE");
  console.log("========================================================\n");

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: File Whitelist & Executable Rejection
  // ─────────────────────────────────────────────────────────────────
  console.log("📁 [1] Pengujian Validasi Berkas & Ekstensi");

  const validPng = createMockFile("screenshot.png", 500 * 1024, "image/png");
  const validPdf = createMockFile("laporan.pdf", 2 * 1024 * 1024, "application/pdf");
  const validLog = createMockFile("system.log", 100 * 1024, "text/plain");
  const resValid = validateAttachments([validPng, validPdf, validLog]);
  assert(resValid.isValid, "Menerima berkas whitelist (.png, .pdf, .log)");

  const blockedExe = createMockFile("virus.exe", 1024, "application/octet-stream");
  const resExe = validateAttachments([blockedExe]);
  assert(!resExe.isValid, "Menolak format .exe", resExe.error);

  const blockedBat = createMockFile("script.bat", 512, "text/plain");
  const resBat = validateAttachments([blockedBat]);
  assert(!resBat.isValid, "Menolak format .bat", resBat.error);

  const blockedSh = createMockFile("exploit.sh", 512, "text/x-sh");
  const resSh = validateAttachments([blockedSh]);
  assert(!resSh.isValid, "Menolak format .sh", resSh.error);

  const unlistedExt = createMockFile("archive.zip", 1024, "application/zip");
  const resUnlisted = validateAttachments([unlistedExt]);
  assert(!resUnlisted.isValid, "Menolak ekstensi di luar whitelist (.zip)", resUnlisted.error);

  const sixFiles = [1, 2, 3, 4, 5, 6].map((i) =>
    createMockFile(`file${i}.png`, 100 * 1024, "image/png")
  );
  const resCount = validateAttachments(sixFiles, { maxFiles: 5 });
  assert(!resCount.isValid, "Menolak jika jumlah berkas melebihi 5", resCount.error);

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Validasi Skema Input Zod
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📋 [2] Pengujian Validasi Skema Input Zod");

  // Judul terlalu pendek (< 5 karakter)
  const shortTitle = createTicketSchema.safeParse({
    title: "Vpn",
    description: "Deskripsi yang cukup panjang",
    priority: "MEDIUM",
    categoryId: "cat-123",
  });
  assert(!shortTitle.success, "Menolak judul tiket < 5 karakter");

  // Judul terlalu panjang (> 150 karakter)
  const longTitle = createTicketSchema.safeParse({
    title: "A".repeat(151),
    description: "Deskripsi yang cukup panjang",
    priority: "HIGH",
    categoryId: "cat-123",
  });
  assert(!longTitle.success, "Menolak judul tiket > 150 karakter");

  // Deskripsi terlalu panjang (> 3.000 karakter)
  const longDesc = createTicketSchema.safeParse({
    title: "Judul yang valid dan cukup",
    description: "X".repeat(3001),
    priority: "URGENT",
    categoryId: "cat-123",
  });
  assert(!longDesc.success, "Menolak deskripsi tiket > 3.000 karakter");

  // Prioritas tidak valid
  const invalidPriority = createTicketSchema.safeParse({
    title: "Judul tiket valid",
    description: "Deskripsi tiket valid",
    priority: "CRITICAL_SUPER",
    categoryId: "cat-123",
  });
  assert(!invalidPriority.success, "Menolak enum prioritas di luar LOW/MEDIUM/HIGH/URGENT");

  // Input tiket yang valid
  const validTicket = createTicketSchema.safeParse({
    title: "   Kendala akses database staging   ",
    description: "Koneksi timeout setiap 30 detik",
    priority: "urgent", // case-insensitive test
    categoryId: "cat-456",
  });
  assert(validTicket.success, "Menerima input tiket yang valid");
  if (validTicket.success) {
    assert(validTicket.data.title === "Kendala akses database staging", "Trim whitespace judul berhasil");
    assert(normalizePriorityToDb(validTicket.data.priority) === "urgent", "Normalisasi prioritas ke DB enum berhasil");
  }

  // Komentar kosong
  const emptyComment = createCommentSchema.safeParse({ comment: "   " });
  assert(!emptyComment.success, "Menolak komentar kosong");

  // Komentar > 1.000 karakter
  const longComment = createCommentSchema.safeParse({ comment: "C".repeat(1001) });
  assert(!longComment.success, "Menolak komentar > 1.000 karakter");

  // Komentar valid
  const validComment = createCommentSchema.safeParse({ comment: "Sedang dalam investigasi tim infra" });
  assert(validComment.success, "Menerima komentar valid <= 1.000 karakter");

  // Error response formatter
  if (!shortTitle.success) {
    const formatted = formatZodErrors(shortTitle.error);
    assert(Array.isArray(formatted.title), "Format error dictionary memetakan path field");
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Rate Limiting & Anti-Spam (API)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n⏱️ [3] Pengujian Rate Limiting (In-Memory & Sliding Window)");

  const testUser = "test-user-rate-" + Date.now();

  // Test Ticket Limiter (5 tickets / 10 mins)
  for (let i = 1; i <= 6; i++) {
    const res = await checkRateLimit(testUser, LIMIT_CONFIGS.TICKET_CREATE);
    if (i <= 5) {
      if (!res.success) assert(false, `Request tiket ke-${i} harusnya berhasil`);
    } else {
      assert(!res.success, "Request pembuatan tiket ke-6 diblokir (429)");
      const resp429 = createRateLimitResponse(res);
      assert(resp429.status === 429, "Response status adalah 429 Too Many Requests");
      assert(resp429.headers.has("Retry-After"), "Header Retry-After terpasang pada respon 429");
    }
  }

  // Test Comment Limiter (15 comments / 1 min)
  const commentUser = "test-comment-user-" + Date.now();
  for (let i = 1; i <= 15; i++) {
    await checkRateLimit(commentUser, LIMIT_CONFIGS.COMMENT_CREATE);
  }
  const commentOver = await checkRateLimit(commentUser, LIMIT_CONFIGS.COMMENT_CREATE);
  assert(!commentOver.success, "Request komentar ke-16 diblokir (maks. 15 per menit)");

  // Test Login Attempt Limiter (5 failures / 15 mins)
  const loginTarget = `test-ip:baduser@company.com`;
  for (let i = 1; i <= 5; i++) {
    await checkRateLimit(loginTarget, LIMIT_CONFIGS.AUTH_LOGIN);
  }
  const loginOver = await checkRateLimit(loginTarget, LIMIT_CONFIGS.AUTH_LOGIN);
  assert(!loginOver.success, "Percobaan login ke-6 diblokir (maks. 5 kegagalan / 15 menit)");

  // Reset login counter test
  resetMemoryRateLimit(loginTarget, LIMIT_CONFIGS.AUTH_LOGIN.prefix);
  const loginAfterReset = await checkRateLimit(loginTarget, LIMIT_CONFIGS.AUTH_LOGIN);
  assert(loginAfterReset.success, "Reset penghitung login berhasil saat login sukses");

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Anti-Double Submission & Idempotency
  // ─────────────────────────────────────────────────────────────────
  console.log("\n🔒 [4] Pengujian Anti-Double Submission (Idempotency Key)");

  const token = generateIdempotencyToken();
  const firstSubmit = checkIdempotency(token, 60);
  assert(firstSubmit.allowed, "Submission pertama diizinkan dan mengunci status in-progress");

  const doubleSubmit = checkIdempotency(token, 60);
  assert(!doubleSubmit.allowed, "Submission ganda kedua dicegah");
  if (!doubleSubmit.allowed) {
    assert(doubleSubmit.response.status === 409, "Respon submission ganda berstatus 409 Conflict");
  }

  // Resolve idempotency with response data
  resolveIdempotency(token, { success: true, ticketId: "HD-999" }, 201, 60);
  const replaySubmit = checkIdempotency(token, 60);
  assert(!replaySubmit.allowed, "Replay permintaan dicegah dari eksekusi ulang ganda");

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Strict Pagination & Query Protection
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📄 [5] Pengujian Strict Pagination & Hard Cap Limit");

  // Hard Cap Limit 50
  const abusedParams = new URLSearchParams("limit=999999&page=1");
  const parsedAbused = parsePaginationParams(abusedParams);
  assert(parsedAbused.limit === MAX_HARD_CAP_LIMIT, "Limit 999999 dipangkas ke hard cap 50");
  assert(parsedAbused.limit === 50, "Maksimal keras limit adalah 50");

  // Default limit 20
  const defaultParams = new URLSearchParams("");
  const parsedDefault = parsePaginationParams(defaultParams);
  assert(parsedDefault.limit === 20, "Default limit adalah 20 ketika tidak ditentukan");
  assert(parsedDefault.page === 1, "Default page adalah 1");

  // Negative page sanitized to 1
  const negativePageParams = new URLSearchParams("page=-10&limit=15");
  const parsedNegative = parsePaginationParams(negativePageParams);
  assert(parsedNegative.page === 1, "Page negatif (-10) disanitasi menjadi 1");
  assert(parsedNegative.offset === 0, "Offset untuk page 1 adalah 0");

  // Paginated Response Builder
  const sampleItems = ["A", "B", "C"];
  const paginatedRes = buildPaginatedResponse(sampleItems, 100, 2, 20);
  assert(paginatedRes.pagination.totalPages === 5, "Total halaman dihitung akurat (100 / 20 = 5)");
  assert(paginatedRes.pagination.hasNextPage === true, "hasNextPage bernilai true di halaman 2");
  assert(paginatedRes.pagination.hasPrevPage === true, "hasPrevPage bernilai true di halaman 2");

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Export Guard (Date Range & 2-Min Cooldown)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n📊 [6] Pengujian Guard Ekspor Laporan (CSV/PDF)");

  // Rentang 15 hari (valid)
  const validRange = validateExportDateRange("2026-05-01", "2026-05-15");
  assert(validRange.isValid, "Menerima rentang 15 hari (<= 30 hari)");

  // Rentang 45 hari (> 30 hari, harus ditolak)
  const tooLongRange = validateExportDateRange("2026-04-01", "2026-05-20");
  assert(!tooLongRange.isValid, "Menolak rentang > 30 hari (terdeteksi 49 hari)");

  // Tanggal awal > tanggal akhir
  const invertedRange = validateExportDateRange("2026-05-20", "2026-05-01");
  assert(!invertedRange.isValid, "Menolak jika tanggal awal > tanggal akhir");

  // Tanggal awal masa depan
  const futureRange = validateExportDateRange("2028-01-01", "2028-01-10");
  assert(!futureRange.isValid, "Menolak tanggal awal di masa depan");

  // Cooldown Ekspor (1 request per 2 menit)
  const exportUser = "export-user-" + Date.now();
  const firstExport = await checkExportCooldown(exportUser);
  assert(firstExport.allowed, "Ekspor pertama diizinkan");

  const secondExport = await checkExportCooldown(exportUser);
  assert(!secondExport.allowed, "Ekspor kedua dalam jeda 2 menit ditolak (429 Cooldown)");

  // CSV Escaping RFC 4180
  const csvSafe = escapeCsvField('Issue with, "quotes" and \n newlines');
  assert(csvSafe.includes('""quotes""'), "Karakter quote dalam CSV di-escape dengan RFC 4180");

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: Audit Bug Fixes & Regression Checks
  // ─────────────────────────────────────────────────────────────────
  console.log("\n🛡️ [7] Pengujian Perbaikan Audit & Proteksi Tambahan");

  // A. peekRateLimit tidak mengonsumsi kuota
  const peekId = "peek-test-" + Date.now();
  const peek1 = await peekRateLimit(peekId, LIMIT_CONFIGS.AUTH_LOGIN);
  assert(peek1.success && peek1.remaining === 5, "peekRateLimit pertama mengembalikan remaining 5");

  for (let i = 0; i < 5; i++) {
    await peekRateLimit(peekId, LIMIT_CONFIGS.AUTH_LOGIN);
  }
  const peekAfterMulti = await peekRateLimit(peekId, LIMIT_CONFIGS.AUTH_LOGIN);
  assert(peekAfterMulti.remaining === 5, "peekRateLimit berulang kali tidak mengonsumsi kuota (remaining tetap 5)");

  // Normal checkRateLimit mengonsumsi 1 slot
  const consume1 = await checkRateLimit(peekId, LIMIT_CONFIGS.AUTH_LOGIN);
  assert(consume1.success && consume1.remaining === 4, "checkRateLimit mengonsumsi kuota tepat 1 slot (remaining 4)");

  // B. Serialisasi Multi-File Attachment
  const multiSerialized = serializeAttachments(["https://storage/1.png", "https://storage/2.pdf"]);
  assert(
    multiSerialized === JSON.stringify(["https://storage/1.png", "https://storage/2.pdf"]),
    "serializeAttachments mengonversi multi-URL menjadi format JSON array string"
  );

  const singleFallback = serializeAttachments(null, "https://storage/single.jpg");
  assert(singleFallback === "https://storage/single.jpg", "serializeAttachments mempertahankan single URL lama");

  const emptyAttachment = serializeAttachments(null, null);
  assert(emptyAttachment === null, "serializeAttachments mengembalikan null jika tidak ada lampiran");

  // C. Zod Attachment Validation (Max 5 items)
  const validTicketWithAttachments = createTicketSchema.safeParse({
    title: "Gangguan koneksi internet ruang meeting",
    description: "Koneksi terputus saat presentasi penting",
    priority: "HIGH",
    categoryId: "cat-3",
    attachmentUrls: [
      "https://example.com/1.png",
      "https://example.com/2.png",
      "https://example.com/3.png",
      "https://example.com/4.png",
      "https://example.com/5.png",
    ],
  });
  assert(validTicketWithAttachments.success, "createTicketSchema menerima 5 berkas lampiran");

  const excessiveTicketAttachments = createTicketSchema.safeParse({
    title: "Gangguan koneksi internet ruang meeting",
    description: "Koneksi terputus saat presentasi penting",
    priority: "HIGH",
    categoryId: "cat-3",
    attachmentUrls: [
      "https://example.com/1.png",
      "https://example.com/2.png",
      "https://example.com/3.png",
      "https://example.com/4.png",
      "https://example.com/5.png",
      "https://example.com/6.png",
    ],
  });
  assert(!excessiveTicketAttachments.success, "createTicketSchema menolak lebih dari 5 berkas lampiran (> 5 file)");

  // D. Legacy Route /api/tickets HTTP 308 Permanent Redirect
  const reqGet = new Request("http://localhost:3000/api/tickets?status=open", { method: "GET" });
  const resGet = await legacyGet(reqGet);
  assert(resGet.status === 308, "Legacy GET /api/tickets mengembalikan HTTP 308 Permanent Redirect");
  assert(
    resGet.headers.get("location")?.includes("/api/v1/tickets") === true,
    "Legacy GET /api/tickets me-redirect target lokasi ke /api/v1/tickets"
  );

  const reqPost = new Request("http://localhost:3000/api/tickets", { method: "POST" });
  const resPost = await legacyPost(reqPost);
  assert(resPost.status === 308, "Legacy POST /api/tickets mengembalikan HTTP 308 Permanent Redirect");
  assert(
    resPost.headers.get("location")?.includes("/api/v1/tickets") === true,
    "Legacy POST /api/tickets me-redirect target lokasi ke /api/v1/tickets"
  );

  // ── [8] Pengujian Keep-Alive Ping (Supabase Anti-Inactivity) ─────────
  console.log("\n📡 [8] Pengujian Keep-Alive Ping (Supabase Anti-Inactivity)");
  const pingRes = await pingGet();
  assert(pingRes.status === 200, "Ping endpoint merespon dengan status HTTP 200");
  const pingData = await pingRes.json();
  assert(pingData.success === true, "Ping payload mengindikasikan status success: true");
  assert(typeof pingData.latencyMs === "number", "Ping payload mencatat metrik latensi ms");
  assert(typeof pingData.timestamp === "string", "Ping payload menyertakan ISO timestamp");

  // ── [9] Pengujian Optimasi Batch 2: Timezone, Form Multi-Value, Export RBAC & Rate Reset ──
  console.log("\n⚡ [9] Pengujian Batch 2: Timezone, Form Multi-Value, Export RBAC & Rate Reset");

  // A. Timezone Start-Of-Period
  const testWibDate = new Date("2026-10-18T23:30:00Z"); // 06:30 WIB on Oct 19
  const dailyPeriod = getStartOfPeriod("daily", testWibDate, "Asia/Jakarta");
  assert(
    dailyPeriod.toISOString().startsWith("2026-10-18T17:00:00"),
    "Batas waktu harian WIB (UTC+7) dihitung presisi (00:00 WIB = 17:00 UTC hari sebelumnya)"
  );
  const monthlyPeriod = getStartOfPeriod("monthly", testWibDate, "Asia/Jakarta");
  assert(
    monthlyPeriod.toISOString().includes("2026-09-30T17:00:00") || monthlyPeriod.getDate() === 1,
    "Batas waktu bulanan WIB dimulai pada awal bulan kalender"
  );

  // B. Multi-value FormData parser
  const testSchema = z.object({
    title: z.string(),
    tags: z.array(z.string()),
  });
  const testFormData = new FormData();
  testFormData.append("title", "Test Ticket");
  testFormData.append("tags", "hardware");
  testFormData.append("tags", "urgent");

  const formRequest = new Request("http://localhost:3000/api/test", {
    method: "POST",
    body: testFormData,
  });
  const validationRes = await validateRequestBody(testSchema, formRequest);
  assert(validationRes.success === true, "validateRequestBody berhasil memvalidasi multipart form");
  if (validationRes.success) {
    assert(
      Array.isArray(validationRes.data.tags) && validationRes.data.tags.length === 2,
      "validateRequestBody mengumpulkan key form duplikat menjadi array"
    );
  }

  // C. Export RBAC Isolation for Agent
  await resetRateLimit("user-4", "rl:export");
  const agentToken = encodeSession({
    id: "user-4", // john@support
    email: "john@support",
    fullName: "John Support",
    role: "agent",
  });
  const now = new Date();
  const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startParam = past7Days.toISOString().slice(0, 10);
  const endParam = now.toISOString().slice(0, 10);

  const agentExportReq = new Request(
    `http://localhost:3000/api/v1/tickets/export?startDate=${startParam}&endDate=${endParam}&format=json`,
    {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${agentToken}`,
      },
    }
  );
  const agentExportRes = await exportGet(agentExportReq);
  const agentExportData = await agentExportRes.json();
  assert(agentExportRes.status === 200, "Ekspor tiket oleh agen berstatus HTTP 200");
  assert(agentExportData.success === true, "Ekspor tiket oleh agen sukses");
  const hasOtherAgentTicket = agentExportData.data?.some(
    (t: { assignedToName: string }) => t.assignedToName === "Mike Chen"
  );
  assert(!hasOtherAgentTicket, "Agen tidak dapat mengekspor tiket privat milik teknisi lain");

  // D. Reset Rate Limit
  const testResetKey = "test-reset-client-ip";
  const testResetCfg = { limit: 1, windowMs: 60000, prefix: "rl:test" };
  await checkRateLimit(testResetKey, testResetCfg);
  const peekBlocked = await peekRateLimit(testResetKey, testResetCfg);
  assert(peekBlocked.remaining === 0, "Rate limit mendeteksi batas terlampaui sebelum reset");
  await resetRateLimit(testResetKey, "rl:test");
  const peekAfterReset = await peekRateLimit(testResetKey, testResetCfg);
  assert(peekAfterReset.remaining === 1, "resetRateLimit berhasil mengembalikan kuota penuh");

  console.log("\n========================================================");
  console.log(`  HASIL: ${passedCount} LULUS, ${failedCount} GAGAL`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
