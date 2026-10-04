# 02: Tag yang Sudah Dipakai Ditawarkan Saat Mengetik

**What to build:** Saat mengisi tag di form item, daftar tag yang sudah dipakai di
data muncul sebagai saran, sehingga mengetik `wisda` di sebelah `wisuda` terlihat
sebagai mungkin duplikat sebelum disimpan — bukan memecah satu grup menjadi dua
secara diam-diam.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Form item menampilkan seluruh tag yang sedang terpakai di data sebagai saran yang bisa dipilih.
- [ ] Daftar saran dibuang duplikatnya dan ditulis dalam huruf kecil yang sama seperti yang disimpan, sehingga yang diketik apa adanya tersimpan.
- [ ] Tag yang benar-benar baru tetap bisa diketik dan disimpan seperti sekarang; saran tidak pernah menjadi pembatas.
- [ ] Saran memuat setiap tag yang sedang terpakai dan tidak memuat tag lain.
- [ ] Ada satu helper pengumpul tag yang dipakai bersama oleh saran dan bagian lain yang butuh tahu seluruh tag yang terpakai, dan tidak ada daftar tag terpisah yang bisa basi.
- [ ] Dua mutasi dijalankan dan keduanya tertangkap: membuat daftar saran memuat tag yang tidak terpakai, dan tidak membuang duplikat.
- [ ] Pengujian menguji aturan tag lewat fungsi murni yang dipanggil langsung, bukan lewat lingkungan DOM.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.