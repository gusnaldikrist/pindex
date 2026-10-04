# Tautan Yang Ditempel Apa Adanya, dan Tag Yang Tidak Terpecah

Status: ready-for-agent
Sumber: penilaian sistem pada 2026-10-03
Sumber kebenaran produk: `C:\vault\01-Projects\Penanda\prd.md`
Pendamping: `wireframe.md` di vault yang sama

> **Baca dulu.** Spec ini menutup dua jurang yang muncul setelah kategori item
> dihapus. Tidak ada fitur baru; yang diperbaiki adalah dua tempat di mana
> aplikasi menuntut lebih dari yang orang berikan, atau menerima lebih dari yang
> bisa diajarkan.

## Problem Statement

Item adalah dokumen, dan cara orang menunjuk dokumen adalah menempel tautannya.
Tapi kolom tautan menuntut dua hal yang tidak selalu ada. Label **wajib**, sehingga
menempel URL mentah harus diikuti mengarang nama; dan URL tidak pernah diperiksa
skemanya, sehingga `docs.google.com/x` tanpa `https://` tersimpan apa adanya lalu
dianggap path relatif oleh peramban. Hasilnya tautan mati tanpa pesan apa pun,
padahal janji produk ini adalah menemukan lalu membuka dokumen.

Yang kedua lebih halus. Sejak kategori dihapus, `tags` menjadi satu-satunya
mekanisme pengelompokan, dan tag itu menopang tiga hal sekaligus: pengelompokan,
pencarian lapis kedua, dan item terkait. Sementara tag diketik bebas tanpa
saran, tanpa normalisasi, dan tanpa peringatan. Satu ketikan `wisda` di sebelah
`wisuda` memecah satu grup menjadi dua, mematikan lapis pencarian kedua di antara
keduanya, dan membuat dua item yang sebenarnya kakak berdarah kehilangan
hubungan.

## Solution

**Satu tautan yang ditempel apa adanya tetap bisa dibuka.** Label menjadi opsional
dan diisi dari URL bila dikosongkan. URL yang berbentuk domain telanjang
mendapat awalan supaya tautannya benar-benar bisa dibuka. Keduanya berlaku pada tautan
disimpan maupun pada tautan lama yang sudah tersimpan rusak, tanpa perlu menyentuh
berkas data.

**Tag yang sudah ada ditawarkan saat mengetik.** Form item menampilkan daftar tag
yang sudah dipakai di data, sebagai saran natively peramban, sehingga ketikan
yang hampir sama/antip deduplikasi.

## User Stories

1. As a pustakawan, I want to paste a document URL and have it work, so that I don't have to remember to type the scheme.
2. As a pustakawan, I want a link to open the document, so that finding it actually leads to opening it.
3. As a pustakawan, I want copying a link to copy the working URL, so that pasting it into a message for a colleague works.
4. As a pustakawan, I want a link that is only a URL to be accepted, so that I don't have to invent a label for every link.
5. As a pustakawan, I want the label filled from the URL when I leave it empty, so that the list still has something readable.
6. As a pustakawan, I want a label I did write to be kept exactly, so that my own wording is not overwritten.
7. As a pustakawan, I want links saved before this fix to work too, so that I don't have to edit them one by one.
8. As a pustakawan, I want a Windows path in a link to stay a Windows path, so that it is still opened by the backend.
9. As a pustakawan, I want a UNC path to stay a UNC path, so that it is still opened by the backend.
10. As a pustakawan, I want a full URL with its scheme to be left alone, so that nothing is rewritten that already works.
11. As a pustakawan, I want to see the tags I already used while typing a new item, so that I reuse them instead of inventing near-duplicates.
12. As a pustakawan, I want a typo to be visibly a possible duplicate before I save, so that one group does not silently become two.
13. As a pustakawan, I want to still type a brand new tag, so that suggestions never become a limit.
14. As a pustakawan, I want suggestions to be in my own language, so that what I type is what gets stored.
15. As a maintainer, I want one place that decides whether a link is usable, so that the table, the panel, related items, and the copy button cannot disagree.
16. As a maintainer, I want the link shape rule to be defined once and read in both directions, so that what is accepted and what is stored cannot drift apart.
17. As a maintainer, I want tests proving a bare domain becomes a working link, so that this cannot silently break again.
18. As a maintainer, I want tests proving a local path is not rewritten into a web link, so that path handling does not regress.
19. As a maintainer, I want tests proving a URL-only link survives saving, so that the old silent drop cannot return.
20. As a maintainer, I want tests proving suggestions list every tag in use and no others, so that the helper stays honest.

## Implementation Decisions

- **Satu tempat memutuskan tautan bisa dipakai.** Ada satu fungsi yang menerima
  nilai mentah lalu mengembalikan bentuk siap pakai: menambah awalan bila
  diperlukan, dan memberi tahu apakah itu tautan lokal. Tabel, panel, item
  terkait, dan tombol salin semuanya membaca dari situ, bukan masing-masing
 issanpa aturan sendiri.

- **Awalan hanya untuk yang jelas telanjang.** Nilai yang sudah punya skema, atau
  yang berbentuk path lokal, tidak disentuh. Nilai yang tidak punya skema tetapi
  bukan path lokal dianggap domain telanjang. Menebak pada nilai yang tidak
  berbentuk domain sama sekali lebih berbahaya daripada membiarkannya.

- **Label diisi dari URL, bukan dihapus dari model.** Kolom label tetap ada dan
  tetap dipakai di panel. Yang berubah hanya kewajiban mengisinya: bila kosong,
  isinya diambil dari URL agar tetap terbaca. Label yang ditulis sendiri tidak
  pernah ditimpa.

- **Aturan bentuk tautan dibaca di dua arah.** Pemeriksaan saat menyimpan dan
  penyaringan saat menyimpan memakai aturan yang sama, supaya tidak mungkin satu
  menyatakan sah sementara yang lain membuang.

- **Perbaikan tautan lama tanpa mem migrating berkas.** Nilai mentah di dalam data
  tidak diubah. Yang berubah hanya nilai yang dipakai untuk tautan dan yang
  disalin. Berkas data pengguna tidak pernah ditulis ulang karena perubahan
  tampilan.

- **Daftar tag disusun dari data, bukan disimpan terpisah.** Tag yang dipakai di
  seluruh item dikumpulkan, dibuang duplikatnya, lalu dipakai sebagai saran
  native peramban. Tidak ada daftar tag yang bisa basi.

- **Saran tidak membatasi.** Daftar hanya/XMLSchema membantu; mengetik tag yang
  benar-benar baru tetap berhasil seperti sekarang.

## Testing Decisions

- **Pengujian di seam yang sama seperti sekarang:** fungsi pengurutan dan
  validasi murni dipanggil langsung dengan masukan buatan. Tidak perlu
  lingkungan DOM untuk aturan tautan maupun aturan tag.

- **Pengujian tautan wajib memuat keempat bentuk:** domain telanjang, URL ber-
  skema, path lokal drive, dan path UNC. Empatnya harus punya hasil berbeda, dan
  menukar dua di antaranya harus menggigit. Tanpa keempatnya, aturan bisa
  sederhana tapi salah.

- **Pengujian tautan lama.** Data berisi tautan telanjang harus menghasilkan
  tautan yang bisa dibuka pada tabel, panel, dan tombol salin. Kalau hanya
  menguji jalur simpan, perbaikan untuk data lama tak pernah terukur.

- **Pengujian label opsional.** Tautan tanpa label harus selamat menyimpan, dan
  label yang ditulis sendiri harus utuh.

- **Pengujian daftar tag.** Harus memuat setiap tag yang sedang terpakai dan
  tidak memuat tag lain, harus dibuang duplikatnya, dan harus berupa huruf kecil
  yang sama seperti yang disimpan.

- **Mutasi wajib:** menghapus penambahan awalan, membuat penambahan awalan
  berlaku juga pada path lokal, mengembalikan kewajiban label, dan membuat
  daftar tag memuat tag yang tidak terpakai. Keempatnya harus tertangkap.

## Out of Scope

- **Pengulangan tugas di TodoList.** Tidak ada di sini; ia punya medan sendiri,
  kendali sendiri, dan perhitungan status sendiri.
- **Pencarian tag yang lebih pintar.** Saran berhenti di menawarkan, tidak
  memperbaiki.
- **Menormalkan tag yang sudah tersimpan.** Tag yang sudah memecah grup tidak
  digabung otomatis. Menyentuh data pengguna bukan urusan perbaikan tampilan.
- **Menyimpan awalan ke dalam berkas data.** Nilai mentah tetap mentah.
- **Memindahkan tipe kolom tautan ke URL.** Peramban tetap memperlakukan kolom ini
  sebagai teks karena isinya bisa berupa path lokal.

## Further Notes

- Dua perbaikan ini lahir dari penilaian yang sama, dan keduanya berakar pada bentuk
  yang sama: aplikasi meminta hal yang tidak orang berikan, atau menerima hal yang
  tidak bisa dipercaya. Karena itu keduanya digabung dalam satu tiket, bukan dua.
  satu tiket, bukan dua.
