import test from 'node:test';
import { buatBackendPalsu } from './helpers/fake-backend.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve('.');
const exampleJsonPath = path.join(repoRoot, 'src', 'shared', 'data.example.json');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');

// init() memanggil detectStorageMode() lalu loadData() sebagai dua promise,
// jadi dua gilir event loop diperlukan sebelum DOM ter-render.

function createStorageEnvironment(options = {}) {
  const { storage = null } = options;

  let panelInnerHtml = '';
  let statusText = '';
  let statusClass = '';

  const panelIndeks = {
    set innerHTML(html) { panelInnerHtml = html; },
    get innerHTML() { return panelInnerHtml; }
  };

  const statusBar = {
    set textContent(text) { statusText = text; },
    get textContent() { return statusText; },
    set className(cls) { statusClass = cls; },
    get className() { return statusClass; }
  };

  const store = {};
  const backend = buatBackendPalsu(store);
  const mockLocalStorage = storage || {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };

  const sandbox = {
    document: {
      readyState: 'complete',
      querySelectorAll: () => [],
      getElementById: (id) => {
        if (id === 'panel-indeks') return panelIndeks;
        if (id === 'status-bar') return statusBar;
        return null;
      },
      createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
      body: { appendChild() {}, removeChild() {} },
      addEventListener() {}
    },
    localStorage: mockLocalStorage,
    // Environment minimal untuk storage-adapter.js (Tiket 11).
    // Backend palsu dari helper: aplikasi hanya punya satu jalur, jadi
    // halaman yang siap selalu menghubungi server.
    fetch: backend.fetch,
    AbortController,
    setTimeout, clearTimeout,
    console, Date,
    window: {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(appJsPath, 'utf8'), sandbox);

  return {
    sandbox,
    store,
    getPanelHtml: () => panelInnerHtml,
    setPanelHtml: (html) => { panelInnerHtml = html; },
    getStatusText: () => statusText,
    getStatusClass: () => statusClass,
    async settle() {
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
    }
  };
}

test('data.example.json: validasi format dan skema yang sedang dipakai', () => {
  assert.ok(fs.existsSync(exampleJsonPath), 'data.example.json harus ada');
  const parsed = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));

  // Berkas contoh ikut naik ke versi skema yang sedang dipakai, supaya
  // orang yang mulai dari Import tidak mengunci berkasnya di versi lama.
  const appSource = fs.readFileSync(appJsPath, 'utf8');
  const versi = appSource.match(/const supportedVersion\s*=\s*(\d+)/);
  assert.ok(versi, 'app.js harus mendeklarasikan supportedVersion');
  assert.equal(parsed.version, Number(versi[1]), 'Versi data contoh harus sama dengan versi yang ditulis app.js');
  assert.ok(Array.isArray(parsed.items), 'items harus berupa array');
  assert.equal(parsed.items.length, 4, 'Harus ada 4 data dummy items');
  assert.ok(Array.isArray(parsed.todo), 'todo harus berupa array');
  assert.equal(parsed.todo.length, 1, 'Harus ada 1 data todo');
  assert.ok(Array.isArray(parsed.logs), 'logs harus berupa array');
  assert.equal(parsed.logs.length, 1, 'Harus ada 1 data log');
  assert.deepEqual(
    Object.keys(parsed).sort(),
    ['items', 'logs', 'todo', 'version'],
    'Data contoh hanya boleh memuat field yang masih dipakai'
  );
});

test('app.js: loadData() bentuk kosong awal dan render empty state', async () => {
  const env = createStorageEnvironment();
  await env.settle();

  assert.match(env.getStatusText(), /PINDEX - 0 item/, 'Status awal harus menunjukkan PINDEX - 0 item');
  assert.match(env.getPanelHtml(), /Belum ada item kerja/, 'Empty state harus tampil saat data kosong');
  assert.match(env.getPanelHtml(), /\+ Tambah Item/, 'Tombol Tambah Item ada di empty state');
  assert.match(env.getPanelHtml(), /Import JSON/, 'Tombol Import JSON ada di empty state');
  // Tidak ada lagi kalimat konsekuensi jalur: path lokal selalu bisa dibuka.
  assert.ok(
    !env.getPanelHtml().includes('hanya bisa dibuka di jalur Pro'),
    'Kalimat tentang jalur Pro tidak boleh tampil, karena path lokal bisa dibuka'
  );
});

test('app.js: saveData() dan loadData() siklus baca tulis lewat backend', async () => {
  const exampleJson = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createStorageEnvironment();
  await env.settle();

  const saveSuccess = await env.sandbox.saveData(exampleJson);
  assert.equal(saveSuccess, true, 'saveData harus sukses');
  assert.ok(env.store.indeks_v1, 'Data harus tersimpan di backend');

  const storedJson = JSON.parse(env.store.indeks_v1);
  assert.equal(storedJson.items.length, 4, 'Data tersimpan harus memiliki 4 item');

  assert.match(
    env.getStatusText(),
    /PINDEX - 4 item - tersimpan \d{2}:\d{2}/,
    'Status bar harus diperbarui dengan jam simpan'
  );
  assert.match(env.getPanelHtml(), /search-input/, 'Panel indeks harus menampilkan kotak pencarian setelah data tersimpan');

  const loaded = await env.sandbox.loadData();
  assert.equal(loaded.items.length, 4, 'loadData harus mengembalikan 4 item');
});

test('app.js: backend menolak menyimpan tidak merusak isian yang sedang diisi', async () => {
  const env = createStorageEnvironment();
  await env.settle();

  // Server hidup untuk baca tapi menolak untuk tulis.
  const fetchAsli = env.sandbox.fetch;
  env.sandbox.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') {
      return { ok: false, status: 500, text: async () => 'gagal' };
    }
    return fetchAsli(url, opts);
  };
  await env.sandbox.loadData();

  assert.equal(env.getStatusClass(), 'status-bar', 'Baca berhasil jadi tidak ada tanda galat');
  assert.ok(!/Gagal membaca/.test(env.getStatusText()), 'Baca dari server yang hidup tidak boleh gagal');

  // Simulasikan user sedang mengisi form di layar
  env.setPanelHtml('<form id="active-item-form"><input value="draft catatan user"></form>');

  // saveData tidak boleh crash, mengembalikan false, dan TIDAK me-render ulang DOM
  const saved = await env.sandbox.saveData({ version: 1, items: [{ id: 'test' }] });
  assert.equal(saved, false, 'saveData harus mengembalikan false bila server menolak');
  assert.equal(
    env.getPanelHtml(),
    '<form id="active-item-form"><input value="draft catatan user"></form>',
    'DOM dan isian aktif di layar tidak boleh hilang atau di-rerender saat penyimpanan gagal'
  );
});

test('app.js: JSON rusak dari server tidak dianggap data hilang diam-diam', async () => {
  const env = createStorageEnvironment();
  await env.settle();

  // Backend menjawab dengan JSON yang tidak bisa dibaca.
  env.sandbox.fetch = async () => ({
    ok: true, status: 200, text: async () => '{"version": 1, "items": [ INVALID'
  });

  const loaded = await env.sandbox.loadData();
  assert.equal(loaded.items.length, 0, 'loadData harus mengembalikan array items kosong saat JSON rusak');
  assert.notEqual(loaded, null, 'loadData harus tetap mengembalikan objek data, tidak null');
});