# PambantuLog — Brand & Logo Guidelines

> Panduan identitas visual resmi untuk platform **PambantuLog** (Enterprise Helpdesk & Incident Tracking).

---

## 1. Konsep & Filosofi Logo
- **Ide**: Monogram huruf **P** geometris yang mengintegrasikan batang vertikal kokoh (*timeline audit log*) dan cekungan tiket insiden (*ticket punch notch*) di sisi kurva.
- **Karakter**: Modern, minimalis, dan terpercaya — merefleksikan arsitektur *zero-trust security*, keandalan pelacakan insiden, dan kemudahan bantuan teknis internal.
- **Varian Utama**:
  - `pambantulog-lockup-horizontal.svg` (Header/Navbar web dashboard)
  - `pambantulog-lockup-dark.svg` (Navbar mode gelap / dark background)
  - `pambantulog-symbol.svg` (Ikon master dua warna)
  - `pambantulog-app-icon.svg` (Tile squircle untuk icon aplikasi / PWA)
  - `dist/favicon.ico` & `dist/favicon.svg` (Tab browser)

---

## 2. Palet Warna Resmi

| Peran | Nama Warna | HEX | RGB | Penggunaan |
|---|---|---|---|---|
| **Primary Base** | Midnight Navy | `#00163A` | `rgb(0, 22, 58)` | Batang stem log, teks utama, background sidebar/app tile |
| **Accent Primary** | Golden Amber | `#DCA12D` | `rgb(220, 161, 45)` | Kurva tiket, teks "Log", status highlight & aksen |
| **Neutral Surface** | Clean Slate | `#F8FAFC` | `rgb(248, 250, 252)` | Background dashboard, container light mode |
| **Dark Invert** | Pure White | `#FFFFFF` | `rgb(255, 255, 255)` | Teks dan simbol terbalik pada latar gelap |

### Pasangan Kontras yang Disetujui:
- **Full Color**: Di atas latar belakang putih (`#FFFFFF`) atau pale slate (`#F8FAFC`).
- **Dark Mode**: Lockup dark (`#FFFFFF` + `#DCA12D`) di atas latar Midnight Navy (`#00163A`) atau Dark Slate (`#0F172A`).
- **Monochrome**: Versi hitam pekat (`#000000`) untuk cetak dokumen resmi / faktur, dan versi putih (`#FFFFFF`) untuk media gelap.

---

## 3. Clear Space & Ukuran Minimum

### Clear Space:
- Sisakan area kosong di sekeliling logo minimal sebesar **$1 \times X$**, di mana **$X$** adalah lebar batang vertikal stem huruf P (kurang lebih 20% tinggi logo).
- Jangan meletakkan elemen visual, teks lain, atau tombol di dalam zona *clear space*.

### Ukuran Minimum (*Minimum Size*):
| Varian | Media Digital | Media Cetak |
|---|---|---|
| **Horizontal Lockup** | Min. lebar 120 px | Min. lebar 30 mm |
| **Master Symbol** | Min. 24 px | Min. 8 mm |
| **Favicon Cut** | 16 px (gunakan file khusus `favicon.ico` / `favicon.svg`) | — |

---

## 4. Tipografi Resmi
- **Display / Logo Wordmark**: Geometric Sans-Serif (`Google Sans Flex` / `Inter`, Bold 700).
- **Antarmuka Aplikasi (UI)**: `Google Sans Flex`, `ui-sans-serif`, `system-ui`.
- **Code & Timestamp Log**: `Google Sans Code`, `ui-monospace`, `monospace`.

---

## 5. Larangan Penggunaan (*Don'ts*)
- ❌ **Jangan meregangkan atau memipihkan** proporsi logo (*do not squash or stretch*).
- ❌ **Jangan mengubah warna** di luar palet resmi yang telah ditetapkan.
- ❌ **Jangan memutar (rotate)** sudut logo.
- ❌ **Jangan menambahkan drop shadow berlebihan**, bevel, outline warna-warni, atau gradien yang tidak perlu.
- ❌ **Jangan mengetik ulang teks logo secara manual** dengan font sembarangan; selalu gunakan file aset vektor master SVG yang disediakan di folder `dist/`.
