import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
    title: {
        default: 'Pack24 — Haydovchi',
        template: '%s | Pack24 Driver',
    },
    description: 'Pack24 haydovchi ilovasi',
    // Native app WebView orqali ko'rilganda robot indexingdan chiqarish
    robots: { index: false, follow: false },
};

/**
 * Driver route group layout.
 *
 * Telegram Web App SDK yo'q — driver native app WebView orqali ochadi.
 * Auth va bottom nav DriverShell ichida boshqariladi.
 * Login sahifasi DriverShell'ni o'z ichiga olmaydi (guard yo'q).
 */
export default function DriverLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                <meta name="theme-color" content="#0f172a" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body
                className="bg-slate-950 text-white antialiased min-h-screen"
                suppressHydrationWarning
            >
                {children}
            </body>
        </html>
    );
}
