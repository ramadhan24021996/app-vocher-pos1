require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { RouterOSClient } = require('routeros-client');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files (Frontend)
app.use(express.static(path.join(__dirname)));

// Fallback for Root to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Path to store logs and vouchers for frontend access
const DATA_FILE = path.join(__dirname, 'backend_data.json');

// Helper to load/save data
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { logs: [], vouchers: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function addBackendLog(level, message) {
    const data = loadData();
    const entry = {
        time: new Date().toLocaleTimeString('id-ID'),
        timestamp: new Date().toISOString(),
        level,
        message
    };
    data.logs.unshift(entry);
    if (data.logs.length > 100) data.logs = data.logs.slice(0, 100);
    saveData(data);
    console.log(`[${level.toUpperCase()}] ${message}`);
}

// ==========================================
// MIKROTIK FUNCTION
// ==========================================
async function createMikrotikVoucher(code, duration, profile = 'default') {
    const api = new RouterOSClient({
        host: process.env.MIKROTIK_HOST,
        user: process.env.MIKROTIK_USER,
        password: process.env.MIKROTIK_PASS,
        port: parseInt(process.env.MIKROTIK_PORT)
    });

    try {
        const conn = await api.connect();

        // 1. Ensure Profile exists with Locking Script
        // We set the on-login script directly on the profile to handle "Locking" and "Absolute Expiry"
        // Script Logic:
        // - Save MAC address on first login (Locking)
        // - Create a scheduler to delete the user after 'duration' (Absolute Expiry)
        const onLoginScript = `
            :local date [/system clock get date];
            :local time [/system clock get time];
            :if ([:len [/ip hotspot user get $user mac-address]] = 0) do={
                /ip hotspot user set $user mac-address=$"mac-address" comment="Active since $date $time";
                :local dur [/ip hotspot user get $user limit-uptime];
                /system scheduler add name=$user start-date=$date start-time=$time interval=$dur on-event="/ip hotspot user remove [find name=$user]; /ip hotspot active remove [find user=$user]; /system scheduler remove [find name=$user]"
            }
        `.trim();

        // Check if our special profile exists, if not create/update it
        const profiles = await conn.write('/ip/hotspot/user/profile/print', [`?name=${profile}`]);
        if (profiles.length === 0) {
            await conn.write('/ip/hotspot/user/profile/add', [
                `=name=${profile}`,
                `=on-login=${onLoginScript}`,
                `=shared-users=1` // Ensure only 1 user even if MAC lock fails
            ]);
        } else {
            // Update existing profile with our logic
            await conn.write('/ip/hotspot/user/profile/set', [
                `=.id=${profiles[0]['.id']}`,
                `=on-login=${onLoginScript}`,
                `=shared-users=1`
            ]);
        }

        // 2. Add the User
        await conn.write('/ip/hotspot/user/add', [
            `=name=${code}`,
            `=password=${code}`,
            `=limit-uptime=${duration}`,
            `=profile=${profile}`,
            `=comment=Runchise_Auto_${new Date().toLocaleDateString()}`
        ]);

        await conn.close();
        return true;
    } catch (err) {
        addBackendLog('error', `MikroTik Error: ${err.message}`);
        throw err;
    }
}

// ==========================================
// SHARED PROCESSING PIPELINE
// ==========================================
async function processVoucherPipeline(orderId) {
    addBackendLog('info', `Memulai pipeline untuk Order ${orderId}...`);

    // 1. Fetch Detail Order dari Runchise
    // NOTE: In production, URL might differ based on Runchise region
    const response = await axios.get(`${process.env.RUNCHISE_API_URL}/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${process.env.RUNCHISE_API_KEY}` }
    });

    const order = response.data;
    const totalAmount = order.total || order.grand_total || 0;
    const status = (order.status || order.payment_status || '').toUpperCase();
    const customerName = order.customer_name || order.customer?.name || 'Customer';

    // 2. Validasi Aturan
    if (status !== 'PAID' && status !== 'COMPLETED' && status !== 'SUCCESS') {
        throw new Error(`Order ${orderId} belum lunas (Status: ${status}). Harap selesaikan pembayaran di POS.`);
    }

    if (totalAmount < parseInt(process.env.MIN_ORDER_AMOUNT)) {
        throw new Error(`Total belanja (Rp ${totalAmount}) tidak mencapai minimum Rp ${process.env.MIN_ORDER_AMOUNT}.`);
    }

    // 3. Generate Voucher Code (Alphanumeric 6-8 chars)
    const voucherCode = 'WF-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // 4. Push ke MikroTik
    addBackendLog('info', `Mendaftarkan voucher ${voucherCode} ke MikroTik...`);
    await createMikrotikVoucher(voucherCode, process.env.MIKROTIK_VOUCHER_DURATION, process.env.MIKROTIK_PROFILE);

    // 5. Update Runchise (Direct Injection)
    let injected = false;
    try {
        addBackendLog('info', `Menyuntikkan kode ke catatan Runchise...`);
        // We append the voucher code to order notes so it prints on the Runchise receipt
        await axios.patch(`${process.env.RUNCHISE_API_URL}/orders/${orderId}`, {
            notes: (order.notes ? order.notes + "\n" : "") + `WiFi Voucher: ${voucherCode}`
        }, {
            headers: { 'Authorization': `Bearer ${process.env.RUNCHISE_API_KEY}` }
        });
        injected = true;
    } catch (rErr) {
        addBackendLog('warning', `Gagal update Runchise (Note: Kadang API Runchise membatasi PATCH): ${rErr.message}`);
    }

    // 6. Simpan Voucher ke database lokal
    const data = loadData();
    const newVoucher = {
        code: voucherCode,
        orderId: orderId,
        customerName: customerName,
        duration: process.env.MIKROTIK_VOUCHER_DURATION,
        createdAt: new Date().toISOString(),
        status: 'active',
        injected: injected
    };
    data.vouchers.unshift(newVoucher);
    saveData(data);

    addBackendLog('success', `Voucher ${voucherCode} BERHASIL diproses untuk Order ${orderId}`);
    return newVoucher;
}

// ==========================================
// RUNCHISE WEBHOOK ENDPOINT
// ==========================================
app.post('/webhook/runchise', async (req, res) => {
    try {
        const payload = req.body;
        // Check standard Runchise payload structure
        const orderId = payload.order_id || payload.id || (payload.data && payload.data.id);

        if (!orderId) {
            addBackendLog('warning', 'Webhook diterima tanpa Order ID yang valid.');
            return res.status(400).send('Order ID missing');
        }

        await processVoucherPipeline(orderId);
        res.status(200).json({ success: true });
    } catch (error) {
        addBackendLog('error', `Webhook Error: ${error.message}`);
        // Return 200 to acknowledge receipt even if processing failed to prevent webhook spam
        res.status(200).send(`Error recorded: ${error.message}`);
    }
});

// ==========================================
// API UNTUK FRONTEND (Manual & Status)
// ==========================================
app.post('/api/manual-process', async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Order ID wajib diisi' });

        const result = await processVoucherPipeline(orderId);
        res.json({ success: true, voucher: result });
    } catch (error) {
        const msg = error.response?.data?.message || error.message;
        addBackendLog('error', `Proses Manual Gagal: ${msg}`);
        res.status(500).json({ error: msg });
    }
});

app.get('/api/data', (req, res) => {
    res.json(loadData());
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', time: new Date().toISOString() });
});

app.get('/api/network-info', (req, res) => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';

    // Attempt to find the first non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp !== '127.0.0.1') break;
    }

    res.json({
        ip: localIp,
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
    });
});

app.listen(port, () => {
    addBackendLog('info', `Backend Server berjalan di http://localhost:${port}`);
    addBackendLog('info', `Webhook: http://[YOUR_IP]:${port}/webhook/runchise`);
});
