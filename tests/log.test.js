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

function createTestEnvironment(initialData = null) {
  const elements = new Map();
  const docListeners = {};

  function createElementObj(id, tagName = 'div') {
    let innerHTML = '';
    let textContent = '';
    let className = '';
    let val = '';
    let style = { display: '' };
    let disabled = false;
    let checked = false;
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
        if (sel === '.log-item' && className.includes('log-item')) return el;
        if (sel === '.btn-ubah-log' && className.includes('btn-ubah-log')) return el;
        if (sel === '.btn-hapus-log' && className.includes('btn-hapus-log')) return el;
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
          if (sel.startsWith('.') && child.className.includes(sel.slice(1))) {
            results.push(child);
          }
        }
        return results;
      },
      classList: {
        contains: (cls) => className.split(' ').filter(Boolean).includes(cls),
        toggle: (cls, force) => {
          const classes = new Set(className.split(' ').filter(Boolean));
          if (force === undefined) {
            if (classes.has(cls)) classes.delete(cls);
            else classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
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
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)\/?>/g;
        for (const m of innerHTML.matchAll(tagRegex)) {
          const childTag = m[1] || m[5];
          const attrs = m[2] || m[6];
          const childId = m[3] || m[7];
          if (childId) {
            const child = getOrCreateElement(childId, childTag);
            const classMatch = attrs.match(/\bclass="([^"]+)"/);
            if (classMatch) child.className = classMatch[1];
            const dataIdMatch = attrs.match(/\bdata-id="([^"]+)"/);
            if (dataIdMatch) child.setAttribute('data-id', dataIdMatch[1]);
            child.disabled = /\bdisabled\b/.test(attrs);
          }
        }
      },
      get innerHTML() {
        return innerHTML;
      },
      set textContent(text) {
        textContent = String(text);
      },
      get textContent() {
        return textContent;
      },
      set className(classes) {
        className = String(classes);
      },
      get className() {
        return className;
      },
      set value(v) {
        val = String(v);
      },
      get value() {
        return val;
      },
      set disabled(stateVal) {
        disabled = Boolean(stateVal);
      },
      get disabled() {
        return disabled;
      },
      set checked(checkedVal) {
        checked = Boolean(checkedVal);
      },
      get checked() {
        return checked;
      },
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
          listeners[evt].forEach((h) => {
            h({
              target: el,
              preventDefault: () => {},
              stopPropagation: () => {},
              ...evtData
            });
          });
        }
      },
      focus: () => {},
      select: () => {}
    };

    return el;
  }

  function getOrCreateElement(id, tagName = 'div') {
    if (!elements.has(id)) {
      elements.set(id, createElementObj(id, tagName));
    }
    return elements.get(id);
  }

  // Panggilannya tetap perlu walau hasilnya tidak dipakai: di DOM palsu,
  // satu-satunya cara membuat elemen adalah memintanya.
  getOrCreateElement('status-bar');
  const panelIndeks = getOrCreateElement('panel-indeks', 'section');
  const panelTodo = getOrCreateElement('panel-todo', 'section');
  const panelLog = getOrCreateElement('panel-log', 'section');

  const tabIndeks = getOrCreateElement('tab-indeks', 'button');
  tabIndeks.setAttribute('data-tab', 'indeks');
  const tabTodo = getOrCreateElement('tab-todo', 'button');
  tabTodo.setAttribute('data-tab', 'todo');
  const tabLog = getOrCreateElement('tab-log', 'button');
  tabLog.setAttribute('data-tab', 'log');

  getOrCreateElement('log-search-input', 'input');
  getOrCreateElement('log-date-from', 'input');
  getOrCreateElement('log-date-sampai', 'input');
  getOrCreateElement('btn-catat-log', 'button');
  getOrCreateElement('log-list');

  const activeModals = [];

  const domDocument = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel === '.modal-overlay') {
        return activeModals.length > 0 ? activeModals[activeModals.length - 1] : null;
      }
      if (sel === '#log-search-input') return getOrCreateElement('log-search-input');
      if (sel === '#log-list') return getOrCreateElement('log-list');
      if (sel === '#panel-log') return getOrCreateElement('panel-log');
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.nav-tab-btn') return [tabIndeks, tabTodo, tabLog];
      if (sel === '.tab-panel') return [panelIndeks, panelTodo, panelLog];
      return [];
    },
    createElement: (tag) => {
      const modalEl = createElementObj('dynamic-' + Math.random().toString(36).substring(7), tag);
      return modalEl;
    },
    body: {
      appendChild: (node) => {
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
        }
      }
    },
    readyState: 'complete',
    addEventListener: (evt, handler) => {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(handler);
    },
    removeEventListener: (evt, handler) => {
      if (!docListeners[evt]) return;
      docListeners[evt] = docListeners[evt].filter(h => h !== handler);
    },
    trigger: (evt, data) => {
      if (docListeners[evt]) {
        docListeners[evt].forEach((h) => { h(data); });
      }
    }
  };

  const store = {};
  const backend = buatBackendPalsu(store);
  if (initialData) {
    store['indeks_v1'] = JSON.stringify(initialData);
  }

  const sandbox = {
    document: domDocument,
    localStorage: {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); }
    },
    navigator: {
      clipboard: {
        writeText: async () => Promise.resolve()
      }
    },
    // Environment minimal untuk storage-adapter.js (Tiket 11).
    // Backend palsu dari helper: aplikasi hanya punya satu jalur, jadi
    // halaman yang siap selalu menghubungi server.
    fetch: backend.fetch,
    AbortController,
    setTimeout, clearTimeout,
    console,
    Date
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  const searchJs = fs.readFileSync(searchJsPath, 'utf8');
  vm.runInContext(searchJs, sandbox);

  const appJs = fs.readFileSync(appJsPath, 'utf8');
  const adapterJs = fs.readFileSync(adapterJsPath, 'utf8');
  vm.runInContext(adapterJs, sandbox);
  vm.runInContext(appJs, sandbox);

  return {
    sandbox,
    getOrCreateElement,
    panelLog,
    logList: getOrCreateElement('log-list'),
    activeModals,
    store,
    triggerDoc: domDocument.trigger
  };
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Urutan render dibaca dari data-id pada baris daftar yang benar-benar dirender.
// Dipakai daripada indexOf karena indexOf mengembalikan -1 saat tidak ditemukan,
// sehingga perbandingan indexOf bisa lulus walau entri tidak dirender sama sekali.
// Dicocokkan ke class log-item supaya tombol Ubah/Hapus di dalam baris tidak ikut terhitung.
function getRenderedLogIds(logListElement) {
  return Array.from(logListElement.innerHTML.matchAll(/class="log-item" data-id="([^"]+)"/g))
    .map(match => match[1]);
}

test('Tiket 08 - Render awal tab Log dari data.example.json', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('log');

  const logList = env.getOrCreateElement('log-list');
  assert.match(logList.innerHTML, /2026-09-29/, 'Kolom tanggal harus tampil');
  assert.match(logList.innerHTML, /Input 20 data/, 'Teks log l1 harus muncul');

  assert.match(logList.innerHTML, /log-date-cell/, 'Tanggal harus memakai kolom tetap di kiri');
  assert.match(logList.innerHTML, /btn-ubah-log/, 'Tombol Ubah harus ada');
  assert.match(logList.innerHTML, /btn-hapus-log/, 'Tombol Hapus harus ada');
});

test('Tiket 08 - Tab Log dibuka pertama kali: kedua kotak tanggal kosong dan seluruh entri tampil', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('log');

  const dateFrom = env.getOrCreateElement('log-date-from');
  const dateSampai = env.getOrCreateElement('log-date-sampai');

  assert.equal(dateFrom.value, '', 'Kotak Dari harus kosong saat tab dibuka pertama kali');
  assert.equal(dateSampai.value, '', 'Kotak Sampai harus kosong saat tab dibuka pertama kali');

  const logList = env.getOrCreateElement('log-list');
  assert.match(logList.innerHTML, /Input 20 data/, 'Seluruh entri harus tampil tanpa saringan tanggal');
});

test('Tiket 08 - Urutan tanggal menurun; tanggal sama diurutkan masukan terbaru', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterLogs } = env.sandbox;

  // Susunan array meniru app.js: entri masukan terbaru di-unshift ke depan
  const logs = [
    { id: 'l3', date: '2026-09-29', teks: 'Paling baru', item_id: null },
    { id: 'l2', date: '2026-09-28', teks: 'Agustus akhir', item_id: null },
    { id: 'l1', date: '2026-09-29', teks: 'Lebih lama di hari sama', item_id: null }
  ];

  const sorted = filterLogs(logs, '', '', '');
  assert.deepEqual(
    sorted.map(entry => entry.id),
    ['l3', 'l1', 'l2'],
    'Tanggal menurun; pada tanggal sama masukan terbaru (l3) harus di atas l1'
  );
});

test('Tiket 08 - Saringan rentang tanggal Dari dan Sampai', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterLogs } = env.sandbox;

  const logs = [
    { id: 'l3', date: '2026-09-30', teks: 'Di luar batas atas', item_id: null },
    { id: 'l2', date: '2026-09-15', teks: 'Di tengah rentang', item_id: null },
    { id: 'l1', date: '2026-08-31', teks: 'Di luar batas bawah', item_id: null }
  ];

  const hasil = filterLogs(logs, '', '2026-09-01', '2026-09-29');
  assert.deepEqual(hasil.map(entry => entry.id), ['l2'], 'Hanya entri dalam rentang yang tampil');

  const hasilDariSaja = filterLogs(logs, '', '2026-09-01', '');
  assert.deepEqual(hasilDariSaja.map(entry => entry.id), ['l3', 'l2'], 'Kotak Dari kosong untuk batas atas');

  const hasilSampaiSaja = filterLogs(logs, '', '', '2026-09-29');
  assert.deepEqual(hasilSampaiSaja.map(entry => entry.id), ['l2', 'l1'], 'Kotak Sampai kosong untuk batas bawah');

  assert.equal(filterLogs(logs, '', '', '').length, 3, 'Kedua kotak kosong menampilkan seluruh entri');
});

test('Tiket 08 - Saringan teks log: frasa berurutan dan case-insensitive (PRD 5.1)', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterLogs } = env.sandbox;

  const logs = [
    { id: 'l2', date: '2026-09-28', teks: 'Validasi draft TA', item_id: null },
    { id: 'l1', date: '2026-09-29', teks: 'Input 20 data', item_id: null }
  ];

  const hasil = filterLogs(logs, '  VALIDASI   draft  ', '', '');
  assert.deepEqual(hasil.map(entry => entry.id), ['l2'], 'Spasi berlebih diabaikan dan huruf besar-kecil diabaikan');

  const hasilTerbalik = filterLogs(logs, 'draft validasi', '', '');
  assert.equal(hasilTerbalik.length, 0, 'Frasa terbalik tidak boleh cocok');

  // Kata yang tidak berurutan (ada kata lain di antaranya) tidak boleh cocok
  const hasilTerputus = filterLogs(logs, 'validasi data', '', '');
  assert.equal(hasilTerputus.length, 0, 'Kata yang tidak berurutan tidak boleh cocok');

  const hasilKosong = filterLogs(logs, '   ', '', '');
  assert.equal(hasilKosong.length, 2, 'Kata kunci kosong tidak menyaring apa pun');
});

test('Tiket 08 - Saringan log bertahan saat pindah tab (prd.md 5.6: kosong saat tab dibuka pertama kali)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab } = env.sandbox;

  // Saring rentang tanggal saat tab Log dibuka pertama kali
  switchTab('log');
  const dateFrom = env.getOrCreateElement('log-date-from');
  dateFrom.value = '2026-09-30';
  dateFrom.trigger('change');
  assert.equal(getRenderedLogIds(env.getOrCreateElement('log-list')).length, 0, 'Rentang di masa depan menyaring semua entri');

  // Pindah ke Todo lalu kembali ke Log: saringan tetap berlaku
  switchTab('todo');
  switchTab('log');

  assert.equal(dateFrom.value, '2026-09-30', 'Nilai kotak Dari tidak boleh hilang saat pindah tab');
  assert.equal(
    getRenderedLogIds(env.getOrCreateElement('log-list')).length,
    0,
    'Saringan harus bertahan saat pindah tab'
  );

  // Membuka ulang panel dalam sesi baru (state awal) kembali kosong.
  // init() memuat data secara async, jadi tunggu dulu.
  const envBaru = createTestEnvironment(exampleData);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  envBaru.sandbox.switchTab('log');
  assert.equal(
    envBaru.getOrCreateElement('log-date-from').value,
    '',
    'Kotak Dari kosong saat tab dibuka pertama kali'
  );
  assert.equal(
    getRenderedLogIds(envBaru.getOrCreateElement('log-list')).length,
    exampleData.logs.length,
    'Seluruh entri tampil saat tab dibuka pertama kali'
  );
});

test('Tiket 08 - Isolasi modul: saringan log tidak mengubah Indeks maupun Todo', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('todo');
  env.sandbox.switchTab('log');

  const todoListBefore = env.getOrCreateElement('todo-list').innerHTML;
  const resultListBefore = env.getOrCreateElement('result-list').innerHTML;

  const logSearchInput = env.getOrCreateElement('log-search-input');
  logSearchInput.value = 'k Paceholder yang tidak ada';
  logSearchInput.trigger('input');

  const logList = env.getOrCreateElement('log-list');
  assert.match(logList.innerHTML, /Tidak ada logbook cocok/, 'Saringan logbook harus bekerja');

  assert.equal(env.getOrCreateElement('todo-list').innerHTML, todoListBefore, 'Daftar Todo tidak boleh berubah');
  assert.equal(env.getOrCreateElement('result-list').innerHTML, resultListBefore, 'Daftar Indeks tidak boleh berubah');
});

test('Tiket 08 - Area status tetap tiga bagian, tidak menambah penghitung entri (PRD 5.9)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.sandbox.switchTab('log');

  const statusBar = env.getOrCreateElement('status-bar');
  assert.equal(
    statusBar.textContent,
    'PINDEX - 4 item',
    'Area status tetap "PINDEX - X item" tanpa penghitung entri log'
  );
  assert.ok(!/entri/i.test(statusBar.textContent), 'Area status tidak boleh memuat kata "entri"');
});

test('Tiket 08 - generateLogId membuat id unik urut l1, l2, ...', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { generateLogId } = env.sandbox;

  assert.equal(generateLogId([]), 'l1');
  assert.equal(generateLogId([{ id: 'l1' }]), 'l2');
  assert.equal(generateLogId([{ id: 'l1' }, { id: 'l3' }]), 'l2', 'Nomor yang dipakai tidak dipakai ulang');
  assert.equal(generateLogId([{ id: 'l1' }, { id: 'l2' }]), 'l3');
});

test('Tiket 08 - Catat entri baru: tanggal default hari ini dan muncul di baris teratas', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openLogModal } = env.sandbox;
  switchTab('log');

  openLogModal(null);
  assert.equal(env.activeModals.length, 1, 'Modal Catat Log harus terbuka');

  const dateInput = env.getOrCreateElement('log-date');
  const textArea = env.getOrCreateElement('log-text');

  const saveBtn = env.getOrCreateElement('btn-log-save');

  assert.equal(dateInput.value, getTodayString(), 'Tanggal harus default ke hari ini');
  assert.equal(saveBtn.disabled, true, 'Tombol Simpan harus nonaktif saat teks kosong');

  textArea.value = 'Rapat koordinasi anggaran';
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, false, 'Tombol Simpan aktif setelah teks diisi');

  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah simpan sukses');

  const savedData = JSON.parse(env.store['indeks_v1']);
  const addedLog = savedData.logs.find(entry => entry.teks === 'Rapat koordinasi anggaran');
  assert.ok(addedLog, 'Entri log baru harus tersimpan');
  assert.equal(addedLog.id, 'l2', 'ID log baru harus berurutan (l2)');
  assert.equal('item_id' in addedLog, false, 'Bentuk log tidak lagi memuat penunjuk item');
  assert.equal(addedLog.date, getTodayString());

  const logList = env.getOrCreateElement('log-list');
  assert.match(logList.innerHTML, /Rapat koordinasi anggaran/, 'Entri baru harus benar-benar dirender');
  assert.deepEqual(
    getRenderedLogIds(logList),
    ['l2', 'l1'],
    'Entri baru (l2) harus tampil sebelum entri lama (l1)'
  );
});

test('Tiket 08 - Ubah tanggal entri menjadi bulan lalu ikut mengubah urutan daftar', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  exampleData.logs.push({ id: 'l2', date: '2026-09-20', item_id: null, teks: 'Entri September' });
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openLogModal } = env.sandbox;
  switchTab('log');

  // Ubah entri September (l2) menjadi Agustus
  const logToEdit = exampleData.logs.find(entry => entry.id === 'l2');
  openLogModal(logToEdit);

  const dateInput = env.getOrCreateElement('log-date');
  assert.equal(dateInput.value, '2026-09-20', 'Modal harus mengisi tanggal entri yang diedit');

  dateInput.value = '2026-08-01';
  dateInput.trigger('input');
  dateInput.trigger('change');

  const textArea = env.getOrCreateElement('log-text');
  assert.equal(textArea.value, 'Entri September', 'Teks entri harus terisi saat modal Ubah');

  const saveBtn = env.getOrCreateElement('btn-log-save');
  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah simpan sukses');

  const savedData = JSON.parse(env.store['indeks_v1']);
  const updatedLog = savedData.logs.find(entry => entry.id === 'l2');
  assert.equal(updatedLog.date, '2026-08-01');
  assert.equal(updatedLog.teks, 'Entri September', 'Teks tidak boleh berubah');

  const logList = env.getOrCreateElement('log-list');
  assert.match(logList.innerHTML, /Entri September/, 'Entri yang diubah tanggalnya harus tetap dirender');
  assert.deepEqual(
    getRenderedLogIds(logList),
    ['l1', 'l2'],
    'Entri 29 Sep (l1) harus tampil sebelum entri 01 Agu (l2) karena urutan tanggal menurun'
  );
});


test('Tiket 08 - Retensi isian form saat penyimpanan gagal (wireframe §5)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // loadData async saat halaman siap
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Server menolak penyimpanan (misal data.json sedang terkunci). Dulu ini
  // disimulasikan lewat localStorage.setItem yang melempar; sekarang
  // penyimpanan hanya lewat backend, jadi gagalnya harus datang dari sana.
  const fetchAsli = env.sandbox.fetch;
  env.sandbox.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') {
      return { ok: false, status: 500, text: async () => 'gagal' };
    }
    return fetchAsli(url, opts);
  };

  const { switchTab, openLogModal } = env.sandbox;
  switchTab('log');

  openLogModal(null);
  const textArea = env.getOrCreateElement('log-text');
  textArea.value = 'Entri gagal disimpan';
  textArea.trigger('input');

  const saveBtn = env.getOrCreateElement('btn-log-save');
  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(env.activeModals.length, 1, 'Modal Log harus tetap terbuka jika penyimpanan gagal');
  assert.equal(textArea.value, 'Entri gagal disimpan', 'Isian form tidak boleh hilang');
});

test('Tiket 08 - Tombol Ubah dan Hapus pada baris log', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab } = env.sandbox;
  switchTab('log');

  const logList = env.getOrCreateElement('log-list');

  // Klik tombol Ubah pada entri l1
  logList.trigger('click', {
    target: {
      closest: (sel) => (sel === '.btn-ubah-log'
        ? { getAttribute: (attr) => (attr === 'data-id' ? 'l1' : null) }
        : null)
    }
  });
  assert.equal(env.activeModals.length, 1, 'Klik Ubah harus membuka modal');
  assert.match(env.activeModals[0].innerHTML, /Ubah Log/, 'Modal harus berjudul Ubah Log');
  assert.equal(env.getOrCreateElement('log-text').value, 'Input 20 data');

  // Klik tombol Hapus pada entri l1
  logList.trigger('click', {
    target: {
      closest: (sel) => (sel === '.btn-hapus-log'
        ? { getAttribute: (attr) => (attr === 'data-id' ? 'l1' : null) }
        : null)
    }
  });
  assert.equal(env.activeModals.length, 1);
  assert.match(env.activeModals[0].innerHTML, /Hapus Log/, 'Modal harus berjudul Hapus Log');
});

test('Tiket 08 - Verifikasi Review: ARIA modal, batas 200 karakter, tanggal wajib, Escape tidak menutup', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openLogModal, showDeleteLogConfirmation } = env.sandbox;
  switchTab('log');

  // 1. ARIA pada modal Catat/Ubah
  openLogModal(null);
  assert.equal(env.activeModals.length, 1);
  const overlay = env.activeModals[0];
  assert.equal(overlay.getAttribute('role'), 'dialog', 'Overlay modal harus punya role="dialog"');
  assert.equal(overlay.getAttribute('aria-modal'), 'true', 'Overlay modal harus punya aria-modal="true"');

  // 2. Escape tidak menutup modal (wireframe §8)
  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Escape tidak boleh menutup modal log');

  const dateInput = env.getOrCreateElement('log-date');
  const textArea = env.getOrCreateElement('log-text');
  const saveBtn = env.getOrCreateElement('btn-log-save');

  // 3. Batas 200 karakter teks
  textArea.value = 'a'.repeat(201);
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, true, 'Simpan harus nonaktif di atas 200 karakter');
  assert.match(env.getOrCreateElement('log-text-error').textContent, /200/, 'Pesan error menyebut batas 200 karakter');

  textArea.value = 'a'.repeat(200);
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, false, 'Simpan harus aktif pada pas 200 karakter');

  // 4. Tanggal kosong tidak valid
  dateInput.value = '';
  dateInput.trigger('input');
  assert.equal(saveBtn.disabled, true, 'Simpan harus nonaktif bila tanggal kosong');
  assert.match(
    env.getOrCreateElement('log-date-error').textContent,
    /YYYY-MM-DD/,
    'Pesan error tanggal harus menyebut format'
  );

  // 5. ARIA pada modal konfirmasi hapus
  showDeleteLogConfirmation(exampleData.logs[0]);
  const deleteOverlay = env.activeModals[0];
  assert.equal(deleteOverlay.getAttribute('role'), 'dialog');
  assert.equal(deleteOverlay.getAttribute('aria-modal'), 'true');
  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Escape tidak boleh menutup modal konfirmasi hapus log');
});

test('Tiket 08 - Verifikasi HTML: panel Log memakai elemen struktural yang disepakati', () => {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  assert.match(html, /id="log-search-input"/, 'Kotak cari log harus ada');
  assert.match(html, /id="log-date-from"/, 'Kotak Dari harus ada');
  assert.match(html, /id="log-date-sampai"/, 'Kotak Sampai harus ada');
  assert.match(html, /id="btn-catat-log"/, 'Tombol Catat harus ada');
  assert.match(html, /id="log-list"/, 'Kontainer daftar log harus ada');

  // Kedua kotak tanggal tidak boleh punya atribut value (kosong saat tab dibuka)
  const dateFromTag = html.match(/<input[^>]*id="log-date-from"[^>]*>/)[0];
  const dateSampaiTag = html.match(/<input[^>]*id="log-date-sampai"[^>]*>/)[0];
  assert.ok(!/value=/.test(dateFromTag), 'Kotak Dari tidak boleh punya nilai awal');
  assert.ok(!/value=/.test(dateSampaiTag), 'Kotak Sampai tidak boleh punya nilai awal');
});

test('Tiket 08 - Verifikasi CSS: memakai token resmi tanpa var(--surface)', () => {
  const css = fs.readFileSync(styleCssPath, 'utf8');

  assert.ok(!css.includes('var(--surface)'), 'CSS tidak boleh memakai token tidak resmi var(--surface)');

  const dateCellBlock = css.match(/\.log-date-cell\s*\{([^}]+)\}/);
  assert.ok(dateCellBlock, 'Blok .log-date-cell harus ditemukan');
  assert.match(dateCellBlock[1], /90px/, 'Kolom tanggal harus lebar tetap di kiri');

  const logItemBlock = css.match(/\.log-item\s*\{([^}]+)\}/);
  assert.ok(logItemBlock, 'Blok .log-item harus ditemukan');
  assert.match(logItemBlock[1], /display:\s*flex/, 'Baris log harus memakai flex');
});

// ---------------------------------------------------------------------------
// Field catatan pada entri Logbook
// ---------------------------------------------------------------------------
// `teks` tetap jadi ringkasan satu baris, `catatan` jadi isi panjang. Keduanya
// punya peran berbeda; kalau keduanya teks bebas tanpa pembeda, ada data yang
// terduplikasi.

async function siapLog(env) {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return env;
}

test('Catatan logbook - menyimpan catatan panjang bersama ringkasan', async () => {
  const env = await siapLog(createTestEnvironment(JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'))));
  const { switchTab, openLogModal } = env.sandbox;
  switchTab('log');

  openLogModal(null);
  env.getOrCreateElement('log-text').value = 'Rekonsiliasi kas Oktober';
  env.getOrCreateElement('log-text').trigger('input');
  const catatanLama = 'Libre akun tabular belum diimpor. Menunggu berkas dari bagian keuangan.\nBatas akhir minggu ini.';
  env.getOrCreateElement('log-catatan').value = catatanLama;
  env.getOrCreateElement('btn-log-save').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const tersimpan = JSON.parse(env.store['indeks_v1']);
  const baru = tersimpan.logs.find(e => e.teks === 'Rekonsiliasi kas Oktober');
  assert.ok(baru, 'Entri log harus tersimpan');
  assert.equal(baru.catatan, catatanLama, 'Catatan harus tersimpan utuh, termasuk baris baru di dalamnya');
  assert.equal(baru.teks, 'Rekonsiliasi kas Oktober', 'Ringkasan harus tetap terpisah dari catatan');
});

test('Catatan logbook - mengosongkan catatan menghapus fieldnya', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Ringkasan', catatan: 'Catatan lama' }]
  }));
  const { switchTab, openLogModal } = env.sandbox;
  switchTab('log');

  // Buka modal ubah untuk entri yang catatannya sudah ada. Entri diambil
  // dari isi berkas karena harness ini tidak mengekspos state.
  const [entriLama] = JSON.parse(env.store['indeks_v1']).logs;
  openLogModal(entriLama);
  assert.equal(env.getOrCreateElement('log-catatan').value, 'Catatan lama',
    'Form ubah harus memuat catatan yang sudah ada');

  env.getOrCreateElement('log-catatan').value = '';
  env.getOrCreateElement('btn-log-save').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const tersimpan = JSON.parse(env.store['indeks_v1']);
  assert.equal('catatan' in tersimpan.logs[0], false,
    'Field catatan harus dihapus, bukan disimpan sebagai teks kosong');
});

test('Catatan logbook - entri tanpa catatan tidak meninggalkan celah di daftar', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [
      { id: 'l1', date: '2026-10-02', teks: 'Punya catatan', catatan: 'Ada isinya' },
      { id: 'l2', date: '2026-10-01', teks: 'Tanpa catatan' }
    ]
  }));
  env.sandbox.switchTab('log');

  const html = env.getOrCreateElement('log-list').innerHTML;
  assert.match(html, /Ada isinya/, 'Catatan harus tampil di daftar');
  assert.equal((html.match(/log-catatan/g) || []).length, 1,
    'Hanya entri yang punya catatan yang boleh memakai kelas log-catatan');
});

test('Catatan logbook - catatan di luar daftar tidak boleh menimpa ringkasan', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Ringkasan', catatan: '<img src=x onerror=alert(1)>' }]
  }));
  env.sandbox.switchTab('log');

  const html = env.getOrCreateElement('log-list').innerHTML;
  assert.doesNotMatch(html, /<img src=x/,
    'Catatan harus lewat escapeHtml, tidak boleh menjadi markup');
  assert.match(html, /&lt;img src=x/,
    'Catatan harus tampil sebagai teks yang sudah di-escape');
});

test('Catatan logbook - formnya memisahkan ringkasan dan catatan', async () => {
  const env = await siapLog(createTestEnvironment(JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'))));
  env.sandbox.switchTab('log');
  env.sandbox.openLogModal(null);

  const isi = env.activeModals[0].innerHTML;
  assert.match(isi, /for="log-text">Ringkasan/, 'Label ringkasan harus tertulis Ringkasan');
  assert.match(isi, /for="log-catatan"/, 'Harus ada kolom Catatan');
  assert.match(isi, /id="log-catatan"[^>]*maxlength="2000"/,
    'Kolom catatan harus dibatasi 2000 karakter');
  assert.match(isi, /id="log-text"[^>]*maxlength="200"/,
    'Ringkasan harus tetap dibatasi 200 karakter');
});

test('Catatan logbook - entri lama tanpa catatan tetap terbaca', async () => {
  // Berkas versi 2 tidak punya field catatan sama sekali.
  const env = await siapLog(createTestEnvironment({
    version: 2, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Dari berkas lama' }]
  }));
  env.sandbox.switchTab('log');

  const html = env.getOrCreateElement('log-list').innerHTML;
  assert.match(html, /Dari berkas lama/, 'Entri lama harus tetap tampil');
  assert.doesNotMatch(html, /log-catatan/, 'Entri lama tidak punya catatan untuk ditampilkan');
  assert.equal(JSON.parse(env.store['indeks_v1']).version, 2,
    'Berkas lama dipakai apa adanya, tidak ada migrasi yang dijalankan');
});

test('Catatan logbook - ekspor JSON penuh membawa catatan', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Ringkasan', catatan: 'Catatan untuk cadangan' }]
  }));

  const { validateImportedData } = env.sandbox;
  const hasil = validateImportedData(JSON.parse(env.store['indeks_v1']));
  assert.equal(hasil.valid, true, 'Berkas dengan catatan harus tetap sah');
});

// ---------------------------------------------------------------------------
// Pencarian logbook membaca catatan
// ---------------------------------------------------------------------------
// Catatan adalah isi sebenarnya dari sebuah entri, sementara ringkasan cuma
// satu baris. Kalau pencarian hanya membaca ringkasan, orang akan mengetik
// kata yang dia ingat menulis di catatan dan tidak menemukannya.

test('Pencarian logbook - kata yang hanya ada di catatan menemukan entri', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Rekonsiliasi kas', catatan: 'Libre akun tabular belum diimpor' }]
  }));
  const { filterLogs } = env.sandbox;

  const hasil = filterLogs(JSON.parse(env.store['indeks_v1']).logs, 'tabular', '', '');
  assert.deepEqual(hasil.map(e => e.id), ['l1'],
    'Kata yang hanya ada di catatan harus menemukan entri itu');
});

test('Pencarian logbook - kata di ringkasan tetap menemukan entri', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'Rekonsiliasi kas', catatan: 'catatan lain' }]
  }));
  const { filterLogs } = env.sandbox;

  const hasil = filterLogs(JSON.parse(env.store['indeks_v1']).logs, 'rekonsiliasi', '', '');
  assert.deepEqual(hasil.map(e => e.id), ['l1'],
    'Perilaku lama pada ringkasan harus tetap berlaku');
});

test('Pencarian logbook - kata di kedua field tidak menghasilkan entri dobel', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'kas', catatan: 'kas juga' }]
  }));
  const { filterLogs } = env.sandbox;

  const hasil = filterLogs(JSON.parse(env.store['indeks_v1']).logs, 'kas', '', '');
  assert.deepEqual(hasil.map(e => e.id), ['l1'],
    'Entri yang cocok di kedua field tetap muncul sekali');
});

test('Pencarian logbook - kata tidak boleh kejatuhan lintas dua field', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [{ id: 'l1', date: '2026-10-01', teks: 'rekonsiliasi kas', catatan: 'tabular bulanan' }]
  }));
  const { filterLogs } = env.sandbox;

  // "rekonsiliasi" ada di ringkasan dan "bulanan" ada di catatan, tapi gabungannya
  // tidak ada di satu field pun. Kalau teksnya digabung lebih dulu, kata ini
  // akan cocok dan itu bukan hasil yang orang maksud.
  const hasil = filterLogs(JSON.parse(env.store['indeks_v1']).logs, 'rekonsiliasi bulanan', '', '');
  assert.deepEqual(hasil.map(e => e.id), [],
    'Kata yang sebagian dari satu field dan sebagian dari field lain tidak boleh cocok');
});

test('Pencarian logbook - entri tanpa catatan tidak membuat pencarian gagal', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [],
    logs: [
      { id: 'l1', date: '2026-10-02', teks: 'Punya catatan', catatan: 'kneedle' },
      { id: 'l2', date: '2026-10-01', teks: 'Tanpa catatan' }
    ]
  }));
  const { filterLogs } = env.sandbox;

  const hasil = filterLogs(JSON.parse(env.store['indeks_v1']).logs, 'kneedle', '', '');
  assert.deepEqual(hasil.map(e => e.id), ['l1'],
    'Entri tanpa catatan harus dilewati tanpa error, bukan membuat pencarian kosong');
});

test('Pencarian logbook - TodoList tidak ikut membaca catatan', async () => {
  const env = await siapLog(createTestEnvironment({
    version: 3, items: [], todo: [], logs: []
  }));
  const { filterTodos } = env.sandbox;

  // Entri todo tidak punya field catatan sama sekali. Kalau filterLinkedRows
  // ikut membacanya, TodoList diam-diam mendukung field yang tidak ada di sana.
  const todos = [{ id: 't1', teks: 'Opsi lapar', done: false, deadline: null, updated_at: '2026-01-01' }];
  assert.deepEqual(filterTodos(todos, 'kneedle', 'semua').map(t => t.id), [],
    'TodoList tidak boleh mencari di field yang tidak dimilikinya');
  assert.deepEqual(filterTodos(todos, 'lapar', 'semua').map(t => t.id), ['t1'],
    'Pencarian TodoList pada teksnya harus tetap berfungsi');
});