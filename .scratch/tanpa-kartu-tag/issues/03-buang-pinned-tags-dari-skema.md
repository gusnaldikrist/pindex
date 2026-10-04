# 03: Field `pinned_tags` Dibuang dari Skema Data

**What to build:** Field `pinned_tags` dibuang dari skema data Penanda, karena
tidak ada lagi bagian aplikasi yang membacanya maupun menulisnya. Frontend,
validasi backend, jawaban backend untuk instalasi baru, dan data contoh berhenti
menyebutnya.

Berkas data dan hasil export versi lama tetap bisa dibaca dan diimpor. Field itu
tidak dinaikkan versinya, tidak ada langkah migrasi, dan field yang tidak dikenal
tidak ditolak di kedua sisi, sehingga field tersebut hilang dari disk sendiri
pada simpan berikutnya.

**Blocked by:** None (dapat berjalan paralel dengan tiket 01 dan 02).

**Status:** done (2026-10-03)

- [ ] Keadaan awal frontend dan normalisasi data berhenti menyebut field itu.
- [ ] Validasi import frontend tidak lagi mewajibkan field itu, dan berkas tanpa field itu tetap diterima.
- [ ] Validasi backend berhenti mewajibkan field itu, dan berkas tanpa field itu tetap diterima.
- [ ] Jawaban backend untuk instalasi baru memuat tepat field yang masih dipakai.
- [ ] Data contoh berhenti mendeskripsikan field itu.
- [ ] Hasil export memuat tepat kunci skema: `version`, `items`, `todo`, `logs`.
- [ ] Berkas versi lama yang masih memuat field itu tetap bisa diimpor, dan field itu dibuang dari data yang tersimpan tanpa galat.
- [ ] Field tingkat atas yang wajib masih ditolak bila hilang atau salah bentuk, satu per satu.
- [ ] Pengujian tidak lagi memaksa fixture menyediakan field yang sudah dibuang.
- [ ] Ada mutasi yang dijalankan untuk menguji apakah pengujian baru benar-benar menangkap cacat.
- [ ] Dokumen vault disinkronkan sesuai urutan peta dokumen, ditutup log sesi dan changelog.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.