# 📘 PANDUAN PENGGUNAAN VOUCHERAPP v2.0
**Sistem Manajemen Voucher WiFi Terintegrasi POS & MikroTik**

Selamat datang di VoucherApp! Panduan ini akan membantu Anda memahami cara mengoperasikan aplikasi untuk mencetak voucher WiFi secara cepat dan profesional.

---

## 1. Persiapan & Akses
Aplikasi ini berjalan sebagai server web lokal. Anda dapat mengaksesnya melalui:
*   **Komputer Server:** Buka browser dan ketik `http://localhost:3000`
*   **Perangkat Lain (HP/Tablet):** Gunakan Alamat IP yang tertera pada menu **Pengaturan** (Contoh: `http://100.80.195.51:3000`)

---

## 2. Konfigurasi Awal (Wajib Dilakukan Sekali)
Sebelum memulai transaksi, pastikan koneksi ke perangkat luar sudah tersetel:
1.  Klik menu **Pengaturan** di sidebar kiri.
2.  **Sistem POS API:** Masukkan URL API, API Key, dan ID Outlet POS Anda.
3.  **MikroTik Hotspot API:** Masukkan IP Router, Username, dan Password Admin MikroTik Anda.
4.  **Tes Koneksi:** Klik tombol "Tes Koneksi" di setiap kartu untuk memastikan status menjadi **Online (Hijau)**.
5.  **Aturan Bisnis:** Atur "Minimum Belanja" dan "Durasi Voucher" (misal: 60 menit) sesuai kebijakan outlet Anda.

---

## 3. Cara Membuat Voucher (Proses Utama)
Ada dua cara untuk menghasilkan voucher WiFi bagi pelanggan:

### A. Otomatis (Scan dari Nota POS) — *Sangat Direkomendasikan*
Gunakan cara ini jika pelanggan sudah membayar di kasir POS:
1.  Buka menu **Proses Voucher**.
2.  Pada kotak **"Scan / Input Order ID"**, scan kode QR dari struk belanja pelanggan atau ketik Order ID-nya.
3.  Tekan **ENTER** atau klik tombol **PROSES ORDER**.
4.  **Sistem akan otomatis menjalankan Pipeline:**
    *   Memvalidasi apakah Order ID tersebut sudah lunas/PAID.
    *   Mengecek apakah nominal belanja memenuhi syarat.
    *   Menghasilkan kode voucher unik (Contoh: `WF-A1B2C3`).
    *   Mendaftarkan kode tersebut ke dalam MikroTik secara otomatis.
5.  Setelah selesai, kartu **Tiket Voucher** akan muncul. Klik **PRINT STRUK** untuk mencetak voucher bagi pelanggan.

### B. Manual (Tanpa Order POS)
Gunakan cara ini untuk tamu VIP atau keperluan darurat:
1.  Klik ikon **(+)** di sebelah tombol "Proses Order" untuk membuka **Generator Manual**.
2.  Masukkan jumlah voucher yang diinginkan dan durasi menitnya.
3.  Klik **GENERATE & AKTIFKAN**.

---

## 4. Monitoring & Laporan
*   **Dashboard:** Lihat statistik harian, jumlah device aktif saat ini, dan estimasi pendapatan dari voucher yang terjual.
*   **Daftar Voucher:** Lihat seluruh riwayat voucher yang pernah dibuat. Anda bisa mencari kode tertentu, melihat statusnya (Aktif/Terpakai), atau menghapus voucher lama.

---

## 5. Tips Operasional & Troubleshooting
*   **Indikator Server:** Pastikan lampu status di dashboard atas selalu **Hijau**. Jika Merah, berarti server backend atau router terputus.
*   **Gagal Deteksi IP:** Jika status jaringan di Pengaturan bertuliskan "Gagal Deteksi", lakukan *Hard Reload* pada browser (Tekan `CTRL + F5`).
*   **Cetak Otomatis:** Anda bisa mengaktifkan fitur "Auto-Print" di menu Pengaturan bagian bawah agar struk langsung tercetak begitu proses validasi selesai.

---
*Dibuat oleh Antigravity AI untuk VoucherApp Management.*
