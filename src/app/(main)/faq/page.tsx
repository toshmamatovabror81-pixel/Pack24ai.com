'use client';

import { useLanguage } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
    ChevronRight, Search, ThumbsUp, ChevronDown,
    MessageSquarePlus, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';

const QUESTIONS = [
    {
        id: 1,
        author: { uz: 'Doniyor S.', ru: 'Дониёр С.' },
        date: '14.03.2026',
        likes: 0,
        question: {
            uz: "Salom! Buyurtmam «Komplektatsiyaga tayyor» holatida ekan — bu omborga kelib olsam bo'ladimi, yoki hali yig'ilmoqdami?",
            ru: "Добрый день! Если статус заказа «Готов к комплектации» — это значит заказ уже можно забрать или его ещё только комплектуют?",
        },
        answer: {
            uz: "Salom. Buyurtmangiz №5317515 «Komplektatsiyaga tayyor» holatida. Yuk yig'ish siz kelganingizda amalga oshiriladi. Omborga 21:00 gacha kelishingiz mumkin.",
            ru: "Добрый день. Ваш заказ №5317515 в статусе «Готов к комплектации». Сборка груза осуществляется по вашему приезду на склад. Ждём вас до 21:00.",
        },
    },
    {
        id: 2,
        author: { uz: "Murod T.", ru: "Мурод Т." },
        date: '13.03.2026',
        likes: 0,
        question: {
            uz: "Salom! Viloyatlarga yetkazib berish qancha vaqt oladi?",
            ru: "Здравствуйте, как долго осуществляется доставка в вилоят, с момента оплаты заказа?",
        },
        answer: {
            uz: "Salom. Jo'natilgandan keyin viloyatlarga taxminan 1-3 kun.",
            ru: "Добрый день. Срок доставки после отгрузки в вилоят — ориентировочно 1-3 дня.",
        },
    },
    {
        id: 3,
        author: { uz: 'Oydin K.', ru: 'Ойдин К.' },
        date: '05.03.2026',
        likes: 1,
        question: {
            uz: "Salom! 400×150×150 mm, 600×150×150 mm o'lchamli qutilarga buyurtma berib bo'ladimi?",
            ru: "Добрый день! Возможно ли изготовить на заказ коробки 400×150×150 мм, 600×150×150 мм?",
        },
        answer: {
            uz: "Salom, Oydin! Afsuski, qutilami buyurtmaga ishlab chiqarmaymiz. Faqat assortimentdagi tayyor o'lchamlardagi qutilari taklif qilamiz.",
            ru: "Здравствуйте, Ойдин! К сожалению, короба не изготавливаем под заказ. Предлагаем только готовые размеры из ассортимента.",
        },
    },
    {
        id: 4,
        author: { uz: "Gulnora H.", ru: "Гулнора Х." },
        date: '03.03.2026',
        likes: 0,
        question: {
            uz: "Salom. Hunarmandchilik qoplarini buyurtmaga qilasizmi? Sinov partiyasi 30 000 dona.",
            ru: "Здравствуйте. Делаете ли вы крафтовые пакеты на заказ? Пробная партия 30 000 шт.",
        },
        answer: {
            uz: "Salom, afsuski bu pozitsiya assortimentimizda yo'q. Buyurtmaga ishlab chiqarmaymiz.",
            ru: "Здравствуйте, к сожалению, такая позиция в нашем ассортименте не представлена. На заказ не изготавливаем.",
        },
    },
    {
        id: 5,
        author: { uz: 'Bekhzod A.', ru: 'Бехзод А.' },
        date: '28.02.2026',
        likes: 0,
        question: {
            uz: "Salom. Sizda 8×6×2 sm o'lchamli o'z-o'ziga yig'iladigan qutilari bormi? Narxi qancha?",
            ru: "Добрый день. Подскажите, у вас есть самосборные коробки размером 8×6×2 см? По какой цене?",
        },
        answer: {
            uz: "Oydin, salom — afsuski bunday o'lcham assortimentimizda yo'q. Eng yaqin: O'z-o'ziga yig'iladigan quti 80×80×30 mm (FEFCO 0427) taklif eta olamiz.",
            ru: "Добрый день — к сожалению, такого размера нет в ассортименте. Можем предложить: Самосборный короб 80×80×30 мм (FEFCO 0427).",
        },
    },
    {
        id: 6,
        author: { uz: 'Nodira P.', ru: 'Нодира П.' },
        date: '25.02.2026',
        likes: 0,
        question: {
            uz: "Salom! Zipper-qoplar uchun 'optom' qancha miqdordan boshlanadi? Chegirma bormi?",
            ru: "Добрый день! Подскажите, от какого количества пакетов с бегунком считается «опт»? Есть ли скидка от количества?",
        },
        answer: {
            uz: "Salom! Chegirmalar buyurtma umumiy summasiga bog'liq, 500 000 so'mdan boshlab optom narxlar amal qiladi.",
            ru: "Здравствуйте! Скидки зависят от общей суммы заказа, оптовые цены действуют на заказы от 500 000 сум.",
        },
    },
    {
        id: 7,
        author: { uz: 'Jahongir R.', ru: 'Жахонгир Р.' },
        date: '03.02.2026',
        likes: 0,
        question: {
            uz: "Oldinroq sizdan qutilari buyurtma qilgan edik, yordamingiz kerak. Buyurtma №4642110, summa 166 000 so'm. Har bir o'lcham bo'yicha miqdorni emailga yubora olasizmi?",
            ru: "Ранее заказывали у вас короба, нужна помощь. Можете скинуть на почту количество по каждой фасовке? Номер заказа 4642110.",
        },
        answer: {
            uz: "Salom! Buyurtmada email ko'rsatilmaganligi sababli ma'lumotlar saqlanmagan. Hozir email qo'shdik va shaxsiy kabinetga kirish ma'lumotlarini yubordik. «Mening buyurtmalarim»da tarixni ko'rishingiz mumkin.",
            ru: "Здравствуйте! В заказе не была указана эл. почта, поэтому данные не сохранились. Сейчас почту добавили и выслали данные для входа в личный кабинет. В разделе «Мои заказы» увидите историю.",
        },
    },
    {
        id: 8,
        author: { uz: 'Sabohat Y.', ru: 'Сабохат Ю.' },
        date: '02.02.2026',
        likes: 1,
        question: {
            uz: "Salom! Qutining tashqi o'lchamini qanday aniqlash mumkin?",
            ru: "Добрый день! Как определить внешний размер короба?",
        },
        answer: {
            uz: "Salom! Saytda ichki o'lchamlar ko'rsatilgan, gofrokarton qalinligi taxminan 3 mm. Tashqi o'lcham = ichki o'lcham + 3 mm (har tomondan).",
            ru: "Здравствуйте! На сайте указан внутренний размер короба, толщина гофрокартона примерно 3 мм. Внешний размер = внутренний размер + 3 мм (с каждой стороны).",
        },
    },
    {
        id: 9,
        author: { uz: 'Alisher M.', ru: 'Алишер М.' },
        date: '02.02.2026',
        likes: 0,
        question: {
            uz: "Salom! 120×70×12 mm o'lchamiga eng yaqin o'z-o'ziga yig'iladigan quti qaysi?",
            ru: "Добрый день! Подскажите ближайший размер самосборных коробок к 120×70×12 мм.",
        },
        answer: {
            uz: "Salom! Eng yaqin o'lcham: O'z-o'ziga yig'iladigan quti 120×70×40 mm (FEFCO 0427) — min. partiya 100 dona.",
            ru: "Здравствуйте! Ближайший размер: Самосборный короб 120×70×40 мм (FEFCO 0427) — минимальная партия 100 шт.",
        },
    },
    {
        id: 10,
        author: { uz: 'Kamola B.', ru: 'Камола Б.' },
        date: '22.01.2026',
        likes: 0,
        question: {
            uz: "Salom. KK205 quti zichmi? Marketpleysga tovarlar uchun mos keladimi?",
            ru: "Добрый день. Коробка КК205 плотная? Подходит для упаковки товаров на маркетплейсах?",
        },
        answer: {
            uz: "Salom! Biz asosan 3 qavatli gofrokartondan yasalgan qutilami taklif qilamiz — bular transport kompaniyalar yoki marketpleyslar uchun mo'ljallangan. Bu quti T-22 markali gofrokartondan yasalgan, profil E (1-1,5 mm qalinlik).",
            ru: "Здравствуйте! Мы предлагаем короба из 3-слойного гофрокартона, предназначенные для отправки через ТК или МП. Данный короб из гофрокартона марки Т-22, профиль E — толщина стенки 1-1,5 мм.",
        },
    },
    {
        id: 11,
        author: { uz: 'Sanjar O.', ru: 'Санжар О.' },
        date: '22.01.2026',
        likes: 0,
        question: {
            uz: "Salom. Sizlar O'zbekistonning barcha shaharlariga yetkazib berasizmi?",
            ru: "Здравствуйте. Скажите, отправляете ли вы по всему Узбекистану?",
        },
        answer: {
            uz: "Salom! Ha, butun O'zbekiston bo'ylab transport kompaniyalar orqali yetkazamiz. Buyurtmani sayt orqali rasmiylashtirib, menejer yetkazib berish usulini muhokama qiladi.",
            ru: "Здравствуйте! Да, доставляем по всему Узбекистану транспортными компаниями. Оформите заказ на сайте, менеджер свяжется для согласования способа доставки.",
        },
    },
    {
        id: 12,
        author: { uz: 'Dilshod N.', ru: 'Дилшод Н.' },
        date: '20.01.2026',
        likes: 0,
        question: {
            uz: "Mening o'lchamlarim bo'yicha quti ishlab chiqarasizmi?",
            ru: "Можете ли изготовить коробки по моим размерам?",
        },
        answer: {
            uz: "Kechqurun, individual o'lchamdagi qutilami ishlab chiqarmaymiz. Faqat saytda taqdim etilgan tayyor mahsulotlar sotiladi.",
            ru: "Добрый вечер, мы не изготавливаем короба по индивидуальным размерам. В продаже только готовая продукция, представленная на сайте.",
        },
    },
    {
        id: 13,
        author: { uz: 'Mohira I.', ru: 'Мохира И.' },
        date: '20.01.2026',
        likes: 0,
        question: {
            uz: "Salom. Havo-pufakchali plyonkaning ichki diametri qancha (0.6×50 m)?",
            ru: "Добрый день. Скажите внутренний диаметр штули в рулоне воздушно-пузырьковой плёнки 0.6×50 м?",
        },
        answer: {
            uz: "Salom! Havo-pufakchali plyonka 0.6×50 m ikki qavatli — ichki diametri 8 sm.",
            ru: "Добрый день! Воздушно-пузырьковая плёнка 0.6×50 м двухслойная — внутренний диаметр 8 см.",
        },
    },
    {
        id: 14,
        author: { uz: 'Barno T.', ru: 'Барно Т.' },
        date: '2.12.2025',
        likes: 0,
        question: {
            uz: "Optom qancha miqdordan boshlanadi?",
            ru: "Опт от скольки штук начинается?",
        },
        answer: {
            uz: "Salom. Optom narxlar buyurtma summasiga qarab:\n500 000–2 000 000 so'm — 3%\n2 000 000–5 000 000 so'm — 5%\n5 000 000–15 000 000 so'm — 7%\n15 000 000–30 000 000 so'm — 10%\n30 000 000 so'mdan — 15% + VIP",
            ru: "Добрый день. Оптовые цены зависят от суммы заказа:\n500 000–2 000 000 сум — 3%\n2 000 000–5 000 000 сум — 5%\n5 000 000–15 000 000 сум — 7%\n15 000 000–30 000 000 сум — 10%\nот 30 000 000 сум — 15% + VIP",
        },
    },
    {
        id: 15,
        author: { uz: 'Laziz Q.', ru: 'Лазиз К.' },
        date: '30.11.2025',
        likes: 2,
        question: {
            uz: "Salom, agar bugun buyurtma bersam, ertaga olib keta olamanmi? Va soat nechacha gacha?",
            ru: "Здравствуйте, если я сегодня закажу — завтра смогу забрать? Если да, то до скольки?",
        },
        answer: {
            uz: "Salom! Bugun 21:00 gacha o'z-o'ziga olish mumkin. Ertaga ish vaqti: 08:00 dan 21:00 gacha.",
            ru: "Здравствуйте! Самовывоз доступен сегодня до 21:00, завтра — с 08:00 до 21:00.",
        },
    },
];

const PER_PAGE = 8;

export default function FAQPage() {
    const { language } = useLanguage();
    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    const [search, setSearch]     = useState('');
    const [sort, setSort]         = useState<'new' | 'liked'>('new');
    const [page, setPage]         = useState(1);
    const [expanded, setExpanded] = useState<number[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formText, setFormText] = useState('');

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return QUESTIONS
            .filter(item => {
                const text = language === 'ru'
                    ? item.question.ru + item.answer.ru
                    : item.question.uz + item.answer.uz;
                return text.toLowerCase().includes(q);
            })
            .sort((a, b) => sort === 'liked' ? b.likes - a.likes : b.id - a.id);
    }, [search, sort, language]);

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const visible    = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const toggle = (id: number) =>
        setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Breadcrumb */}
            <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/" className="hover:text-blue-600">{t("Bosh sahifa", "Главная")}</Link>
                    <ChevronRight size={14} />
                    <span className="text-gray-900 font-medium">{t("Savollar", "Вопросы")}</span>
                </nav>
            </div>

            <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900">{t("Savollar", "Вопросы")}</h1>
                        <p className="text-sm text-gray-400 mt-0.5">{QUESTIONS.length} {t("ta savol", "вопросов")}</p>
                    </div>
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 text-sm"
                    >
                        <MessageSquarePlus size={16} />
                        {t("Savol berish", "Задать вопрос")}
                    </button>
                </div>

                {/* Ask form */}
                {showForm && (
                    <div className="bg-white rounded-2xl border border-blue-100 p-5 mb-6 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-3 text-sm">{t("Savolingizni yozing", "Напишите ваш вопрос")}</h3>
                        <textarea
                            value={formText}
                            onChange={e => setFormText(e.target.value)}
                            rows={3}
                            placeholder={t("Savolingizni kiriting...", "Введите ваш вопрос...")}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
                        />
                        <div className="flex gap-2 mt-3 justify-end">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
                            >
                                {t("Bekor qilish", "Отмена")}
                            </button>
                            <button
                                onClick={() => { setShowForm(false); setFormText(''); }}
                                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                {t("Yuborish", "Отправить")}
                            </button>
                        </div>
                    </div>
                )}

                {/* Search + sort */}
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder={t("Savollar ichida qidirish...", "Поиск по вопросам...")}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
                        />
                    </div>
                    <div className="flex gap-2">
                        {([
                            { key: 'new',   uz: 'Yangilardan', ru: 'Сначала новые' },
                            { key: 'liked', uz: 'Foydalilardan', ru: 'Сначала полезные' },
                        ] as const).map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => { setSort(opt.key); setPage(1); }}
                                className={`text-xs font-semibold px-3 py-2 rounded-xl transition-all ${sort === opt.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
                            >
                                {language === 'ru' ? opt.ru : opt.uz}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Questions list */}
                <div className="space-y-3">
                    {visible.length === 0 && (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            {t("Hech narsa topilmadi", "Ничего не найдено")}
                        </div>
                    )}
                    {visible.map(item => {
                        const isOpen    = expanded.includes(item.id);
                        const name      = language === 'ru' ? item.author.ru : item.author.uz;
                        const question  = language === 'ru' ? item.question.ru : item.question.uz;
                        const answer    = language === 'ru' ? item.answer.ru   : item.answer.uz;

                        return (
                            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                {/* Question row */}
                                <button
                                    className="w-full text-left p-5 flex items-start gap-4 hover:bg-gray-50/70 transition-colors"
                                    onClick={() => toggle(item.id)}
                                >
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5">
                                        {name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-700">{name}</span>
                                            <span className="text-xs text-gray-400">{item.date}</span>
                                        </div>
                                        <p className="text-sm text-gray-800 leading-relaxed pr-4">{question}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 mt-0.5">
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <ThumbsUp size={12} />
                                            {item.likes}
                                        </span>
                                        <ChevronDown
                                            size={16}
                                            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </button>

                                {/* Answer */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 bg-blue-50/40 px-5 py-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">P</div>
                                            <span className="text-xs font-bold text-blue-700">Pack24</span>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{answer}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            aria-label="Oldingi sahifa"
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-blue-400 disabled:opacity-40"
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
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-blue-400 disabled:opacity-40"
                        >
                            <ChevronRightIcon size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
