# Ekspor Logbook — catatan riset desain

> Dokumen ini bahan masukan desain, bukan spesifikasi. Keputusan final dicatat di
> [[decisions|Decisions Log]] vault.

Tanggal riset: 2026-10-05. Setiap klaim di bawah diberi sumber; yang tidak bisa
diverifikasi ke sumber primer ditandai terbuka, bukan ditegaskan.

## 0. Titik awal: apa yang sudah ada

Ekspor JSON penuh **sudah ada**. Tombol "Cadangkan" di top-bar menulis seluruh isi
berkas (`items` + `todo` + `logs` + `version`) sebagai `.json`, dan ada import
yang mengembalikannya. Jadi entri Logbook secara teknis sudah bisa dibawa keluar.

Yang belum ada adalah ekspor **Logbook sebagai dirinya sendiri** — supaya bisa
dibuka di aplikasi lain tanpa ikut membawa data Indeks. Pertanyaan riset ini
karena itu.

Kendala yang mengikat, dari konteks produk:

- Tanpa framework, tanpa CDN, tanpa build step.
- Tanpa ES module; dimuat sebagai script biasa.
- **Nol request ke domain luar.** Solusi berbasis pustaka eksternal gugur.
- Backend Go stdlib saja; frontend disajikan dari binary yang sama.

## 1. Format apa yang benar-benar dikirim produk nyata

Diverifikasi ke dokumentasi resmi masing-masing.

| Produk | Format ekspor resmi | Sumber |
|:---|:---|:---|
| Notion | HTML, Markdown, CSV (untuk database), PDF (halaman/workspace) | [Export your content](https://www.notion.com/help/export-your-content), [Back up your Notion data](https://www.notion.com/help/back-up-your-data) |
| Evernote | menerima `.pdf`, `.txt`, `.html`, `.md`, `.docx` saat import | [Import content from other apps into Evernote](https://help.evernote.com/hc/en-us/articles/208314308-Import-content-from-other-apps-into-Evernote) |

Pola yang muncul: **format "buka di aplikasi lain" adalah Markdown dan HTML/CSV**,
sedangkan **format cadangan penuh** adalah JSON atau arsip. Notion menyebut CSV
secara eksplisit "for databases", yaitu untuk data bertabel — bukan untuk catatan
naratif.

### 1.1 Temuan yang menolak jawaban "cukup CSV saja"

CSV bukan satu format, melainkan satu keputusan yang membawa beberapa konsekuensi
sekaligus: encoding, delimiter, quoting, dan injeksi formula. Bukti di bagian 2
dan 3 menunjukkan bahwa jawaban "cukup CSV saja" menyelesaikan masalah yang
salah — yang paling sering rusak justru bukan formatnya, tapi **encoding dan
formula**, dan keduanya tidak terlihat sampai user membuka berkasnya di Excel.

## 2. Encoding: BOM UTF-8 wajib untuk Excel

**Terverifikasi dari sumber primer Microsoft:**

> "You can open a CSV file encoded with UTF-8 normally if it was saved with BOM
> (Byte Order Mark). Otherwise, you can open it through either of the following
> ways."
> — [Opening CSV UTF-8 files correctly in Excel](https://support.microsoft.com/en-us/excel/opening-csv-utf-8-files-correctly-in-excel)

Halaman yang sama memuat jalur manual yang bisa dilakukan tanpa BOM: Data →
From Text → set *File Origin* ke `65001: Unicode (UTF-8)`.

Artinya untuk Penanda: tanpa BOM, pengguna harus melakukan langkah manual
tersebut setiap kali. Untuk staf non-teknis, langkah manual itu adalah penghalang
nyata, bukan ribosomal. **Jadi BOM bukan detail opsional — itu yang membuat
berkas bisa langsung dibuka.**

> **Catatan yang belum terverifikasi ke sumber primer.** Bytes BOM adalah
> `EF BB BF`. Halaman resmi Microsoft di atas tidak menyebut angka itu. Nilai
> tersebut muncul konsisten di banyak sumber secondhand dan konsisten dengan
> spesifikasi Unicode, tetapi **belum diverifikasi ke dokumen primer** dalam
> riset ini. Sumber primer yang sesuai: Unicode Core Specification, bab
> "Byte Order Mark".

## 3. Injeksi formula: risiko nyata pada teks bebas

**Terverifikasi dari OWASP** (sumber primer untuk keamanan aplikasi):

> "Spreadsheet applications may interpret certain cell values as formulas, which
> can lead to security issues such as user deception (phishing-style workflows),
> manipulation of spreadsheet output, or data exfiltration. In some
> environments, formula injection can be escalated to higher impact via
> spreadsheet 'gadgets' and legacy features (e.g., DDE / Dynamic Data Exchange
> behaviors), potentially reaching command execution on the workstation that
> opens the file."
> — [CSV Injection | OWASP Foundation](https://owasp.org/www-community/attacks/CSV_Injection)
> — [WSTG: Testing for CSV Injection](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection)

Mengapa ini relevan untuk Penanda dan bukan kekhawatiran teoritis: Logbook
adalah **teks bebas yang diketik orang**. Tidak ada filter yang membersihkan
`=`, `+`, `-`, atau `@` di depan. Nilai logbook bisa datang dari sumber lain
jika logbook diisi lewat salin-tempel. Kalau diekspor apa adanya ke CSV lalu
dibuka di Excel, sel yang diawali `=` akan dievaluasi sebagai formula.

Mitigasi standar: awali nilai tersebut dengan `'` (kutip tunggal) sehingga
Excel memperlakukannya sebagai teks.

## 4. Biaya implementasi di lingkungan tanpa dependensi

Semua opsi di bawah memakai API browser standar, tanpa pustaka, tanpa build step,
tanpa network.

| Format | Perlu pustaka? | API browser | Catatan risiko |
|:---|:---|:---|:---|
| CSV | Tidak | `Blob` + `URL.createObjectURL` + `<a download>` | Encoding + formula |
| Markdown | Tidak | idem | Rendah |
| HTML | Tidak | idem | Perlu CSS agar rapi saat dibuka |
| JSON | Tidak | idem | Sudah ada |

Yang sudah dipakai di repo ini dan bisa dipakai ulang persis:
`exportDataAsJson()` di `src/frontend/app.js` sudah memakai
`Blob` + `URL.createObjectURL` + `link.click()` + `setTimeout(revoke)`.
Ekspor baru tidak perlu mekanisme unduhan sendiri.

## 5. Sketsa implementasi

### 5.1 Pembuat CSV dengan BOM dan penjaga formula

```js
// BOM membuat Excel membaca berkas sebagai UTF-8 tanpa langkah manual
// (support.microsoft.com: "Opening CSV UTF-8 files correctly in Excel").
const BOM_UTF8 = '\uFEFF';

// Prefix yang membuat Excel memperlakukan sel sebagai formula.
const AWAL_FORMULA = /^[=+\-@\t\r]/;

// Escape satu nilai sel. Dua lapis:
//   1. prefix kutip tunggal untuk sel yang akan dievaluasi sebagai formula
//      (OWASP CSV Injection);
//   2. kutip RFC 4180 bila mengandung koma, kutip, atau baris baru.
function selCsv(nilai) {
  let teks = nilai === null || nilai === undefined ? '' : String(nilai);
  if (AWAL_FORMULA.test(teks)) {
    teks = "'" + teks;
  }
  if (/[",\r\n]/.test(teks)) {
    teks = '"' + teks.replace(/"/g, '""') + '"';
  }
  return teks;
}

function logbookKeCsv(logs) {
  const baris = [['tanggal', 'catatan', 'tautan']];
  for (const log of logs) {
    const tautan = Array.isArray(log.links) && log.links.length
      ? log.links.map(link => link.url).join(' ')
      : '';
    baris.push([log.date, log.teks, tautan]);
  }
  return BOM_UTF8 + baris.map(r => r.map(selCsv).join(',')).join('\r\n');
}

function unduhLogbookCsv(logs) {
  const blob = new Blob([logbookKeCsv(logs)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'logbook-' + getTodayCompactString() + '.csv';
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

Catatan implementasi:

- Pemisah baris `CRLF` mengikuti RFC 4180, bukan `\n`.
- BOM ditulis sebagai `\uFEFF` di awal string, bukan sebagai bytes terpisah.
- Rumus Office menyimpan nilai yang diawali kutip tunggal apa adanya saat
  disimpan, sehingga isi logbook tidak berubah setelah user mengedit sel.

### 5.2 Pembuat Markdown

```js
function logbookKeMarkdown(logs) {
  const isi = logs.map(log => {
    const tautan = Array.isArray(log.links) && log.links.length
      ? log.links.map(link => `- [${link.label || link.url}](${link.url})`).join('\n')
      : '';
    return '## ' + log.date + '\n\n' + log.teks + (tautan ? '\n\n### Tautan\n\n' + tautan : '');
  });
  return '# Logbook Penanda\n\n' + isi.join('\n\n---\n\n');
}
```

## 6. Yang tidak bisa diverifikasi dalam riset ini

- **Bytes BOM `EF BB BF`** belum diverifikasi ke spesifikasi Unicode atau
  dokumen resmi lain; hanya konsisten di sumber secondhand.
- **Frekuensi pemakaian ekspor** tidak ada|first-party|. Tidak ditemukan
  dokumentasi resmi yang menyatakan berapa kali pengguna mengekspor
  dibanding mencari di dalam aplikasi. Klaim "ekspor jarang dipakai" **tidak**
  dapat dibuat dari riset ini.
- **Delimiter untuk Excel di locale Indonesia.** Excel di locale tertentu
  memakai titik koma sebagai delimiter daftar. Tidak ditelusuri pada riset ini
  dan dapat berbeda dari perkiraan. Excel modern umumnya menyediakan
  pemeriksaan pemisah saat membuka berkas.
- Tidak ada riset tentang produk lokal Indonesia; semua sumber Barat.

## 7. Catatan desain, bukan rekomendasi final

Pertanyaan yang harus dijawab sebelum menulis tiket:

1. Apakah Logbook diekspor sebagai satu berkas utuh, atau mengikuti saringan
   tanggal yang sedang aktif?
2. Apakah tautan ikut diekspor? Kolomnya menambah nilai atau hanya noise?
3. Apakah CSV perlu/apakah cukup, atau Markdown juga perlu sekarang?

Catatan penting: **ekspor JSON penuh harus tetap ada dan tetap terpisah.**
Kalau ekspor CSV supplanted "Cadangkan", yang hilang adalah kemampuan memulihkan
data — dan Logbook tidak menyimpan `items` maupun `todo`.
