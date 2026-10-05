# 02: Pencarian Logbook Membaca Catatan

**What to build:** Kotak cari Logbook membaca ringkasan **dan** catatan.
Mencari kata yang hanya ada di catatan harus menemukan entri itu.

Field catatan yang baru dibuat adalah isi sebenarnya dari sebuah entri
logbook, sedangkan ringkasan cuma satu baris. Kalau pencarian hanya membaca
ringkasan, orang akan mengetik kata yang dia ingat menulis di catatan dan tidak
mendemukannya.

Aturannya satu kalimat: yang dicari oleh kotak cari logbook adalah ringkasan
dan catatannya. Bukan tautan, bukan tanggal — sama seperti sebelumnya.

**Blocked by:** 01 (Field Catatan pada Entri Logbook).

**Status:** resolved

- [x] Mencari kata yang hanya ada di catatan menemukan entri logbook itu.
- [x] Mencari kata yang ada di ringkasan tetap menemukan entri, seperti sebelumnya.
- [x] Mencari kata yang ada di keduanya tetap menemukan entri itu sekali, bukan dua kali.
- [x] Pencarian tidak bisa mencocokkan kata yang berasal sebagian dari satu field dan sisanya dari field lain.
- [x] Pencarian TodoList tidak ikut membaca field `catatan`, karena entri todo tidak punya field itu.
- [x] Pencarian Indeks tidak berubah sama sekali.
- [x] Entri log tanpa catatan tidak membuat pencarian gagal.
- [x] Ekspor CSV tidak berubah pada tiket ini.
- [x] Ada mutasi yang membuat pencarian berhenti membaca catatan; mutasi itu tertangkap pengujian.
- [x] Pengujian memeriksa hasil filter, bukan hanya ada tidaknya parameternya.
- [x] Semua pengujian JavaScript dan Go lulus.

## Jawaban

filterLinkedRows kini menerima `fields` lewat spec, dengan default satu field.
Logbook meneruskan `['teks', 'catatan']`; TodoList dan pemanggil lain tidak
disentuh, jadi TodoList tidak diam-diam ikut mendukung field yang tidak ia
miliki.

Pencocokan dijalankan per field dengan `some`, bukan dengan menggabungkan teks
lebih dulu. Kalau digabung, frasa bisa kejatuhan sebagian dari satu field dan
sisanya dari field lain, dan hasilnya bukan yang orang maksud. Ada pengujian
yang mengunci itu.

Enam pengujian baru, semuanya memeriksa hasil filter: kata hanya di catatan,
kata di ringkasan, entri yang cocok di kedua field tetap muncul sekali, frasa
lintas field tidak cocok, entri tanpa catatan tidak merusak pencarian, dan
TodoList tetap hanya membaca teksnya sendiri.

Mutasi yang membuat pencarian berhenti membaca catatan menggigit dua
pengujian.
