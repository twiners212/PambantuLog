# Architecture Document

**Project:** PambantuLog (Internal Helpdesk / Ticketing System)

## 1. System Overview
PambantuLog dirancang menggunakan arsitektur aplikasi berbasis *Single-Page Application* (SPA) dengan lapisan integrasi *backend* berbasis REST API. Arsitektur ini memisahkan logika perutean (*routing logic*), antarmuka pengguna, dan basis data inti untuk menjamin skalabilitas di masa depan.

## 2. Technology Stack & Constraints

### Frontend
* **Framework Utama:** React dengan Next.js App Router.
* **Styling:** Tailwind CSS v4 menggunakan konfigurasi variabel CSS terpusat (`@theme inline`) dengan format warna OKLCH.
* **Manajemen State & Ikon:** React Hooks dan Lucide React.
* **Tipografi:** Google Sans Flex, Noto Serif Thai, dan Google Sans Code.

### Backend & Database
* **Backend-as-a-Service:** Supabase (meliputi pengelolaan PostgreSQL, otentikasi *Supabase Auth*, serta *Storage* untuk lampiran berkas).
* **ORM (Object-Relational Mapping):** Drizzle ORM dengan pendefinisian skema *type-safe* menggunakan TypeScript.
* **Keamanan & Otorisasi:** Pendaftaran publik dimatikan sepenuhnya. Hanya *Administrator* yang dapat membuat akun menggunakan *Supabase Admin API* (menggunakan *Service Role Key*). Akses data dilindungi oleh *Row Level Security* (RLS) di mana pengguna hanya bisa melihat dan menambahkan data sesuai identitas UUID mereka.

## 3. Database Schema (Drizzle ORM)
Basis data menggunakan tipe `enum` untuk membatasi entri data secara ketat pada rentang nilai peran (*role*), status, dan prioritas. Struktur tabel utama terdiri dari:
1. **`users`**: Tabel profil internal (berelasi 1:1 ke `auth.users` Supabase) yang mencakup ID, nama lengkap, email, peran, dan departemen.
2. **`categories`**: Tabel *master data* kategori pengaduan (misalnya: Hardware, Software, Jaringan).
3. **`tickets`**: Entitas inti pengaduan yang berelasi ke pembuat tiket (`createdById`) dan teknisi yang ditugaskan (`assignedToId`).
4. **`ticket_comments`**: Tabel rekam jejak percakapan dan utas balasan yang menyertakan relasi URL lampiran dari *Supabase Storage*.

## 4. Core Ticket Workflow (State Machine)
Siklus pergerakan tiket diatur oleh aturan transisi linier yang wajib dipatuhi:
**Open** ──> **In Progress** ──> **Waiting on User** ──> **Resolved** ──> **Closed**

*Catatan UI:* Komponen pengumpulan skor (Formulir Rating/Kepuasan) secara kondisional hanya dirender ketika tiket berstatus "Resolved".

## 5. Notification Engine
Proses notifikasi disalurkan melalui 3 saluran peringatan paralel:
* **In-App Engine:** *Push notification* untuk peringatan langsung di antarmuka.
* **Email Worker:** Pengiriman pembaruan transisi status via protokol SMTP.
* **Webhook Sender:** Untuk integrasi notifikasi via API eksternal.

## 6. Core REST API Endpoints Registry
Seluruh rute komunikasi berformat *payload* JSON. Registri rute utama mencakup:
* `POST /api/v1/auth/login`: Endpoint untuk memvalidasi kredensial pengguna.
* `POST /api/admin/users`: Endpoint untuk Administrator membuat entitas *user* baru.
* `DELETE /api/admin/users/:id`: Endpoint untuk Administrator menghapus akun *user*.
* `POST /api/tickets`: Memproses pembuatan tiket di mana `createdById` ditarik secara aman dari *session*.
* `GET /api/v1/tickets`: Menarik daftar data tiket dengan dukungan filter sesuai wewenang peran (Mixed RBAC).
* `PATCH /api/v1/tickets/:id/status`: Rute bagi Teknisi untuk memperbarui status tiket.
* `POST /api/v1/tickets/:id/comments`: Rute untuk menyematkan pesan baru di utas komentar.

## 7. Future Scalability Architecture
* **Multi-Department Expansion Model:** Logika pemrosesan dirancang modular agar ke depan dapat mendukung alur kerja manajemen Fasilitas, HR, atau Keuangan tanpa mengubah *framework* dasar SPA.
* **Automated AI Triage:** Rencana integrasi asisten LLM di belakang layar untuk secara otomatis memilah keluhan, mengklasifikasi kategori, dan menghitung tingkat prioritas dari insiden secara presisi.
