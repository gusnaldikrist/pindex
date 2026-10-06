// Backend palsu untuk test.
//
// Aplikasi hanya punya satu jalur, jadi setiap harness harus memberi server
// yang menjawab. Dulu harness bisa membiarkan fetch selalu gagal karena
// aplikasi lalu memakai localStorage; sekarang tidak ada fallback itu.

function kosong() {
  return { version: 1, items: [], todo: [], logs: [] };
}

/**
 * Buat fetch yang berperilaku seperti pindex.exe.
 *
 * Data disimpan di objek store mil.pemanggil, di kunci yang sama dengan
 * yang dulu dipakai localStorage. Ini disengaja: assertion test yang sudah
 * ada (`store.indeks_v1`) tetap memeriksa isi yang benar tanpa perlu ditulis
 * ulang, sementara aplikasi sendiri tidak pernah menyentuh localStorage lagi.
 *
 * Yang diperiksa test berubah makna, bukan bentuknya: `store` bukan lagi
 * penyimpanan browser, melainkan isi berkas data.json di server.
 *
 * @param {object} store        Objek tempat data server disimpan
 * @param {object} [opsi]
 * @param {boolean} [opsi.gagalSimpan]  POST /api/data menjawab 500
 * @param {boolean} [opsi.gagalBaca]    GET /api/data menjawab 500
 */
export function buatBackendPalsu(store, opsi = {}) {
  const KUNCI = 'indeks_v1';
  const simpanan = [];
  const permintaanOpen = [];
  let jumlahRequest = 0;

  if (!store[KUNCI]) store[KUNCI] = JSON.stringify(kosong());

  const backend = {
    async fetch(url, options = {}) {
      jumlahRequest++;
      const method = options.method || 'GET';

      if (url === '/api/data' && method === 'POST') {
        if (opsi.gagalSimpan) {
          return { ok: false, status: 500, text: async () => 'gagal' };
        }
        simpanan.push(options.body);
        store[KUNCI] = options.body;
        return { ok: true, status: 200, text: async () => '' };
      }

      if (url === '/open') {
        const parsed = JSON.parse(options.body || '{}');
        permintaanOpen.push(parsed.path);
        return { ok: true, status: 200, text: async () => '' };
      }

      if (opsi.gagalBaca) {
        return { ok: false, status: 500, text: async () => 'gagal' };
      }
      return { ok: true, status: 200, text: async () => store[KUNCI] };
    },

    /** Semua badan yang pernah dikirim lewat POST /api/data. */
    getSimpanan: () => simpanan.slice(),

    /** Semua path yang pernah dikirim lewat POST /open. */
    getPermintaanOpen: () => permintaanOpen.slice(),

    /** Berapa kali fetch dipanggil. */
    getJumlahRequest: () => jumlahRequest,

    /** Ubah perilaku di tengah test. */
    setGagal({ simpan, baca } = {}) {
      opsi.gagalSimpan = Boolean(simpan);
      opsi.gagalBaca = Boolean(baca);
    }
  };

  return backend;
}

/** Fetch yang selalu ditolak, untuk menguji halaman tanpa server. */
export async function fetchSelaluGagal() {
  throw new TypeError('Failed to fetch');
}
