# 01: Urutan TodoList Memakai Deadline

**What to build:** Daftar TodoList diurutkan menurut deadline, bukan menurut kapan
tugas itu terakhir disentuh. Tugas yang jatuh tempo paling awal tampil paling
atas, tugas yang sudah lewat otomatis mendahului yang akan datang karena
tanggalnya adalah tanggal paling awal, tugas tanpa tenggat turun ke bawah semua
yang punya tenggat, dan tugas selesai tetap berada di paling bawah serta
terurut dari yang baru diselesaikan.

Yang tidak berubah: bentuk field, validasi, bentuk modal, dan cara label
`lewat`, `mepet`, serta `selesai` dihitung.

Pengubahan ini membalik keputusan tiket 07 yang mengurutkan menurut kapan
terakhir disentuh. Keputusan itu memang disengaja dan ada pengujian yang
menguncinya, jadi ia dicatat sebagai keputusan yang dibalik, bukan sebagai bug
yang terlewat. Pengujian yang menguncinya ditulis ulang, bukan dihapus: bagian
yang masih berlaku, yaitu selesai berada di bawah dan selesai terurut menurun,
tetap diuji.

**Blocked by:** None (can start immediately).

**Status:** done (2026-10-03)

- [ ] Tugas yang belum selesai dan punya deadline tampil berurutan deadline menaik, dan tanggal yang sama dipecah oleh kapan terakhir disentuh, menurun.
- [ ] Tugas yang sudah lewat tampil sebelum tugas yang jatuh tempo di masa depan, tanpa aturan khusus untuk keadaan lewat.
- [ ] Tugas yang belum selesai dan punya deadline tampil sebelum tugas yang belum selesai dan tidak punya deadline.
- [ ] Tugas yang selesai tetap berada di bawah semua yang belum selesai, dan di antara yang selesai, yang terakhir diubah tetap paling atas.
- [ ] Deadline kosong, bukan tanggal, dan tidak berbentuk `YYYY-MM-DD` diperlakukan sebagai tidak punya deadline, dan tidak membuat daftar gagal.
- [ ] Penghitungan label `lewat`, `mepet`, dan `selesai` memakai definisi deadline yang sama dengan yang dipakai pengurutan, sehingga keduanya tidak bisa berbeda pendapat tentang satu baris.
- [ ] Urutan tetap benar saat daftar disaring ke belum selesai dan saat dicari dengan kata kunci, karena keduanya melewati aturan urutan yang sama.
- [ ] Pengujian yang mengunci urutan lama ditulis ulang, bukan dihapus; bagian yang masih berlaku yaitu selesai berada di bawah dan selesai terurut menurun tetap diuji.
- [ ] Pengujian baru memeriksa urutan, bukan hanya isi. Minimal satu pengujian memakai tugas tanpa deadline bercampur dengan tugas bertenggat, karena di situlah perbedaan perlakuannya terlihat.
- [ ] Tiga mutasi dijalankan dan ketiganya tertangkap: mengembalikan aturan ke kapan terakhir disentuh, membalik arah pengurutan tanggal, dan menghapus perlakuan deadline kosong.
- [ ] Keputusan dibalik dicatat di log keputusan beserta alasannya, aturan urutan ditulis di dokumen produk bagian TodoList, bentuknya diselaraskan di wireframe, dan ditutup dengan satu baris changelog serta entri log sesi.
- [ ] Seluruh pengujian JavaScript dan Go lulus, dan paket rilis disinkronkan dengan hash terverifikasi.
