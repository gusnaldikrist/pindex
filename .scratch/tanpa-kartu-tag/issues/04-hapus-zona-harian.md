# 04: Zona Harian Dihapus

**What to build:** Baris Harian dihapus dari layar Indeks. Baris itu menampilkan
chip untuk setiap item yang punya tag `harian`, dan tag itu hanya bermakna lewat
baris tersebut.

Tag `harian` sendiri tidak dilarang dan tidak dihapus dari data. Item yang
memakainya tetap punya tag itu; ia hanya tidak lagi berarti apa-apa secara
visual, karena tidak ada lagi baris yang memakainya. Pencarian tetap mencocokkan
tag seperti tag lain.

Zona Harian sebelumnya dikecualikan dari spec `tanpa-kartu-tag` dengan alasan
bahwa ia punya jalur input yang sudah ada. Alasan itu ternyata tidak cukup:
jalur inputnya berupa pengguna mengetik kata di kolom tag `harian` tanpa petunjuk apa pun,
dan tidak ada satu tempat di aplikasi yang menyebut kata itu. Hasilnya fitur
yang hanya bisa ditemukan orang yang kebetulan sudah tahu.

**Blocked by:** 03 (Field `pinned_tags` Dibuang dari Skema Data).

**Status:** done (2026-10-03)

- [ ] Baris Harian tidak ada lagi di markup Indeks, dan penanda `HARIAN` tidak muncul di layar itu.
- [ ] Fungsi perender baris Harian beserta handler klik chip-nya dibuang.
- [ ] Gaya yang hanya dipakai baris Harian dibuang: zona, gulir horizontal, dan chip beserta keadaanhover-nya termasuk aturan scrollbar.
- [ ] Tag `harian` tetap menjadi tag yang sah pada item; tidak ada validasi yang menolaknya, dan panel tetap menampilkannya seperti tag biasa.
- [ ] Pencarian tetap mencocokkan tag `harian` seperti tag lain, dan pengujiannya tidak berubah.
- [ ] Pengujian zona Harian dihapus karena menguji perilaku yang dibuang; assertion yang menyebut zona harian ditulis ulang ke bentuk yang masih punya target.
- [ ] Cabang `closest` untuk chip harian di harness uji ikut dibuang karena tidak ada lagi yang menanyakannya.
- [ ] Ada mutasi yang dijalankan untuk menguji apakah pengujian baru benar-benar menangkap cacat.
- [ ] Dokumen vault disinkronkan sesuai urutan peta dokumen, ditutup log sesi dan changelog.
- [ ] Semua pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.