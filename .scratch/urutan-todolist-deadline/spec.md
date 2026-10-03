# Urutan TodoList Memakai Deadline

Status: ready-for-agent
Sumber: temuan dari penilaian tab TodoList pada 2026-10-03
Sumber kebenaran produk: `C:\vault\01-Projects\Penanda\prd.md` bagian 5.5
Pendamping: `wireframe.md` di vault yang sama, untuk bentuk layar

> **Baca dulu sebelum memakai spec ini.** Spec ini membalik satu keputusan yang
> sudah/write test danenga ada alasannya, bukan memperbaiki bug yang terlewat.
> Urutan berdasarkan kapan terakhir disentuh hasil dari tiket 07 dan sengaja
> dikunci pengujiannya.

## Problem Statement

Daftar TodoList punya `deadline` yang bisa diisi, dan punya label otomatis
`lewat`, `mepet`, `selesai` yang dihitung dari hari kalender. Tapi urutan
tampilannya sama sekali tidak memakai `deadline`.

Urutannya adalah: yang belum selesai di atas yang selesai, lalu di dalam
masing-masing kelompok, yang terakhir diubah paling dulu di atas.

Akibatnya tugas yang jatuh tempo hari ini tetapi belum pernah disentuh akan
tenggelam di bawah tugas yang jatuh tempo bulan depan tetapi baru saja diubah.
Orang membuka daftar itu untuk tahu apa yang mendesak, lalu yang_itunjukkan
tergolong di bawah tugas yang jatuh tempo bulan depan tetapi baru saja diubah. Orang

Yang memperburuk: label `lewat` dan `mepet` sudah ada di layar, jadi Urgensi
sudah dikomunikasikan per baris lewat labelnya, tapi urutan di layar naik-turun
berlawanan dengan Urgensi itu. Mata membaca label `lewat` di baris yang
tercementak di bawah, lalu harus menggulir untuk menemukan yang mendesak.

Dua bukti bahwa ini keputusan lama dan bukan kelalaian: pengujian
`Tiket 07 - Pengurutan: belum selesai di atas, urut updated_at menurun`
mengunci perilaku itu secara sadar, dan tidak ada satu pun pengujian TodoList
yang memeriksa `deadline`.

## Solution

Urutan memakai `deadline` sebagai pengurut utama. Tanggal yang lebih awal
datang lebih dulu, sehingga tugas yang sudah lewat otomatis berada di paling
atas tanpa perlu aturan khusus untuknya.

Empat lapis, berurutan dari yang paling menentukan:

1. **Belum selesai di atas yang selesai.** Berubah tidak.
2. **Di antara yang belum selesai: yang punya `deadline` lebih dulu**, menaik.
   Tanggal yang sudah lewat adalah tanggal paling awal, jadi otomatis naik.
3. **Yang tanpa `deadline` setelah semua yang punya deadline.** Tugas tanpa
   tenggat memang tidak mendesak, dan menahannya di bawah yang punya tenggat
   membuat daftar ini bisa dipindai dari atas.
4. **Di antara yang selesai: `updated_at` menurun.** Berubah tidak, karena
   di kelompok ini yang baru diselesaikan memang yang paling ingin dilihat.

Pengikatání: deadline sama dipilih `updated_at` menurun, sama seperti sekarang.

## User Stories

1. As a pustakawan, I want tugas yang jatuh tempo paling awal berada paling atas, so that I see the most pressing task first without scrolling.
2. As a pustakawan, I want tugas yang sudah lewat otomatis berada di paling atas, so that I do not miss overdue work hidden behind recently touched tasks.
3. As a pustakawan, I want tugas tanpa deadline berada di bawah tugas yang punya deadline, so that the top of the list is always actionable.
4. As a pustakawan, I want tugas selesai tetap berada di paling bawah, so that finished work does not compete with pending work for attention.
5. As a pustakawan, I want tugas selesai tetap terurut dari yang baru diselesaikan, so that the most recently finished task is easy to find.
6. As a pustakawan, I want the order to stay stable when two tasks share the same deadline, so that the list does not jump around between renders.
7. As a pustakawan, I want a task with an empty or malformed deadline to be treated as having no deadline, so that a typo in my data does not break the list.
8. As a pustakawan, I want the order to still be correct when I filter to unfinished only, so that filtering does not change my reading of urgency.
9. As a pustakawan, I want the order to still be correct when I search, so that searching does not scramble the list.
10. As a pustakawan, I want the order to match the labels I see on screen, so that the sequence of dates and the sequence of rows agree.
11. As a pustakawan, I want a task due today to appear above one due next month, so that today's task is not buried.
12. As a pustakawan, I want a task with no deadline to still be reachable, so that moving it does not make it disappear.
13. As a pustakawan, I want this list to work on the very first day with one task, so that an empty or single-item list is not broken.
14. As a maintainer, I want the ordering rule stated in one place, so that a future change does not have to guess the priority order.
15. As a maintainer, I want a test that fails if deadline stops affecting the order, so that the reversal cannot silently undo itself.
16. As a maintainer, I want the test that pinned the old order to be rewritten rather than deleted, so that the change is visible in history.
17. As a maintainer, I want the product document to state the rule, so that the document and the behaviour agree.
18. As a maintainer, I want mutation testing over the new assertions, so that the tests are proven to actually catch a regression.

## Implementation Decisions

- **Perbandingan tunggal, empat lapis berurutan.** Semua aturan dituangkan
  dalam satu fungsi perbandingan yang sudah ada, bukan tersebar di beberapa
  tempat. Perbandingan harus mengembalikan nilai, bukan menyusun ulang array.

- **Tanggal dibandingkan sebagai tanggal, bukan sebagai teks.** `YYYY-MM-DD`
  dibandingkan secara leksikografis sama dengan urut tanggalnya, jadi tidak
  perlu parsing. Tapi nilai kosong, bukan tanggal, atau berbentuk salah harus
  dianggap tidak punya deadline, sama seperti yang dipakai perhitungan label
  `lewat` dan `mepet`. Satu definisi "punya deadline yang sah dipakai" dipakai
  oleh pengurutan dan penghitungan label supaya keduanya tidak bisa berbeda
  pendapat tentang satu baris.

- **Tanggal yang sudah lewat tidak butuh aturan tersendiri.** Mengurutkan
  menaik sudah placing-nya di atas, karena tanggal yang lewat adalah tanggal
  paling awal. Ini dipilih daripada memberi label prioritas tersendiri karena
  menambah satu aturan yang harus dijaga tanpa menambah kemampuan apa pun.

- **Tugas tanpa deadline di akhir, bukan di awal.** Dipilih supaya bagian atas
  daftar selalu berisi yang bisa ditindak. Menaruhnya di awal akan mengisi
  posisi paling berharga dengan tugas yang tidak punya urgensi.

- **Pengurutan selesai tidak diubah.** Yang baru selesai adalah yang paling ingin
  dilihat di kelompok itu, dan urutan ini sudah dipakai sejak tiket 07.

- **Tidak ada perubahan pada field, validasi, atau bentuk modal.** `deadline`
  tetap opsional, formatnya tetap sama, dan tidak ada kontrol baru.

- **Tidak ada perubahan pada label.** `lewat`, `mepet`, dan `selesai` tetap
  dihitung persis seperti sekarang.

## Testing Decisions

- **Pengujian di seam yang sama seperti sekarang:** fungsi pengurutan murni, dipanggil
  dipanggil langsung dengan daftar buatan. Itu tempat pengujian urutan yang
  sudah ada bekerja, dan tidak perlu lingkungan DOM.

- **Pengujian lama ditulis ulang, bukan dihapus.** Pengujian yang mengunci
  urutan `updated_at` masih bernilai sebagai penjaga aturan yang tidak berubah:
  selesai di bawah dan selesai terurut `updated_at` menurun. Yang dipindahkan
  ke pengujian baru hanyalah aturan deadline.

- **Pengujian baru memeriksa urutan, bukan hanya isi.** Kegagalan yang paling
  mungkin terjadi dari perubahan ini adalah urutan yang salah, dan itu mustahil
  terlihat kalau pengujian hanya memeriksa berapa banyak baris yang muncul.

- **Pengujian harus dibangun dari kasus yang benar-benar berbeda.** Kalau semua
  tugas punya tenggat yang berbeda, pengujian masih bisa lulus walau deadline diabaikan.
  diabaikan. Minimal satu pengujian memakai tugas tanpa deadline bercampur
  dengan tugas bertenggat, karena di situlah perbedaannya terlihat.

- **Ketidakstabilan diuji.** Dua tugas dengan deadline sama harus punya urutan
  yang ditentukan `updated_at`, supaya daftar tidak melompat-lompat.

- **Deadline rusak diuji.** Nilai kosong, bukan tanggal, dan tidak berbentuk
  `YYYY-MM-DD` harus diperlakukan sebagai tidak punya deadline, bukan
  membuat daftar gagal.

- **Saringan dan pencarian ikut diuji.** Urutan harus tetap benar saat
  disaring ke belum selesai dan saat mencari kata kunci, karena keduanya
  melewati fungsi pengurutan yang sama.

- **Mutation testing.** Setidaknya tiga mutasi: kembalikan skor ke jumlah
  tag sama, balik arah pengurutan tanggal, dan hilangkan perlakuan deadline
  kosong. Ketiganya harus tertangkap.

## Out of Scope

- **Tampilan "hari ini".** Saringan tambahan untuk melihat yang jatuh tempo
  hari ini dan yang lewat sekaligus. Itu menambah kontrol baru dan terpisah
  dari urutan.
- **Status "lewat" yang bisa dibuang.** Sekarang sekali lewat, selalu lewat.
- **Menghapus petunjuk format `YYYY-MM-DD`.** Kolomnya sudah berupa pemilih
  tanggal sehingga petunjuk itu tidak dibutuhkan, tapi tidak ada hubungannya
  dengan urutan.
- **Memberi tahu saat tautan item copot.** Menghapus item di Indeks melepas
  tautan TodoList tanpa memberitahukan. Data tidak hilang, tapi tidak ada
  kabar.
- **Menambah prioritas, subtugas, atau tugas berulang.**
- **Notifikasi.** Luar lingkup sejak awal, dan urutan yang benar membuat
  kebutuhan akan jauh berkurang.

## Further Notes

- Pengurutan ini membalik keputusan tiket 07 yang pernah dikunci pengujian.
  Itu disengaja: urutan lama benar untuk daftar yang tidak punya tenggat, dan
  salah untuk daftar yang punya. Ketika `deadline` masih opsional dan jarang
  diisi, tidak ada yang rugi. Sekarang `deadline` adalah bagian dari screenshoot
  utama tiap baris lewat labelnya, dan urutan perlu mengikutinya.

- Setelah urutan ini benar,:textContent `lewat` dan `mepet` berhenti menjadi
  informasi yang berdiri sendiri dan menyatu dengan urutan. Ini mengurangi
  informasi yang harus dibaca mata untuk tahu mana yang mendesak. Kalau suatu
  saat label itu terbukti berlebihan, itu pokret yang lebih murah untuk
  dihapus daripada urutan yang salah.

- Ukuran berhasil untuk fitur ini adalah: berapa waktu dari membuka daftar
  sampai mengerjakan tugas yang paling mendesak. Itu belum pernah diukur.
