/**
 * GET /api/ai/analytics
 * AI Chat statistikasi — admin panel uchun
 * ─────────────────────────────────────────
 * - Umumiy so'rovlar soni
 * - Til bo'yicha taqsimot
 * - Gemini vs Legacy nisbati
 * - O'rtacha javob vaqti
 * - Soatlik faollik grafigi
 */
import { NextResponse } from 'next/server';
import { getAnalyticsData } from '../chat/route';

export async function GET() {
    const entries = getAnalyticsData();
    const total = entries.length;

    if (total === 0) {
        return NextResponse.json({
            total: 0,
            languages: {},
            engines: { gemini: 0, legacy: 0 },
            avgResponseTimeMs: 0,
            avgMessageLength: 0,
            hourlyActivity: [],
            recentEntries: [],
        });
    }

    // Language distribution
    const languages: Record<string, number> = {};
    for (const e of entries) {
        languages[e.language] = (languages[e.language] || 0) + 1;
    }

    // Engine distribution
    const engines = {
        gemini: entries.filter(e => e.engine === 'gemini').length,
        legacy: entries.filter(e => e.engine === 'legacy').length,
    };

    // Average response time
    const avgResponseTimeMs = Math.round(
        entries.reduce((sum, e) => sum + e.responseTimeMs, 0) / total
    );

    // Average message length
    const avgMessageLength = Math.round(
        entries.reduce((sum, e) => sum + e.messageLength, 0) / total
    );

    // Hourly activity (last 24 hours)
    const now = Date.now();
    const last24h = entries.filter(e => now - e.timestamp < 86_400_000);
    const hourlyMap = new Map<number, number>();
    for (const e of last24h) {
        const hour = new Date(e.timestamp).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }
    const hourlyActivity = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: hourlyMap.get(h) || 0,
    }));

    // Gemini success rate
    const geminiRate = total > 0 ? Math.round((engines.gemini / total) * 100) : 0;

    // Recent 10 entries (for live feed)
    const recentEntries = entries.slice(-10).reverse().map(e => ({
        time: new Date(e.timestamp).toLocaleTimeString('uz-UZ'),
        language: e.language,
        engine: e.engine,
        responseTimeMs: e.responseTimeMs,
        messageLength: e.messageLength,
    }));

    return NextResponse.json({
        total,
        languages,
        engines,
        geminiRate,
        avgResponseTimeMs,
        avgMessageLength,
        hourlyActivity,
        recentEntries,
        period: 'session', // in-memory, resets on server restart
    });
}
