'use client';

import { useEffect, useState } from 'react';

/**
 * Pack24 native app ichida (React Native WebView) ochilganligini aniqlaydi.
 *
 * Detection usullari (uchala usul bir vaqtda tekshiriladi):
 *   1. `window.__PACK24_WEBVIEW__ === true`  — JS inject (native app inject qiladi)
 *   2. User-Agent da `Pack24App` borligini tekshirish
 *   3. URL-da `?source=app` query parametri
 *
 * Server-side rendering da doim `false` qaytaradi (SSR-safe).
 */

declare global {
    interface Window {
        __PACK24_WEBVIEW__?: boolean;
    }
}

export function useIsWebView(): boolean {
    const [isWebView, setIsWebView] = useState(false);

    useEffect(() => {
        const flag = detectWebView();
        setIsWebView(flag);
    }, []);

    return isWebView;
}

/**
 * WebView aniqlovchi funksiya — client-side istalgan joydan chaqirish mumkin.
 */
export function detectWebView(): boolean {
    if (typeof window === 'undefined') return false;

    // 1. JS inject flag (eng ishonchli)
    if (window.__PACK24_WEBVIEW__ === true) return true;

    // 2. User-Agent tekshiruvi
    const ua = navigator.userAgent || '';
    if (ua.includes('Pack24App')) return true;

    // 3. URL query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') === 'app') return true;

    return false;
}
