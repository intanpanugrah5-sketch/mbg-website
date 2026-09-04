/* =========================================================
   MBG - script.js
   Mengambil data menu & gizi terbaru dari Google Apps Script
   (yang membaca Google Sheets) dan menampilkannya di halaman.
   ========================================================= */

// =====================================================================
// 1. KONFIGURASI
// =====================================================================
// Ganti URL di bawah ini dengan URL Web App hasil deploy
// Google Apps Script milikmu (lihat panduan "Cara Menghubungkan
// Website dengan Google Sheets" pada penjelasan yang menyertai kode ini).
//
// Contoh format URL:
// https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec
// =====================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwfMQJPGlKD0ht0BOs6EjObBPViwtqzeXb23ojymFlMdctgb3O12narbXbm6dzTRFOd/exec";

// Batas waktu tunggu request (ms) sebelum dianggap gagal
const FETCH_TIMEOUT_MS = 10000;

// =====================================================================
// 2. ELEMEN DOM
// =====================================================================
const loadingState   = document.getElementById("loadingState");
const errorState      = document.getElementById("errorState");
const contentWrapper  = document.getElementById("contentWrapper");

const tanggalEl            = document.getElementById("tanggal");
const menuListSekolahEl    = document.getElementById("menuListSekolah");
const menuListB3El         = document.getElementById("menuListB3");
const giziTableBodySekolahEl = document.getElementById("giziTableBodySekolah");
const giziTableBodyB3El      = document.getElementById("giziTableBodyB3");
const catatanEl            = document.getElementById("catatan");

// =====================================================================
// 3. HELPER: fetch dengan timeout
// =====================================================================
function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Waktu permintaan data habis (timeout)."));
    }, timeoutMs);

    fetch(url, { method: "GET", signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// =====================================================================
// 4. HELPER: tampilkan state (loading / error / content)
// =====================================================================
function showLoading() {
  loadingState.classList.remove("d-none");
  errorState.classList.add("d-none");
  contentWrapper.classList.add("d-none");
}

function showError() {
  loadingState.classList.add("d-none");
  errorState.classList.remove("d-none");
  contentWrapper.classList.add("d-none");
}

function showContent() {
  loadingState.classList.add("d-none");
  errorState.classList.add("d-none");
  contentWrapper.classList.remove("d-none");
}

// =====================================================================
// 5. HELPER: ambil SEMUA baris untuk tanggal terbaru
// =====================================================================
// Struktur Sheets sekarang: setiap hari terdiri dari 4 baris berurutan
// - Kategori "Sekolah" x Porsi "Besar"
// - Kategori "Sekolah" x Porsi "Kecil"
// - Kategori "B3"      x Porsi "Besar"
// - Kategori "B3"      x Porsi "Kecil"
// Fungsi ini mencari tanggal terakhir yang ada di data, lalu mengambil
// SEMUA baris yang tanggalnya sama dengan tanggal terakhir tersebut.
function getLatestDateRows(data) {
  let rows = Array.isArray(data) ? data : data && Array.isArray(data.data) ? data.data : null;

  if (!rows || rows.length === 0) {
    return [];
  }

  // Tanggal dianggap valid jika baris tersebut punya nilai di kolom "Tanggal"
  const rowsWithDate = rows.filter((r) => getField(r, "Tanggal") !== "");
  if (rowsWithDate.length === 0) {
    return [];
  }

  const latestDate = getField(rowsWithDate[rowsWithDate.length - 1], "Tanggal");

  return rowsWithDate.filter((r) => getField(r, "Tanggal") === latestDate);
}

// =====================================================================
// 6. HELPER: normalisasi nama kolom
// =====================================================================
// Google Apps Script biasanya mengembalikan key sesuai header sheet
// (mis. "Tanggal", "Menu", "Energi", dst). Fungsi ini membaca nilai
// kolom dengan aman meskipun ada variasi huruf besar/kecil atau spasi.
function getField(row, ...possibleKeys) {
  if (!row) return "";
  const rowKeys = Object.keys(row);

  for (const wanted of possibleKeys) {
    const found = rowKeys.find(
      (k) => k.trim().toLowerCase() === wanted.trim().toLowerCase()
    );
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== "") {
      return row[found];
    }
  }
  return "";
}

// =====================================================================
// 7. HELPER: escape teks agar aman disisipkan ke HTML
// =====================================================================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// =====================================================================
// 8. HELPER: ubah teks menu (dipisah koma) menjadi daftar <li>
// =====================================================================
function renderMenuList(targetEl, menuText) {
  targetEl.innerHTML = "";

  if (!menuText) {
    const li = document.createElement("li");
    li.textContent = "Menu belum tersedia";
    targetEl.appendChild(li);
    return;
  }

  const items = String(menuText)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    targetEl.appendChild(li);
  });
}

// =====================================================================
// 9. HELPER: render tabel kandungan gizi dari 2 baris (Besar & Kecil)
// =====================================================================
function renderGiziTable(targetEl, rowBesar, rowKecil) {
  const giziItems = [
    { label: "Kalori",      unit: "kkal" },
    { label: "Protein",     unit: "gram" },
    { label: "Lemak",       unit: "gram" },
    { label: "Karbohidrat", unit: "gram" },
    { label: "Serat",       unit: "gram" },
  ];

  targetEl.innerHTML = "";

  giziItems.forEach((item) => {
    const valueBesar = rowBesar ? getField(rowBesar, item.label) : "";
    const valueKecil = rowKecil ? getField(rowKecil, item.label) : "";

    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = item.label;

    const tdBesar = document.createElement("td");
    tdBesar.textContent = valueBesar !== "" ? `${valueBesar} ${item.unit}` : "-";
    tdBesar.classList.add("text-end");

    const tdKecil = document.createElement("td");
    tdKecil.textContent = valueKecil !== "" ? `${valueKecil} ${item.unit}` : "-";
    tdKecil.classList.add("text-end");

    tr.appendChild(tdLabel);
    tr.appendChild(tdBesar);
    tr.appendChild(tdKecil);
    targetEl.appendChild(tr);
  });
}

// =====================================================================
// 10. FUNGSI UTAMA: ambil & tampilkan data
// =====================================================================
async function loadMenuData() {
  showLoading();

  try {
    if (!API_URL || API_URL.indexOf("GANTI_DENGAN_URL") !== -1) {
      throw new Error("API_URL belum diatur.");
    }

    const response = await fetchWithTimeout(API_URL, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Gagal mengambil data (status ${response.status})`);
    }

    const data = await response.json();
    const latestRows = getLatestDateRows(data);

    if (!latestRows || latestRows.length === 0) {
      throw new Error("Data kosong.");
    }

    // Helper kecil untuk mencocokkan nilai kolom "Kategori" / "Porsi"
    // tanpa peduli huruf besar/kecil atau spasi berlebih.
    const matches = (row, field, expected) =>
      String(getField(row, field)).trim().toLowerCase() === expected;

    // Pisahkan baris berdasarkan kombinasi Kategori (Sekolah/B3) x Porsi (Besar/Kecil)
    const rowSekolahBesar = latestRows.find(
      (r) => matches(r, "Kategori", "sekolah") && matches(r, "Porsi", "besar")
    );
    const rowSekolahKecil = latestRows.find(
      (r) => matches(r, "Kategori", "sekolah") && matches(r, "Porsi", "kecil")
    );
    const rowB3Besar = latestRows.find(
      (r) => matches(r, "Kategori", "b3") && matches(r, "Porsi", "besar")
    );
    const rowB3Kecil = latestRows.find(
      (r) => matches(r, "Kategori", "b3") && matches(r, "Porsi", "kecil")
    );

    // Ambil Tanggal & Catatan dari baris mana pun yang tersedia
    const referenceRow = rowSekolahBesar || rowSekolahKecil || rowB3Besar || rowB3Kecil || latestRows[0];
    const tanggal = getField(referenceRow, "Tanggal");
    const catatan = getField(referenceRow, "Catatan");

    const menuSekolah = getField(rowSekolahBesar || rowSekolahKecil, "Menu");
    const menuB3      = getField(rowB3Besar || rowB3Kecil, "Menu");

    if (!tanggal && !menuSekolah && !menuB3) {
      throw new Error("Struktur data tidak valid.");
    }

    // Isi ke halaman
    tanggalEl.textContent = tanggal || "-";

    renderMenuList(menuListSekolahEl, menuSekolah);
    renderGiziTable(giziTableBodySekolahEl, rowSekolahBesar, rowSekolahKecil);

    renderMenuList(menuListB3El, menuB3);
    renderGiziTable(giziTableBodyB3El, rowB3Besar, rowB3Kecil);

    catatanEl.textContent = catatan || "Tidak ada catatan tambahan.";

    showContent();
  } catch (err) {
    // Semua error ditangkap di sini agar tidak muncul di layar pengguna.
    // Pesan error teknis tetap dicatat di console untuk keperluan debugging admin.
    console.error("Gagal memuat data menu MBG:", err);
    showError();
  }
}

// =====================================================================
// 11. JALANKAN SAAT HALAMAN DIMUAT
// =====================================================================
document.addEventListener("DOMContentLoaded", loadMenuData);
