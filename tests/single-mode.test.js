import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Penjaga untuk penghapusan jalur Lite.
//
// Aplikasi sekarang hanya punya satu cara jalan: lewat penanda.exe. Test di
// sini menjaga dua hal yang paling mudah hilang diam-diam:
//
//   1. Tanpa server, user diberi tahu apa yang harus dilakukan - bukan error
//      teknis, dan bukan diam-diam memakai localStorage.
//   2. Tidak ada fallback localStorage sama sekali. Kalau ini kembali, Lite
//      tumbuh lagi tanpa ada yang menyadarinya.

const repoRoot = path.resolve('.');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const searchJsPath = path.join(repoRoot, 'src', 'frontend', 'search.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');

// Harness minimal: cukup untuk memuat halaman dan membaca area status.
// fetchImpl menentukan apakah ada server:
//   null (default) = fetch ditolak, seperti halaman yang salah dibuka
function createTestEnvironment(fetchImpl = null) {
  const elements = new Map();
  const docListeners = {};
  const activeModals = [];

  let statusText = '';
  let statusClass = '';
  let panelHtml = '';
  const localStorageCalls = [];

  const statusBar = {
    set textContent(t) { statusText = t; },
    get textContent() { return statusText; },
    set className(c) { statusClass = c; },
    get className() { return statusClass; }
  };

  const panelIndeks = {
    set innerHTML(h) { panelHtml = h; },
    get innerHTML() { return panelHtml; }
  };

  function getOrCreateElement(id, tagName = 'div') {
    if (elements.has(id)) return elements.get(id);
    const listeners = {};
    let value = '', className = '', innerHTML = '';
    const style = { display: '' };
    const attributes = new Map();
    elements.set(id, {
      id, tagName: tagName.toUpperCase(), listeners, style,
      setAttribute: (a, v) => attributes.set(a, String(v)),
      getAttribute: (a) => (a === 'id' ? id : (attributes.get(a) || null)),
      removeAttribute: (a) => attributes.delete(a),
      closest: (sel) => (sel.startsWith('.') && className.includes(sel.slice(1)) ? this : null),
      querySelector: (sel) => {
        for (const c of elements.values()) {
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.startsWith('.') && c.className.includes(sel.slice(1))) return c;
        }
        return null;
      },
      querySelectorAll: () => [],
      classList: { contains: (c) => className.split(' ').filter(Boolean).includes(c), toggle() {}, add() {}, remove() {} },
      set innerHTML(h) {
        innerHTML = String(h);
        const re = /<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)\/?>/g;
        for (const m of innerHTML.matchAll(re)) {
          const id = m[3] || m[7];
          if (!id) continue;
          const child = getOrCreateElement(id, m[1] || m[5]);
          child.setAttribute('id', id);
        }
      },
      get innerHTML() { return innerHTML; },
      set textContent(t) { innerHTML = String(t); },
      get textContent() { return innerHTML; },
      set value(v) { value = String(v); },
      get value() { return value; },
      set className(c) { className = String(c); },
      get className() { return className; },
      disabled: false,
      dataset: {},
      addEventListener(e, h) { (listeners[e] ||= []).push(h); },
      trigger(e, d = {}) { for (const h of listeners[e] || []) h({ target: this, preventDefault() {}, ...d }); },
      focus() {}, select() {}
    });
    return elements.get(id);
  }

  const domDocument = {
    readyState: 'complete',
    getElementById: (id) => {
      if (id === 'status-bar') return statusBar;
      if (id === 'panel-indeks') return panelIndeks;
      return getOrCreateElement(id);
    },
    querySelector: (sel) => (sel === '.modal-overlay'
      ? (activeModals.length ? activeModals[activeModals.length - 1] : null) : null),
    querySelectorAll: () => [],
    createElement: (tag) => getOrCreateElement('dyn-' + Math.random().toString(36).slice(2, 8), tag),
    body: {
      appendChild(node) {
        if (node.className && String(node.className).includes('modal-overlay')) activeModals.push(node);
      },
      removeChild(node) {
        const i = activeModals.indexOf(node);
        if (i !== -1) activeModals.splice(i, 1);
      }
    },
    addEventListener(e, h) { (docListeners[e] ||= []).push(h); },
    trigger: (e, d) => { for (const h of docListeners[e] || []) h(d); }
  };

  const sandbox = {
    document: domDocument,
    localStorage: {
      getItem: (k) => { localStorageCalls.push(['getItem', k]); return null; },
      setItem: (k, v) => { localStorageCalls.push(['setItem', k, v]); },
      removeItem: (k) => { localStorageCalls.push(['removeItem', k]); },
      clear: () => { localStorageCalls.push(['clear']); }
    },
    fetch: fetchImpl || (async () => { throw new TypeError('Failed to fetch'); }),
    AbortController, setTimeout, clearTimeout, console, Date
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
    exports: sandbox.module.exports,
    state: sandbox.module.exports.state,
    getStatusText: () => statusText,
    getStatusClass: () => statusClass,
    getPanelHtml: () => panelHtml,
    localStorageCalls,
    async settle() {
      for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r));
    }
  };
}

const dataSah = { version: 1, items: [], todo: [], logs: [] };
const denganServer = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(dataSah) });

// ---------------------------------------------------------------------------

test('tanpa server, pesan menyebut pindex.exe', async () => {
  // Halaman yang dibuka langsung dari Explorer tidak punya server. Ini bukan
  // kondisi langka: orang bisa salah klik index.html. Pesannya harus memberi
  // tahu apa yang harus dilakukan, bukan menampilkan galat teknis.
  const env = createTestEnvironment();
  await env.settle();

  const pesan = env.getStatusText();
  assert.match(pesan, /pindex\.exe/,
    `pesan harus menyebut cara menjalankan yang benar, dapat: "${pesan}"`);
  assert.ok(!/undefined|Failed to fetch|\[object/i.test(pesan),
    `pesan tidak boleh menampilkan galat teknis, dapat: "${pesan}"`);
});

test('tanpa server, tidak ada data kosong yang ditampilkan seolah semua beres', async () => {
  const env = createTestEnvironment();
  await env.settle();

  // Menampilkan layar kosong tanpa penjelasan membuat user mengira datanya
  // hilang, lalu mulai mengetik ulang.
  const pesan = env.getStatusText();
  assert.notEqual(pesan, '', 'harus ada pesan di area status');
  assert.match(env.getStatusClass(), /error/,
    `pesan kegagalan harus ditandai error, dapat className: "${env.getStatusClass()}"`);
});

test('tidak ada fallback localStorage di seluruh frontend', async () => {
  // Ini penjaga utama. Kalau localStorage dipakai lagi, Lite tumbuh kembali
  // tanpa ada yang menyadarinya, dan data user bisa terpecah di dua tempat.
  const sumber = fs.readFileSync(appJsPath, 'utf8') + fs.readFileSync(adapterJsPath, 'utf8');

  const pemakai = [...sumber.matchAll(/localStorage\s*\.\s*(getItem|setItem|removeItem|clear)\b/g)]
    .map(m => m[1]);
  assert.deepEqual(pemakai, [],
    `frontend tidak boleh menyentuh localStorage, ditemukan: ${[...new Set(pemakai)].join(', ')}`);

  assert.ok(!/readLocal|writeLocal|STORAGE_KEY/.test(sumber),
    'fungsi localStorage (readLocal, writeLocal, STORAGE_KEY) harus hilang');
});

test('penyimpanan gagal tidak menulis ke tempat lain', async () => {
  // Server hidup untuk baca tapi menolak untuk tulis. Bila ada fallback,
  // data akan diam-diam tersimpan di tempat lain - dan user tidak tahu.
  let tulisDipanggil = false;
  const env = createTestEnvironment(async (url, opts) => {
    if (opts && opts.method === 'POST') {
      tulisDipanggil = true;
      return { ok: false, status: 500, text: async () => '' };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(dataSah) };
  });
  await env.settle();

  const berhasil = await env.exports.saveData({ version: 1, items: [{ id: 'x', title: 'Uji' }], todo: [], logs: [] });

  assert.equal(berhasil, false, 'simpan yang gagal harus melaporkan gagal');
  assert.equal(tulisDipanggil, true, 'permintaan tulis memang dikirim ke server');
  assert.deepEqual(env.localStorageCalls, [],
    `tidak boleh ada tulisan ke localStorage, terjadi: ${JSON.stringify(env.localStorageCalls)}`);
});

test('area status menyebut nama aplikasi, bukan nama jalur', async () => {
  const env = createTestEnvironment(denganServer);
  await env.settle();

  const teks = env.getStatusText();
  assert.ok(teks.includes('PINDEX'),
    `area status harus menyebut nama aplikasi, dapat: "${teks}"`);
  assert.ok(!/\bLite\b/.test(teks),
    `tidak boleh lagi menyebut jalur Lite, dapat: "${teks}"`);
});

test('formatStatus tidak lagi menerima argumen jalur', () => {
  // Signature-nya berubah karena tidak ada dua jalur lagi. Test ini menjaga
  // supaya tidak ada pemanggil lama yang diam-diam mengirim argumenExtra.
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterJsPath, 'utf8'), sandbox);
  const adapter = sandbox.module.exports;

  assert.equal(adapter.formatStatus.length, 3,
    'formatStatus harus menerima tiga argumen: jumlah item, jam simpan, status memuat');
});
