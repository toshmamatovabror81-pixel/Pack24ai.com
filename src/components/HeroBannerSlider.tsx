'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { useBannerStore } from '@/lib/store/useBannerStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Language } from '@/lib/translations';

const INTERVAL_MS = 3000;
const PHONE = '+998 88 055-78-88';

// CTA matnlar — har bir til uchun, bannerning aktiv slaydi bilan birga o'zgaradi
const CTA_TITLE: Record<Language, string> = {
    uz: 'Buyurtma berishga tayyormisiz?',
    ru: 'Готовы сделать заказ?',
    en: 'Ready to place an order?',
    qr: 'Buyırtpa berishe tayınmısız?',
    zh: '准备好下单了吗？',
    tr: 'Sipariş vermeye hazır mısınız?',
    tg: 'Барои фармоиш омодаед?',
    kk: 'Тапсырыс беруге дайынсыз ба?',
    tk: 'Sargyt bermäge taýyrmy?',
    fa: 'آماده سفارش هستید؟',
};
const CTA_SUB: Record<Language, string> = {
    uz: '1000+ mahsulot orasidan tanlang. Optom buyurtmalarda maxsus narxlar.',
    ru: 'Выбирайте из 1000+ товаров. Специальные цены на оптовые заказы.',
    en: 'Choose from 1000+ products. Special wholesale prices.',
    qr: '1000+ mahsulot arasınan tanlaw. Optomda arnawlı bahalar.',
    zh: '从1000多种产品中选择。批发订单享受特别优惠。',
    tr: '1000\'den fazla ürün seçin. Toptan siparişlerde özel fiyatlar.',
    tg: 'Аз 1000+ маҳсулот интихоб кунед. Нархҳои хосс барои яклухт.',
    kk: '1000+ тауар ішінен таңдаңыз. Көтермеге арнайы бағалар.',
    tk: '1000+ haryt saýlaň. Lomaý sargytlarda ýörite bahalar.',
    fa: 'از ۱۰۰۰+ محصول انتخاب کنید. قیمت‌های ویژه عمده.',
};
const CTA_BTN: Record<Language, string> = {
    uz: "Katalogga o'tish",
    ru: 'Перейти в каталог',
    en: 'Browse Catalog',
    qr: 'Katalogga ótiw',
    zh: '浏览目录',
    tr: 'Kataloğa Git',
    tg: 'Ба каталог равед',
    kk: 'Каталогқа өту',
    tk: 'Kataloga geç',
    fa: 'مشاهده کاتالوگ',
};

export default function HeroBannerSlider() {
    const { language } = useLanguage();
    const allBanners = useBannerStore((s) => s.banners);
    const heroBanners = allBanners
        .filter((b) => b.location === 'hero' && b.isActive)
        .sort((a, b) => a.order - b.order);

    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const [animating, setAnimating] = useState(false);

    const goTo = useCallback(
        (index: number) => {
            if (animating) return;
            setAnimating(true);
            setTimeout(() => {
                setCurrent(index);
                setAnimating(false);
            }, 300);
        },
        [animating]
    );

    const next = useCallback(() => {
        goTo((current + 1) % heroBanners.length);
    }, [current, heroBanners.length, goTo]);

    const prev = useCallback(() => {
        goTo((current - 1 + heroBanners.length) % heroBanners.length);
    }, [current, heroBanners.length, goTo]);

    useEffect(() => {
        if (paused || heroBanners.length <= 1) return;
        const timer = setInterval(next, INTERVAL_MS);
        return () => clearInterval(timer);
    }, [paused, next, heroBanners.length]);

    if (heroBanners.length === 0) return null;

    const banner = heroBanners[current];

    const tField = (field: Record<string, string> | undefined): string => {
        if (!field) return '';
        return field[language] ?? field['en'] ?? field['ru'] ?? field['uz'] ?? '';
    };

    const VIEW_LABEL: Record<string, string> = {
        uz: "Ko'rish", ru: 'Смотреть', en: 'View', qr: "Ko'riw",
        zh: '查看', tr: 'Görünüm', tg: 'Дидан', kk: 'Көру', tk: 'Görüm', fa: 'مشاهده',
    };

    // Slayd gradientini CTA uchun ham ishlatamiz — sinxronlik ta'minlanadi
    const gradClass = `bg-gradient-to-br ${banner.gradient}`;

    return (
        <div>
            {/* ── Banner Slider ── */}
            <section
                className="relative overflow-hidden text-white"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                <div className={`${gradClass} transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
                    {/* bg blobs */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-2xl -translate-x-1/2 translate-y-1/2 pointer-events-none" />
                    <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-white/5 rounded-full blur-xl pointer-events-none" />

                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 relative z-10">
                        <div className="flex flex-col lg:flex-row items-center gap-6">
                            <div className="flex-1 max-w-2xl">
                                {banner.badge && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 border border-white/30 rounded-full text-xs font-semibold text-white mb-3 backdrop-blur-sm">
                                        {banner.emoji && <span>{banner.emoji}</span>}
                                        {tField(banner.badge)}
                                    </div>
                                )}
                                <h1 className="text-2xl lg:text-4xl font-extrabold leading-tight tracking-tight mb-3">
                                    {banner.highlightText ? (
                                        (() => {
                                            const title = tField(banner.title);
                                            const highlight = tField(banner.highlightText);
                                            const parts = title.split(highlight);
                                            return (
                                                <>
                                                    {parts[0]}
                                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/90 to-white/60 underline decoration-white/40">
                                                        {highlight}
                                                    </span>
                                                    {parts[1]}
                                                </>
                                            );
                                        })()
                                    ) : (
                                        tField(banner.title)
                                    )}
                                </h1>
                                <p className="text-sm text-white/75 mb-5 leading-relaxed max-w-xl">
                                    {tField(banner.subtitle)}
                                </p>
                                <Link
                                    href={banner.link}
                                    className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold px-5 py-2.5 rounded-xl backdrop-blur-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 text-sm"
                                >
                                    {VIEW_LABEL[language] ?? VIEW_LABEL.uz}
                                    <ArrowRight size={15} />
                                </Link>
                            </div>

                            {banner.emoji && (
                                <div className="hidden lg:flex items-center justify-center w-32 h-32 bg-white/10 rounded-2xl border border-white/20 backdrop-blur text-[60px] select-none shrink-0">
                                    {banner.emoji}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {heroBanners.length > 1 && (
                    <>
                        <button onClick={prev} aria-label="Oldingi banner" className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 hover:bg-white/30 border border-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={next} aria-label="Keyingi banner" className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/15 hover:bg-white/30 border border-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur">
                            <ChevronRight size={20} />
                        </button>
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                            {heroBanners.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => goTo(i)}
                                    aria-label={`Banner ${i + 1}`}
                                    className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'}`}
                                />
                            ))}
                        </div>
                        {!paused && (
                            <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full z-20 overflow-hidden">
                                <div key={`progress-${current}`} className="h-full bg-white/60 banner-progress" />
                            </div>
                        )}
                    </>
                )}

                <style jsx>{`
                    @keyframes progress-fill {
                        from { width: 0%; }
                        to   { width: 100%; }
                    }
                `}</style>
            </section>

            {/* ── CTA Panel — slayd gradient bilan sinxron o'zgaradi ── */}
            <div className={`${gradClass} transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
                <div className="border-t border-white/15 bg-black/15">
                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            {/* Matn */}
                            <div className="text-center sm:text-left">
                                <p className="font-extrabold text-white text-sm">
                                    {CTA_TITLE[language] ?? CTA_TITLE.uz}
                                </p>
                                <p className="text-white/60 text-xs mt-0.5 leading-tight">
                                    {CTA_SUB[language] ?? CTA_SUB.uz}
                                </p>
                            </div>
                            {/* Tugmalar */}
                            <div className="flex items-center gap-2.5 shrink-0">
                                <Link
                                    href="/catalog"
                                    className="inline-flex items-center gap-1.5 bg-white text-gray-900 hover:bg-gray-100 font-bold px-4 py-2 rounded-xl text-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                                >
                                    {CTA_BTN[language] ?? CTA_BTN.uz}
                                    <ArrowRight size={14} />
                                </Link>
                                <a
                                    href={`tel:${PHONE.replace(/\s/g, '')}`}
                                    className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all"
                                >
                                    <Phone size={13} />
                                    <span className="hidden sm:inline font-mono tracking-wide">{PHONE}</span>
                                    <span className="sm:hidden">Call</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
