# 01: Field Catatan pada Entri Logbook

**What to build:** Entri Logbook boleh punya catatan panjang selain ringkasannya.
`teks` tetap jadi ringkasan satu baris seperti sekarang, `catatan` jadi isi
panjang beberapa paragraf. Menulis catatan, menyimpannya, membukanya lagi, dan
melihatnya di daftar harus berhasil.

Field-nya opsional, jadi entri lama yang tidak punya `catatan` tetap utuh dan
tidak perlu migrasi. Versi skema naik ke 3, dan versi 1 serta 2 tetap diterima.

Field ini punya peran yang berbeda dari `teks`, bukan nama lain untuk hal yang
sama. Kalau keduanya teks bebas tanpa pembeda, ada data yang terduplikasi.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Entri log boleh punya field `catatan` berupa teks, opsional, maksimal 2000 karakter.
- [x] Batas panjang dihitung dalam kode UTF-16, sama dengan cara `sop` dihitung, supaya frontend dan backend menghitung panjang yang sama.
- [x] Field `catatan` boleh tidak ada sama sekali; entri tanpa catatan tetap utuh.
- [x] Versi skema yang ditulis untuk berkas baru adalah 3, dan versi 1 serta 2 tetap diterima tanpa migrasi.
- [x] Label `Teks logbook` di form diubah menjadi `Ringkasan` supaya perannya jelas.
- [x] Form tambah dan ubah punya kolom Catatan dengan batas 2000 karakter.
- [x] Membuka form ubah memuat catatan yang sudah ada.
- [x] Mengosongkan kolom Catatan menghapus field-nya, bukan menyimpannya sebagai teks kosong.
- [x] Daftar Logbook menampilkan catatan yang terpotong, dan entri tanpa catatan tidak meninggalkan ruang kosong.
- [x] Backend menolak `catatan` yang bukan teks atau melebihi 2000 karakter.
- [x] Ekspor CSV tidak berubah pada tiket ini.
- [x] Tidak ada perubahan pada modul Indeks maupun TodoList.
- [x] Ekspor JSON penuh tetap menghasilkan berkas utuh termasuk `catatan`.
- [x] Ada mutasi yang membatalkan batas panjang `catatan` dan mutasi yang membuat backend menerimanya; keduanya tertangkap pengujian.
- [x] Pengujian memeriksa isi berkas, bukan hanya keberadaan kolom di form.
- [x] Semua pengujian JavaScript dan Go lulus.

## Jawaban

Field `catatan` ditambahkan sebagai field opsional pada entri logbook, maksimal
2000 karakter dihitung dalam kode UTF-16 supaya frontend dan backend menghitung
panjang yang sama. Versi skema naik ke 3, dan versi 1 serta 2 tetap diterima;
tidak ada migrasi yang dijalankan karena field-nya opsional.

`teks` tetap jadi ringkasan, dan labelnya diubah menjadi Ringkasan supaya
perannya jelas. Mengosongkan kolom Catatan menghapus field-nya, bukan
menyimpannya sebagai teks kosong, supaya entri yang tadinya tidak punya catatan
tidak bertambah property baru.

Backend memeriksa bentuk dan panjang `catatan`, dengan pola yang sama seperti
`sop`: opsional, ditolak hanya kalau bukan teks atau melebihi batas.

Tampilan memakai gaya pemotongan yang sudah ada, ditambah satu selektor
`.log-catatan` di aturan yang sama, bukan blok CSS baru. Pembungkus
`.log-item-teks` Needed supaya catatan turun ke bawah ringkasan dan bukan di
sampingnya; kolom tanggal tetap di luar karena lebarnya tetap 90px.

Tujuh pengujian baru. Yang paling berguna bukan memeriksa kolomnya ada, tapi
memakai isi berkasnya: catatan beserta baris baru di dalamnya harus utuh,
mengosongkan kolom harus menghapus field, entri tanpa catatan tidak boleh
meninggalkan kelas `log-catatan` di daftar, dan catatan berisi markup harus
tampil sebagai teks yang sudah di-escape. Ada juga pengujian yang memastikan
berkas versi 2 tanpa field catatan tetap terbaca dan dipakai apa adanya.

Dua mutasi wajib tertangkap. Backend yang selalu menerima `catatan`
menggigit pengujian validasi; kolom kosong yang disimpan sebagai teks kosong
menggigit pengujian penghapusan field.

Satu koreksi selama pengerjaan: pembungkus `.log-item-teks` awalnya membungkus
kolom tanggal juga, sehingga layout kolom tanggal yang lebarnya 90px ikut
berubah. Dipperbaiki supaya tanggal tetap di luar pembungkus.
