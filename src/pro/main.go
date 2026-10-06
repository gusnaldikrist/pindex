// main.go — Backend Penanda (Tiket 10)
//
// Binary tunggal tanpa dependency luar. Menyajikan berkas frontend dari
// folder tempat binary berada, dan menyimpan data ke data.json di folder
// yang sama, lengkap dengan salinan harian.
//
// Hanya memakai pustaka standar: net/http, encoding/json, os,
// path/filepath, time, errors, fmt.

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

const (
	dataFileName       = "data.json"
	defaultBindHost    = "127.0.0.1"
	defaultDisplayHost = "localhost"
	defaultPort        = 8080
	maxFallbackPort    = 8089
	// supportedVersion adalah versi skema yang ditulis untuk berkas baru.
	// versiDiterima adalah semua versi yang boleh muncul di berkas data.
	//
	// Field links pada entri todo dibuat opsional, jadi data versi 1 tetap
	// sah tanpa perubahan apa pun: tidak ada migrasi yang harus dijalankan.
	// Field catatan pada entri logbook juga opsional, jadi naik ke versi 3
	// tidak memaksa siapa pun melakukan apa pun.
	supportedVersion = 3
)

// versiDiterima adalah semua versi skema yang boleh muncul di berkas data.
//
// Angkanya ditulis literal, bukan dihitung dari supportedVersion, supaya
// daftar ini bisa dibaca dan dibandingkan apa adanya oleh pengujian frontend
// yang parses berkas ini. TestValidatePayload_MenerimaVersiLamaDanBaru
// menjaga agar supportedVersion tidak pernah keluar dari daftar.
func versiDiterima() []float64 {
	return []float64{1, 2, 3}
}

// validatePayload menolak apa pun yang bukan bentuk data Penanda.
// Bentuk yang diterima sengaja sama persis dengan validateImportedData di
// frontend, supaya berkas hasil Export dan hasil POST backend serasi.
func validatePayload(raw []byte) error {
	// Dilakukan dua tahap supaya pesan galat tidak membocorkan jargon Go
	// ("cannot unmarshal ... into Go value of type ...") ke user.
	var probe any
	if err := json.Unmarshal(raw, &probe); err != nil {
		return fmt.Errorf("JSON tidak bisa dibaca: %v", err)
	}
	parsed, objectValid := probe.(map[string]any)
	if !objectValid || parsed == nil {
		return errors.New("isi berkas bukan objek data Penanda")
	}

	versionValue, ok := parsed["version"]
	if !ok {
		return errors.New("field version tidak ditemukan")
	}
	versionNumber, isNumber := versionValue.(float64)
	if !isNumber {
		return fmt.Errorf("field version harus berupa angka, dapat %T", versionValue)
	}
	// Perbandingan dilakukan pada nilai float apa adanya, bukan int(), supaya
	// version 1.5 tidak ikut diterima karena terpotong jadi 1. Frontend memakai
	// perbandingan ketat juga, jadi keduanya menerima berkas yang sama.
	if !versiDikenal(versionNumber) {
		return fmt.Errorf("version %v tidak dikenal; yang dipakai hanya %s", versionNumber, strings.Join(daftarVersiTeks(), " dan "))
	}

	for _, field := range []string{"items", "todo", "logs"} {
		value, ada := parsed[field]
		if !ada {
			return fmt.Errorf("field %s tidak ditemukan", field)
		}
		if _, isArray := value.([]any); !isArray {
			return fmt.Errorf("field %s harus berupa array", field)
		}
	}

	// Bentuk sop tiap item diperiksa di sini, bukan cuma bentuknya di
	// frontend. Backend adalah gerbang terakhir, jadi berkas yang salah
	// bentuk harus ditolak walau dikirim dari luar aplikasi.
	for indeks, entry := range parsed["items"].([]any) {
		item, isObject := entry.(map[string]any)
		if !isObject {
			return fmt.Errorf("item pada indeks %d bukan objek", indeks)
		}
		if sop, ada := item["sop"]; ada && !validSop(sop) {
			return fmt.Errorf("field sop pada item indeks %d harus berupa teks maksimal %d karakter", indeks, maksSopChars)
		}
	}

	// Field links opsional pada todo diperiksa di sini, bukan cuma bentuknya
	// di frontend. Backend adalah gerbang terakhir, jadi berkas yang salah
	// bentuk harus ditolak walau dikirim dari luar aplikasi.
	for indeks, entry := range parsed["todo"].([]any) {
		todo, isObject := entry.(map[string]any)
		if !isObject {
			return fmt.Errorf("entri todo pada indeks %d bukan objek", indeks)
		}
		if err := validTodoLinks(todo["links"]); err != nil {
			return fmt.Errorf("field links pada todo indeks %d: %w", indeks, err)
		}
	}

	// Field catatan pada entri logbook opsional, jadi yang tidak ada tetap
	// sah. Yang diperiksa hanya bentuknya dan panjangnya, supaya berkas yang
	// diterima backend sama persis dengan yang diterima frontend.
	for indeks, entry := range parsed["logs"].([]any) {
		logEntry, isObject := entry.(map[string]any)
		if !isObject {
			return fmt.Errorf("entri logbook pada indeks %d bukan objek", indeks)
		}
		if !validCatatan(logEntry["catatan"]) {
			return fmt.Errorf("field catatan pada logbook indeks %d harus berupa teks maksimal %d karakter", indeks, maksCatatanChars)
		}
	}

	return nil
}

// versiDikenal menerima hanya versi yang ada di daftar.
//
// Perbandingan memakai nilai float apa adanya, bukan int(), supaya version
// 1.5 tidak ikut diterima karena terpotong jadi 1. Frontend memakai
// perbandingan ketat juga, jadi keduanya menerima berkas yang sama.
func versiDikenal(version float64) bool {
	for _, dikenal := range versiDiterima() {
		if version == dikenal {
			return true
		}
	}
	return false
}

func daftarVersiTeks() []string {
	daftar := make([]string, 0, 2)
	for _, versi := range versiDiterima() {
		daftar = append(daftar, fmt.Sprintf("version %g", versi))
	}
	return daftar
}

// validTodoLinks memeriksa field links opsional pada satu entri todo.
//
// Field ini boleh tidak ada sama sekali, dan boleh berupa array kosong: todo
// tanpa tautan harus tetap sah supaya berkas lama tidak perlu diubah. Yang
// ditolak hanya bentuk yang salah - array yang isinya bukan objek, atau url
// yang kosong - supaya berkas yang diterima backend sama persis dengan yang
// diterima frontend.
func validTodoLinks(value any) error {
	if value == nil {
		return nil
	}
	daftar, isArray := value.([]any)
	if !isArray {
		return errors.New("harus berupa array")
	}
	for indeks, entry := range daftar {
		link, isObject := entry.(map[string]any)
		if !isObject {
			return fmt.Errorf("elemen indeks %d bukan objek", indeks)
		}
		raw, ada := link["url"]
		if !ada {
			return fmt.Errorf("elemen indeks %d tidak punya url", indeks)
		}
		url, isString := raw.(string)
		if !isString {
			return fmt.Errorf("url pada elemen indeks %d bukan teks", indeks)
		}
		if strings.TrimSpace(url) == "" {
			return fmt.Errorf("url pada elemen indeks %d kosong", indeks)
		}
	}
	return nil
}

// maksSopChars batas panjang field sop pada satu item.
//
// Panjang dihitung dalam satuan kode UTF-16, bukan jumlah rune, supaya
// hasilnya sama dengan atribut maxlength di frontend dan dengan String
// .length di JavaScript. Menghitung rune akan membuat keduanya berbeda tepat
// pada teks yang memakai karakter di luar bidang dasar.
const maksSopChars = 600

// maksCatatanChars batas panjang field catatan pada satu entri logbook.
//
// Dihitung dalam satuan kode UTF-16, sama seperti maksSopChars, supaya
// hasilnya sama dengan atribut maxlength di frontend dan dengan String
// .length di JavaScript.
const maksCatatanChars = 2000

// validCatatan memeriksa satu nilai field catatan pada entri logbook.
//
// Field ini opsional, jadi nilai yang tidak ada sama sekali tetap sah. Yang
// ditolak hanya bentuk yang salah dan yang melebihi batas.
func validCatatan(value any) bool {
	if value == nil {
		return true
	}
	teks, isString := value.(string)
	if !isString {
		return false
	}
	return len(utf16.Encode([]rune(teks))) <= maksCatatanChars
}

// validSop memeriksa satu nilai field sop.
//
// Field ini opsional, jadi nilai yang tidak ada sama sekali tetap sah. Yang
// ditolak hanya bentuk yang salah dan yang melebihi batas, supaya berkas yang
// diterima backend sama persis dengan yang diterima frontend.
func validSop(value any) bool {
	if value == nil {
		return true
	}
	teks, isString := value.(string)
	if !isString {
		return false
	}
	return len(utf16.Encode([]rune(teks))) <= maksSopChars
}

// emptyData adalah jawaban saat data.json belum ada. Ini keadaan instalasi
// baru, jadi statusnya sukses (200), bukan galat.
func emptyData() []byte {
	// Marshal dari map literal ini tidak mungkin gagal, jadi err diabaikan.
	payload, _ := json.Marshal(map[string]any{
		"version": supportedVersion,
		"items":   []any{},
		"todo":    []any{},
		"logs":    []any{},
	})
	return payload
}

// dailyCopyName mengembalikan nama salinan harian, misalnya data-20261001.json.
// Pemanggil pada waktu yang sama memakai nama sama, sehingga salinan hari itu
// ditimpa alih-alih menumpuk berkas baru setiap kali simpan.
func dailyCopyName(now time.Time) string {
	return "data-" + now.Format("20060102") + ".json"
}

// writeData menulis payload ke data.json lalu ke salinan harian.
// Tulisan memakai berkas sementara lebih dulu supaya data.json tidak pernah
// setengah tertulis bila aplikasi ditutup paksa saat menyimpan.
func writeData(baseDir string, payload []byte, now time.Time) error {
	if err := validatePayload(payload); err != nil {
		return err
	}

	// validatePayload sudah memastikan bisa di-unmarshal, tapi marshal ulang
	// dipakai supaya yang tersimpan selalu JSON yang rapi dan berindeks.
	rapih, err := json.MarshalIndent(json.RawMessage(payload), "", "  ")
	if err != nil {
		return fmt.Errorf("gagal menyiapkan JSON untuk ditulis: %w", err)
	}

	dataPath := filepath.Join(baseDir, dataFileName)
	salinanPath := filepath.Join(baseDir, dailyCopyName(now))

	if err := writeFileAtomic(dataPath, rapih); err != nil {
		return err
	}
	if err := writeFileAtomic(salinanPath, rapih); err != nil {
		return err
	}
	return nil
}

func writeFileAtomic(targetPath string, content []byte) error {
	dir := filepath.Dir(targetPath)
	// Berkas sementara di folder yang sama supaya Rename tidak antar-volume.
	// Pola ini membuat berkas sementara ikut hilang bila Rename gagal.
	tmpFile, err := os.CreateTemp(dir, filepath.Base(targetPath)+".*.tmp")
	if err != nil {
		return fmt.Errorf("gagal membuat berkas sementara: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(content); err != nil {
		tmpFile.Close()
		return fmt.Errorf("gagal menulis berkas sementara: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("gagal menutup berkas sementara: %w", err)
	}
	if err := os.Rename(tmpPath, targetPath); err != nil {
		return fmt.Errorf("gagal mengganti %s: %w", filepath.Base(targetPath), err)
	}
	return nil
}

// binaryDir mengembalikan folder tempat binary ini berada. Frontend disajikan
// dari folder yang sama, supaya paket rilis cukup disalin apa adanya.
func binaryDir() string {
	executable, err := os.Executable()
	if err != nil {
		// Jalur yang tidak bisa diketahui berarti proses dijalankan tanpa binary
		// di disk; fallback ini hanya untuk jaga-jaga.
		wd, wdErr := os.Getwd()
		if wdErr != nil {
			return "."
		}
		return wd
	}
	resolved, err := filepath.EvalSymlinks(executable)
	if err != nil {
		return filepath.Dir(executable)
	}
	return filepath.Dir(resolved)
}

func newHandler(baseDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/data", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleGetData(w, baseDir)
		case http.MethodPost:
			handlePostData(w, r, baseDir)
		default:
			w.Header().Set("Allow", "GET, POST")
			http.Error(w, "metode tidak didukung", http.StatusMethodNotAllowed)
		}
	})

	// Buka path lokal Windows (arsitektur bagian 5). Hanya menerima huruf
	// drive, UNC, dan skema file; isAllowedLocalPath menyaring yang lain
	// supaya endpoint ini tidak membuka apa pun di luar cakupan aplikasi.
	mux.HandleFunc("/open", func(w http.ResponseWriter, r *http.Request) {
		handleOpenPath(w, r)
	})

	// Frontend: seluruh berkas di folder binary, termasuk index.html.
	// Berkas data dan salinan harian disaring supaya tidak bisa diunduh lewat
	// peramban; isinya milik user dan tidak perlu dibuka dari HTTP.
	// noStaleAssets menahan peramban agar tidak menampilkan versi lama.
	mux.Handle("/", noStaleAssets(noDataFiles(http.FileServer(http.Dir(baseDir)))))

	return mux
}

// openRequest adalah badan permintaan POST /open.
type openRequest struct {
	Path string `json:"path"`
}

// isAllowedLocalPath menerima huruf drive Windows (D:\), UNC (\\server\share),
// dan skema file:. Bentuk lain ditolak supaya endpoint ini tidak menjadi
// cara membuka apa pun di luar cakupan aplikasi.
func isAllowedLocalPath(candidate string) bool {
	trimmed := strings.TrimSpace(candidate)
	if trimmed == "" {
		return false
	}

	// Skema file: harus punya isi setelah "file:"
	if strings.HasPrefix(strings.ToLower(trimmed), "file:") {
		return len(trimmed) > len("file:")
	}

	// UNC: \\server Minimal harus menyebut nama server
	if strings.HasPrefix(trimmed, `\\`) {
		return len(trimmed) > len(`\\`)
	}

	// Huruf drive: D: atau D:\Data
	if len(trimmed) >= 2 && trimmed[1] == ':' {
		drive := trimmed[0]
		if (drive >= 'a' && drive <= 'z') || (drive >= 'A' && drive <= 'Z') {
			rest := trimmed[2:]
			return rest == "" || strings.HasPrefix(rest, `\`) || strings.HasPrefix(rest, "/")
		}
	}

	return false
}

func handleOpenPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "metode tidak didukung", http.StatusMethodNotAllowed)
		return
	}

	body, err := readAllLimited(r)
	if err != nil {
		http.Error(w, "gagal membaca badan permintaan", http.StatusBadRequest)
		return
	}

	var request openRequest
	if err := json.Unmarshal(body, &request); err != nil {
		http.Error(w, "badan permintaan bukan JSON yang sah", http.StatusBadRequest)
		return
	}

	target := strings.TrimSpace(request.Path)
	if !isAllowedLocalPath(target) {
		http.Error(w, "alamat di luar cakupan: hanya path lokal Windows dan skema file", http.StatusBadRequest)
		return
	}

	if err := openInExplorer(target); err != nil {
		http.Error(w, "gagal membuka path: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// shellLauncherName mengembalikan nama perintah pembuka bawaan Windows.
//
// shellOpen, shellLauncherName, dan shellOpenArgs adalah satu-satunya tempat
// yang tahu cara menjalankan perintah ini. openInExplorer (endpoint /open)
// dan openBrowser (saat startup) sama-sama memakainya, supaya keduanya tidak
// bisa diam-diam berbeda.
//
// shellLauncherName sengaja tanpa parameter: nama perintah tidak pernah boleh
// berasal dari input user, hanya dari kode.
func shellLauncherName() string {
	return "rundll32.exe"
}

// shellOpenArgs menyusun argumen perintah pembuka.
//
// ShellExecute tidak ada di paket stdlib Go, jadi perintah bawaan Windows
// dipakai sebagai pengganti: rundll32.exe url.dll,FileProtocolHandler
// menjalankan alamat dengan aplikasi default Windows, sama seperti ShellExecute.
//
// Argumen hasil fungsi ini menentukan perintah apa yang dieksekusi, jadi
// diuji sebagai data murni (shell_open_test.go) tanpa menjalankan proses.
func shellOpenArgs(target string) []string {
	return []string{"url.dll,FileProtocolHandler", target}
}

// shellOpen menjalankan alamat lewat perintah pembuka Windows.
//
// Fungsi ini tidak menunggu proses selesai; yang dipanggil hanya perlu tahu
// perintah bisa dijalankan atau tidak.
func shellOpen(target string) error {
	launcher, err := exec.LookPath(shellLauncherName())
	if err != nil {
		return errors.New("tidak menemukan perintah pembuka Windows")
	}
	return exec.Command(launcher, shellOpenArgs(target)...).Start()
}

// openInExplorer membuka path lokal milik user lewat perintah bawaan Windows.
func openInExplorer(target string) error {
	return shellOpen(target)
}

// noDataFiles membungkus handler berkas sehingga data.json dan
// data-YYYYMMDD.json tidak dapat diambil lewat HTTP. Tanpa ini,
// http.FileServer menyajikan seluruh folder dan membocorkan data user.
//
// Daftar isi direktori juga dimatikan: daftar tanpa isi pun membocorkan nama
// berkas data milik user.
func noDataFiles(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isDataFile(r.URL.Path) {
			http.NotFound(w, r)
			return
		}
		// Daftar isi direktori dimatikan. Halaman utama ("/") tetap boleh
		// karena memang harus menyajikan index.html.
		if strings.HasSuffix(r.URL.Path, "/") && r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isDataFile(urlPath string) bool {
	name := filepath.Base(urlPath)
	if name == dataFileName || strings.HasPrefix(name, "data-") || strings.HasSuffix(name, ".tmp") {
		return strings.HasSuffix(name, ".json") || strings.HasSuffix(name, ".tmp")
	}
	return false
}

// noStaleAssets Memberi header Cache-Control pada berkas frontend.
//
// Tanpa ini peramban boleh memakai salinan lamanya sendiri tanpa bertanya.
// Header "no-cache" tidak melarang menyimpan: peramban tetap menyimpan, tapi
// selalu menanyakan ulang sebelum memakai. Karena http.FileServer sudah
// mengirim Last-Modified, pertanyaan itu dijawab dengan 304 yang murah tanpa
// mengirim ulang isi berkas.
//
// Alasannya praktis: Penanda berjalan lokal untuk satu orang yang sering
// menyunting frontend-nya sendiri. Kalau peramban menahan versi lama, hasil
// perubahan tidak terlihat sampai peramban dibersihkan secara manual, dan itu
// salah karena penyebabnya tidak kelihatan dari layar.
func noStaleAssets(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

func handleGetData(w http.ResponseWriter, baseDir string) {
	dataPath := filepath.Join(baseDir, dataFileName)

	content, err := os.ReadFile(dataPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Instalasi baru: belum ada berkas, jadi jawaban kosong yang sah.
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write(emptyData())
			return
		}
		// Berkas ada tapi gagal dibaca: ini masalah, bukan keadaan awal.
		http.Error(w, "gagal membaca data.json", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write(content)
}

func handlePostData(w http.ResponseWriter, r *http.Request, baseDir string) {
	body, err := readAllLimited(r)
	if err != nil {
		http.Error(w, "gagal membaca badan permintaan", http.StatusBadRequest)
		return
	}

	if err := writeData(baseDir, body, time.Now()); err != nil {
		// Data lama tidak tersentuh: writeData memvalidasi sebelum menulis.
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Balasan POST sengaja tanpa badan data. Adapter di tiket 11 memakai
	// waktu simpan dari jawabannya, bukan isi data; memuat bentuk kosong di sini
	// akan membingungkan pembacaan yang mengira datanya habis.
	w.WriteHeader(http.StatusOK)
}

// readAllLimited membatasi ukuran badan permintaan supaya satu permintaan
// besar tidak menghabiskan memori. Batas longgar karena data Penanda kecil.
func readAllLimited(r *http.Request) ([]byte, error) {
	const maksUkuran = 8 << 20 // 8 MiB
	defer r.Body.Close()

	limited := io.LimitReader(r.Body, maksUkuran+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if len(body) > maksUkuran {
		return nil, errors.New("badan permintaan terlalu besar")
	}
	return body, nil
}

// listenWithFallback mencoba mengikat listener TCP mulai dari startPort hingga
// endPort. Jika startPort sedang dipakai aplikasi lain, ia otomatis mencoba
// port berikutnya hingga menemukan port yang kosong.
func listenWithFallback(host string, startPort, endPort int) (net.Listener, int, error) {
	if startPort < 1 || endPort > 65535 || startPort > endPort {
		return nil, 0, fmt.Errorf("rentang port tidak sah: %d - %d (harus 1-65535)", startPort, endPort)
	}
	var lastErr error
	for port := startPort; port <= endPort; port++ {
		addr := net.JoinHostPort(host, strconv.Itoa(port))
		listener, err := net.Listen("tcp", addr)
		if err == nil {
			actualPort := listener.Addr().(*net.TCPAddr).Port
			return listener, actualPort, nil
		}
		lastErr = err
	}
	return nil, 0, fmt.Errorf("gagal mengikat listener pada rentang port %d-%d: %w", startPort, endPort, lastErr)
}

// waitForEnter menunggu input Enter dari pengguna sebelum proses ditutup.
// Menerima Reader dan Writer terpisah agar perilakunya dapat diuji di unit test.
func waitForEnter(r io.Reader, w io.Writer) {
	if w != nil {
		fmt.Fprintln(w, "Tekan Enter untuk keluar...")
	}
	if r != nil {
		buf := make([]byte, 1)
		_, _ = r.Read(buf)
	}
}

// promptExit menampilkan pesan panduan ke user dan menunggu tombol Enter
// sebelum aplikasi keluar. Ini mencegah jendela terminal Windows langsung
// menutup dalam sekejap ketika aplikasi dijalankan via double-click di Explorer.
func promptExit(message string) {
	if message != "" {
		fmt.Println(message)
	}
	waitForEnter(os.Stdin, os.Stdout)
	os.Exit(1)
}

func main() {
	baseDir := binaryDir()

	listener, port, err := listenWithFallback(defaultBindHost, defaultPort, maxFallbackPort)
	if err != nil {
		fmt.Printf("Gagal memulai server: %v\n", err)
		promptExit("Tutup aplikasi lain yang memakai port tersebut, lalu jalankan pindex.exe lagi.")
	}

	url := fmt.Sprintf("http://%s:%d", defaultDisplayHost, port)
	if port != defaultPort {
		fmt.Printf("Port %d sedang dipakai aplikasi lain. PINDEX beralih ke port %d.\n", defaultPort, port)
	}
	fmt.Printf("PINDEX siap. Buka %s di browser.\n", url)
	fmt.Printf("Data disimpan di %s\n", filepath.Join(baseDir, dataFileName))

	if err := openBrowser(url); err != nil {
		fmt.Printf("Tidak bisa membuka browser otomatis. Buka %s secara manual.\n", url)
	}

	if err := http.Serve(listener, newHandler(baseDir)); err != nil {
		promptExit(fmt.Sprintf("Server berhenti: %v", err))
	}
}

// openBrowser membuka browser bawaan user ke alamat server.
//
// Memakai shellOpen yang sama dengan openInExplorer, jadi cara membuka
// browser dan cara membuka path lokal tidak bisa berbeda.
func openBrowser(url string) error {
	return shellOpen(url)
}
