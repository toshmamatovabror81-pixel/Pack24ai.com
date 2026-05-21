/**
 * Sentry init wrapper (server-side)
 *
 * `@sentry/nextjs` paketi optional bog'liqlik — DSN topilmasa init noop.
 * Production'da `SENTRY_DSN` env'ga DSN qo'shing, paketni o'rnatib qayta deploy.
 *
 * O'rnatish:
 *   npm i @sentry/nextjs
 *   npx @sentry/wizard@latest -i nextjs
 *
 * Mobile (pack24-mobile/packages/shared/src/sentry.ts) bilan bir xil DSN
 * ishlatilsa, full-stack trace olish mumkin.
 */

let sentryInstance: any = null;

export function initServerSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn || sentryInstance) return;

    try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        const requireSoft: NodeRequire = (Function('return require'))();
        const Sentry = requireSoft('@sentry/nextjs');
        Sentry.init({
            dsn,
            tracesSampleRate: 0.1,
            environment: process.env.NODE_ENV ?? 'development',
        });
        sentryInstance = Sentry;
    } catch {
        // Paket o'rnatilmagan — silent skip
    }
}

export function captureServerError(error: unknown, context?: Record<string, unknown>) {
    if (!sentryInstance) return;
    try {
        sentryInstance.captureException(error, { extra: context });
    } catch {
        /* noop */
    }
}
