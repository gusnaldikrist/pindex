import test from 'node:test';
import { buatBackendPalsu } from './helpers/fake-backend.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Test untuk module confirmDestructive (tiket 08 review arsitektur, kandidat 1).
// Modul ini menggantikan dua salinan showDeleteTodoConfirmation dan
// showDeleteLogConfirmation yang sebelumnya kembar 143 baris.

const repoRoot = path.resolve('.');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
const searchJsPath = path.join(repoRoot, 'src', 'frontend', 'search.js');
const adapterJsPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');

// Harness minimal: cukup untuk satu modal konfirmasi.
function createTestEnvironment(initialData = null) {
  const elements = new Map();
  const docListeners = {};
  const activeModals = [];

  function getOrCreateElement(id, tagName = 'div') {
    if (elements.has(id)) return elements.get(id);
    let innerHTML = '', val = '', className = '', disabled = false;
    const style = { display: '' };
    const listeners = {};
    const attributes = new Map();
    elements.set(id, {
      id, tagName: tagName.toUpperCase(), listeners, style,
      getAttribute: (a) => (a === 'id' ? id : (attributes.get(a) || null)),
      setAttribute: (a, v) => attributes.set(a, String(v)),
      removeAttribute: (a) => attributes.delete(a),
      closest: (sel) => (sel.startsWith('.') && className.includes(sel.slice(1))) ? this : null,
      querySelector: (sel) => {
        for (const c of elements.values()) {
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.startsWith('.') && c.className.includes(sel.slice(1))) return c;
        }
        return null;
      },
      querySelectorAll: () => [],
      classList: {
        contains: (cls) => className.split(' ').filter(Boolean).includes(cls),
        toggle() {}, add() {}, remove() {}
      },
      set innerHTML(html) {
        innerHTML = String(html);
        const re = /<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)\/?>|<([a-zA-Z0-9]+)([^>]*\bclass="([^"]+)"[^>]*)\/?>/g;
        for (const m of innerHTML.matchAll(re)) {
          const attrs = m[2] || m[6] || m[9];
          const tag = m[1] || m[5] || m[8];
          const id = m[3] || m[7] || null;
          const cm = attrs.match(/\bclass="([^"]+)"/);
          const fc = cm ? cm[1].split(' ')[0] : null;
          const key = id || (fc ? 'class:' + fc : null);
          if (key) {
            const child = getOrCreateElement(key, tag);
            if (id) child.setAttribute('id', id);
            if (cm) child.className = cm[1];
            child.disabled = /\bdisabled\b/.test(attrs);
          }
        }
      },
      get innerHTML() { return innerHTML; },
      set textContent(t) { innerHTML = String(t); },
      get textContent() { return innerHTML; },
      set value(v) { val = String(v); },
      get value() { return val; },
      set className(c) { className = String(c); },
      get className() { return className; },
      set disabled(d) { disabled = Boolean(d); },
      get disabled() { return disabled; },
      dataset: {},
      addEventListener(e, h) {
        if (!listeners[e]) listeners[e] = [];
        listeners[e].push(h);
      },
      trigger(e, d = {}) { for (const h of listeners[e] || []) h({ target: this, preventDefault() {}, ...d }); },
      focus() {}, select() {}
    });
    return elements.get(id);
  }

  const store = {};
  if (initialData) store.indeks_v1 = JSON.stringify(initialData);
  const backend = buatBackendPalsu(store);

  const domDocument = {
    readyState: 'complete',
    getElementById: (id) => getOrCreateElement(id),
    querySelector: (sel) => (sel === '.modal-overlay'
      ? (activeModals.length ? activeModals[activeModals.length - 1] : null) : null),
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
    addEventListener(e, h) {
      if (!docListeners[e]) docListeners[e] = [];
      docListeners[e].push(h);
    },
    trigger: (e, d) => { for (const h of docListeners[e] || []) h(d); }
  };

  const sandbox = {
    document: domDocument,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    },
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

  return {
    sandbox,
    store,
    activeModals,
    getOrCreateElement,
    triggerDoc: domDocument.trigger,
    async settle() {
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
    }
  };
}

const baseConfig = {
  title: 'Hapus Widget',
  warning: 'Menghapus widget ini tidak akan menghapus item dokumen yang ditautkan.',
  confirmPhrase: 'hapus',
  inputId: 'input-confirm-widget',
  confirmButtonId: 'btn-confirm-widget',
  cancelClass: 'btn-cancel-widget',
  closeButtonId: 'btn-close-widget-modal',
  boxId: 'modal-widget-box'
};

test('confirmDestructive: tombol konfirmasi nonaktif sampai frasa diketik persis', async () => {
  const env = createTestEnvironment();
  await env.settle();

  env.sandbox.confirmDestructive({ ...baseConfig, onConfirm: () => {} });

  assert.equal(env.activeModals.length, 1, 'Modal harus terbuka');
  // Panggilannya tetap perlu walau hasilnya tidak dipakai: di DOM palsu,
  // satu-satunya cara membuat elemen adalah memintanya.
  env.getOrCreateElement('input-confirm-widget');
  const btn = env.getOrCreateElement('btn-confirm-widget');

  assert.equal(btn.disabled, true, 'Tombol harus nonaktif saat kosong');

  // Frasa dari pemanggil, jadi persis terhadap apa yang dikonfigurasi
  env.sandbox.confirmDestructive({
    ...baseConfig,
    confirmPhrase: 'hapus item',
    onConfirm: () => {}
  });
  const input2 = env.getOrCreateElement('input-confirm-widget');
  const btn2 = env.getOrCreateElement('btn-confirm-widget');

  input2.value = 'hapus item';
  input2.trigger('input', { target: { value: 'hapus item' } });
  assert.equal(btn2.disabled, false, 'Frasa yang dikonfigurasi harus diterima utuh');

  input2.value = 'hapus';
  input2.trigger('input', { target: { value: 'hapus' } });
  assert.equal(btn2.disabled, true, 'Awalan frasa tidak boleh dianggap cocok');
});

test('confirmDestructive: konfirmasi memanggil onConfirm lalu menutup modal', async () => {
  const env = createTestEnvironment();
  await env.settle();

  let dipanggil = 0;
  env.sandbox.confirmDestructive({
    ...baseConfig,
    onConfirm: async () => { dipanggil++; }
  });

  const input = env.getOrCreateElement('input-confirm-widget');
  input.value = 'hapus';
  input.trigger('input', { target: { value: 'hapus' } });
  env.getOrCreateElement('btn-confirm-widget').trigger('click');
  await env.settle();

  assert.equal(dipanggil, 1, 'onConfirm harus dipanggil tepat sekali');
  assert.equal(env.activeModals.length, 0, 'Modal harus tertutup setelah konfirmasi');
});

test('confirmDestructive: Batal dan tombol tutup tidak memanggil onConfirm', async () => {
  const env = createTestEnvironment();
  await env.settle();

  let dipanggil = 0;
  env.sandbox.confirmDestructive({
    ...baseConfig,
    onConfirm: async () => { dipanggil++; }
  });

  env.activeModals[0].querySelector('.btn-cancel-widget').trigger('click');
  assert.equal(env.activeModals.length, 0, 'Batal harus menutup modal');
  assert.equal(dipanggil, 0, 'Batal tidak boleh memanggil onConfirm');

  // Ulangi dengan tombol tutup
  env.sandbox.confirmDestructive({ ...baseConfig, onConfirm: async () => { dipanggil++; } });
  env.getOrCreateElement('btn-close-widget-modal').trigger('click');
  assert.equal(env.activeModals.length, 0, 'Tombol tutup harus menutup modal');
  assert.equal(dipanggil, 0, 'Tombol tutup tidak boleh memanggil onConfirm');
});

test('confirmDestructive: Escape tidak menutup modal (wireframe bagian 8)', async () => {
  const env = createTestEnvironment();
  await env.settle();

  env.sandbox.confirmDestructive({ ...baseConfig, onConfirm: () => {} });
  assert.equal(env.activeModals.length, 1);

  env.triggerDoc('keydown', { key: 'Escape' });
  assert.equal(env.activeModals.length, 1, 'Escape tidak boleh menutup modal konfirmasi');
});

test('confirmDestructive: modal punya atribut ARIA dan pesan peringatan', async () => {
  const env = createTestEnvironment();
  await env.settle();

  env.sandbox.confirmDestructive({ ...baseConfig, onConfirm: () => {} });

  const overlay = env.activeModals[0];
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  assert.match(overlay.innerHTML, /Hapus Widget/, 'Judul modal harus tampil');
  assert.match(overlay.innerHTML, /tidak akan menghapus item/, 'Peringatan harus tampil');
  assert.match(overlay.innerHTML, /Huruf besar-kecil diabaikan/, 'Petunjuk kepekaan huruf harus tampil');
});

// Isi yang masuk ke modal datang dari pemanggil, jadi harus di-escape.
// Tanpa ini, judul atau peringatan berisi markup akan dieksekusi browser.
test('confirmDestructive: isi dari pemanggil di-escape, bukan disisipkan mentah', async () => {
  const env = createTestEnvironment();
  await env.settle();

  env.sandbox.confirmDestructive({
    ...baseConfig,
    title: '<img src=x onerror=alert(1)>',
    warning: '<script>alert(2)</script>',
    onConfirm: () => {}
  });

  const html = env.activeModals[0].innerHTML;
  assert.ok(!html.includes('<img src=x'), 'Judul tidak boleh disisipkan sebagai markup');
  assert.ok(!html.includes('<script>'), 'Peringatan tidak boleh disisipkan sebagai markup');
  assert.match(html, /&lt;img/, 'Markup harus menjadi entity');
  assert.match(html, /&lt;script&gt;/, 'Tag script harus menjadi entity');
});

test('confirmDestructive: onConfirm gagal tidak menutup modal', async () => {
  const env = createTestEnvironment();
  await env.settle();

  env.sandbox.confirmDestructive({
    ...baseConfig,
    onConfirm: async () => false
  });

  const input = env.getOrCreateElement('input-confirm-widget');
  input.value = 'hapus';
  input.trigger('input', { target: { value: 'hapus' } });
  env.getOrCreateElement('btn-confirm-widget').trigger('click');
  await env.settle();

  assert.equal(env.activeModals.length, 1, 'Modal tetap terbuka bila penyimpanan gagal');
});

test('showDeleteTodoConfirmation memakai module yang sama', async () => {
  const exampleData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src', 'shared', 'data.example.json'), 'utf8'));
  const env = createTestEnvironment(exampleData);
  await env.settle();

  env.sandbox.showDeleteTodoConfirmation(exampleData.todo[0]);

  assert.equal(env.activeModals.length, 1, 'Modal hapus todo harus terbuka');
  assert.match(env.activeModals[0].innerHTML, /Hapus TodoList/, 'Judul harus Hapus TodoList');
  assert.match(env.activeModals[0].innerHTML, /Menghapus TodoList ini/, 'Peringatan harus menyebut TodoList');

  const input = env.getOrCreateElement('input-confirm-delete-todo');
  const btn = env.getOrCreateElement('btn-confirm-delete-todo');
  input.value = 'HAPUS';
  input.trigger('input', { target: { value: 'HAPUS' } });
  btn.trigger('click');
  await env.settle();

  const saved = JSON.parse(env.store.indeks_v1);
  assert.ok(!saved.todo.some(t => t.id === 't1'), 'Todo t1 harus terhapus');
  assert.ok(saved.items.some(i => i.id === 'sheet-ta-admin'), 'Item tertaut tidak boleh terhapus');
});

test('showDeleteLogConfirmation memakai module yang sama', async () => {
  const exampleData = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src', 'shared', 'data.example.json'), 'utf8'));
  const env = createTestEnvironment(exampleData);
  await env.settle();

  env.sandbox.showDeleteLogConfirmation(exampleData.logs[0]);

  assert.match(env.activeModals[0].innerHTML, /Hapus Log/, 'Judul harus Hapus Log');

  const input = env.getOrCreateElement('input-confirm-delete-log');
  const btn = env.getOrCreateElement('btn-confirm-delete-log');
  input.value = 'hapus';
  input.trigger('input', { target: { value: 'hapus' } });
  btn.trigger('click');
  await env.settle();

  const saved = JSON.parse(env.store.indeks_v1);
  assert.ok(!saved.logs.some(l => l.id === 'l1'), 'Log l1 harus terhapus');
  assert.ok(saved.items.some(i => i.id === 'sheet-ta-admin'), 'Item tertaut tidak boleh terhapus');
});