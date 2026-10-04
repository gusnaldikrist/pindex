# 02: Zona Kartu dan State Penyaring Tag Dibuang

**What to build:** Baris Kartu tag dihapus dari layar Indeks, dan penyaring tag
sekali klik ikut hilang bersamanya. Keempat jalur yang memakai keadaan penyaring
tag ikut dibuang, sehingga tidak ada kode yatim yang tersisa. Yang menggantikannya
sudah ada dan tidak diubah: mengetik tag di kotak cari menyaring hasil ke tag itu.

Zona Harian, panel inspeksi, tabel hasil, pengatur urutan, dan pencarian tiga
lapis tidak tersentuh. Field `pinned_tags` di berkas data masih ada di tiket ini
dan baru dibuang pada tiket 03, supaya kedua langkah bisa diuji terpisah.

**Blocked by:** 01 (Pengatur Urutan Keluar dari Zona Kartu).

**Status:** done (2026-10-03)

- [ ] Zona Kartu tidak ada lagi di markup Indeks, dan penanda `KARTU` tidak muncul di mana pun pada layar itu.
- [ ] Keadaan penyaring tag tidak lagi ada di state aplikasi.
- [ ] Penyaringan hasil setelah pencarian tidak lagi punya cabang tag.
- [ ] Jumlah hasil pada panel dan penanda "ada kueri" dihitung hanya dari isi kotak cari.
- [ ] Klik pada area kendali Indeks tidak lagi bragging-kan penghapusan fokus item terpilih; daftar elemen yang bukan "klik di luar" tidak lagi menyebut zona Kartu.
- [ ] Impor data baru tidak lagi perlu melepas saringan tag basi, dan fokus baris tetap dilepas seperti sebelumnya.
- [ ] Fungsi pemformat label tag ikut dibuang karena tidak lagi punya pemanggil.
- [ ] Gaya yang hanya dipakai baris Kartu dibuang: rules zona, gulir tag, tombol kartu beserta keadaan aktifnya, judul tag, jumlah tag, serta wadah kendali tampilan. Gaya pengatur urutan tetap dipakai.
- [ ] Komentar yang menyebut pengatur mode tampilan yang sudah dihapus di spec sebelumnya ikut hilang bersama rules-nya.
- [ ] Mengetik nama tag di kotak cari tetap menyaring hasil ke tag itu, dan pengujian itu dikunci karena ini sekarang satu-satunya jalan menyaring per tag.
- [ ] Pengujian yang menguji perilaku kartu dihapus, bukan dibiarkan gagal; pengujian yang memeriksa letak kontrol ditulis ulang ke bentuk yang masih punya target.
- [ ] Ada mutasi yang dijalankan untuk menguji apakah pengujian baru benar-benar menangkap cacat.
- [ ] Dokumen vault disinkronkan sesuai urutan peta dokumen, ditutup log sesi dan changelog.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.