"use strict";

/* =========================================================
   CV ARYA PRAMANA — ORDER-CENTRIC LOGISTICS SYSTEM
   ---------------------------------------------------------
   Sumber data tunggal = state.orders.
   Semua modul (Kopra, Shipping, BL/DO, Pelabuhan, Trucking,
   Customer, Keuangan, Laporan, Dashboard) DITURUNKAN dari
   data order, sehingga sekali input di Order Customer,
   semua fitur otomatis ikut terupdate.
   ========================================================= */

// ---------- Master Armada ----------
const TRUCK_FLEET = [
  { plate: "L 8231 AB", driver: "Budi Santoso", phone: "0812-3456-7890", type: "Tronton Wingbox 20FT" },
  { plate: "L 8232 AB", driver: "Andi Saputra", phone: "0812-3456-7891", type: "Trailer 20FT" },
  { plate: "L 8233 AB", driver: "Dimas Pratama", phone: "0812-3456-7892", type: "Tronton Bak Curah" },
  { plate: "L 8234 AB", driver: "Rizky Maulana", phone: "0812-3456-7893", type: "Trailer 40FT" },
  { plate: "L 8235 AB", driver: "Fajar Ramadhan", phone: "0812-3456-7894", type: "Trailer 20FT" },
  { plate: "L 8236 AB", driver: "Agus Setiawan", phone: "0812-3456-7895", type: "Tronton Bak Curah" },
  { plate: "L 8237 AB", driver: "Bayu Kurniawan", phone: "0812-3456-7896", type: "Tronton Wingbox" },
  { plate: "L 8238 AB", driver: "Hendra Wijaya", phone: "0812-3456-7897", type: "Trailer 20FT" },
  { plate: "L 8239 AB", driver: "Yusuf Setiawan", phone: "0812-3456-7898", type: "Trailer 20FT" },
  { plate: "L 8240 AB", driver: "Rian Firmansyah", phone: "0812-3456-7899", type: "Tronton Bak Curah" },
  { plate: "L 8241 AB", driver: "Doni Irawan", phone: "0812-3456-7800", type: "Trailer 20FT" },
  { plate: "L 8242 AB", driver: "Arif Nugroho", phone: "0812-3456-7801", type: "Tronton Wingbox" },
];
const FLEET_MAP = Object.fromEntries(TRUCK_FLEET.map((t) => [t.plate, t]));

// ---------- Alur Status Order ----------
const STAGE_LABEL = {
  new: "Order Baru",
  stuffing: "Stuffing",
  sailing: "Berlayar",
  arrived: "Menunggu DO",
  released: "Ready for Pickup",
  trucking: "Menuju Pabrik",
  done: "Selesai",
};
const FLOW_ISLAND = ["new", "stuffing", "sailing", "arrived", "released", "trucking", "done"];
const FLOW_DOMESTIC = ["new", "trucking", "done"];

const isIsland = (o) => o.routeType !== "Domestik";
const flowOf = (o) => (isIsland(o) ? FLOW_ISLAND : FLOW_DOMESTIC);
const stageIdx = (o) => flowOf(o).indexOf(o.stage);
const reached = (o, key) => {
  const i = flowOf(o).indexOf(key);
  return i >= 0 && stageIdx(o) >= i;
};

function nextAction(o) {
  if (o.stage === "done") return null;
  const noTruck = !o.plate ? "Tugaskan truk terlebih dahulu (klik Edit pada order)" : null;
  if (isIsland(o)) {
    switch (o.stage) {
      case "new": return { label: "Mulai Stuffing" };
      case "stuffing": return { label: "Kapal Berangkat" };
      case "sailing": return { label: "Kapal Tiba" };
      case "arrived": return { label: "Validasi DO" };
      case "released": return { label: "Truk Gate Out", blocked: noTruck };
      case "trucking": return { label: "Diterima Pabrik" };
    }
  } else {
    switch (o.stage) {
      case "new": return { label: "Berangkatkan Truk", blocked: noTruck };
      case "trucking": return { label: "Diterima Pabrik" };
    }
  }
  return null;
}

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const num = (v) => parseFloat(v) || 0;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtRp = (n) => (n < 0 ? "− " : "") + "Rp " + Math.round(Math.abs(n)).toLocaleString("id-ID");
const fmtShort = (n) => {
  const a = Math.abs(n);
  const sign = n < 0 ? "− " : "";
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toFixed(2).replace(".", ",")} M`;
  if (a >= 1e6) return `${sign}Rp ${(a / 1e6).toFixed(1).replace(".", ",")} jt`;
  return sign + "Rp " + Math.round(a).toLocaleString("id-ID");
};
const fmtTon = (t) => `${(+t || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ton`;
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const today = () => new Date().toISOString().slice(0, 10);
function monthsAgo(m, day) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - m);
  d.setDate(day);
  return d.toISOString();
}
const containerText = (o) =>
  o.mode === "Curah" ? "Curah" : o.containers.length ? `${o.containers.length} x 20FT` : "—";

function calc(o) {
  const purchase = num(o.buyPrice) * num(o.tonnage) * 1000;
  const sales = num(o.sellPrice) * num(o.tonnage) * 1000;
  const revenue = sales + num(o.serviceFee);
  const c = o.costs || {};
  const logistics = num(c.freight) + num(c.thc) + num(c.doFee) + num(c.trucking) + num(c.other);
  return { purchase, sales, revenue, logistics, kopraMargin: sales - purchase, profit: revenue - purchase - logistics };
}

function getBadge(status) {
  const green = ["Valid", "Selesai", "Tersedia", "Lunas", "Delivered", "Released"];
  const yellow = ["Menunggu", "Menunggu DO", "Belum Lunas", "Draft", "Dijadwalkan", "Booking"];
  const blue = ["Order Baru", "Stuffing", "Loading", "Berlayar", "Tiba", "Ready for Pickup", "Menuju Pabrik", "Gate In", "On Vessel", "Gate Out", "Ready"];
  const red = ["Belum Ditugaskan", "Batal"];
  let color = "gray";
  if (green.includes(status)) color = "green";
  else if (yellow.includes(status)) color = "yellow";
  else if (blue.includes(status)) color = "blue";
  else if (red.includes(status)) color = "red";
  return `<span class="badge ${color}">${esc(status)}</span>`;
}

// ---------- Seed Data ----------
function seedState() {
  const mk = (o) => ({
    factoryAddress: "", voyage: "", etd: "", blNo: "", doNo: "", plate: "", driver: "", notes: "",
    serviceFee: 0, payment: "Belum Lunas", doValid: false, containers: [], mode: "Container",
    costs: { freight: 0, thc: 0, doFee: 0, trucking: 0, other: 0 },
    history: [{ stage: "new", at: o.createdAt }],
    ...o,
  });
  return {
    seq: 268,
    orders: [
      mk({
        id: "ORD-0268", createdAt: monthsAgo(0, 2), customer: "UD Makmur", factory: "PT Sari Mas Permai", factoryAddress: "Surabaya",
        serviceType: "Kopra + Shipping + Trucking (Lengkap)", origin: "Bitung", routeType: "Antar-Pulau",
        tonnage: 25, buyPrice: 7000, sellPrice: 7350,
        maritime: "PT Nusantara Maritime", vessel: "MV Bintang Laut", voyage: "026E", portOrigin: "Pelabuhan Bitung", portDest: "Tanjung Perak",
        containers: ["MSCU1234567", "MSCU1234568"], blNo: "BL-0268-001", doNo: "DO-0268-001", doValid: true,
        plate: "L 8231 AB", driver: "Budi Santoso", serviceFee: 32000000,
        costs: { freight: 18500000, thc: 4250000, doFee: 850000, trucking: 3400000, other: 0 }, stage: "trucking",
      }),
      mk({
        id: "ORD-0267", createdAt: monthsAgo(1, 18), customer: "CV Sumber Makmur", factory: "PT Agro Prima", factoryAddress: "Gresik",
        serviceType: "Kopra + Shipping + Trucking (Lengkap)", origin: "Makassar", routeType: "Antar-Pulau",
        tonnage: 40, buyPrice: 6950, sellPrice: 7250,
        maritime: "PT Samudra Logistik", vessel: "KM Bahari Jaya", voyage: "118", portOrigin: "Pelabuhan Makassar", portDest: "Tanjung Perak",
        containers: ["TGHU8822110", "TGHU8822111", "TGHU8822112"], blNo: "BL-0267-001", doNo: "DO-0267-001",
        plate: "L 8234 AB", driver: "Rizky Maulana", serviceFee: 45000000,
        costs: { freight: 27000000, thc: 6300000, doFee: 1200000, trucking: 5100000, other: 0 }, stage: "arrived",
      }),
      mk({
        id: "ORD-0266", createdAt: monthsAgo(2, 10), customer: "PT Berkah Industri", factory: "PT Sari Mas Permai", factoryAddress: "Surabaya",
        serviceType: "Jasa Trucking", origin: "Surabaya", routeType: "Domestik", mode: "Curah",
        tonnage: 28, buyPrice: 0, sellPrice: 0, maritime: "", vessel: "", portOrigin: "", portDest: "",
        plate: "L 8233 AB", driver: "Dimas Pratama", serviceFee: 4200000,
        costs: { freight: 0, thc: 0, doFee: 0, trucking: 2100000, other: 0 }, stage: "trucking",
      }),
      mk({
        id: "ORD-0265", createdAt: monthsAgo(3, 7), customer: "Koperasi Tani", factory: "PT Sawit Sejahtera", factoryAddress: "Jakarta",
        serviceType: "Kopra + Shipping + Trucking (Lengkap)", origin: "Manado", routeType: "Antar-Pulau",
        tonnage: 58.5, buyPrice: 7100, sellPrice: 7400,
        maritime: "PT Nusantara Maritime", vessel: "MV Laut Makmur", voyage: "021W", portOrigin: "Pelabuhan Manado", portDest: "Tanjung Priok",
        containers: ["FSCU7711223", "FSCU7711224", "FSCU7711225"], blNo: "BL-0265-001", doNo: "DO-0265-001", doValid: true,
        plate: "L 8235 AB", driver: "Fajar Ramadhan", serviceFee: 55000000, payment: "Lunas",
        costs: { freight: 36000000, thc: 8000000, doFee: 1500000, trucking: 6800000, other: 0 }, stage: "done",
      }),
      mk({
        id: "ORD-0264", createdAt: monthsAgo(0, 1), customer: "UD Makmur", factory: "PT Agro Prima", factoryAddress: "Gresik",
        serviceType: "Kopra + Shipping + Trucking (Lengkap)", origin: "Bitung", routeType: "Antar-Pulau",
        tonnage: 30, buyPrice: 7050, sellPrice: 7400,
        maritime: "PT Nusantara Maritime", vessel: "MV Bintang Laut", voyage: "027E", portOrigin: "Pelabuhan Bitung", portDest: "Tanjung Perak",
        containers: ["MSCU2200011", "MSCU2200012"], blNo: "BL-0264-001", doNo: "DO-0264-001", serviceFee: 34000000,
        costs: { freight: 19000000, thc: 4300000, doFee: 850000, trucking: 0, other: 0 }, stage: "sailing",
      }),
    ],
  };
}

// ---------- Persistence ----------
const STORAGE_KEY = "cv_arya_pramana_db_v2";
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.orders)) return { seq: p.seq || 268, orders: p.orders };
    }
  } catch (e) {
    console.error("Gagal memuat data:", e);
  }
  return seedState();
}
let state = loadState();
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.removeItem("cv_arya_pramana_db_v1");
  } catch (e) {
    console.error("Gagal menyimpan data:", e);
  }
}
const findOrder = (id) => state.orders.find((o) => o.id === id);

// ---------- UI State ----------
let editingId = null;
let detailId = null;
let lastSavedId = null;

const titles = {
  dashboard: "Dashboard", orders: "Order Customer", kopra: "Transaksi Kopra", shipping: "Shipping & Kapal",
  documents: "BL & DO", ports: "Pelabuhan", trucking: "Trucking", customers: "Customer / Pabrik",
  finance: "Keuangan", reports: "Laporan",
};

function goTo(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active-page", p.id === page));
  document.querySelectorAll(".nav").forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  $("#pageTitle").textContent = titles[page] || "";
  $(".sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(id) { $("#" + id)?.classList.add("show"); }
function closeModal(id) {
  $("#" + id)?.classList.remove("show");
  if (id === "orderDetailModal") detailId = null;
}
window.openModal = openModal;
window.closeModal = closeModal;

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}

// ---------- Actions ----------
function advanceOrder(id) {
  const o = findOrder(id);
  if (!o) return;
  const na = nextAction(o);
  if (!na) return;
  if (na.blocked) {
    toast("⚠️ " + na.blocked);
    return;
  }
  const flow = flowOf(o);
  if (o.stage === "arrived") o.doValid = true;
  if (o.stage === "stuffing" && !o.etd) o.etd = today();
  o.stage = flow[flow.indexOf(o.stage) + 1];
  o.history = [...(o.history || []), { stage: o.stage, at: new Date().toISOString() }];
  saveState();
  render();
  toast(`${o.id} → ${STAGE_LABEL[o.stage]}`);
}

function togglePayment(id) {
  const o = findOrder(id);
  if (!o) return;
  o.payment = o.payment === "Lunas" ? "Belum Lunas" : "Lunas";
  saveState();
  render();
  toast(`${o.id}: pembayaran ${o.payment}`);
}

function deleteOrder(id) {
  const o = findOrder(id);
  if (!o) return;
  if (!confirm(`Hapus order ${o.id} (${o.customer} → ${o.factory})?\nData di semua modul terkait juga akan terhapus.`)) return;
  state.orders = state.orders.filter((x) => x.id !== id);
  saveState();
  closeModal("orderDetailModal");
  render();
  toast(`Order ${id} dihapus`);
}

// ---------- Render: Orders ----------
function searchText(o) {
  return [o.id, o.customer, o.factory, o.origin, o.portOrigin, o.portDest, o.vessel, o.maritime, o.plate, o.driver, o.blNo, o.doNo, o.serviceType, ...(o.containers || [])]
    .join(" ")
    .toLowerCase();
}

function nextBtn(o) {
  const na = nextAction(o);
  if (!na) return "";
  return `<button class="btn-sm go" data-action="advance" data-id="${o.id}" ${na.blocked ? `title="${esc(na.blocked)}"` : ""}>${na.label} →</button>`;
}

function renderOrders() {
  const q = ($("#orderSearch")?.value || "").toLowerCase().trim();
  const f = $("#orderStatusFilter")?.value || "all";
  const rows = state.orders.filter((o) => {
    if (f === "active" && o.stage === "done") return false;
    if (f === "done" && o.stage !== "done") return false;
    return !q || searchText(o).includes(q);
  });
  $("#ordersTable").innerHTML = rows.length
    ? rows
        .map(
          (o) => `
    <tr class="${o.id === lastSavedId ? "row-new" : ""}">
      <td class="id">${o.id}<br><small style="color:#94a3b8;font-weight:400">${fmtDate(o.createdAt)}</small></td>
      <td><b>${esc(o.customer)}</b><br><small style="color:#64748b">${esc(o.serviceType)}</small></td>
      <td>${esc(o.origin)} → ${esc(isIsland(o) ? o.portDest : o.factoryAddress || o.factory)}</td>
      <td>${esc(o.routeType)}<br><small style="color:#64748b">${isIsland(o) ? "Kapal + Truck" : "Trucking"} · ${esc(o.mode)}</small></td>
      <td><b>${esc(o.factory)}</b></td>
      <td>${fmtTon(o.tonnage)} · ${containerText(o)}<br><small style="color:#64748b">${o.plate ? `${esc(o.plate)} · ${esc(o.driver)}` : "Truk belum ditugaskan"}</small></td>
      <td>${getBadge(STAGE_LABEL[o.stage])}</td>
      <td><div class="act">
        <button class="btn-sm" data-action="detail" data-id="${o.id}">Detail</button>
        ${nextBtn(o)}
        <button class="btn-sm" data-action="edit" data-id="${o.id}">Edit</button>
        <button class="btn-sm danger" data-action="delete" data-id="${o.id}">Hapus</button>
      </div></td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="empty">Belum ada order yang cocok.</td></tr>`;
}

// ---------- Render: Kopra ----------
function renderKopra() {
  const list = state.orders.filter((o) => num(o.tonnage) > 0 && (num(o.buyPrice) > 0 || num(o.sellPrice) > 0));
  let vol = 0, buy = 0, sell = 0;
  $("#kopraTable").innerHTML = list.length
    ? list
        .map((o) => {
          const c = calc(o);
          vol += num(o.tonnage); buy += c.purchase; sell += c.sales;
          return `<tr>
        <td class="id">KOP-${o.id.slice(4)}</td>
        <td><button class="btn-sm" data-action="detail" data-id="${o.id}">${o.id}</button></td>
        <td>${esc(o.customer)}</td>
        <td>${esc(o.factory)}</td>
        <td>${fmtTon(o.tonnage)}</td>
        <td>${fmtRp(num(o.buyPrice))}</td>
        <td>${fmtRp(num(o.sellPrice))}</td>
        <td><b class="${c.kopraMargin >= 0 ? "up" : "down"}">${fmtShort(c.kopraMargin)}</b></td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="empty">Belum ada transaksi kopra. Isi tonase &amp; harga di Order Customer.</td></tr>`;
  $("#kopraVolume").textContent = fmtTon(vol);
  $("#kopraBuy").textContent = fmtShort(buy);
  $("#kopraSell").textContent = fmtShort(sell);
  $("#kopraMargin").textContent = fmtShort(sell - buy);
}

// ---------- Render: Shipping ----------
const SHIP_STATUS = { new: "Booking", stuffing: "Loading", sailing: "Berlayar", arrived: "Tiba", released: "Tiba", trucking: "Tiba", done: "Selesai" };
const SHIP_PROGRESS = { new: 0, stuffing: 15, sailing: 60, arrived: 100, released: 100, trucking: 100, done: 100 };

function renderShipping() {
  const list = state.orders.filter(isIsland);
  $("#shipGrid").innerHTML = list.length
    ? list
        .map((o) => {
          const p = SHIP_PROGRESS[o.stage];
          const showAct = ["new", "stuffing", "sailing"].includes(o.stage);
          return `<div class="ship">
        <div class="ship-top">
          <div class="circle">⚓</div>
          <div>
            <h3>${esc(o.vessel)}</h3>
            <small>${esc(o.maritime)} · Voyage ${esc(o.voyage || "—")}</small>
          </div>
        </div>
        <p><b>SHP-${o.id.slice(4)}</b> · ${o.id} · ${esc(o.customer)}</p>
        <p><b>Rute:</b> ${esc(o.portOrigin)} → ${esc(o.portDest)} · ETD ${o.etd ? fmtDate(o.etd) : "—"}</p>
        <div class="status-row">
          ${getBadge(SHIP_STATUS[o.stage])}
          <small>${containerText(o)} · ${fmtTon(o.tonnage)}</small>
        </div>
        <div class="meta">${o.mode === "Curah" ? "Muatan curah" : o.containers.map((c, i) => `${i + 1}. ${esc(c)}`).join("<br>") || "—"}</div>
        <div class="progress"><i style="width:${p}%"></i></div>
        <small>${p}% voyage</small>
        <div class="card-actions">
          ${showAct ? nextBtn(o) : ""}
          <button class="btn-sm" data-action="detail" data-id="${o.id}">Detail Order</button>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="card empty">Belum ada booking kapal. Buat order dengan rute Antar-Pulau.</div>`;
}

// ---------- Render: Documents ----------
function docRows(o) {
  const blStatus = reached(o, "sailing") ? "Valid" : "Draft";
  const doStatus = o.doValid ? "Valid" : reached(o, "arrived") ? "Menunggu" : "Draft";
  const release = reached(o, "trucking") ? "Released" : o.doValid ? "Ready" : "—";
  const cont = o.mode === "Curah" ? "Curah" : o.containers[0] ? esc(o.containers[0]) + (o.containers.length > 1 ? ` (+${o.containers.length - 1})` : "") : "—";
  return [
    { type: "BL", no: o.blNo, o, cont, port: o.portOrigin, release: "—", status: blStatus },
    { type: "DO", no: o.doNo, o, cont, port: o.portDest, release, status: doStatus },
  ];
}

function renderDocuments() {
  const rows = state.orders.filter(isIsland).flatMap(docRows);
  $("#docTable").innerHTML = rows.length
    ? rows
        .map(
          (r) => `<tr>
      <td><b>${r.type}</b><br>${esc(r.no)}</td>
      <td>${r.o.id}</td>
      <td>${r.cont}</td>
      <td>${esc(r.port)}</td>
      <td>${esc(r.o.factory)}</td>
      <td>${getBadge(r.release)}</td>
      <td>${getBadge(r.status)}</td>
      <td>${
        r.type === "DO" && r.o.stage === "arrived"
          ? `<button class="btn-sm go" data-action="advance" data-id="${r.o.id}">Validasi DO ✓</button>`
          : `<button class="btn-sm" data-action="detail" data-id="${r.o.id}">Detail</button>`
      }</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="empty">Belum ada dokumen. BL &amp; DO dibuat otomatis dari order Antar-Pulau.</td></tr>`;

  const pending = state.orders.filter((o) => o.stage === "arrived");
  const others = state.orders.filter((o) => isIsland(o) && o.stage !== "arrived");
  $("#docList").innerHTML =
    [...pending, ...others]
      .slice(0, 4)
      .map((o) => {
        const r = docRows(o)[1];
        return `<div>
        <div><b>DO · ${esc(o.doNo)}</b><small>${r.cont} → ${esc(o.factory)}</small></div>
        ${getBadge(r.status)}
      </div>`;
      })
      .join("") || `<div class="empty">Belum ada dokumen.</div>`;
}

// ---------- Render: Ports ----------
function portInfo(o) {
  switch (o.stage) {
    case "new": return { port: o.portOrigin, status: "Booking", note: "Container kosong menunggu muat kopra dari supplier" };
    case "stuffing": return { port: o.portOrigin, status: "Gate In", note: `Stuffing selesai, menunggu loading ke ${o.vessel}` };
    case "sailing": return { port: o.portDest, status: "On Vessel", note: `Dalam pelayaran ${o.vessel} dari ${o.portOrigin}` };
    case "arrived": return { port: o.portDest, status: "Menunggu DO", note: "Jangan release sebelum DO valid" };
    case "released": return { port: o.portDest, status: "Ready for Pickup", note: o.plate ? `DO valid • Truk ${o.plate} siap pickup` : "DO valid • Truk belum ditugaskan" };
    case "trucking": return { port: o.portDest, status: "Gate Out", note: `Truk ${o.plate} menuju ${o.factory}` };
    default: return null;
  }
}

function renderPorts() {
  const list = state.orders.filter((o) => isIsland(o) && o.stage !== "done");
  $("#portGrid").innerHTML = list.length
    ? list
        .map((o) => {
          const p = portInfo(o);
          const act = ["arrived", "released"].includes(o.stage) ? nextBtn(o) : "";
          return `<div class="port">
        <div class="status-row"><h3>${esc(p.port)}</h3>${getBadge(p.status)}</div>
        <p>${o.id} · ${esc(o.customer)} → <b>${esc(o.factory)}</b></p>
        <p>Container: <b>${o.mode === "Curah" ? "Curah" : esc(o.containers.join(", ")) || "—"}</b></p>
        <div class="meta">${esc(p.note)}</div>
        <div class="card-actions">${act}<button class="btn-sm" data-action="detail" data-id="${o.id}">Detail</button></div>
      </div>`;
        })
        .join("")
    : `<div class="card empty">Tidak ada container di pelabuhan saat ini.</div>`;
}

// ---------- Render: Trucking ----------
function truckStatus(o) {
  if (!o.plate) return "Belum Ditugaskan";
  if (o.stage === "done") return "Selesai";
  if (o.stage === "trucking") return "Menuju Pabrik";
  if (isIsland(o)) {
    if (o.stage === "released") return "Ready for Pickup";
    if (o.stage === "arrived") return "Menunggu DO";
  }
  return "Dijadwalkan";
}

function renderTrucking() {
  const list = state.orders.filter((o) => o.stage !== "done" && (o.plate || o.stage === "released" || (!isIsland(o) && o.stage === "new")));
  $("#truckGrid").innerHTML = list.length
    ? list
        .map((o) => {
          const p = o.stage === "trucking" ? 55 : o.stage === "released" || (!isIsland(o) && o.stage === "new") ? 10 : 0;
          const canGo = (isIsland(o) && ["released", "trucking"].includes(o.stage)) || !isIsland(o);
          const lock = isIsland(o) && !reached(o, "released") ? `<div class="lock-note">🔒 Terkunci sampai DO divalidasi</div>` : "";
          return `<div class="truck">
        <div class="status-row"><h3>${esc(o.plate || "— Belum ada truk —")}</h3>${getBadge(truckStatus(o))}</div>
        <p>Order: <b>${o.id}</b> · ${fmtTon(o.tonnage)} · ${containerText(o)}</p>
        <p>Driver: ${o.driver ? `<button class="driver-link" type="button" data-action="driver" data-name="${esc(o.driver)}">${esc(o.driver)}</button>` : "—"}</p>
        <p>Pickup: ${esc(isIsland(o) ? o.portDest : o.origin)}</p>
        <p>Tujuan: <b>${esc(o.factory)}</b></p>
        <div class="progress"><i style="width:${p}%"></i></div>
        <small>${p}% perjalanan</small>
        ${lock}
        <div class="card-actions">
          ${o.plate ? (canGo ? nextBtn(o) : "") : `<button class="btn-sm go" data-action="edit" data-id="${o.id}">Tugaskan Truk</button>`}
          <button class="btn-sm" data-action="detail" data-id="${o.id}">Detail</button>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="card empty">Belum ada penugasan truk aktif.</div>`;

  const busy = new Set(state.orders.filter((o) => o.stage !== "done" && o.plate).map((o) => o.plate));
  $("#fleetAvailable").innerHTML =
    TRUCK_FLEET.filter((t) => !busy.has(t.plate))
      .map((t) => `<button class="fleet-chip" data-action="newWithPlate" data-plate="${esc(t.plate)}" title="Buat order dengan truk ini">🚚 ${esc(t.plate)} · ${esc(t.driver)}</button>`)
      .join("") || `<span class="muted">Semua armada sedang bertugas.</span>`;
}

// ---------- Render: Customers ----------
function deriveParties() {
  const map = new Map();
  const add = (name, type, address, o) => {
    if (!name) return;
    const key = name.trim().toLowerCase() + "|" + type;
    const p = map.get(key) || { name: name.trim(), type, address: address || "", orders: 0, ton: 0 };
    p.orders++;
    p.ton += num(o.tonnage);
    if (address && !p.address) p.address = address;
    map.set(key, p);
  };
  state.orders.forEach((o) => {
    add(o.factory, "Customer / Pabrik", o.factoryAddress, o);
    add(o.customer, "Supplier", o.origin, o);
    if (isIsland(o)) add(o.maritime, "Perusahaan Maritim", "", o);
  });
  return [...map.values()];
}

function renderCustomers() {
  const parties = deriveParties();
  $("#customerGrid").innerHTML = parties.length
    ? parties
        .map(
          (p) => `<div class="person">
      <div class="person-top">
        <div class="circle">${esc(p.name.replace(/^(PT|CV|UD|KM|MV)\s+/i, "").slice(0, 2).toUpperCase())}</div>
        <div><h3>${esc(p.name)}</h3><small>${esc(p.type)}</small></div>
      </div>
      <div class="meta">
        Lokasi: ${esc(p.address || "—")}<br>
        Order: <b>${p.orders}</b> · Total: <b>${fmtTon(p.ton)}</b>
      </div>
      <div class="card-actions"><button class="btn-sm" data-action="filterOrders" data-q="${esc(p.name)}">Lihat Order →</button></div>
    </div>`
        )
        .join("")
    : `<div class="card empty">Belum ada data mitra.</div>`;

  const fill = (id, type) =>
    ($(id).innerHTML = parties.filter((p) => p.type === type).map((p) => `<option value="${esc(p.name)}"></option>`).join(""));
  fill("#dlFactory", "Customer / Pabrik");
  fill("#dlSupplier", "Supplier");
  fill("#dlMaritime", "Perusahaan Maritim");
}

// ---------- Render: Finance ----------
function renderFinance() {
  let rev = 0, cost = 0, recv = 0;
  $("#financeTable").innerHTML = state.orders.length
    ? state.orders
        .map((o) => {
          const c = calc(o);
          rev += c.revenue;
          cost += c.purchase + c.logistics;
          if (o.payment !== "Lunas") recv += c.revenue;
          return `<tr>
        <td class="id">${o.id}</td>
        <td>${esc(o.factory)}</td>
        <td>${fmtRp(c.revenue)}</td>
        <td>${fmtRp(c.purchase)}</td>
        <td class="expense">${fmtRp(c.logistics)}</td>
        <td><b class="${c.profit >= 0 ? "up" : "down"}">${fmtRp(c.profit)}</b></td>
        <td>${getBadge(o.payment)}</td>
        <td><div class="act">
          <button class="btn-sm ${o.payment === "Lunas" ? "" : "go"}" data-action="pay" data-id="${o.id}">${o.payment === "Lunas" ? "Batalkan Lunas" : "Tandai Lunas"}</button>
          <button class="btn-sm" data-action="detail" data-id="${o.id}">Detail</button>
        </div></td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="empty">Belum ada data keuangan.</td></tr>`;
  $("#finRevenue").textContent = fmtShort(rev);
  $("#finCost").textContent = fmtShort(cost);
  $("#finReceivable").textContent = fmtShort(recv);
  $("#finProfit").textContent = fmtShort(rev - cost);
}

// ---------- Render: Reports ----------
function renderReports() {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ y: d.getFullYear(), m: d.getMonth(), ton: 0 });
  }
  state.orders.forEach((o) => {
    const d = new Date(o.createdAt);
    const b = buckets.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
    if (b) b.ton += num(o.tonnage);
  });
  const max = Math.max(1, ...buckets.map((b) => b.ton));
  $("#reportBars").innerHTML = buckets
    .map(
      (b) => `<i style="height:${Math.max(2, (b.ton / max) * 100)}%" title="${fmtTon(b.ton)}">
        <b style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:9px;font-style:normal;color:#374151">${b.ton ? b.ton.toLocaleString("id-ID") : ""}</b>
        <span>${MONTHS[b.m]}</span></i>`
    )
    .join("");

  const g = new Map();
  state.orders.forEach((o) => {
    const c = calc(o);
    const r = g.get(o.factory) || { name: o.factory, n: 0, ton: 0, rev: 0, profit: 0 };
    r.n++; r.ton += num(o.tonnage); r.rev += c.revenue; r.profit += c.profit;
    g.set(o.factory, r);
  });
  $("#reportCustomer").innerHTML =
    [...g.values()]
      .sort((a, b) => b.rev - a.rev)
      .map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${r.n}</td><td>${fmtTon(r.ton)}</td><td>${fmtRp(r.rev)}</td><td><b class="${r.profit >= 0 ? "up" : "down"}">${fmtRp(r.profit)}</b></td></tr>`)
      .join("") || `<tr><td colspan="5" class="empty">Belum ada data.</td></tr>`;
}

function exportCSV() {
  const head = ["Order", "Tanggal", "Supplier", "PT Tujuan", "Rute", "Layanan", "Tonase", "Harga Beli", "Harga Jual", "Kapal", "Voyage", "Port Asal", "Port Tujuan", "Container", "BL", "DO", "Nopol", "Driver", "Pendapatan", "Pembelian", "Biaya Logistik", "Laba", "Pembayaran", "Status"];
  const lines = state.orders.map((o) => {
    const c = calc(o);
    return [o.id, fmtDate(o.createdAt), o.customer, o.factory, o.routeType, o.serviceType, o.tonnage, o.buyPrice, o.sellPrice, o.vessel, o.voyage, o.portOrigin, o.portDest, o.mode === "Curah" ? "Curah" : o.containers.join(" / "), o.blNo, o.doNo, o.plate, o.driver, c.revenue, c.purchase, c.logistics, c.profit, o.payment, STAGE_LABEL[o.stage]]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `laporan-cv-arya-pramana-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Laporan CSV berhasil diunduh");
}

// ---------- Render: Dashboard ----------
function renderDashboard() {
  const active = state.orders.filter((o) => o.stage !== "done");
  const island = active.filter(isIsland);
  const containers = island.reduce((s, o) => s + (o.mode === "Curah" ? 0 : o.containers.length), 0);
  const ships = new Set(island.filter((o) => ["stuffing", "sailing"].includes(o.stage)).map((o) => o.vessel + "|" + o.voyage));
  const trucks = active.filter((o) => o.plate);
  const onRoad = active.filter((o) => o.stage === "trucking");
  const unpaid = state.orders.filter((o) => o.payment !== "Lunas");
  const recv = unpaid.reduce((s, o) => s + calc(o).revenue, 0);

  $("#statActiveOrders").textContent = active.length;
  $("#statAntarPulau").textContent = `${island.length} antar-pulau`;
  $("#statContainers").textContent = containers;
  $("#statActiveShips").textContent = `${ships.size} kapal aktif`;
  $("#statTruckings").textContent = trucks.length;
  $("#statTruckActive").textContent = `${onRoad.length} dalam perjalanan`;
  $("#statReceivables").textContent = fmtShort(recv);
  $("#statInvoices").textContent = `${unpaid.length} invoice`;
  $("#notifCount").textContent = state.orders.filter((o) => o.stage === "arrived").length;

  const count = (keys) => active.filter((o) => keys.includes(o.stage)).length;
  const steps = [
    ["Supplier", "Kopra siap", count(["new"])],
    ["Stuffing", "Container", count(["stuffing"])],
    ["Shipping", "Kapal", count(["sailing"])],
    ["Port", "BL & DO", count(["arrived", "released"])],
    ["Trucking", "Ke pabrik", count(["trucking"])],
    ["Factory", "Selesai", state.orders.filter((o) => o.stage === "done").length],
  ];
  $("#flowTimeline").innerHTML = steps
    .map((s, i) => `${i ? '<div class="line"></div>' : ""}<div><i>${i + 1}</i><b>${s[0]}</b><small>${s[1]}</small><span class="count">${s[2]} order</span></div>`)
    .join("");

  $("#shipmentList").innerHTML =
    state.orders
      .filter(isIsland)
      .sort((a, b) => (a.stage === "done") - (b.stage === "done"))
      .slice(0, 4)
      .map(
        (o) => `<div data-action="detail" data-id="${o.id}" style="cursor:pointer">
        <div><b>SHP-${o.id.slice(4)} · ${esc(o.vessel)}</b><small>${esc(o.portOrigin)} → ${esc(o.portDest)} · ${containerText(o)}</small></div>
        ${getBadge(SHIP_STATUS[o.stage])}
      </div>`
      )
      .join("") || `<div class="empty">Belum ada shipment.</div>`;
}

// ---------- Render: Order Detail ----------
function renderOrderDetail() {
  const o = findOrder(detailId);
  if (!o) return closeModal("orderDetailModal");
  const c = calc(o);
  const flow = flowOf(o);
  const idx = stageIdx(o);
  const na = nextAction(o);
  $("#orderDetailBody").innerHTML = `
    <div class="detail-head">
      <div>
        <h2>${o.id}</h2>
        <p class="muted">${esc(o.customer)} → <b>${esc(o.factory)}</b> · ${esc(o.serviceType)} · ${fmtDate(o.createdAt)}</p>
      </div>
      ${getBadge(STAGE_LABEL[o.stage])}
    </div>
    <div class="stepper">
      ${flow.map((k, i) => `<div class="st ${i < idx ? "done" : i === idx ? "now" : ""}"><i></i>${STAGE_LABEL[k]}</div>`).join("")}
    </div>
    <div class="detail-grid">
      <div class="detail-box"><h4>Komoditas</h4>
        Tonase: <b>${fmtTon(o.tonnage)}</b><br>
        Harga beli: ${fmtRp(num(o.buyPrice))}/kg · jual: ${fmtRp(num(o.sellPrice))}/kg<br>
        Margin kopra: <b>${fmtRp(c.kopraMargin)}</b>
      </div>
      <div class="detail-box"><h4>${isIsland(o) ? "Shipping" : "Rute Domestik"}</h4>
        ${isIsland(o)
          ? `${esc(o.maritime)}<br>${esc(o.vessel)} · Voy ${esc(o.voyage || "—")}<br>${esc(o.portOrigin)} → ${esc(o.portDest)} · ETD ${o.etd ? fmtDate(o.etd) : "—"}`
          : `${esc(o.origin)} → ${esc(o.factory)} (${esc(o.factoryAddress || "—")})`}
      </div>
      <div class="detail-box"><h4>Muatan &amp; Dokumen</h4>
        ${o.mode === "Curah" ? "Curah" : `Container: ${esc(o.containers.join(", ")) || "—"}`}<br>
        ${isIsland(o) ? `BL: ${esc(o.blNo)} · DO: ${esc(o.doNo)} ${o.doValid ? "✅" : "⏳"}` : "Tanpa BL/DO"}
      </div>
      <div class="detail-box"><h4>Trucking</h4>
        ${o.plate ? `${esc(o.plate)} · <button class="driver-link" type="button" data-action="driver" data-name="${esc(o.driver)}">${esc(o.driver)}</button>` : "Truk belum ditugaskan"}<br>
        Status: ${truckStatus(o)}
      </div>
      <div class="detail-box" style="grid-column:1/-1"><h4>Keuangan</h4>
        Pendapatan ${fmtRp(c.revenue)} (kopra ${fmtRp(c.sales)} + jasa ${fmtRp(num(o.serviceFee))})<br>
        Pembelian ${fmtRp(c.purchase)} · Freight ${fmtRp(num(o.costs.freight))} · THC ${fmtRp(num(o.costs.thc))} · DO ${fmtRp(num(o.costs.doFee))} · Uang jalan ${fmtRp(num(o.costs.trucking))} · Lain ${fmtRp(num(o.costs.other))}<br>
        Laba bersih: <b class="${c.profit >= 0 ? "up" : "down"}">${fmtRp(c.profit)}</b> · Pembayaran: ${getBadge(o.payment)}
        ${o.notes ? `<br>Catatan: ${esc(o.notes)}` : ""}
      </div>
    </div>
    <div class="detail-actions">
      ${na ? `<button class="primary" data-action="advance" data-id="${o.id}">${na.label} →</button>` : ""}
      <button class="secondary" data-action="pay" data-id="${o.id}">${o.payment === "Lunas" ? "Batalkan Lunas" : "Tandai Lunas"}</button>
      <button class="secondary" data-action="edit" data-id="${o.id}">Edit</button>
      <button class="secondary danger" data-action="delete" data-id="${o.id}">Hapus</button>
    </div>
    ${na && na.blocked ? `<p class="lock-note">⚠️ ${esc(na.blocked)}</p>` : ""}`;
}

function showDetail(id) {
  detailId = id;
  renderOrderDetail();
  openModal("orderDetailModal");
}

// ---------- Driver Modal ----------
function showDriverHistory(name) {
  if (!name) return;
  const orders = state.orders.filter((o) => (o.driver || "").toLowerCase() === name.toLowerCase());
  const latest = orders[0];
  const fleet = TRUCK_FLEET.find((t) => t.driver.toLowerCase() === name.toLowerCase()) || FLEET_MAP[latest?.plate] || {};
  const activeOrder = orders.find((o) => o.stage !== "done");
  const status = activeOrder ? truckStatus(activeOrder) : "Tersedia";

  $("#driverModalName").textContent = name;
  $("#driverModalPlate").textContent = `Nopol: ${latest?.plate || fleet.plate || "—"} · ${fleet.type || "Armada Ekspedisi"}`;
  $("#driverModalStatus").innerHTML = getBadge(status);
  $("#driverModalPhone").textContent = fleet.phone || "—";
  $("#driverModalTrips").textContent = `${orders.length} ritase`;
  $("#driverModalHistory").innerHTML = orders.length
    ? orders
        .map(
          (o) => `<div class="driver-history-item">
        <div><b>${o.id} · ${esc(o.factory)}</b><small>${esc(isIsland(o) ? o.portDest : o.origin)} → ${esc(o.factory)} · ${fmtTon(o.tonnage)} · ${fmtDate(o.createdAt)}</small></div>
        ${getBadge(STAGE_LABEL[o.stage])}
      </div>`
        )
        .join("")
    : `<div class="empty">Belum ada riwayat pengiriman.</div>`;
  openModal("driverModal");
}
window.showDriverHistory = showDriverHistory;

// ---------- Master Render ----------
function render() {
  renderOrders();
  renderKopra();
  renderShipping();
  renderDocuments();
  renderPorts();
  renderTrucking();
  renderCustomers();
  renderFinance();
  renderReports();
  renderDashboard();
  if (detailId) renderOrderDetail();
}

/* =========================================================
   ORDER FORM (MASTER INPUT)
   ========================================================= */
const form = $("#orderForm");

function buildPlateOptions(selected = "") {
  const busy = new Map(state.orders.filter((o) => o.stage !== "done" && o.plate && o.id !== editingId).map((o) => [o.plate, o.id]));
  const opts = [`<option value="">— Belum ditugaskan —</option>`];
  TRUCK_FLEET.forEach((t) => {
    const b = busy.get(t.plate);
    opts.push(`<option value="${t.plate}">${t.plate} · ${t.driver}${b ? ` (sedang ${b})` : ""}</option>`);
  });
  opts.push(`<option value="manual">+ Isi Nomor Polisi Sendiri</option>`);
  $("#orderPlate").innerHTML = opts.join("");
  $("#orderPlate").value = selected;
}

function buildContainerInputs(values) {
  const box = $("#containerList");
  const n = parseInt($("#jumlahContainer").value) || 1;
  const current = values || [...box.querySelectorAll("input")].map((i) => i.value);
  box.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const label = document.createElement("label");
    const val = current[i - 1] || `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`;
    label.innerHTML = `Container ${i}<input type="text" name="container${i}" value="${val}" placeholder="Contoh: MSCU12345${i}" style="text-transform:uppercase" />`;
    box.appendChild(label);
  }
}

function updateFormVisibility() {
  const island = form.elements.route_type.value !== "Domestik";
  $("#fsShipping").disabled = !island;
  $("#fsDocs").disabled = !island;
  $("#fsShipCost").disabled = !island;
  $("#containerBox").disabled = form.elements.mode.value === "Curah";

  const manual = $("#orderPlate").value === "manual";
  const mBox = $("#manualPlateBox");
  mBox.hidden = !manual;
  mBox.disabled = !manual;
  const drv = $("#orderDriver");
  if (manual) {
    drv.readOnly = false;
    drv.placeholder = "Ketik nama driver";
  } else {
    drv.readOnly = true;
    drv.placeholder = "Otomatis sesuai nopol";
    drv.value = FLEET_MAP[$("#orderPlate").value]?.driver || "";
  }
  updateSummary();
}

function updateSummary() {
  const v = (n) => (form.elements[n] && !form.elements[n].disabled && !form.elements[n].closest("fieldset[disabled]") ? num(form.elements[n].value) : 0);
  const draft = {
    tonnage: v("tonnage"), buyPrice: v("buy_price"), sellPrice: v("sell_price"), serviceFee: v("service_fee"),
    costs: { freight: v("cost_freight"), thc: v("cost_thc"), doFee: v("cost_do"), trucking: v("cost_trucking"), other: v("cost_other") },
  };
  const c = calc(draft);
  $("#orderSummary").innerHTML = `
    <div><span>Pendapatan</span><b>${fmtShort(c.revenue)}</b></div>
    <div><span>Pembelian Kopra</span><b>${fmtShort(c.purchase)}</b></div>
    <div><span>Biaya Logistik</span><b>${fmtShort(c.logistics)}</b></div>
    <div><span>Estimasi Laba</span><b class="${c.profit >= 0 ? "pos" : "neg"}">${fmtShort(c.profit)}</b></div>`;
}

function openOrderForm(id = null, preset = {}) {
  editingId = id;
  form.reset();
  const o = id ? findOrder(id) : null;
  $("#orderModalTitle").textContent = o ? `Edit Order ${o.id}` : "Tambah Order";
  $("#orderSubmitBtn").textContent = o ? "Simpan Perubahan" : "Simpan Order";

  const isFleet = o && FLEET_MAP[o.plate];
  buildPlateOptions(o ? (o.plate ? (isFleet ? o.plate : "manual") : "") : preset.plate || "");

  const set = (name, val) => form.elements[name] && (form.elements[name].value = val ?? "");

  if (o) {
    set("customer", o.customer); set("factory", o.factory); set("service_type", o.serviceType);
    set("factory_address", o.factoryAddress); set("origin", o.origin); set("route_type", o.routeType);
    set("tonnage", o.tonnage); set("buy_price", o.buyPrice || ""); set("sell_price", o.sellPrice || "");
    set("maritime", o.maritime); set("vessel", o.vessel); set("voyage", o.voyage);
    set("port_origin", o.portOrigin); set("port_dest", o.portDest); set("etd", o.etd);
    set("mode", o.mode); set("bl_no", o.blNo); set("do_no", o.doNo);
    set("service_fee", o.serviceFee || ""); set("cost_freight", o.costs.freight || ""); set("cost_thc", o.costs.thc || "");
    set("cost_do", o.costs.doFee || ""); set("cost_trucking", o.costs.trucking || ""); set("cost_other", o.costs.other || "");
    set("payment", o.payment); set("notes", o.notes);
    set("jumlah_container", o.containers.length ? String(Math.min(o.containers.length, 10)) : "1");
    buildContainerInputs(o.containers);
    if (o.plate && !isFleet) set("manual_plate", o.plate);
  } else {
    // Nilai bawaan untuk mempercepat pengisian
    set("service_type", "Kopra + Shipping + Trucking (Lengkap)");
    set("route_type", "Antar-Pulau");
    set("maritime", "PT Nusantara Maritime");
    set("vessel", "MV Bintang Laut");
    set("voyage", "028E");
    set("port_origin", "Pelabuhan Bitung");
    set("port_dest", "Tanjung Perak");
    set("mode", "Container");
    set("jumlah_container", "1");
    buildContainerInputs([`MSCU${Math.floor(1000000 + Math.random() * 9000000)}`]);
  }

  updateFormVisibility();
  if (o && o.plate && !isFleet) $("#orderDriver").value = o.driver || "";
  openModal("orderModal");
  setTimeout(() => form.elements.customer.focus(), 50);
}
window.openOrderForm = openOrderForm;

form.addEventListener("change", (e) => {
  if (["route_type", "mode", "plate"].includes(e.target.name)) updateFormVisibility();
  if (e.target.id === "jumlahContainer") buildContainerInputs();
});
form.addEventListener("input", updateSummary);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const g = (k) => (fd.get(k) ?? "").toString().trim();
  const routeType = g("route_type") || "Antar-Pulau";
  const island = routeType !== "Domestik";
  const mode = g("mode") || "Container";

  let plate = g("plate");
  let driver = g("driver");
  if (plate === "manual") plate = g("manual_plate").toUpperCase();
  if (plate && !driver) driver = FLEET_MAP[plate]?.driver || "Driver Ekspedisi";
  if (!plate) driver = "";

  const containers = [];
  if (island && mode === "Container") {
    const n = parseInt(g("jumlah_container")) || 1;
    for (let i = 1; i <= n; i++) {
      let c = g(`container${i}`).toUpperCase();
      if (!c) c = `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`;
      containers.push(c);
    }
    if (containers.length === 0) {
      containers.push(`MSCU${Math.floor(1000000 + Math.random() * 9000000)}`);
    }
  }

  const existing = editingId ? findOrder(editingId) : null;
  let id = existing?.id;
  if (!existing) {
    state.seq += 1;
    id = `ORD-${String(state.seq).padStart(4, "0")}`;
  }
  const n4 = id.slice(4);

  const data = {
    id,
    createdAt: existing?.createdAt || new Date().toISOString(),
    customer: g("customer"),
    factory: g("factory"),
    factoryAddress: g("factory_address"),
    serviceType: g("service_type"),
    origin: g("origin"),
    routeType,
    tonnage: num(g("tonnage")),
    buyPrice: num(g("buy_price")),
    sellPrice: num(g("sell_price")),
    maritime: island ? g("maritime") : "",
    vessel: island ? g("vessel") : "",
    voyage: island ? g("voyage") : "",
    portOrigin: island ? g("port_origin") : "",
    portDest: island ? g("port_dest") : "",
    etd: island ? g("etd") : "",
    mode,
    containers: mode === "Curah" ? [] : containers,
    blNo: island ? g("bl_no") || `BL-${n4}-001` : "",
    doNo: island ? g("do_no") || `DO-${n4}-001` : "",
    doValid: existing?.doValid || false,
    plate,
    driver,
    serviceFee: num(g("service_fee")),
    costs: {
      freight: island ? num(g("cost_freight")) : 0,
      thc: island ? num(g("cost_thc")) : 0,
      doFee: island ? num(g("cost_do")) : 0,
      trucking: num(g("cost_trucking")),
      other: num(g("cost_other")),
    },
    payment: g("payment") || "Belum Lunas",
    notes: g("notes"),
    stage: existing?.stage || "new",
    history: existing?.history || [{ stage: "new", at: new Date().toISOString() }],
  };
  // Jika rute diubah, pastikan status tetap valid untuk alur barunya
  if (!flowOf(data).includes(data.stage)) data.stage = "new";
  if (!island) data.doValid = false;

  if (existing) {
    Object.assign(existing, data);
  } else {
    state.orders.unshift(data);
  }

  saveState();
  lastSavedId = id;
  closeModal("orderModal");
  render();
  if (!existing) {
    goTo("orders");
    toast(`✅ ${id} tersimpan — Kopra, Shipping, BL/DO, Pelabuhan, Trucking, Customer & Keuangan ikut terupdate`);
  } else {
    toast(`✅ ${id} diperbarui di semua modul`);
  }
  editingId = null;
  setTimeout(() => {
    lastSavedId = null;
  }, 3000);
});

/* =========================================================
   GLOBAL EVENTS
   ========================================================= */
document.addEventListener("click", (e) => {
  const act = e.target.closest("[data-action]");
  if (act) {
    const { action, id } = act.dataset;
    switch (action) {
      case "detail": return showDetail(id);
      case "advance": return advanceOrder(id);
      case "edit":
        closeModal("orderDetailModal");
        return openOrderForm(id);
      case "delete": return deleteOrder(id);
      case "pay": return togglePayment(id);
      case "driver": return showDriverHistory(act.dataset.name);
      case "newWithPlate": return openOrderForm(null, { plate: act.dataset.plate });
      case "filterOrders":
        $("#orderSearch").value = act.dataset.q;
        $("#orderStatusFilter").value = "all";
        renderOrders();
        return goTo("orders");
    }
    return;
  }
  const nav = e.target.closest("[data-page]");
  if (nav) goTo(nav.dataset.page);
});

document.querySelectorAll(".modal-wrap").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m.id);
  })
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal-wrap.show").forEach((m) => closeModal(m.id));
});

$("#mobileMenu").onclick = () => $(".sidebar").classList.toggle("open");
$("#orderSearch").addEventListener("input", renderOrders);
$("#orderStatusFilter").addEventListener("change", renderOrders);
$("#btnExport").addEventListener("click", exportCSV);
$("#btnResetData").addEventListener("click", () => {
  if (!confirm("Reset seluruh data ke kondisi demo awal? Semua order yang Anda input akan terhapus.")) return;
  state = seedState();
  saveState();
  render();
  toast("Data demo berhasil direset");
});

// Sinkron antar tab browser
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadState();
    render();
  }
});

render();
