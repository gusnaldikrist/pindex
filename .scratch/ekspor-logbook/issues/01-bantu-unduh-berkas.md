# 01: Bantu Unduh Berkas

**What to build:** Semua tempat yang mengunduh berkas memakai satu jalur yang
sama: membangun isi, membuat objek unduhan, memicunya, lalu melepaskannya.
Selama ini tiap ekspor menyalin ulang mekanisme itu, dan salinan itu sudah
kehilangan sesuatu yang penting: alasan kenapa pelepasan objek unduhan harus
ditunda satu gilir render.

Terlihat dari user sebagai tidak ada apa pun yang berubah. Yang hilang adalah
risiko diam-diam yang akan muncul begitu ada ekspor ketiga.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Hanya ada satu tempat yang membangun isi berkas, membuat objek unduhan, dan memicunya.
- [x] Pelepasan objek unduhan tetap ditunda satu gilir render, dan alasannya tertulis di tempat itu.
- [x] Ekspor JSON penuh menghasilkan nama berkas dan isi yang sama persis seperti sebelumnya.
- [x] Tombol Contoh tetap mengunduh berkas contoh seperti sebelumnya.
- [x] Pengujian yang menguji kedua ekspor itu tetap lulus tanpa perubahan arti.
- [x] Tidak ada request ke luar yang ditambahkan.

## Jawaban

Jalur unduhan berbasis isi dipindah ke satu helper. Ekspor JSON sekarang
memanggilnya; ekspor CSV pada tiket berikutnya akan memakainya juga.

Berkas contoh sengaja tidak ikut memakai helper: berkas itu sudah punya
alamat sendiri dari server, dan membacanya lewat Blob akan menambah request
yang tidak perlu. Ada pengujian yang menjaga keputusan itu.

Tiga pengujian baru. Dua menjaga helper tidak dilanggar: hanya boleh ada satu
pembuatan dan satu pelepasan objek unduhan di seluruh berkas, dan alasan
penundaan pelepasan harus tetap tertulis dekat dengan pemanggilnya. Yang
ketiga menjaga berkas contoh tetap memakai alamat langsung.

Mutasi yang menyalin jalur unduhan lagi membuat pengujian pertama gagal.
