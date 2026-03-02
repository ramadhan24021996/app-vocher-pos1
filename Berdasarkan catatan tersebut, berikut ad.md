Berdasarkan catatan tersebut, berikut adalah flow yang saya baca:
Order Paid di Runchise (POS)
Kasir scan / input Order ID DARI APLIKASI RUNCHISE
Aplikasi ambil detail order
Validasi: status = Paid, order belum dipakai, total ≥ 30.000 DAN SETERUSNYA DAN BISA GENRETE PADA DASBOARD APLIKASI
Hitung device count BISA DISESUAIKAN PADA DABOARD
Generate 1 account voucher code BISA DISESUAIKAN PADA DASBOARD
Tambah item free WiFi 1 jam (Rp 0) ke order Runchise
Aktifkan voucher di mikrotik
Saya akan buatkan struktur aplikasi React yang interaktif untuk flow ini:
Berikut struktur aplikasi berdasarkan flow di catatan kamu:
Flow yang diimplementasikan:
Input Order ID — kasir scan/ketik Order ID dari POS Runchise
Fetch Detail Order — aplikasi ambil data order dari Runchise API
Validasi — cek 3 kondisi: status = Paid, order belum dipakai, total ≥ Rp 30.000
Hitung Device Count — cek jumlah device aktif di Mikrotik
Generate Voucher Code — buat 1 kode voucher unik
Tambah Item Free WiFi — insert item Rp 0 ke order Runchise
Aktifkan di Mikrotik — push voucher ke Mikrotik
Aplikasi ini adalah simulasi interaktif — kamu bisa ketik Order ID lalu klik PROSES untuk melihat seluruh pipeline berjalan step-by-step dengan System Log real-time. Untuk koneksi ke API Runchise & Mikrotik yang sesungguhnya, tinggal ganti bagian mock data di tiap step dengan pemanggilan API yang sebenarnya.
SEMUA STRUKTUR BISA DI SESAUIKAN PADA DASBOARD APLIKASI VOCHER APP 
PADA BAGIAN PROSES VOCHER SAYA INGIN FLOWNYA SEPERTI DIBAWAH INI 
🎯 FLOW BARU – LEBIH MUDAH & CEPAT
🟦 STEP 1 – Input Order (Simple & Cepat)
Masukkan / Scan Order ID
[______________]  [ VALIDASI ]
Behaviour:

Bisa paste ID atau scan QR

Tekan Enter = otomatis VALIDASI

Jika paste link RunChise → sistem ambil ID otomatis

🟩 STEP 2 – Auto Validasi ke POS RunChise

Setelah klik VALIDASI, sistem:

Ambil data order dari RunChise

Cek:

Status = Paid

Belum pernah dibuat voucher

Total memenuhi minimum

Ambil data:

Nama pelanggan

Device aktif

Total transaksi

🔎 Jika VALID → Tampilkan Preview

Contoh tampilan:

Order ID      : ORD-12345
Nama          : Budi
Status        : Paid
Total         : Rp150.000
Device Aktif  : 3

Voucher Otomatis: 3 voucher (berdasarkan device aktif)
🟨 STEP 3 – Pilih Mode Voucher

Tambahkan pilihan:

(•) Otomatis (sesuai device aktif)
( ) Manual

Jika pilih Manual, muncul field:

Jumlah Voucher: [  __ ]

Kasir bisa ubah jumlah sesuai kebutuhan.

🟪 STEP 4 – Generate & Kirim Otomatis

Tombol:

[ GENERATE & KIRIM ]

Saat diklik, sistem:

Generate kode voucher sesuai jumlah

Simpan ke database

Insert item Free WiFi ke order RunChise

Push voucher ke MikroTik

Tandai order sudah diproses

Semua otomatis.

🟢 STEP 5 – Success Screen
✅ Voucher Berhasil Dibuat & Terkirim

Jumlah Voucher: 3
Router: MikroTik-01
Status: Connected

Daftar Voucher:
WIFI-ABCD123
WIFI-XYZ789
WIFI-KLM456

[ Salin Semua ]
[ Cetak ]
[ Proses Order Baru ]
🚨 ERROR HANDLING YANG JELAS

Jika gagal:

❌ Order tidak ditemukan

ID tidak terdaftar di POS RunChise

❌ Belum dibayar

Status order masih Unpaid

❌ Sudah pernah dibuat voucher

Order ini sudah diproses sebelumnya

❌ Router tidak terhubung

Gagal koneksi ke MikroTik

🔥 LOGIKA BACKEND (RAPI & CLEAN)

Urutan proses sistem:

validateOrder(orderId)

checkOrderStatus()

getDeviceCount()

determineVoucherCount(auto/manual)

generateVoucherCode(n)

saveVoucherToDB()

insertFreeWifiItemToRunChise()

pushToMikrotik()

updateOrderProcessed()

Semua dalam 1 pipeline agar user cukup klik 1 tombol.

✨ TAMBAHAN AGAR MAKIN MUDAH
✅ Auto Generate Setelah Validasi (Mode Cepat)

Jika semua valid → tombol berubah jadi:

[ GENERATE SEKARANG ]
✅ Simpan Setting Default

Minimum transaksi

Rasio voucher per device

Router default

Jadi kasir tidak perlu setting ulang.