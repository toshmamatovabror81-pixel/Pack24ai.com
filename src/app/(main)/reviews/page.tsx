'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Star, ThumbsUp, ChevronLeft, ChevronRight as ChevronRightIcon, MessageSquare } from 'lucide-react';

const REVIEWS = [
    {
        id: 1,
        name: { uz: 'Dilnoza A.', ru: 'Дильноза А.' },
        date: '18.03.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Pack24 bilan bir necha yildan beri ishlaymiz. Rahbariyat ham, xodimlar ham juda professional. Buyurtmalar vaqtida, sifati a'lo. Saytdan buyurtma berish juda qulay!",
            ru: "Работаю с Pack24 уже несколько лет. Руководство и сотрудники очень профессиональны. Заказы приходят вовремя, качество отличное. Заказывать через сайт очень удобно!",
        },
        reply: {
            uz: "Dilnoza, ko'p yillik hamkorligingiz uchun katta rahmat! Sizning fikringiz biz uchun juda muhim. Kelgusida ham xizmat qilishdan mamnunmiz!",
            ru: "Дильноза, большое спасибо за многолетнее сотрудничество! Ваше мнение для нас очень важно. Рады и дальше быть вам полезными!",
        },
        likes: 3,
    },
    {
        id: 2,
        name: { uz: 'Anonim', ru: 'Аноним' },
        date: '03.03.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Kechqurun zarf buyurtma berdim — ertasi kuni tushgacha xushmuomala xodim yetkazib keldi. Hammasi aniq, tez va sifatli. Marketpleysdagi tovarlarni bir necha yil buyurtma qilib keldim — sifat doim yaxshi bo'lgan. Tavsiya qilaman!",
            ru: "Вечером заказал конверты — на следующий день уже в 12ч дня вежливый сотрудник произвёл доставку. Всё чётко, быстро и качественно. До этого заказывал через маркетплейс пару лет — качество всегда было хорошим. Рекомендую!",
        },
        reply: {
            uz: "Fikringiz va tavsiyalaringiz uchun katta rahmat! Doimiy hamkorlikdan mamnunmiz!",
            ru: "Благодарим за обратную связь, Ваше мнение и рекомендации для нас очень важны! Рады сотрудничеству на постоянной основе!",
        },
        likes: 3,
    },
    {
        id: 3,
        name: { uz: 'Kamol R.', ru: 'Камол Р.' },
        date: '03.03.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Bir necha marta buyurtma berdim — hammasi operativ va qulay yo'llar topib beradi. Tavsiya qilaman!",
            ru: "Заказываю не первый раз, всё оперативно, подбирают удобные маршруты и компании. Рекомендую!",
        },
        reply: {
            uz: "Kamol, fikr uchun rahmat! Xizmatimizdan mamnun qolganingizdan xursandmiz. Yangi buyurtmalarga tayyormiz!",
            ru: "Камол, благодарим за отзыв! Мы рады, что Вы остались довольны сервисом. Будем рады новым заказам.",
        },
        likes: 1,
    },
    {
        id: 4,
        name: { uz: 'Malika Y.', ru: 'Малика Ю.' },
        date: '21.02.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Qulay sayt, katta assortiment ichidan tanlash oson. Buyurtma berish tezkor, hatto dam olish kunlari ham. Tovar tez jo'natiladi. Rahmat!",
            ru: "Удобный сайт, легко выбрать среди большого ассортимента. Оформление заказа быстро, даже в выходные. Товар отправляется быстро. Спасибо за вашу работу.",
        },
        reply: {
            uz: "Malika, yuqori baho va xaridingiz uchun katta rahmat! Biznesingizga omad va farovonlik tilaymiz!",
            ru: "Малика, спасибо огромное за высокую оценку и покупки! Желаем успеха и процветания Вашему бизнесу!",
        },
        likes: 1,
    },
    {
        id: 5,
        name: { uz: 'Jasur M.', ru: 'Жасур М.' },
        date: '18.02.2026',
        rating: 5,
        category: 'manager',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Ariza bergandan keyin menejer juda tez qo'ng'iroq qildi, qiz xushmuomala edi, yetkazib berish imkoniyati bo'yicha yo'naltirdi. Buyurtma tez keldi. Qadoq ideal edi, barcha qutilар butun holda keldi. Tavsiya qilaman!",
            ru: "После оформления заявки менеджер позвонил очень быстро, девушка была приветлива, сориентировала по доставке. Заказ приехал быстро. Упаковано идеально, все коробки пришли в целости. Рекомендую!",
        },
        reply: {
            uz: "Jasur, ishimizni yuqori baholaganingiz uchun katta rahmat! Uzoq muddatli hamkorlikka umid qilamiz!",
            ru: "Добрый день, Жасур! Примите большую благодарность за высокую оценку нашей работы! Очень надеемся на долгое сотрудничество!",
        },
        likes: 0,
    },
    {
        id: 6,
        name: { uz: 'Nargiza S.', ru: 'Наргиза С.' },
        date: '17.02.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Bir necha yildan beri ishlaymiz. Hamkorlikdan juda mamnunmiz. Narxlar qulay, buyurtma tez rasmiylashtiriladi va jo'natiladi. Tovar sifati ajoyib. Rahmat, yana ko'p marta murojaat qilamiz!",
            ru: "Работаю с вами уже несколько лет. Очень довольна нашим сотрудничеством. Цены доступные, заказ оформляется и отправляется быстро. Качество товара отличное. Спасибо!",
        },
        reply: {
            uz: "Salom! Yoqimli fikr uchun rahmat! Sizga xizmat qilishdan baxtiyormiz!",
            ru: "Здравствуйте! Спасибо за приятный отзыв! Рады стараться для Вас!",
        },
        likes: 2,
    },
    {
        id: 7,
        name: { uz: 'Bobur T.', ru: 'Бобур Т.' },
        date: '26.01.2026',
        rating: 5,
        category: 'manager',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Saytda hammasi qulay va intuitiv tushunarli, buyurtma berish tez va muammosiz. Menejer Elena juda tez bog'landi, yetkazib berish va to'lovda yordam berdi. Ombor to'lovdan 40 daqiqa o'tib jo'natdi. Ajoyib!",
            ru: "На сайте всё удобно и интуитивно понятно, заказ оформляется быстро. Менеджер Малика очень оперативно связалась, помогла с доставкой и оплатой. Склад отгрузил через 40 минут после оплаты. Я в восторге!",
        },
        reply: {
            uz: "Bobur, fikr uchun rahmat! Xizmatimizdan mamnun qolganingizdan xursandmiz. Yangi buyurtmalarga tayyormiz!",
            ru: "Бобур, благодарим за отзыв! Мы рады, что Вы остались довольны сервисом. Будем рады новым заказам.",
        },
        likes: 2,
    },
    {
        id: 8,
        name: { uz: "Maftuna O'.", ru: 'Мафтуна У.' },
        date: '10.01.2026',
        rating: 5,
        category: 'store',
        managerRating: 5,
        warehouseRating: 5,
        siteRating: 5,
        recommends: true,
        text: {
            uz: "Operativ va tez! Ishingiz uchun rahmat!",
            ru: "Оперативно и быстро! Спасибо за вашу работу!",
        },
        reply: {
            uz: "Katta rahmat! Uzoq muddatli hamkorlikka umid qilamiz. Yangi yilda omad va yangi imkoniyatlar tilaymiz!",
            ru: "Благодарим и надеемся на долгое сотрудничество с Вами. Желаем больших успехов и новых возможностей!",
        },
        likes: 1,
    },
];

const RATINGS_BREAKDOWN = [
    { stars: 5, count: 1327, pct: 88 },
    { stars: 4, count: 29,   pct: 2 },
    { stars: 3, count: 25,   pct: 2 },
    { stars: 2, count: 12,   pct: 1 },
    { stars: 1, count: 48,   pct: 3 },
];

const SORT_OPTIONS = [
    { key: 'new',   uz: "Yangilardan boshlash",       ru: "Сначала новые" },
    { key: 'liked', uz: "Foydalilardan boshlash",     ru: "Сначала полезные" },
    { key: 'high',  uz: "Yuqori baholardan boshlash", ru: "Сначала с высокой оценкой" },
    { key: 'low',   uz: "Past baholardan boshlash",   ru: "Сначала с низкой оценкой" },
];

function StarRow({ rating, small = false }: { rating: number; small?: boolean }) {
    const size = small ? 'w-3.5 h-3.5' : 'w-4 h-4';
    return (
        <div className="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
                <Star key={i} className={`${size} ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
        </div>
    );
}

const PER_PAGE = 5;

export default function ReviewsPage() {
    const { language } = useLanguage();
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    const [filter, setFilter]   = useState<'all' | 'store' | 'manager'>('all');
    const [sort, setSort]       = useState('new');
    const [page, setPage]       = useState(1);
    const [expanded, setExpanded] = useState<number[]>([]);

    const filtered = REVIEWS
        .filter(r => filter === 'all' || r.category === filter)
        .sort((a, b) => {
            if (sort === 'high')  return b.rating - a.rating;
            if (sort === 'low')   return a.rating - b.rating;
            if (sort === 'liked') return b.likes - a.likes;
            return b.id - a.id;
        });

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const toggleExpand = (id: number) =>
        setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Breadcrumb */}
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">{t("Sharhlar", "Отзывы")}</span>
                </nav>
            </div>

            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-6">{t("Sharhlar", "Отзывы")}</h1>

                {/* ── Tab filter ── */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {([
                        { key: 'all',     uz: `Barchasi (${REVIEWS.length})`,                                                                       ru: `Все (${REVIEWS.length})` },
                        { key: 'store',   uz: `Do'kon haqida (${REVIEWS.filter(r=>r.category==='store').length})`,                                 ru: `О магазине (${REVIEWS.filter(r=>r.category==='store').length})` },
                        { key: 'manager', uz: `Menejerlar haqida (${REVIEWS.filter(r=>r.category==='manager').length})`,                           ru: `О менеджерах (${REVIEWS.filter(r=>r.category==='manager').length})` },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setFilter(tab.key); setPage(1); }}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${filter === tab.key ? 'bg-blue-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'}`}
                        >
                            {language === 'ru' ? tab.ru : tab.uz}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* ── Left: reviews list ── */}
                    <div className="flex-1 min-w-0">
                        {/* Sort */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            {SORT_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => { setSort(opt.key); setPage(1); }}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${sort === opt.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
                                >
                                    {language === 'ru' ? opt.ru : opt.uz}
                                </button>
                            ))}
                        </div>

                        {/* Reviews */}
                        <div className="space-y-4">
                            {visible.map(r => {
                                const isExpanded = expanded.includes(r.id);
                                const name = language === 'ru' ? r.name.ru : r.name.uz;
                                const text = language === 'ru' ? r.text.ru : r.text.uz;
                                const reply = language === 'ru' ? r.reply.ru : r.reply.uz;
                                return (
                                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                        <div className="p-5">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">{name}</p>
                                                        <p className="text-xs text-gray-400">{r.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <StarRow rating={r.rating} small />
                                                    <span className="text-sm font-bold text-gray-800">{r.rating}</span>
                                                </div>
                                            </div>

                                            {/* Sub-ratings */}
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                {[
                                                    { label: t("Menejer", "Работа менеджера"), val: r.managerRating },
                                                    { label: t("Ombor", "Работа склада"), val: r.warehouseRating },
                                                    { label: t("Sayt", "Удобство сайта"), val: r.siteRating },
                                                ].map(({ label, val }, i) => (
                                                    <div key={i} className="text-center bg-gray-50 rounded-lg py-1.5 px-2">
                                                        <p className="text-[10px] text-gray-400 mb-0.5 leading-tight">{label}</p>
                                                        <StarRow rating={val} small />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Recommends */}
                                            {r.recommends && (
                                                <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mb-2">
                                                    <span>✓</span>
                                                    <span>{t("Tavsiya qiladi", "Рекомендует")}</span>
                                                </div>
                                            )}

                                            {/* Text */}
                                            <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                                {text}
                                            </p>

                                            {/* Likes */}
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                                                    <ThumbsUp size={13} />
                                                    <span>{r.likes}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Reply */}
                                        <div className="border-t border-gray-100 bg-blue-50/50 px-5 py-4">
                                            <button
                                                onClick={() => toggleExpand(r.id)}
                                                className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 mb-2"
                                            >
                                                <MessageSquare size={13} />
                                                {t("Pack24 javobi", "Ответ Pack24")}
                                                <ChevronRightIcon size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    {reply}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    aria-label="Oldingi sahifa"
                                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-blue-400 disabled:opacity-40 transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${p === page ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    aria-label="Keyingi sahifa"
                                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-blue-400 disabled:opacity-40 transition-colors"
                                >
                                    <ChevronRightIcon size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Right: sidebar ── */}
                    <div className="w-full lg:w-72 shrink-0 space-y-4">
                        {/* Overall rating */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-5xl font-black text-gray-900">4.9</span>
                                <div>
                                    <StarRow rating={5} />
                                    <p className="text-xs text-gray-400 mt-1">{t("Menejer ishi", "Работа менеджера")}</p>
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="space-y-1.5">
                                {RATINGS_BREAKDOWN.map(({ stars, count, pct }) => (
                                    <div key={stars} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-4 text-right">{stars}</span>
                                        <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-yellow-400 rounded-full"
                                                data-pct={pct}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400 w-8">{count}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Leave review */}
                            <Link
                                href="/reviews/new"
                                className="mt-4 block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                            >
                                {t("Sharh qoldirish", "Оставить отзыв")}
                            </Link>
                        </div>

                        {/* Sub-ratings */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                            {[
                                { label: t("Menejer ishi", "Работа менеджера"), rating: 4.8 },
                                { label: t("Ombor ishi", "Работа склада"),       rating: 4.9 },
                                { label: t("Sayt qulayligi", "Удобство сайта"),  rating: 4.7 },
                            ].map(({ label, rating }, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-500">{label}</span>
                                        <span className="font-bold text-gray-800">{rating}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full">
                                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(rating / 5) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
