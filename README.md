# PINDEX

**PINDEX** adalah aplikasi pengorganisasi dan pencarian dokumen kerja lokal/offline untuk desktop Windows, dilengkapi dengan modul terintegrasi **TodoList** dan **Logbook**.

Dirancang untuk kecepatan, keandalan, dan privasi penuh — seluruh data Anda tersimpan dan diproses secara lokal tanpa memerlukan koneksi internet.

---

## Identitas & Maskot

PINDEX ditemani oleh **Si Pita** (*The Bookmark Ribbon Spirit*) — roh penanda halaman berwujud pita hijau zamrud dengan ekspresi ramah yang selalu siap membantu Anda menavigasi, mengingat, dan merapikan tumpukan dokumen serta catatan kerja.

---

## Arsitektur

- **Single Binary**: Backend berbasis Go pustaka standar (stdlib saja) yang ringan dan mandiri, berjalan pada `localhost:8080`.
- **Zero External Dependencies & Zero CDN**: Tanpa framework CSS/JS berat, tanpa Node.js di runtime, dan tanpa panggilan jaringan ke luar.
- **100% Offline-First**: Disajikan sebagai Single Page Application (SPA) vanilla JS/CSS langsung dari direktori rilis lokal.
- **Penyimpanan Lokal**: Seluruh data tersimpan dalam format berkas JSON lokal (`data.json`).

---

## Fitur Utama

1. **Pencarian 3 Lapis (Multi-tier Search)**:
   - **Lapis 1**: Pencarian instan pada Judul dan Tag.
   - **Lapis 2**: Pencarian pada Catatan.
   - **Lapis 3**: Pencarian mendalam pada Langkah SOP.
2. **Penampil Langkah SOP Terstruktur**: Menampilkan instruksi prosedur operasional kerja baris per baris secara rapi dan fokus.
3. **Pembuka Path Lokal Windows**:
   - Mendukung format drive letter (`C:\...`, `D:\...`), folder kerja drive (`D:`), UNC path network (`\\server\share`), dan skema `file:///`.
   - Tombol **Buka** membuka langsung di Windows Explorer / aplikasi asosiasi sistem, dilengkapi fallback tombol **Copy**.
4. **Modul TodoList & Logbook**:
   - Pengelolaan daftar tugas kerja berbatas waktu (deadline) dengan status dan saran tautan terintegrasi.
   - Pencatatan aktivitas harian pada logbook kerja.
5. **Backup Otomatis Harian**:
   - Setiap kali terjadi penyimpanan, sistem secara otomatis membuat salinan cadangan harian `data-YYYYMMDD.json` untuk mencegah kehilangan data.
   - Fitur Ekspor dan Impor data JSON mandiri.

---

## Prasyarat

- **Sistem Operasi**: Windows 10 / 11 (64-bit).
- **Pengembangan / Build**:
  - [Go 1.22+](https://go.dev/) (hanya diperlukan jika mengompilasi dari kode sumber).
  - PowerShell (bawaan Windows).

---

## Cara Build

Untuk mengompilasi binary backend dan menyinkronkan aset frontend ke paket distribusi `dist/v1/`:

```powershell
.\build.ps1
```

Opsi tambahan pada skrip build:
- `.\build.ps1 -CheckOnly` : Memeriksa integritas dan sinkronisasi berkas tanpa mengubah apa pun.
- `.\build.ps1 -NoExe` : Menyinkronkan berkas frontend tanpa melakukan kompilasi ulang berkas executable Go.

Hasil build akan ditempatkan di folder `dist/v1/` (`pindex.exe` beserta seluruh aset web statis).

---

## Cara Menjalankan

1. Buka folder `dist/v1/`.
2. Jalankan berkas aplikasi:
   ```powershell
   .\dist\v1\pindex.exe
   ```
3. Buka browser web dan akses:
   ```
   http://localhost:8080
   ```
   *(Aplikasi siap digunakan secara penuh dan offline).*

---

## Struktur Direktori

```text
IndeksKerja/
├── build.ps1             # Skrip automasi build dan sinkronisasi rilis
├── dist/                 # Paket rilis aplikasi
│   └── v1/               # Binary pindex.exe dan aset frontend produksi
├── src/
│   ├── frontend/         # Aset antarmuka pengguna (HTML, vanilla JS, CSS, aset Si Pita)
│   ├── pro/              # Kode sumber backend Go (stdlib)
│   └── shared/           # Skema dan data contoh
└── tests/                # Rangkaian pengujian otomatis (Node.js test runner)
```

---

## Catatan Penggunaan & Lisensi

Aplikasi ini ditujukan untuk produktivitas kerja personal dan tim internal secara mandiri dan aman di lingkungan desktop lokal. Bebas digunakan, dimodifikasi, dan didistribusikan sesuai kebutuhan internal Anda.
