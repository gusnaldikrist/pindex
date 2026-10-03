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
        if (sel === '.btn-copy' && className.includes('btn-copy')) return el;
        if (sel === '.btn-buka' && className.includes('btn-buka')) return el;
        if (sel === '.btn-ubah' && className.includes('btn-ubah')) return el;
        if (sel === '.result-item' && className.includes('result-item')) return el;
        if (sel === '.todo-item' && className.includes('todo-item')) return el;
        if (sel === '.todo-checkbox' && className.includes('todo-checkbox')) return el;
        if (sel === '.btn-ubah-todo' && className.includes('btn-ubah-todo')) return el;
        if (sel === '.btn-hapus-todo' && className.includes('btn-hapus-todo')) return el;
        if (sel === '.btn-todo-filter' && className.includes('btn-todo-filter')) return el;
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
            const dataFilterMatch = attrs.match(/\bdata-filter="([^"]+)"/);
            if (dataFilterMatch) child.setAttribute('data-filter', dataFilterMatch[1]);
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
          listeners[evt].forEach(h => h({
            target: el,
            preventDefault: () => {},
            stopPropagation: () => {},
            ...evtData
          }));
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

  getOrCreateElement('todo-search-input', 'input');
  getOrCreateElement('btn-tambah-todo', 'button');
  const todoList = getOrCreateElement('todo-list');

  const filterSemua = createElementObj('filter-semua', 'button');
  filterSemua.className = 'btn btn-secondary btn-todo-filter active';
  filterSemua.setAttribute('data-filter', 'semua');

  const filterBelum = createElementObj('filter-belum', 'button');
  filterBelum.className = 'btn btn-secondary btn-todo-filter';
  filterBelum.setAttribute('data-filter', 'belum');

  const filterSelesai = createElementObj('filter-selesai', 'button');
  filterSelesai.className = 'btn btn-secondary btn-todo-filter';
  filterSelesai.setAttribute('data-filter', 'selesai');

  const activeModals = [];

  const domDocument = {
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => {
      if (sel === '.modal-overlay') {
        return activeModals.length > 0 ? activeModals[activeModals.length - 1] : null;
      }
      if (sel === '#search-input') return getOrCreateElement('search-input');
      if (sel === '#todo-search-input') return getOrCreateElement('todo-search-input');
      if (sel === '#todo-list') return getOrCreateElement('todo-list');
      if (sel === '#panel-todo') return getOrCreateElement('panel-todo');
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.nav-tab-btn') return [tabIndeks, tabTodo, tabLog];
      if (sel === '.tab-panel') return [panelIndeks, panelTodo, panelLog];
      if (sel === '.btn-todo-filter') return [filterSemua, filterBelum, filterSelesai];
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
        docListeners[evt].forEach(h => h(data));
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
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
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
    panelTodo,
    todoList,
    activeModals,
    store,
    triggerDoc: domDocument.trigger
  };
}

test('Tiket 07 - Status Label otomatis: lewat, mepet, none, dan selesai', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { getTodoStatus } = env.sandbox;
  assert.equal(typeof getTodoStatus, 'function', 'getTodoStatus harus berupa fungsi');

  const todayStr = '2026-10-01';

  // 1. Deadline kemarin -> lewat
  const statusYesterday = getTodoStatus({ done: false, deadline: '2026-09-30' }, todayStr);
  assert.equal(statusYesterday.type, 'lewat');
  assert.equal(statusYesterday.label, 'lewat');

  // 2. Deadline hari ini -> mepet
  const statusToday = getTodoStatus({ done: false, deadline: '2026-10-01' }, todayStr);
  assert.equal(statusToday.type, 'mepet');
  assert.equal(statusToday.label, 'mepet');

  // 3. Deadline 2 hari lagi -> mepet
  const status2Days = getTodoStatus({ done: false, deadline: '2026-10-03' }, todayStr);
  assert.equal(status2Days.type, 'mepet');
  assert.equal(status2Days.label, 'mepet');

  // 4. Deadline 3 hari lagi -> mepet
  const status3Days = getTodoStatus({ done: false, deadline: '2026-10-04' }, todayStr);
  assert.equal(status3Days.type, 'mepet');
  assert.equal(status3Days.label, 'mepet');

  // 5. Deadline 4 hari lagi -> none (tanpa label)
  const status4Days = getTodoStatus({ done: false, deadline: '2026-10-05' }, todayStr);
  assert.equal(status4Days.type, 'none');
  assert.equal(status4Days.label, '');

  // 6. Deadline 5 hari lagi -> none (tanpa label)
  const status5Days = getTodoStatus({ done: false, deadline: '2026-10-06' }, todayStr);
  assert.equal(status5Days.type, 'none');

  // 7. Tanpa deadline -> none
  const statusNoDeadline = getTodoStatus({ done: false, deadline: null }, todayStr);
  assert.equal(statusNoDeadline.type, 'none');

  // 8. Selesai (done: true) -> selesai menggantikan label lain
  const statusDone = getTodoStatus({ done: true, deadline: '2026-09-20' }, todayStr);
  assert.equal(statusDone.type, 'selesai');
  assert.equal(statusDone.label, 'selesai');
});

test('Tiket 07 - Render awal tab Todo dari data.example.json', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab } = env.sandbox;
  switchTab('todo');

  const todoList = env.getOrCreateElement('todo-list');
  assert.match(todoList.innerHTML, /Validasi 20 draft - kumpul Jumat/, 'Teks todo t1 harus muncul di daftar');
  assert.match(todoList.innerHTML, /Sheet Admin TA/, 'Nama item tertaut Sheet Admin TA harus muncul');
  assert.match(todoList.innerHTML, /badge-status/, 'Badge status harus muncul');
});

test('Tiket 07 - Centang todo: klik checkbox mengubah status selesai & tersimpan di storage', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab } = env.sandbox;
  switchTab('todo');

  const todoList = env.getOrCreateElement('todo-list');

  // Klik checkbox t1
  todoList.trigger('click', {
    target: {
      closest: (sel) => {
        if (sel === '.todo-checkbox') {
          return {
            getAttribute: (attr) => attr === 'data-id' ? 't1' : null
          };
        }
        return null;
      }
    }
  });

  const savedData = JSON.parse(env.store['indeks_v1']);
  const todoT1 = savedData.todo.find(t => t.id === 't1');
  assert.ok(todoT1, 'Todo t1 harus ada');
  assert.equal(todoT1.done, true, 'Status done harus berubah menjadi true');

  // Teks "selesai" muncul pada badge
  assert.match(todoList.innerHTML, /selesai/, 'Badge status harus berubah menjadi selesai');
});

test('Tiket 07 - Pengurutan: selesai di bawah, dan tanpa tenggat diurutkan waktu ubah', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    { id: 't-done-old', teks: 'Selesai Lama', done: true, updated_at: '2026-09-01' },
    { id: 't-done-new', teks: 'Selesai Baru', done: true, updated_at: '2026-09-29' },
    { id: 't-active-old', teks: 'Aktif Lama', done: false, updated_at: '2026-09-10' },
    { id: 't-active-new', teks: 'Aktif Baru', done: false, updated_at: '2026-09-28' }
  ];

  const sorted = filterTodos(testTodos, [], '', 'semua');
  assert.deepEqual(
    sorted.map(t => t.id),
    ['t-active-new', 't-active-old', 't-done-new', 't-done-old'],
    'Selesai tetap di bawah, dan yang tidak punya tenggat diurutkan waktu ubah menurun. ' +
    'Pengurutan memakai deadline ada di pengujian tiket 01.'
  );
});

test('Tiket 07 - Saringan Status: Semua, Belum, Selesai', async () => {
  const env = createTestEnvironment();
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    { id: 't1', teks: 'Tugas 1', done: false, updated_at: '2026-09-29' },
    { id: 't2', teks: 'Tugas 2', done: true, updated_at: '2026-09-29' }
  ];

  const resSemua = filterTodos(testTodos, [], '', 'semua');
  assert.equal(resSemua.length, 2);

  const resBelum = filterTodos(testTodos, [], '', 'belum');
  assert.equal(resBelum.length, 1);
  assert.equal(resBelum[0].id, 't1');

  const resSelesai = filterTodos(testTodos, [], '', 'selesai');
  assert.equal(resSelesai.length, 1);
  assert.equal(resSelesai[0].id, 't2');
});

test('Tiket 07 - Pencarian Tab Todo: teks todo dan judul item tertaut (aturan PRD 5.1)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { filterTodos } = env.sandbox;
  const items = exampleData.items;
  const todos = exampleData.todo; // t1: "Validasi 20 draft - kumpul Jumat", item_id: "sheet-ta-admin"

  // 1. Cari teks todo
  const resTeks = filterTodos(todos, items, 'kumpul jumat', 'semua');
  assert.equal(resTeks.length, 1);
  assert.equal(resTeks[0].id, 't1');

  // 2. Cari judul item tertaut
  const resItem = filterTodos(todos, items, 'sheet admin', 'semua');
  assert.equal(resItem.length, 1, 'Ketik "sheet admin" harus mencocokkan todo yang menautkan Sheet Admin TA');

  // 3. Frasa terbalik tidak cocok
  const resInverse = filterTodos(todos, items, 'admin sheet', 'semua');
  assert.equal(resInverse.length, 0, 'Frasa terbalik tidak boleh cocok sesuai aturan PRD 5.1');
});

test('Tiket 07 - Tambah Todo: mengisi form, simpan, tersimpan di localStorage', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openTodoModal } = env.sandbox;
  switchTab('todo');

  openTodoModal(null);
  assert.equal(env.activeModals.length, 1, 'Modal Tambah Todo harus terbuka');

  const textArea = env.getOrCreateElement('todo-text');
  const deadlineInput = env.getOrCreateElement('todo-deadline');
  const itemSelect = env.getOrCreateElement('todo-item-id');
  const saveBtn = env.getOrCreateElement('btn-todo-save');

  assert.equal(saveBtn.disabled, true, 'Tombol simpan harus nonaktif jika teks kosong');

  textArea.value = 'Siapkan berkas sidang yudisium';
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, false, 'Tombol simpan harus aktif setelah teks diisi');

  deadlineInput.value = '2026-10-15';
  itemSelect.value = 'repo-uniga';

  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah simpan sukses');

  const savedData = JSON.parse(env.store['indeks_v1']);
  const addedTodo = savedData.todo.find(t => t.teks === 'Siapkan berkas sidang yudisium');
  assert.ok(addedTodo, 'Todo baru harus tersimpan');
  assert.equal(addedTodo.id, 't2', 'ID todo baru harus berurutan (t2)');
  assert.equal(addedTodo.deadline, '2026-10-15');
  assert.equal(addedTodo.item_id, 'repo-uniga');
  assert.equal(addedTodo.done, false);
});

test('Tiket 07 - Ubah Todo: edit teks dan deadline', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openTodoModal } = env.sandbox;
  switchTab('todo');

  const todoT1 = exampleData.todo[0];
  openTodoModal(todoT1);

  const textArea = env.getOrCreateElement('todo-text');
  assert.equal(textArea.value, todoT1.teks);

  textArea.value = 'Validasi 25 draft TA - kumpul Senin';
  textArea.trigger('input');

  const saveBtn = env.getOrCreateElement('btn-todo-save');
  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0);

  const savedData = JSON.parse(env.store['indeks_v1']);
  const updatedTodo = savedData.todo.find(t => t.id === 't1');
  assert.equal(updatedTodo.teks, 'Validasi 25 draft TA - kumpul Senin');
});

test('Tiket 07 - Hapus Todo: friksi ketik "hapus" menghapus todo tanpa menghapus item tertaut', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, showDeleteTodoConfirmation } = env.sandbox;
  switchTab('todo');

  const todoT1 = exampleData.todo[0];
  showDeleteTodoConfirmation(todoT1);

  assert.equal(env.activeModals.length, 1);
  const confirmInput = env.getOrCreateElement('input-confirm-delete-todo');
  const confirmBtn = env.getOrCreateElement('btn-confirm-delete-todo');

  assert.equal(confirmBtn.disabled, true);

  // Ketik kata salah
  confirmInput.value = 'batal';
  confirmInput.trigger('input');
  assert.equal(confirmBtn.disabled, true);

  // Ketik "hapus" (case-insensitive)
  confirmInput.value = 'HAPUS';
  confirmInput.trigger('input');
  assert.equal(confirmBtn.disabled, false);

  confirmBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0);

  const savedData = JSON.parse(env.store['indeks_v1']);
  assert.ok(!savedData.todo.some(t => t.id === 't1'), 'Todo t1 harus terhapus');
  assert.ok(savedData.items.some(it => it.id === 'sheet-ta-admin'), 'Item tertaut Sheet Admin TA TIDAK boleh terhapus');
});

test('Tiket 07 - Item tertaut terhapus: todo tetap ada dengan label "tanpa tautan"', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  // Ubah item_id menjadi null
  exampleData.todo[0].item_id = null;
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab } = env.sandbox;
  switchTab('todo');

  const todoList = env.getOrCreateElement('todo-list');
  assert.match(todoList.innerHTML, /tanpa tautan/, 'Todo dengan item_id null harus memuat teks "tanpa tautan"');
});

test('Tiket 07 - Retensi modal saat penyimpanan gagal (wireframe §5)', async () => {
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

  const { switchTab, openTodoModal } = env.sandbox;
  switchTab('todo');

  openTodoModal(null);
  const textArea = env.getOrCreateElement('todo-text');
  textArea.value = 'Todo gagal disimpan';
  textArea.trigger('input');

  const saveBtn = env.getOrCreateElement('btn-todo-save');
  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Modal harus tetap terbuka
  assert.equal(env.activeModals.length, 1, 'Modal Todo harus tetap terbuka jika penyimpanan gagal');
  assert.equal(textArea.value, 'Todo gagal disimpan', 'Isian form tidak boleh hilang');
});

test('Tiket 07 - Verifikasi Review: Atribut ARIA modal, validasi panjang teks 200 karakter, dan Escape tidak menutup modal', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { switchTab, openTodoModal, showDeleteTodoConfirmation } = env.sandbox;
  switchTab('todo');

  // 1. Cek atribut ARIA pada modal tambah/ubah
  openTodoModal(null);
  assert.equal(env.activeModals.length, 1);
  const todoModalOverlay = env.activeModals[0];
  assert.equal(todoModalOverlay.getAttribute('role'), 'dialog', 'Overlay modal harus memiliki role="dialog"');
  assert.equal(todoModalOverlay.getAttribute('aria-modal'), 'true', 'Overlay modal harus memiliki aria-modal="true"');

  // 2. Escape tidak boleh menutup modal
  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Tombol Escape tidak boleh menutup modal todo (wireframe §8)');

  // 3. Validasi batas teks 200 karakter
  const textArea = env.getOrCreateElement('todo-text');
  const saveBtn = env.getOrCreateElement('btn-todo-save');

  textArea.value = 'a'.repeat(201);
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, true, 'Tombol simpan harus nonaktif jika teks melebihi 200 karakter');

  const errorEl = env.getOrCreateElement('todo-text-error');
  assert.match(errorEl.textContent, /200/, 'Pesan error harus memberitahu batas maksimal 200 karakter');

  textArea.value = 'a'.repeat(200);
  textArea.trigger('input');
  assert.equal(saveBtn.disabled, false, 'Tombol simpan harus aktif jika teks pas 200 karakter');

  // 4. Cek atribut ARIA pada modal hapus
  showDeleteTodoConfirmation(exampleData.todo[0]);
  assert.equal(env.activeModals.length, 1);
  const deleteModalOverlay = env.activeModals[0];
  assert.equal(deleteModalOverlay.getAttribute('role'), 'dialog', 'Overlay konfirmasi hapus harus memiliki role="dialog"');
  assert.equal(deleteModalOverlay.getAttribute('aria-modal'), 'true', 'Overlay konfirmasi hapus harus memiliki aria-modal="true"');

  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Tombol Escape tidak boleh menutup modal konfirmasi hapus todo');
});

test('Tiket 07 - Verifikasi CSS: Tidak memakai token var(--surface) dan tidak memakai line-through pada todo selesai', () => {
  const cssContent = fs.readFileSync(styleCssPath, 'utf8');

  // 1. Memastikan var(--surface) tidak dipakai di seluruh file CSS
  assert.ok(!cssContent.includes('var(--surface)'), 'CSS tidak boleh memakai token tidak resmi var(--surface)');

  // 2. Memastikan tidak ada text-decoration: line-through pada .todo-text.is-done
  const isDoneBlockMatch = cssContent.match(/\.todo-text\.is-done\s*\{([^}]+)\}/);
  assert.ok(isDoneBlockMatch, 'Blok .todo-text.is-done harus ditemukan');
  assert.ok(!isDoneBlockMatch[1].includes('line-through'), 'Teks todo selesai tidak boleh dicoret garis (line-through)');
});

// Urutan memakai deadline. Fixture sengaja mencampur tugas bertenggat dan
// tanpa tenggat: kalau semua punya tenggat berbeda, pengujian tetap lulus
// walau deadline diabaikan sama sekali.
test('Tiket 01 - Urutan memakai deadline, bukan kapan terakhir disentuh', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    // Paling mendesak tapi paling lama tidak disentuh
    { id: 'lewat', teks: 'Lewat', done: false, deadline: '2020-01-01', updated_at: '2020-01-01' },
    // Tanpa tenggat, tapi baru disentuh
    { id: 'tanpa', teks: 'Tanpa Tenggat', done: false, deadline: null, updated_at: '2026-10-01' },
    // Jauh nanti dan baru disentuh
    { id: 'nanti', teks: 'Nanti', done: false, deadline: '2099-01-01', updated_at: '2026-10-02' }
  ];

  const sorted = filterTodos(testTodos, [], '', 'semua');
  assert.deepEqual(
    sorted.map(t => t.id),
    ['lewat', 'nanti', 'tanpa'],
    'Deadline menaik dulu, tugas tanpa tenggat turun ke bawah semua yang bertenggat'
  );
});

test('Tiket 01 - Deadline sama dipecah oleh kapan terakhir disentuh', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    { id: 'lama', teks: 'Lama', done: false, deadline: '2099-05-05', updated_at: '2026-01-01' },
    { id: 'baru', teks: 'Baru', done: false, deadline: '2099-05-05', updated_at: '2026-09-01' }
  ];

  const sorted = filterTodos(testTodos, [], '', 'semua');
  assert.deepEqual(sorted.map(t => t.id), ['baru', 'lama'],
    'Deadline sama harus punya urutan yang ditentukan, bukan acak');
});

test('Tiket 01 - Deadline rusak dianggap tidak punya deadline', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    { id: 'rusak', teks: 'Rusak', done: false, deadline: 'bukan tanggal', updated_at: '2026-09-01' },
    { id: 'sah', teks: 'Sah', done: false, deadline: '2099-01-01', updated_at: '2026-01-01' },
    { id: 'kosong', teks: 'Kosong', done: false, deadline: '', updated_at: '2026-08-01' }
  ];

  const sorted = filterTodos(testTodos, [], '', 'semua');
  assert.deepEqual(sorted.map(t => t.id), ['sah', 'rusak', 'kosong'],
    'Deadline rusak tidak boleh membuat daftar gagal; diperlakukan sebagai tidak punya tenggat');
});

test('Tiket 01 - Urutan tetap benar saat disaring dan saat dicari', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { filterTodos } = env.sandbox;

  const testTodos = [
    { id: 'a-lewat', teks: 'Opsi lapar', done: false, deadline: '2020-01-01', updated_at: '2020-01-01' },
    { id: 'a-nanti', teks: 'Opsi.amazonaws', done: false, deadline: '2099-01-01', updated_at: '2026-01-01' },
    { id: 'selesai', teks: 'Opsi selesai', done: true, deadline: '2020-01-01', updated_at: '2026-01-01' }
  ];

  const belum = filterTodos(testTodos, [], '', 'belum');
  assert.deepEqual(belum.map(t => t.id), ['a-lewat', 'a-nanti'],
    'Saringan belum selesai tidak boleh mengubah urutan deadline');

  const cari = filterTodos(testTodos, [], 'Opsi', 'semua');
  assert.deepEqual(cari.map(t => t.id), ['a-lewat', 'a-nanti', 'selesai'],
    'Pencarian tidak boleh mengacak urutan');
});
