/**
 * AI Analytics Store (in-memory, global)
 * ─────────────────────────────────────────
 * Route fayldan chiqarilgan — Next.js App Router da
 * faqat HTTP method handlerlar export qilinishi mumkin
 */

export interface AnalyticsEntry {
    timestamp: number;
    language: string;
    engine: 'gemini' | 'legacy';
    responseTimeMs: number;
    messageLength: number;
}

// Global analytics store (survives HMR in dev)
const globalAnalytics = globalThis as unknown as {
    __aiAnalytics?: AnalyticsEntry[];
};
if (!globalAnalytics.__aiAnalytics) {
    globalAnalytics.__aiAnalytics = [];
}

export function trackAnalytics(entry: AnalyticsEntry) {
    const store = globalAnalytics.__aiAnalytics!;
    store.push(entry);
    // Keep only last 1000 entries to prevent memory bloat
    if (store.length > 1000) {
        globalAnalytics.__aiAnalytics = store.slice(-500);
    }
}

export function getAnalyticsData(): AnalyticsEntry[] {
    return globalAnalytics.__aiAnalytics ?? [];
}
