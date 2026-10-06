// storage-adapter.js — Adapter Penyimpanan Penanda
//
// Frontend Penanda hanya punya satu cara jalan: lewat penanda.exe. Frontend
// ini disajikan server dari folder binary, dan semua baca serta tulis data
// lewat API ke server itu.
//
// Tidak ada localStorage. Aplikasi yang dibuka langsung dari Explorer (tanpa
// server) diberi tahu agar menjalankan penanda.exe, bukan diam-diam memakai
// penyimpanan browser - kalau ada fallback, data user bisa terpecah di dua
// tempat tanpa diasadari.
//
// Bagian ini sengaja tanpa DOM; semua akses DOM tetap di app.js.
// Fungsi murni bisa diuji di Node.js tanpa mock peramban.

(function () {
  'use strict';

  const API_DATA_PATH = '/api/data';
  const API_OPEN_PATH = '/open';

  // Batas waktu menunggu backend. Angka pendek supaya halaman yang dibuka
  // dari Explorer tidak menggantung lama sebelum memberi tahu cara yang benar.
  const DETECT_TIMEOUT_MS = 1500;

  /**
   * Menentukan apakah alamat sebuah path lokal Windows.
   * Memakai tiga awalan yang disebut arsitektur bagian 5:
   * huruf drive (D:\), UNC (\\server), dan skema file:.
   *
   * Aturan ini harus sama persis dengan isAllowedLocalPath di
   * src/pro/main.go. Go adalah gerbang endpoint /open, jadi kalau dua
   * implementasi berbeda, user mendapat tombol Buka yang pasti ditolak.
   * Sumber kebenarannya src/shared/local-path-cases.json, yang dibaca test
   * kedua bahasa; jangan menambah kasus di salah satu test saja.
   */
  function isLocalPath(address) {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    if (trimmed === '') return false;

    // Skema file: harus punya isi setelah "file:"
    if (trimmed.toLowerCase().startsWith('file:')) {
      return trimmed.length > 'file:'.length;
    }

    // UNC: \\server\share, minimal harus menyebut nama server
    if (trimmed.startsWith('\\\\')) {
      return trimmed.length > 2;
    }

    // Huruf drive: D: atau D:\Data. Tanpa path tetap sah karena berarti
    // folder kerja drive itu.
    if (trimmed.length >= 2 && trimmed[1] === ':') {
      const drive = trimmed[0];
      if ((drive >= 'a' && drive <= 'z') || (drive >= 'A' && drive <= 'Z')) {
        const rest = trimmed.slice(2);
        return rest === '' || rest.startsWith('\\') || rest.startsWith('/');
      }
    }

    return false;
  }

  // Format area status: nama aplikasi, jumlah item, waktu simpan.
  // Tidak ada lagi nama jalur karena aplikasi hanya punya satu cara jalan.
  function formatStatus(itemCount, savedAt, isLoading) {
    const parts = ['PINDEX - ' + itemCount + ' item'];
    if (isLoading) {
      parts.push('memuat');
    } else if (savedAt) {
      parts.push('tersimpan ' + savedAt);
    }
    return parts.join(' - ');
  }

  function formatSavedTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
  }

  // --------------------------------------------------------------------------
  // Penyimpanan: hanya lewat backend
  // --------------------------------------------------------------------------

  /**
   * Menjalankan fetch dengan batas waktu. Pakai AbortController karena
   * jendela yang dibuka dari Explorer tidak punya server sama sekali, dan
   * permintaan tanpa batas bisa menggantung.
   *
   * Parameter fetchImpl dipakai test; production tinggalkan kosong agar
   * memakai fetch bawaan browser.
   */
  async function fetchWithTimeout(url, options, timeoutMs, fetchImpl) {
    const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) throw new Error('fetch tidak tersedia di lingkungan ini');

    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs || DETECT_TIMEOUT_MS);

    try {
      return await doFetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  /** Baca seluruh isi berkas data dari backend. */
  async function readRemote(fetchImpl) {
    const response = await fetchWithTimeout(API_DATA_PATH, { method: 'GET' }, DETECT_TIMEOUT_MS, fetchImpl);
    if (!response.ok) {
      throw new Error('Backend menjawab ' + response.status);
    }
    return await response.text();
  }

  /** Tulis seluruh isi berkas data ke backend. */
  async function writeRemote(jsonText, fetchImpl) {
    const response = await fetchWithTimeout(API_DATA_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonText
    }, DETECT_TIMEOUT_MS, fetchImpl);
    if (!response.ok) {
      throw new Error('Backend menjawab ' + response.status);
    }
  }

  /**
   * Buka path lokal lewat backend. Harus lewat backend karena browser
   * memblokir halaman biasa membuka skema berkas (arsitektur bagian 5).
   */
  async function openRemotePath(localPath, fetchImpl) {
    const response = await fetchWithTimeout(API_OPEN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: localPath })
    }, 5000, fetchImpl);
    if (!response.ok) {
      throw new Error('Backend menjawab ' + response.status);
    }
  }

  const api = {
    API_DATA_PATH,
    API_OPEN_PATH,
    isLocalPath,
    formatStatus,
    formatSavedTime,
    fetchWithTimeout,
    readRemote,
    writeRemote,
    openRemotePath
  };

  if (typeof window !== 'undefined') {
    window.PenandaStorage = api;
    window.PindexStorage = api;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.PenandaStorage = api;
    globalThis.PindexStorage = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();