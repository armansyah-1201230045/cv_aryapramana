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

## Menghubungkan Supabase

1. Buat project di [Supabase](https://supabase.com/) dan jalankan seluruh isi [`supabase/schema.sql`](./supabase/schema.sql) melalui SQL Editor. Jika sebelumnya pernah menjalankan versi lama, jalankan ulang seluruh file setelah perubahan ini.
2. Buat akun pemilik di **Authentication → Users** pada Supabase. Aplikasi ini memakai login email/password; pendaftaran akun publik tidak disediakan.
3. Salin `.env.example` menjadi `.env.local`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari **Project Settings → API**. Gunakan anon/publishable key saja; jangan pernah menaruh `service_role` key di aplikasi browser.
4. Jalankan ulang `npm run dev`, lalu masuk dengan akun Supabase tersebut.

Setiap order disimpan sebagai satu baris di tabel `orders`; kolom `customer`, `factory`, `stage`, dan `created_at` mudah dibaca dari Table Editor, sedangkan semua detail order ada pada kolom `data` (JSON). `app_state` hanya menyimpan nomor urut order. Invoice disimpan di `invoices` dan pembayaran di `invoice_payments`. Row Level Security membatasi akses ke akun pemiliknya. Jika cloud masih berisi format lama di `app_state`, aplikasi memigrasikannya ke `orders` saat login; data lokal tetap ditanyakan sebelum diimpor bila belum ada data cloud. Pilihan **mode lokal** hanya menyimpan data pada browser/perangkat saat ini dan tidak melakukan sinkronisasi.

## Publikasi ke GitHub Pages

Workflow [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) menerbitkan site otomatis saat ada push ke branch `main`. Di GitHub repository settings, tambahkan Actions repository secrets `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, lalu pilih **Settings → Pages → Build and deployment → Source: GitHub Actions**. Jangan simpan `service_role` key sebagai secret aplikasi. Setelah workflow selesai, site tersedia di `https://armansyah-1201230045.github.io/cv_aryapramana/`.
