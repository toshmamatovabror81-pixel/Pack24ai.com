/**
 * GET /api/eco/esg-report?userId=X&year=2025
 * B2B korxonalar uchun ESG ekologik hisobot generatsiyasi
 * HTML format (PDF uchun brauzerdan chop etiladi)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

const esgReportLimiter = rateLimit({ windowMs: 60_000, max: 5 });

// ─── HTML Escape Helper ─────────────────────────────────────
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const MONTH_NAMES_UZ = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

export async function GET(req: NextRequest) {
    try {
        // Authentication
        const session = await getServerSession(authOptions);
        const sessionUserId = Number(session?.user?.id);
        if (!Number.isFinite(sessionUserId)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limiting
        const ip = getClientIp(req);
        const rl = esgReportLimiter.check(`esg-report:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

        const userId = parseInt(req.nextUrl.searchParams.get('userId') || '0');
        const year = parseInt(req.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

        if (!userId) return NextResponse.json({ error: 'userId talab qilinadi' }, { status: 400 });

        // User can only generate their own report
        if (userId !== sessionUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                name: true, phone: true, companyName: true, ecoLevel: true,
                ecoPoints: true, totalRecycledWeight: true, totalCO2Saved: true,
                treesEquivalent: true, achievements: { select: { badgeKey: true, earnedAt: true } },
            },
        });
        if (!user) return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });

        // Yil bo'yicha arizalar
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);
        const requests = await prisma.recycleRequest.findMany({
            where: {
                userId,
                status: { in: ['collected', 'completed', 'confirmed'] as any },
                completedAt: { gte: startDate, lt: endDate },
            },
            select: { material: true, volume: true, completedAt: true },
            orderBy: { completedAt: 'asc' },
        });

        // Oylik statistika
        const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
            month: MONTH_NAMES_UZ[i],
            kg: 0, co2: 0, requests: 0,
        }));
        let totalKg = 0;
        requests.forEach(r => {
            const m = new Date(r.completedAt!).getMonth();
            const kg = r.volume || 0;
            monthlyStats[m].kg += kg;
            monthlyStats[m].co2 += Math.round(kg * 1.5 * 10) / 10;
            monthlyStats[m].requests++;
            totalKg += kg;
        });

        const totalCO2 = Math.round(totalKg * 1.5 * 10) / 10;
        const totalTrees = Math.floor(totalCO2 / 60);
        const totalWater = Math.round(totalKg * 50);
        const reportDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });

        // Sanitize user-provided strings for safe HTML insertion
        const safeName = escapeHtml(user.name || '');
        const safeCompanyName = user.companyName ? escapeHtml(user.companyName) : '';

        // HTML hisobot (premium dizayn)
        const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pack24 ESG Hisobot — ${year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
  .page { max-width: 800px; margin: 0 auto; background: white; }
  
  /* Header */
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c2a 100%); padding: 40px; color: white; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .logo span { color: #10B981; }
  .badge { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: #34D399; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .report-title { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  .report-sub { font-size: 13px; color: rgba(255,255,255,0.6); }
  .company-info { margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 40px; }
  .info-item label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
  .info-item span { font-size: 14px; font-weight: 600; }

  /* Impact Stats */
  .impact-section { padding: 32px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 20px; }
  .impact-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .impact-card { background: white; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .impact-card .icon { font-size: 28px; margin-bottom: 8px; }
  .impact-card .value { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .impact-card .label { font-size: 11px; color: #64748b; font-weight: 600; }
  .impact-card.green .value { color: #059669; }
  .impact-card.blue .value { color: #2563eb; }
  .impact-card.amber .value { color: #d97706; }

  /* Monthly Table */
  .table-section { padding: 32px 40px; }
  .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .table th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .table th:first-child { border-radius: 8px 0 0 8px; }
  .table th:last-child { border-radius: 0 8px 8px 0; }
  .table td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .table tr:last-child td { border-bottom: none; }
  .table .total-row td { font-weight: 700; background: #f8fafc; }
  .bar-cell { position: relative; }
  .bar { height: 6px; background: #10B981; border-radius: 3px; min-width: 4px; }

  /* Certificate */
  .cert-section { padding: 32px 40px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-top: 1px solid #d1fae5; }
  .cert-box { border: 2px solid #10B981; border-radius: 20px; padding: 28px; text-align: center; position: relative; }
  .cert-title { font-size: 18px; font-weight: 800; color: #064e3b; margin-bottom: 8px; }
  .cert-sub { font-size: 13px; color: #065f46; margin-bottom: 16px; }
  .cert-seal { font-size: 48px; margin: 12px 0; }
  .cert-company { font-size: 20px; font-weight: 800; color: #059669; margin-bottom: 4px; }
  .cert-year { font-size: 13px; color: #6b7280; }
  .cert-stats { display: flex; justify-content: center; gap: 32px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #d1fae5; }
  .cert-stat { text-align: center; }
  .cert-stat .val { font-size: 20px; font-weight: 800; color: #059669; }
  .cert-stat .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }

  /* Footer */
  .footer { padding: 24px 40px; background: #0f172a; display: flex; justify-content: space-between; align-items: center; }
  .footer-logo { color: white; font-weight: 800; font-size: 16px; }
  .footer-logo span { color: #10B981; }
  .footer-text { font-size: 11px; color: rgba(255,255,255,0.4); text-align: right; }

  @media print {
    body { background: white; }
    .page { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-top">
      <div class="logo">Pack<span>24</span></div>
      <div class="badge">♻️ ESG SERTIFIKAT</div>
    </div>
    <div class="report-title">Ekologik Javobgarlik Hisoboti</div>
    <div class="report-sub">Environmental, Social & Governance (ESG) — ${year}-yil</div>
    <div class="company-info">
      <div class="info-item">
        <label>Tashkilot / Foydalanuvchi</label>
        <span>${safeCompanyName || safeName}</span>
      </div>
      <div class="info-item">
        <label>Hisobot sanasi</label>
        <span>${reportDate}</span>
      </div>
      <div class="info-item">
        <label>Eko daraja</label>
        <span style="text-transform: capitalize;">${user.ecoLevel}</span>
      </div>
    </div>
  </div>

  <!-- IMPACT STATS -->
  <div class="impact-section">
    <div class="section-title">📊 Yillik Ekologik Ta'sir</div>
    <div class="impact-grid">
      <div class="impact-card green">
        <div class="icon">♻️</div>
        <div class="value">${totalKg} kg</div>
        <div class="label">Qayta ishlangan</div>
      </div>
      <div class="impact-card blue">
        <div class="icon">💨</div>
        <div class="value">${totalCO2 >= 1000 ? (totalCO2/1000).toFixed(1)+'t' : totalCO2+'kg'}</div>
        <div class="label">CO₂ kamaytirish</div>
      </div>
      <div class="impact-card">
        <div class="icon">🌳</div>
        <div class="value">${totalTrees}</div>
        <div class="label">Ekvivalent daraxt</div>
      </div>
      <div class="impact-card amber">
        <div class="icon">💧</div>
        <div class="value">${totalWater >= 1000 ? (totalWater/1000).toFixed(1)+'k' : totalWater} L</div>
        <div class="label">Tejangan suv</div>
      </div>
    </div>
  </div>

  <!-- MONTHLY TABLE -->
  <div class="table-section">
    <div class="section-title">📅 Oylik Ko'rsatkichlar</div>
    <table class="table">
      <thead>
        <tr>
          <th>Oy</th>
          <th>Arizalar</th>
          <th>Miqdor (kg)</th>
          <th>CO₂ tejash</th>
          <th>Grafik</th>
        </tr>
      </thead>
      <tbody>
        ${monthlyStats.map(m => `
        <tr>
          <td>${m.month}</td>
          <td>${m.requests || '—'}</td>
          <td>${m.kg ? m.kg + ' kg' : '—'}</td>
          <td>${m.co2 ? m.co2 + ' kg' : '—'}</td>
          <td class="bar-cell">
            <div class="bar" style="width: ${totalKg > 0 ? Math.round((m.kg/totalKg)*100) : 0}%;"></div>
          </td>
        </tr>`).join('')}
        <tr class="total-row">
          <td><strong>JAMI</strong></td>
          <td><strong>${requests.length}</strong></td>
          <td><strong>${totalKg} kg</strong></td>
          <td><strong>${totalCO2} kg</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- CERTIFICATE -->
  <div class="cert-section">
    <div class="section-title">🏅 Ekologik Sertifikat</div>
    <div class="cert-box">
      <div class="cert-seal">🌍</div>
      <div class="cert-title">Ekologik Javobgarlik Sertifikati</div>
      <div class="cert-sub">Ushbu sertifikat quyidagi tashkilotga beriladi:</div>
      <div class="cert-company">${safeCompanyName || safeName}</div>
      <div class="cert-year">${year}-yilda atrof-muhitni muhofaza qilishdagi faol ishtiroki uchun</div>
      <div class="cert-stats">
        <div class="cert-stat">
          <div class="val">${totalKg} kg</div>
          <div class="lbl">Qayta ishlandi</div>
        </div>
        <div class="cert-stat">
          <div class="val">${totalCO2} kg</div>
          <div class="lbl">CO₂ kamaydi</div>
        </div>
        <div class="cert-stat">
          <div class="val">${totalTrees}</div>
          <div class="lbl">Daraxt</div>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-logo">Pack<span>24</span> Recycling</div>
    <div class="footer-text">
      pack24.uz • ${reportDate}<br>
      ID: ESG-${userId}-${year}
    </div>
  </div>
</div>
</body>
</html>`;

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[esg-report]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
