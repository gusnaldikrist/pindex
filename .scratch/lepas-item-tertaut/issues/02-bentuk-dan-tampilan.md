# 02: Bentuk Entri dan Tampilan Kehilangan Kolom Item Tertaut

**What to build:** Form TodoList dan form Logbook tidak lagi memilih item dari
Indeks, dan baris daftar keduanya tidak lagi menampilkan nama dokumen. Data
contoh berhenti membawa field yang dibuang.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Form TodoList tidak lagi memuat kolom pemilihan item tertaut.
- [ ] Form Logbook tidak lagi memuat kolom pemilihan item tertaut.
- [ ] Baris TodoList tidak lagi menampilkan judul item tertaut maupun kalimat "tanpa tautan".
- [ ] Baris Logbook tidak lagi menampilkan judul item tertaut maupun kalimat "tanpa tautan".
- [ ] Simpan entri tanpa memilih item tetap berhasil, dan hasil simpan tidak memuat field item tertaut.
- [ ] Data contoh berhenti memuat field item tertaut pada entri TodoList maupun entri logbook.
- [ ] Pengujian yang membaca data contoh ikut turun dan pengujian bentuk entri memeriksa field yang dibuang benar-benar tidak ada.
- [ ] Ada mutasi yang mengembalikan kolom pemilihan item ke form dan mutasi yang mengembalikan field ke hasil simpan; keduanya tertangkap.
- [ ] Pengujian pencarian dan penghapusan item dari tiket lain tetap lulus tanpa perubahan arti.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.