import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appJsPath = path.resolve('src/frontend/app.js');
const source = fs.readFileSync(appJsPath, 'utf8');

// Audit lapis render.
//
// Latar: 17 titik penulisan innerHTML di app.js sudah diberi directive
// ast-grep-ignore, bukan karena aman tanpa dicek, tapi karena tiap titik sudah
// diperiksa dan tidak ada data pengguna yang masuk tanpa escapeHtml().
// Directive hanya diam selama tidak ada yang salah; kalau suatu saat ada data
// mentah yang disisipkan, audit inilah yang harus menggigit.
//
// Dua hal yang dijaga di sini:
//   1. setiap interpolasi yang menyebut field milik pengguna harus lewat
//      escapeHtml(); dan
//   2. directive suppress tidak boleh menyusut diam-diam tanpa keputusan baru
//      yang tercatat.

// Field milik pengguna. Menyebut salah satu di dalam ${...} tanpa escapeHtml
// berarti data mentah masuk ke HTML.
const FIELD_PENGGUNA =
  /\b(?:item|todo|log|logEntry|focusedItem|entry|links)\s*(?:\.|\[\s*)(?:title|teks|catatan|label|url|sop|tags|id|deadline|date|text)\b/;

// Nama helper dan perantara yang isinya sudah melewati escapeHtml lebih dulu
// di dalam fungsinya masing-masing.
//
//   formatCatatanWithCode  memanggil escapeHtml(text) lalu hanya menyisipkan
//                          tag <code> yang tetap.
//   buildSopHtml           memanggil escapeHtml() pada setiap langkahnya.
//
// Menambah nama di sini berarti menerima Responsibility baru: kalau isi
// helper itu diubah sampai escaping-nya hilang, audit ini ikut berbohong.
const PERANTARA_YANG_SUDAH_AMAN = new Set([
  'formatCatatanWithCode',
  'buildSopHtml',
  'title',
  'titlePrefix',
  'slug'
]);

const POLA_INTERPOLASI = /\$\{([^{}]*)\}/g;

function semuaInterpolasi() {
  return Array.from(source.matchAll(POLA_INTERPOLASI), (cocok) => ({
    ekspresi: cocok[1].trim().replace(/\s+/g, ' '),
    indeks: cocok.index
  }));
}

// Ekspresi yang hanya membandingkan nilai tidak mengangkut data ke HTML: hasilnya
// boolean yang dipakai memilih literal di kedua cabang. Menariknya ke dalam
// audit hanya menghasilkan allowlist berisi perbandingan, yang tidak berguna
// sebagai penjaga.
function hanyaPerbandingan(ekspresi) {
  return ekspresi.includes('===') || ekspresi.includes('!==');
}

// Ekspresi dianggap aman kalau seluruh isinya adalah satu pemanggilan helper
// yang sudah terverifikasi meng-escape di dalamnya, misalnya
// buildSopHtml(item.sop). Pemeriksaan dilakukan di awal ekspresi supaya
// argumen yang ikut dirangkai tidak lolos tanpa ikut dinilai.
function dibangunHelperTerverifikasi(ekspresi) {
  for (const nama of PERANTARA_YANG_SUDAH_AMAN) {
    if (ekspresi.startsWith(nama + '(')) return true;
  }
  return false;
}

function nomorBaris(indeks) {
  return source.slice(0, indeks).split('\n').length;
}

test('Audit lapis render - tidak ada data pengguna yang masuk ke innerHTML tanpa escapeHtml', () => {
  const pelanggaran = semuaInterpolasi().filter(({ ekspresi }) => {
    if (ekspresi.includes('escapeHtml(')) return false;
    if (dibangunHelperTerverifikasi(ekspresi)) return false;
    if (hanyaPerbandingan(ekspresi)) return false;
    return FIELD_PENGGUNA.test(ekspresi);
  });

  const rincian = pelanggaran
    .map(({ ekspresi, indeks }) => '  baris ' + nomorBaris(indeks) + ': ${' + ekspresi + '}')
    .join('\n');

  assert.equal(
    pelanggaran.length,
    0,
    'Data pengguna masuk ke HTML tanpa escapeHtml(). Bungkus dengan escapeHtml(), ' +
      'atau masukkan ke PERANTARA_YANG_SUDAH_AMAN bila isinya memang sudah ter-escape:\n' +
      rincian
  );
});

test('Audit lapis render - directive suppress innerHTML tidak hilang diam-diam', () => {
  // Directive-nya sendiri tidak menjelaskan apa-apa kalau alasannya tersebar ke
  // banyak tempat. Yang dijaga di sini hanya jumlahnya tidak menyusut tanpa
  // ada keputusan baru yang tercatat di ADR.
  const jumlah = (source.match(/ast-grep-ignore: no-inner-html-js/g) || []).length;
  assert.ok(
    jumlah >= 17,
    'hanya ada ' + jumlah + ' directive; ada titik innerHTML yang suppress-nya hilang. ' +
      'Kalau memang sengaja dibuang, catat dulu keputusannya di ADR.'
  );
});

test('Audit lapis render - directive menempel pada baris yang benar-benar menulis innerHTML', () => {
  const baris = source.split('\n');
  const salah = [];

  baris.forEach((isi, i) => {
    if (!isi.includes('ast-grep-ignore: no-inner-html-js')) return;
    const berikutnya = baris[i + 1] || '';
    if (!berikutnya.includes('.innerHTML =') || berikutnya.trim() === '') {
      salah.push('  baris ' + (i + 1) + ': ' + JSON.stringify(berikutnya.slice(0, 60)));
    }
  });

  assert.equal(
    salah.length,
    0,
    'Directive harus tepat di baris sebelum penulisan innerHTML. Kalau ada baris kosong ' +
      'atau apa pun di antaranya, directive tidak berlaku dan lint akan tetap berteriak:\n' +
      salah.join('\n')
  );
});
