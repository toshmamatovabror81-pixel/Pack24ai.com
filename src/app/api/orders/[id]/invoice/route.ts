import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mul, toNumber } from '@/lib/money';

// ─── GET /api/orders/[id]/invoice — PDF hisob-faktura HTML yaratish ──────────
// Browser printWindow yoki Puppeteer uchun HTML qaytariladim
// Frontend window.print() orqali PDF saqlab olishi mumkin

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const orderId = parseInt(id);
        if (isNaN(orderId)) {
            return NextResponse.json({ error: "Noto'g'ri ID" }, { status: 400 });
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { product: { select: { name: true, sku: true, image: true } } } },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Buyurtma topilmadi' }, { status: 404 });
        }

        const issueDate = new Date(order.createdAt).toLocaleDateString('ru-RU');
        const totalFormatted = toNumber(order.totalAmount).toLocaleString('ru-RU');

        const itemsHtml = order.items.map((item, i) => {
            const unitPrice = toNumber(item.price);
            const lineTotal = toNumber(mul(item.price, item.quantity));
            return `
            <tr>
                <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">${i + 1}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;">${item.product?.name ?? 'Mahsulot'}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;">${unitPrice.toLocaleString('ru-RU')} so'm</td>
                <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${lineTotal.toLocaleString('ru-RU')} so'm</td>
            </tr>
        `;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Hisob-faktura #${order.id} — Pack24</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
        .page { max-width: 800px; margin: 40px auto; padding: 48px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #064E3B; padding-bottom: 24px; }
        .logo { font-size: 28px; font-weight: 900; color: #064E3B; letter-spacing: -1px; }
        .logo span { color: #f97316; }
        .invoice-info { text-align: right; }
        .invoice-info h1 { font-size: 22px; color: #064E3B; font-weight: 800; margin-bottom: 4px; }
        .invoice-info p { color: #666; font-size: 13px; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
        .party-card { background: #f9fafb; border-radius: 12px; padding: 16px 20px; border: 1px solid #e5e7eb; }
        .party-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 10px; }
        .party-card p { font-size: 14px; color: #374151; line-height: 1.6; }
        .party-card strong { font-weight: 700; color: #111827; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead tr { background: #064E3B; color: white; }
        thead th { padding: 12px 8px; font-size: 12px; font-weight: 600; text-align: left; }
        thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
        thead th:nth-child(3) { text-align: center; }
        tbody tr:hover { background: #f0fdf4; }
        .totals { margin-left: auto; width: 280px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #6b7280; }
        .totals-total { display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: 800; color: #064E3B; border-top: 2px solid #064E3B; margin-top: 4px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #d1fae5; color: #065f46; }
        .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; }
        @media print { .page { margin: 0; padding: 24px; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div>
                <div class="logo">Pack<span>24</span></div>
                <p style="font-size:12px;color:#6b7280;margin-top:6px;">pack24.uz | info@pack24.uz</p>
                <p style="font-size:12px;color:#6b7280;">Toshkent sh., O'zbekiston</p>
            </div>
            <div class="invoice-info">
                <h1>HISOB-FAKTURA</h1>
                <p style="font-size:18px;font-weight:700;color:#374151;margin-bottom:4px;">#${order.id}</p>
                <p>Sana: ${issueDate}</p>
                <p style="margin-top:6px;"><span class="badge">${order.status === 'delivered' ? 'To\'landi' : "To'lanmagan"}</span></p>
            </div>
        </div>

        <div class="parties">
            <div class="party-card">
                <h3>Sotuvchi</h3>
                <strong>Pack24 MCHJ</strong>
                <p>INN: 123456789</p>
                <p>Tel: +998 71 123 45 67</p>
                <p>Email: sales@pack24.uz</p>
            </div>
            <div class="party-card">
                <h3>Xaridor</h3>
                <strong>${order.customerName ?? 'Mijoz'}</strong>
                <p>${order.contactPhone ?? '-'}</p>
                ${order.shippingAddress ? `<p>${order.shippingAddress}</p>` : ''}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:40px;">#</th>
                    <th>Mahsulot nomi</th>
                    <th style="width:80px;text-align:center;">Miqdor</th>
                    <th style="width:120px;text-align:right;">Narxi</th>
                    <th style="width:140px;text-align:right;">Jami</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>

        <div class="totals">
            <div class="totals-row">
                <span>Mahsulotlar</span>
                <span>${totalFormatted} so'm</span>
            </div>
            <div class="totals-row">
                <span>Yetkazib berish</span>
                <span>—</span>
            </div>
            <div class="totals-total">
                <span>JAMI TO'LOV</span>
                <span>${totalFormatted} so'm</span>
            </div>
        </div>

        <div class="footer">
            <span>Pack24.uz — qadoqlash materiallari</span>
            <span>Muhr va imzo</span>
        </div>
    </div>
    <script>window.onload = () => window.print();</script>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[API/orders/invoice]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
