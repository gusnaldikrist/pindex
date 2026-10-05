# 03: Ekspor Mengikuti Saringan yang Sedang Aktif

**What to build:** Yang keluar dari ekspor CSV adalah entri yang sedang terlihat
di layar. Kalau saringan rentang tanggal terisi, hanya entri dalam rentang itu
yang diekspor; kalau saringan kosong, seluruh entri ikut.

Aturannya satu kalimat dan berlaku seragam: **yang diekspor adalah yang
tampak.** Kalau tidak begitu, orang mengira berkas yang diunduh adalah catatan
lengkap padahal yang terunduh cuma sebagian.

**Blocked by:** 02 (Ekspor Logbook ke CSV yang Langsung Terbuka di Excel).

**Status:** resolved

- [x] Saringan rentang tanggal terisi, hanya entri dalam rentang itu yang masuk berkas.
- [x] Kedua kotak rentang kosong, seluruh entri masuk berkas.
- [x] Isi berkas sama persis dengan isi daftar yang tampil, urutan termasuk.
- [x] Saringan yang sudah terisi tetap berlaku ketika pengguna pindah tab lalu kembali, dan ekspor mengikuti saringan yang masih terisi itu.
- [x] Menghapus kedua isian saringan mengembalikan ekspor ke seluruh entri.
- [x] Kotak cari logbook juga ikut mempersempit ekspor, selama isiannya masih ada di layar.
- [x] Mengubah saringan atau kotak cari tidak mengubah `data.json` dan tidak menambah field apa pun.
- [x] Tidak ada request ke luar yang ditambahkan.
- [x] Ada mutasi yang membuat ekspor mengabaikan saringan; mutasi itu tertangkap pengujian.
- [x] Pengujiannya memeriksa isi berkas secara langsung untuk kasus rentang terisi, rentang kosong, dan pencarian aktif.
- [x] Semua pengujian JavaScript dan Go lulus.

## Jawaban

Ekspor sekarang memanggil filterLogs dengan argumen yang sama persis seperti
saat merender daftar. Karena keduanya memakai satu fungsi dan satu set keadaan
yang sama, isi berkas tidak mungkin berbeda dari yang terlihat di layar,
termasuk urutannya.

Perubahannya satu baris. Tidak ada logika penyaringan baru, jadi tidak ada
tempat baru yang bisa melenceng dari daftar.

Tujuh pengujian baru, semuanya membaca isi berkas: rentang terisi, rentang
kosong, kotak cari, saringan yang bertahan setelah pindah tab, penghapusan
saringan, dan dua pengujian yang memastikan data.json tidak berubah dan tidak
ada request yang bertambah. Pengujian "sama persis dengan yang tampil"
membandingkan isi berkas dengan HTML daftar yang benar-benar dirender, bukan
sekadar menghitung entri, supaya urutannya ikut terkunci.

Mutasi yang membuat ekspor mengabaikan saringan menggigit lima pengujian.

Satu koreksi selama pengerjaan: ekspektasi pengujian saringan setelah pindah
tab awalnya salah. Hanya batas bawah yang terisi, jadi entri 2026-09-25 memang
harus keluar. Kode sudah benar; pengujiannya yang dikoreksi.
