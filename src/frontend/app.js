// app.js — Aplikasi Penanda
//
// Dimuat sebagai script biasa (bukan ES module), disajikan penanda.exe dari
// folder binary lewat HTTP.

(function () {
  'use strict';

  // Adapter penyimpanan dimuat sebelum app.js di index.html.
  const storage = (typeof window !== 'undefined' && window.PenandaStorage)
    ? window.PenandaStorage
    : (typeof PenandaStorage !== 'undefined' ? PenandaStorage : null);

  if (!storage) {
    // app.js tidak boleh jalan tanpa adapter: semua baca dan tulis data
    // melewati lapisan itu.
    throw new Error('storage-adapter.js harus dimuat sebelum app.js');
  }

  // Pesan untuk halaman yang dibuka tanpa server. Kondisi ini nyata: orang
  // bisa salah klik index.html di folder frontend. Pesannya menyebut apa
  // yang harus dilakukan, bukan galat teknis.
  //
  // Tidak ada fallback localStorage di sini. Kalau ada, data user bisa
  // diam-diam terpecah di dua tempat: satu di browser, satu di data.json.
  const NO_SERVER_MESSAGE = 'Aplikasi ini berjalan lewat penanda.exe. Tutup halaman ini, lalu jalankan penanda.exe.';

  function createEmptyData() {
    return {
      version: 1,
      items: [],
      todo: [],
      logs: []
    };
  }

  function normalizeData(raw) {
    if (!raw || typeof raw !== 'object') {
      return createEmptyData();
    }
    return {
      version: raw.version || 1,
      items: Array.isArray(raw.items) ? raw.items : [],
      todo: Array.isArray(raw.todo) ? raw.todo : [],
      logs: Array.isArray(raw.logs) ? raw.logs : []
    };
  }

  const state = {
    activeTab: 'indeks',
    focusedItemId: null,
    sortOrder: 'recent',
    todoFilterStatus: 'semua',
    todoSearchQuery: '',
    logSearchQuery: '',
    logDateFrom: '',
    logDateTo: '',
    // Alasan singkat kalau ada masalah; null kalau semua baik-baik saja
    statusMessage: null,
    data: createEmptyData(),
    savedAt: null,
    storageBlocked: false
  };

  // Kalimat keadaan kosong panel. Dipisah dari teks lain supaya tes bisa
  // memeriksa kalimatnya, bukan sekadar elemennya ada.
  const KALIMAT_PANEL_KOSONG = 'Pilih salah satu baris untuk melihat detailnya';

  function getSvgIcon(name, size = 14) {
    const s = size;
    switch (name) {
      case 'buka':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
      case 'copy':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
      case 'ubah':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>`;
      case 'chevron':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      case 'grid':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>`;
      case 'table':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="1"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="9" x2="9" y2="21"></line></svg>`;
      case 'archive':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>`;
      case 'briefcase':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
      case 'refresh':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`;
      case 'clipboard':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>`;
      case 'book':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path></svg>`;
      case 'cloud':
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`;
      case 'file':
      default:
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
    }
  }

  function formatCatatanWithCode(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
                  .replace(/\b([\w-]+\.(?:xlsx|docx|pdf|json|csv|sql|txt|exe|bat|ps1))\b/gi, '<code>$1</code>');
  }

  function updateNavTabCounts() {
    const indeksCountEl = document.getElementById('tab-count-indeks');
    const todoCountEl = document.getElementById('tab-count-todo');
    const logCountEl = document.getElementById('tab-count-log');

    if (indeksCountEl) {
      const count = (state.data && Array.isArray(state.data.items)) ? state.data.items.length : 0;
      indeksCountEl.textContent = String(count);
    }
    if (todoCountEl) {
      const uncompleted = (state.data && Array.isArray(state.data.todo)) ? state.data.todo.filter(t => !t.done).length : 0;
      todoCountEl.textContent = String(uncompleted);
    }
    if (logCountEl) {
      const logCount = (state.data && Array.isArray(state.data.logs)) ? state.data.logs.length : 0;
      logCountEl.textContent = String(logCount);
    }
  }

  function updateStatusBar() {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;

    updateNavTabCounts();

    const count = (state.data && Array.isArray(state.data.items)) ? state.data.items.length : 0;

    if (state.statusMessage) {
      statusBar.className = 'status-bar error';
      statusBar.textContent = state.statusMessage;
      return;
    }

    statusBar.className = 'status-bar';
    statusBar.textContent = storage.formatStatus(count, state.savedAt, state.isLoading);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildRekapText(results) {
    let countLapis1 = 0;
    let countLapis2 = 0;
    let countLapis3 = 0;

    for (const r of results) {
      if (r.lapis === 1) countLapis1++;
      else if (r.lapis === 2) countLapis2++;
      else if (r.lapis === 3) countLapis3++;
    }

    const parts = [];
    if (countLapis1 > 0) parts.push(`${countLapis1} langsung`);
    if (countLapis2 > 0) parts.push(`${countLapis2} terkait`);
    if (countLapis3 > 0) parts.push(`${countLapis3} dari catatan`);

    return parts.join(', ');
  }

  function showToast(message) {
    const existing = document.querySelector('.toast-notice');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2500);
  }

  function showManualCopyModal(text) {
    const existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-copy-title">
        <div id="modal-copy-title" class="modal-message">Gagal menyalin - pilih dan salin manual dari kotak di bawah</div>
        <input type="text" class="modal-input" readonly value="${escapeHtml(text)}">
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-close-modal">Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.modal-input');
    if (input) {
      input.focus();
      input.select();
    }

    const closeBtn = overlay.querySelector('.btn-close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      });
    }
  }

  /**
   * Membuka path lokal Windows lewat backend. Harus lewat backend karena
   * browser memblokir halaman biasa membuka skema berkas (arsitektur bagian 5).
   */
  async function openLocalPathViaBackend(localPath) {
    try {
      await storage.openRemotePath(localPath);
      state.statusMessage = null;
      updateStatusBar();
    } catch (err) {
      // Tiket 11 langkah 7: tampilkan alasan singkat di area status dan
      // sisakan tombol Copy sebagai jalan keluar. Alasan dari backend ikut
      // ditampilkan supaya user tahu itu alamat yang ditolak, bukan server
      // yang mati.
      const reason = (err && err.message) ? ' (' + err.message + ')' : '';
      state.statusMessage = 'Gagal membuka path lokal. Gunakan tombol Copy' + reason;
      updateStatusBar();
    }
  }

  function copyToClipboard(text, isLocal) {
    if (!text) return;

    function onCopySuccess() {
      // Path lokal punya tombol Buka, jadi menyalinnya biasanya jalan keluar
      // saja - misalnya tombol Buka gagal karena backend tidak merespons.
      if (isLocal) {
        showToast('Path sudah disalin; tombol Buka adalah cara yang lebih cepat');
      } else {
        // Tanpa ini, menyalin tautan web berhasil tanpa kabar apa pun dan
        // tidak ada cara tahu itu berhasil. Ikonnya pun redup sampai baris
        // disorot, jadi tanpa konfirmasi kliknya terasa seperti tidak terjadi.
        showToast('Tautan disalin');
      }
    }

    function tryClipboardApi() {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text)
          .then(onCopySuccess)
          .catch(() => {
            showManualCopyModal(text);
          });
      } else {
        showManualCopyModal(text);
      }
    }

    // Cara 1: Coba cara sinkron execCommand (mempertahankan user activation di file://)
    let syncSuccess = false;
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      syncSuccess = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      syncSuccess = false;
    }

    if (syncSuccess) {
      onCopySuccess();
      return;
    }

    // Cara 2: Navigator clipboard API bila cara sinkron ditolak / gagal
    tryClipboardApi();
  }

  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Tanggal hari ini untuk footer. Memakai API bawaan peramban supaya tidak
  // ada daftar nama hari dan bulan yang harus dirawat di dalam kode, dan
  // tanpa permintaan ke luar sesuai syarat offline. Bila peramban tidak punya
  // data locale, jatuh ke tanggal ISO: lebih kurang enak dibaca, tapi jujur
  // dan bukan menampilkan sesuatu yang salah.
  function formatTanggalHariIni() {
    const now = new Date();
    try {
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(now);
    } catch {
      return getTodayDateString();
    }
  }

  // Footer pernah menampilkan "Database Lokal: Siap" sebagai teks tetap.
  // Nilainya tidak pernah ditulis siapa pun, jadi tidak bisa berubah dan
  // tidak bisa melaporkan kegagalan apa pun. Diganti tanggal hari ini,
  // yang memang bisa berubah dan tidak mengada hal yang tidak diketahui.
  function initTanggalFooter() {
    const el = document.getElementById('status-counts');
    if (!el) return;
    el.textContent = formatTanggalHariIni();
  }

  function generateItemId(title, existingItems) {
    if (!title) return 'item';
    let slug = String(title)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) slug = 'item';

    const existingIds = new Set(
      (Array.isArray(existingItems) ? existingItems : [])
        .map(item => item.id)
        .filter(id => Boolean(id))
    );

    if (!existingIds.has(slug)) {
      return slug;
    }

    let counter = 2;
    while (existingIds.has(`${slug}-${counter}`)) {
      counter++;
    }
    return `${slug}-${counter}`;
  }

  // Tag yang sedang terpakai, disusun dari data setiap kali dibutuhkan:
  // huruf kecil, unik, terurut. Tidak ada daftar tag yang tersimpan terpisah,
  // jadi tidak bisa basi dan tidak perlu disegarkan sendiri.
  //
  // Satu helper dipakai bersama oleh saran di form item dan oleh bagian lain
  // yang perlu tahu seluruh tag yang terpakai, supaya keduanya tidak bisa
  // berbeda pendapat tentang daftar ini.
  function kumpulkanTag(items) {
    if (!Array.isArray(items)) return [];
    const himpun = new Set();
    for (const item of items) {
      const tags = item && Array.isArray(item.tags) ? item.tags : [];
      for (const raw of tags) {
        if (raw === null || raw === undefined) continue;
        const tag = String(raw).trim().toLowerCase();
        if (tag !== '') himpun.add(tag);
      }
    }
    return Array.from(himpun).sort();
  }

  function validateTags(tagsInput) {
    if (typeof tagsInput !== 'string' || tagsInput.trim() === '') {
      return { valid: false, tags: [], error: 'Tag minimal 1 dan tidak boleh kosong' };
    }

    const rawTokens = tagsInput.split(',');
    const parsedTags = [];

    for (const token of rawTokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      if (/[A-Z]/.test(token)) {
        return { valid: false, tags: [], error: `Tag tidak boleh memuat huruf besar ("${trimmed}"). Gunakan huruf kecil tanpa spasi.` };
      }

      if (token.endsWith(' ') || /\s/.test(trimmed)) {
        return { valid: false, tags: [], error: `Tag tidak boleh memuat spasi ("${trimmed}"). Gunakan huruf kecil tanpa spasi.` };
      }

      if (!/^[a-z0-9-]+$/.test(trimmed)) {
        return { valid: false, tags: [], error: `Tag hanya boleh memuat huruf kecil, angka, dan tanda hubung ("${trimmed}").` };
      }

      if (!parsedTags.includes(trimmed)) {
        parsedTags.push(trimmed);
      }
    }

    if (parsedTags.length === 0) {
      return { valid: false, tags: [], error: 'Tag minimal 1 dan tidak boleh kosong' };
    }

    return { valid: true, tags: parsedTags, error: '' };
  }

  function closeActiveModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function showDeleteConfirmation(item) {
    const modalBox = document.getElementById('modal-item-box');
    if (!modalBox) return;

    modalBox.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Hapus Item</div>
        <button type="button" class="btn-close" id="btn-close-delete-modal" aria-label="Tutup">&times;</button>
      </div>
      <div class="modal-body delete-confirm-box">
        <div class="delete-warning">
          Menghapus <strong>${escapeHtml(item.title || '')}</strong> akan melepas tautan di todo dan log sekaligus. Aksi ini tidak dapat dibatalkan.
        </div>
        <div class="form-group">
          <label class="form-label" for="input-confirm-delete">Ketik judul item persis untuk konfirmasi:</label>
          <input type="text" id="input-confirm-delete" class="form-input" placeholder="${escapeHtml(item.title || '')}" autocomplete="off">
          <div class="form-hint">Huruf besar-kecil diabaikan</div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-actions">
          <button type="button" class="btn btn-secondary btn-cancel-delete">Batal</button>
          <button type="button" id="btn-confirm-delete" class="btn-text-danger" disabled style="font-weight: 600; padding: 6px 12px;">Hapus Permanen</button>
        </div>
      </div>
    `;

    const inputConfirm = document.getElementById('input-confirm-delete');
    const confirmBtn = document.getElementById('btn-confirm-delete');
    const cancelBtn = modalBox.querySelector('.btn-cancel-delete');
    const closeBtn = document.getElementById('btn-close-delete-modal');

    if (inputConfirm && confirmBtn) {
      inputConfirm.addEventListener('input', (e) => {
        const typed = e.target.value.trim().toLowerCase();
        const target = String(item.title || '').trim().toLowerCase();
        confirmBtn.disabled = (typed !== target);
      });
      inputConfirm.focus();
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        openItemModal(item);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeActiveModal);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const typed = inputConfirm ? inputConfirm.value.trim().toLowerCase() : '';
        const target = String(item.title || '').trim().toLowerCase();
        if (typed !== target) return;

        if (state.data && Array.isArray(state.data.items)) {
          state.data.items = state.data.items.filter(it => it.id !== item.id);
        }

        if (state.data && Array.isArray(state.data.todo)) {
          state.data.todo.forEach(todo => {
            if (todo.item_id === item.id) {
              todo.item_id = null;
            }
          });
        }

        if (state.data && Array.isArray(state.data.logs)) {
          state.data.logs.forEach(logEntry => {
            if (logEntry.item_id === item.id) {
              logEntry.item_id = null;
            }
          });
        }

        if (state.focusedItemId === item.id) {
          state.focusedItemId = null;
        }

        const saveSuccess = await saveData(state.data);
        if (!saveSuccess) {
          return;
        }

        closeActiveModal();
        renderIndeksView();
      });
    }
  }

// Batas panjang field sop, dalam satuan kode UTF-16 supaya sama dengan
  // validSop di src/pro/main.go. Kalau salah satu sisi menghitung rune dan
  // sisi lain menghitung kode UTF-16, keduanya akan berbeda tepat pada teks
  // sisi lain menghitung kode UTF-16, keduanya akan berbeda tepat pada teks
  const MAKS_SOP = 600;

  // validateSop memeriksa satu nilai field sop.
  //
  // Field ini opsional, jadi nilai yang tidak ada tetap sah. Yang ditolak
  // hanya bentuk yang salah dan yang melebihi batas. Aturannya dibaca dari
  // src/shared/sop-cases.json oleh test JavaScript dan test Go, supaya
  // gerbang backend dan form frontend tidak bisa berbeda pendapat.
  function validateSop(value) {
    if (value === null || value === undefined) {
      return { valid: true, error: '' };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: 'Langkah kerja harus berupa teks' };
    }
    if (value.length > MAKS_SOP) {
      return { valid: false, error: `Langkah kerja maksimal ${MAKS_SOP} karakter` };
    }
    return { valid: true, error: '' };
  }

  // Nomor langkah datang dari elemen daftar terurut, bukan dari perhitungan
  // di skrip, supaya browser yang mengurus nomor, indentasi, dan pengumuman
  // layar baca sekaligus. Yang dibuang di sini hanya nomor yang diketik
  // pengguna sendiri, karena kalau tidak, "1. Cek form" akan tampil jadi
  // "1. 1. Cek form".
  function parseSopSteps(sop) {
    return String(sop || '')
      .split(/\r?\n/)
      .map(baris => baris.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
      .filter(Boolean);
  }

  function buildSopHtml(sop) {
    const langkah = parseSopSteps(sop);
    if (langkah.length === 0) return '';

    return `
      <section class="panel-bagian">
        <div class="panel-bagian-judul">LANGKAH KERJA</div>
        <ol class="panel-sop">
          ${langkah.map(teks => `<li class="panel-sop-langkah">${escapeHtml(teks)}</li>`).join('')}
        </ol>
      </section>`;
  }

  function openItemModal(itemToEdit = null) {
    closeActiveModal();

    const isEdit = Boolean(itemToEdit && itemToEdit.id);
    const initialTitle = isEdit ? (itemToEdit.title || '') : '';
    const initialTags = isEdit && Array.isArray(itemToEdit.tags) ? itemToEdit.tags.join(', ') : '';
    const initialCatatan = isEdit ? (itemToEdit.catatan || '') : '';
    const initialSop = isEdit && typeof itemToEdit.sop === 'string' ? itemToEdit.sop : '';
    let links = isEdit && Array.isArray(itemToEdit.links) && itemToEdit.links.length > 0
      ? itemToEdit.links.map(l => ({ label: l.label || '', url: l.url || '' }))
      : [{ label: '', url: '' }];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="modal-box" id="modal-item-box">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Ubah Item' : 'Tambah Item'}</div>
          <button type="button" class="btn-close" id="btn-close-item-modal" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="item-title">Judul <span class="req">*</span></label>
            <input type="text" id="item-title" class="form-input" maxlength="120" placeholder="Judul item (1-120 karakter)" value="${escapeHtml(initialTitle)}">
            <div id="item-title-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="item-tags">Tag <span class="req">*</span></label>
            <input type="text" id="item-tags" class="form-input" list="tag-tersedia" placeholder="ta, sheet, admin (dipisah koma)" value="${escapeHtml(initialTags)}">
            <datalist id="tag-tersedia">
              ${kumpulkanTag(state.data && state.data.items).map(tag => `<option value="${escapeHtml(tag)}"></option>`).join('')}
            </datalist>
            <div class="form-hint">Huruf kecil tanpa spasi, dipisah koma</div>
            <div id="item-tags-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Link <span class="req">*</span></label>
            <div id="modal-link-rows" class="links-container"></div>
            <div>
              <button type="button" id="btn-add-link" class="btn btn-secondary btn-sm" style="margin-top: 4px;">+ Link lain</button>
            </div>
            <div id="item-links-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="item-catatan">Catatan</label>
            <textarea id="item-catatan" class="form-textarea" maxlength="200" placeholder="Catatan alur kerja / pemicu (opsional, maks 200 karakter)">${escapeHtml(initialCatatan)}</textarea>
            <div class="form-hint">Maksimal 200 karakter</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="item-sop">Langkah Kerja</label>
            <textarea id="item-sop" class="form-textarea" maxlength="600" rows="4" placeholder="Satu baris satu langkah:&#10;Cek form pengajuan&#10;Kirim ke kepala bagian">${escapeHtml(initialSop)}</textarea>
            <div class="form-hint">Opsional, maks 600 karakter. Satu baris satu langkah; nomornya dibuat otomatis jadi tidak perlu diketik.</div>
            <div id="item-sop-error" class="form-error" style="display: none;"></div>
          </div>
        </div>
        <div class="modal-footer">
          ${isEdit ? '<button type="button" id="btn-item-delete" class="btn-text-danger">Hapus item</button>' : '<div></div>'}
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary btn-cancel-modal">Batal</button>
            <button type="button" id="btn-item-save" class="btn btn-primary" disabled>Simpan</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const titleInput = document.getElementById('item-title');
    const tagsInput = document.getElementById('item-tags');
    const catatanInput = document.getElementById('item-catatan');
    const saveBtn = document.getElementById('btn-item-save');
    const linkRowsContainer = document.getElementById('modal-link-rows');
    const addLinkBtn = document.getElementById('btn-add-link');
    const closeBtn = document.getElementById('btn-close-item-modal');
    const cancelBtn = overlay.querySelector('.btn-cancel-modal');
    const deleteBtn = document.getElementById('btn-item-delete');

    function getFormLinks() {
      if (!linkRowsContainer) return [];
      const parsedLinks = [];
      links.forEach((link, idx) => {
        const labelInput = document.getElementById(`link-label-${idx}`);
        const urlInput = document.getElementById(`link-url-${idx}`);
        const labelValue = labelInput ? labelInput.value.trim() : (link.label || '').trim();
        const urlValue = urlInput ? urlInput.value.trim() : (link.url || '').trim();
        parsedLinks.push({ label: labelValue, url: urlValue });
      });
      return parsedLinks;
    }

    function renderLinkRows() {
      if (!linkRowsContainer) return;
      linkRowsContainer.innerHTML = links.map((link, idx) => `
        <div class="link-row" data-index="${idx}">
          <input type="text" id="link-label-${idx}" class="form-input link-label-input" placeholder="Label (mis. Buka Sheet)" maxlength="40" value="${escapeHtml(link.label || '')}">
          <input type="text" id="link-url-${idx}" class="form-input link-url-input" placeholder="URL atau path lokal" value="${escapeHtml(link.url || '')}">
          ${links.length > 1 ? `<button type="button" class="btn btn-secondary btn-sm btn-del-link" data-index="${idx}" title="Hapus link">&times;</button>` : ''}
        </div>
      `).join('');

      links.forEach((link, idx) => {
        const labelInput = document.getElementById(`link-label-${idx}`);
        const urlInput = document.getElementById(`link-url-${idx}`);
        if (labelInput) {
          labelInput.addEventListener('input', (e) => {
            link.label = e.target.value;
            validateForm();
          });
        }
        if (urlInput) {
          urlInput.addEventListener('input', (e) => {
            link.url = e.target.value;
            validateForm();
          });
        }
      });

      const delBtns = linkRowsContainer.querySelectorAll('.btn-del-link');
      delBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          if (!isNaN(idx) && links.length > 1) {
            links.splice(idx, 1);
            renderLinkRows();
            validateForm();
          }
        });
      });
    }

    function validateForm() {
      const titleValue = titleInput ? titleInput.value.trim() : '';
      const tagsValue = tagsInput ? tagsInput.value : '';
      const tagValidationResult = validateTags(tagsValue);
      const formLinks = getFormLinks();

      let linksValid = formLinks.length > 0;
      let hasAnyLinkInput = false;

      for (const formLink of formLinks) {
        if (formLink.label || formLink.url) {
          hasAnyLinkInput = true;
        }
        // Label tidak lagi wajib: yang ditempel orang biasanya URL-nya saja. Yang
        // tetap wajib adalah URL-nya, karena tanpa itu tidak ada yang dibuka.
        if (!formLink.url || formLink.label.length > 40) {
          linksValid = false;
        }
      }

      const isTitleValid = titleValue.length >= 1 && titleValue.length <= 120;
      // validateForm tidak boleh bergantung pada variabel handler simpan,
      // jadi elemennya diambil sendiri di sini.
      const sopFormInput = document.getElementById('item-sop');
      const sopValidation = validateSop(sopFormInput ? String(sopFormInput.value || '').trim() : '');
      const isFormValid = isTitleValid && tagValidationResult.valid && linksValid && sopValidation.valid;

      if (saveBtn) {
        saveBtn.disabled = !isFormValid;
      }

      const titleErrEl = document.getElementById('item-title-error');
      if (titleErrEl) {
        if (titleInput && titleInput.value.length > 120) {
          titleErrEl.textContent = 'Judul maksimal 120 karakter';
          titleErrEl.style.display = 'block';
        } else {
          titleErrEl.textContent = '';
          titleErrEl.style.display = 'none';
        }
      }

      const tagsErrEl = document.getElementById('item-tags-error');
      if (tagsErrEl) {
        if (!tagValidationResult.valid && tagsValue.trim() !== '') {
          tagsErrEl.textContent = tagValidationResult.error;
          tagsErrEl.style.display = 'block';
        } else {
          tagsErrEl.textContent = '';
          tagsErrEl.style.display = 'none';
        }
      }

      const sopErrEl = document.getElementById('item-sop-error');
      if (sopErrEl) {
        if (!sopValidation.valid) {
          sopErrEl.textContent = sopValidation.error;
          sopErrEl.style.display = 'block';
        } else {
          sopErrEl.textContent = '';
          sopErrEl.style.display = 'none';
        }
      }

      const linksErrEl = document.getElementById('item-links-error');
      if (linksErrEl) {
        if (hasAnyLinkInput && !linksValid) {
          linksErrEl.textContent = 'Setiap link wajib memiliki label (maks 40 karakter) dan URL/path';
          linksErrEl.style.display = 'block';
        } else {
          linksErrEl.textContent = '';
          linksErrEl.style.display = 'none';
        }
      }

      return isFormValid;
    }

    renderLinkRows();
    validateForm();

    if (titleInput) {
      titleInput.addEventListener('input', validateForm);
      titleInput.focus();
    }
    if (tagsInput) {
      tagsInput.addEventListener('input', validateForm);
    }
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', () => {
        links.push({ label: '', url: '' });
        renderLinkRows();
        validateForm();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeActiveModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeActiveModal);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!validateForm()) return;

        const title = titleInput.value.trim();
        const tagValidationResult = validateTags(tagsInput.value);
        const cleanCatatan = catatanInput ? catatanInput.value.trim() : '';
        const sopInput = document.getElementById('item-sop');
        const rawSop = sopInput ? String(sopInput.value || '') : '';
        const cleanSop = rawSop.trim();
        // Form validasi sudah menolak nilai yang tidak sah, jadi simpan
        // berhenti di sini kalau ada yang lolos, misalnya nilai yang
        // disisipkan lewat skrip dan bukan diketik.
        if (!validateSop(cleanSop).valid) return;
        // URL mentah tetap disimpan mentah: yang diberi awalan hanya nilai yang
        // dipakai untuk membuka dan menyalin, sehingga berkas data pengguna
        // tidak pernah ditulis ulang karena perbaikan tampilan.
        const cleanLinks = getFormLinks()
          .filter(itemLink => itemLink.url)
          .map(itemLink => ({ label: isiTautan(itemLink).label, url: itemLink.url }));
        const today = getTodayDateString();

        const items = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];

        if (isEdit) {
          const itemIndex = items.findIndex(candidate => candidate.id === itemToEdit.id);
          if (itemIndex >= 0) {
            items[itemIndex].title = title;
            items[itemIndex].tags = tagValidationResult.tags;
            items[itemIndex].links = cleanLinks;
            items[itemIndex].catatan = cleanCatatan;
            items[itemIndex].sop = cleanSop;
            items[itemIndex].updated_at = today;
          }
        } else {
          const newId = generateItemId(title, items);
          items.unshift({
            id: newId,
            title,
            tags: tagValidationResult.tags,
            links: cleanLinks,
            catatan: cleanCatatan,
            sop: cleanSop,
            updated_at: today
          });
        }

        state.data.items = items;
        const saveSuccess = await saveData(state.data);
        if (!saveSuccess) {
          return;
        }

        closeActiveModal();
        renderIndeksView();
      });
    }

    if (deleteBtn && isEdit) {
      deleteBtn.addEventListener('click', () => {
        showDeleteConfirmation(itemToEdit);
      });
    }
  }

  // Satu tempat memutuskan nilai tautan mana yang bisa dipakai. Tabel, panel,
// item terkait, dan tombol salin semuanya membaca dari sini.
//
// Menempel `docs.google.com/x` tanpa skema akan diperlakukan peramban sebagai
// path relatif terhadap localhost, jadi tautannya mati tanpa pesan sama sekali.
// URL berskema dan path lokal tidak boleh disentuh: path lokal justru dibuka
// lewat backend, bukan lewat peramban.
function normalisasiTautan(url) {
  const mentah = (url === null || url === undefined) ? '' : String(url).trim();
  if (mentah === '') return { url: '', isLocal: false };
  if (storage.isLocalPath(mentah)) return { url: mentah, isLocal: true };
  if (/^[a-z][a-z0-9+.-]*:/i.test(mentah)) return { url: mentah, isLocal: false };
  return { url: 'https://' + mentah, isLocal: false };
}

// Label tautan boleh kosong, karena yang ditempel orang biasanya URL-nya saja.
// Kalau kosong, label diambil dari URL supaya tetap terbaca di panel. Label yang
// ditulis sendiri tidak pernah ditimpa.
function labelDariUrl(url) {
  const teks = String(url || '').replace(/\/+$/, '');
  const bagian = teks.split(/[\\/]/);
  return String(bagian.length ? bagian.at(-1) : teks).slice(0, 40);
}

function isiTautan(link) {
  const asal = link || {};
  const hasil = normalisasiTautan(asal.url);
  const labelSendiri = asal.label === null || asal.label === undefined ? '' : String(asal.label).trim();
  return {
    url: hasil.url,
    label: labelSendiri !== '' ? labelSendiri : labelDariUrl(hasil.url)
  };
}

function getPrimaryLinkInfo(item) {
  const primaryLink = (item && Array.isArray(item.links) && item.links.length > 0) ? item.links[0] : null;
  const hasil = normalisasiTautan(primaryLink && primaryLink.url);
  const isi = isiTautan(primaryLink);
  return { link: primaryLink, url: hasil.url, label: isi.label || 'Buka Link', isLocal: hasil.isLocal };
}

  // Bobot tiap tag dibalik terhadap frekuensinya. Tag yang dipakai banyak item
  // hampir tidak membedakan satu item dari yang lain, jadi tidak boleh
  // menentukan urutan: tanpa pembobotan, tag generik seperti "sheet"
  // mengalahkan tag yang benar-benar khas hanya karena jumlahnya banyak.
  function computeRelatedItems(focusedItem, allItems) {
    if (!focusedItem || !Array.isArray(allItems)) return [];

    const tagOf = (item) => (Array.isArray(item.tags) ? item.tags : [])
      .map(tag => String(tag).trim().toLowerCase())
      .filter(Boolean);

    const focusedTags = [...new Set(tagOf(focusedItem))];
    if (focusedTags.length === 0) return [];

    // Berapa item yang memakai tiap tag.
    const frekuensiTag = new Map();
    for (const item of allItems) {
      for (const tag of new Set(tagOf(item))) {
        frekuensiTag.set(tag, (frekuensiTag.get(tag) || 0) + 1);
      }
    }

    const candidates = [];
    for (const item of allItems) {
      if (item.id === focusedItem.id) continue;

      const sama = [...new Set(tagOf(item))].filter(tag => focusedTags.includes(tag));
      if (sama.length > 0) {
        const score = sama.reduce((total, tag) => total + 1 / (frekuensiTag.get(tag) || 1), 0);
        candidates.push({ item, score });
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.item.updated_at || '').localeCompare(a.item.updated_at || '');
    });

    return candidates.slice(0, 3).map(candidate => candidate.item);
  }

  // Konten item terkait dirender ke tepat satu tempat, tergantung mode:
  // baris di bawah tabel pada mode kartu, panel di kanan pada mode tabel.
  // Keduanya tidak boleh menampilkan isi yang sama di saat bersamaan.
  // Tiap item sudah menjadi barisnya sendiri, jadi pemisah antar item tidak
  // perlu lagi: pada bentuk daftar vertikal ia hanya menambah kotak kosong.
  function buildTerkaitHtml(related) {
    return `
      <div class="terkait-header">
        <span>TERKAIT "Biasanya bareng ini":</span>
        <span class="terkait-count">${related.length} item</span>
      </div>
      <div class="terkait-items">
        ${related.map(item => `
          <button type="button" class="terkait-item" data-id="${escapeHtml(item.id || '')}" title="Pilih ${escapeHtml(item.title || '')} di tabel">
            <span class="terkait-judul">${escapeHtml(item.title || '')}</span>
            <span class="terkait-panah" aria-hidden="true">${getSvgIcon('chevron', 12)}</span>
          </button>`).join('')}
      </div>
    `;
  }

  // Baris tabel yang dipilih digulir ke layar. Tanpa itu, klik item terkait
  // mengganti isi panel sementara tabel tetap menampilkan baris lain di luar
  // pandangan.
  function scrollBarisKeLayar(id) {
    if (typeof document.querySelectorAll !== 'function') return;
    const rows = Array.from(document.querySelectorAll('.baris-tabel'));
    const barisDipilih = rows.find(el => el.getAttribute && el.getAttribute('data-id') === id);
    if (barisDipilih && typeof barisDipilih.scrollIntoView === 'function') {
      barisDipilih.scrollIntoView({ block: 'nearest' });
    }
  }

  // Susunan layar tidak lagi berganti, jadi tidak ada yang perlu disinkronkan
  // ulang pada setiap render. Wadah split dan panel dibangun aktif sejak awal.
  function sinkronkanTampilanMode() {
    const splitEl = document.getElementById('indeks-split');
    const panelEl = document.getElementById('panel-inspeksi');

    if (splitEl && splitEl.classList) {
      splitEl.classList.add('indeks-split-aktif');
    }
    if (panelEl) {
      panelEl.style.display = '';
    }
  }

  // Panel punya dua keadaan kosong yang berbeda sebabnya, jadi kalimatnya
  // juga berbeda. Tanpa item terpilih: belum ada yang dipilih. Item terpilih
  // yang tidak lagi ada di hasil: pilihannya sudah tidak berlaku.
  // Menyamakan keduanya membuat satu kalimat menutupi dua kejadian yang
  // tidak sama, dan pesan yang salah jadi alasan yang salah.
  function buildPanelKosongHtml(alasan, jumlahHasil, adaKueri) {
    const hitung = adaKueri
      ? `${jumlahHasil} hasil pencarian`
      : `${jumlahHasil} item`;

    if (alasan === 'hilang') {
      return `
        <div class="panel-kosong panel-kosong-alasan">
          <div class="panel-kosong-judul">Item ini tidak lagi ada di hasil pencarian.</div>
          <div class="panel-kosong-ketujan">${hitung}. Pilih baris lain untuk melihat detailnya.</div>
        </div>`;
    }

    return `
      <div class="panel-kosong">
        <div class="panel-kosong-judul">${KALIMAT_PANEL_KOSONG}</div>
        <div class="panel-kosong-ketujan">${hitung}</div>
      </div>`;
  }

  // Panel menampilkan konteks lengkap item terpilih: judul, semua tautan,
  // semua tag, dan catatan utuh. Yang tidak ada datanya tidak dibuat
  // ruang kosong, jadi item tanpa catatan tidak punya bagian catatan.
  // Urutan bagian mengikuti spec: judul, tautan, tag, catatan, baru
  // item terkait di paling bawah.
  function buildPanelHtml(item, relatedHtml) {
    if (!item) return '';

    const links = Array.isArray(item.links)
      ? item.links.filter(link => link && link.url)
      : [];

    const linksHtml = links.length > 0 ? `
      <section class="panel-bagian">
        <div class="panel-bagian-judul">TAUTAN</div>
        <ul class="panel-tautan">
          ${links.map(link => {
            const hasil = normalisasiTautan(link.url);
            const isi = isiTautan(link);
            const url = hasil.url;
            const label = isi.label || 'Buka Link';
            const isLocal = hasil.isLocal;
            // Path lokal tidak bisa dibuka peramban, jadi pakai tombol yang
            // minta backend membukanya. Tautan web cukup elemen a biasa.
            const buka = isLocal
              ? `<button type="button" class="btn-aksi btn-buka-local" data-url="${escapeHtml(url)}" title="Buka">${getSvgIcon('buka', 12)}</button>`
              : `<a class="btn-aksi btn-buka" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Buka">${getSvgIcon('buka', 12)}</a>`;
            return `<li class="panel-tautan-baris">
              <span class="panel-tautan-teks">
                <span class="panel-tautan-label">${escapeHtml(label)}</span>
                <span class="panel-tautan-url">${escapeHtml(url)}</span>
              </span>
              <span class="panel-tautan-aksi">
                ${buka}
                <button type="button" class="btn-aksi btn-copy" data-url="${escapeHtml(url)}" data-local="${isLocal}" title="Salin">${getSvgIcon('copy', 12)}</button>
              </span>
            </li>`;
          }).join('')}
        </ul>
      </section>` : '';

    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    // Semua tag ditampilkan, bukan hanya yang jadi kartu di zona kartu,
    // supaya tidak tercipta tag duplikat karena tidak kelihatan.
    const tagsHtml = tags.length > 0 ? `
      <section class="panel-bagian">
        <div class="panel-bagian-judul">TAG</div>
        <div class="panel-tag">${tags.map(tag => `<span class="chip-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </section>` : '';

    const catatanHtml = item.catatan ? `
      <section class="panel-bagian">
        <div class="panel-bagian-judul">CATATAN</div>
        <div class="panel-catatan">${formatCatatanWithCode(item.catatan)}</div>
      </section>` : '';

    // Panel hanya-baca, jadi perubahan tetap lewat modal CRUD yang sama.
    // Tombol ini jalan pintas, bukan jalur edit kedua: isinya tetap
    // divalidasi di satu tempat saja.
    const kakiHtml = item.id ? `
      <div class="panel-kaki">
        <button type="button" class="btn btn-secondary btn-sm panel-ubah" data-id="${escapeHtml(item.id)}" title="Ubah item ini">${getSvgIcon('ubah', 11)} Ubah</button>
      </div>` : '';

    return `
      <div class="panel-kepala">
        <div class="sel-teks">
          <h2 class="panel-judul">${escapeHtml(item.title || '')}</h2>
        </div>
      </div>
      ${linksHtml}
      ${tagsHtml}
      ${catatanHtml}
      ${buildSopHtml(item.sop)}
      ${relatedHtml || ''}
      ${kakiHtml}
    `;
  }

  // `panelInfo` membawa jumlah hasil dan alasan panel kosong. Alasannya
  // harus ikut diteruskan: "tidak ada yang dipilih" dan "itemnya sudah
  // tidak ada di hasil" adalah dua kejadian berbeda, dan kalau disamakan
  // panel menampilkan kalimat yang salah.
  function renderTerkaitZone(items, panelInfo) {
    const info = panelInfo || { jumlahHasil: 0, adaKueri: false };
    const panelEl = document.getElementById('panel-inspeksi');

    // Kosongkan lebih dulu supaya panel tidak menyisakan isi dari render
    // sebelumnya, termasuk saat fokus baru saja dilepas.
    if (panelEl) {
      panelEl.innerHTML = '';
    }

    if (!state.focusedItemId) {
      if (panelEl) {
        // Fokus sudah dilepas sebelum render, jadi alasan hilangnya dibaca
        // dari flag. Bergantung pada state.focusedItemId selalu gagal di sini
        // karena nilainya sudah null justru pada kasus yang perlu dijelaskan.
        panelEl.innerHTML = buildPanelKosongHtml(info.hilang ? 'hilang' : '', info.jumlahHasil, info.adaKueri);
      }
      return;
    }

    const focusedItem = items.find(item => item.id === state.focusedItemId);
    if (!focusedItem) {
      if (panelEl) {
        panelEl.innerHTML = buildPanelKosongHtml('hilang', info.jumlahHasil, info.adaKueri);
      }
      return;
    }

    const related = computeRelatedItems(focusedItem, items);
    const relatedHtml = related.length > 0 ? buildTerkaitHtml(related) : '';

    if (panelEl) panelEl.innerHTML = buildPanelHtml(focusedItem, relatedHtml);
  }

  function updateIndeksResults(query) {
    const rekapEl = document.getElementById('search-rekap');
    const resultListEl = document.getElementById('result-list');
    if (!resultListEl) return;

    const items = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
    const searchFn = (typeof searchItems === 'function')
      ? searchItems
      : (typeof window !== 'undefined' ? window.searchItems : null);

    if (typeof searchFn !== 'function') return;

    let results = searchFn(items, query);

    // Urutan kartu: default recent (sesuai searchFn), jika 'az' urutkan judul A - Z
    if (state.sortOrder === 'az') {
      results = results.slice().sort((a, b) => {
        if (a.lapis && b.lapis && a.lapis !== b.lapis) {
          return a.lapis - b.lapis;
        }
        const titleDiff = (a.title || '').localeCompare(b.title || '');
        if (titleDiff !== 0) return titleDiff;
        const timeA = a && a.updated_at ? a.updated_at : '';
        const timeB = b && b.updated_at ? b.updated_at : '';
        return timeB.localeCompare(timeA);
      });
    }

    // Jika baris yang sedang difokuskan keluar dari hasil saringan, lepas
    // fokusnya. Alasannya ikut dicatat supaya panel bisa menjelaskan kenapa
    // isinya kosong, bukan menampilkan kalimat keadaan kosong yang menyesatkan.
    let panelItemHilang = false;
    if (state.focusedItemId && !results.some(r => r.id === state.focusedItemId)) {
      panelItemHilang = true;
      state.focusedItemId = null;
    }

    const cleanQuery = (typeof query === 'string') ? query.trim() : '';

    let displayItems = [];
    if (cleanQuery === '') {
      if (rekapEl) {
        rekapEl.style.display = 'none';
        rekapEl.textContent = '';
      }
      displayItems = results.slice(0, 10);
    } else {
      if (rekapEl) {
        const rekapText = buildRekapText(results);
        if (rekapText) {
          rekapEl.textContent = rekapText;
          rekapEl.style.display = 'block';
        } else {
          rekapEl.style.display = 'none';
        }
      }
      displayItems = results;
    }

    resultListEl.className = 'result-list tabel-mode';
    sinkronkanTampilanMode();

    const panelInfo = {
      jumlahHasil: cleanQuery === '' ? results.length : displayItems.length,
      adaKueri: cleanQuery !== '',
      hilang: panelItemHilang
    };

    if (displayItems.length === 0) {
      resultListEl.innerHTML = `
        <div class="no-results">Tidak ada item cocok. Coba kata lain atau tambahkan item baru</div>
      `;
      renderTerkaitZone(items, panelInfo);
      return;
    }

    const renderBarisTabel = (item) => {
      const { url: primaryUrl, isLocal: local } = getPrimaryLinkInfo(item);
      const tagsHtml = Array.isArray(item.tags) && item.tags.length > 0
        ? item.tags.map(tag => `#${escapeHtml(tag)}`).join(' ')
        : '<span class="sel-kosong">-</span>';

      const catatanHtml = item.catatan
        ? formatCatatanWithCode(item.catatan)
        : '<span class="sel-kosong">-</span>';

      // Penanda berasal dari lapisan pencarian. Teks tetap "dari catatan"
      // akan ikut tampil pada item yang hanya cocok lewat langkah kerja.
      const titlePrefix = item.penanda ? `<span class="badge-catatan">${escapeHtml(item.penanda)}:</span> ` : '';
      const ariaSelected = state.focusedItemId === item.id ? 'true' : 'false';

      const aksi = local
        ? `<button type="button" class="btn-aksi btn-buka-local" data-url="${escapeHtml(primaryUrl)}" title="Buka">${getSvgIcon('buka', 12)}</button>`
        : `<a href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener noreferrer" class="btn-aksi btn-buka" title="Buka">${getSvgIcon('buka', 12)}</a>`;

      return `
        <tr class="baris-tabel ${state.focusedItemId === item.id ? 'focused' : ''}" data-id="${escapeHtml(item.id || '')}" aria-selected="${ariaSelected}">
          <td class="sel-judul">
            <div class="sel-judul-isi">
              <span class="sel-teks">
                <span class="sel-nama">${titlePrefix}${escapeHtml(item.title || '')}</span>
              </span>
            </div>
          </td>
          <td class="sel-alamat"><span class="sel-url">${escapeHtml(primaryUrl)}</span></td>
          <td class="sel-catatan">${catatanHtml}</td>
          <td class="sel-tag">${tagsHtml}</td>
          <td class="sel-aksi">
            ${aksi}
            <button type="button" class="btn-aksi btn-copy" data-url="${escapeHtml(primaryUrl)}" data-local="${local}" title="Salin">${getSvgIcon('copy', 12)}</button>
            <button type="button" class="btn-aksi btn-ubah" data-id="${escapeHtml(item.id)}" title="Ubah">${getSvgIcon('ubah', 12)}</button>
          </td>
        </tr>
      `;
    };

    const renderSatu = renderBarisTabel;

    resultListEl.innerHTML = `
      <table class="tabel-hasil">
        <thead>
          <tr>
            <th scope="col" class="sel-judul">JUDUL</th>
            <th scope="col" class="sel-alamat">TAUTAN</th>
            <th scope="col" class="sel-catatan">CATATAN</th>
            <th scope="col" class="sel-tag">TAGAR</th>
            <th scope="col" class="sel-aksi">AKSI</th>
          </tr>
        </thead>
        <tbody>${displayItems.map(renderSatu).join('')}</tbody>
      </table>
    `;
    renderTerkaitZone(items, panelInfo);
  }

  function renderIndeksView() {
    const container = document.getElementById('panel-indeks');
    if (!container) return;

    const items = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Belum ada item kerja</div>
          <p class="empty-state-desc">Tambahkan akses dokumen pertama Anda atau muat dari berkas cadangan.</p>
          <div class="empty-state-actions">
            <button id="btn-empty-add" class="btn btn-primary">+ Tambah Item</button>
            <button id="btn-empty-import" class="btn btn-secondary">Import JSON</button>
          </div>
        </div>
      `;
      const btnEmptyAdd = document.getElementById('btn-empty-add');
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener('click', () => openItemModal());
      }
      // PRD 5.8: keadaan kosong punya dua jalan keluar, Tambah item atau Import JSON
      const btnEmptyImport = document.getElementById('btn-empty-import');
      if (btnEmptyImport && !btnEmptyImport.dataset.boundClick) {
        btnEmptyImport.dataset.boundClick = 'true';
        btnEmptyImport.addEventListener('click', () => openImportFilePicker());
      }
      return;
    }

    const existingInput = document.getElementById('search-input');
    if (!existingInput) {
      container.innerHTML = `
        <div id="indeks-split" class="indeks-split indeks-split-aktif">
          <div class="indeks-kolom-kiri">
            <div class="search-bar-row">
              <div class="search-bar-wrap">
                <input type="text" id="search-input" class="search-input" placeholder="Cari judul, tag, atau isi dokumen..." autocomplete="off">
                <span class="search-shortcut-badge">/</span>
              </div>
              <select id="select-sort-order" class="select-sort-order" aria-label="Urutan hasil">
                <option value="recent" selected>Urutan: Terakhir Digunakan</option>
                <option value="az">A - Z</option>
              </select>
              <button type="button" id="btn-tambah-item" class="btn btn-primary btn-tambah">Tambah Penanda</button>
            </div>
            <div id="search-rekap" class="search-rekap" style="display: none;"></div>
            <div id="result-list" class="result-list tabel-mode"></div>

          </div>
          <aside id="panel-inspeksi" class="panel-inspeksi"></aside>
        </div>
      `;

      const btnTambah = document.getElementById('btn-tambah-item');
      if (btnTambah) {
        btnTambah.addEventListener('click', () => openItemModal());
      }

      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          // Fokus tidak dibersihkan di sini. Mengetik boleh mengubah hasil
          // pencarian, tapi selama item terpilih masih cocok, panel tidak
          // boleh ikut kosong. updateIndeksResults yang melepasnya kalau
          // itemnya benar-benar tidak ada lagi di hasil.
          updateIndeksResults(e.target.value);
        });
      }

      // Pengatur urutan tinggal di baris kendali Indeks, bukan di dalam zona
      // Kartu. Di dalam zona itu ia ikut hilang saat zona tidak dirender, dan
      // zona tidak dirender pada setiap instalasi baru. Blok ini dibangun
      // sekali saja, jadi pendengarnya tidak perlu dijaga dari penumpukan.
      const selectSort = document.getElementById('select-sort-order');
      if (selectSort) {
        selectSort.addEventListener('change', (e) => {
          if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
          }
          state.sortOrder = (e.target && e.target.value === 'az') ? 'az' : 'recent';
          const input = document.getElementById('search-input');
          updateIndeksResults(input ? input.value : '');
        });
      }

      const resultListEl = document.getElementById('result-list');
      if (resultListEl) {
        resultListEl.addEventListener('click', (e) => {
          const copyBtn = e.target.closest('.btn-copy');
          if (copyBtn) {
            e.preventDefault();
            const url = copyBtn.getAttribute('data-url');
            const isLocal = copyBtn.getAttribute('data-local') === 'true';
            copyToClipboard(url, isLocal);
            return;
          }

          // Path lokal: backend yang menjalankan perintah pembuka. Bila
          // gagal, area status memberi alasan dan tombol Copy tetap ada
          // sebagai jalan keluar (tiket 11 langkah 7).
          const bukaLocalBtn = e.target.closest('.btn-buka-local');
          if (bukaLocalBtn) {
            e.preventDefault();
            const localPath = bukaLocalBtn.getAttribute('data-url');
            openLocalPathViaBackend(localPath);
            return;
          }

          const bukaBtn = e.target.closest('.btn-buka');
          if (bukaBtn) {
            return;
          }

          const ubahBtn = e.target.closest('.btn-ubah');
          if (ubahBtn) {
            const id = typeof ubahBtn.getAttribute === 'function' ? ubahBtn.getAttribute('data-id') : null;
            const currentItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
            const targetItem = currentItems.find(candidate => candidate.id === id);
            if (targetItem) {
              openItemModal(targetItem);
            }
            return;
          }

          const itemRow = e.target.closest('.baris-tabel');
          if (itemRow) {
            const id = itemRow.getAttribute('data-id');
            state.focusedItemId = id;
            const input = document.getElementById('search-input');
            updateIndeksResults(input ? input.value : '');
          }
        });
      }


      // Panel hanya baca, tapi tombol salin dan tombol buka path tetap hidup
      // di sana supaya konteks tidak perlu dibawa keluar dari panel.
      const panelInspksiEl = document.getElementById('panel-inspeksi');
      if (panelInspksiEl) {
        panelInspksiEl.addEventListener('click', (e) => {
          const copyBtn = e.target.closest('.btn-copy');
          if (copyBtn) {
            e.preventDefault();
            const url = copyBtn.getAttribute('data-url');
            const isLocal = copyBtn.getAttribute('data-local') === 'true';
            copyToClipboard(url, isLocal);
            return;
          }

          const bukaLocalBtn = e.target.closest('.btn-buka-local');
          if (bukaLocalBtn) {
            e.preventDefault();
            openLocalPathViaBackend(bukaLocalBtn.getAttribute('data-url'));
            return;
          }

// Klik item terkait memindahkan konteks ke item itu, bukan membuka dokumennya.
const terkaitBtn = e.target.closest ? e.target.closest('.terkait-item') : null;
if (terkaitBtn) {
const id = terkaitBtn.getAttribute('data-id');
if (id) {
state.focusedItemId = id;
const input = document.getElementById('search-input');
updateIndeksResults(input ? input.value : '');
scrollBarisKeLayar(id);
}
return;
}

// Pintasan ke modal CRUD item yang sama, bukan form sendiri.
const ubahBtn = e.target.closest('.panel-ubah');
          if (ubahBtn) {
            const id = ubahBtn.getAttribute('data-id');
            const currentItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
            const targetItem = currentItems.find(candidate => candidate.id === id);
            if (targetItem) {
              openItemModal(targetItem);
            }
          }
        });
      }

      updateIndeksResults('');
    } else {
      updateIndeksResults(existingInput.value);
    }
  }

  /* ==========================================================================
     Modul Tab Todo (Tiket 07)
     ========================================================================== */

  function generateTodoId(existingTodos) {
    const todos = Array.isArray(existingTodos) ? existingTodos : [];
    const existingIds = new Set(todos.map(todo => todo.id).filter(Boolean));
    let counter = 1;
    while (existingIds.has(`t${counter}`)) {
      counter++;
    }
    return `t${counter}`;
  }

  // Selisih hari kalender antara deadline dan hari ini. Mengembalikan null bila
// deadline tidak ada, bukan tanggal, atau tidak berbentuk YYYY-MM-DD.
//
// Satu definisi ini dipakai penghitungan label dan pengurutan, supaya keduanya
// tidak bisa berbeda pendapat tentang satu baris. Memakai Date.UTC, bukan
  // objek tanggal lokal, supaya selisihnya tidak ikut berubah saat zona waktu
// atau daylight saving bergerak.
function deadlineHariKe(deadline, todayString) {
    const mentah = deadline ? String(deadline) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mentah)) return null;
    const bagianDeadline = mentah.split('-').map(Number);
    const bagianHariIni = String(todayString).split('-').map(Number);
    if (bagianDeadline.length !== 3 || bagianHariIni.length !== 3 || bagianDeadline.some(isNaN) || bagianHariIni.some(isNaN)) {
      return null;
    }
    const deadlineUtc = Date.UTC(bagianDeadline[0], bagianDeadline[1] - 1, bagianDeadline[2]);
    const todayUtc = Date.UTC(bagianHariIni[0], bagianHariIni[1] - 1, bagianHariIni[2]);
    return Math.round((deadlineUtc - todayUtc) / (1000 * 60 * 60 * 24));
  }

  function getTodoStatus(todo, todayString = getTodayDateString()) {
    if (!todo) return { type: 'none', label: '' };
    if (todo.done) {
      return { type: 'selesai', label: 'selesai' };
    }
    const diffDays = deadlineHariKe(todo.deadline, todayString);
    if (diffDays === null) {
      return { type: 'none', label: '' };
    }

    if (diffDays < 0) {
      return { type: 'lewat', label: 'lewat' };
    } else if (diffDays >= 0 && diffDays <= 3) {
      return { type: 'mepet', label: 'mepet' };
    } else {
      return { type: 'none', label: '' };
    }
  }

  function renderTodoStatusBadge(status) {
    if (!status || status.type === 'none' || !status.label) return '';
    let badgeClass = 'badge-status';
    if (status.type === 'selesai') badgeClass += ' badge-ok';
    else if (status.type === 'mepet') badgeClass += ' badge-warn';
    else if (status.type === 'lewat') badgeClass += ' badge-bad';
    return `<span class="${badgeClass}">${escapeHtml(status.label)}</span>`;
  }

  /**
   * Penyaringan baris yang tertaut ke item: Todo dan Log memakai aturan
   * kata kunci yang sama persis (PRD 5.1) karena keduanya cocok pada teks
   * baris itu sendiri atau pada judul item yang ditautkan.
   *
   * Modul ini menjawab satu pertanyaan: "apakah baris ini lolos?". Urutan
   * dan saringan tambahan milik pemanggil lewat spec.
   *
   * @param {Array} rows      Baris yang disaring (Todo atau Log)
   * @param {Array} items     Item indeks, untuk mencari judul tertaut
   * @param {string} query    Kata kunci; kosong berarti semua lolos
   * @param {Function} spec.keep     (row) => boolean, saringan tambahan
   * @param {Function} spec.compare  (rowA, rowB) => number, pengurutan
   */
function filterLinkedRows(rows, items, query, spec) {
    const normalizedQuery = normalizeRowQuery(query);
    const itemsMap = new Map((Array.isArray(items) ? items : []).map(item => [item.id, item]));

    const keep = spec.keep || (() => true);
    const compare = spec.compare || (() => 0);

    const filtered = (Array.isArray(rows) ? rows : []).filter(row => {
      if (!keep(row)) return false;
      if (!normalizedQuery) return true;

      const rowText = normalizeRowQuery(row.teks);
      const linkedItem = row.item_id ? itemsMap.get(row.item_id) : null;
      const linkedItemTitle = linkedItem ? normalizeRowQuery(linkedItem.title) : '';

      return rowText.includes(normalizedQuery) || linkedItemTitle.includes(normalizedQuery);
    });

    // filter sudah menyalin, jadi sort di sini tidak menyentuh array pemanggil
    return filtered.sort(compare);
  }

  // Aturan kata kunci PRD 5.1: spasi dirapikan, huruf besar-kecil diabaikan,
  // beberapa kata diperlakukan sebagai satu rangkaian berurutan.
  function normalizeRowQuery(queryString) {
    if (typeof normalizeQuery === 'function') {
      return normalizeQuery(queryString);
    }
    return String(queryString || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function filterTodos(todos, items, query, filterStatus) {
    const hariIni = getTodayDateString();
    const berubahTerakhir = (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '');

    return filterLinkedRows(todos, items, query, {
      keep(todo) {
        if (filterStatus === 'belum' && todo.done) return false;
        if (filterStatus === 'selesai' && !todo.done) return false;
        return true;
      },
      // Urutan pakai deadline, bukan kapan terakhir disentuh. Tugas yang sudah
      // lewat tidak butuh aturan sendiri: tanggalnya adalah tanggal paling
      // awal, jadi sudah otomatis berada di paling atas.
      compare(todoA, todoB) {
        if (todoA.done !== todoB.done) {
          return todoA.done ? 1 : -1;
        }
        if (todoA.done) {
          return berubahTerakhir(todoA, todoB);
        }
        const a = deadlineHariKe(todoA.deadline, hariIni);
        const b = deadlineHariKe(todoB.deadline, hariIni);
        if (a === null && b === null) return berubahTerakhir(todoA, todoB);
        if (a === null) return 1;
        if (b === null) return -1;
        if (a !== b) return a - b;
        return berubahTerakhir(todoA, todoB);
      }
    });
  }

  function renderTodoView() {
    const todoListContainer = document.getElementById('todo-list');
    if (!todoListContainer) return;

    const allTodos = (state.data && Array.isArray(state.data.todo)) ? state.data.todo : [];
    const allItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
    const itemsMap = new Map(allItems.map(item => [item.id, item]));

    const filteredTodos = filterTodos(allTodos, allItems, state.todoSearchQuery, state.todoFilterStatus);

    if (filteredTodos.length === 0) {
      let emptyMessage = 'Belum ada TodoList. Tambahkan TodoList baru.';
      if (state.todoSearchQuery || state.todoFilterStatus !== 'semua') {
        emptyMessage = 'Tidak ada TodoList cocok. Coba kata lain atau tambahkan TodoList baru.';
      }
      todoListContainer.innerHTML = `
        <div class="result-empty" style="padding: 24px 0; text-align: center; color: var(--muted); font-size: var(--font-small);">
          ${emptyMessage}
        </div>
      `;
    } else {
      todoListContainer.innerHTML = filteredTodos.map(todo => {
        const status = getTodoStatus(todo);
        const statusBadgeHtml = renderTodoStatusBadge(status);
        const linkedItem = todo.item_id ? itemsMap.get(todo.item_id) : null;
        let linkedItemText = '';
        if (linkedItem) {
          linkedItemText = escapeHtml(linkedItem.title);
        } else {
          linkedItemText = 'tanpa tautan';
        }

        return `
          <div class="todo-item ${todo.done ? 'is-done' : ''}" data-id="${escapeHtml(todo.id)}">
            <div class="todo-item-left">
              <input type="checkbox" class="todo-checkbox" data-id="${escapeHtml(todo.id)}" ${todo.done ? 'checked' : ''} aria-label="Tandai selesai">
              <span class="todo-text ${todo.done ? 'is-done' : ''}">${escapeHtml(todo.teks)}</span>
              ${statusBadgeHtml}
              ${linkedItemText ? `<span class="todo-linked-item">${linkedItemText}</span>` : ''}
            </div>
            <div class="todo-item-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-ubah-todo" data-id="${escapeHtml(todo.id)}">Ubah</button>
              <button type="button" class="btn-text-danger btn-hapus-todo" data-id="${escapeHtml(todo.id)}">Hapus</button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (!todoListContainer.dataset.boundClick) {
      todoListContainer.dataset.boundClick = 'true';
      todoListContainer.addEventListener('click', async (e) => {
        const checkbox = e.target.closest('.todo-checkbox');
        const ubahBtn = e.target.closest('.btn-ubah-todo');
        const hapusBtn = e.target.closest('.btn-hapus-todo');
        const actionEl = checkbox || ubahBtn || hapusBtn;
        if (!actionEl) return;

        const id = actionEl.getAttribute('data-id');
        const currentTodos = (state.data && Array.isArray(state.data.todo)) ? state.data.todo : [];
        const targetTodo = currentTodos.find(candidate => candidate.id === id);
        if (!targetTodo) return;

        if (checkbox) {
          targetTodo.done = !targetTodo.done;
          targetTodo.updated_at = getTodayDateString();
          await saveData(state.data);
          return;
        }

        if (ubahBtn) {
          openTodoModal(targetTodo);
          return;
        }

        if (hapusBtn) {
          showDeleteTodoConfirmation(targetTodo);
          return;
        }
      });
    }
  }

  function initTodoListeners() {
    const todoSearchInput = document.getElementById('todo-search-input');
    if (todoSearchInput && !todoSearchInput.dataset.boundInput) {
      todoSearchInput.dataset.boundInput = 'true';
      todoSearchInput.addEventListener('input', (e) => {
        state.todoSearchQuery = e.target.value;
        renderTodoView();
      });
    }

    const filterBtns = document.querySelectorAll('.btn-todo-filter');
    filterBtns.forEach(btn => {
      if (!btn.dataset.boundClick) {
        btn.dataset.boundClick = 'true';
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-filter') || 'semua';
          state.todoFilterStatus = filter;
          // Block body, bukan concise: toggle mengembalikan boolean, dan callback
          // forEach tidak boleh mengembalikan apa pun.
          filterBtns.forEach((otherBtn) => { otherBtn.classList.toggle('active', otherBtn === btn); });
          renderTodoView();
        });
      }
    });

    const addBtn = document.getElementById('btn-tambah-todo');
    if (addBtn && !addBtn.dataset.boundClick) {
      addBtn.dataset.boundClick = 'true';
      addBtn.addEventListener('click', () => {
        openTodoModal(null);
      });
    }
  }

  function openTodoModal(todoToEdit = null) {
    closeActiveModal();

    const isEdit = Boolean(todoToEdit && todoToEdit.id);
    const initialText = isEdit ? (todoToEdit.teks || '') : '';
    const initialDeadline = isEdit ? (todoToEdit.deadline || '') : '';
    const initialItemId = isEdit ? (todoToEdit.item_id || '') : '';

    const allItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];

    const itemOptionsHtml = allItems.map(item => {
      const isSelected = item.id === initialItemId ? 'selected' : '';
      return `<option value="${escapeHtml(item.id)}" ${isSelected}>${escapeHtml(item.title)}</option>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-box" id="modal-todo-box">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Ubah TodoList' : 'Tambah TodoList'}</div>
          <button type="button" class="btn-close" id="btn-close-todo-modal" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="todo-text">Teks TodoList <span class="req">*</span></label>
            <textarea id="todo-text" class="form-textarea" maxlength="200" placeholder="Teks TodoList (1-200 karakter)">${escapeHtml(initialText)}</textarea>
            <div id="todo-text-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="todo-deadline">Deadline</label>
            <input type="date" id="todo-deadline" class="form-input" value="${escapeHtml(initialDeadline)}">
            <div class="form-hint">Format YYYY-MM-DD (opsional)</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="todo-item-id">Item Tertaut</label>
            <select id="todo-item-id" class="form-select">
              <option value="">Tanpa tautan</option>
              ${itemOptionsHtml}
            </select>
            <div class="form-hint">Hubungkan dengan item di Indeks (opsional)</div>
          </div>
        </div>
        <div class="modal-footer">
          <div></div>
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary btn-cancel-todo-modal">Batal</button>
            <button type="button" id="btn-todo-save" class="btn btn-primary" disabled>Simpan</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const textArea = document.getElementById('todo-text');
    if (textArea && initialText) {
      textArea.value = initialText;
    }
    const deadlineInput = document.getElementById('todo-deadline');
    const itemSelect = document.getElementById('todo-item-id');
    const saveBtn = document.getElementById('btn-todo-save');
    const closeBtn = document.getElementById('btn-close-todo-modal');
    const cancelBtn = overlay.querySelector('.btn-cancel-todo-modal');

    function validateTodoForm() {
      const textValue = textArea ? textArea.value.trim() : '';
      const isValid = textValue.length >= 1 && textValue.length <= 200;
      if (saveBtn) {
        saveBtn.disabled = !isValid;
      }
      const errorEl = document.getElementById('todo-text-error');
      if (errorEl) {
        if (textArea && textArea.value.length > 200) {
          errorEl.textContent = 'Teks TodoList maksimal 200 karakter';
          errorEl.style.display = 'block';
        } else {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        }
      }
      return isValid;
    }

    validateTodoForm();

    if (textArea) {
      textArea.addEventListener('input', validateTodoForm);
      textArea.focus();
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeActiveModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeActiveModal);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!validateTodoForm()) return;

        const textValue = textArea.value.trim();
        const deadlineValue = deadlineInput && deadlineInput.value ? deadlineInput.value : null;
        const selectedItemId = itemSelect && itemSelect.value ? itemSelect.value : null;
        const today = getTodayDateString();

        const todos = (state.data && Array.isArray(state.data.todo)) ? state.data.todo : [];

        if (isEdit) {
          const todoIdx = todos.findIndex(item => item.id === todoToEdit.id);
          if (todoIdx >= 0) {
            todos[todoIdx].teks = textValue;
            todos[todoIdx].deadline = deadlineValue;
            todos[todoIdx].item_id = selectedItemId;
            todos[todoIdx].updated_at = today;
          }
        } else {
          const newId = generateTodoId(todos);
          todos.unshift({
            id: newId,
            teks: textValue,
            item_id: selectedItemId,
            deadline: deadlineValue,
            done: false,
            updated_at: today
          });
        }

        state.data.todo = todos;
        const saveSuccess = await saveData(state.data);
        if (!saveSuccess) {
          return;
        }

        closeActiveModal();
      });
    }
  }

  /**
   * Modal konfirmasi untuk aksi merusak. Satu module dipakai bersama oleh
   * hapus todo dan hapus log: keduanya menuntut frasa yang sama sebelum
   * tombol merah aktif (PRD 5.4), dan keduanya menutup modal hanya bila
   * penyimpanan berhasil.
   *
   * @param {object} config
   * @param {string} config.title            Judul modal
   * @param {string} config.warning          Peringatan singkat yang ditampilkan
   * @param {string} config.confirmPhrase    Kata yang harus diketik, case-insensitive
   * @param {string} config.inputId          id input konfirmasi
   * @param {string} config.confirmButtonId  id tombol konfirmasi
   * @param {string} config.cancelClass      class tombol batal
   * @param {string} config.closeButtonId    id tombol tutup
   * @param {string} config.boxId            id kotak modal
   * @param {Function} config.onConfirm      Dipanggil setelah frasa cocok.
   *                                        Mengembalikan false bila gagal; modal tetap terbuka.
   */
async function confirmDestructive(config) {
    closeActiveModal();

    const phrase = config.confirmPhrase;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-box" id="${config.boxId}">
        <div class="modal-header">
          <div class="modal-title">${escapeHtml(config.title)}</div>
          <button type="button" class="btn-close" id="${config.closeButtonId}" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body delete-confirm-box">
          <div class="delete-warning">${escapeHtml(config.warning)}</div>
          <div class="form-group">
            <label class="form-label" for="${config.inputId}">Ketik <strong>${escapeHtml(phrase)}</strong> untuk mengonfirmasi:</label>
            <input type="text" id="${config.inputId}" class="form-input" placeholder="${escapeHtml(phrase)}" autocomplete="off">
            <div class="form-hint">Huruf besar-kecil diabaikan</div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary ${config.cancelClass}">Batal</button>
            <button type="button" id="${config.confirmButtonId}" class="btn-text-danger" disabled style="font-weight: 600; padding: 6px 12px;">Hapus Permanen</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const inputConfirm = document.getElementById(config.inputId);
    const confirmBtn = document.getElementById(config.confirmButtonId);
    const cancelBtn = overlay.querySelector('.' + config.cancelClass);
    const closeBtn = document.getElementById(config.closeButtonId);

    function phraseTyped(value) {
      return String(value || '').trim().toLowerCase() === phrase.toLowerCase();
    }

    if (inputConfirm && confirmBtn) {
      inputConfirm.addEventListener('input', (e) => {
        confirmBtn.disabled = !phraseTyped(e.target.value);
      });
      inputConfirm.focus();
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeActiveModal);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeActiveModal);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!phraseTyped(inputConfirm ? inputConfirm.value : '')) return;

        const succeeded = await config.onConfirm();
        if (succeeded === false) {
          return;
        }

        closeActiveModal();
      });
    }
  }

  function showDeleteTodoConfirmation(todo) {
    confirmDestructive({
      title: 'Hapus TodoList',
      warning: 'Menghapus TodoList ini tidak akan menghapus item dokumen yang ditautkan.',
      confirmPhrase: 'hapus',
      inputId: 'input-confirm-delete-todo',
      confirmButtonId: 'btn-confirm-delete-todo',
      cancelClass: 'btn-cancel-delete-todo',
      closeButtonId: 'btn-close-delete-todo-modal',
      boxId: 'modal-delete-todo-box',
      onConfirm: async () => {
        if (state.data && Array.isArray(state.data.todo)) {
          state.data.todo = state.data.todo.filter(todoItem => todoItem.id !== todo.id);
        }
        return saveData(state.data);
      }
    });
  }

  /* ==========================================================================
     Modul Tab Log (Tiket 08)
     ========================================================================== */

  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function generateLogId(existingLogs) {
    const logs = Array.isArray(existingLogs) ? existingLogs : [];
    const existingIds = new Set(logs.map(logEntry => logEntry.id).filter(Boolean));
    let counter = 1;
    while (existingIds.has(`l${counter}`)) {
      counter++;
    }
    return `l${counter}`;
  }

  function filterLogs(logs, items, query, dateFrom, dateTo) {
    const fromValue = DATE_PATTERN.test(String(dateFrom || '')) ? String(dateFrom) : '';
    const toValue = DATE_PATTERN.test(String(dateTo || '')) ? String(dateTo) : '';

    return filterLinkedRows(logs, items, query, {
      keep(logEntry) {
        const entryDate = String(logEntry.date || '');
        if (fromValue && entryDate < fromValue) return false;
        if (toValue && entryDate > toValue) return false;
        return true;
      },
      // Urut tanggal menurun; sort stabil mempertahankan urutan array
      // sehingga entri masukan terbaru tetap di atas pada tanggal sama
      compare: (logA, logB) => String(logB.date || '').localeCompare(String(logA.date || ''))
    });
  }

  function renderLogView() {
    const logListContainer = document.getElementById('log-list');
    if (!logListContainer) return;

    const allLogs = (state.data && Array.isArray(state.data.logs)) ? state.data.logs : [];
    const allItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
    const itemsMap = new Map(allItems.map(item => [item.id, item]));

    const filteredLogs = filterLogs(allLogs, allItems, state.logSearchQuery, state.logDateFrom, state.logDateTo);

    if (filteredLogs.length === 0) {
      const hasActiveFilter = state.logSearchQuery || state.logDateFrom || state.logDateTo;
      const emptyMessage = hasActiveFilter
        ? 'Tidak ada logbook cocok. Coba kata lain atau ubah rentang tanggal.'
        : 'Belum ada logbook. Catat aktivitas kerja harian Anda.';
      logListContainer.innerHTML = `
        <div class="result-empty" style="padding: 24px 0; text-align: center; color: var(--muted); font-size: var(--font-small);">
          ${emptyMessage}
        </div>
      `;
      return;
    }

    logListContainer.innerHTML = filteredLogs.map(logEntry => {
      const linkedItem = logEntry.item_id ? itemsMap.get(logEntry.item_id) : null;
      const linkedItemText = linkedItem ? escapeHtml(linkedItem.title) : 'tanpa tautan';

      return `
        <div class="log-item" data-id="${escapeHtml(logEntry.id)}">
          <div class="log-item-left">
            <span class="log-date-cell">${escapeHtml(logEntry.date || '')}</span>
            <span class="log-text">${escapeHtml(logEntry.teks)}</span>
            <span class="log-linked-item">${linkedItemText}</span>
          </div>
          <div class="log-item-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-ubah-log" data-id="${escapeHtml(logEntry.id)}">Ubah</button>
            <button type="button" class="btn-text-danger btn-hapus-log" data-id="${escapeHtml(logEntry.id)}">Hapus</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function initLogListeners() {
    const logSearchInput = document.getElementById('log-search-input');
    if (logSearchInput && !logSearchInput.dataset.boundInput) {
      logSearchInput.dataset.boundInput = 'true';
      logSearchInput.addEventListener('input', (e) => {
        state.logSearchQuery = e.target.value;
        renderLogView();
      });
    }

    const logDateFrom = document.getElementById('log-date-from');
    if (logDateFrom && !logDateFrom.dataset.boundInput) {
      logDateFrom.dataset.boundInput = 'true';
      logDateFrom.addEventListener('change', (e) => {
        state.logDateFrom = e.target.value;
        renderLogView();
      });
    }

    const logDateSampai = document.getElementById('log-date-sampai');
    if (logDateSampai && !logDateSampai.dataset.boundInput) {
      logDateSampai.dataset.boundInput = 'true';
      logDateSampai.addEventListener('change', (e) => {
        state.logDateTo = e.target.value;
        renderLogView();
      });
    }

    const catatBtn = document.getElementById('btn-catat-log');
    if (catatBtn && !catatBtn.dataset.boundClick) {
      catatBtn.dataset.boundClick = 'true';
      catatBtn.addEventListener('click', () => {
        openLogModal(null);
      });
    }

    const logListContainer = document.getElementById('log-list');
    if (logListContainer && !logListContainer.dataset.boundClick) {
      logListContainer.dataset.boundClick = 'true';
      logListContainer.addEventListener('click', (e) => {
        const ubahBtn = e.target.closest('.btn-ubah-log');
        const hapusBtn = e.target.closest('.btn-hapus-log');
        const actionEl = ubahBtn || hapusBtn;
        if (!actionEl) return;

        const id = actionEl.getAttribute('data-id');
        const currentLogs = (state.data && Array.isArray(state.data.logs)) ? state.data.logs : [];
        const targetLog = currentLogs.find(candidate => candidate.id === id);
        if (!targetLog) return;

        if (ubahBtn) {
          openLogModal(targetLog);
          return;
        }

        showDeleteLogConfirmation(targetLog);
      });
    }
  }

  function openLogModal(logToEdit = null) {
    closeActiveModal();

    const isEdit = Boolean(logToEdit && logToEdit.id);
    const initialText = isEdit ? (logToEdit.teks || '') : '';
    const initialDate = isEdit && DATE_PATTERN.test(String(logToEdit.date || ''))
      ? logToEdit.date
      : getTodayDateString();
    const initialItemId = isEdit ? (logToEdit.item_id || '') : '';

    const allItems = (state.data && Array.isArray(state.data.items)) ? state.data.items : [];
    const itemOptionsHtml = allItems.map(item => {
      const isSelected = item.id === initialItemId ? 'selected' : '';
      return `<option value="${escapeHtml(item.id)}" ${isSelected}>${escapeHtml(item.title)}</option>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-box" id="modal-log-box">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Ubah Logbook' : 'Catat Logbook'}</div>
          <button type="button" class="btn-close" id="btn-close-log-modal" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="log-date">Tanggal <span class="req">*</span></label>
            <input type="date" id="log-date" class="form-input" value="${escapeHtml(initialDate)}">
            <div id="log-date-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="log-text">Teks logbook <span class="req">*</span></label>
            <textarea id="log-text" class="form-textarea" maxlength="200" placeholder="Teks logbook (1-200 karakter)">${escapeHtml(initialText)}</textarea>
            <div id="log-text-error" class="form-error" style="display: none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="log-item-id">Item Tertaut</label>
            <select id="log-item-id" class="form-select">
              <option value="">Tanpa tautan</option>
              ${itemOptionsHtml}
            </select>
            <div class="form-hint">Hubungkan dengan item di Indeks (opsional)</div>
          </div>
        </div>
        <div class="modal-footer">
          <div></div>
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary btn-cancel-log-modal">Batal</button>
            <button type="button" id="btn-log-save" class="btn btn-primary" disabled>Simpan</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dateInput = document.getElementById('log-date');
    const textArea = document.getElementById('log-text');
    const itemSelect = document.getElementById('log-item-id');
    const saveBtn = document.getElementById('btn-log-save');
    const closeBtn = document.getElementById('btn-close-log-modal');
    const cancelBtn = overlay.querySelector('.btn-cancel-log-modal');

    if (dateInput) dateInput.value = initialDate;
    if (textArea && initialText) textArea.value = initialText;

    function validateLogForm() {
      const textValue = textArea ? textArea.value.trim() : '';
      const dateValue = dateInput ? String(dateInput.value || '').trim() : '';
      const isTextValid = textValue.length >= 1 && textValue.length <= 200;
      const isDateValid = DATE_PATTERN.test(dateValue);
      const isFormValid = isTextValid && isDateValid;

      if (saveBtn) {
        saveBtn.disabled = !isFormValid;
      }

      const dateErrEl = document.getElementById('log-date-error');
      if (dateErrEl) {
        if (!isDateValid) {
          dateErrEl.textContent = 'Tanggal wajib diisi dengan format YYYY-MM-DD';
          dateErrEl.style.display = 'block';
        } else {
          dateErrEl.textContent = '';
          dateErrEl.style.display = 'none';
        }
      }

      const textErrEl = document.getElementById('log-text-error');
      if (textErrEl) {
        if (textArea && textArea.value.length > 200) {
          textErrEl.textContent = 'Teks logbook maksimal 200 karakter';
          textErrEl.style.display = 'block';
        } else {
          textErrEl.textContent = '';
          textErrEl.style.display = 'none';
        }
      }

      return isFormValid;
    }

    validateLogForm();

    if (dateInput) {
      dateInput.addEventListener('input', validateLogForm);
      dateInput.addEventListener('change', validateLogForm);
    }
    if (textArea) {
      textArea.addEventListener('input', validateLogForm);
      textArea.focus();
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeActiveModal);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeActiveModal);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!validateLogForm()) return;

        const textValue = textArea.value.trim();
        const dateValue = String(dateInput.value).trim();
        const selectedItemId = itemSelect && itemSelect.value ? itemSelect.value : null;

        const logs = (state.data && Array.isArray(state.data.logs)) ? state.data.logs : [];

        if (isEdit) {
          const logIdx = logs.findIndex(candidate => candidate.id === logToEdit.id);
          if (logIdx >= 0) {
            logs[logIdx].date = dateValue;
            logs[logIdx].teks = textValue;
            logs[logIdx].item_id = selectedItemId;
          }
        } else {
          logs.unshift({
            id: generateLogId(logs),
            date: dateValue,
            item_id: selectedItemId,
            teks: textValue
          });
        }

        state.data.logs = logs;
        const saveSuccess = await saveData(state.data);
        if (!saveSuccess) {
          return;
        }

        closeActiveModal();
      });
    }
  }

  function showDeleteLogConfirmation(logEntry) {
    confirmDestructive({
      title: 'Hapus Logbook',
      warning: 'Menghapus logbook ini tidak akan menghapus item dokumen yang ditautkan.',
      confirmPhrase: 'hapus',
      inputId: 'input-confirm-delete-log',
      confirmButtonId: 'btn-confirm-delete-log',
      cancelClass: 'btn-cancel-delete-log',
      closeButtonId: 'btn-close-delete-log-modal',
      boxId: 'modal-delete-log-box',
      onConfirm: async () => {
        if (state.data && Array.isArray(state.data.logs)) {
          state.data.logs = state.data.logs.filter(candidate => candidate.id !== logEntry.id);
        }
        return saveData(state.data);
      }
    });
  }

  /* ==========================================================================
     Modul Export dan Import JSON (Tiket 09)
     ========================================================================== */

  // Versi skema yang dikenali di V1 (prd-skema.md bagian pembuka). Nilainya
  // harus sama dengan supportedVersion di src/pro/main.go supaya berkas hasil
  // Export dan hasil POST backend saling serasi (spec kontrak 5).
  const SUPPORTED_VERSION = 1;

  // Tanggal hari ini dalam bentuk YYYYMMDD untuk nama berkas unduhan
  function getTodayCompactString() {
    const todayString = getTodayDateString();
    return todayString.split('-').join('');
  }

  // Berkas contoh yang menilai bentuk data Penanda. Tanpanya, Import hanya bisa
  // dipakai orang yang sudah punya cadangan; orang lain akan membaca pesan
  // galat tanpa punya cara mencari apa yang salah. Berkasnya sudah ikut
  // terkirim bersama aplikasi, jadi di sini hanya diberi jalannya.
  function unduhContohData() {
    const link = document.createElement('a');
    link.href = 'data.example.json';
    link.download = 'penanda-contoh.json';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }

  function exportDataAsJson() {
    const payload = normalizeData(state.data);
    const jsonText = JSON.stringify(payload, null, 2);
    const fileName = `indeks-data-${getTodayCompactString()}.json`;

    const blob = new Blob([jsonText], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    // Ditunda satu gilir render: memanggil revokeObjectURL langsung setelah
    // click bisa membatalkan unduhan di sebagian browser
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 0);
  }

  // Bentuk berkas yang sama dengan yang diterima backend (arsitektur bagian 5)
  function validateImportedData(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Berkas ditolak: isinya bukan objek data Penanda' };
    }
    if (parsed.version !== SUPPORTED_VERSION) {
      return {
        valid: false,
        error: `Berkas ditolak: version ${JSON.stringify(parsed.version)} tidak dikenal; hanya version ${SUPPORTED_VERSION} yang dipakai`
      };
    }
    const requiredArrays = ['items', 'todo', 'logs'];
    for (const fieldName of requiredArrays) {
      if (!Array.isArray(parsed[fieldName])) {
        return { valid: false, error: `Berkas ditolak: "${fieldName}" harus berupa array` };
      }
    }
    return { valid: true, data: parsed, error: '' };
  }

  function showImportRejectedModal(errorMessage) {
    closeActiveModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-box" id="modal-import-rejected-box">
        <div class="modal-header">
          <div class="modal-title">Import Gagal</div>
          <button type="button" class="btn-close" id="btn-close-import-rejected" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body">
          <div class="delete-warning">${escapeHtml(errorMessage)}</div>
          <div class="form-hint">Berkas harus hasil tombol <strong>Cadangkan</strong> di Penanda. Kalau belum pernah punya cadangan, unduh dulu berkasnya lewat tombol <strong>Contoh</strong>, isi, lalu import.</div>
          <div class="form-hint">Data yang sudah ada tidak berubah.</div>
        </div>
        <div class="modal-footer">
          <div></div>
          <div class="modal-footer-actions">
            <button type="button" id="btn-tutup-penolakan" class="btn btn-secondary">Tutup</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('btn-close-import-rejected');
    const tutupBtn = document.getElementById('btn-tutup-penolakan');
    if (closeBtn) closeBtn.addEventListener('click', closeActiveModal);
    if (tutupBtn) tutupBtn.addEventListener('click', closeActiveModal);
  }

  function showImportConfirmationModal(importedData) {
    closeActiveModal();

    const itemCount = importedData.items.length;
    const todoCount = importedData.todo.length;
    const logCount = importedData.logs.length;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-box" id="modal-import-confirm-box">
        <div class="modal-header">
          <div class="modal-title">Impor Data Penanda</div>
          <button type="button" class="btn-close" id="btn-close-import-confirm" aria-label="Tutup">&times;</button>
        </div>
        <div class="modal-body delete-confirm-box">
          <div class="delete-warning">
            Berkas berisi <strong>${itemCount} item</strong>, <strong>${todoCount} todo</strong>, dan <strong>${logCount} log</strong>.
            Menghapus seluruh data yang sekarang ada dan menggantinya dengan isi berkas ini. Aksi ini tidak dapat dibatalkan.
          </div>
        </div>
        <div class="modal-footer">
          <div></div>
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary btn-cancel-import">Batal</button>
            <button type="button" id="btn-confirm-import" class="btn-text-danger" style="font-weight: 600; padding: 6px 12px;">Impor dan Ganti</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('btn-close-import-confirm');
    const cancelBtn = overlay.querySelector('.btn-cancel-import');
    const confirmBtn = document.getElementById('btn-confirm-import');

    if (closeBtn) closeBtn.addEventListener('click', closeActiveModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeActiveModal);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        closeActiveModal();
        state.data = importedData;
        // Fokus item terpilih bisa menunjuk data yang tidak ada lagi di berkas baru
        state.focusedItemId = null;
        await saveData(state.data);
      });
    }
  }

  async function handleImportFileChange(event) {
    const fileInput = event.target;
    const file = fileInput.files && fileInput.files[0];

    // Kosongkan input supaya berkas yang sama bisa dipilih ulang
    if (fileInput) fileInput.value = '';

    if (!file) return;

    let parsed = null;
    try {
      const fileText = await file.text();
      parsed = JSON.parse(fileText);
    } catch {
      showImportRejectedModal('Berkas ditolak: isinya bukan JSON yang bisa dibaca');
      return;
    }

    const validationResult = validateImportedData(parsed);
    if (!validationResult.valid) {
      showImportRejectedModal(validationResult.error);
      return;
    }

    showImportConfirmationModal(normalizeData(validationResult.data));
  }

  function openImportFilePicker() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  function initBackupListeners() {
    const contohBtn = document.getElementById('btn-contoh-json');
    if (contohBtn && !contohBtn.dataset.boundClick) {
      contohBtn.dataset.boundClick = 'true';
      contohBtn.addEventListener('click', () => {
        unduhContohData();
      });
    }

    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn && !exportBtn.dataset.boundClick) {
      exportBtn.dataset.boundClick = 'true';
      exportBtn.addEventListener('click', () => {
        exportDataAsJson();
      });
    }

    const importBtn = document.getElementById('btn-import-json');
    if (importBtn && !importBtn.dataset.boundClick) {
      importBtn.dataset.boundClick = 'true';
      importBtn.addEventListener('click', () => {
        openImportFilePicker();
      });
    }

    const fileInput = document.getElementById('import-file-input');
    if (fileInput && !fileInput.dataset.boundChange) {
      fileInput.dataset.boundChange = 'true';
      fileInput.addEventListener('change', (e) => {
        handleImportFileChange(e);
      });
    }
  }

  /**
   * Membaca seluruh isi berkas data dari backend.
   *
   * Tidak ada fallback lain. Halaman tanpa server berarti halaman yang
   * dibuka salah cara, dan itu diberi tahu lewat pesan yang menyebut
   * penanda.exe - bukan diisi data kosong yang terlihat seperti data hilang.
   */
  async function loadData() {
    // Wireframe bagian 6: kata "memuat" tampil selagi membaca berkas,
    // lalu berubah menjadi jam simpan.
    state.isLoading = true;
    updateStatusBar();

    try {
      const remoteJson = await storage.readRemote();
      state.data = normalizeData(JSON.parse(remoteJson));
      state.storageBlocked = false;
      state.statusMessage = '';
    } catch {
      // Jangan diam-diam menampilkan data kosong: user bisa mengira datanya
      // hilang lalu mengetik ulang, dan penulisan berikutnya bisa menimpa
      // data.json yang sebenarnya masih utuh.
      state.storageBlocked = true;
      state.statusMessage = NO_SERVER_MESSAGE;
      state.data = createEmptyData();
    }

    state.isLoading = false;
    updateStatusBar();
    renderAllViews();
    return state.data;
  }

  /**
   * Menyimpan seluruh isi berkas data ke backend.
   * Mengembalikan true bila berhasil. Bila gagal, modal yang memanggilnya
   * tetap terbuka supaya isian pengguna tidak hilang (wireframe bagian 6).
   */
  async function saveData(newData) {
    if (!newData || typeof newData !== 'object') return false;

    const normalized = normalizeData(newData);
    state.data = normalized;

    try {
      await storage.writeRemote(JSON.stringify(normalized));
      state.storageBlocked = false;
      state.statusMessage = '';
      state.savedAt = storage.formatSavedTime(new Date());
    } catch {
      state.storageBlocked = true;
      state.statusMessage = 'Gagal menyimpan ke server';
    }

    updateStatusBar();
    // Re-render hanya bila simpan berhasil; kalau gagal, DOM dibiarkan
    // agar isian atau form yang sedang aktif tidak hilang.
    if (!state.storageBlocked) {
      renderAllViews();
    }
    return !state.storageBlocked;
  }

  function renderAllViews() {
    renderIndeksView();
    renderTodoView();
    renderLogView();
  }


  function switchTab(tabName, options = {}) {
    if (!['indeks', 'todo', 'log'].includes(tabName)) return;

    state.activeTab = tabName;

    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
      const isTarget = panel.getAttribute('id') === `panel-${tabName}`;
      panel.classList.toggle('active', isTarget);
      if (isTarget) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (tabName === 'indeks') {
      if (options.focusSearch !== false) {
        focusSearchInput();
      }
    } else if (tabName === 'todo') {
      renderTodoView();
      const todoInput = document.getElementById('todo-search-input');
      if (todoInput && typeof todoInput.focus === 'function') {
        todoInput.focus();
      }
    } else if (tabName === 'log') {
      renderLogView();
      const logInput = document.getElementById('log-search-input');
      if (logInput && typeof logInput.focus === 'function') {
        logInput.focus();
      }
    }
  }

  function init() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          switchTab(targetTab);
        }
      });
    });

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.querySelector('.modal-overlay');
          if (modal) return;

          if (state.focusedItemId) {
            state.focusedItemId = null;
            const searchInput = document.getElementById('search-input');
            updateIndeksResults(searchInput ? searchInput.value : '');
          }
        } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const modal = document.querySelector('.modal-overlay');
          if (modal) return;
          const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
          if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (state.activeTab === 'indeks') {
            focusSearchInput();
          } else if (state.activeTab === 'todo') {
            const el = document.getElementById('todo-search-input');
            if (el && typeof el.focus === 'function') el.focus();
          } else if (state.activeTab === 'log') {
            const el = document.getElementById('log-search-input');
            if (el && typeof el.focus === 'function') el.focus();
          }
        } else if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const modal = document.querySelector('.modal-overlay');
          if (modal) return;
          const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
          if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (state.activeTab === 'indeks') openItemModal();
          else if (state.activeTab === 'todo') openTodoModal();
          else if (state.activeTab === 'log') openLogModal();
        }
      });

      // Fase capture dipakai supaya penilaian "klik ini di luar atau tidak"
      // terjadi sebelum handler lain membangun ulang area hasil. Kalau
      // ditunda sampai bubble, elemen yang diklik sudah terlepas dari
      // dokumen karena innerHTML diganti, sehingga closest selalu null dan
      // fokus terpilih ikut terhapus.
      document.addEventListener('click', (e) => {
        const modal = document.querySelector('.modal-overlay');
        if (modal) return;

        if (state.focusedItemId) {
          // Isi panel bukan "klik di luar". Tanpa ini, menekan tombol salin di
          // panel akan menghapus item yang sedang terpilih lalu mengosongkan
          // panel yang baru saja dipakai.
          if (!e.target.closest || (!e.target.closest('.baris-tabel') && !e.target.closest('#panel-inspeksi'))) {
            state.focusedItemId = null;
            const searchInput = document.getElementById('search-input');
            updateIndeksResults(searchInput ? searchInput.value : '');
          }
        }
      }, true);
    }

    initTodoListeners();
    initLogListeners();
    initBackupListeners();
    initTanggalFooter();

    // Tab diganti lebih dulu supaya panel yang benar terlihat, tapi kotak
    // cari tab Indeks baru bisa difokus setelah loadData selesai merender
    // (input itu baru ada setelah panel diisi).
    switchTab(state.activeTab, { focusSearch: false });

    // Data dibaca dari backend. loadData sudah menampilkan kata "memuat"
    // selama pembacaan berjalan, lalu membersihkannya sendiri.
    loadData()
      .then(() => {
        if (!state.statusMessage) {
          state.storageBlocked = false;
        }
        updateStatusBar();
        renderAllViews();
        if (state.activeTab === 'indeks') focusSearchInput();
      })
      .catch(() => {
        state.statusMessage = 'Gagal menjalankan aplikasi';
        state.isLoading = false;
        updateStatusBar();
      });
  }

  function focusSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (searchInput && typeof searchInput.focus === 'function') {
      searchInput.focus();
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  /* --------------------------------------------------------------------------
     Interface publik.

     Satu daftar simbol, tiga permukaan mengikuti: window (dipakai browser),
     globalThis (sandbox test), dan module.exports (test Node). Menambah simbol
     cukup satu baris di MODULE_INTERFACE, bukan tiga.

     window dan globalThis adalah objek yang sama, jadi cukup ditulis sekali.
     state sengaja tidak masuk daftar ini: hanya dibutuhkan test, dan
     membocorkan state ke window memungkinkan aplikasi lain memutasinya dari
     luar (kebijakan sejak tiket 02).
     -------------------------------------------------------------------------- */
  const MODULE_INTERFACE = {
    saveData,
    loadData,
    switchTab,
    generateItemId,
    normalisasiTautan,
    isiTautan,
    validateTags,
    kumpulkanTag,
    validateSop,
    openItemModal,
    generateTodoId,
    getTodoStatus,
    filterTodos,
    renderTodoView,
    openTodoModal,
    showDeleteTodoConfirmation,
    confirmDestructive,
    filterLinkedRows,
    normalizeRowQuery,
    generateLogId,
    filterLogs,
    renderLogView,
    formatTanggalHariIni,
    openLogModal,
    showDeleteLogConfirmation,
    exportDataAsJson,
    unduhContohData,
    validateImportedData,
    openImportFilePicker,
    renderAllViews,
    renderIndeksView,
    openLocalPathViaBackend
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, MODULE_INTERFACE);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Object.assign({}, MODULE_INTERFACE, {
      state
    });
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.MODULE_INTERFACE = MODULE_INTERFACE;
  }
})();
