import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: {
        default: "Pack24 — Qadoqlash Yechimlari",
        template: "%s | Pack24",
    },
    description: "Pack24 — O'zbekistonda eng sifatli qadoqlash mahsulotlari: karton qutular, gofrokarton, qadoqlash materiallari. Arzon narxlar, tez yetkazib berish.",
    keywords: ["qadoqlash", "karton quti", "gofrokarton", "packaging", "O'zbekiston", "Toshkent", "pack24"],
    authors: [{ name: "Pack24" }],
    creator: "Pack24",
    openGraph: {
        title: "Pack24 — Qadoqlash Yechimlari",
        description: "O'zbekistonda eng sifatli qadoqlash mahsulotlari. Arzon narxlar, tez yetkazib berish.",
        url: "https://pack24.uz",
        siteName: "Pack24",
        locale: "uz_UZ",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Pack24 — Qadoqlash Yechimlari",
        description: "O'zbekistonda eng sifatli qadoqlash mahsulotlari. Arzon narxlar, tez yetkazib berish.",
    },
    robots: { index: true, follow: true },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <body
                className="antialiased min-h-screen flex flex-col"
                suppressHydrationWarning
            >
                {children}
            </body>
        </html>
    );
}
