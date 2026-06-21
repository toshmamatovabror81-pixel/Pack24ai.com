/**
 * Structured logger — console.error/log lar uchun markaziy wrapper.
 *
 * Hozircha JSON formatda console ga yozadi.
 * Kelajakda pino/winston yoki Sentry ga almashtirish oson bo'ladi.
 *
 * Foydalanish:
 * ```typescript
 * import { logger } from '@/lib/logger';
 * logger.error('Route xatosi', { route: '/api/orders', error });
 * logger.info('Ariza yaratildi', { requestId: 42 });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

function formatError(err: unknown): LogEntry['error'] | undefined {
    if (!err) return undefined;
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }
    return { name: 'UnknownError', message: String(err) };
}

function createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    err?: unknown,
): LogEntry {
    return {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(context && Object.keys(context).length > 0 ? { context } : {}),
        ...(err ? { error: formatError(err) } : {}),
    };
}

function write(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
        case 'error':
            console.error(json);
            break;
        case 'warn':
            console.warn(json);
            break;
        case 'debug':
            console.debug(json);
            break;
        default:
            console.log(json);
    }
}

/**
 * Child logger — module yoki route nomi bilan kontekstni oldindan to'ldirish.
 *
 * ```typescript
 * const log = logger.child({ module: 'recycling' });
 * log.info('Collection created', { id: 1 });
 * // → {"level":"info","message":"Collection created","context":{"module":"recycling","id":1},...}
 * ```
 */
class ChildLogger {
    constructor(private readonly baseContext: Record<string, unknown>) {}

    debug(message: string, context?: Record<string, unknown>): void {
        write(createLogEntry('debug', message, { ...this.baseContext, ...context }));
    }

    info(message: string, context?: Record<string, unknown>): void {
        write(createLogEntry('info', message, { ...this.baseContext, ...context }));
    }

    warn(message: string, context?: Record<string, unknown>, err?: unknown): void {
        write(createLogEntry('warn', message, { ...this.baseContext, ...context }, err));
    }

    error(message: string, context?: Record<string, unknown>, err?: unknown): void {
        write(createLogEntry('error', message, { ...this.baseContext, ...context }, err));
    }
}

export const logger = {
    debug(message: string, context?: Record<string, unknown>): void {
        write(createLogEntry('debug', message, context));
    },

    info(message: string, context?: Record<string, unknown>): void {
        write(createLogEntry('info', message, context));
    },

    warn(message: string, context?: Record<string, unknown>, err?: unknown): void {
        write(createLogEntry('warn', message, context, err));
    },

    error(message: string, context?: Record<string, unknown>, err?: unknown): void {
        write(createLogEntry('error', message, context, err));
    },

    /**
     * Create a child logger with pre-filled context.
     */
    child(baseContext: Record<string, unknown>): ChildLogger {
        return new ChildLogger(baseContext);
    },
};
