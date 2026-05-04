import type { Metadata } from 'next';
import Script from 'next/script';
import { BottomNav } from '@/components/mobile/BottomNav';
import '@/app/globals.css';
import { LanguageProvider } from '@/lib/contexts/LanguageContext';

export const metadata: Metadata = {
    title: 'Pack24 Mobile',
    description: 'Pack24 Telegram Web App',
};

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <head>
                <Script
                    src="https://telegram.org/js/telegram-web-app.js"
                    strategy="beforeInteractive"
                />
            </head>
            <body className="bg-[#F9FAFB] min-h-screen pb-20" suppressHydrationWarning>
                <LanguageProvider>
                    <main className="max-w-md mx-auto min-h-screen bg-white shadow-xl overflow-hidden relative">
                        {children}
                    </main>
                    <BottomNav />
                </LanguageProvider>
            </body>
        </html>
    );
}
