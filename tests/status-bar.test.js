import test from 'node:test';
import assert from 'node:assert/strict';
import { buatBackendPalsu } from './helpers/fake-backend.js';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve('.');
const exampleJsonPath = path.join(repoRoot, 'src', 'shared', 'data.example.json');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const searchJsPath = path.join(repoRoot, 'src', 'frontend', 'search.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');

// Harness minimal yang cukup untuk test status bar dan penyimpanan.
// Berkas test lain punya harness sendiri yang lebih lengkap.

function createTestEnvironment(initialData = null, fetchImpl = null) {
  const elements = new Map();
  const docListeners = {};

  let panelInnerHtml = '';
  let statusText = '';
  let statusClass = '';

  const statusBar = {
    set textContent(text) { statusText = text; },
    get textContent() { return statusText; },
    set className(cls) { statusClass = cls; },
    get className() { return statusClass; }
  };

  const panelIndeks = {
    set innerHTML(html) { panelInnerHtml = html; },
    get innerHTML() { return panelInnerHtml; }
  };

  function getOrCreateElement(id, tagName = 'div') {
    if (!elements.has(id)) {
      const listeners = {};
      let value = '';
      let className = '';
      let innerHTML = '';
      let style = { display: '' };
      let disabled = false;
      const attributes = new Map();
      elements.set(id, {
        id,
        tagName: tagName.toUpperCase(),
        listeners,
        style,
        setAttribute: (a, v) => attributes.set(a, String(v)),
        getAttribute: (a) => (a === 'id' ? id : (attributes.get(a) || null)),
        removeAttribute: (a) => attributes.delete(a),
        addEventListener(evt, h) {
          if (!listeners[evt]) listeners[evt] = [];
          listeners[evt].push(h);
        },
        trigger(evt, data = {}) {
          if (listeners[evt]) {
            for (const h of listeners[evt]) h({ target: this, preventDefault() {}, ...data });
          }
        },
        set innerHTML(html) { innerHTML = String(html); },
        get innerHTML() { return innerHTML; },
        set textContent(t) { innerHTML = String(t); },
        get textContent() { return innerHTML; },
        set value(v) { value = String(v); },
        get value() { return value; },
        set className(c) { className = String(c); },
        get className() { return className; },
        set disabled(d) { disabled = Boolean(d); },
        get disabled() { return disabled; },
        dataset: {},
        focus() {},
        select() {},
        closest() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        classList: { contains: () => false, toggle() {}, add() {}, remove() {} }
      });
    }
    return elements.get(id);
  }

  getOrCreateElement('panel-indeks', 'section');
  getOrCreateElement('panel-todo', 'section');
  getOrCreateElement('panel-log', 'section');

  const activeModals = [];
  const store = {};
  if (initialData) store.indeks_v1 = JSON.stringify(initialData);

  // Server palsu: aplikasi hanya punya satu jalur, jadi halaman yang siap
  // selalu menghubungi backend. Tanpa ini setiap test berakhir dengan
  // "jalur Lite", yang sudah tidak ada.
  const backend = buatBackendPalsu(store);

  const domDocument = {
    readyState: 'complete',
    getElementById: (id) => {
      if (id === 'status-bar') return statusBar;
      if (id === 'panel-indeks') return panelIndeks;
      return getOrCreateElement(id);
    },
    querySelector: (sel) => (sel === '.modal-overlay'
      ? (activeModals.length ? activeModals[activeModals.length - 1] : null)
      : null),
    querySelectorAll: () => [],
    createElement: (tag) => getOrCreateElement('dyn-' + Math.random().toString(36).slice(2, 8), tag),
    body: {
      appendChild(node) {
        if (node.className && String(node.className).includes('modal-overlay')) {
          activeModals.push(node);
          node.parentNode = domDocument.body;
        }
      },
      removeChild(node) {
        const i = activeModals.indexOf(node);
        if (i !== -1) { activeModals.splice(i, 1); node.parentNode = null; }
      }
    },
    addEventListener(evt, h) {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(h);
    },
    trigger: (evt, data) => { if (docListeners[evt]) for (const h of docListeners[evt]) h(data); }
  };

  const sandbox = {
    document: domDocument,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    },
    // Default: backend palsu yang melayani data dari store. Test yang butuh
    // server mati atau menolak menulis, mengoper fetchImpl sendiri.
    fetch: fetchImpl || backend.fetch,
    AbortController,
    setTimeout, clearTimeout,
    console, Date
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(searchJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(adapterJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(appJsPath, 'utf8'), sandbox);

  return {
    sandbox,
    state: sandbox.module.exports.state,
    panelIndeks: { get innerHTML() { return panelInnerHtml; } },
    getPanelHtml: () => panelInnerHtml,
    activeModals,
    store,
    getOrCreateElement,
    getStatusText: () => statusText,
    getStatusClass: () => statusClass,
    triggerDoc: domDocument.trigger,
    // init() memanggil detectStorageMode lalu loadData berurutan
    async settle() {
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
    }
  };
}

// Path lokal selalu bisa dibuka, jadi tidak ada lagi kalimat konsekuensi jalur.
test('area status tidak pernah menyebut Lite atau Pro', async () => {
  const env = createTestEnvironment();
  await env.settle();

  assert.match(env.getStatusText(), /^Penanda - 0 item/);
  assert.doesNotMatch(env.getStatusText(), /\bLite\b|\bPro\b/,
    'Area status tidak boleh menyebut nama jalur');
});

// --------------------------------------------------------------------------
// Penyimpanan lewat backend
// --------------------------------------------------------------------------

test('data dibaca dari backend, bukan dari localStorage', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(null, async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(exampleData)
  }));
  await env.settle();

  assert.equal(env.state.data.items.length, 4, 'Data harus dibaca dari backend');
  assert.match(env.getStatusText(), /^Penanda - 4 item/, 'Area status menyebut jumlah item');
});

test('penyimpanan lewat POST /api/data, bukan localStorage', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const calls = [];

  const env = createTestEnvironment(null, async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body });
    return { ok: true, status: 200, text: async () => '' };
  });
  await env.settle();

  const ok = await env.sandbox.saveData(exampleData);
  assert.equal(ok, true, 'Simpan lewat API harus sukses');

  const postCalls = calls.filter(c => c.method === 'POST');
  assert.equal(postCalls.length, 1, 'Harus satu permintaan POST ke backend');
  assert.equal(postCalls[0].url, '/api/data');
  assert.match(postCalls[0].body, new RegExp(`"version":${exampleData.version}`), 'Badan POST berisi seluruh isi berkas');
  assert.match(env.getStatusText(), /Penanda - 4 item - tersimpan \d{2}:\d{2}/,
    'Status menampilkan jam simpan');
});

test('simpan mengirim data lama DAN item baru, bukan hanya item baru', async () => {
  const data = {
    version: 1,
    items: [{ id: 'a', title: 'Item Dari Server', tags: ['x'], links: [{ label: 'b', url: 'https://a.test' }], catatan: '', updated_at: '2026-10-01' }],
    todo: [], logs: []
  };
  const posts = [];

  const env = createTestEnvironment(null, async (url, opts = {}) => {
    if (opts.method === 'POST') { posts.push(opts.body); return { ok: true, status: 200, text: async () => '' }; }
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  });
  await env.settle();

  const ok = await env.sandbox.saveData({
    ...data,
    items: [...data.items, { id: 'b', title: 'Item Baru', tags: ['x'], links: [{ label: 'b', url: 'https://b.test' }], catatan: '', updated_at: '2026-10-01' }]
  });

  assert.equal(ok, true, 'Simpan setelah init harus berhasil');
  assert.equal(posts.length, 1, 'Harus tepat satu POST');
  const body = JSON.parse(posts[0]);
  assert.equal(body.items.length, 2, 'POST harus memuat data lama DAN item baru');
});

// --------------------------------------------------------------------------
// Kegagalan backend harus terlihat, bukan layar kosong yang menyesatkan
// --------------------------------------------------------------------------

test('backend mati: pesan menyebut cara menjalankan yang benar', async () => {
  const env = createTestEnvironment(null, async () => {
    throw new TypeError('Failed to fetch');
  });
  await env.settle();

  assert.match(env.getStatusText(), /penanda\.exe/,
    'Halaman tanpa server harus diarahkan ke penanda.exe');
  assert.doesNotMatch(env.getStatusText(), /Failed to fetch/,
    'Galat teknis tidak boleh sampai ke user');
});

test('backend menjawab galat saat baca: kegagalan harus terlihat', async () => {
  const env = createTestEnvironment(null, async () => ({ ok: false, status: 500, text: async () => '' }));
  await env.settle();

  assert.equal(env.getStatusClass(), 'status-bar error', 'Status harus ditandai galat');
  assert.match(env.getStatusText(), /penanda\.exe/,
    'User harus diberi tahu apa yang harus dilakukan');
});

test('backend mati saat simpan: isian harus tetap di tempatnya', async () => {
  const env = createTestEnvironment(null, async () => ({
    ok: true, status: 200, text: async () => '{"version":1,"items":[],"todo":[],"logs":[],}'
  }));
  await env.settle();

  // Backend mati setelah halaman siap
  env.sandbox.fetch = async () => { throw new TypeError('Failed to fetch'); };

  const ok = await env.sandbox.saveData({ version: 1, items: [{ id: 'x' }] });
  assert.equal(ok, false, 'Simpan harus melaporkan gagal');
  assert.match(env.getStatusText(), /Gagal menyimpan ke server/, 'Kegagalan harus tampil di area status');
});

// --------------------------------------------------------------------------
// Tombol pada path lokal
// --------------------------------------------------------------------------

test('path lokal memakai tombol Buka dan tetap ada tombol Copy', async () => {
  const data = {
    version: 1,
    items: [{
      id: 'lokal',
      title: 'Berkas lokal',
      tags: ['x'],
      links: [{ label: 'buka', url: 'D:\\Data\\laporan.xlsx' }],
      catatan: '',
      updated_at: '2026-10-01'
    }],
    todo: [], logs: []
  };

  const env = createTestEnvironment(null, async () => ({
    ok: true, status: 200, text: async () => JSON.stringify(data)
  }));
  await env.settle();

  env.sandbox.renderIndeksView();

  const html = env.getOrCreateElement('result-list').innerHTML;
  assert.match(html, /btn-buka-local/, 'Tombol Buka path lokal harus muncul');
  assert.match(html, /btn-copy/, 'Tombol Copy harus tetap ada sebagai jalan keluar');
});

// --------------------------------------------------------------------------
// Bentuk area status
// --------------------------------------------------------------------------

test('status bar memuat tiga bagian dipisah tanda hubung', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  await env.settle();

  const ok = await env.sandbox.saveData(exampleData);
  assert.equal(ok, true, 'saveData harus sukses');

  const text = env.getStatusText();
  const parts = text.split(' - ');
  assert.equal(parts.length, 3, `Status harus tiga bagian, dapat: "${text}"`);
  assert.equal(parts[0], 'Penanda');
  assert.equal(parts[1], '4 item');
  assert.match(parts[2], /^tersimpan \d{2}:\d{2}$/, 'Bagian ketiga harus waktu simpan');
});

test('status bar: jam simpan tidak berubah saat hanya membaca', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  await env.settle();

  const sebelum = env.getStatusText();
  await env.sandbox.loadData();
  await env.settle();
  const sesudah = env.getStatusText();

  assert.equal(sesudah, sebelum, 'Membaca data tidak boleh mengubah area status');
});
