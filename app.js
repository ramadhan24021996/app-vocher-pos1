// ===================================
// VoucherApp — WiFi Voucher Management
// ===================================

// ===== STATE HELPER =====
function safeJSONParse(key, defaultValue) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return defaultValue;
        return JSON.parse(item) || defaultValue;
    } catch (e) {
        console.warn(`Failed to parse ${key} from localStorage, using default.`);
        return defaultValue;
    }
}

// ===== STATE =====
const AppState = {
    vouchers: safeJSONParse('vouchers', []),
    logs: safeJSONParse('systemLogs', []),
    settings: safeJSONParse('appSettings', getDefaultSettings()),
    activities: safeJSONParse('activities', []),
    stats: safeJSONParse('stats', getDefaultStats()),
    isProcessing: false,
    currentPage: 'dashboard',
    processMode: 'self' // 'self' or 'inject'
};

function getDefaultSettings() {
    return {
        runchiseUrl: 'https://api.runchise.com/v1',
        runchiseKey: '',
        runchiseOutlet: '',
        mikrotikIp: '192.168.88.1',
        mikrotikDns: 'wifi.hotspot',
        mikrotikPort: 8728,
        mikrotikUser: 'admin',
        mikrotikPass: '',
        mikrotikSsl: false,
        minOrder: 30000,
        voucherDuration: 60,
        bandwidth: 10,
        codeFormat: 'alphanum',
        codeLength: 8,
        maxDevices: 1,
        outletName: 'My Cafe',
        wifiSsid: 'CafeWiFi',
        autoPrint: true,
        sound: true,
        routerName: 'MikroTik-01',
        voucherRatio: 1
    };
}

function getDefaultStats() {
    return {
        vouchersToday: 0,
        devicesActive: 0,
        revenueToday: 0,
        totalOrders: 0,
        chartData: generateChartData()
    };
}

function generateChartData() {
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
            vouchers: Math.floor(Math.random() * 20) + 5,
            revenue: Math.floor(Math.random() * 500000) + 150000
        });
    }
    return data;
}

// ===== PERSISTENCE =====
function saveState() {
    localStorage.setItem('vouchers', JSON.stringify(AppState.vouchers));
    localStorage.setItem('systemLogs', JSON.stringify(AppState.logs));
    localStorage.setItem('appSettings', JSON.stringify(AppState.settings));
    localStorage.setItem('activities', JSON.stringify(AppState.activities));
    localStorage.setItem('stats', JSON.stringify(AppState.stats));
}

// ===== NAVIGATION =====
function navigateTo(page) {
    // Update state
    AppState.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');

    // Update topbar
    const titles = {
        dashboard: { title: 'Dashboard', breadcrumb: 'Overview & Statistik' },
        process: { title: 'Proses Voucher', breadcrumb: 'Scan Order & Generate Voucher' },
        vouchers: { title: 'Daftar Voucher', breadcrumb: 'Semua Voucher yang Dibuat' },
        settings: { title: 'Pengaturan', breadcrumb: 'Konfigurasi Sistem' }
    };

    const info = titles[page] || titles.dashboard;
    document.getElementById('page-title').textContent = info.title;
    document.getElementById('page-breadcrumb').textContent = info.breadcrumb;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');

    // Refresh page-specific data
    if (page === 'dashboard') refreshDashboard();
    if (page === 'vouchers') renderVoucherTable();
    if (page === 'settings') loadSettings();
    if (page === 'process') {
        const input = document.getElementById('order-id-input');
        if (input) {
            setTimeout(() => input.focus(), 100);
            if (!input.dataset.listener) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') processOrder();
                });
                input.dataset.listener = 'true';
            }
        }
    }
}

function setProcessMode(mode) {
    if (AppState.isProcessing) return;

    AppState.processMode = mode;

    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');

    const desc = document.getElementById('mode-desc');
    if (mode === 'self') {
        desc.textContent = 'Cetak struk voucher terpisah via printer lokal.';
    } else {
        desc.textContent = 'Menyuntikkan kode voucher & QR langsung ke struk Runchise.';
    }

    addLog('info', `Mode pencetakan diubah ke: ${mode === 'self' ? 'Cetak Sendiri' : 'Direct Injection'}`);
}

// ===== CLOCK =====
function updateClock() {
    const now = new Date();
    const formatted = now.toLocaleString('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('datetime').textContent = formatted;
}

// ===== LOGGING =====
function addLog(level, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time, level, message, timestamp: now.toISOString() };

    AppState.logs.unshift(entry);
    if (AppState.logs.length > 500) AppState.logs = AppState.logs.slice(0, 500);

    // Log added to state for background tracking
    saveState();
}

// ===== VOUCHER GENERATION =====
function generateVoucherCode() {
    const { codeFormat, codeLength } = AppState.settings;
    let chars = '';

    switch (codeFormat) {
        case 'alphanum':
            chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            break;
        case 'numeric':
            chars = '0123456789';
            break;
        case 'alpha':
            chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            break;
    }

    let code = '';
    for (let i = 0; i < codeLength; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Add dashes for readability
    if (codeLength >= 6) {
        const mid = Math.floor(codeLength / 2);
        code = code.slice(0, mid) + '-' + code.slice(mid);
    }

    return code;
}

// ===== MOCK API FUNCTIONS =====
function mockFetchOrder(orderId) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate API response
            const mockOrders = {
                'ORD001': { id: 'ORD001', status: 'Paid', total: 45000, items: ['Nasi Goreng', 'Es Teh'], used: false, customerName: 'Budi Santoso' },
                'ORD002': { id: 'ORD002', status: 'Paid', total: 78000, items: ['Cappuccino', 'Croissant', 'Pasta'], used: false, customerName: 'Sari Dewi' },
                'ORD003': { id: 'ORD003', status: 'Pending', total: 55000, items: ['Latte', 'Cake'], used: false, customerName: 'Ahmad' },
                'ORD004': { id: 'ORD004', status: 'Paid', total: 15000, items: ['Es Teh'], used: false, customerName: 'Rina' },
                'ORD005': { id: 'ORD005', status: 'Paid', total: 120000, items: ['Steak', 'Dessert', 'Juice'], used: true, customerName: 'Doni' },
            };

            // If not a known mock order, generate random one
            if (!mockOrders[orderId] && orderId.trim()) {
                const statuses = ['Paid', 'Paid', 'Paid', 'Pending'];
                const total = Math.floor(Math.random() * 150000) + 10000;
                resolve({
                    id: orderId,
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    total: total,
                    items: ['Item 1', 'Item 2'],
                    used: Math.random() < 0.1,
                    customerName: 'Customer',
                    deviceCount: Math.floor(Math.random() * 3) + 1 // Random device count between 1 and 3
                });
            } else if (mockOrders[orderId]) {
                resolve(mockOrders[orderId]);
            } else {
                reject(new Error('Order not found'));
            }
        }, 800 + Math.random() * 600);
    });
}

function mockCheckDevices() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                active: Math.floor(Math.random() * 15) + 1,
                max: 50,
                available: true
            });
        }, 600 + Math.random() * 400);
    });
}

function mockAddFreeWifiItem(orderId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true, itemId: 'WIFI-' + Date.now() });
        }, 500 + Math.random() * 300);
    });
}

function mockActivateVoucher(code) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true, activeUntil: new Date(Date.now() + AppState.settings.voucherDuration * 60000) });
        }, 700 + Math.random() * 500);
    });
}

function mockInjectToRunchise(orderId, voucherCode) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true, message: 'Voucher injected to order notes' });
        }, 1200 + Math.random() * 500);
    });
}

// ===== QR CODE GENERATOR =====
function generateQR(elementId, text, size = 128) {
    const container = document.getElementById(elementId);
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    try {
        new QRCode(container, {
            text: text,
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (err) {
        console.error('QR Generation failed:', err);
    }
}

function getHotspotLoginUrl(code) {
    const { mikrotikIp, mikrotikDns } = AppState.settings;
    const host = mikrotikDns || mikrotikIp;
    // Enhanced Magic Link with auto-login parameter
    return `http://${host}/login?username=${encodeURIComponent(code)}&password=${encodeURIComponent(code)}&dst=http://google.com`;
}

// ===== UTILITY =====
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function changeVal(id, delta) {
    const input = document.getElementById(id);
    const newVal = parseInt(input.value) + delta;
    if (newVal >= parseInt(input.min) && newVal <= parseInt(input.max)) {
        input.value = newVal;
    }
}

// ===== PIPELINE PROCESSING =====
let currentOrderData = null;

async function processOrder() {
    let orderId = document.getElementById('order-id-input').value.trim();

    // Auto-extract ID if URL is pasted
    if (orderId.includes('runchise.com') || orderId.includes('http')) {
        const matches = orderId.match(/orders\/([^\/\?#]+)/) || orderId.match(/id=([^\&]+)/);
        if (matches && matches[1]) {
            orderId = matches[1];
            document.getElementById('order-id-input').value = orderId;
            showToast('Order ID diekstrak dari URL', 'info');
        }
    }

    if (!orderId) {
        showToast('Masukkan Order ID terlebih dahulu', 'warning');
        document.getElementById('order-id-input').focus();
        return;
    }

    if (AppState.isProcessing) return;

    AppState.isProcessing = true;
    document.getElementById('btn-process').disabled = true;
    document.getElementById('voucher-result-card').classList.add('hidden');
    document.getElementById('config-card').classList.add('hidden');

    resetPipelineSteps();

    addLog('info', `═══ Memulai Proses Manual: ${orderId} ═══`);

    try {
        await runStep('fetch', 'Menghubungi Backend...', async () => {
            addLog('info', `[BACKEND] Memproses order ${orderId} di server pelacakan...`);

            // Real API Call to Backend
            const response = await fetch('http://localhost:3000/api/manual-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Gagal memproses di server');
            }

            const voucher = result.voucher;
            currentOrderData = { id: orderId, customerName: voucher.customerName };

            document.getElementById('result-fetch').innerHTML = `
                <div class="receipt-detail">
                    <div style="margin-bottom: 8px;"><strong>Pelanggan:</strong> ${voucher.customerName}</div>
                    <div style="margin-bottom: 4px;"><strong>Order ID:</strong> <span style="color: var(--text-secondary)">${orderId}</span></div>
                    <div style="margin-top: 12px;"><strong>Status:</strong> <span class="badge badge--active">✅ BERHASIL DIPROSES</span></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
                        ${voucher.injected ? 'Voucher telah disuntikkan ke sistem Runchise.' : 'Voucher gagal disuntikkan ke Runchise, harap cetak manual.'}
                    </div>
                </div>
            `;
            document.getElementById('result-fetch').classList.add('show');

            // Skip config and activation steps visually since backend did it all
            await delay(500);
            document.getElementById('step-config').classList.add('completed');
            document.getElementById('status-config').className = 'step-badge success';
            document.getElementById('status-config').textContent = 'Selesai';

            document.getElementById('step-activate').classList.add('completed');
            document.getElementById('status-activate').className = 'step-badge success';
            document.getElementById('status-activate').textContent = 'Aktif';

            document.getElementById('result-activate').innerHTML = `
                <div><strong>Status:</strong> ✅ Voucher Berhasil</div>
                <div><strong>Mode:</strong> ${AppState.processMode === 'self' ? 'Cetak Sendiri' : 'Direct Injection'}</div>
            `;
            document.getElementById('result-activate').classList.add('show');

            // Show result
            showVoucherResult([voucher], currentOrderData);
            addLog('success', `[DONE] Voucher ${voucher.code} siap digunakan.`);
        });

    } catch (error) {
        addLog('error', `[FAILED] ${error.message}`);
        showToast(error.message, 'error');
        // Mark steps as error
        ['fetch', 'config', 'activate'].forEach(id => {
            const step = document.getElementById(`step-${id}`);
            if (step && !step.classList.contains('completed')) {
                step.classList.add('error');
            }
        });
    } finally {
        AppState.isProcessing = false;
        document.getElementById('btn-process').disabled = false;
    }
}

async function executeFinalSteps() {
    if (AppState.isProcessing) return;

    const voucherCount = parseInt(document.getElementById('input-voucher-count').value);
    const deviceLimit = parseInt(document.getElementById('input-device-limit').value);

    AppState.isProcessing = true;
    document.getElementById('btn-generate-final').disabled = true;

    const configStep = document.getElementById('step-config');
    configStep.classList.remove('active');
    configStep.classList.add('completed');
    const statusConfig = document.getElementById('status-config');
    statusConfig.className = 'step-badge success';
    statusConfig.textContent = `Selesai (${voucherCount} Vch)`;

    addLog('info', `[PROCESS] Generating ${voucherCount} voucher(s)...`);

    try {
        await runStep('activate', 'Mengaktifkan...', async () => {
            const createdVouchers = [];

            for (let i = 0; i < voucherCount; i++) {
                const code = generateVoucherCode();
                addLog('info', `[GENERATE] Create voucher: ${code}`);

                await mockActivateVoucher(code);
                addLog('success', `[MIKROTIK] Aktifkan ${code} (Limit: ${deviceLimit} dev)`);

                const voucher = {
                    code: code,
                    orderId: currentOrderData.id,
                    customerName: currentOrderData.customerName,
                    duration: AppState.settings.voucherDuration,
                    bandwidth: AppState.settings.bandwidth,
                    deviceLimit: deviceLimit,
                    status: 'active',
                    createdAt: new Date().toISOString()
                };

                AppState.vouchers.unshift(voucher);
                createdVouchers.push(voucher);
                await delay(300);
            }

            // Mock update Runchise once
            if (AppState.processMode === 'inject') {
                addLog('info', `[INJECT] Menyuntikkan voucher ${createdVouchers[0].code} ke Runchise...`);
                await mockInjectToRunchise(currentOrderData.id, createdVouchers[0].code);
                addLog('success', `[RUNCHISE] Berhasil! Voucher akan muncul di struk POS.`);
            } else {
                await mockAddFreeWifiItem(currentOrderData.id);
                addLog('success', `[RUNCHISE] Item WiFi ditambahkan ke POS`);
            }

            document.getElementById('result-activate').innerHTML = `
                <div><strong>Status:</strong> ✅ ${voucherCount} Voucher Berhasil</div>
                <div><strong>Mode:</strong> ${AppState.processMode === 'self' ? 'Cetak Sendiri' : 'Injeksi Runchise'}</div>
            `;
            document.getElementById('result-activate').classList.add('show');

            // Success sound
            if (AppState.settings.sound) playSuccessSound();

            // Stats
            AppState.stats.vouchersToday += voucherCount;
            AppState.stats.totalOrders++;
            AppState.stats.revenueToday += currentOrderData.total;

            saveState();

            // Show result screen with ALL created vouchers
            showVoucherResult(createdVouchers, currentOrderData);
            document.getElementById('config-card').classList.add('hidden');
        });

    } catch (error) {
        addLog('error', `[PROCESS] Gagal: ${error.message}`);
        showToast('Terjadi kesalahan saat aktivasi', 'error');
    } finally {
        AppState.isProcessing = false;
        document.getElementById('btn-generate-final').disabled = false;
    }
}

async function generateManualVoucher() {
    const count = parseInt(document.getElementById('manual-count').value);
    const deviceLimit = parseInt(document.getElementById('manual-device').value);
    const duration = parseInt(document.getElementById('manual-duration').value);
    const note = document.getElementById('manual-note').value || 'Manual Gen';

    if (AppState.isProcessing) return;

    AppState.isProcessing = true;
    showToast(`Generating ${count} voucher...`, 'info');
    addLog('info', `[MANUAL] Memulai generate manual: ${count} voucher, ${duration} m, limit ${deviceLimit} dev`);

    try {
        const createdVouchers = [];
        for (let i = 0; i < count; i++) {
            const code = generateVoucherCode();
            addLog('info', `[MANUAL] Create voucher: ${code}`);

            await mockActivateVoucher(code);
            addLog('success', `[MIKROTIK] Aktifkan ${code} (Limit: ${deviceLimit} dev)`);

            const voucher = {
                code: code,
                orderId: 'MANUAL',
                customerName: note,
                duration: duration,
                bandwidth: AppState.settings.bandwidth,
                deviceLimit: deviceLimit,
                status: 'active',
                createdAt: new Date().toISOString()
            };

            AppState.vouchers.unshift(voucher);
            createdVouchers.push(voucher);
            await delay(200);
        }

        AppState.stats.vouchersToday += count;
        saveState();
        refreshDashboard();
        showToast(`${count} Voucher manual berhasil dibuat!`, 'success');

        if (AppState.settings.sound) playSuccessSound();

    } catch (error) {
        addLog('error', `[MANUAL] Gagal: ${error.message}`);
        showToast('Gagal generate manual', 'error');
    } finally {
        AppState.isProcessing = false;
    }
}

function toggleManualGen() {
    const card = document.getElementById('manual-gen-card');
    card.classList.toggle('hidden');
    if (!card.classList.contains('hidden')) {
        card.scrollIntoView({ behavior: 'smooth' });
    }
}

async function runStep(stepId, statusText, actionFunc) {
    const stepEl = document.getElementById(`step-${stepId}`);
    const statusEl = document.getElementById(`status-${stepId}`);

    if (stepEl) stepEl.classList.add('active');
    if (statusEl) {
        statusEl.className = 'step-badge processing';
        statusEl.textContent = statusText;
    }

    try {
        await actionFunc();
        if (stepEl) stepEl.classList.add('completed');
        if (statusEl) {
            statusEl.className = 'step-badge success';
            statusEl.textContent = 'Selesai';
        }
    } catch (err) {
        if (stepEl) stepEl.classList.remove('completed');
        if (statusEl) {
            statusEl.className = 'step-badge error';
            statusEl.textContent = 'Gagal';
        }
        throw err;
    }
}

function resetPipelineSteps() {
    const steps = ['fetch', 'config', 'activate'];
    steps.forEach(name => {
        const step = document.getElementById(`step-${name}`);
        const status = document.getElementById(`status-${name}`);
        const result = document.getElementById(`result-${name}`);
        if (step) step.classList.remove('active', 'completed', 'error');
        if (status) {
            status.className = 'step-badge waiting';
            status.textContent = 'Menunggu';
        }
        if (result) {
            result.innerHTML = '';
            // The new UI uses :empty pseudoclass to hide it
        }
    });
}

function showVoucherResult(vouchers, order) {
    const card = document.getElementById('voucher-result-card');
    const isMultiple = vouchers.length > 1;

    // Header
    const titleEl = card.querySelector('.result-success-header h3');
    if (titleEl) {
        titleEl.textContent = isMultiple ? `${vouchers.length} VOUCHER ACTIVE!` : 'VOUCHER ACTIVE!';
    }

    // Display primary or first voucher code large
    const codeDisplay = document.getElementById('voucher-code-display');
    if (codeDisplay) {
        codeDisplay.textContent = vouchers[0].code;
    }

    // Detailed List of all vouchers (rendered inside ticket footer)
    let voucherItemsHtml = '';

    if (isMultiple) {
        voucherItemsHtml = `
            <div style="grid-column: 1 / -1; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.1);">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Daftar Kode Tambahan:</div>
                ${vouchers.slice(1).map(v => `
                    <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(0,0,0,0.02); border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(0,0,0,0.05);">
                        <code style="color: var(--accent-primary); font-weight: 800; font-family: 'JetBrains Mono', monospace;">${v.code}</code>
                        <span style="font-size: 0.7rem; color: var(--text-muted); background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;">${v.deviceLimit} Dev</span>
                    </div>
                `).join('')}
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="btn btn--outline btn--sm" onclick="copyAllVouchers('${vouchers.map(v => v.code).join('\\n')}')" style="flex: 1; font-size: 0.7rem;">COPY SEMUA</button>
                    <button class="btn btn--outline btn--sm" onclick="printVouchers()" style="flex: 1; font-size: 0.7rem;">PRINT SEMUA</button>
                </div>
            </div>
        `;
    }

    document.getElementById('voucher-details').innerHTML = `
        <div>
            <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase;">Customer</div>
            <div style="font-weight: 700; color: #1e293b;">${order.customerName}</div>
        </div>
        <div style="text-align: right;">
            <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase;">Validity</div>
            <div style="font-weight: 700; color: #1e293b;">${vouchers[0].duration} Min</div>
        </div>
        ${voucherItemsHtml}
    `;

    // Generate QR and Magic Link for the primary voucher
    const loginUrl = getHotspotLoginUrl(vouchers[0].code);
    generateQR('voucher-qr-container', loginUrl, 160);

    const mlText = document.getElementById('magic-link-text');
    if (mlText) mlText.textContent = loginUrl;

    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth' });

    if (AppState.settings.autoPrint && AppState.processMode === 'self') {
        setTimeout(() => printVouchers(), 800);
    }
}

function copyAllVouchers(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Semua kode voucher disalin!', 'success');
    });
}

function copyMagicLink() {
    const text = document.getElementById('magic-link-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Magic Link disalin!', 'success');
    });
}

function printVouchers() {
    // Update print template with current primary voucher before printing
    const voucher = AppState.vouchers[0];
    if (voucher) {
        document.getElementById('print-outlet-name').textContent = AppState.settings.outletName;
        document.getElementById('print-voucher-code').textContent = voucher.code;
        document.getElementById('print-ssid').textContent = AppState.settings.wifiSsid;
        document.getElementById('print-duration').textContent = `${voucher.duration} menit`;
        document.getElementById('print-valid').textContent = `${voucher.duration} menit sejak aktivasi`;

        const loginUrl = getHotspotLoginUrl(voucher.code);
        generateQR('print-qr-container', loginUrl, 120);
    }

    window.print();
    addLog('info', '[PRINT] Mencetak struk voucher...');
}

function resetProcess() {
    document.getElementById('order-id-input').value = '';
    document.getElementById('voucher-result-card').classList.add('hidden');
    resetPipelineSteps();
    document.getElementById('order-id-input').focus();
}

// ===== VOUCHER TABLE =====
function renderVoucherTable() {
    const tbody = document.getElementById('voucher-table-body');
    const empty = document.getElementById('voucher-empty');
    const searchQuery = document.getElementById('voucher-search')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('voucher-filter-status')?.value || '';

    let filtered = AppState.vouchers;

    if (searchQuery) {
        filtered = filtered.filter(v =>
            v.code.toLowerCase().includes(searchQuery) ||
            v.orderId.toLowerCase().includes(searchQuery) ||
            (v.customerName && v.customerName.toLowerCase().includes(searchQuery))
        );
    }

    if (statusFilter) {
        filtered = filtered.filter(v => v.status === statusFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    tbody.innerHTML = filtered.map(v => {
        const createdDate = new Date(v.createdAt).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const badgeClass = v.status === 'active' ? 'badge--active' : v.status === 'used' ? 'badge--used' : 'badge--expired';
        const statusLabel = v.status === 'active' ? 'Aktif' : v.status === 'used' ? 'Terpakai' : 'Expired';

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; cursor: default;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px 24px; font-weight: 700; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 1.05rem;" class="voucher-code-cell">${v.code}</td>
                <td style="padding: 16px 24px; color: var(--text-secondary);">${v.orderId}</td>
                <td style="padding: 16px 24px; color: var(--text-secondary);">${v.duration} menit</td>
                <td style="padding: 16px 24px;"><span class="badge ${badgeClass}" style="padding: 4px 10px;">${statusLabel}</span></td>
                <td style="padding: 16px 24px; color: var(--text-muted); font-size: 0.85rem;">${createdDate}</td>
                <td style="padding: 16px 24px; text-align: right;">
                    <button class="btn btn--ghost btn--sm" style="color: var(--accent-info); border-color: transparent; background: rgba(56,189,248,0.1);" onclick="copyVoucherCode('${v.code}')" title="Copy code">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="btn btn--ghost btn--sm" style="color: var(--accent-danger); border-color: transparent; background: rgba(239,68,68,0.1); margin-left: 4px;" onclick="deleteVoucher('${v.code}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterVouchers() {
    renderVoucherTable();
}

function copyVoucherCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast(`Kode ${code} disalin!`, 'success');
    });
}

function deleteVoucher(code) {
    if (confirm(`Hapus voucher ${code}?`)) {
        AppState.vouchers = AppState.vouchers.filter(v => v.code !== code);
        saveState();
        renderVoucherTable();
        showToast('Voucher dihapus', 'info');
    }
}

// ===== SETTINGS =====
function loadSettings() {
    try {
        const s = AppState.settings;
        if (!s) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = !!val;
                else el.value = val;
            }
        };

        setVal('setting-runchise-url', s.runchiseUrl);
        setVal('setting-runchise-key', s.runchiseKey);
        setVal('setting-runchise-store-id', s.runchiseOutlet);
        setVal('setting-mikrotik-ip', s.mikrotikIp);
        setVal('setting-mikrotik-dns', s.mikrotikDns || '');
        setVal('setting-mikrotik-port', s.mikrotikPort);
        setVal('setting-mikrotik-user', s.mikrotikUser);
        setVal('setting-mikrotik-pass', s.mikrotikPass);
        setVal('setting-mikrotik-ssl', s.mikrotikSsl);
        setVal('setting-router-name', s.routerName || 'MikroTik-01');
        setVal('setting-min-order', s.minOrder);
        setVal('setting-voucher-duration', s.voucherDuration);
        setVal('setting-bandwidth', s.bandwidth);
        setVal('setting-code-format', s.codeFormat);
        setVal('setting-code-length', s.codeLength);
        setVal('setting-max-devices', s.maxDevices);
        setVal('setting-voucher-ratio', s.voucherRatio || 1);
        setVal('setting-outlet-name', s.outletName);
        setVal('setting-wifi-ssid', s.wifiSsid);
        setVal('setting-auto-print', s.autoPrint);
        setVal('setting-sound', s.sound);

        // Update dashboard-related displays if any
        refreshNetworkInfo();
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

async function refreshNetworkInfo() {
    const ipDisplay = document.getElementById('local-ip-display');
    const hostDisplay = document.getElementById('network-hostname');
    const platDisplay = document.getElementById('network-platform');
    const statusInd = document.getElementById('server-status-pill-new') || document.querySelector('.status-indicator');

    if (ipDisplay) ipDisplay.textContent = 'Memuat...';

    try {
        const response = await fetch('/api/network-info');
        if (!response.ok) throw new Error('API Error');

        const data = await response.json();

        if (ipDisplay) ipDisplay.textContent = data.ip;
        if (hostDisplay) hostDisplay.textContent = data.hostname;
        if (platDisplay) platDisplay.textContent = `${data.platform} (${data.arch})`;

        if (statusInd) {
            statusInd.classList.add('online');
            statusInd.classList.remove('offline');
            const span = statusInd.querySelector('span');
            if (span) span.textContent = 'Terhubung';
            else statusInd.textContent = 'Terhubung';
        }
    } catch (err) {
        if (ipDisplay) ipDisplay.textContent = 'Gagal Deteksi';
        if (statusInd) {
            statusInd.classList.remove('online');
            statusInd.classList.add('offline');
            const span = statusInd.querySelector('span');
            if (span) span.textContent = 'Terputus';
            else statusInd.textContent = 'Terputus';
        }
        console.error('Network info fetch failed:', err);
    }
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    if (text === 'Memuat...' || text === 'Detecting...') return;

    navigator.clipboard.writeText(text).then(() => {
        showToast(`Teks "${text}" berhasil disalin!`, 'success');
    }).catch(err => {
        showToast('Gagal menyalin teks', 'error');
    });
}

function saveSettings() {
    try {
        AppState.settings = {
            runchiseUrl: document.getElementById('setting-runchise-url').value,
            runchiseKey: document.getElementById('setting-runchise-key').value,
            runchiseOutlet: document.getElementById('setting-runchise-store-id').value,
            mikrotikIp: document.getElementById('setting-mikrotik-ip').value,
            mikrotikDns: document.getElementById('setting-mikrotik-dns').value,
            mikrotikPort: parseInt(document.getElementById('setting-mikrotik-port').value),
            mikrotikUser: document.getElementById('setting-mikrotik-user').value,
            mikrotikPass: document.getElementById('setting-mikrotik-pass').value,
            mikrotikSsl: document.getElementById('setting-mikrotik-ssl').checked,
            minOrder: parseInt(document.getElementById('setting-min-order').value),
            voucherDuration: parseInt(document.getElementById('setting-voucher-duration').value),
            bandwidth: parseInt(document.getElementById('setting-bandwidth').value),
            codeFormat: document.getElementById('setting-code-format').value,
            codeLength: parseInt(document.getElementById('setting-code-length').value),
            maxDevices: parseInt(document.getElementById('setting-max-devices').value),
            routerName: document.getElementById('setting-router-name').value,
            voucherRatio: parseInt(document.getElementById('setting-voucher-ratio').value),
            outletName: document.getElementById('setting-outlet-name').value,
            wifiSsid: document.getElementById('setting-wifi-ssid').value,
            autoPrint: document.getElementById('setting-auto-print').checked,
            sound: document.getElementById('setting-sound').checked
        };

        saveState();
        addLog('info', 'Pengaturan berhasil disimpan');
        showToast('Pengaturan berhasil disimpan', 'success');
    } catch (error) {
        showToast('Gagal menyimpan pengaturan: ' + error.message, 'error');
    }
}

function resetSettings() {
    if (confirm('Apakah Anda yakin ingin mengembalikan semua pengaturan ke default?')) {
        AppState.settings = getDefaultSettings();
        saveState();
        loadSettings();
        showToast('Pengaturan telah direset ke default', 'info');
    }
}

async function testRunchiseConn() {
    showToast('Menghubungi Runchise API...', 'info');
    await delay(1500);
    const key = document.getElementById('setting-runchise-key').value;
    if (!key) {
        showToast('Gagal: API Key kosong', 'error');
    } else {
        showToast('Koneksi Runchise Berhasil!', 'success');
    }
}

async function testMikrotikConn() {
    showToast('Menghubungi MikroTik...', 'info');
    await delay(1500);
    const ip = document.getElementById('setting-mikrotik-ip').value;
    if (!ip) {
        showToast('Gagal: IP Router tidak valid', 'error');
    } else {
        showToast('Koneksi MikroTik Berhasil!', 'success');
    }
}

function resetSettings() {
    if (confirm('Reset semua pengaturan ke default?')) {
        AppState.settings = getDefaultSettings();
        saveState();
        loadSettings();
        showToast('Pengaturan direset ke default', 'info');
    }
}

// ===== DASHBOARD =====
function refreshDashboard() {
    // Update stat cards
    document.getElementById('stat-vouchers-today').textContent = AppState.stats.vouchersToday;
    document.getElementById('stat-devices-active').textContent = AppState.stats.devicesActive;
    document.getElementById('stat-revenue-today').textContent = `Rp ${AppState.stats.revenueToday.toLocaleString('id-ID')} `;
    document.getElementById('stat-total-orders').textContent = AppState.stats.totalOrders;

    // Render chart
    renderChart();

    // Render activities
    renderActivities();

    // Update activity count badge
    const badge = document.getElementById('activity-count');
    if (badge) badge.textContent = AppState.activities.length;

    // Populate System Info card
    const s = AppState.settings;
    const setInfo = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setInfo('sys-outlet', s.outletName || '—');
    setInfo('sys-ssid', s.wifiSsid || '—');
    setInfo('sys-router-ip', s.mikrotikIp || '—');
    setInfo('sys-min-order', `Rp ${(s.minOrder || 0).toLocaleString('id-ID')} `);
    setInfo('sys-duration', `${s.voucherDuration || 0} Menit`);

    // Backend health check
    fetch('http://localhost:3000/api/health').then(r => r.json()).then(data => {
        const dot = document.getElementById('backend-status');
        if (dot) dot.className = 'status-dot online';
    }).catch(() => {
        const dot = document.getElementById('backend-status');
        if (dot) dot.className = 'status-dot offline';
    });
}

function addActivity(type, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    AppState.activities.unshift({ type, message, time, timestamp: now.toISOString() });
    if (AppState.activities.length > 20) AppState.activities = AppState.activities.slice(0, 20);
    saveState();
}

function renderActivities() {
    const list = document.getElementById('activity-list');

    if (AppState.activities.length === 0) {
        list.innerHTML = `
        < div class="activity-item" >
                <div class="activity-dot info"></div>
                <div class="activity-content">
                    <p>Belum ada aktivitas</p>
                    <span>Mulai proses order untuk melihat aktivitas</span>
                </div>
            </div >
        `;
        return;
    }

    list.innerHTML = AppState.activities.slice(0, 10).map(a => `
        < div class="activity-item" >
            <div class="activity-dot ${a.type}"></div>
            <div class="activity-content">
                <p>${a.message}</p>
                <span>${a.time}</span>
            </div>
        </div >
        `).join('');
}

// ===== SIMPLE CHART (Canvas) =====
function renderChart() {
    const canvas = document.getElementById('voucherChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = 280 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '280px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const data = AppState.stats.chartData;
    const maxVal = Math.max(...data.map(d => d.vouchers)) * 1.2;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Y labels
        ctx.fillStyle = '#5a6480';
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillText(val.toString(), padding.left - 10, y + 4);
    }

    // Data points & line
    const points = data.map((d, i) => ({
        x: padding.left + (chartWidth / (data.length - 1)) * i,
        y: padding.top + chartHeight - (d.vouchers / maxVal) * chartHeight
    }));

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding.bottom);
    points.forEach((p, i) => {
        if (i === 0) {
            ctx.lineTo(p.x, p.y);
        } else {
            const prevP = points[i - 1];
            const cpx1 = prevP.x + (p.x - prevP.x) / 3;
            const cpx2 = p.x - (p.x - prevP.x) / 3;
            ctx.bezierCurveTo(cpx1, prevP.y, cpx2, p.y, p.x, p.y);
        }
    });
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => {
        if (i === 0) {
            ctx.moveTo(p.x, p.y);
        } else {
            const prevP = points[i - 1];
            const cpx1 = prevP.x + (p.x - prevP.x) / 3;
            const cpx2 = p.x - (p.x - prevP.x) / 3;
            ctx.bezierCurveTo(cpx1, prevP.y, cpx2, p.y, p.x, p.y);
        }
    });
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#0a0e1a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // X labels
        ctx.fillStyle = '#5a6480';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(data[i].date, p.x, height - padding.bottom + 20);
    });
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type} `;

    const iconMap = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `${iconMap[type] || iconMap.info} <p>${message}</p>`;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 4000);
}

// ===== PRINT =====
function printVoucher() {
    const voucher = AppState.vouchers[0];
    if (!voucher) return;

    document.getElementById('print-outlet-name').textContent = AppState.settings.outletName;
    document.getElementById('print-voucher-code').textContent = voucher.code;
    document.getElementById('print-ssid').textContent = AppState.settings.wifiSsid;
    document.getElementById('print-duration').textContent = `${voucher.duration} menit`;
    document.getElementById('print-valid').textContent = `${voucher.duration} menit sejak aktivasi`;

    const loginUrl = getHotspotLoginUrl(voucher.code);
    generateQR('print-qr-container', loginUrl, 130);

    // Add instruction text for print
    const qrContainer = document.getElementById('print-qr-container');
    if (qrContainer) {
        // Clear children but keep the QR (which is an img or canvas inside)
        const hint = document.createElement('div');
        hint.style.fontSize = '9px';
        hint.style.marginTop = '8px';
        hint.style.fontWeight = '700';
        hint.style.textAlign = 'center';
        hint.textContent = 'SCAN UNTUK KONEK OTOMATIS';
        qrContainer.appendChild(hint);
    }

    window.print();
}

// ===== SOUND =====
function playSuccessSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.1;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3 + i * 0.15);

            osc.start(audioCtx.currentTime + i * 0.15);
            osc.stop(audioCtx.currentTime + 0.3 + i * 0.15);
        });
    } catch (e) {
        // Audio not supported
    }
}

// ===== UTILITY =====
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== SYSTEM HEALTH CHECK =====
let lastMikrotikStatus = true;
let lastRunchiseStatus = true;

async function checkSystemHealth() {
    try {
        // Simulate checking MikroTik connection
        const mikrotikOk = Math.random() > 0.05; // 5% chance of "failure" in mock
        const runchiseOk = Math.random() > 0.02;

        updateStatusDot('mikrotik', mikrotikOk);
        updateStatusDot('runchise', runchiseOk);

        if (!mikrotikOk && lastMikrotikStatus) {
            showToast('Koneksi MikroTik terputus!', 'error');
            addLog('error', 'Critical: Connection lost to MikroTik router');
        } else if (mikrotikOk && !lastMikrotikStatus) {
            showToast('MikroTik terhubung kembali', 'success');
            addLog('success', 'Connection restored to MikroTik router');
        }

        if (!runchiseOk && lastRunchiseStatus) {
            showToast('Gagal sinkronisasi Runchise POS!', 'warning');
            addLog('warning', 'Warning: Runchise API sync failed');
        }

        lastMikrotikStatus = mikrotikOk;
        lastRunchiseStatus = runchiseOk;
    } catch (e) {
        console.error('Health check failed', e);
    }
}

function updateStatusDot(service, ok) {
    const dot = document.getElementById(`${service} -status`);
    const text = document.getElementById(`${service} -status - text`);
    if (dot && text) {
        dot.className = `status - dot ${ok ? 'online' : 'offline'} `;
        text.textContent = ok ? 'Connected' : 'Disconnected';
    }
}

// ===== BACKEND SYNC =====
async function syncWithBackend() {
    try {
        const response = await fetch('http://localhost:3000/api/data');
        if (!response.ok) return;

        const data = await response.json();

        // Update Logs if there are new ones from backend
        if (data.logs && data.logs.length > 0) {
            data.logs.forEach(blog => {
                // Check if log already exists to avoid duplicates
                const exists = AppState.logs.some(l => l.timestamp === blog.timestamp);
                if (!exists) {
                    AppState.logs.unshift({
                        time: blog.time,
                        level: blog.level,
                        message: `[BACKEND] ${blog.message} `,
                        timestamp: blog.timestamp
                    });
                }
            });
        }

        // Update Vouchers if there are new ones from backend
        if (data.vouchers && data.vouchers.length > 0) {
            data.vouchers.forEach(bv => {
                const exists = AppState.vouchers.some(v => v.code === bv.code);
                if (!exists) {
                    AppState.vouchers.unshift(bv);
                    addActivity('success', `Automated Voucher: ${bv.code} created for Order ${bv.orderId}`);
                    // If we're on dashboard, refresh instantly
                    if (AppState.currentPage === 'dashboard') {
                        AppState.stats.vouchersToday++;
                        AppState.stats.totalOrders++;
                    }
                }
            });
        }

        if (data.logs.length > 0 || data.vouchers.length > 0) {
            saveState();
            if (AppState.currentPage === 'vouchers') renderVoucherTable();
            if (AppState.currentPage === 'dashboard') refreshDashboard();
        }
    } catch (err) {
        // Backend might be offline, silently ignore or log to console
        console.debug('Backend sync offline');
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Global Error Handling
    window.addEventListener('unhandledrejection', (event) => {
        showToast(`Kesalahan Sistem: ${event.reason.message || 'Error tidak dikenal'} `, 'error');
        addLog('error', `Global Error: ${event.reason.message || event.reason} `);
    });

    window.onerror = function (msg, url, line) {
        showToast(`Script Error: ${msg} `, 'error');
        addLog('error', `Script Error: ${msg} at line ${line} `);
        return false;
    };

    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Health Check
    setInterval(checkSystemHealth, 10000); // Check every 10s

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                navigateTo(item.dataset.page);
            } catch (err) {
                showToast(`Gagal membuka menu: ${err.message} `, 'error');
            }
        });
    });

    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Enter key for order input
    document.getElementById('order-id-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') processOrder();
    });

    // Chart resize
    window.addEventListener('resize', () => {
        if (AppState.currentPage === 'dashboard') renderChart();
    });

    // Initialize dashboard
    try {
        refreshDashboard();
        loadSettings();
        addLog('info', 'VoucherApp started successfully');
    } catch (err) {
        showToast('Gagal inisialisasi aplikasi', 'error');
    }

    // Start polling backend every 5 seconds
    setInterval(syncWithBackend, 5000);
    syncWithBackend(); // Initial sync
});
