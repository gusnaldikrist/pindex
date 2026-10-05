# 03: Catatan Ikut Diekspor dan Kolom CSV Diperjelas

**What to build:** Berkas CSV Logbook memuat catatan, dan nama kolomnya tidak
lagi menyesatkan.

Kolom kedua sekarang bernama `catatan` padahal isinya ringkasan. Waktu itu
tidak masalah karena belum ada field lain. Begitu `catatan` jadi field yang
benar-benar berbeda, nama itu membuat orang mengira kolom tersebut memuat isi
panjang padahal isinya ringkasan satu baris.

Susunan kolom jadi: `tanggal`, `ringkasan`, `catatan`.

Kolom `tautan` yang sempat ada dibuang. Entri logbook tidak punya field `links`,
dan tidak ada bagian aplikasi yang bisa mengisinya, jadi kolom itu akan selalu
kosong dan membuat orang mengira datanya hilang. Keputusannya diambil user.

**Blocked by:** 02 (Pencarian Logbook Membaca Catatan).

**Status:** resolved

- [x] Kolom CSV Logbook berurutan: tanggal, ringkasan, catatan.
- [x] Kolom kedua bernama `ringkasan`, bukan lagi `catatan`.
- [x] Isi kolom kedua tetap ringkasan, tidak tertukar dengan catatan.
- [x] Catatan ikut diekspor; entri tanpa catatan mendapat kolom kosong, bukan hilang.
- [x] Entri tanpa catatan tetap punya ketiga kolom.
- [x] Aturan BOM, CRLF, penjaga formula, dan pengutipan tetap berlaku pada kolom baru.
- [x] Catatan yang mengandung koma, kutip, atau baris baru tidak merusak kolom.
- [x] Ekspor tetap mengikuti saringan yang aktif.
- [x] Ekspor JSON penuh tidak berubah sama sekali.
- [x] Ekspor tidak menambah request dan tidak mengubah data.json.
- [x] Ada mutasi yang membalik urutan kolom ringkasan dan catatan; mutasi itu tertangkap pengujian.
- [x] Pengujian memeriksa nama dan isi tiap kolom secara terpisah.
- [x] Semua pengujian JavaScript dan Go lulus.

## Jawaban

Susunan kolom jadi tanggal, ringkasan, catatan, tautan. Kolom kedua diubah
namanya dari `catatan` menjadi `ringkasan`; isinya tidak berubah, tetap `teks`.
Kolom `catatan` yang lama tidak hilang: tautan pindah ke posisi keempat.

Pengujian memakai parser CSV kecil yang ditulis di berkas test, bukan
mencocokkan potongan teks. Kalau cuma mencocokkan teks, teste tidak akan
membCatch kolom ringkasan dan catatan yang tertukar isinya. Parser itu menulis
LF dan CR lewat fromCharCode, bukan escape, supaya berkasnya sendiri tidak bisa
rusak karena ada yang mengubah akhir baris.

Lima pengujian baru: kepala kolom, isi tiap kolom terpisah, entri tanpa catatan
dan tautan tetap punya keempat kolom, catatan berkoma-berkutip-berbaris baru
tidak merusak kolom, dan penjaga formula berlaku pada kolom catatan.

Mutasi yang membalik isi kolom ringkasan dan catatan menggigit empat pengujian.

Kesalahan sendiri selama pengerjaan: parser CSV pertama sempat ditulis dengan
newline asli di dalam literal string, dan sempat ditulis `sedung` statt
`sedang`. Keduanya membuat berkas rusak, dan yang kedua baru ketahuan saat
pencocokan edit berikutnya gagal. Keduanya diperbaiki, dan yang kedua inletika
menjadi alasan parser ditulis ulang dengan fromCharCode.

## Koreksi setelah tiket selesai

Kolom `tautan` dihapus.

Kolom itu dibangun dengan asumsi bahwa entri logbook punya
field `links`, padahal tidak ada bagian aplikasi yang pernah menuliskannya.
Satu pengujian bahkan "lulus" karena isinya dibuat manual - sesuatu yang tidak
akan pernah bisa dilakukan pengguna. Test itu diganti menjadi penjaga: CSV
Logbook tidak boleh punya kolom tautan.

Kalau suatu saat Logbook memang perlu tautan, itu tiket tersendiri: kolomnya
harus dibuat lebih dulu, baru kolom CSV-nya jadi bermakna.