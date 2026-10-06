import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('.');
const faviconPath = path.join(repoRoot, 'src', 'frontend', 'favicon.png');
const brandIconPath = path.join(repoRoot, 'src', 'frontend', 'assets', 'si-pita-brand.png');
const brand512Path = path.join(repoRoot, 'src', 'frontend', 'assets', 'si-pita-brand-512.png');

test('Aset produksi web Si Pita tersedia dan valid', () => {
  assert.ok(fs.existsSync(faviconPath), 'favicon.png harus ada di root frontend');
  assert.ok(fs.existsSync(brandIconPath), 'si-pita-brand.png harus ada di assets');
  assert.ok(fs.existsSync(brand512Path), 'si-pita-brand-512.png harus ada di assets');

  // Periksa magic bytes PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const checkPngHeader = (filePath) => {
    const buffer = fs.readFileSync(filePath).subarray(0, 8);
    assert.deepEqual(buffer, pngMagic, `${filePath} harus berupa berkas PNG yang sah`);
  };

  checkPngHeader(faviconPath);
  checkPngHeader(brandIconPath);
  checkPngHeader(brand512Path);

  // Ukuran file tidak boleh kosong
  assert.ok(fs.statSync(faviconPath).size > 100, 'Ukuran favicon harus > 100 byte');
  assert.ok(fs.statSync(brandIconPath).size > 1000, 'Ukuran brand icon harus > 1 KB');
  assert.ok(fs.statSync(brand512Path).size > 1000, 'Ukuran brand 512 icon harus > 1 KB');
});

test('Favicon dan Brand Icon terpasang pada index.html', () => {
  const htmlPath = path.join(repoRoot, 'src', 'frontend', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Favicon di head
  assert.match(html, /<link[^>]*rel=["']icon["'][^>]*href=["'][^"']*favicon\.png["']/i, 'Favicon harus terpasang di head');

  // Brand icon Si Pita di top-bar
  assert.match(html, /class=["']brand-title["']/i, 'Header harus memiliki elemen brand-title');
  assert.match(html, /assets\/si-pita-brand\.png/i, 'Brand title harus memuat aset si-pita-brand.png');
});

test('Si Pita tampil pada empty state Indeks, TodoList, dan Logbook', () => {
  const appJs = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'app.js'), 'utf8');
  const styleCss = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'style.css'), 'utf8');

  // Indeks empty state memuat Si Pita
  assert.match(appJs, /container\.innerHTML\s*=\s*`[^`]*empty-state-mascot[^`]*si-pita-brand\.png/, 'Indeks empty state harus memuat elemen dan gambar Si Pita');

  // TodoList empty state memuat Si Pita
  assert.match(appJs, /todoListContainer\.innerHTML\s*=\s*`[^`]*si-pita-brand\.png/, 'TodoList empty state harus memuat gambar Si Pita');

  // Logbook empty state memuat Si Pita
  assert.match(appJs, /logListContainer\.innerHTML\s*=\s*`[^`]*si-pita-brand\.png/, 'Logbook empty state harus memuat gambar Si Pita');

  // Style CSS memuat styling empty-state-mascot
  assert.match(styleCss, /\.empty-state-mascot\b/, 'style.css harus mendefinisikan .empty-state-mascot');
});

test('Windows Resource - Resource icon Si Pita tertanam di objek resource build', () => {
  const sysoPath = path.join(repoRoot, 'src', 'pro', 'rsrc_windows_amd64.syso');

  assert.ok(fs.existsSync(sysoPath), 'rsrc_windows_amd64.syso harus ada di src/pro/');
  assert.ok(fs.statSync(sysoPath).size > 1000, 'Ukuran berkas resource syso harus > 1 KB');
  const sysoBuffer = fs.readFileSync(sysoPath);
  assert.equal(sysoBuffer.readUInt16LE(0), 0x8664, 'rsrc_windows_amd64.syso harus berupa berkas objek COFF AMD64 yang sah');
});
