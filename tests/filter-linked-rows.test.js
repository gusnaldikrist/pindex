import test from 'node:test';
import { buatBackendPalsu } from './helpers/fake-backend.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Test untuk module filterLinkedRows, hasil deepened penyaringan Todo dan
// Log menjadi satu interface. Sebelumnya keduanya punya salinan aturan
// kata kunci yang identik.

const repoRoot = path.resolve('.');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const searchJsPath = path.join(repoRoot, 'src', 'frontend', 'search.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');

function loadApp() {
  const backend = buatBackendPalsu({});
  const sandbox = {
    document: {
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
      body: { appendChild() {}, removeChild() {} }, addEventListener() {}, readyState: 'complete'
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    fetch: backend.fetch,
    AbortController, setTimeout, clearTimeout, console, Date
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(searchJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(adapterJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(appJsPath, 'utf8'), sandbox);
  return sandbox.module.exports;
}

const items = [
  { id: 'sheet-ta', title: 'Sheet Admin TA' },
  { id: 'slims', title: 'SLiMS Bulian' }
];

test('filterLinkedRows: cocok pada teks baris sendiri', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'a', teks: 'Input 20 data', item_id: null },
    { id: 'b', teks: 'Validasi draft', item_id: null }
  ];

  const hasil = filterLinkedRows(rows, 'input 20', {});
  assert.deepEqual(hasil.map(r => r.id), ['a'], 'Frasa berurutan harus cocok');
});

test('filterLinkedRows: frasa terbalik tidak cocok (PRD 5.1)', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [{ id: 'a', teks: 'Sheet Admin TA', item_id: null }];

  assert.equal(filterLinkedRows(rows, 'admin sheet', {}).length, 0,
    'Kata tidak berurutan tidak boleh cocok');
});



test('filterLinkedRows: spasi berlebih dan huruf besar diabaikan', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [{ id: 'a', teks: 'Validasi Draft TA', item_id: null }];

  assert.equal(filterLinkedRows(rows, '  VALIDASI   draft ', {}).length, 1,
    'Spasi berlebih diabaikan dan huruf besar-kecil tidak dibedakan');
});

test('filterLinkedRows: kata kunci kosong mempertahankan semua baris', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [{ id: 'a', teks: 'Satu' }, { id: 'b', teks: 'Dua' }];

  assert.equal(filterLinkedRows(rows, '', {}).length, 2);
  assert.equal(filterLinkedRows(rows, '   ', {}).length, 2,
    'Spasi saja dianggap kosong');
});

test('filterLinkedRows: saringan tambahan lewat keep', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'a', teks: 'Satu', done: false },
    { id: 'b', teks: 'Dua', done: true }
  ];

  const belum = filterLinkedRows(rows, '', { keep: r => !r.done });
  assert.deepEqual(belum.map(r => r.id), ['a'], 'Saringan tambahan harus dipakai');

  const semua = filterLinkedRows(rows, '', { keep: () => false });
  assert.equal(semua.length, 0, 'keep yang menolak semua harus mengosongkan hasil');
});

test('filterLinkedRows: pengurutan lewat compare', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'kecil', date: '2026-09-01' },
    { id: 'besar', date: '2026-09-30' }
  ];

  const hasil = filterLinkedRows(rows, '', {
    compare: (a, b) => b.date.localeCompare(a.date)
  });
  assert.deepEqual(hasil.map(r => r.id), ['besar', 'kecil'], 'Pengurutan harus memakai compare');
});

test('filterLinkedRows: tidak memutasi array asal', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'a', date: '2026-09-01' },
    { id: 'b', date: '2026-09-30' }
  ];
  const salinan = rows.map(r => r.id);

  filterLinkedRows(rows, '', {
    compare: (a, b) => b.date.localeCompare(a.date)
  });

  assert.deepEqual(rows.map(r => r.id), salinan,
    'sort tidak boleh memutasi array yang diberikan pemanggil');
});

test('filterLinkedRows: input tidak valid ditangani', () => {
  const { filterLinkedRows } = loadApp();

  assert.equal(filterLinkedRows(null, 'x', {}).length, 0, 'null harus jadi array kosong');
  assert.equal(filterLinkedRows(undefined, '', {}).length, 0);
  assert.equal(filterLinkedRows([{ teks: 'x' }], null, 'x', {}).length, 1,
    'items null tidak boleh membuat penyaringan gagal');
});

test('filterLinkedRows: item tertaut yang tidak ada tidak membuat crash', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [{ id: 'a', teks: 'Yatim', item_id: 'sudah-dihapus' }];

  assert.equal(filterLinkedRows(rows, 'yatim', {}).length, 1,
    'item_id yang menunjuk item hilang harus tetap bisa dicari lewat teks sendiri');
});

// Item dan baris bisa datang dari berkas yang ditulis orang lain, jadi id
// kosong mungkin ada. Baris tanpa tautan tidak boleh ikut tertaut ke item
// yang juga tidak punya id.
test('filterLinkedRows: baris tanpa item_id tidak menempel ke item tanpa id', () => {
  const { filterLinkedRows } = loadApp();
  const itemsTanpaId = [{ title: 'Judul Tanpa Id' }];
  const rows = [
    { id: 'a', teks: 'Entri bebas' },
    { id: 'b', teks: 'Entri bebas', item_id: null }
  ];

  const hasil = filterLinkedRows(rows, 'judul tanpa', {});
  assert.equal(hasil.length, 0,
    'Baris tanpa item_id tidak boleh dicocokkan ke item yang id-nya kosong');
});

test('filterLogs dan filterTodos memakai aturan yang sama', () => {
  const { filterLogs, filterTodos } = loadApp();

  const baris = [
    { id: 'x', teks: 'Kumpul Jumat pagi', updated_at: '2026-10-01', done: false }
  ];

  const dariLog = filterLogs(baris, 'kumpul', '', '');
  const dariTodo = filterTodos(baris, 'kumpul', 'semua');

  assert.deepEqual(
    dariLog.map(r => r.id),
    dariTodo.map(r => r.id),
    'Kata kunci yang sama harus memberi hasil sama pada Todo dan Log'
  );
  assert.deepEqual(dariLog.map(r => r.id), ['x']);
});

test('normalizeRowQuery: aturan PRD 5.1', () => {
  const { normalizeRowQuery } = loadApp();

  assert.equal(normalizeRowQuery('  Sheet   Admin  '), 'sheet admin');
  assert.equal(normalizeRowQuery(''), '');
  assert.equal(normalizeRowQuery(null), '');
  assert.equal(normalizeRowQuery(undefined), '');
});
// Tiket 01: judul item tidak lagi ikut dicari. Pencarian entri membaca teks
// entri saja. Test ini yang membuktikan perubahan benar-benar terjadi; tanpa
// ia, penghapusan tidak bisa dibedakan dari tidaknya.
test('filterLinkedRows: judul item TIDAK lagi ikut dicari', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'a', teks: 'Entri lain', item_id: 'sheet-ta' },
    { id: 'b', teks: 'Entri kedua', item_id: null }
  ];

  const hasil = filterLinkedRows(rows, 'sheet admin', {});
  assert.deepEqual(hasil.map(r => r.id), [],
    'Kata kunci dari judul item tidak boleh menemukan entri');
});

// Yang selamat setelah perubahan: teks entri sendiri tetap dicari.
test('filterLinkedRows: teks entri sendiri tetap jadi sumber pencarian', () => {
  const { filterLinkedRows } = loadApp();
  const rows = [
    { id: 'a', teks: 'Kumpul Jumat', item_id: null },
    { id: 'b', teks: 'Entri lain', item_id: null }
  ];

  const hasil = filterLinkedRows(rows, 'jum', {});
  assert.deepEqual(hasil.map(r => r.id), ['a'],
    'Teks entri sendiri harus tetap ditemukan');
});
