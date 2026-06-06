import GoogleAnalytics from "@/components/GoogleAnalytics";
import LazyGlobalAI from "@/components/LazyGlobalAI";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import { LanguageProvider } from "@/lib/contexts/LanguageContext";
import { CurrencyProvider } from "@/lib/contexts/CurrencyContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Toaster } from "sonner";
import VoiceOrderButtonWrapper from '@/components/VoiceOrderButtonWrapper';

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <>
            <GoogleAnalytics />
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
                    </CurrencyProvider>
                </LanguageProvider>
            </AuthSessionProvider>
            <Toaster richColors position="bottom-right" closeButton duration={3000} />
        </>
    );
}