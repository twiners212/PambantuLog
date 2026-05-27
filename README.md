# PambantuLog

**PambantuLog** adalah sistem *Internal Helpdesk* (Layanan Pengaduan Karyawan) terpusat yang dirancang untuk mencatat, melacak, dan menyelesaikan setiap permintaan bantuan teknis dari karyawan. Sistem ini menggantikan pelaporan manual menjadi alur yang sistematis, terukur, dan transparan.


## ✨ Fitur Utama
- **Role-Based Access Control (RBAC)**: Pemisahan hak akses yang ketat antara Admin, Teknisi (Agent), dan Karyawan (User).
- **Manajemen Tiket (State Machine)**: Pelacakan status tiket secara real-time (*Open, In Progress, Waiting on User, Resolved, Closed*).
- **Feedback Loop**: Sistem penilaian tingkat kepuasan layanan oleh karyawan setelah tiket diselesaikan.
- **Utas Percakapan (Comments)**: Diskusi interaktif terpusat pada setiap tiket antara pelapor dan teknisi.
- **Keamanan Tingkat Lanjut**: Implementasi *Row Level Security* (RLS) di level database untuk menjamin privasi data antar pengguna.

## 🛠 Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, OKLCH Colors, Lucide React
- **Backend & Auth**: Supabase (PostgreSQL, Auth, Storage)
- **ORM**: Drizzle ORM

## 🚀 Cara Install

1. Clone repositori ini:
   ```bash
   git clone <repository-url>
   cd PambantuLog
   ```
2. Instal semua dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   * Salin file contoh environment ke environment lokal:
     ```bash
     cp .env.example .env.local
     ```
   * Isi variabel pada `.env.local` dengan kredensial Supabase Anda.

## 💻 Cara Menjalankan Project (Local Development)

Jalankan *development server*:
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk melihat aplikasi.

## 📦 Cara Build (Production)

Untuk menghasilkan versi *production-ready*:
```bash
npm run build
```
Kemudian Anda bisa menjalankan hasil *build* dengan:
```bash
npm run start
```

## 📂 Struktur Folder Singkat

```text
PambantuLog/
├── docs/             # Dokumentasi arsitektur, PRD, dan laporan proyek
├── public/           # Aset statis (gambar, ikon)
├── scripts/          # Skrip utilitas untuk setup database dan seeding
└── src/
    ├── app/          # Routing dan halaman (Next.js App Router)
    ├── components/   # Komponen UI modular dan reusable
    ├── db/           # Skema Drizzle ORM dan koneksi database
    ├── hooks/        # Custom React Hooks
    ├── lib/          # Fungsi utilitas (Supabase client, formatters)
    ├── styles/       # File CSS global (Tailwind)
    └── types/        # Definisi antarmuka (interfaces) TypeScript
```
