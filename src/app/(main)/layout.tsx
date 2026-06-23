import { Suspense } from "react";
import Analytics from "@/components/Analytics";
import LazyGlobalAI from "@/components/LazyGlobalAI";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { LanguageProvider } from "@/lib/contexts/LanguageContext";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Toaster } from "sonner";
import VoiceOrderButtonWrapper from '@/components/VoiceOrderButtonWrapper';
import FloatingTelegram from '@/components/FloatingTelegram';

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <>
            <Suspense fallback={null}>
                <Analytics />
            </Suspense>
            <AuthSessionProvider>
                <LanguageProvider>
                    <CurrencyProvider>
                        <Navbar />
                        <LazyGlobalAI />
                        <main className="flex-grow">
                            {children}
                        </main>
                        <Footer />
                        <VoiceOrderButtonWrapper />
                        <FloatingTelegram />
                    </CurrencyProvider>
                </LanguageProvider>
            </AuthSessionProvider>
            <Toaster richColors position="bottom-right" closeButton duration={3000} />
        </>
    );
}