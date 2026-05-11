'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface RealtimeEvent {
    type: string;
    title: string;
    message: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    entityType?: string;
    entityId?: number;
    requestId?: number;
    collectionId?: number;
    driverId?: number;
    supervisorId?: number;
    pointId?: number;
    timestamp: string;
    source: string;
}

type EventHandler = (event: RealtimeEvent) => void;

/**
 * SSE orqali real-time eventlarni tinglash.
 * 
 * Admin layoutda ishlatiladi — botlardan kelgan har bir event
 * bu hook orqali admin panelga yetkaziladi.
 */
export function useRealtimeEvents(onEvent: EventHandler) {
    const [connected, setConnected] = useState(false);
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;
    const retryCountRef = useRef(0);

    const connect = useCallback(() => {
        const es = new EventSource('/api/admin/sse');

        es.onopen = () => {
            setConnected(true);
            retryCountRef.current = 0;
        };

        es.onmessage = (msg) => {
            try {
                const event: RealtimeEvent = JSON.parse(msg.data);
                if (event.type !== 'system.connected') {
                    handlerRef.current(event);
                }
            } catch { /* malformed JSON — ignore */ }
        };

        es.onerror = () => {
            es.close();
            setConnected(false);
            // Reconnect — exponential backoff (max 30s)
            const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
            retryCountRef.current += 1;
            setTimeout(connect, delay);
        };

        return es;
    }, []);

    useEffect(() => {
        const es = connect();
        return () => {
            es.close();
            setConnected(false);
        };
    }, [connect]);

    return { connected };
}
