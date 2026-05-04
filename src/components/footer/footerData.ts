import type { Language } from '@/lib/translations';
import { Package, Truck, Star, Users } from 'lucide-react';
import React from 'react';

type L = Record<Language, string>;

// ─── Footer linklari ──────────────────────────────────────────────
export const FOOTER_LINKS: Record<string, { title: L; links: { href: string; label: L }[] }> = {
    info: {
        title: {
            uz: "Ma'lumot", ru: 'Информация', en: 'Info', qr: "Ma'lumat",
            zh: '信息', tr: 'Bilgi', tg: 'Маълумот', kk: 'Ақпарат', tk: 'Maglumat', fa: 'اطلاعات',
        },
        links: [
            { href: '/delivery',  label: { uz: 'Yetkazish',    ru: 'Доставка',    en: 'Delivery',   qr: 'Jetkeriw',   zh: '配送',   tr: 'Teslimat',    tg: 'Тавзеъ',    kk: 'Жеткізу',   tk: 'Eltip bermek', fa: 'ارسال' } },
            { href: '/payment',   label: { uz: "To'lov",        ru: 'Оплата',      en: 'Payment',    qr: 'Tólew',      zh: '付款',   tr: 'Ödeme',       tg: 'Пардохт',   kk: 'Төлем',     tk: 'Töleg',        fa: 'پرداخت' } },
            { href: '/reviews',   label: { uz: 'Sharhlar',      ru: 'Отзывы',      en: 'Reviews',    qr: 'Pikirler',   zh: '评价',   tr: 'Yorumlar',    tg: 'Шарҳҳо',    kk: 'Пікірлер',  tk: 'Teswirler',    fa: 'نظرات' } },
            { href: '/discounts', label: { uz: 'Chegirmalar',   ru: 'Скидки',      en: 'Discounts',  qr: 'Chegirmalar',zh: '折扣',   tr: 'İndirimler',  tg: 'Тахфиф',    kk: 'Жеңілдіктер',tk: 'Arzanladyş',  fa: 'تخفیف\u200Cها' } },
            { href: '/contacts',  label: { uz: 'Kontaktlar',    ru: 'Контакты',    en: 'Contacts',   qr: 'Baylanıs',   zh: '联系',   tr: 'İletişim',    tg: 'Тамос',     kk: 'Байланыс',  tk: 'Habarlaşmak',  fa: 'تماس' } },
        ],
    },
    catalog: {
        title: {
            uz: 'Katalog', ru: 'Каталог', en: 'Catalog', qr: 'Katalog',
            zh: '目录', tr: 'Katalog', tg: 'Каталог', kk: 'Каталог', tk: 'Katalog', fa: 'کاتالوگ',
        },
        links: [
            { href: '/catalog',          label: { uz: 'Barcha mahsulotlar', ru: 'Все товары',         en: 'All Products',     qr: 'Barlıq mallar',   zh: '所有产品',  tr: 'Tüm Ürünler',      tg: 'Ҳамаи молҳо',      kk: 'Барлық тауар',    tk: 'Ähli harytlar',    fa: 'همه محصولات' } },
            { href: '/special-offers',   label: { uz: 'Maxsus takliflar',   ru: 'Спецпредложения',    en: 'Special Offers',   qr: 'Arnawlı usınıs',  zh: '特别优惠',  tr: 'Özel Teklifler',   tg: 'Пешниҳодҳои хосс', kk: 'Арнайы ұсыныс',   tk: 'Ýörite teklip',    fa: 'پیشنهادات ویژه' } },
            { href: '/catalog?new=1',    label: { uz: 'Yangiliklar',        ru: 'Новинки',            en: 'New Arrivals',     qr: 'Jañalıqlar',      zh: '新品',      tr: 'Yenilikler',       tg: 'Навигариҳо',       kk: 'Жаңалықтар',      tk: 'Täzelikler',       fa: 'جدیدترین\u200Cها' } },
            { href: '/recycling',        label: { uz: '♻️ Qayta ishlash',   ru: '♻️ Переработка',     en: '♻️ Recycling',     qr: '♻️ Qayta islew',  zh: '♻️ 回收',   tr: '♻️ Geri Dönüşüm',  tg: '♻️ Коркард',       kk: '♻️ Қайта өңдеу',  tk: '♻️ Gaýtadan işlem',fa: '♻️ بازیافت' } },
            { href: '/faq',              label: { uz: "Ko'p so'raladigan",  ru: 'Вопросы',            en: 'FAQ',              qr: 'Sorawlar',        zh: '常见问题',  tr: 'SSS',              tg: 'Саволҳо',          kk: 'Сұрақтар',        tk: 'Soraglar',         fa: 'سوالات' } },
            { href: '/active-vacancies', label: { uz: 'Vakansiyalar',       ru: 'Вакансии',           en: 'Vacancies',        qr: 'Vakansiyalar',    zh: '招聘',      tr: 'Kariyer',          tg: 'Вакансияҳо',       kk: 'Бостандықтар',    tk: 'Işe almak',        fa: 'استخدام' } },
        ],
    },
    tools: {
        title: {
            uz: 'Dizayn Asboblari', ru: 'Инструменты', en: 'Design Tools', qr: 'Dizayn ásbapları',
            zh: '设计工具', tr: 'Tasarım Araçları', tg: 'Асбобҳои Дизайн', kk: 'Дизайн Құралдары', tk: 'Dizaýn gurallary', fa: 'ابزارهای طراحی',
        },
        links: [
            { href: '/tools',                  label: { uz: 'Barcha asboblar',  ru: 'Все инструменты',  en: 'All Tools',        qr: 'Barlıq ásbaplar',  zh: '所有工具',  tr: 'Tüm Araçlar',   tg: 'Ҳама асбобҳо',    kk: 'Барлық құралдар',  tk: 'Ähli gurallar',    fa: 'همه ابزارها' } },
            { href: '/tools/mockup-generator', label: { uz: 'Mockup Generator', ru: 'Генератор мокапов', en: 'Mockup Generator', qr: 'Mockup Generator', zh: 'Mockup生成器',tr: 'Mockup',         tg: 'Mockup Generator', kk: 'Mockup Generator', tk: 'Mockup Generator',  fa: 'Mockup Generator' } },
            { href: '/tools/dieline',          label: { uz: 'Dieline Template', ru: 'Шаблоны раскройки',en: 'Dieline Template', qr: 'Dieline Template', zh: 'Dieline模板',  tr: 'Dieline',        tg: 'Dieline Template', kk: 'Dieline Template', tk: 'Dieline Template',  fa: 'قالب Dieline' } },
            { href: '/tools/ai-design',        label: { uz: 'AI Dizayn',        ru: 'AI Дизайн',        en: 'AI Design',        qr: 'AI Dizayn',        zh: 'AI设计',     tr: 'AI Tasarım',     tg: 'Дизайни AI',       kk: 'AI Дизайн',        tk: 'AI Dizaýn',         fa: 'طراحی هوش مصنوعی' } },
            { href: '/configurator',           label: { uz: '3D Konfigurator',  ru: '3D Конфигуратор',  en: '3D Configurator',  qr: '3D Konfigurator',  zh: '3D配置器',   tr: '3D Yapılandırıcı', tg: '3D Конфигуратор',  kk: '3D Конфигуратор',  tk: '3D Konfigurator',   fa: 'پیکربندی 3D' } },
        ],
    },
};

// ─── Statistika ──────────────────────────────────────────────────
export interface StatItem { icon: React.ComponentType<{ size?: number; className?: string }>; label: L }
export const STATS: StatItem[] = [
    { icon: Users,   label: { uz: '150 000+ mijoz',         ru: '150 000+ клиентов',      en: '150 000+ clients',      qr: '150 000+ mijoz',       zh: '150 000+客户',  tr: '150 000+ müşteri',  tg: '150 000+ мизоҷ',     kk: '150 000+ клиент',    tk: '150 000+ müşderi',  fa: '۱۵۰۰۰۰+ مشتری' } },
    { icon: Package, label: { uz: '10 000+ mahsulot',        ru: '10 000+ товаров',        en: '10 000+ products',      qr: '10 000+ mahsulot',     zh: '10 000+产品',   tr: '10 000+ ürün',      tg: '10 000+ маҳсулот',   kk: '10 000+ тауар',      tk: '10 000+ haryt',     fa: '۱۰۰۰۰+ محصول' } },
    { icon: Truck,   label: { uz: "O'z kuni yetkazish",      ru: 'Доставка в день заказа', en: 'Same-day delivery',     qr: "Kúni yetkerish",       zh: '当天送达',      tr: 'Aynı gün teslimat', tg: 'Тавзеи ҳамон рӯз',  kk: 'Сол күні жеткізу',  tk: 'Şol gün eltip bermek',fa: 'تحویل همان روز' } },
    { icon: Star,    label: { uz: '11 yil tajriba',           ru: '11 лет опыта',           en: '11 years experience',   qr: '11 jıllıq tajrıyba',   zh: '11年经验',      tr: '11 yıl deneyim',    tg: '11 соли таҷриба',   kk: '11 жыл тәжірибе',   tk: '11 ýyl tejribe',    fa: '۱۱ سال تجربه' } },
];

// ─── Yetkazish kompaniyalari ──────────────────────────────────────
export const DELIVERY_COMPANIES = ['СДЭК', 'ПЭК', 'Деловые Линии', 'DPD', 'Почта России', 'Яндекс', 'Байкал'];

// ─── To'lov usullari ──────────────────────────────────────────────
export const PAYMENT_METHODS = [
    { label: 'Visa',   bg: 'bg-blue-600' },
    { label: 'MC',     bg: 'bg-red-500' },
    { label: 'UzCard', bg: 'bg-green-600' },
    { label: 'Humo',   bg: 'bg-purple-600' },
    { label: 'Click',  bg: 'bg-blue-400' },
    { label: 'Payme',  bg: 'bg-indigo-500' },
    { label: 'Uzum',   bg: 'bg-orange-500' },
];

// ─── UI matnlari ─────────────────────────────────────────────────
export const UI: Record<string, L> = {
    tagline:     { uz: 'Qadoqlash materiallari gipermaketi',        ru: 'Гипермаркет упаковочных материалов',    en: 'Packaging materials hypermarket',  qr: 'Qadowlaw materiallari gipermarketi',  zh: '包装材料超市',     tr: 'Ambalaj malzemeleri hipermarketi',    tg: 'Гипермаркети маводи бастабандӣ',        kk: 'Қаптама материалдары гипермаркеті',    tk: 'Gaplama materiallary gipermarketi',    fa: 'ابرفروشگاه مواد بسته\u200Cبندی' },
    callTitle:   { uz: 'Savollaringizga javob beramiz!',             ru: 'Ответим на ваши вопросы!',              en: "We'll answer your questions!",     qr: 'Sorawlarıńızǵa jawap beremiz!',       zh: '我们将回答您的问题！', tr: 'Sorularınızı yanıtlayacağız!',      tg: 'Ба саволҳои шумо ҷавоб медиҳем!',       kk: 'Сұрауларыңызға жауап береміз!',        tk: 'Soraglaryňyzy jogaplarys!',             fa: 'به سوالات شما پاسخ می\u200Cدهیم!' },
    callSub:     { uz: "Ish vaqtida 5 daqiqada qayta qo'ng'iroq qilamiz.", ru: 'Перезвоним в течение 5 минут в рабочее время.', en: "We'll call back within 5 minutes.", qr: 'Jumıs waqtında 5 minutte qayta jasamız.', zh: '工作时间内5分钟内回电。', tr: 'Mesai saatlerinde 5 dakikada geri ararız.', tg: 'Дар вақти корӣ дар 5 дақиқа занг мезанем.', kk: 'Жұмыс уақытында 5 минутта кері қоңырау шаламыз.', tk: 'Iş wagtynda 5 minutda jaň edýäris.', fa: 'در ساعات کاری ظرف ۵ دقیقه تماس می\u200Cگیریم.' },
    callback:    { uz: "Qayta qo'ng'iroq",                           ru: 'Перезвоните мне',                        en: 'Call me back',                     qr: 'Qayta jasaw',                         zh: '回电话',           tr: 'Geri arayın',                         tg: 'Занг занед',                            kk: 'Кері қоңырау',                         tk: 'Yza jaň et',                            fa: 'تماس مجدد' },
    address:     { uz: "Toshkent, Oybek ko'chasi 14",                ru: 'Ташкент, ул. Айбека 14',                 en: 'Tashkent, Aybek str. 14',          qr: 'Tashkent, Aybek kóshesi 14',          zh: '塔什干，艾贝克街14号', tr: 'Taşkent, Aybek cad. 14',            tg: 'Тошканд, кӯчаи Айбек 14',              kk: 'Ташкент, Айбек к. 14',                 tk: 'Taşkent, Aýbek köç. 14',               fa: 'تاشکند، خیابان آیبک ۱۴' },
    schedule:    { uz: 'Har kuni 8:00 – 21:00',                      ru: 'Ежедневно с 8:00 до 21:00',              en: 'Daily 8:00 – 21:00',               qr: 'Kúnde 8:00 – 21:00',                 zh: '每天 8:00–21:00',  tr: 'Her gün 08:00–21:00',                 tg: 'Ҳар рӯз аз 8:00 то 21:00',             kk: 'Күнде 8:00–21:00',                     tk: 'Her gün 8:00–21:00',                   fa: 'هر روز ۸:۰۰ تا ۲۱:۰۰' },
    newsTitle:   { uz: "Yangiliklar va chegirmalardan xabardor bo'ling", ru: 'Узнавайте о новинках и скидках',     en: 'Get notified about news & discounts',qr: 'Jańalıqlar hám chegirmalardan xabardar bolıń', zh: '获取新品和折扣通知', tr: 'Haberler ve indirimlerden haberdar olun', tg: 'Аз навигариҳо ва тахфиф огоҳ шавед',   kk: 'Жаңалықтар мен жеңілдіктерден хабардар болыңыз', tk: 'Täzelikler we arzanladyşlar barada habar edin', fa: 'از اخبار و تخفیف\u200Cها آگاه شوید' },
    newsSub:     { uz: 'Haftalik yangiliklar, maxsus takliflar va chegirmalar', ru: 'Еженедельные новости, спецпредложения и скидки', en: 'Weekly news, special offers and discounts', qr: 'Apalık jańalıqlar, arnawlı usınıslar hám chegirmalar', zh: '每周新闻、特别优惠和折扣', tr: 'Haftalık haberler, özel teklifler ve indirimler', tg: 'Хабарҳои ҳафтагӣ, пешниҳодҳои хосс ва тахфиф', kk: 'Апталық жаңалықтар, арнайы ұсыныстар мен жеңілдіктер', tk: 'Hepdelik habarlar, ýörite teklipler we arzanladyşlar', fa: 'اخبار هفتگی، پیشنهادات ویژه و تخفیف\u200Cها' },
    subscribed:  { uz: "Obuna bo'ldingiz!",                           ru: 'Вы подписались!',                        en: "You're subscribed!",               qr: 'Abonent boldıńız!',                   zh: '已订阅！',          tr: 'Abone oldunuz!',                      tg: 'Шумо обуна шудед!',                     kk: 'Жазыldыңыз!',                          tk: 'Abunä boldyňyz!',                       fa: 'مشترک شدید!' },
    emailPlaceholder: { uz: 'Email manzilingiz', ru: 'Ваш email', en: 'Your email', qr: 'Email maňzilingiz', zh: '您的邮箱', tr: 'E-posta adresiniz', tg: 'Почтаи электронии шумо', kk: 'Электрондық поштаңыз', tk: 'Elektron e-posta', fa: 'ایمیل شما' },
    subscribe:   { uz: 'Obuna',                                       ru: 'Подписаться',                            en: 'Subscribe',                        qr: 'Abonent bolıw',                       zh: '订阅',              tr: 'Abone Ol',                            tg: 'Обуна шавед',                           kk: 'Жазылу',                               tk: 'Abunä bol',                             fa: 'اشتراک' },
    delivery:    { uz: 'Yetkazish kompaniyalari',                     ru: 'Транспортные компании',                  en: 'Delivery partners',                qr: 'Jetkeriw kompaniyaları',              zh: '物流合作伙伴',      tr: 'Teslimat şirketleri',                 tg: 'Ширкатҳои нақлиёт',                     kk: 'Тасымалдау компаниялары',              tk: 'Eltip bermek kompaniýalary',            fa: 'شرکت\u200Cهای حمل\u200Cونقل' },
    payments:    { uz: "To'lov usullari",                              ru: 'Способы оплаты',                         en: 'Payment methods',                  qr: 'Tólew usılları',                      zh: '付款方式',          tr: 'Ödeme yöntemleri',                    tg: 'Усулҳои пардохт',                       kk: 'Төлем тәсілдері',                      tk: 'Töleg usullary',                        fa: 'روش\u200Cهای پرداخت' },
    privacy:     { uz: 'Maxfiylik siyosati',                          ru: 'Политика конфиденциальности',            en: 'Privacy Policy',                   qr: 'Maxfiylik siyasatı',                  zh: '隐私政策',          tr: 'Gizlilik Politikası',                 tg: 'Сиёсати махфӣ',                         kk: 'Жеке деректер саясаты',                tk: 'Gizlinlik Syýasaty',                    fa: 'سیاست حریم خصوصی' },
    offer:       { uz: 'Ommaviy oferta',                              ru: 'Публичная оферта',                       en: 'Public Offer',                     qr: 'Ommaviy oferta',                      zh: '公开要约',           tr: 'Kamu Teklifi',                        tg: 'Оферта барои умум',                     kk: 'Жария оферта',                         tk: 'Köpçülik ofertası',                     fa: 'پیشنهاد عمومی' },
};

// Social link type
export interface SocialLink {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    href: string;
    color: string;
}
