import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve('.');
const adapterPath = path.join(repoRoot, 'src', 'frontend', 'storage-adapter.js');
const appJsPath = path.join(repoRoot, 'src', 'frontend', 'app.js');

function loadAdapter() {
  const sandbox = {
    console, Date, setTimeout, clearTimeout,
    AbortController,
    // Controller minimal yang cukup untuk menguji jalur batal-abort.
    AbortSignal: { prototype: {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, 'utf8'), sandbox);
  return sandbox.module.exports;
}

// Fake fetch yang mencatat panggilan dan mengembalikan jawaban terkontrol.
function createFetchStub(handler) {
  const calls = [];
  const stub = async (url, options = {}) => {
    calls.push({ url, method: options.method, body: options.body });
    return handler(url, options);
  };
  stub.calls = calls;
  return stub;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

// ---------------------------------------------------------------------------
// Path lokal vs alamat web (arsitektur bagian 5)
// ---------------------------------------------------------------------------

test('Tiket 11 - Path lokal: huruf drive, UNC, dan skema file', () => {
  const adapter = loadAdapter();

  for (const addr of ['D:\\', 'C:\\Users\\pustakawan', 'd:/Data', '\\\\server\\share\\data.json', 'file:///D:/Data']) {
    assert.equal(adapter.isLocalPath(addr), true, `"${addr}" harus dianggap path lokal`);
  }
});

test('Tiket 11 - Path lokal: alamat web dan teks biasa bukan path lokal', () => {
  const adapter = loadAdapter();

  for (const addr of ['https://lib.uniga.ac.id', 'http://localhost:8080', 'drive.google.com', 'notas.txt', '', null, undefined]) {
    assert.equal(adapter.isLocalPath(addr), false, `"${addr}" bukan path lokal`);
  }
});

test('Path lokal: D: sah karena berarti folder kerja drive itu', () => {
  const adapter = loadAdapter();

  // Go adalah gerbang endpoint /open, dan Go menerima D:. Test Tiket 11
  // sebelumnya menyatakan sebaliknya, lalu penyelarasan dengan Go
  // (src/shared/local-path-cases.json) menetapkan D: sah supaya kedua
  // bahasa punya satu jawaban.
  assert.equal(adapter.isLocalPath('D:'), true, '"D:" berarti folder kerja drive itu');
  assert.equal(adapter.isLocalPath('D:'), adapter.isLocalPath('D:\\'),
    'D: dan D: harus sama-sama dianggap path lokal');
});

test('Path lokal: alamat tanpa isi ditolak, bukan offered tombol mati', () => {
  const adapter = loadAdapter();

  // Dua bentuk ini dulu dianggap path lokal sehingga UI menampilkan tombol
  // Buka yang pasti ditolak backend dengan 400.
  for (const addr of ['\\\\', 'file:']) {
    assert.equal(adapter.isLocalPath(addr), false,
      `"${addr}" tidak menunjuk apa pun; jangan menawarkan tombol Buka yang pasti gagal`);
  }
});

test('Tiket 11 - Path lokal: alamat web tidak tertukar dengan path lokal', () => {
  const adapter = loadAdapter();

  // Alamat web tetap bukan path lokal, jadi tombolnya tidak berubah jadi Copy.
  for (const addr of ['http://localhost:8080', 'https://docs.google.com/x']) {
    assert.equal(adapter.isLocalPath(addr), false, `"${addr}" bukan path lokal`);
  }
});

// ---------------------------------------------------------------------------
// Area status tiga bagian (PRD 5.9, wireframe bagian 6)
// ---------------------------------------------------------------------------

test('Area status tiga bagian dipisah tanda hubung', () => {
  const adapter = loadAdapter();

  assert.equal(adapter.formatStatus(24, '16:02'), 'PINDEX - 24 item - tersimpan 16:02');
});

test('Area status: kata memuat hanya saat membaca berkas, jam belum ada', () => {
  const adapter = loadAdapter();

  assert.equal(adapter.formatStatus(0, null, true), 'PINDEX - 0 item - memuat');
  // Setelah simpan sukses, jam muncul dan kata memuat hilang
  assert.equal(adapter.formatStatus(24, '16:02', false), 'PINDEX - 24 item - tersimpan 16:02');
});

test('Area status tanpa jam simpan hanya dua bagian', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.formatStatus(4, null), 'PINDEX - 4 item');
});

test('Tiket 11 - Jam simpan memakai format 24 jam dua digit', () => {
  const adapter = loadAdapter();

  assert.equal(adapter.formatSavedTime(new Date(2026, 9, 1, 9, 5)), '09:05');
  assert.equal(adapter.formatSavedTime(new Date(2026, 9, 1, 16, 2)), '16:02');
  assert.equal(adapter.formatSavedTime(new Date(2026, 9, 1, 0, 0)), '00:00');
  assert.equal(adapter.formatSavedTime(new Date(2026, 9, 1, 23, 59)), '23:59');
});

// ---------------------------------------------------------------------------
// Tulis dan buka lewat backend
// ---------------------------------------------------------------------------

test('Tiket 11 - Tulis lewat backend: POST /api/data dengan badan JSON', async () => {
  const adapter = loadAdapter();
  const fetchStub = createFetchStub(() => jsonResponse(200, ''));

  await adapter.writeRemote('{"version":1}', fetchStub);

  assert.equal(fetchStub.calls[0].url, '/api/data');
  assert.equal(fetchStub.calls[0].method, 'POST');
  assert.equal(fetchStub.calls[0].body, '{"version":1}');
});

test('Tiket 11 - Tulis lewat backend: galat dilempar agar pemanggil tahu simpan gagal', async () => {
  const adapter = loadAdapter();
  const fetchStub = createFetchStub(() => jsonResponse(500, ''));

  await assert.rejects(() => adapter.writeRemote('{}', fetchStub), /500/);
});

test('Tiket 11 - Baca lewat backend: galat dilempar', async () => {
  const adapter = loadAdapter();
  const fetchStub = createFetchStub(() => jsonResponse(500, ''));

  await assert.rejects(() => adapter.readRemote(fetchStub), /500/);
});

test('Tiket 11 - Buka path lokal lewat backend: POST /open berisi {path}', async () => {
  const adapter = loadAdapter();
  const fetchStub = createFetchStub(() => jsonResponse(200, ''));

  await adapter.openRemotePath('D:\\Data', fetchStub);

  assert.equal(fetchStub.calls[0].url, '/open');
  assert.equal(fetchStub.calls[0].method, 'POST');
  assert.equal(fetchStub.calls[0].body, '{"path":"D:\\\\Data"}');
});

test('Tiket 11 - Buka path lokal lewat backend: galat dilempar agar bisa fallback Copy', async () => {
  const adapter = loadAdapter();
  const fetchStub = createFetchStub(() => jsonResponse(400, ''));

  await assert.rejects(() => adapter.openRemotePath('D:\\Data', fetchStub), /400/);
});

// ---------------------------------------------------------------------------
// Batas waktu: server yang tidak menjawab tidak boleh menggantung selamanya
// ---------------------------------------------------------------------------

test('Permintaan menggantung dibatasi waktu, bukan menggantung selamanya', async () => {
  const adapter = loadAdapter();
  // Fetch yang tidak pernah selesai, hanya menunggu abort signal.
  const fetchStub = (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal) {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }
  });

  await assert.rejects(
    () => adapter.readRemote(fetchStub),
    /aborted/,
    'Permintaan menggantung harus berakhir dengan galat, bukan menggantung'
  );
});

// ---------------------------------------------------------------------------
// Bentuk berkas: adapter dan app.js harus sepakat soal versi
// ---------------------------------------------------------------------------

test('Tiket 11 - Constanta versi adapter sama dengan yang dipakai app.js', () => {
  const appSource = fs.readFileSync(appJsPath, 'utf8');
  const match = appSource.match(/const supportedVersion\s*=\s*(\d+)/);
  assert.ok(match, 'app.js harus mendeklarasikan supportedVersion');

  // Frontend menerima lebih dari satu versi: field baru pada todo opsional,
  // jadi berkas lama tidak perlu dimigrasi. Backend harus punya daftar yang
  // sama, kalau tidak satu sisi akan menolak berkas yang diterima sisi lain.
  const diterima = appSource.match(/const VERSI_DITERIMA\s*=\s*\[([^\]]*)\]/);
  assert.ok(diterima, 'app.js harus mendeklarasikan VERSI_DITERIMA');
  const versiFrontend = diterima[1].split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
  assert.ok(versiFrontend.includes(1),
    'Frontend harus tetap menerima versi tertua, karena field baru selalu opsional');
  assert.ok(versiFrontend.includes(Number(match[1])),
    'Frontend harus menerima versi yang sedang ditulis');
  assert.equal(Math.max(...versiFrontend), Math.max(...versiFrontend.slice().sort((a, b) => a - b)),
    'Daftar versi frontend harus urut');

  const goSource = fs.readFileSync(path.join(repoRoot, 'src', 'pro', 'main.go'), 'utf8');
  const goMatch = goSource.match(/supportedVersion\s*=\s*(\d+)/);
  assert.ok(goMatch, 'main.go harus mendeklarasikan supportedVersion');

  assert.equal(match[1], goMatch[1], 'Frontend dan backend harus memakai angka versi yang sama');

  const goDaftar = goSource.match(/func versiDiterima\(\)\s*\[\]float64\s*\{\s*return\s*\[\]float64\{([^}]*)\}/);
  assert.ok(goDaftar, 'main.go harus mendeklarasikan versiDiterima');
  const versiBackend = goDaftar[1].split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
  assert.deepEqual(versiBackend, versiFrontend, 'Frontend dan backend harus menerima versi yang sama');
});

test('adapter tidak lagi mengekspor jalur penyimpanan', () => {
  // Jalur Lite dihapus: tidak ada lagi kunci localStorage, mode, atau
  // fungsi baca-tulis lokal. Kalau salah satunya kembali, Lite tumbuh lagi.
  const adapter = loadAdapter();

  for (const nama of ['STORAGE_KEY', 'MODE_LITE', 'MODE_PRO', 'detectMode', 'readLocal', 'writeLocal', 'detectModeFromResponse']) {
    assert.equal(nama in adapter, false, `${nama} tidak boleh ada di adapter`);
  }
});