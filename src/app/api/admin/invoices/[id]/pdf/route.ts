import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mul, toNumber } from '@/lib/money';

function fmtMoney(n: number) {
    return n.toLocaleString('ru-RU');
}

// ─── GET /api/admin/invoices/[id]/pdf — Professional hisob-faktura ───────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const invoice = await prisma.corporateInvoice.findUnique({
            where: { id: parseInt(id) },
            include: {
                contract: {
                    select: {
                        contractNo: true, companyName: true, inn: true, mfo: true,
                        bankAccount: true, bankName: true, directorName: true,
                    },
                },
                order: {
                    include: {
                        items: {
                            include: { product: { select: { name: true, sku: true } } },
                        },
                    },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Faktura topilmadi' }, { status: 404 });
        }

        const c = invoice.contract;
        const issueDate = new Date(invoice.createdAt).toLocaleDateString('ru-RU');
        const dueDate = new Date(invoice.dueDate).toLocaleDateString('ru-RU');

        const itemsHtml = invoice.order.items.map((item, i) => `
            <tr>
                <td class="cell">${i + 1}</td>
                <td class="cell">${item.product?.name ?? 'Mahsulot'}</td>
                <td class="cell center">${item.quantity}</td>
                <td class="cell right">${fmtMoney(toNumber(item.price))} so'm</td>
                <td class="cell right bold">${fmtMoney(toNumber(mul(item.price, item.quantity)))} so'm</td>
            </tr>
        `).join('');

        const statusBadge = invoice.status === 'paid'
            ? '<span class="badge paid">TO\'LANGAN</span>'
            : invoice.status === 'partial'
            ? '<span class="badge partial">QISMAN</span>'
            : invoice.status === 'overdue'
            ? '<span class="badge overdue">MUDDATI O\'TGAN</span>'
            : '<span class="badge issued">CHIQARILGAN</span>';

        const html = `<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Hisob-faktura ${invoice.invoiceNo} — Pack24</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; }
        .page { max-width: 800px; margin: 30px auto; padding: 40px; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #064E3B; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 900; color: #064E3B; letter-spacing: -1px; }
        .logo span { color: #f97316; }
        .inv-title { text-align: right; }
        .inv-title h1 { font-size: 20px; color: #064E3B; font-weight: 800; margin-bottom: 2px; }
        .inv-title .num { font-size: 18px; font-weight: 700; color: #374151; }
        .inv-title .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }

        .badge { display: inline-block; padding: 3px 10px; border-radius: 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge.paid { background: #d1fae5; color: #065f46; }
        .badge.partial { background: #fef3c7; color: #92400e; }
        .badge.overdue { background: #fee2e2; color: #991b1b; }
        .badge.issued { background: #dbeafe; color: #1e40af; }

        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .party { background: #f9fafb; border-radius: 10px; padding: 14px 18px; border: 1px solid #e5e7eb; }
        .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; font-weight: 700; }
        .party p { font-size: 12px; color: #374151; line-height: 1.7; }
        .party strong { font-weight: 700; color: #111827; font-size: 13px; }

        .contract-ref { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 12px; color: #166534; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #064E3B; color: white; }
        thead th { padding: 10px 8px; font-size: 11px; font-weight: 600; text-align: left; }
        .cell { padding: 9px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 700; }

        .totals { margin-left: auto; width: 300px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #6b7280; }
        .totals-vat { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #374151; font-weight: 600; }
        .totals-total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 17px; font-weight: 800; color: #064E3B; border-top: 2px solid #064E3B; margin-top: 4px; }

        .payment-info { background: #f9fafb; border-radius: 10px; padding: 14px 18px; border: 1px solid #e5e7eb; margin-top: 24px; }
        .payment-info h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; font-weight: 700; }
        .payment-info p { font-size: 12px; color: #374151; line-height: 1.7; }

        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
        .sign-area { display: flex; justify-content: space-between; margin-top: 50px; }
        .sign-box { text-align: center; width: 200px; }
        .sign-box .line { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #6b7280; margin-top: 40px; }
        .sign-box .role { font-size: 12px; font-weight: 700; color: #374151; }

        @media print {
            .page { margin: 0; padding: 20px; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div>
                <div class="logo">Pack<span>24</span></div>
                <p style="font-size:11px;color:#6b7280;margin-top:5px;">pack24.uz | info@pack24.uz</p>
                <p style="font-size:11px;color:#6b7280;">Toshkent sh., O'zbekiston</p>
                <p style="font-size:11px;color:#6b7280;">INN: 309876543 | MFO: 00873</p>
            </div>
            <div class="inv-title">
                <h1>HISOB-FAKTURA</h1>
                <p class="num">${invoice.invoiceNo}</p>
                <p class="meta">Sana: ${issueDate}</p>
                <p class="meta">To'lov muddati: ${dueDate}</p>
                <p style="margin-top:6px;">${statusBadge}</p>
            </div>
        </div>

        <div class="contract-ref">
            📋 Shartnoma: <strong>${c.contractNo}</strong>
        </div>

        <div class="parties">
            <div class="party">
                <h3>Sotuvchi (Yetkazuvchi)</h3>
                <strong>Pack24 MCHJ</strong>
                <p>INN: 309876543</p>
                <p>MFO: 00873</p>
                <p>H/R: 2020 8000 9051 3387 2001</p>
                <p>Bank: ATIB "Milliy Bank"</p>
                <p>Direktor: Habibullayev M.</p>
            </div>
            <div class="party">
                <h3>Xaridor</h3>
                <strong>${c.companyName}</strong>
                ${c.inn ? `<p>INN (STIR): ${c.inn}</p>` : ''}
                ${c.mfo ? `<p>MFO: ${c.mfo}</p>` : ''}
                ${c.bankAccount ? `<p>H/R: ${c.bankAccount}</p>` : ''}
                ${c.bankName ? `<p>Bank: ${c.bankName}</p>` : ''}
                ${c.directorName ? `<p>Direktor: ${c.directorName}</p>` : ''}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:35px;">#</th>
                    <th>Mahsulot nomi</th>
                    <th style="width:70px;" class="center">Miqdor</th>
                    <th style="width:110px;" class="right">Narxi</th>
                    <th style="width:130px;" class="right">Jami</th>
                </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
        </table>

        <div class="totals">
            <div class="totals-row">
                <span>Mahsulotlar jami</span>
                <span>${fmtMoney(toNumber(invoice.subtotal))} so'm</span>
            </div>
            <div class="totals-vat">
                <span>QQS (${invoice.vatPercent}%)</span>
                <span>${fmtMoney(toNumber(invoice.vatAmount))} so'm</span>
            </div>
            <div class="totals-total">
                <span>JAMI TO'LOV</span>
                <span>${fmtMoney(toNumber(invoice.totalAmount))} so'm</span>
            </div>
        </div>

        ${toNumber(invoice.paidAmount) > 0 ? `
        <div class="payment-info">
            <h3>To'lov holati</h3>
            <p>To'langan: <strong>${fmtMoney(toNumber(invoice.paidAmount))} so'm</strong></p>
            <p>Qoldiq: <strong>${fmtMoney(toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount))} so'm</strong></p>
        </div>
        ` : ''}

        <div class="footer">
            <p style="font-size:11px;color:#9ca3af;margin-bottom:4px;">
                To'lov ${c.bankAccount ? `bank o'tkazmasi orqali H/R: ${c.bankAccount}` : 'shartnoma shartlariga muvofiq'} amalga oshiriladi.
            </p>
            <p style="font-size:11px;color:#9ca3af;">
                Ushbu hisob-faktura imzo va muhrsiz ham hujjat sifatida kuchga ega.
            </p>
        </div>

        <div class="sign-area">
            <div class="sign-box">
                <p class="role">Sotuvchi</p>
                <div class="line">M.O. / Imzo</div>
            </div>
            <div class="sign-box">
                <p class="role">Xaridor</p>
                <div class="line">M.O. / Imzo</div>
            </div>
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
        console.error('[Invoice PDF]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
