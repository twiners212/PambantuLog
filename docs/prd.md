# Dokumentasi Master: PambantuLog (Layanan Pengaduan Karyawan)

## 1. Latar Belakang dan Tujuan
PambantuLog adalah sistem tiket terpusat (*Internal Helpdesk System*) yang dirancang untuk mencatat, melacak, dan menyelesaikan setiap permintaan bantuan teknis atau pengaduan dari karyawan [1]. Sistem ini menggantikan jalur pelaporan manual yang sering tercecer (seperti via pesan instan atau telepon), sehingga penyelesaian masalah dapat dilakukan secara sistematis, terukur, dan transparan [1].

## 2. Arsitektur dan Teknologi Dasar
Sistem ini dibangun dengan pendekatan *Single-Page Application* (SPA) menggunakan arsitektur pemisahan *frontend* dan *backend* berbasis REST API [2].
* **Frontend**: Dibangun menggunakan React (Next.js *App Router*), manajemen *state* dengan React Hooks, serta kumpulan ikon dari Lucide React [3-5].
* **Desain Sistem & Styling**: Secara eksklusif diwajibkan menggunakan **Tailwind CSS v4** yang mengandalkan format warna OKLCH, bayangan kustom (*shadow*), dan sintaks `@theme inline` untuk variabel desain [4, 6, 7]. Font yang digunakan adalah Google Sans Flex, Noto Serif Thai, dan Google Sans Code [4, 7]. Sintaks *legacy* dari Tailwind v3 dilarang [4, 7].
* **Backend & Database**: Menggunakan Supabase sebagai *Backend-as-a-Service* yang melayani basis data PostgreSQL relasional dan sistem penyimpanan *Storage* untuk lampiran gambar dokumen pengaduan [5]. Skema data dirancang secara *type-safe* menggunakan Drizzle ORM [8].

## 3. Manajemen Akses (Role-Based Access Control)
Sistem ini murni beroperasi untuk internal perusahaan dengan mematikan registrasi publik sepenuhnya [1, 8, 9].
* **Administrator (Admin)**: Memegang kontrol sentral dengan kewenangan penuh untuk membuat (`create`), mengubah, atau menghapus pengguna (Karyawan dan Teknisi) via Supabase Admin API (`admin.createUser()`), serta mengelola data referensi master sistem [9-11].
* **Teknisi (Agent)**: Bertugas menerima, merespons, memperbarui status tiket (*state machine*), dan berkomunikasi melalui balasan komentar [11].
* **Karyawan (User)**: Hanya dapat masuk (*login*) menggunakan kredensial buatan Admin. Berhak membuat tiket baru, memantau *dashboard* tiket pribadinya, dan memberikan nilai penilaian (*feedback*) [11].
* **Row Level Security (RLS)**: Diaktifkan pada basis data Supabase untuk memastikan bahwa setiap karyawan hanya memiliki akses operasi (*SELECT* / *INSERT*) terhadap data pengaduan yang memuat UUID mereka sendiri pada kolom `created_by_id` [12].

## 4. Alur Pergerakan Tiket (State Machine)
Terdapat aturan yang sangat ketat mengenai tahapan resolusi setiap tiket, yang menggunakan transisi linier berikut [13-15]:
1. **Open**: Tiket pertama kali masuk ke sistem dari karyawan [15].
2. **In Progress**: Teknisi telah ditugaskan dan sedang memecahkan permasalahan teknis [15].
3. **Waiting on User**: Teknisi memerlukan konfirmasi atau informasi ekstra dari karyawan yang bersangkutan [15].
4. **Resolved**: Masalah secara teknis dinyatakan selesai oleh Teknisi [15]. Pada tahapan ini, antarmuka karyawan akan memunculkan komponen formulir penilaian (Rating/Feedback Loop) secara eksklusif [14, 16, 17].
5. **Closed**: Tiket resmi selesai ditutup setelah pelapor memberikan skor kepuasan mereka [15].

## 5. Skema Drizzle ORM Inti
* **Enum Pembatas**: Tipe *role* (`admin`, `agent`, `karyawan`), siklus *status* (`open`, `in_progress`, `pending`, `resolved`, `closed`), dan batas *priority* (`low`, `medium`, `high`, `urgent`) dibatasi menggunakan utilitas `pgEnum` [18, 19].
* **Tabel `users`**: Bertautan (relasi 1:1) dengan skema `auth.users` Supabase, menyimpan metadata profil pengguna publik seperti nama lengkap, ID, alamat email, role, dan departemen [18-20].
* **Tabel `categories`**: Tempat penyimpanan data kategori pengaduan utama seperti perangkat keras, perangkat lunak, dan jaringan [5, 18].
* **Tabel `tickets`**: Inti pengaduan, yang terhubung melalui UUID menuju pembuat laporan (`creator_id`) dan agen (`assigned_id`) pada relasi *Foreign Key* ke tabel pengguna [18, 20, 21].
* **Tabel `ticket_comments`**: Menyimpan utas percakapan antara karyawan dan agen mengenai insiden bersangkutan [20, 21].

## 6. Daftar Registri REST API (MVP)
* `POST /api/v1/auth/login`: Endpoint publik untuk memvalidasi kredensial pengguna dan mengembalikan *access token* [22, 23].
* `POST /api/admin/users`: Titik akses terpusat khusus untuk Administrator agar dapat mengeksekusi pendaftaran pengguna baru (mengandalkan kunci privilese `Service Role Key`) di Supabase, yang kemudian diikat langsung ke basis data publik [24-26].
* `DELETE /api/admin/users/:id`: Rutinitas eksplisit Admin untuk menghapus pengguna (*user*) [27].
* `POST /api/tickets`: Endpoint khusus Karyawan untuk menginisialisasi pembuatan laporan pengaduan; di mana properti `createdById` dijamin validitas keamanannya dengan menarik ID langsung dari sesi (session) Supabase aktif [22, 26, 28].
* Rute *Ticketing* lainnya: Tersedia rute pendukung `GET /api/v1/tickets` untuk pemanggilan data grid master yang difilter berdasar kelas RBAC, `PATCH /api/v1/tickets/:id/status` bagi pembaruan lintasan tiket, serta `POST /api/v1/tickets/:id/comments` untuk memicu penambahan balasan utas insiden [22, 23].

## 7. Desain Komponen Frontend
Pembuatan antarmuka dipisahkan antara pengguna dasar dan operasional [6, 16]:
* **Area Autentikasi**: *Card Form* berdasar email dan sandi (*password*) [6, 14].
* **Area Karyawan**: Menampilkan daftar personal "*My Tickets*" dan menyertakan formulir masukan pengaduan beserta modul lampiran unggah berkas tunggal [14, 16].
* **Area Admin/Teknisi**: Terdapat daftar tiket komprehensif (Master) dengan filter berbasis statur dan panel administrasi anggota yang disusun rapi ke dalam tiga komponen struktur: *UserManagementPage*, *UserTable* (komponen tabel layar), serta *UserFormModal* (untuk pembuatan akun baru) [16, 29-33].

## 8. Skalabilitas Jangka Panjang (Roadmap)
* **Pemekaran Lintas Departemen**: Sistem sengaja diabstraksi agar modul pemrosesannya di masa mendatang dapat melayani area operasional di luar departemen TI (contohnya permohonan ke Sumber Daya Manusia atau pengurusan pemeliharaan fasilitas) dari *framework* yang sama [34, 35].
* **Triage Berbasis Kecerdasan Buatan (AI)**: Akan dirancang *webhook* ke asisten teks *Large Language Model* (LLM) di latar belakang guna mendeteksi secara otomatis nilai prioritas dan kategori pelaporan karyawan dari deskripsi masalah mereka [34, 35].
