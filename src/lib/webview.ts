/**
 * Server-side WebView detection utility.
 *
 * Native mobile app (React Native) tomonidan yuborilgan so'rovlarni aniqlaydi.
 * Client-side uchun `useIsWebView` hook-dan foydalaning.
 *
 * Mobile app har bir so'rovga `x-pack24-source: app` header qo'shishi kerak.
 */

/** Custom header nomi (mobile app har so'rovda yuborganam kerak) */
export const WEBVIEW_SOURCE_HEADER = 'x-pack24-source';
export const WEBVIEW_SOURCE_VALUE = 'app';

/**
 * Request serverda WebView (native app)dan kelganmi?
 *
 * @example
 *   // Next.js Route Handler:
 *   export async function POST(req: Request) {
 *     const fromApp = isWebViewRequest(req);
 *     ...
 *   }
 */
export function isWebViewRequest(request: Request | { headers: { get(name: string): string | null } }): boolean {
    const source = request.headers.get(WEBVIEW_SOURCE_HEADER);
    return source === WEBVIEW_SOURCE_VALUE;
}

/**
 * User-Agent'dan Pack24App tekshiruvi (server-side).
 * Mobile app UA: `Pack24App/1.x.x (platform)`
 */
export function isPack24AppUserAgent(request: Request | { headers: { get(name: string): string | null } }): boolean {
    const ua = request.headers.get('user-agent') ?? '';
    return ua.includes('Pack24App');
}

/**
 * Ikki usuldan biri bilan WebView-dan kelganligini tekshiradi.
 */
export function isFromMobileApp(request: Request | { headers: { get(name: string): string | null } }): boolean {
    return isWebViewRequest(request) || isPack24AppUserAgent(request);
}
