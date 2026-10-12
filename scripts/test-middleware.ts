/**
 * Automated Test Suite for Next.js Middleware & Server-Side RBAC
 */

import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { encodeSession, SESSION_COOKIE_NAME } from "../src/lib/auth-session";

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

function createMockRequest(urlPath: string, role?: "admin" | "agent" | "karyawan"): NextRequest {
  const url = `http://localhost:3000${urlPath}`;
  const headers = new Headers();

  if (role) {
    const sessionToken = encodeSession({
      id: `user-${role}-1`,
      email: `${role}@company.com`,
      fullName: `Test ${role}`,
      role,
    });
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }

  return new NextRequest(url, { headers });
}

async function runMiddlewareTests() {
  console.log("\n========================================================");
  console.log("  NEXT.JS EDGE PROXY & SERVER-SIDE RBAC TEST SUITE");
  console.log("========================================================\n");

  // 1. Unauthenticated accessing protected routes
  console.log("🔒 [1] Pengujian Akses Pengunjung Tanpa Sesi (Unauthenticated)");
  const reqUnauthAdmin = createMockRequest("/admin");
  const resUnauthAdmin = await proxy(reqUnauthAdmin);
  assert(
    resUnauthAdmin.headers.get("location")?.includes("/login?redirectTo=%2Fadmin") ?? false,
    "Unauthenticated buka /admin di-redirect ke /login?redirectTo=/admin"
  );

  const reqUnauthEmployee = createMockRequest("/employee/tickets");
  const resUnauthEmployee = await proxy(reqUnauthEmployee);
  assert(
    resUnauthEmployee.headers.get("location")?.includes("/login?redirectTo=%2Femployee%2Ftickets") ?? false,
    "Unauthenticated buka /employee/tickets di-redirect ke /login"
  );

  // 2. Karyawan role access
  console.log("\n👤 [2] Pengujian Hak Akses Karyawan (RBAC)");
  const reqKaryawanEmployee = createMockRequest("/employee/tickets", "karyawan");
  const resKaryawanEmployee = await proxy(reqKaryawanEmployee);
  assert(
    !resKaryawanEmployee.headers.get("location"),
    "Karyawan diizinkan membuka /employee/tickets (tanpa redirect)"
  );

  const reqKaryawanAdmin = createMockRequest("/admin", "karyawan");
  const resKaryawanAdmin = await proxy(reqKaryawanAdmin);
  assert(
    resKaryawanAdmin.headers.get("location")?.includes("/unauthorized") ?? false,
    "Karyawan buka /admin dicegat dan di-redirect ke /unauthorized"
  );

  // 3. Agent role access
  console.log("\n🎧 [3] Pengujian Hak Akses Agent (RBAC)");
  const reqAgentAdmin = createMockRequest("/admin", "agent");
  const resAgentAdmin = await proxy(reqAgentAdmin);
  assert(
    !resAgentAdmin.headers.get("location"),
    "Agent diizinkan membuka /admin (tanpa redirect)"
  );

  const reqAgentEmployeeMgmt = createMockRequest("/admin/employees/create", "agent");
  const resAgentEmployeeMgmt = await proxy(reqAgentEmployeeMgmt);
  assert(
    resAgentEmployeeMgmt.headers.get("location")?.includes("/unauthorized") ?? false,
    "Agent buka /admin/employees/create dicegat dan di-redirect ke /unauthorized"
  );

  // 4. Admin role access
  console.log("\n👑 [4] Pengujian Hak Akses Admin (RBAC)");
  const reqAdminEmployeeMgmt = createMockRequest("/admin/employees/create", "admin");
  const resAdminEmployeeMgmt = await proxy(reqAdminEmployeeMgmt);
  assert(
    !resAdminEmployeeMgmt.headers.get("location"),
    "Admin diizinkan membuka /admin/employees/create (tanpa redirect)"
  );

  // 5. Authenticated visiting /login
  console.log("\n🔄 [5] Pengujian Pengunjung Sudah Login Membuka /login");
  const reqLoginAdmin = createMockRequest("/login", "admin");
  const resLoginAdmin = await proxy(reqLoginAdmin);
  assert(
    resLoginAdmin.headers.get("location")?.endsWith("/admin") ?? false,
    "Admin buka /login otomatis di-redirect ke /admin"
  );

  const reqLoginKaryawan = createMockRequest("/login", "karyawan");
  const resLoginKaryawan = await proxy(reqLoginKaryawan);
  assert(
    resLoginKaryawan.headers.get("location")?.endsWith("/employee/tickets") ?? false,
    "Karyawan buka /login otomatis di-redirect ke /employee/tickets"
  );

  const reqLoginGuest = createMockRequest("/login");
  const resLoginGuest = await proxy(reqLoginGuest);
  assert(
    !resLoginGuest.headers.get("location"),
    "Guest belum login diizinkan melihat form /login"
  );

  console.log("\n========================================================");
  console.log(`  HASIL: ${passedCount} LULUS, ${failedCount} GAGAL`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMiddlewareTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
