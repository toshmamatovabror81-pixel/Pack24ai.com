'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useCartStore } from '@/lib/store/useCartStore';
import { Mic, MicOff, X, ShoppingCart, Loader2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

// ─── SpeechRecognition type declarations ──────────────────────────────────────

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
    error: string;
    message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
    new(): SpeechRecognitionInstance;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'processing' | 'results' | 'error';

interface SearchProduct {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string | null;
    inStock: boolean;
}

// ─── Translations ─────────────────────────────────────────────────────────────

const TX: Record<string, Record<string, string>> = {
    voice_order: {
        uz: 'Ovozli buyurtma',
        ru: 'Голосовой заказ',
        en: 'Voice Order',
        qr: 'Аўазлы буюртма',
        zh: '语音订单',
        tr: 'Sesli Sipariş',
        tg: 'Фармоиши овозӣ',
        kk: 'Дауыстық тапсырыс',
        tk: 'Ses buýrugy',
        fa: 'سفارش صوتی',
    },
    listening: {
        uz: 'Tinglayapman...',
        ru: 'Слушаю...',
        en: 'Listening...',
        qr: 'Тыңлайман...',
        zh: '正在听...',
        tr: 'Dinliyorum...',
        tg: 'Гӯш мекунам...',
        kk: 'Тыңдап жатырмын...',
        tk: 'Diňleýärin...',
        fa: 'در حال شنیدن...',
    },
    processing: {
        uz: 'Qidirilmoqda...',
        ru: 'Поиск...',
        en: 'Searching...',
        qr: 'Қыдырылмоқда...',
        zh: '搜索中...',
        tr: 'Aranıyor...',
        tg: 'Ҷустуҷӯ...',
        kk: 'Іздеу...',
        tk: 'Gözleýär...',
        fa: 'در حال جستجو...',
    },
    no_results: {
        uz: 'Mahsulot topilmadi',
        ru: 'Товар не найден',
        en: 'No products found',
        qr: 'Махсулот топылмады',
        zh: '未找到产品',
        tr: 'Ürün bulunamadı',
        tg: 'Маҳсулот ёфт нашуд',
        kk: 'Өнім табылмады',
        tk: 'Haryt tapylmady',
        fa: 'محصولی یافت نشد',
    },
    added_to_cart: {
        uz: 'Savatchaga qo\'shildi',
        ru: 'Добавлено в корзину',
        en: 'Added to cart',
        qr: 'Саватчага қошылды',
        zh: '已添加到购物车',
        tr: 'Sepete eklendi',
        tg: 'Ба сабад илова шуд',
        kk: 'Себетке қосылды',
        tk: 'Sebede goşuldy',
        fa: 'به سبد خرید اضافه شد',
    },
    search_placeholder: {
        uz: 'Mahsulot nomini yozing...',
        ru: 'Введите название товара...',
        en: 'Type product name...',
        qr: 'Махсулот номын жазың...',
        zh: '输入产品名称...',
        tr: 'Ürün adını yazın...',
        tg: 'Номи маҳсулотро нависед...',
        kk: 'Өнім атауын жазыңыз...',
        tk: 'Haryt adyny ýazyň...',
        fa: 'نام محصول را بنویسید...',
    },
    speech_error: {
        uz: 'Ovoz tanib bo\'lmadi. Qayta urinib ko\'ring.',
        ru: 'Не удалось распознать речь. Попробуйте снова.',
        en: 'Could not recognize speech. Try again.',
        qr: 'Аўаз таныб болмады. Қайта урыныб коринг.',
        zh: '无法识别语音，请重试。',
        tr: 'Ses tanınamadı. Tekrar deneyin.',
        tg: 'Овоз шинохта нашуд. Аз нав кӯшиш кунед.',
        kk: 'Дауыс танылмады. Қайта байқап көріңіз.',
        tk: 'Ses tanalynmady. Gaýtadan synanyşyň.',
        fa: 'صدا شناسایی نشد. دوباره تلاش کنید.',
    },
    not_supported: {
        uz: 'Brauzeringiz ovozli qidiruvni qo\'llab-quvvatlamaydi',
        ru: 'Ваш браузер не поддерживает голосовой поиск',
        en: 'Your browser does not support voice search',
        qr: 'Браузерингиз аўазлы қыдырувны қоллаб-қувватламайды',
        zh: '您的浏览器不支持语音搜索',
        tr: 'Tarayıcınız sesli aramayı desteklemiyor',
        tg: 'Браузери шумо ҷустуҷӯи овозиро дастгирӣ намекунад',
        kk: 'Сіздің браузеріңіз дауыстық іздеуді қолдамайды',
        tk: 'Brauzer ses gözlegini goldamaýar',
        fa: 'مرورگر شما از جستجوی صوتی پشتیبانی نمی‌کند',
    },
    say_product: {
        uz: 'Mahsulot nomini ayting',
        ru: 'Скажите название товара',
        en: 'Say the product name',
        qr: 'Махсулот номын айтың',
        zh: '请说产品名称',
        tr: 'Ürün adını söyleyin',
        tg: 'Номи маҳсулотро бигӯед',
        kk: 'Өнім атауын айтыңыз',
        tk: 'Haryt adyny aýdyň',
        fa: 'نام محصول را بگویید',
    },
    results_title: {
        uz: 'Topilgan mahsulotlar',
        ru: 'Найденные товары',
        en: 'Search Results',
        qr: 'Топылған махсулотлар',
        zh: '搜索结果',
        tr: 'Bulunan Ürünler',
        tg: 'Маҳсулотҳои ёфташуда',
        kk: 'Табылған өнімдер',
        tk: 'Tapylan harytlar',
        fa: 'نتایج جستجو',
    },
};

// ─── Speech Recognition setup ─────────────────────────────────────────────────

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const LANG_MAP: Record<string, string> = {
    uz: 'uz-UZ',
    ru: 'ru-RU',
    en: 'en-US',
    qr: 'uz-UZ',
    zh: 'zh-CN',
    tr: 'tr-TR',
    tg: 'tg-TJ',
    kk: 'kk-KZ',
    tk: 'tk-TM',
    fa: 'fa-IR',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceOrderButton() {
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const addToCart = useCartStore((s) => s.addToCart);

    const [state, setState] = useState<VoiceState>('idle');
    const [transcript, setTranscript] = useState('');
    const [results, setResults] = useState<SearchProduct[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [textQuery, setTextQuery] = useState('');

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tl = useCallback(
        (key: string) => TX[key]?.[language] ?? TX[key]?.['en'] ?? key,
        [language],
    );

    // Check speech API support on mount
    useEffect(() => {
        setIsSupported(!!getSpeechRecognition());
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, []);

    // ─── Search products ──────────────────────────────────────────────────────

    const searchProducts = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2) return;

        setState('processing');
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
            if (!res.ok) throw new Error('Search failed');

            const data: SearchProduct[] = await res.json();
            setResults(data);
            setState(data.length > 0 ? 'results' : 'results');
            setShowPanel(true);
        } catch {
            setState('error');
            toast.error(tl('speech_error'));
            setTimeout(() => setState('idle'), 2000);
        }
    }, [tl]);

    // ─── Start listening ──────────────────────────────────────────────────────

    const startListening = useCallback(() => {
        const SR = getSpeechRecognition();
        if (!SR) {
            setIsSupported(false);
            setShowPanel(true);
            return;
        }

        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = LANG_MAP[language] || 'uz-UZ';

        recognition.onstart = () => {
            setState('listening');
            setTranscript('');
            setResults([]);
            setShowPanel(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            const currentText = finalTranscript || interimTranscript;
            setTranscript(currentText);

            if (finalTranscript) {
                searchProducts(finalTranscript);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
                setState('idle');
                if (!transcript) setShowPanel(false);
                return;
            }
            setState('error');
            toast.error(tl('speech_error'));
            setTimeout(() => setState('idle'), 2000);
        };

        recognition.onend = () => {
            if (state === 'listening' && !transcript) {
                setState('idle');
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch {
            setState('error');
            setTimeout(() => setState('idle'), 2000);
        }
    }, [language, searchProducts, tl, state, transcript]);

    // ─── Stop listening ───────────────────────────────────────────────────────

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        if (state === 'listening') {
            setState('idle');
        }
    }, [state]);

    // ─── Toggle ───────────────────────────────────────────────────────────────

    const handleMicClick = useCallback(() => {
        if (state === 'listening') {
            stopListening();
        } else {
            startListening();
        }
    }, [state, startListening, stopListening]);

    // ─── Close panel ──────────────────────────────────────────────────────────

    const closePanel = useCallback(() => {
        setShowPanel(false);
        setState('idle');
        setResults([]);
        setTranscript('');
        setTextQuery('');
        recognitionRef.current?.abort();
    }, []);

    // ─── Add to cart ──────────────────────────────────────────────────────────

    const handleAddToCart = useCallback((product: SearchProduct) => {
        addToCart({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1,
        });
        toast.success(`${product.name} — ${tl('added_to_cart')}`);
    }, [addToCart, tl]);

    // ─── Text search (fallback) ───────────────────────────────────────────────

    const handleTextSearch = useCallback((value: string) => {
        setTextQuery(value);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (value.trim().length >= 2) {
            searchTimeoutRef.current = setTimeout(() => {
                searchProducts(value);
            }, 400);
        } else {
            setResults([]);
        }
    }, [searchProducts]);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            {/* Floating mic button */}
            <button
                onClick={isSupported ? handleMicClick : () => { setShowPanel(true); setState('idle'); }}
                className={`
                    fixed bottom-[10.5rem] right-6 z-50 flex items-center justify-center
                    w-14 h-14 rounded-full shadow-lg transition-all duration-300
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${state === 'listening'
                        ? 'bg-blue-600 text-white focus:ring-blue-400 animate-pulse'
                        : state === 'error'
                            ? 'bg-red-500 text-white focus:ring-red-400'
                            : 'bg-[#0c2340] text-white hover:bg-[#0c2340]/90 focus:ring-[#0c2340]'
                    }
                `}
                aria-label={tl('voice_order')}
                title={tl('voice_order')}
            >
                {state === 'listening' ? (
                    <MicOff className="w-6 h-6" />
                ) : state === 'processing' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : state === 'error' ? (
                    <AlertCircle className="w-6 h-6" />
                ) : (
                    <Mic className="w-6 h-6" />
                )}
            </button>

            {/* Sound wave indicator when listening */}
            {state === 'listening' && (
                <div className="fixed bottom-[14.5rem] right-6 z-50 flex items-end gap-[3px] h-5 pointer-events-none">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <span
                            key={i}
                            className="w-[3px] bg-blue-500 rounded-full animate-soundwave"
                            style={{
                                animationDelay: `${i * 0.1}s`,
                                height: '4px',
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Bottom sheet / results panel */}
            {showPanel && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={closePanel}
                    />

                    {/* Panel */}
                    <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[80vh] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slideUp">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-[#0c2340]">
                                {tl('voice_order')}
                            </h3>
                            <button
                                onClick={closePanel}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Text search fallback (always visible as secondary input) */}
                        <div className="px-5 py-3 border-b border-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={textQuery || transcript}
                                    onChange={(e) => handleTextSearch(e.target.value)}
                                    placeholder={tl('search_placeholder')}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                                    autoFocus={!isSupported}
                                />
                                {isSupported && state !== 'listening' && (
                                    <button
                                        onClick={handleMicClick}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-blue-50 transition-colors text-[#0c2340]"
                                        aria-label={tl('voice_order')}
                                    >
                                        <Mic className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status messages */}
                        {state === 'listening' && (
                            <div className="px-5 py-4 flex items-center gap-3">
                                <div className="flex items-end gap-[3px] h-5">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <span
                                            key={i}
                                            className="w-[3px] bg-blue-500 rounded-full animate-soundwave"
                                            style={{ animationDelay: `${i * 0.1}s`, height: '4px' }}
                                        />
                                    ))}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-blue-600">
                                        {tl('listening')}
                                    </p>
                                    {transcript && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            &ldquo;{transcript}&rdquo;
                                        </p>
                                    )}
                                    {!transcript && (
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {tl('say_product')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {state === 'processing' && (
                            <div className="px-5 py-6 flex items-center justify-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                <p className="text-sm text-gray-600">{tl('processing')}</p>
                            </div>
                        )}

                        {/* Results list */}
                        {state === 'results' && (
                            <div className="flex-1 overflow-y-auto overscroll-contain">
                                {results.length === 0 ? (
                                    <div className="px-5 py-10 text-center">
                                        <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">{tl('no_results')}</p>
                                    </div>
                                ) : (
                                    <div className="px-5 py-3">
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                                            {tl('results_title')} ({results.length})
                                        </p>
                                        <div className="space-y-2">
                                            {results.map((product) => (
                                                <div
                                                    key={product.id}
                                                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                                                >
                                                    {/* Product image */}
                                                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                        <Image
                                                            src={product.image || '/placeholder.png'}
                                                            alt={product.name}
                                                            fill
                                                            className="object-cover"
                                                            sizes="56px"
                                                        />
                                                    </div>

                                                    {/* Product info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 truncate">
                                                            {product.name}
                                                        </p>
                                                        {product.category && (
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {product.category}
                                                            </p>
                                                        )}
                                                        <p className="text-sm font-bold text-[#0c2340] mt-1">
                                                            {format(product.price)}
                                                        </p>
                                                    </div>

                                                    {/* Add to cart */}
                                                    <button
                                                        onClick={() => handleAddToCart(product)}
                                                        disabled={!product.inStock}
                                                        className="flex-shrink-0 p-2.5 rounded-xl bg-[#0c2340] text-white hover:bg-[#0c2340]/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                        aria-label={tl('added_to_cart')}
                                                    >
                                                        <ShoppingCart className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Idle state — prompt */}
                        {state === 'idle' && results.length === 0 && !transcript && !textQuery && (
                            <div className="px-5 py-10 text-center">
                                {isSupported ? (
                                    <>
                                        <div
                                            onClick={handleMicClick}
                                            className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                                        >
                                            <Mic className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <p className="text-sm text-gray-600">{tl('say_product')}</p>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-xs text-gray-400">{tl('not_supported')}</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Safe area spacer for mobile */}
                        <div className="h-safe-area-bottom min-h-[env(safe-area-inset-bottom,16px)]" />
                    </div>
                </>
            )}

            {/* Animations (injected via style tag for simplicity) */}
            <style jsx global>{`
                @keyframes soundwave {
                    0%, 100% { height: 4px; }
                    50% { height: 16px; }
                }
                .animate-soundwave {
                    animation: soundwave 0.6s ease-in-out infinite;
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </>
    );
}
