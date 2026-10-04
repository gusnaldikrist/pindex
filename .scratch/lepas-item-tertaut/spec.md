# Item Tertaut Dihapus dari TodoList dan Logbook

Status: ready-for-agent
Sumber: keputusan pengguna pada 2026-10-03
Sumber kebenaran produk: `C:\vault\01-Projects\Penanda\prd.md` bagian 5.5 dan 5.6
Pendamping: `prd-skema.md` untuk bentuk field

> **Baca dulu sebelum memakai spec ini.** Spec ini menghapus satu field dari
> dua jenis entri. Field itu tidak/backend; backend tidak pernah memvalidasinya,
> jadi tidak ada kontrak server yang ikut berubah.

## Problem Statement

Entri TodoList dan entri logbook boleh menunjuk satu item di Indeks lewat field
`item_id`. Field itu dipakai di empat hal: memilih item dari form entri,
menampilkan judul item itu di baris daftar, membiarkan pencarian mencocokkan
judul item tersebut, dan dilepas otomatis menjadi `null` ketika item dihapus.

Walau begitu, pemakaiannya jarang. Bentuk yang paling sering muncul di data
contoh adalah `item_id: null`, dan cara memakainya adalah memilih satu item dari
daftar panjang lewat menu tarik, bukan mengetik.

Empat tempat pakai satu field opsional ternyata lebih banyak perawatan yang
dihasilkan: kontrol di dua form, kolom di dua daftar, satu cabang pencarian, dan
satu aturan penghapusan yang menjelaskan sesuatu yang hampir tidak pernah terjadi.

Yang hilang karena field ini dibuang, dan ini harus disebut terbuka:

- **Konteks dokumen.** Entri seperti "cek form pengajuan" tidak lagi tahu form
  yang mana. Teksnya tetap, tapi tidak lagi terikat pada dokumen.
- **Pencarian lewat dokumen.** Mencari kata kunci yang ada di *judul item* tidak
  lagi menemukan entri TodoList atau logbook yang tertaut ke item itu. Pencarian
  entri membaca teks entri saja.
- **Penjelasan saat item dihapus.** Menghapus item tidak lagi melepas apa pun
  dari TodoList atau logbook, karena memang tidak ada yang terpasang.

Sisi yang tersisa: dua form jadi satu kolom lebih pendek, dua baris daftar
tidak lagi memuat nama dokumen yang tidak perlu dibaca, dan pencarian entri
berpindah dari dua sumber ke satu.

## Solution

Field `item_id` dihapus dari bentuk entri TodoList dan entri logbook, beserta
seluruh tempat yang membacanya. Pencarian entri membaca teks entri saja.
Penghapusan item di Indeks tidak lagi menyentuh TodoList maupun logbook.

Bentuk field pada `items` tidak berubah sama sekali. Tidak ada perubahan pada
backend, endpoint, maupun berkas data pengguna.

## User Stories

1. As a pustakawan, I want to write a todo without picking a document, so that writing a task does not cost an extra step.
2. As a pustakawan, I want the todo form to be shorter, so that there is less to fill in for a simple task.
3. As a pustakawan, I want the todo list row to show only the task and its status, so that I am not reading a document title I already know.
4. As a pustakawan, I want the logbook form to be shorter, so that recording what happened takes fewer steps.
5. As a pustakawan, I want the logbook row to show the date and what happened, so that the row is only what I need to read.
6. As a pustakawan, I want search to find a todo by its own text, so that searching still works the way I expect.
7. As a pustakawan, I want a todo whose text contains a document title to still be found by that title, so that I do not lose the ability I actually use.
8. As a pustakawan, I want deleting an item to leave my todos and logs untouched, so that I never wonder what happened to them.
9. As a pustakawan, I want my existing todos and logs to keep working, so that I do not have to re-enter them.
10. As a pustakawan, I want an item to keep its own links and notes, so that removing the link elsewhere does not change the item.
11. As a maintainer, I want one search function for rows instead of two matching sources, so that the rule lives in one place.
12. As a maintainer, I want no code path left that reads a field that no longer exists, so that there is no dead branch.
13. As a maintainer, I want the shape of a todo and a log entry to be checked by tests, so that the removed field cannot silently return.
14. As a maintainer, I want tests to prove search by entry text still works after the change, so that the surviving behaviour is not broken.
15. As a maintainer, I want the data example to stop carrying the removed field, so that it does not describe something the app ignores.
16. As a maintainer, I want the product and schema documents to state that the field is gone, so that no one designs against it again.

## Implementation Decisions

- **Satu field, dua bentuk.** `item_id` dihapus dari bentuk entri TodoList dan
  dari bentuk entri logbook. Keduanya berubah, dan keduanya berubah bersama,
  karena bentuk keduanya memang seragam.

- **Backend tidak tersentuh.** Backend tidak pernah memvalidasi `item_id`.
  Kontrak yang berubah hanya di sisi frontend dan di dokumen skema. Ini membuat
  perubahan ini tidak perlu migrasi di server maupun germbang validasi.

- **Pencarian_entri membaca teks saja.** Fungsi pencarian baris tidak lagi
  membangun peta item, dan tidak lagi mencocokkan judul item tertaut. Setelah
  perubahan, kedua pemanggilnya memakai aturan yang sama persis, sehingga
  pencarian TodoList dan pencarian logbook tidak lagi punya perbedaan selain
  cara mengurut.

- **Aturan penghapusan item ikut hilang.** Tidak lagi perlu melepas `item_id`
  pada entri TodoList dan logbook ketika sebuah item dihapus. Aturan itu dihapus,
  bukan dibiarkan mati.

- **Kontrol form dihapus, bukan disembunyikan.** Kolom pemilihan item dihilang
  dari form TodoList dan form logbook, dan kata "tanpa tautan" hilang dari baris
  daftar keduanya.

- **Nilai lama di berkas pengguna tidak ditulis ulang.** Entri yang masih
  memuat `item_id` tetap terbaca; field itu hanya diabaikan. Tidak ada migrasi,
  dan tidak ada penulisan ulang berkas data.

- **Bentuk `items` tidak berubah.** Item dan tautannya tidak tersentuh. Yang
  hilang hanya keterkaitan dari entri ke item, bukan keterkaitan item ke
  dokumennya.

## Testing Decisions

- **Pengujian bentuk entri, bukan hanya tampilan.** Ada pengujian yang memeriksa
  bentuk TodoList dan logbook yang dihasilkan, sehingga field yang dibuang tidak
  bisa kembali diam-diam hanya karena tampilannya masih recevoir.

- **Pengujian pencarian harus tetap membuktikan dua hal.** Teks entri masih ditemukan
  setelah perubahan; dan judul item yang hanya ada di Indeks tidak lagi
  menemukan entri. Yang kedua adalah bukti bahwa perubahan benar-benar terjadi,
  bukan sekadar tidak merusak.

- **Pengujian penghapusan item.** Menghapus item tidak boleh mengubah isi
  TodoList maupun logbook.

- **Pengujian data contoh.** Data contoh tidak lagi memuat field yang dibuang, dan
  pengujian yang membacanya ikut turun.

- **Pengujian yang khusus fitur ini dibuang, bukan dibiarkan gagal.** Berkas
  pengujian yang seluruh isinya menguji pencocokan lewat item tertauf tidak
  punya sisa yang masih berlaku setelah field ini tidak ada.

- **Mutasi wajib.** Setidaknya tiga: mengembalikan pencocokan judul item,
  mengembalikan pelepasan `item_id` saat item dihapus, dan mengembalikan kolom
  pemilihan item ke form. Ketiganya harus tertangkap.

## Out of Scope

- **Menambah cara lain untuk mengaitkan entri ke dokumen.** Niat ini tidak
  menggantikan apa pun; ia hanya membuang satu cara yang jarang dipakai.
- **Menyaring entri berdasarkan item.** Tidak ada replacement.
- **Perubahan pada pencarian Indeks.** Pencarian utama tetap hanya membaca
  `items`.
- **Menyatukan TodoList dan logbook.** Keduanya tetap dua modul terpisah.

## Further Notes

- Tiga dari empat pemakaian field itu bisaSX hilang tanpa meninggalkan jejak
  yang Programme bisa dilihat pengguna. Yang paling mungkin tidak terasa adalah
  pencarian lewat judul item, karena itu satu-satunya dari empat yangBbisa
  dirinya yang tidak terlihat.
- Setelah perubahan ini, `itemsMap` tidak lagi dibangun untuk pencarian entri.
  Kalau Masthead There's masih ada yang membangunnya di tempat lain, itu perlu
  diperiksa lagi karena kemungkinan besar sudah tidak perlu.
