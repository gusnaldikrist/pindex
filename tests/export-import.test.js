import test from 'node:test';
import { buatBackendPalsu } from './helpers/fake-backend.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve('.');
const exampleJsonPath = path.join(repoRoot, 'src', 'shared', 'data.example.json');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const searchJsPath = path.join(repoRoot, 'src', 'frontend', 'search.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');
const styleCssPath = path.join(repoRoot, 'src', 'frontend', 'style.css');
const indexHtmlPath = path.join(repoRoot, 'src', 'frontend', 'index.html');

async function readDownloadJson(download) {
  assert.ok(download.blob, 'Link unduhan harus membawa Blob berisi JSON');
  return JSON.parse(await download.blob.text());
}

function createTestEnvironment(initialData = null) {
  const elements = new Map();
  const docListeners = {};
  const downloads = [];
  const pickedFiles = [];
  let lastCreatedBlob = null;

  function createElementObj(id, tagName = 'div') {
    let innerHTML = '';
    let textContent = '';
    let className = '';
    let val = '';
    let style = { display: '' };
    let disabled = false;
    const listeners = {};
    const attributes = new Map();

    const el = {
      tagName: tagName.toUpperCase(),
      id,
      listeners,
      style,
      getAttribute: (attr) => {
        if (attr === 'id') return id;
        return attributes.get(attr) || null;
      },
      setAttribute: (attr, v) => {
        attributes.set(attr, String(v));
      },
      removeAttribute: (attr) => {
        attributes.delete(attr);
      },
      closest: (sel) => {
        if (sel === '.modal-overlay' && className.includes('modal-overlay')) return el;
        if (sel === '.modal-box' && className.includes('modal-box')) return el;
        return null;
      },
      querySelector: (sel) => {
        for (const child of elements.values()) {
          if (sel.startsWith('#') && child.id === sel.slice(1)) return child;
          if (sel.startsWith('.') && child.className.includes(sel.slice(1))) return child;
        }
        return null;
      },
      querySelectorAll: (sel) => {
        const results = [];
        for (const child of elements.values()) {
          if (sel.startsWith('.') && child.className.includes(sel.slice(1))) results.push(child);
        }
        return results;
      },
      classList: {
        contains: (cls) => className.split(' ').filter(Boolean).includes(cls),
        toggle: (cls, force) => {
          const classes = new Set(className.split(' ').filter(Boolean));
          if (force) classes.add(cls); else classes.delete(cls);
          className = Array.from(classes).join(' ');
        },
        add: (cls) => {
          const classes = new Set(className.split(' ').filter(Boolean));
          classes.add(cls);
          className = Array.from(classes).join(' ');
        },
        remove: (cls) => {
          const classes = new Set(className.split(' ').filter(Boolean));
          classes.delete(cls);
          className = Array.from(classes).join(' ');
        }
      },
      set innerHTML(htmlStr) {
        innerHTML = String(htmlStr);
        // Cocok tag yang punya id maupun yang hanya punya class, supaya
// getElementById dan querySelector('.class') sama-sama bisa menemukan elemen
const tagRegex = /<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)\/?>|<([a-zA-Z0-9]+)([^>]*\bclass="([^"]+)"[^>]*)\/?>/g;
        for (const m of innerHTML.matchAll(tagRegex)) {
          const attrs = m[2] || m[6] || m[9];
          const childTag = m[1] || m[5] || m[8];
          const childId = m[3] || m[7] || null;
          const classMatch = attrs.match(/\bclass="([^"]+)"/);
          // Daftarkan juga elemen yang hanya punya class (tanpa id) agar
          // overlay.querySelector('.nama-class') bisa menemukannya
          const firstClass = classMatch ? classMatch[1].split(' ')[0] : null;
          const key = childId || (firstClass ? 'class:' + firstClass : null);
          if (key) {
            const child = getOrCreateElement(key, childTag);
            if (childId) child.setAttribute('id', childId);
            if (classMatch) child.className = classMatch[1];
            child.disabled = /\bdisabled\b/.test(attrs);
          }
        }
      },
      get innerHTML() { return innerHTML; },
      set textContent(text) { textContent = String(text); },
      get textContent() { return textContent; },
      set className(classes) { className = String(classes); },
      get className() { return className; },
      set value(v) { val = String(v); },
      get value() { return val; },
      set disabled(stateVal) { disabled = Boolean(stateVal); },
      get disabled() { return disabled; },
      dataset: {},
      addEventListener: (evt, handler) => {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(handler);
      },
      removeEventListener: (evt, handler) => {
        if (!listeners[evt]) return;
        listeners[evt] = listeners[evt].filter(h => h !== handler);
      },
      trigger: (evt, evtData = {}) => {
        if (listeners[evt]) {
          listeners[evt].forEach(h => { h({ target: el, preventDefault: () => {}, ...evtData }); });
        }
      },
      click: () => {
        if (listeners['click']) {
          listeners['click'].forEach(h => { h({ target: el, preventDefault: () => {} }); });
        }
      },
      focus: () => {},
      select: () => {}
    };

    return el;
  }

  function getOrCreateElement(id, tagName = 'div') {
    if (!elements.has(id)) elements.set(id, createElementObj(id, tagName));
    return elements.get(id);
  }

  const panelIndeks = getOrCreateElement('panel-indeks', 'section');
  const panelTodo = getOrCreateElement('panel-todo', 'section');
  const panelLog = getOrCreateElement('panel-log', 'section');

  const tabIndeks = getOrCreateElement('tab-indeks', 'button');
  tabIndeks.setAttribute('data-tab', 'indeks');
  const tabTodo = getOrCreateElement('tab-todo', 'button');
  tabTodo.setAttribute('data-tab', 'todo');
  const tabLog = getOrCreateElement('tab-log', 'button');
  tabLog.setAttribute('data-tab', 'log');

  getOrCreateElement('status-bar');
  getOrCreateElement('btn-export-json', 'button');
  getOrCreateElement('btn-import-json', 'button');
  getOrCreateElement('import-file-input', 'input');

  const activeModals = [];

  const domDocument = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel === '.modal-overlay') {
        return activeModals.length > 0 ? activeModals[activeModals.length - 1] : null;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.nav-tab-btn') return [tabIndeks, tabTodo, tabLog];
      if (sel === '.tab-panel') return [panelIndeks, panelTodo, panelLog];
      return [];
    },
    createElement: (tag) => createElementObj('dynamic-' + Math.random().toString(36).substring(7), tag),
    body: {
      appendChild: (node) => {
        if (node.tagName === 'A') {
          // Blob disimpan di map agar test bisa membaca isi JSON-nya,
          // meniru perilaku browser di mana href hanya berisi blob URL
          const blob = lastCreatedBlob;
          lastCreatedBlob = null;
          downloads.push({ href: node.href, download: node.download, blob });
        }
        if (node.className && node.className.includes('modal-overlay')) {
          activeModals.push(node);
          node.parentNode = domDocument.body;
        }
      },
      removeChild: (node) => {
        const idx = activeModals.indexOf(node);
        if (idx !== -1) {
          activeModals.splice(idx, 1);
          node.parentNode = null;
          return;
        }
        // Elemen non-modal (mis. tautan unduhan) juga harus bisa dilepas
        if (node.parentNode) node.parentNode = null;
      }
    },
    readyState: 'complete',
    addEventListener: (evt, handler) => {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(handler);
    },
    removeEventListener: () => {},
    trigger: (evt, data) => {
      if (docListeners[evt]) docListeners[evt].forEach(h => { h(data); });
    }
  };

  const store = {};
  const backend = buatBackendPalsu(store);
  if (initialData) store['indeks_v1'] = JSON.stringify(initialData);

  const sandbox = {
    document: domDocument,
    localStorage: {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => { delete store[k]; }); }
    },
    navigator: { clipboard: { writeText: async () => Promise.resolve() } },
    Blob: class FakeBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = (options && options.type) || '';
        this.text = async () => this.parts.join('');
        lastCreatedBlob = this;
      }
    },
    URL: {
      createObjectURL: () => 'blob:fake-url-123',
      revokeObjectURL: () => {}
    },
    console,
    Date,
    setTimeout,
    clearTimeout,
    // Environment minimal untuk storage-adapter.js (Tiket 11).
    // Backend palsu dari helper: aplikasi hanya punya satu jalur, jadi
    // halaman yang siap selalu menghubungi server.
    fetch: backend.fetch,
    AbortController
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // app.js mengekspor API lewat module.exports (pola sejak tiket 02); test
  // butuh state untuk memeriksa saringan yang direset setelah import.
  sandbox.module = { exports: {} };

  vm.runInContext(fs.readFileSync(searchJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(adapterJsPath, 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(appJsPath, 'utf8'), sandbox);

  const appExports = sandbox.module.exports;

  // Simulasikan pemilihan berkas oleh user: isi input file lalu picu change.
  // Mengembalikan promise karena pembacaan teks berkas bersifat async.
  async function pickFile(content, fileName = 'data.json') {
    const input = getOrCreateElement('import-file-input');
    const fileObj = {
      name: fileName,
      text: async () => (typeof content === 'string' ? content : JSON.stringify(content))
    };
    input.files = [fileObj];
    input.value = 'C:\\fake\\' + fileName;
    pickedFiles.push(fileObj);
    // Gunakan elemen input asli sebagai event.target supaya perubahan
    // `fileInput.value` oleh app.js benar-benar terlihat di sini
    input.trigger('change', { target: input });
    // Beri event loop agar handler async selesai memproses berkas
    await new Promise(resolve => setImmediate(resolve));
  }

  return {
    sandbox,
    state: appExports.state,
    getOrCreateElement,
    downloads,
    pickedFiles,
    pickFile,
    activeModals,
    store,
    triggerDoc: domDocument.trigger
  };
}

test('Tiket 09 - Export: nama berkas memuat tanggal hari ini dan isi berkas utuh', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.exportDataAsJson();

  assert.equal(env.downloads.length, 1, 'Harus ada satu tautan unduhan');
  const link = env.downloads[0];

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(link.download, `indeks-data-${stamp}.json`, 'Nama berkas harus indeks-data-YYYYMMDD.json');

  const exported = await readDownloadJson(link);
  assert.equal(exported.version, exampleData.version, 'Penanda version harus ikut apa adanya');
  assert.equal(exported.items.length, 4, 'Ekspor 4 item');
  assert.equal(exported.todo.length, 1, 'Ekspor 1 todo');
  assert.equal(exported.logs.length, 1, 'Ekspor 1 log');
  assert.ok(!('pinned_tags' in exported), 'Field yang sudah dibuang tidak ikut diekspor');
});

test('Tiket 09 - Export lalu Import: data pulih utuh (simulasi profil browser lain)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));

  // Profil A: ekspor
  const envA = createTestEnvironment(exampleData);
  // init() memuat data secara async; tunggu supaya selesai sebelum ekspor,
  // kalau tidak state.data masih kosong saat diekspor.
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  envA.sandbox.exportDataAsJson();
  const exportedJson = await envA.downloads[0].blob.text();

  // Profil B: localStorage kosong, lalu import berkas hasil ekspor.
  // init() membaca localStorage secara async; tanpa menunggu, pembacaan
  // awal bisa menimpa data yang baru saja diimpor.
  const envB = createTestEnvironment(null);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  envB.sandbox.switchTab('indeks');
  await envB.pickFile(exportedJson);

  // Konfirmasi import
  assert.equal(envB.activeModals.length, 1, 'Harus muncul modal konfirmasi import');
  envB.getOrCreateElement('btn-confirm-import').trigger('click');

  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(envB.activeModals.length, 0, 'Modal tertutup setelah import');

  const restored = JSON.parse(envB.store['indeks_v1']);
  assert.equal(restored.items.length, 4, '4 item pulih');
  assert.equal(restored.todo.length, 1, '1 todo pulih');
  assert.equal(restored.logs.length, 1, '1 log pulih');
  assert.ok(!('pinned_tags' in restored), 'Field yang dibuang tidak ikut pulih');
  assert.equal(restored.items[0].title, 'SLiMS Bulian', 'Isi item tidak berubah');
  assert.equal(restored.version, exampleData.version, 'Version ikut terpulih');
});

test('Tiket 09 - Import berkas tidak sah: items bukan array ditolak dan data lama utuh', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile({ version: 1, items: 'bukan array', todo: [], logs: [] });

  assert.equal(env.activeModals.length, 1, 'Harus muncul modal penolakan');
  const modalHtml = env.activeModals[0].innerHTML;
  assert.match(modalHtml, /items/, 'Pesan harus menyebut items');
  assert.match(modalHtml, /array/i, 'Pesan harus menyebut array');

  // Modal yang muncul harus PENOLAKAN, bukan konfirmasi import.
  // Tanpa assert ini, test akan tetap hijau walau validasi dilewati.
  assert.ok(
    !modalHtml.includes('btn-confirm-import'),
    'Modal penolakan tidak boleh punya tombol Impor dan Ganti'
  );
  assert.ok(
    !modalHtml.includes('Impor dan Ganti'),
    'Modal penolakan tidak boleh menawarkan replacement data'
  );

  // Data lama harus tetap utuh. Perhatikan normalizeData() diam-diam mengubah
  // items non-array menjadi [], jadi assertion panjang saja tidak cukup.
  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 4, 'Data lama tidak boleh berubah');
  assert.equal(stored.items[0].title, 'SLiMS Bulian');
  assert.ok(
    Array.isArray(stored.items) && stored.items[0].links.length > 0,
    'Item lama tidak boleh diganti bentuknya oleh normalizeData'
  );
});

test('Tiket 09 - Import berkas rusak (bukan JSON) ditolak tanpa mengubah data', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile('{ ini bukan json');

  assert.equal(env.activeModals.length, 1, 'Harus muncul modal penolakan');
  assert.match(env.activeModals[0].innerHTML, /JSON/i, 'Pesan harus menyebut JSON');
  assert.ok(
    !env.activeModals[0].innerHTML.includes('btn-confirm-import'),
    'Modal penolakan tidak boleh punya tombol Impor dan Ganti'
  );

  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 4, 'Data lama utuh');
  assert.equal(stored.items[0].title, 'SLiMS Bulian');
});

test('Tiket 09 - Import berkas JSON bukan objek (mis. array) ditolak', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile([1, 2, 3]);

  assert.equal(env.activeModals.length, 1, 'Harus muncul modal penolakan');
  assert.ok(
    !env.activeModals[0].innerHTML.includes('btn-confirm-import'),
    'Array JSON harus ditolak, bukan dianggap data kosong yang sah'
  );

  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 4, 'Data lama utuh');
  assert.equal(stored.items[0].title, 'SLiMS Bulian', 'Data lama tidak berubah');
});

test('Tiket 09 - Import: pembatalan konfirmasi tidak mengubah data', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Berkas import sengaja BERBEDA dari data yang sekarang ada,
  // sehingga overwrite pasti terdeteksi kalau tombol Batal salah sambung.
  const otherData = {
    version: 1,
    items: [{ id: 'lain', title: 'ITEM DARI BERKAS LAIN', tags: ['x'], links: [{ label: 'buka', url: 'https://contoh.test' }], catatan: '', updated_at: '2026-01-01' }],
    todo: [],
    logs: []
  };

  env.sandbox.switchTab('indeks');
  await env.pickFile(otherData);

  assert.equal(env.activeModals.length, 1, 'Harus muncul modal konfirmasi');
  assert.match(env.activeModals[0].innerHTML, /btn-confirm-import/, 'Modal harus menampilkan konfirmasi import');

  // Klik lewat elemen yang sama persis dengan yang dicari app.js
  const cancelBtn = env.activeModals[0].querySelector('.btn-cancel-import');
  assert.ok(cancelBtn, 'Tombol Batal harus ada di modal konfirmasi');
  cancelBtn.trigger('click');
  assert.equal(env.activeModals.length, 0, 'Modal tertutup');

  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 4, 'Data lama harus tetap 4 item');
  assert.ok(
    !stored.items.some(item => item.title === 'ITEM DARI BERKAS LAIN'),
    'Isi berkas import TIDAK boleh masuk setelah pembatalan'
  );
});

test('Tiket 09 - Import dari keadaan kosong: tombol Import JSON benar-benar membuka pemilih berkas', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(null);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  const panelHtml = env.getOrCreateElement('panel-indeks').innerHTML;
  assert.match(panelHtml, /btn-empty-import/, 'Keadaan kosong harus punya tombol Import JSON');

  // Klik tombolnya, bukan sekadar memanggil pickFile: kalau listener-nya
  // belum terpasang, test ini harus gagal.
  let filePickerOpened = false;
  const fileInput = env.getOrCreateElement('import-file-input');
  fileInput.click = () => { filePickerOpened = true; };

  env.getOrCreateElement('btn-empty-import').trigger('click');
  assert.ok(filePickerOpened, 'Tombol Import JSON di keadaan kosong harus membuka pemilih berkas');

  await env.pickFile(exampleData);
  assert.equal(env.activeModals.length, 1, 'Harus muncul konfirmasi');

  env.getOrCreateElement('btn-confirm-import').trigger('click');
  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 4, 'Data hasil import tersimpan');
});

test('Tiket 09 - Tombol Import di top-bar juga membuka pemilih berkas', async () => {
  const env = createTestEnvironment({ version: 1, items: [], todo: [], logs: [] });
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  let opened = false;
  env.getOrCreateElement('import-file-input').click = () => { opened = true; };

  env.getOrCreateElement('btn-import-json').trigger('click');
  assert.ok(opened, 'Tombol Import di top-bar harus membuka pemilih berkas');
});

test('Tiket 09 - Tombol Export di top-bar memang mengunduh berkas', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.getOrCreateElement('btn-export-json').trigger('click');

  assert.equal(env.downloads.length, 1, 'Klik tombol Export harus menghasilkan satu unduhan');
  assert.match(env.downloads[0].download, /^indeks-data-\d{8}\.json$/, 'Nama berkas harus sesuai pola');
});

test('Tiket 09 - Konfirmasi import warns bahwa seluruh data ditimpa', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile(exampleData);

  const modalHtml = env.activeModals[0].innerHTML;
  assert.match(modalHtml, /menimpa|seluruh data/i, 'Modal harus memperingatkan bahwa seluruh data ditimpa');
  assert.equal(env.activeModals[0].getAttribute('role'), 'dialog', 'Modal harus punya role="dialog"');
  assert.equal(env.activeModals[0].getAttribute('aria-modal'), 'true', 'Modal harus punya aria-modal');
});

test('Tiket 09 - Escape tidak menutup modal konfirmasi import', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile(exampleData);
  assert.equal(env.activeModals.length, 1);

  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Escape tidak boleh menutup modal (wireframe bagian 8)');
});

test('Tiket 09 - Import: nilai input file dikosongkan agar berkas sama bisa dipilih ulang', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('indeks');
  await env.pickFile({ version: 1, items: 'bukan array', todo: [], logs: [] });
  env.getOrCreateElement('btn-tutup-penolakan').trigger('click');

  assert.equal(
    env.getOrCreateElement('import-file-input').value,
    '',
    'Input file harus dikosongkan setelah diproses'
  );
});

test('Tiket 09 - Tombol Export dan Import ada di top-bar', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(html, /id="btn-export-json"/, 'Tombol Export harus ada');
  assert.match(html, /id="btn-import-json"/, 'Tombol Import harus ada');
  assert.match(html, /id="import-file-input"/, 'Input file tersembunyi harus ada');
  assert.match(html, /type="file"/, 'Harus ada input[type=file]');
  assert.match(html, /accept="application\/json,\.json"/, 'Input file dibatasi ke JSON');

  // Input file harus tersembunyi, bukan tombol terlihat
  const fileInputTag = html.match(/<input[^>]*id="import-file-input"[^>]*>/)[0];
  assert.match(fileInputTag, /file-input-hidden/, 'Input file harus memakai class yang menyembunyikannya');
});

test('Tiket 09 - CSS: tombol top-bar dan modal pesan memakai token resmi', () => {
  const css = fs.readFileSync(styleCssPath, 'utf8');
  assert.ok(!css.includes('var(--surface)'), 'Tidak boleh ada token fiktif');

  assert.match(css, /\.top-bar-actions\s*\{/, 'Blok .top-bar-actions harus ada');
  assert.match(css, /\.file-input-hidden\s*\{/, 'Blok .file-input-hidden harus ada');
});

test('Tiket 09 - Bentuk data hasil Export sama persis dengan data.example.json', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.exportDataAsJson();
  const exported = await readDownloadJson(env.downloads[0]);

  assert.deepEqual(
    Object.keys(exported).sort(),
    ['items', 'logs', 'todo', 'version'],
    'Kunci hasil Export harus sama dengan skema berkas (ticket langkah 4: dapat dipakai jalur Pro)'
  );
});

// Cakupan validasi: setiap field tingkat atas wajib diperiksa satu per satu.
// Kalau hanya `items` yang diuji, mutasi yang menghapus field lain lolos.
test('Tiket 09 - Validasi import: setiap field tingkat atas wajib berupa array', async () => {
  const env = createTestEnvironment(null);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { validateImportedData } = env.sandbox;

  const base = { version: 1, items: [], todo: [], logs: [] };

  for (const fieldName of ['items', 'todo', 'logs']) {
    const broken = { ...base, [fieldName]: 'bukan array' };
    const result = validateImportedData(broken);
    assert.equal(result.valid, false, `"${fieldName}" non-array harus ditolak`);
    assert.match(result.error, new RegExp(fieldName), `Pesan harus menyebut "${fieldName}"`);
  }

  // Field yang dihapus juga harus ditolak, bukan dianggap tidak ada
  for (const fieldName of ['items', 'todo', 'logs']) {
    const missing = { ...base };
    delete missing[fieldName];
    const result = validateImportedData(missing);
    assert.equal(result.valid, false, `Field "${fieldName}" yang hilang harus ditolak`);
  }

  // Bentuk sah diterima
  assert.equal(validateImportedData(base).valid, true, 'Bentuk sah harus diterima');
});

test('Tiket 09 - Validasi import: version harus berupa angka dan bernilai 1', async () => {
  const env = createTestEnvironment(null);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { validateImportedData } = env.sandbox;

  const base = { version: 1, items: [], todo: [], logs: [] };

  const missingVersion = { ...base };
  delete missingVersion.version;
  assert.equal(validateImportedData(missingVersion).valid, false, 'version yang hilang harus ditolak');

  const stringVersion = { ...base, version: '1' };
  const result = validateImportedData(stringVersion);
  assert.equal(result.valid, false, 'version string harus ditolak, bukan diterima diam-diam');
  assert.match(result.error, /version/, 'Pesan harus menyebut version');

  // spec kontrak 5: frontend dan backend harus menerima bentuk berkas yang
  // sama, jadi frontend juga menolak version angka yang bukan 1.
  const futureVersion = { ...base, version: 99 };
  const futureResult = validateImportedData(futureVersion);
  assert.equal(futureResult.valid, false, 'version 99 harus ditolak, sama seperti ditolak backend');
  assert.match(futureResult.error, /version/, 'Pesan harus menyebut version');
});

test('Tiket 09 - Pesan penolakan di-escape agar data tak bisa injecting HTML', async () => {
  const env = createTestEnvironment(null);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  env.sandbox.switchTab('indeks');

  // Nama field dicek lebih dulu, jadi pesan memuat nama field apa adanya.
  // Nama field itu berasal dari daftar tetap di validateImportedData, bukan
  // dari isi berkas; test ini mengunci bahwa isinya tetap di-escape.
  return env.pickFile({ version: 1, items: {}, todo: [], logs: [] }).then(() => {
    const modalHtml = env.activeModals[0].innerHTML;
    assert.ok(
      !modalHtml.includes('<img src=x'),
      'Tidak boleh ada HTML mentah di modal penolakan'
    );
    // Pesan wajib menyebut field bermasalah dan tetap ter-escape
    assert.match(modalHtml, /items/, 'Pesan menyebut field yang salah');
    assert.match(modalHtml, /&quot;items&quot;/, 'Nama field harus muncul sebagai entity, bukan markup');
  });
});

test('Tiket 02 - Import: fokus baris ikut dibersihkan dan item baru tampil utuh', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // loadData async saat halaman siap
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Berkas baru tidak punya tag 'ta' sama sekali
  const otherData = {
    version: 1,
    items: [{ id: 'baru', title: 'Item Baru', tags: ['lain'], links: [{ label: 'buka', url: 'https://contoh.test' }], catatan: '', updated_at: '2026-01-01' }],
    todo: [],
    logs: []
  };

  env.sandbox.switchTab('indeks');
  env.state.focusedItemId = 'slims-bulian';

  await env.pickFile(otherData);
  env.getOrCreateElement('btn-confirm-import').trigger('click');
  // Import memicu simpan lewat backend yang async, lalu render ulang
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Fokus baris bisa menunjuk item yang tidak ada lagi di berkas baru, kalau
  // tidak panel menampilkan konteks item lama padahal isinya sudah diganti.
  assert.equal(env.state.focusedItemId, null, 'Fokus baris harus dilepas setelah import');

  const resultList = env.getOrCreateElement('result-list').innerHTML;
  assert.match(resultList, /Item Baru/, 'Item hasil import harus tampil');
});

test('Tiket 09 - Export: revokeObjectURL ditunda agar unduhan tidak dibatalkan', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const revokedUrls = [];
  env.sandbox.URL.revokeObjectURL = (url) => { revokedUrls.push(url); };

  env.sandbox.exportDataAsJson();
  assert.equal(revokedUrls.length, 0, 'revokeObjectURL tidak boleh sinkron setelah click');

  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(revokedUrls.length, 1, 'Blob URL harus dilepas setelah gilir render selesai');
});
// Field pinned_tags dibuang pada tiket 03. Dua arah harus tetap jalan:
// berkas baru yang tidak memuatnya, dan berkas versi lama yang masih memuatnya.
test('Tiket 03 - Import menerima berkas tanpa pinned_tags', async () => {
  const env = createTestEnvironment({ version: 1, items: [], todo: [], logs: [] });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  await env.pickFile({
    version: 1,
    items: [{ id: 'baru', title: 'Item Tanpa Pinned', tags: ['x'], links: [], catatan: '', updated_at: '2026-10-03' }],
    todo: [],
    logs: []
  });
  env.getOrCreateElement('btn-confirm-import').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 1, 'Berkas tanpa pinned_tags harus diterima dan tersimpan');
  assert.equal(stored.items[0].title, 'Item Tanpa Pinned', 'Isi berkas harus utuh');
});

test('Tiket 03 - Berkas versi lama dengan pinned_tags tetap diimpor dan field itu dibuang', async () => {
  const env = createTestEnvironment({ version: 1, items: [], todo: [], logs: [] });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  await env.pickFile({
    version: 1,
    items: [{ id: 'lama', title: 'Item Versi Lama', tags: ['ta'], links: [], catatan: '', updated_at: '2026-10-03' }],
    todo: [],
    logs: []
  });
  env.getOrCreateElement('btn-confirm-import').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const stored = JSON.parse(env.store['indeks_v1']);
  assert.equal(stored.items.length, 1, 'Berkas versi lama tidak boleh ditolak');
  assert.equal(stored.items[0].title, 'Item Versi Lama', 'Data versi lama harus utuh');
  assert.ok(!('pinned_tags' in stored),
    'Field yang dibuang tidak boleh ikut tersimpan ulang; ia hilang sendiri saat simpan');
});

// Tanpa contoh data, Import mustahil dipakai siapa pun yang belum punya
// cadangan: berkasnya wajib punya bentuk tertentu dan tidak ada yang
// memberitahu bentuk itu. Contohnya sudah ada di paket rilis, tapi sebelumnya
// tidak terjangkau dari layar.
test('Tiket 09 - Tombol Unduh contoh ada dan mengunduh berkas contoh', async () => {
  const html = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'index.html'), 'utf8');
  assert.match(html, /id="btn-contoh-json"/, 'Harus ada tombol Unduh contoh');
  assert.match(html, /Contoh/i, 'Tombol harus menyebut Contoh');

  const env = createTestEnvironment({ version: 1, items: [], todo: [], logs: [] });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.unduhContohData();

  assert.equal(env.downloads.length, 1, 'Tombol contoh harus memicu satu unduhan');
  assert.match(env.downloads[0].download, /contoh/i, 'Nama berkas harus menyebut contoh');
  assert.match(env.downloads[0].href, /data\.example\.json/, 'Unduhan harus menunjuk berkas contoh');
});

test('Tiket 09 - Tombol Export diberi nama yang menjelaskan tugasnya', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'index.html'), 'utf8');
  assert.match(html, /id="btn-export-json"[\s\S]{0,400}?Cadangkan/i,
    'Tombol Export harus diberi nama Cadangkan, bukan istilah yang tidak berarti apa-apa');
});

test('Tiket 09 - Penolakan import memberi petunjuk yang bisa ditindaklanjuti', async () => {
  const env = createTestEnvironment({ version: 1, items: [], todo: [], logs: [] });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Berkas JSON yang valid tapi salah bentuk: penolakan yang paling sering
  // muncul dan paling tidak bisa ditindaklanjuti tanpa petunjuk.
  await env.pickFile({ version: 1, items: 'bukan array', todo: [], logs: [] });
  const konfirm = env.getOrCreateElement('btn-confirm-import');
  if (konfirm && konfirm.trigger) konfirm.trigger('click');
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(env.activeModals.length > 0, 'Penolakan harus membuka modal');

  const isi = env.activeModals.map(m => m.innerHTML).join('\n');
  assert.match(isi, /Cadangkan/i,
    'Modal penolakan harus menyebut dari mana berkas yang benar itu berasal');
  assert.match(isi, /Contoh/i,
    'Modal penolakan harus menawarkan jalan mendapatkan berkas contoh');
  assert.match(isi, /tidak berubah/i,
    'Modal penolakan harus menyebut data yang sudah ada tidak berubah');
});
