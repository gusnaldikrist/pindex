# 01: Pencarian Entri dan Penghapusan Item Lepas dari `item_id`

**What to build:** Mencari di TodoList atau Logbook mencocokkan teks entri
saja, tidak lagi mencocokkan judul item yang tertaut. Menghapus item di Indeks
tidak lagi melepas apa pun dari TodoList maupun Logbook.

Bentuk data dan tampilannya belum berubah pada tiket ini; yang berubah adalah
dua perilaku yang diam-diam membaca field itu.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Pencarian entri tidak lagi membangun peta item dan tidak lagi mencocokkan judul item tertaut.
- [ ] Mencari kata kunci yang ada di teks entri tetap menemukan entri itu.
- [ ] Mencari kata kunci yang hanya ada di judul item tidak lagi menemukan entri TodoList atau logbook yang pernah tertaut ke item itu.
- [ ] Menghapus item di Indeks tidak lagi mengubah isi TodoList maupun Logbook.
- [ ] Setelah penghapusan item, seluruh entri TodoList dan Logbook tetap utuh, termasuk yang punya teks panjang dan deadline.
- [ ] Tidak ada lagi cabang kode yang membaca atau menulis `item_id` di jalur pencarian dan penghapusan item.
- [ ] Pengujian yang khusus menguji pencocokan lewat item tertauf tidak lagi ada; bagian yang masih berlaku dipindah ke pengujian yang tersisa.
- [ ] Ada mutasi yang mengembalikan pencocokan judul item dan mutasi yang mengembalikan pelepasan `item_id` saat item dihapus; keduanya tertangkap.
- [ ] Pengujian bentuk entri dan pengujian Modal CRUD tetap lulus tanpa perubahan arti.
- [ ] Semua pengujian JavaScript dan Go lulus.