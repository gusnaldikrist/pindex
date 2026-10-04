# 01: Tautan Yang Ditempel Apa Adanya Tetap Bisa Dibuka

**What to build:** Menempel `docs.google.com/x` tanpa `https://` menghasilkan
tautan yang benar-benar terbuka, dan URL itu juga tersalin dalam bentuk yang
benar. Menempel tautan yang hanya punya URL tanpa label juga diterima, dan label
diisi dari URL itu. Keduanya berlaku pada tautan baru maupun tautan lama yang
sudah tersimpan rusak, tanpa perlu menyentuh berkas data.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] URL yang sudah punya skema dibiarkan apa adanya.
- [ ] URL yang berbentuk domain telanjang mendapat awalan yang membuatnya bisa dibuka, dan tautan itu terbuka dengan benar, bukan diperlakukan sebagai path relatif oleh peramban.
- [ ] URL yang disalin ke papan klip juga dalam bentuk yang bisa dibuka, sehingga menempelkannya ke pesan untuk rekan kerja berhasil.
- [ ] Path lokal drive maupun UNC tidak pernah mendapat awalan dan tetap dibuka lewat backend.
- [ ] Tautan yang hanya punya URL tanpa label diterima, labelnya diisi dari URL, dan tautan itu bertahan setelah menyimpan.
- [ ] Label yang ditulis sendiri tidak pernah ditimpa.
- [ ] Tautan lama yang sudah tersimpan tanpa skema ikut bisa dibuka dan disalin, tanpa berkas data ditulis ulang.
- [ ] Ada satu tempat yang memutuskan apakah sebuah nilai tautan bisa dipakai, dan tabel, panel, item terkait, serta tombol salin semuanya membacanya dari situ.
- [ ] Pengujian memuat keempat bentuk nilai: domain telanjang, URL berskema, path drive, dan path UNC, dan menukar dua di antaranya harus menggigit.
- [ ] Pengujian tautan lama memakai data yang sudah rusak dan memeriksa hasilnya pada tabel, panel, dan tombol salin, bukan hanya jalur simpan.
- [ ] Empat mutasi dijalankan dan keempatnya tertangkap: menghapus penambahan awalan, membuat penambahan awalan berlaku juga pada path lokal, mengembalikan kewajiban label, dan membuat penyaringan saat menyimpan membuang tautan tanpa label.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.