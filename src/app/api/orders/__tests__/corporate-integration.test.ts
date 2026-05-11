/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Pack24 — Korporativ modul INTEGRATION TEST (Admin Auth)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Admin HMAC auth → Ombor → Buyurtma → Shartnoma → Faktura → To'lov → PDF
 */

const BASE = 'http://localhost:3000';
const ADMIN_USERNAME = 'pack24admin';
const ADMIN_PASSWORD = 'Pack24-kKmvCfAtbMi2!';

interface TestResult {
    name: string;
    passed: boolean;
    details: string;
    duration: number;
}

const results: TestResult[] = [];
let adminCookie = '';

async function runTest(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
        await fn();
        results.push({ name, passed: true, details: '✅ OK', duration: Date.now() - start });
    } catch (err: any) {
        results.push({ name, passed: false, details: `❌ ${err.message}`, duration: Date.now() - start });
    }
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
}

async function api(path: string, options?: RequestInit & { raw?: boolean }) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(adminCookie ? { 'Cookie': adminCookie } : {}),
            ...options?.headers,
        },
        redirect: 'manual',
    });

    // Cookie saqlash
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const sc of setCookies) {
        const part = sc.split(';')[0];
        if (part.startsWith('admin_auth=')) {
            adminCookie = part;
        }
    }

    if (options?.raw) {
        return { status: res.status, data: null as any, ok: res.ok, text: await res.text() };
    }

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    return { status: res.status, data, ok: res.ok, text };
}

// ─── State ───────────────────────────────────────────────────────────────────

let testProductId: number;
let testWarehouseId: number;
let testOrderId: number;
let testUserId: number;
let testContractId: number;
let testInvoiceId: number;
let initialQty = 0;

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('  Pack24 — Korporativ modul INTEGRATION TEST');
    console.log('  ' + new Date().toLocaleString('uz-UZ'));
    console.log('═'.repeat(60) + '\n');

    // ══════════════════════════════════════════════════════════════
    // 0. AUTENTIFIKATSIYA
    // ══════════════════════════════════════════════════════════════

    await runTest('0.1 — Admin login (HMAC token)', async () => {
        const { status, data } = await api('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
        });
        assert(status === 200, `Login status ${status}: ${JSON.stringify(data)}`);
        assert(data.ok === true, 'Login ok kutilgan');
        assert(adminCookie.startsWith('admin_auth=admin_'), `Cookie: ${adminCookie.substring(0, 30)}`);
        console.log(`    → Login muvaffaqiyatli, token: ${adminCookie.substring(0, 40)}...`);
    });

    await runTest('0.2 — Auth tekshiruvi (himoyalangan endpoint)', async () => {
        const { status } = await api('/api/warehouse');
        assert(status === 200, `Warehouse API ${status} kutilgan 200 (auth ishlashi kerak)`);
        console.log(`    → Admin auth ishlayapti ✓`);
    });

    // ══════════════════════════════════════════════════════════════
    // 1. OMBOR HOLATI
    // ══════════════════════════════════════════════════════════════

    await runTest('1.1 — Omborlar ro\'yxati', async () => {
        const { status, data } = await api('/api/warehouse');
        assert(status === 200 && Array.isArray(data), 'Omborlar massivi');
        assert(data.length > 0, 'Kamida 1 ombor kerak');
        testWarehouseId = data.find((w: any) => w.isMain)?.id || data[0].id;
        console.log(`    → ${data.length} ombor, asosiy: ID=${testWarehouseId}`);
    });

    await runTest('1.2 — Inventar holati', async () => {
        const { status, data } = await api('/api/warehouse/inventory');
        assert(status === 200 && Array.isArray(data), 'Inventar massivi');
        console.log(`    → ${data.length} inventar yozuvi`);
    });

    await runTest('1.3 — Mahsulotlar', async () => {
        const { status, data } = await api('/api/products');
        assert(status === 200, `Products ${status}`);
        const products = data.products || data;
        assert(Array.isArray(products) && products.length > 0, 'Mahsulotlar kerak');
        testProductId = products[0].id;
        console.log(`    → ${products.length} mahsulot, test: #${testProductId} (${products[0].name})`);
    });

    // ══════════════════════════════════════════════════════════════
    // 2. OMBOR ↔ BUYURTMA SINXRONIZATSIYA
    // ══════════════════════════════════════════════════════════════

    await runTest('2.0 — Inventar tayyorlash (20 ta kirim)', async () => {
        const { data: invData } = await api('/api/warehouse/inventory');
        const existing = (invData as any[])?.find((i: any) => i.productId === testProductId && i.warehouseId === testWarehouseId);
        const currentQty = existing?.quantity ?? 0;

        // Avval tozalash
        if (currentQty > 0) {
            await api('/api/warehouse/inventory', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'OUT', productId: testProductId,
                    fromWarehouseId: testWarehouseId, quantity: currentQty,
                    reason: 'Test: reset',
                }),
            });
        }

        // 20 ta kirim
        const { data } = await api('/api/warehouse/inventory', {
            method: 'POST',
            body: JSON.stringify({
                type: 'IN', productId: testProductId,
                toWarehouseId: testWarehouseId, quantity: 20,
                reason: 'Test: boshlangich zahira',
            }),
        });
        assert(data.success, 'IN muvaffaqiyatsiz');
        initialQty = 20;
        console.log(`    → Ombor: ${initialQty} ta (tozalangan va kirim qilindi)`);
    });

    await runTest('2.1 — Omborda YO\'Q → buyurtma RAD ETILISHI', async () => {
        // Avval tozalash
        await api('/api/warehouse/inventory', {
            method: 'POST',
            body: JSON.stringify({
                type: 'OUT', productId: testProductId,
                fromWarehouseId: testWarehouseId, quantity: 20,
                reason: 'Test: bo\'shatish',
            }),
        });

        const { status, data } = await api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Test', contactPhone: '+998901111111',
                items: [{ productId: testProductId, quantity: 5, price: 10000 }],
            }),
        });
        assert(status === 400, `Status ${status} kutilgan 400`);
        assert(data.code === 'INSUFFICIENT_STOCK', `Code: ${data.code}`);
        console.log(`    → ✓ Omborda 0 → buyurtma to'g'ri rad etildi`);

        // Qayta kirim
        await api('/api/warehouse/inventory', {
            method: 'POST',
            body: JSON.stringify({
                type: 'IN', productId: testProductId,
                toWarehouseId: testWarehouseId, quantity: 20,
                reason: 'Test: qayta kirim',
            }),
        });
    });

    await runTest('2.2 — Buyurtma yaratish → ombor KAMAYISHI', async () => {
        const { status, data } = await api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Test Corp', contactPhone: '+998902222222',
                deliveryMethod: 'courier', paymentMethod: 'cash',
                items: [{ productId: testProductId, quantity: 5, price: 10000 }],
            }),
        });
        assert(status === 200 && data.id > 0, `Status ${status}, err: ${data.error || 'yoq'}`);
        testOrderId = data.id;
        console.log(`    → Buyurtma #${testOrderId} yaratildi`);
    });

    await runTest('2.3 — Ombor tekshiruvi: 20 → 15', async () => {
        const { data } = await api('/api/warehouse/inventory');
        const item = (data as any[])?.find((i: any) => i.productId === testProductId && i.warehouseId === testWarehouseId);
        assert(item?.quantity === 15, `Ombor: ${item?.quantity}, kutilgan: 15`);
        console.log(`    → ✓ Ombor sinxron: ${item.quantity} ta`);
    });

    await runTest('2.4 — Ortiqcha buyurtma → RAD (16 > 15)', async () => {
        const { status, data } = await api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Test Excess', contactPhone: '+998903333333',
                items: [{ productId: testProductId, quantity: 16, price: 10000 }],
            }),
        });
        assert(status === 400 && data.code === 'INSUFFICIENT_STOCK', `Status ${status}`);
        console.log(`    → ✓ 16 > 15 — to'g'ri rad etildi`);
    });

    await runTest('2.5 — Cancel → ombor TIKLANISHI', async () => {
        const { status, data } = await api(`/api/orders/${testOrderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'cancel' }),
        });
        assert(status === 200, `Cancel status: ${status}, err: ${JSON.stringify(data).substring(0, 200)}`);
        assert(data.status === 'cancelled', `Order status: ${data.status}`);
        console.log(`    → ✓ Buyurtma #${testOrderId} bekor qilindi`);
    });

    await runTest('2.6 — Ombor tiklangan: 15 → 20', async () => {
        const { data } = await api('/api/warehouse/inventory');
        const item = (data as any[])?.find((i: any) => i.productId === testProductId && i.warehouseId === testWarehouseId);
        assert(item?.quantity === 20, `Ombor: ${item?.quantity}, kutilgan: 20`);
        console.log(`    → ✓ Ombor tiklandi: ${item.quantity} ta`);
    });

    // ══════════════════════════════════════════════════════════════
    // 3. SHARTNOMA CRUD
    // ══════════════════════════════════════════════════════════════

    await runTest('3.0 — Mijoz topish', async () => {
        const { data } = await api('/api/admin/customers?limit=5');
        const list = data.customers || data;
        assert(Array.isArray(list) && list.length > 0, `Mijozlar: ${JSON.stringify(data).substring(0, 100)}`);
        testUserId = list[0].id;
        console.log(`    → Mijoz: #${testUserId} (${list[0].name})`);
    });

    await runTest('3.1 — Shartnoma YARATISH', async () => {
        const { status, data } = await api('/api/admin/contracts', {
            method: 'POST',
            body: JSON.stringify({
                userId: testUserId,
                companyName: 'IntTest MCHJ',
                inn: '111222333',
                mfo: '00999',
                bankAccount: '20208000905100001111',
                bankName: 'Test Bank',
                directorName: 'I. Testov',
                creditLimit: 50000000,
                paymentTermDays: 15,
            }),
        });
        assert(status === 201, `Status ${status}: ${JSON.stringify(data).substring(0, 200)}`);
        assert(data.contractNo?.startsWith('SH-'), `No: ${data.contractNo}`);
        testContractId = data.id;
        console.log(`    → ✓ ${data.contractNo} (ID: ${data.id})`);
    });

    await runTest('3.2 — Shartnomalar ro\'yxati', async () => {
        const { data } = await api('/api/admin/contracts');
        assert(Array.isArray(data), 'Massiv kutilgan');
        const our = data.find((c: any) => c.id === testContractId);
        assert(!!our, 'Shartnoma topilmadi');
        assert(typeof our.outstandingDebt === 'number', 'outstandingDebt kerak');
        console.log(`    → ✓ ${data.length} shartnoma, qarz: ${our.outstandingDebt}`);
    });

    await runTest('3.3 — Shartnoma TAFSILOTI', async () => {
        const { data } = await api(`/api/admin/contracts/${testContractId}`);
        assert(data.companyName === 'IntTest MCHJ', 'Kompaniya');
        assert(data.inn === '111222333', 'INN');
        assert(data.creditLimit === 50000000, 'Limit');
        console.log(`    → ✓ Kompaniya, INN, limit to'g'ri`);
    });

    await runTest('3.4 — Shartnoma TAHRIRLASH', async () => {
        const { data } = await api(`/api/admin/contracts/${testContractId}`, {
            method: 'PATCH',
            body: JSON.stringify({ creditLimit: 100000000 }),
        });
        assert(data.creditLimit === 100000000, `Limit: ${data.creditLimit}`);
        console.log(`    → ✓ Limit 100M ga yangilandi`);
    });

    // ══════════════════════════════════════════════════════════════
    // 4. FAKTURA + TO'LOV OQIMI
    // ══════════════════════════════════════════════════════════════

    let invoiceOrderId: number;

    await runTest('4.0 — Faktura uchun buyurtma', async () => {
        const { status, data } = await api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Test Corp Invoice', contactPhone: '+998904444444',
                items: [{ productId: testProductId, quantity: 3, price: 25000 }],
            }),
        });
        assert(status === 200 && data.id, `Status: ${status}`);
        invoiceOrderId = data.id;
        console.log(`    → Buyurtma #${invoiceOrderId} (75,000)`);
    });

    await runTest('4.1 — Faktura yaratish (QQS 12%)', async () => {
        const { status, data } = await api('/api/admin/invoices', {
            method: 'POST',
            body: JSON.stringify({
                contractId: testContractId,
                orderId: invoiceOrderId,
                vatPercent: 12,
            }),
        });
        assert(status === 201, `Status ${status}: ${JSON.stringify(data).substring(0, 200)}`);
        assert(data.invoiceNo?.startsWith('INV-'), `No: ${data.invoiceNo}`);
        assert(data.subtotal === 75000, `Sub: ${data.subtotal}`);
        assert(data.vatAmount === 9000, `QQS: ${data.vatAmount} (75000*12%=9000)`);
        assert(data.totalAmount === 84000, `Jami: ${data.totalAmount}`);
        testInvoiceId = data.id;
        console.log(`    → ✓ ${data.invoiceNo}: 75,000 + QQS 9,000 = 84,000`);
    });

    await runTest('4.2 — Dublikat faktura → RAD', async () => {
        const { status } = await api('/api/admin/invoices', {
            method: 'POST',
            body: JSON.stringify({ contractId: testContractId, orderId: invoiceOrderId }),
        });
        assert(status === 400, `Dublikat: ${status} kutilgan 400`);
        console.log(`    → ✓ Dublikat rad etildi`);
    });

    await runTest('4.3 — Fakturalar statistika', async () => {
        const { data } = await api('/api/admin/invoices');
        assert(data.invoices?.length > 0, 'Fakturalar kerak');
        assert(data.stats?.total > 0, 'Statistika kerak');
        console.log(`    → ✓ ${data.stats.total} faktura, jami: ${data.stats.totalAmount}`);
    });

    await runTest('4.4 — Faktura tafsiloti', async () => {
        const { data } = await api(`/api/admin/invoices/${testInvoiceId}`);
        assert(data.contract?.companyName === 'IntTest MCHJ', 'Kompaniya');
        assert(data.contract?.inn === '111222333', 'INN');
        assert(data.order?.items?.length > 0, 'Items');
        console.log(`    → ✓ Tafsilot: kompaniya, INN, mahsulotlar bor`);
    });

    await runTest('4.5 — Qisman to\'lov (40,000)', async () => {
        const { data } = await api(`/api/admin/invoices/${testInvoiceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'add_payment', amount: 40000 }),
        });
        assert(data.status === 'partial', `Status: ${data.status}`);
        assert(data.paidAmount === 40000, `Paid: ${data.paidAmount}`);
        console.log(`    → ✓ 40,000 to'landi → partial`);
    });

    await runTest('4.6 — To\'liq to\'lov (44,000) → paid', async () => {
        const { data } = await api(`/api/admin/invoices/${testInvoiceId}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'add_payment', amount: 44000 }),
        });
        assert(data.status === 'paid', `Status: ${data.status}`);
        assert(data.paidAmount === 84000, `Paid: ${data.paidAmount}`);
        assert(data.paidAt !== null, 'paidAt kerak');
        console.log(`    → ✓ 84,000 to'liq → paid, paidAt: ${data.paidAt}`);
    });

    await runTest('4.7 — PDF hisob-faktura', async () => {
        const { status, text } = await api(`/api/admin/invoices/${testInvoiceId}/pdf`, { raw: true });
        assert(status === 200, `PDF status: ${status}`);
        const html = text!;
        assert(html.includes('HISOB-FAKTURA'), 'HISOB-FAKTURA');
        assert(html.includes('IntTest MCHJ'), 'Kompaniya');
        assert(html.includes('111222333'), 'INN');
        assert(html.includes('QQS'), 'QQS');
        console.log(`    → ✓ PDF: ${html.length} bytes, INN/QQS/kompaniya bor`);
    });

    // ══════════════════════════════════════════════════════════════
    // 5. YAKUNIY SINXRONIZATSIYA
    // ══════════════════════════════════════════════════════════════

    await runTest('5.1 — Yakuniy ombor (20-5+5-3=17)', async () => {
        const { data } = await api('/api/warehouse/inventory');
        const item = (data as any[])?.find((i: any) => i.productId === testProductId && i.warehouseId === testWarehouseId);
        assert(item?.quantity === 17, `Ombor: ${item?.quantity}, kutilgan: 17`);
        console.log(`    → ✓ Ombor sinxron: ${item.quantity} (20-5+5-3=17)`);
    });

    await runTest('5.2 — Shartnoma balans (to\'liq to\'langan)', async () => {
        const { data } = await api(`/api/admin/contracts/${testContractId}`);
        assert(data.totalInvoiced === 84000, `Inv: ${data.totalInvoiced}`);
        assert(data.totalPaid === 84000, `Paid: ${data.totalPaid}`);
        assert(data.outstandingDebt === 0, `Qarz: ${data.outstandingDebt}`);
        console.log(`    → ✓ Balans: inv=84,000, paid=84,000, qarz=0`);
    });

    await runTest('5.3 — Shartnoma himoya (o\'chirib bo\'lmaydi)', async () => {
        const { status } = await api(`/api/admin/contracts/${testContractId}`, { method: 'DELETE' });
        assert(status === 400, `Status: ${status} kutilgan 400`);
        console.log(`    → ✓ Fakturali shartnoma himoyalangan`);
    });

    // ══════════════════════════════════════════════════════════════
    // 6. KREDIT LIMIT
    // ══════════════════════════════════════════════════════════════

    await runTest('6.1 — Kredit limit oshish testi', async () => {
        // Limit 1000 ga pasaytirish
        await api(`/api/admin/contracts/${testContractId}`, {
            method: 'PATCH',
            body: JSON.stringify({ creditLimit: 1000 }),
        });

        // Yangi buyurtma
        const { data: order } = await api('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                customerName: 'Limit Test', contactPhone: '+998905555555',
                items: [{ productId: testProductId, quantity: 1, price: 500000 }],
            }),
        });

        if (order.id) {
            // Faktura yaratish — limit oshishi kerak
            const { status, data } = await api('/api/admin/invoices', {
                method: 'POST',
                body: JSON.stringify({ contractId: testContractId, orderId: order.id }),
            });
            assert(status === 400 && data.code === 'CREDIT_LIMIT_EXCEEDED', `Limit: ${status} ${data.code}`);
            console.log(`    → ✓ Kredit limit himoyasi ishladi`);

            // Tozalash
            await api(`/api/orders/${order.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'cancel' }),
            });
        } else {
            throw new Error('Buyurtma yaratilmadi: ' + order.error);
        }
    });

    // ══════════════════════════════════════════════════════════════
    // NATIJALAR
    // ══════════════════════════════════════════════════════════════

    console.log('\n' + '═'.repeat(60));
    console.log('  NATIJALAR');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        console.log(`  ${icon} [${String(r.duration).padStart(5)}ms] ${r.name}`);
        if (!r.passed) console.log(`            └─ ${r.details}`);
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`  JAMI: ${results.length} | ✅ ${passed.length} | ❌ ${failed.length}`);
    console.log(`  ⏱  ${(results.reduce((s, r) => s + r.duration, 0) / 1000).toFixed(1)}s`);
    console.log('─'.repeat(60));

    if (failed.length === 0) {
        console.log('\n  🎉 BARCHA TESTLAR MUVAFFAQIYATLI!\n');
    } else {
        console.log('\n  ⚠️  Ba\'zi testlar yiqildi — yuqoridagi xatoliklarni ko\'ring\n');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
