# projectweb-cv_arya_pramana

Sistem Operasi & Manajemen Logistik Terintegrasi **CV Arya Pramana** (*Trade · Shipping · Trucking*).

Platform web untuk mengelola end-to-end rantai pasok komoditas kopra dan logistik ekspedisi:
- **Order Customer Terintegrasi**: Input satu pintu yang otomatis mensinkronkan seluruh modul operasional.
- **Transaksi Kopra**: Manajemen pembelian dari supplier, tonase, harga beli/jual, dan margin laba.
- **Shipping & Kapal**: Booking kapal kargo antar-pulau, voyage tracking, rute pelabuhan, dan manifest container.
- **Dokumen (BL & DO)**: Kontrol validasi Bill of Lading & Delivery Order untuk release container.
- **Pelabuhan (Port Call)**: Monitoring posisi container (Booking, Gate In, On Vessel, Menunggu DO, Ready for Pickup, Gate Out).
- **Trucking & Armada**: Manajemen 12 armada truk (L 8231 AB – L 8242 AB), penugasan supir, dan pelacakan ritase.
- **Customer / Pabrik**: Direktori mitra buyer/pabrik, supplier, dan perusahaan pelayaran.
- **Keuangan**: Perhitungan pendapatan, biaya logistik (freight, THC, DO fee, uang jalan), piutang, dan laba bersih per order.
- **Laporan & Export**: Grafik shipment bulanan dan export laporan lengkap ke file CSV.

---

## 🚀 Cara Menjalankan Proyek

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan)

### Instalasi & Menjalankan Dev Server
```bash
# Install dependency
npm install

# Jalankan development server
npm run dev
```

Buka browser di `http://localhost:5173/`.
