# 02: Ekspor Logbook ke CSV yang Langsung Terbuka di Excel

**What to build:** Dari tab Logbook, satu tombol mengunduh seluruh entri log
sebagai berkas CSV. Berkas itu langsung terbuka di Microsoft Excel tanpa langkah
encoding manual, dan teks yang diawali penghitung tidak dievaluasi sebagai
formula ketika Excel membukanya.

Dua hal yang membuat ini tidak bisa "cukup CSV" saja, keduanya sudah
diverifikasi ke sumber primer:

- Tanpa penanda BOM di depan berkas, Excel menebak encoding dan merusak teks
  non-ASCII. Sumber: "Opening CSV UTF-8 files correctly in Excel", Microsoft
  Support. Tanpa BOM, pengguna harus melakukan langkah Data → From Text →
  pilih `65001: Unicode (UTF-8)` setiap kali membuka berkas.
- Aplikasi spreadsheet dapat menafsirkan nilai sel sebagai formula. Sumber:
  "CSV Injection", OWASP. Karena Logbook adalah teks bebas yang diketik orang,
  nilai seperti `=SUM(...)` bisa dievaluasi saat berkas dibuka.

Ekspor JSON penuh yang sudah ada tidak berubah dan tetap tersedia sebagai
cadangan. Ekspor ini tidak menggantikannya, karena berkas JSON menyimpan seluruh
data sementara Logbook hanya menyimpan log.

Rujukan riset: `docs/export-logbook-research.md`.

**Blocked by:** 01 (Bantu Unduh Berkas).

**Status:** ready-for-human

- [x] Ada tombol ekspor di baris kendali Logbook, di sebelah tombol Catat.
- [x] Berkas CSV diawali penanda BOM sehingga Excel membacanya sebagai UTF-8 tanpa langkah manual.
- [x] Pemisah baris memakai CRLF, bukan hanya LF.
- [x] Nilai sel yang mengandung koma, tanda kutip, atau baris baru tetap utuh setelah dibuka di Excel.
- [x] Sel yang diawali `=`, `+`, `-`, atau `@` tidak dievaluasi sebagai formula, dan isinya tetap terbaca apa adanya setelah pengguna menyimpan ulang berkasnya.
- [x] Tanggal setiap entri diekspor sebagai kolom tersendiri.
- [x] Teks setiap entri diekspor apa adanya, termasuk teks panjang dan teks berbaris banyak.
- [x] Tautan pada entri ikut diekspor, dipisahkan tanda dalam satu kolom; entri tanpa tautan mendapat kolom kosong, bukan hilang.
- [x] Nama berkas memuat penanda waktu hari ini.
- [x] Mengekspor tidak mengubah `data.json` dan tidak menambah field apa pun ke berkas data.
- [x] Ekspor JSON penuh tetap ada, tetap menghasilkan berkas yang sama seperti sebelumnya, dan tetap disebutkan di tempat yang sama.
- [x] Ekspor tidak membuat request ke luar.
- [x] Ada mutasi yang menghapus penanda BOM dan mutasi yang menghapus penjaga formula; keduanya tertangkap pengujian.
- [x] Pengujiannya memverifikasi isi berkas secara langsung, bukan hanya memeriksa bahwa tombol ada.
- [x] Semua pengujian JavaScript dan Go lulus.
- [ ] Terbuka di Microsoft Excel sungguhan, teks Indonesia utuh dan tidak ada sel yang berubah jadi formula.

## Jawaban

Tombol Ekspor CSV ada di baris kendali Logbook, di sebelah tombol Catat.
Berkas diawali BOM UTF-8, pemisah baris CRLF, dan setiap sel melewati satu
fungsi yang memasang penjaga formula lebih dulu lalu mengapit nilainya bila ada
koma, kutip, atau baris baru. Urutan itu penting: kutip tunggal yang
ditambahkan penjaga formula ikut tersimpan sebagai teks.

Tautan satu entri masuk satu sel, dipisah spasi, supaya jumlah kolom tidak
bergantung pada jumlah tautan. Entri tanpa tautan mendapat kolom kosong, bukan
baris hilang.

Pengujian memeriksa isi berkas secara langsung, bukan hanya keberadaan tombol:
BOM, CRLF, penjaga formula untuk keempat awal, pengutipan, kolom tautan, nama
berkas, dan data.json yang tidak berubah. Pengujian juga memeriksa tombolnya
berada di markup, bukan dibuat lewat JavaScript.

Dua mutasi wajib tertangkap. Menghapus BOM menggigit dua pengujian; mematikan
penjaga formula menggigit pengujian penjaga formula.

Yang belum terpenuhi: berkasnya belum dibuka di Microsoft Excel sungguhan. Itu
butuh manusia dan memang tidak bisa dibuktikan pengujian.

## Koreksi 2026-10-05

Kriteria tentang tautan dibatalkan. Entri logbook tidak pernah punya field
`links` dan tidak ada bagian aplikasi yang mengisinya, jadi kolom tautan di CSV
hanya akan selalu kosong. User memutuskan Logbook tidak perlu tautan. Helper
`tautanLogKeTeks` dihapus sekaligus.