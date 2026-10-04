# 01: Pengatur Urutan Keluar dari Zona Kartu

**What to build:** Pengatur urutan "Terakhir Digunakan / A - Z" dipindahkan dari
dalam zona Kartu ke baris kendali Indeks, sebelah kotak cari. Akibatnya pengatur
urutan tidak lagi ikut hilang saat zona Kartu tidak dirender — yaitu saat data
tidak punya satu pun tag tersemat, yang keadaan itu berlaku di setiap instalasi
baru. Perilaku urutan tidak berubah sama sekali: dua nilai urutan yang sudah ada,
dan penggantian nilai tetap memicu render ulang hasil. Label aksesibilitas
kontrol ditulis ulang karena tidak lagi menyebut kartu.

Zona Kartu sendiri dan field `pinned_tags` belum disentuh di tiket ini; keduanya
masih ada seperti sekarang.

**Blocked by:** None (can start immediately).

**Status:** done (2026-10-03)

- [ ] Pengatur urutan ada di markup baris kendali Indeks, bukan di dalam zona Kartu.
- [ ] Pengatur urutan tetap ada dan tetap bisa dipakai saat data memiliki `pinned_tags` kosong. Inilah kondisi yang menyembunyikannya, jadi pengujian dengan data kosong adalah pengujian yang menentukan.
- [ ] Opsi "Urutan: Terakhir Digunakan" dan "A - Z" tetap keduanya ada, dan nilai bawaannya tetap "Terakhir Digunakan".
- [ ] Memilih "A - Z" mengubah urutan baris tabel hasil dan mengubah keadaan urutan; memilih kembali "Terakhir Digunakan" mengembalikan urutan semula persis.
- [ ] Memilih urutan tetap mempertahankan lapis pencarian: seluruh Lapis 1 tetap mendahului Lapis 2 dan Lapis 3 meski judulnya alfabetis lebih besar.
- [ ] Urutan yang dipilih bertahan setelah data baru disimpan.
- [ ] Label aksesibilitas kontrol tidak lagi menyebut kartu.
- [ ] Kontrol dijaga pada render ulang: perubahan data dan perpindahan tab tidak boleh menduplikasi kontrol atau menumpuk pendengar.
- [ ] Gaya pengatur urutan tetap dipakai ulang apa adanya, termasuk focus ring-nya.
- [ ] Dokumen vault disinkronkan sesuai urutan peta dokumen: keputusan, lalu bentuk layar, ditutup log sesi dan changelog.
- [ ] Semua pengujian JavaScript dan Go lulus, dan ada mutasi yang dijalankan untuk menguji apakah pengujian baru benar-benar menangkap cacat.
- [ ] Paket rilis disinkronkan dan hash-nya terverifikasi.