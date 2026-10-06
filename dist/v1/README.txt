PINDEX v1
=========

Aplikasi pengorganisasi dan pencarian dokumen kerja lokal/offline untuk
desktop Windows, dilengkapi modul TodoList dan Logbook terintegrasi, serta
ditemani oleh maskot Si Pita (The Bookmark Ribbon Spirit).

Semua data disimpan di komputer Anda sendiri. Tidak ada akun, tidak ada
server luar, dan tidak ada pengiriman data ke internet (100% offline).


CARA JALAN
----------

1. Ekstrak ZIP ini ke satu folder tetap, misalnya D:\PINDEX\
   Jangan langsung membuka dari dalam arsip ZIP.
2. Klik dua kali pindex.exe
3. Browser otomatis terbuka ke http://localhost:8080 (atau port cadangan).

Opsi Baris Perintah (PowerShell / Command Prompt):
  .\pindex.exe               -> Jalan normal (port 8080, fallback ke 8081-8089)
  .\pindex.exe -port 9000    -> Mengunci port tertentu (misal 9000)


PORT & DETEKSI INSTANCE GANDA
-----------------------------

- Auto-Fallback Port:
  Jika port 8080 sedang digunakan oleh aplikasi lain di komputer Anda,
  PINDEX secara otomatis mencari port cadangan (8081 hingga 8089) dan
  membuka peramban ke port yang berhasil aktif.

- Deteksi Instance Ganda (Single-Instance Guard):
  Jika Anda tidak sengaja mengklik dua kali pindex.exe saat PINDEX sudah
  berjalan di latar belakang, PINDEX tidak akan membuat server ganda.
  PINDEX otomatis memfokuskan kembali browser ke tab PINDEX yang aktif
  sehingga data.json Anda selalu aman dari bentrokan file.


MENYIMPAN DATA
--------------

Setiap kali Anda menyimpan, aplikasi menulis ke berkas data.json di
folder yang sama dengan pindex.exe, sekaligus membuat salinan harian
data-YYYYMMDD.json. Kalau data.json rusak, salinan terbaru bisa dipakai
lagi.

Mencadangkan cukup dengan menyalin folder pindex.exe ke tempat lain.
Tidak perlu ada langkah backup khusus.

Untuk berpindah ke komputer lain: klik Export JSON di aplikasi, salin
berkasnya ke komputer tujuan, lalu di sana klik Import JSON dan pilih
berkas itu.


BERKAS LOKAL
-------------

Path lokal seperti D:\Data\laporan.xlsx bisa dibuka satu klik, lewat
tombol Buka. Aplikasi meneruskan permintaan itu ke pindex.exe, jadi
Windows yang membukanya dengan aplikasi bawaannya.

Kalau tombol Buka gagal, teksnya sudah disalin; ada tombol Copy di
sampingnya sebagai jalan keluar.


CADANGKAN DATA
--------------

  Salinan harian  dibuat otomatis tiap kali Anda menyimpan.
  Cadangan penuh  salin folder pindex.exe ke tempat lain sesekali.


CATATAN KEAMANAN
-----------------

- Server hanya mendengarkan di loopback lokal (127.0.0.1). Tidak bisa
  diakses dari komputer lain maupun jaringan internet.
- Tidak ada request ke domain luar. Aplikasi jalan penuh tanpa internet.
- pindex.exe adalah binary Go mandiri tanpa dependency luar. Windows mungkin
  menampilkan peringatan SmartScreen untuk binary yang baru pertama dijalankan.
  Pilih "More info" lalu "Run anyway". Itu perilaku normal Windows untuk
  program mandiri lokal.
- Kalau halaman terbuka tapi aplikasi memberi tahu tidak menemukan
  server, Anda mungkin mengklik index.html secara langsung. Tutup halaman
  itu, lalu jalankan pindex.exe.


MULAI DARI MANA
---------------

Layar kosong punya dua jalan keluar:

  + Tambah Item   -> isi sendiri satu per satu
  Import JSON     -> pakai data.example.json sebagai bahan latihan, lalu
                     ganti dengan data Anda sendiri

Cara cepat mencoba: klik Import JSON, pilih file data.example.json di
folder ini, lalu konfirmasi.


MASALAH UMUM
------------

"Port sedang dipakai aplikasi lain"
  Jika seluruh rentang port 8080-8089 terpakai, tutup aplikasi lain
  tersebut, atau gunakan argumen `-port <nomor>` pada terminal.

"Aplikasi ini berjalan lewat pindex.exe"
  Anda membuka index.html langsung dari File Explorer. Pindex.exe adalah
  server backend lokal; tanpa itu browser memblokir akses file lokal.
  Tutup halaman, klik dua kali pindex.exe, lalu gunakan browser yang
  terbuka otomatis.

Data tidak muncul padahal pernah diisi
  Cek apakah file data.json masih ada di folder pindex.exe, dan apakah
  folder itu yang sama dengan tempat pindex.exe dijalankan.
