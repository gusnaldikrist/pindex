# Domain Docs

Bagaimana skill engineering membaca dokumentasi domain repo ini saat menelusuri kode.

## Sebelum menelusuri, baca ini

Repo ini **tidak punya** `CONTEXT.md`, glosarium, atau `docs/adr/`. Yang ada
adalah dua hal di repo dan vault Obsidian:

- `.agents/doc-map.md` - peta siapa pemilik topik dan urutan menyentuh dokumen
  saat ada perubahan. Baca ini lebih dulu kalau akan mengubah dokumen.
- `C:\vault\01-Projects\Penanda\` - produk dan keputusan. `prd.md` adalah
  pemilik perilaku, `decisions.md` adalah log keputusan, `prd-skema.md`
  menjelaskan bentuk data.

Bila `CONTEXT.md` atau `docs/adr/` belum ada, **lanjut diam-diam**. Jangan
menandai ketiadaannya, dan jangan menyarankan membuatnya di awal. Skill
`/domain-modeling` (diakses lewat `/grill-with-docs` dan
`/improve-codebase-architecture`) akan membuatnya secara bertahap saat istilah
atau keputusan benar-benar matang.

## Struktur file

Layout yang biasanya dipakai skill ini:

```text
/
├── CONTEXT.md        <- glosarium + peta konteks
├── docs/adr/
│   ├── 0001-<keputusan>.md
│   └── 0002-<keputusan>.md
└── src/
```

Penanda belum punya berkas-berkas itu, dan tidak akan membuatnya supaya
strukturnya terlihat rapi. Buat berkasnya kalau ada istilah atau keputusan
yang benar-benar matang.

## Pakai kosakata yang sudah ada

Istilah domain Penanda sudah dipakai di kode dan di PRD: **item**, **tag**,
**todo**, **log**, **sop**, **backend**, **satuan data**. Pertahankan
kosakata itu; jangan mengarang sinonim.

Definisi lengkap ada di `prd.md` dan `prd-skema.md` di vault. Bila istilah yang
Anda butuhkan belum ada di sana, itu sinyal: entah Anda sedang menciptakan
bahasa yang tidak dipakai proyek (pertimbangkan ulang), atau memang ada celah
nyata (catat untuk `/domain-modeling`).

## Tandai konflik keputusan

Bila output Anda bertentangan dengan keputusan yang sudah tercatat, munculkan
secara eksplisit alih-alih menimpanya diam-diam. Keputusan Penanda ada di
`decisions.md` di vault, ditulis sebagai tanggal + judul, bukan bernomor:

> _Bertentangan dengan keputusan "Aturan path lokal punya satu sumber
> kebenaran" (2026-10-01), tapi layak dibuka ulang karena…_

## Catatan proyek

- Istilah domain (item, tag, todo, log, sop) berasal dari `prd.md` dan
  `prd-skema.md`. Jangan menambah istilah baru tanpa menyentuh PRD itu.
- Keputusan arsitektur dicatat di vault Obsidian (`decisions.md`), bukan di
  `docs/adr/` repo ini. Alasannya: dokumen produk tinggal di vault supaya
  keputusan dan spec bisa dibaca berdampingan, sedangkan repo menyimpan
  petunjuk agent yang selalu dibutuhkan saat mengedit kode.
- Jalur Lite sudah dihapus (2026-10-01). Istilah "jalur" tidak lagi
  merupakan konsep domain - aplikasi hanya punya satu cara jalan.
