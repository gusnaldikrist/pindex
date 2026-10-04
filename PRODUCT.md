---
title: Product - Penanda
type: product
---

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pustakawan dan staf perpustakaan yang bekerja di humanities. Mereka bekerja dengan dokumen kerja yang tersebar di banyak sistem: Google Sheets, Google Forms, Google Drive, SLiMS Bulian, dan Repository institusi. Situasi pemakaiannya: mengantar orang, mencari akses sebuah dokumen, lalu membuka. Sasarannya bukan graduate student, melainkan staf yang tidak memakai tools teknis dan tidak nyaman dengan terminal.

## Product Purpose

Satu halaman daftar isi untuk menemukan akses dokumen kerja di bawah 10 detik. Keberhasilan diukur sebagai waktu sejak user mengetik kata kunci sampai menemukan dan membuka dokumen yang benar, bukan sebagai fitur yang tersedia.

Tiga modul: Indeks (pencarian tiga lapis), Todo (deadline murah tanpa notifikasi), dan Logbook (catatan kejadian).

## Positioning

Mekanisme yang membedakan: pencarian tiga lapis yang memisahkan "cocok langsung" dari "biasanya bareng ini". Lapis ketiga menarik item berdasarkan isi catatan pemicu, sehingga ingatan alur kerja user menjadi jalur penemuan sendiri. Budgetrary: bukan file manager, bukan pengingat, bukan multi-user.

## Operating Context

Berjalan lokal lewat `penanda.exe` yang menyajikan frontend dari folder binary dan dokumen disimpan di `data.json` di folder itu juga, dengan salinan harian otomatis `data-YYYYMMDD.json`.

Offline penuh. Nol request ke domain luar. Alat ini dipakai di satu komputer, satu orang, di depan arsip dokumen — bukan layanan jaringan dan tidak dimaksudkan dipakai bersama.

## Capabilities and Constraints

Fungsional: pencarian tiga lapis dengan urutan relevansi (tag langsung, tag berbagi, isi catatan); item dengan judul, tag, beberapa link, dan catatan; Todo dengan deadline tanpa notifikasi; Logbook dengan rentang tanggal; Export dan Import JSON; buka path lokal Windows lewat backend.

Batasan teknis yang mengikat: tanpa CDN, tanpa framework, tanpa build step, tanpa font eksternal. Frontend dimuat sebagai script biasa, bukan ES module. Ikon memakai glyph Unicode bawaan, bukan font ikon. Skema data hanya empat field pada item plus relasi pada todo dan log.

Isi data tidak boleh diubah oleh keputusan visual. Bentuk field, validasi, dan pesan error adalah kontrak yang sudah diverifikasi.

## Brand Commitments

Nama produk: **Penanda**. Bahasa antarmuka: Indonesia. Istilah domain: item, tag, todo, log, sop. Area status memakai pola `Penanda - N item - HH:MM`.

Referensi visual yang disepakati sebelumnya: token diekstrak dari desain UI Thesis Search (SUAKA). Kayu itu tetap tercatat sebagai asal token, bukan sebagai kewajiban tampilan.

## Evidence on Hand

Empat item data contoh di `src/shared/data.example.json`. Skenario pengguna dan kriteria ukur ada di PRD bagian 4. Hasil audit dan pengukuran ada di `.scratch/penanda-v1/issues/12-rilis-dan-audit.md`.

Belum ada: testimonial, studi kasus, logo, brand guideline dari designer, dan observasi staf tanpa panduan lisan. Pengembraan future work tidak boleh mengarang ketiganya.

## Product Principles

1. **Temu kembali lebih dulu daripada fitur.** Nilai produk diukur dalam detik, bukan dalam jumlah field.
2. **Satu cara jalan.** Satu tempat data, satu perintah menjalankan. Jangan menambah mode, setelan, atau fallback yang membuat user menebak.
3. **Jujur soal keadaan.** Halaman yang gagal memuat harus mengatakan begitu, bukan menampilkan layar kosong yang terbaca seperti data hilang.
4. **Hemat di layar.** Kepadatan adalah default, bukan ruang kosong. Admin dapat bekerja beberapa jam di halaman ini.
5. **Garis dan jarak, bukan kotak.** Elemen yang tidak butuh garis jangan diberi garis; hierarki dibangun dari indentasi, jarak, dan bobot teks.

## Accessibility & Inclusion

Pengguna tidak teknis, tanpa panduan lisan. Label harus menyebut aksi, bukan simbol saja. Warna tidak boleh menjadi satu-satunya pembawa makna — status punya bentuk dan label teks. Semua tombol harus punya target sentuh yang layak. Fokus keyboard harus terlihat jelas karena banyak user akan mengetik lebih dulu sebelum menyentuh mouse.