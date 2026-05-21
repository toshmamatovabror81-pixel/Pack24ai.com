/**
 * Markaziy structured logger (pino).
 *
 * Foydalanish:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId: 42 }, 'login ok');
 *   logger.warn({ err }, 'unexpected payload');
 *
 * Bola-logger:
 *   const log = logger.child({ module: 'recycling' });
 *
 * Production'da: JSON formatda (Vercel/Datadog/Sentry parser uchun).
 * Dev'da: pino-pretty bilan rangli matn.
 *
 * Sentry kelajakda: `logger.error(...)` ni shunga ulanadi (alohida transport).
 */
import pino, { type Logger, type LoggerOptions } from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const opts: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    base: {
        env: process.env.NODE_ENV ?? 'development',
        // commit hash CI tomonidan inject qilinadi (P3.3 da)
        ...(process.env.GIT_COMMIT_SHA ? { commit: process.env.GIT_COMMIT_SHA } : {}),
    },
    redact: {
        paths: [
            'password',
            'passwordHash',
            'token',
            'authorization',
            'cookie',
            'req.headers.authorization',
            'req.headers.cookie',
            'AUTH_SECRET',
            'ADMIN_SECRET',
            'DRIVER_TOKEN_SECRET',
            'MOBILE_TOKEN_SECRET',
        ],
        censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
};

if (!isProd) {
    opts.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,env',
        },
    };
}

export const logger: Logger = pino(opts);

export function childLogger(bindings: Record<string, unknown>): Logger {
    return logger.child(bindings);
}

/**
 * Bot lifecycle metrics — Telegraf bot uchun.
 */
export type BotEvent = 'starting' | 'ready' | 'error' | 'polling_started' | 'polling_stopped' | 'webhook_set';

export function logBotEvent(botName: string, event: BotEvent, extra: Record<string, unknown> = {}) {
    const log = childLogger({ module: 'telegram-bot', bot: botName });
    if (event === 'error') {
        log.error({ event, ...extra }, `bot ${botName} ${event}`);
    } else {
        log.info({ event, ...extra }, `bot ${botName} ${event}`);
    }
}

/**
 * Slow query trekeri (Prisma uchun chaqiriladi).
 */
export function logSlowQuery(durationMs: number, query: string, params?: unknown) {
    if (durationMs < 500) return;
    childLogger({ module: 'db-slow' }).warn(
        { durationMs, query: query.slice(0, 200), params },
        `slow query ${durationMs}ms`
    );
}
