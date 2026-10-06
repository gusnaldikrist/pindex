# build.ps1 - Sinkronkan paket rilis dist/v1/ dengan sumber.
#
# Masalah yang diselesaikan: pindex.exe menyajikan frontend dari folder
# binary-nya sendiri (lihat binaryDir() di src/pro/main.go). Jadi berkas
# yang dilihat user adalah dist/v1/, bukan src/frontend/. Kalau salinan
# lupa, design baru di src/frontend/ tidak akan pernah terlihat.
#
# Pemakaian:
#   .\build.ps1              Bangun pindex.exe lalu salin frontend
#   .\build.ps1 -CheckOnly   Hanya cek, jangan ubah apa pun (keluar 1 kalau ada yang beda)
#   .\build.ps1 -NoExe       Lewati go build, tetap salin frontend
#
# Tidak menambah dependency: hanya PowerShell bawaan Windows dan Go.

[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$NoExe
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcFrontend = Join-Path $root 'src/frontend'
$srcShared = Join-Path $root 'src/shared'
$dist = Join-Path $root 'dist/v1'

# Berkas frontend yang disajikan penanda.exe, dan sumbernya.
# data.example.json dipakai user lewat Import JSON, jadi ikut tersalin.
$berkas = @(
  @{ Nama = 'index.html'; Sumber = (Join-Path $srcFrontend 'index.html') }
  @{ Nama = 'app.js'; Sumber = (Join-Path $srcFrontend 'app.js') }
  @{ Nama = 'search.js'; Sumber = (Join-Path $srcFrontend 'search.js') }
  @{ Nama = 'storage-adapter.js'; Sumber = (Join-Path $srcFrontend 'storage-adapter.js') }
  @{ Nama = 'style.css'; Sumber = (Join-Path $srcFrontend 'style.css') }
  @{ Nama = 'favicon.png'; Sumber = (Join-Path $srcFrontend 'favicon.png') }
  @{ Nama = 'assets/si-pita-brand.png'; Sumber = (Join-Path $srcFrontend 'assets/si-pita-brand.png') }
  @{ Nama = 'data.example.json'; Sumber = (Join-Path $srcShared 'data.example.json') }
)

function Get-HashBerkas([string]$path) {
  return (Get-FileHash -Path $path -Algorithm SHA256).Hash
}

# --- 1. Pastikan folder tujuan ada -------------------------------------------
if (-not (Test-Path $dist)) {
  if ($CheckOnly) {
    Write-Host "GAGAL: $dist belum ada." -ForegroundColor Red
    exit 1
  }
  New-Item -ItemType Directory -Path $dist -Force | Out-Null
  Write-Host "Dibuat: dist/v1/" -ForegroundColor Gray
}

# --- 2. Pastikan semua sumber ada -------------------------------------------
$kurang = @()
foreach ($b in $berkas) {
  if (-not (Test-Path $b.Sumber)) { $kurang += $b.Nama }
}
if ($kurang.Count -gt 0) {
  Write-Host "GAGAL: sumber hilang: $($kurang -join ', ')" -ForegroundColor Red
  exit 1
}

# --- 3. Bandingkan isi ---------------------------------------------------------
$beda = @()
foreach ($b in $berkas) {
  $tujuan = Join-Path $dist $b.Nama
  if (-not (Test-Path $tujuan)) {
    $beda += $b.Nama
    continue
  }
  if ((Get-HashBerkas $b.Sumber) -ne (Get-HashBerkas $tujuan)) {
    $beda += $b.Nama
  }
}

if ($CheckOnly) {
  if ($beda.Count -eq 0) {
    Write-Host "OK: dist/v1/ sinkron dengan sumber." -ForegroundColor Green
    exit 0
  }
  Write-Host "BELUM SINKRON: $($beda -join ', ')" -ForegroundColor Yellow
  Write-Host "Jalankan .\build.ps1 untuk menyinkronkan." -ForegroundColor Yellow
  exit 1
}

# --- 4. Bangun pindex.exe ----------------------------------------------------
if (-not $NoExe) {
  $exe = Join-Path $dist 'pindex.exe'
  Write-Host "Membangun pindex.exe..." -ForegroundColor Cyan
  & go build -o $exe ./src/pro
  if ($LASTEXITCODE -ne 0) {
    Write-Host "GAGAL: go build tidak berhasil." -ForegroundColor Red
    exit 1
  }
  $ukuran = [math]::Round((Get-Item $exe).Length / 1MB, 1)
  Write-Host "  pindex.exe dibuat ($ukuran MB)" -ForegroundColor Gray
}

# --- 5. Salin frontend ----------------------------------------------------------
$disalin = @()
foreach ($b in $berkas) {
  $tujuan = Join-Path $dist $b.Nama
  if ($beda -contains $b.Nama) {
    $parentDir = Split-Path -Parent $tujuan
    if (-not (Test-Path $parentDir)) {
      New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    Copy-Item -Path $b.Sumber -Destination $tujuan -Force
    $disalin += $b.Nama
  }
}

if ($disalin.Count -eq 0) {
  Write-Host "Frontend sudah sinkron, tidak ada yang disalin." -ForegroundColor Gray
} else {
  foreach ($n in $disalin) {
    Write-Host "  disalin: $n" -ForegroundColor Gray
  }
}

# --- 6. Verifikasi ulang ---------------------------------------------------------
$gagal = @()
foreach ($b in $berkas) {
  $tujuan = Join-Path $dist $b.Nama
  if ((Get-HashBerkas $b.Sumber) -ne (Get-HashBerkas $tujuan)) {
    $gagal += $b.Nama
  }
}

if ($gagal.Count -gt 0) {
  Write-Host "GAGAL: masih berbeda setelah salin: $($gagal -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Selesai. dist/v1/ sinkron dengan sumber." -ForegroundColor Green
exit 0