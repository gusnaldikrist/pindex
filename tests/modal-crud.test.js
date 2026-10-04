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
      set innerHTML(val) {
        innerHTML = String(val);
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)\/?>/g;
        for (const m of innerHTML.matchAll(tagRegex)) {
          const childTag = m[1] || m[5];
          const attrs = m[2] || m[6];
          const childId = m[3] || m[7];
          const childInner = m[4] || '';
          const child = getOrCreateElement(childId);
          child.tagName = childTag.toUpperCase();
          if (childInner && !childInner.includes('<')) {
            child.textContent = childInner.trim();
            child.innerHTML = childInner.trim();
          }
          const valMatch = attrs.match(/value="([^"]*)"/);
          if (valMatch) {
            child.value = valMatch[1];
          }
          if (/\bdisabled\b/.test(attrs)) {
            child.disabled = true;
          } else {
            child.disabled = false;
          }
        }
      },
      get innerHTML() {
        return innerHTML;
      },
      set textContent(val) {
        textContent = String(val);
      },
      get textContent() {
        return textContent;
      },
      set value(v) {
        val = String(v);
      },
      get value() {
        return val;
      },
      set className(val) {
        className = String(val);
      },
      get className() {
        return className;
      },
      set disabled(d) {
        disabled = Boolean(d);
      },
      get disabled() {
        return disabled;
      },
      focus: () => {},
      select: () => {},
      addEventListener: (event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      trigger: (event, payload = {}) => {
        if (listeners[event]) {
          listeners[event].forEach((fn) => {
            fn({
              target: el,
              currentTarget: el,
              preventDefault: () => {},
              stopPropagation: () => {},
              ...payload
            });
          });
        }
      }
    };

    return el;
  }

  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, createElementObj(id));
    }
    return elements.get(id);
  }

  const panelIndeks = getOrCreateElement('panel-indeks');
  const panelTodo = getOrCreateElement('panel-todo');
  const panelLog = getOrCreateElement('panel-log');
  const tabIndeks = getOrCreateElement('tab-indeks');
  const tabTodo = getOrCreateElement('tab-todo');
  const tabLog = getOrCreateElement('tab-log');
  const statusBar = getOrCreateElement('status-bar');

  const store = {};
  if (initialData) {
    store['indeks_v1'] = JSON.stringify(initialData);
  }

  const mockLocalStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); }
  };

  // Server palsu: aplikasi hanya punya satu jalur, jadi data harus datang
  // dari backend, bukan localStorage. Backend menulis ke store yang sama,
  // jadi assertion yang sudah ada tetap berlaku.
  const backend = buatBackendPalsu(store);

  const activeModals = [];

  const domDocument = {
    readyState: 'complete',
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (selector) => {
      if (selector === '.nav-tab-btn') return [tabIndeks, tabTodo, tabLog];
      if (selector === '.tab-panel') return [panelIndeks, panelTodo, panelLog];
      const results = [];
      for (const el of elements.values()) {
        if (selector.startsWith('.') && el.className.includes(selector.slice(1))) {
          results.push(el);
        }
      }
      return results;
    },
    querySelector: (selector) => {
      if (selector === '.modal-overlay') return activeModals[activeModals.length - 1] || null;
      for (const el of elements.values()) {
        if (selector.startsWith('#') && el.id === selector.slice(1)) return el;
        if (selector.startsWith('.') && el.className.includes(selector.slice(1))) return el;
      }
      return null;
    },
    createElement: (tag) => {
      return createElementObj(null, tag);
    },
    body: {
      appendChild: (el) => {
        el.parentNode = domDocument.body;
        if (el.className && el.className.includes('modal-overlay')) {
          activeModals.push(el);
        }
      },
      removeChild: (el) => {
        el.parentNode = null;
        const idx = activeModals.indexOf(el);
        if (idx >= 0) activeModals.splice(idx, 1);
      }
    },
    addEventListener: (event, handler) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(handler);
    },
    trigger: (event, payload = {}) => {
      if (docListeners[event]) {
        docListeners[event].forEach((fn) => {
          fn({
            preventDefault: () => {},
            stopPropagation: () => {},
            ...payload
          });
        });
      }
    }
  };

  const sandbox = {
    document: domDocument,
    localStorage: mockLocalStorage,
    navigator: {
      clipboard: {
        writeText: async () => {}
      }
    },
    setTimeout: (fn, delay) => setTimeout(fn, delay),
    clearTimeout,
    fetch: backend.fetch,
    AbortController,
    Date,
    console
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
    panelIndeks,
    statusBar,
    activeModals,
    store,
    triggerDoc: domDocument.trigger
  };
}

test('Tiket 06 - Tombol + Tambah ada di sebelah kotak pencarian dan di empty state', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const btnTambah = env.getOrCreateElement('btn-tambah-item');
  assert.ok(btnTambah, 'Tombol #btn-tambah-item harus ada di layar Indeks');
  assert.match(btnTambah.textContent, /Tambah/i, 'Teks tombol harus memuat Tambah');

  // Buka modal Tambah
  btnTambah.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 1, 'Modal harus terbuka setelah tombol Tambah diklik');
  const modal = env.activeModals[0];
  assert.match(modal.innerHTML, /Tambah Item|Tambah item/i, 'Judul modal harus Tambah Item');
});

test('Tiket 06 - Pembuatan ID slug unik dari judul (termasuk suffix angka urut)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { generateItemId } = env.sandbox;
  assert.equal(typeof generateItemId, 'function', 'generateItemId harus didefinisikan');

  const items = [{ id: 'sheet-admin-ta' }];
  const id1 = generateItemId('Sheet Admin TA', items);
  assert.equal(id1, 'sheet-admin-ta-2', 'Judul sama kedua harus mendapat akhiran -2');

  const id2 = generateItemId('Sheet Admin TA', [...items, { id: 'sheet-admin-ta-2' }]);
  assert.equal(id2, 'sheet-admin-ta-3', 'Judul sama ketiga harus mendapat akhiran -3');

  const idBaru = generateItemId('Layanan Sirkulasi Baru!', items);
  assert.equal(idBaru, 'layanan-sirkulasi-baru', 'Karakter tanda seru dan spasi harus dinormalisasi');
});

test('Tiket 06 - Validasi Tag: menolak tag huruf besar atau berspasi dengan pesan jelas', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const { validateTags } = env.sandbox;
  assert.equal(typeof validateTags, 'function', 'validateTags harus didefinisikan');

  // Valid
  const resValid = validateTags('ta, wisuda, magang');
  assert.equal(resValid.valid, true, 'Tag huruf kecil tanpa spasi harus valid');
  assert.deepEqual(Array.from(resValid.tags), ['ta', 'wisuda', 'magang']);

  // Invalid: huruf besar "TA "
  const resUppercase = validateTags('TA, wisuda');
  assert.equal(resUppercase.valid, false, 'Tag dengan huruf besar harus tidak valid');
  assert.match(resUppercase.error, /huruf besar/i, 'Pesan error harus menyebut huruf besar');

  // Invalid: spasi di dalam tag "sheet admin" atau spasi ujung
  const resSpace = validateTags('ta, sheet admin');
  assert.equal(resSpace.valid, false, 'Tag berspasi harus tidak valid');
  assert.match(resSpace.error, /spasi/i, 'Pesan error harus menyebut spasi');

  // Invalid: kosong
  const resEmpty = validateTags('');
  assert.equal(resEmpty.valid, false, 'Tag kosong harus tidak valid');
});

test('Tiket 06 - Alur Tambah item: mengisi form, simpan, tersimpan di localStorage dengan updated_at hari ini', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const btnTambah = env.getOrCreateElement('btn-tambah-item');
  btnTambah.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const titleInput = env.getOrCreateElement('item-title');
  const tagsInput = env.getOrCreateElement('item-tags');
  const linkLabelInput = env.getOrCreateElement('link-label-0');
  const linkUrlInput = env.getOrCreateElement('link-url-0');
  const catatanInput = env.getOrCreateElement('item-catatan');
  const saveBtn = env.getOrCreateElement('btn-item-save');

  titleInput.value = 'Dokumen Pedoman Mutu';
  titleInput.trigger('input');

  tagsInput.value = 'pedoman, mutu, akreditasi';
  tagsInput.trigger('input');

  linkLabelInput.value = 'Buka Pedoman';
  linkLabelInput.trigger('input');

  linkUrlInput.value = 'https://uniga.ac.id/pedoman.pdf';
  linkUrlInput.trigger('input');

  catatanInput.value = 'Pelajari panduan sebelum visitasi akreditasi';
  catatanInput.trigger('input');

  assert.equal(saveBtn.disabled, false, 'Tombol simpan harus aktif saat form valid');

  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Verifikasi modal tertutup
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah simpan sukses');

  // Verifikasi tersimpan di localStorage
  const savedData = JSON.parse(env.store['indeks_v1']);
  const addedItem = savedData.items.find(it => it.id === 'dokumen-pedoman-mutu');
  assert.ok(addedItem, 'Item baru harus ada di penyimpanan data');
  assert.equal(addedItem.title, 'Dokumen Pedoman Mutu');
  assert.deepEqual(addedItem.tags, ['pedoman', 'mutu', 'akreditasi']);
  assert.equal(addedItem.links.length, 1);
  assert.equal(addedItem.links[0].label, 'Buka Pedoman');
  assert.equal(addedItem.links[0].url, 'https://uniga.ac.id/pedoman.pdf');

  // Tanggal updated_at format YYYY-MM-DD
  assert.match(addedItem.updated_at, /^\d{4}-\d{2}-\d{2}$/, 'updated_at harus berupa YYYY-MM-DD');
});

test('Tiket 06 - Alur Ubah item: klik Ubah pada baris hasil, edit judul/catatan, simpan', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const resultList = env.getOrCreateElement('result-list');

  // Klik tombol Ubah pada baris Repository UNIGA
  resultList.trigger('click', {
    target: {
      closest: (sel) => {
        if (sel === '.btn-ubah') {
          return {
            className: 'btn-ubah',
            getAttribute: (attr) => attr === 'data-id' ? 'repo-uniga' : null
          };
        }
        return null;
      }
    }
  });

  assert.equal(env.activeModals.length, 1, 'Modal Ubah harus terbuka');
  const titleInput = env.getOrCreateElement('item-title');
  assert.equal(titleInput.value, 'Repository UNIGA', 'Nilai judul harus terisi data lama');

  // Ubah catatan
  const catatanInput = env.getOrCreateElement('item-catatan');
  catatanInput.value = 'Minta mahasiswa upload mandiri sebelum sidang';
  catatanInput.trigger('input');

  const saveBtn = env.getOrCreateElement('btn-item-save');
  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah simpan');

  const savedData = JSON.parse(env.store['indeks_v1']);
  const updatedItem = savedData.items.find(it => it.id === 'repo-uniga');
  assert.equal(updatedItem.catatan, 'Minta mahasiswa upload mandiri sebelum sidang');
});

test('Tiket 06 - Alur Hapus item: konfirmasi judul teks salah ditolak, judul benar menghapus item tanpa menyentuh TodoList & Logbook', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const resultList = env.getOrCreateElement('result-list');

  // Klik Ubah pada Sheet Admin TA
  resultList.trigger('click', {
    target: {
      closest: (sel) => {
        if (sel === '.btn-ubah') {
          return {
            className: 'btn-ubah',
            getAttribute: (attr) => attr === 'data-id' ? 'sheet-ta-admin' : null
          };
        }
        return null;
      }
    }
  });

  const deleteBtn = env.getOrCreateElement('btn-item-delete');
  assert.ok(deleteBtn, 'Tombol Hapus item harus ada di modal Ubah');
  deleteBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Tampil form konfirmasi hapus
  const confirmInput = env.getOrCreateElement('input-confirm-delete');
  const confirmBtn = env.getOrCreateElement('btn-confirm-delete');

  assert.ok(confirmInput, 'Input konfirmasi hapus harus ada');
  assert.equal(confirmBtn.disabled, true, 'Tombol hapus permanen harus nonaktif di awal');

  // Coba judul salah
  confirmInput.value = 'Judul Lain Salah';
  confirmInput.trigger('input');
  assert.equal(confirmBtn.disabled, true, 'Tombol hapus permanen harus tetap nonaktif jika judul salah');

  // Ketik judul yang benar (abaikan huruf besar-kecil)
  confirmInput.value = 'sheet admin ta';
  confirmInput.trigger('input');
  assert.equal(confirmBtn.disabled, false, 'Tombol hapus permanen harus aktif saat judul cocok');

  // Klik konfirmasi hapus
  confirmBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Modal tertutup
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah hapus');

  // Periksa data tersimpan
  const savedData = JSON.parse(env.store['indeks_v1']);
  assert.ok(!savedData.items.some(it => it.id === 'sheet-ta-admin'), 'Item sheet-ta-admin harus terhapus');

  // Periksa todo: harus tetap utuh, tidak ada lagi yang dilepas
  const relatedTodo = savedData.todo.find(t => t.id === 't1');
  assert.ok(relatedTodo, 'Todo t1 harus tetap ada');
  assert.equal(relatedTodo.teks, 'Validasi 20 draft - kumpul Jumat',
    'Teks TodoList harus utuh setelah item dihapus');
  assert.equal(relatedTodo.deadline, '2026-10-03', 'Deadline TodoList harus utuh');
  assert.equal(relatedTodo.done, false, 'Status TodoList harus utuh');
  // Penunjuk item sudah dibuang dari bentuk entri, jadi penghapusan item
  // tidak punya apa pun untuk dilepas sama sekali.
  assert.equal('item_id' in relatedTodo, false,
    'Bentuk TodoList tidak lagi memuat penunjuk item');

  // Periksa log: harus tetap utuh, tidak ada lagi yang dilepas
  const relatedLog = savedData.logs.find(l => l.id === 'l1');
  assert.ok(relatedLog, 'Log l1 harus tetap ada');
  assert.equal(relatedLog.teks, 'Input 20 data', 'Teks logbook harus utuh setelah item dihapus');
  assert.equal(relatedLog.date, '2026-09-29', 'Tanggal logbook harus utuh');
  assert.equal('item_id' in relatedLog, false,
    'Bentuk logbook tidak lagi memuat penunjuk item');
});

test('Tiket 06 - Validasi CSS: modal lebar 640px, baris search dan tambah, tombol teks destruktif tanpa kotak', () => {
  const css = fs.readFileSync(styleCssPath, 'utf8');

  // Modal lebar 640px
  assert.match(css, /max-width:\s*640px/, 'Modal harus mendukung lebar 640px');

  // Tombol destruktif teks merah tanpa kotak
  assert.match(css, /\.btn-text-danger/, 'Tombol destruktif harus memakai kelas .btn-text-danger');
  assert.doesNotMatch(css, /\.btn-danger\s*\{/, 'Tidak boleh ada class .btn-danger kotak solid');
});

test('Tiket 06 - Verifikasi Fix Review: Tombol Ubah pada item yang baru ditambah membuka modal (bebas stale closure)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Tambah item baru
  const btnTambah = env.getOrCreateElement('btn-tambah-item');
  btnTambah.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const titleInput = env.getOrCreateElement('item-title');
  const tagsInput = env.getOrCreateElement('item-tags');
  const linkLabelInput = env.getOrCreateElement('link-label-0');
  const linkUrlInput = env.getOrCreateElement('link-url-0');
  const saveBtn = env.getOrCreateElement('btn-item-save');

  titleInput.value = 'Item Dinamis Baru';
  titleInput.trigger('input');
  tagsInput.value = 'dinamis, uji';
  tagsInput.trigger('input');
  linkLabelInput.value = 'Link Uji';
  linkLabelInput.trigger('input');
  linkUrlInput.value = 'https://uniga.ac.id/dinamis';
  linkUrlInput.trigger('input');

  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 0, 'Modal tambah tertutup');

  // Sekarang coba klik Ubah pada item yang baru ditambahkan
  const resultList = env.getOrCreateElement('result-list');
  resultList.trigger('click', {
    target: {
      closest: (sel) => {
        if (sel === '.btn-ubah') {
          return {
            className: 'btn-ubah',
            getAttribute: (attr) => attr === 'data-id' ? 'item-dinamis-baru' : null
          };
        }
        return null;
      }
    }
  });

  assert.equal(env.activeModals.length, 1, 'Modal Ubah harus berhasil dibuka untuk item yang baru ditambahkan');
  const editTitleInput = env.getOrCreateElement('item-title');
  assert.equal(editTitleInput.value, 'Item Dinamis Baru', 'Modal Ubah harus memuat judul item baru yang baru ditambahkan');
});

test('Tiket 06 - Verifikasi Fix Review: Modal tetap terbuka saat penyimpanan gagal (wireframe §5 & prd §5.10)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // loadData async saat halaman siap
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Simulasikan server menolak penyimpanan (misal data.json sedang terkunci).
  // Dulu ini disimulasikan lewat localStorage.setItem yang melempar; sekarang
  // penyimpanan hanya lewat backend, jadi gagalnya harus datang dari sana.
  const fetchAsli = env.sandbox.fetch;
  env.sandbox.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') {
      return { ok: false, status: 500, text: async () => 'gagal' };
    }
    return fetchAsli(url, opts);
  };

  const btnTambah = env.getOrCreateElement('btn-tambah-item');
  btnTambah.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const titleInput = env.getOrCreateElement('item-title');
  const tagsInput = env.getOrCreateElement('item-tags');
  const linkLabelInput = env.getOrCreateElement('link-label-0');
  const linkUrlInput = env.getOrCreateElement('link-url-0');
  const saveBtn = env.getOrCreateElement('btn-item-save');

  titleInput.value = 'Item Gagal Simpan';
  titleInput.trigger('input');
  tagsInput.value = 'gagal, uji';
  tagsInput.trigger('input');
  linkLabelInput.value = 'Link';
  linkLabelInput.trigger('input');
  linkUrlInput.value = 'https://uniga.ac.id';
  linkUrlInput.trigger('input');

  saveBtn.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Modal harus TETAP TERBUKA agar isian form tidak hilang
  assert.equal(env.activeModals.length, 1, 'Modal harus tetap terbuka saat penyimpanan gagal');
  assert.equal(titleInput.value, 'Item Gagal Simpan', 'Isian form tidak boleh hilang');
});

test('Tiket 06 - Verifikasi Fix Review: Tombol Escape saat modal terbuka tidak menutup modal (wireframe §8)', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  // detectStorageMode lalu loadData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const btnTambah = env.getOrCreateElement('btn-tambah-item');
  btnTambah.trigger('click');
  // saveData async sejak tiket 11
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(env.activeModals.length, 1, 'Modal terbuka');

  // Tekan Escape di document
  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Modal harus tetap terbuka saat Escape ditekan sesuai wireframe §8');
});

// Menempel domain telanjang harusnya tetap jadi tautan yang bisa dibuka.
// Tanpa ini, peramban memperlakukannya sebagai path relatif dan tautannya
// mati tanpa pesan apa pun.
test('Tiket 01 - Awalan tautan hanya untuk domain telanjang', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { normalisasiTautan } = env.sandbox;

  const BS = String.fromCharCode(92);
  const pathDrive = 'D:' + BS + 'Arsip' + BS + 'SK.xlsx';
  const pathUnc = BS + BS + 'server' + BS + 'share' + BS + 'x.docx';

  assert.equal(normalisasiTautan('https://lib.uniga.ac.id/x').url, 'https://lib.uniga.ac.id/x',
    'URL berskema dibiarkan apa adanya');
  assert.equal(normalisasiTautan('http://localhost:8089/bulian').url, 'http://localhost:8089/bulian',
    'Skema http juga dibiarkan');

  assert.equal(normalisasiTautan('docs.google.com/spreadsheets/d/abc').url,
    'https://docs.google.com/spreadsheets/d/abc', 'Domain telanjang dapat awalan');
  assert.equal(normalisasiTautan('  lib.uniga.ac.id  ').url, 'https://lib.uniga.ac.id',
    'Domain telanjang yang dikelilingi spasi juga dapat awalan dan jadi rapi');

  assert.equal(normalisasiTautan(pathDrive).url, pathDrive, 'Path drive tidak boleh mendapat awalan');
  assert.equal(normalisasiTautan('D:').url, 'D:', 'Drive tanpa path tetap sah');
  assert.equal(normalisasiTautan(pathUnc).url, pathUnc, 'Path UNC tidak boleh mendapat awalan');
  assert.equal(normalisasiTautan('file:///D:/arsip/sk.xlsx').url, 'file:///D:/arsip/sk.xlsx',
    'Skema file tidak boleh mendapat awalan');

  assert.equal(normalisasiTautan(pathDrive).isLocal, true, 'Path drive tetap ditandai lokal');
  assert.equal(normalisasiTautan(pathUnc).isLocal, true, 'Path UNC tetap ditandai lokal');
  assert.equal(normalisasiTautan('D:').isLocal, true, 'Drive tanpa path tetap lokal');
  assert.equal(normalisasiTautan('example.com').isLocal, false, 'Domain telanjang bukan path lokal');
});

test('Tiket 01 - Label tautan boleh kosong dan diisi dari URL', () => {
  const env = createTestEnvironment();
  const { isiTautan } = env.sandbox;

  const tanpaLabel = isiTautan({ url: 'https://lib.uniga.ac.id/publikasi' });
  assert.ok(tanpaLabel.url.startsWith('https://'), 'URL tetap dipakai');
  assert.ok(tanpaLabel.label && tanpaLabel.label.length > 0, 'Label harus terisi dari URL');

  const berlabel = isiTautan({ label: 'Katalog', url: 'https://lib.uniga.ac.id' });
  assert.equal(berlabel.label, 'Katalog', 'Label yang ditulis sendiri tidak boleh ditimpa');
});


// Tautan yang sudah tersimpan rusak sebelum ada perbaikan ini harus ikut
// bisa dibuka dan disalin, tanpa berkas data ditulis ulang.
test('Tiket 01 - Tautan lama tanpa skema ikut bisa dibuka dan disalin', async () => {
  const BS = String.fromCharCode(92);
  const rusak = {
    version: 1,
    items: [{
      id: 'lama',
      title: 'Dokumen Lama',
      tags: ['arsip'],
      links: [{ url: "lib.uniga.ac.id/publikasi" }],
      catatan: '',
      updated_at: '2026-01-01'
    }],
    todo: [],
    logs: []
  };

  const env = createTestEnvironment(rusak);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  // Tabel: tautan harus punya awalan, bukan	path relatif
  const resultList = env.getOrCreateElement('result-list');
  assert.match(resultList.innerHTML, /href="https:\/\/lib\.uniga\.ac\.id\/publikasi"/,
    'Tautan di tabel harus dapat awalan');

  // Data di berkas tidak boleh ikut ditulis ulang: URL tetap mentah dan label
  // yang dulu tidak ada tetap tidak ada. Label hanya diisi saat ditampilkan.
  const tersimpan = JSON.parse(env.store['indeks_v1']);
  assert.equal(tersimpan.items[0].links[0].url, 'lib.uniga.ac.id/publikasi',
    'Nilai mentah di berkas data tidak boleh diubah');
  assert.equal('label' in tersimpan.items[0].links[0], false,
    'Label tidak boleh disisipkan ke berkas data');

  // Panel harus menunjukkan hal yang sama
  const panel = env.getOrCreateElement('panel-inspeksi');
  env.getOrCreateElement('result-list').trigger('click', {
    target: {
      closest: (sel) => {
        if (sel === '.btn-copy' || sel === '.btn-buka') return null;
        if (sel === '.baris-tabel') {
          return { getAttribute: (a) => (a === 'data-id' ? 'lama' : null) };
        }
        return null;
      }
    }
  });
  assert.match(panel.innerHTML, /https:\/\/lib\.uniga\.ac\.id\/publikasi/,
    'Tautan di panel harus dapat awalan yang sama');

  // Tombol salin harus menyalin bentuk yang bisa dibuka
  const salin = [...panel.innerHTML.matchAll(/data-url="([^"]*)"/g)].map(m => m[1]);
  assert.ok(salin.includes('https://lib.uniga.ac.id/publikasi'),
    'Tombol salin harus membawa URL yang bisa dibuka');
  void BS;
});

// Jalur simpan adalah tempat dua aturan terakhir hidup: label tidak lagi
// mewajibkan isi, dan tautan tanpa label tidak lagi dibuang. Tanpa
// pengujian di sini, kedua aturan itu bisa dibalik tanpa ada yang gagal.
test('Tiket 01 - Tautan tanpa label tetap tersimpan, dan labelnya terisi dari URL', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.getOrCreateElement('btn-tambah-item').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.getOrCreateElement('item-title').value = 'Pedoman Mutu';
  env.getOrCreateElement('item-title').trigger('input');
  env.getOrCreateElement('item-tags').value = 'pedoman, mutu';
  env.getOrCreateElement('item-tags').trigger('input');

  // Hanya URL, tanpa label sama sekali
  env.getOrCreateElement('link-label-0').value = '';
  env.getOrCreateElement('link-label-0').trigger('input');
  env.getOrCreateElement('link-url-0').value = 'lib.uniga.ac.id/pedoman';
  env.getOrCreateElement('link-url-0').trigger('input');

  const saveBtn = env.getOrCreateElement('btn-item-save');
  assert.equal(saveBtn.disabled, false, 'Tombol simpan harus hidup walau label tautan kosong');

  saveBtn.trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const tersimpan = JSON.parse(env.store['indeks_v1']);
  const baru = tersimpan.items.find(it => it.title === 'Pedoman Mutu');
  assert.ok(baru, 'Item baru harus tersimpan');
  assert.equal(baru.links.length, 1, 'Tautan tanpa label tidak boleh dibuang');
  assert.equal(baru.links[0].url, 'lib.uniga.ac.id/pedoman',
    'URL mentah harus tetap tersimpan tanpa awalan');
  assert.equal(baru.links[0].label, 'pedoman',
    'Label harus diambil dari bagian terakhir URL');
});

// Tag yang sudah dipakai disusun dari data, bukan dari daftar terpisah yang
// bisa basi. Huruf kecil dan unik, karena itulah bentuk yang disimpan.
test('Tiket 02 - Pengumpul tag unik dan huruf kecil dari data', async () => {
  const env = createTestEnvironment();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { kumpulkanTag } = env.sandbox;

  const items = [
    { id: 'a', tags: ['wisuda', 'ta'] },
    { id: 'b', tags: ['TA', 'wisuda'] },
    { id: 'c', tags: ['sheet'] },
    { id: 'd', tags: [] },
    { id: 'e' },
    { id: 'f', tags: ['wisuda', null, '  '] },
    { id: 'g', tags: 'bukan array' }
  ];

  // Array dari dalam sandbox punya prototype berbeda, jadi disalin ke
  // realm pengujian dulu; perbandingan ketat akan gagal tanpa itu.
  assert.deepEqual(Array.from(kumpulkanTag(items)), ['sheet', 'ta', 'wisuda'],
    'Tag unik, huruf kecil, tanpa duplikat, dan terurut');

  assert.deepEqual(Array.from(kumpulkanTag([])), [], 'Data kosong menghasilkan daftar kosong');
  assert.deepEqual(Array.from(kumpulkanTag(null)), [], 'Data yang bukan array dianggap kosong');
});

test('Tiket 02 - Saran tag memuat setiap tag yang terpakai, tidak memuat yang lain', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const { kumpulkanTag } = env.sandbox;

  const saran = kumpulkanTag(exampleData.items);

  // Setiap tag yang benar-benar dipakai data contoh harus muncul
  const terpakai = new Set();
  for (const item of exampleData.items) {
    for (const tag of item.tags || []) terpakai.add(tag);
  }
  for (const tag of terpakai) {
    assert.ok(saran.includes(tag), `Tag yang terpakai "${tag}" harus ada di saran`);
  }

  // Dan tidak boleh ada yang tidak dipakai
  const semua = ['pajak', 'inventaris', 'zzz'];
  for (const tag of semua) {
    assert.ok(!saran.includes(tag), `Tag yang tidak terpakai "${tag}" tidak boleh muncul`);
  }

  // Tidak ada duplikat
  assert.equal(new Set(saran).size, saran.length, 'Saran tidak boleh punya duplikat');
});

// Tiket 02: kolom pemilihan item menutup hilang dari form, dan hasil simpan
// tidak lagi membawa penunjuk item. Tes bentuk ini yang membuktikan perubahan
// terjadi, bukan hanya tampilan yang hilang.
test('Tiket 02 - Form dan hasil simpan tidak lagi membawa item tertaut', async () => {
  const exampleData = JSON.parse(fs.readFileSync(exampleJsonPath, 'utf8'));
  const env = createTestEnvironment(exampleData);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  env.getOrCreateElement('btn-tambah-item').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const modal = env.activeModals[0];
  assert.ok(modal, 'Modal tambah item harus terbuka');
  assert.doesNotMatch(modal.innerHTML, /todo-item-id/,
    'Form item tidak lagi memilih item tertaut');
  assert.doesNotMatch(modal.innerHTML, /Tanpa tautan/,
    'Kalimat tanpa tautan tidak lagi muncul di form');

  env.getOrCreateElement('item-title').value = 'Pedoman Mutu';
  env.getOrCreateElement('item-title').trigger('input');
  env.getOrCreateElement('item-tags').value = 'pedoman';
  env.getOrCreateElement('item-tags').trigger('input');
  env.getOrCreateElement('link-label-0').value = 'Buka';
  env.getOrCreateElement('link-label-0').trigger('input');
  env.getOrCreateElement('link-url-0').value = 'https://contoh.test/pedoman';
  env.getOrCreateElement('link-url-0').trigger('input');

  env.getOrCreateElement('btn-item-save').trigger('click');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const tersimpan = JSON.parse(env.store['indeks_v1']);
  const baru = tersimpan.items.find(it => it.title === 'Pedoman Mutu');
  assert.ok(baru, 'Item baru harus tersimpan');
  assert.equal('item_id' in baru, false,
    'Penunjuk item tidak boleh ikut tersimpan');
});
