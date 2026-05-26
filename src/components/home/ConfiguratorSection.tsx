'use client';

import Link from 'next/link';
import { Users, Phone, Mail, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAnimatedCounter } from '@/lib/hooks/useAnimatedCounter';
import type { Language } from '@/lib/translations';

type L = Record<Language, string>;

// ── Birlashtirилgan Stats raqamlari ──────────────────────────────
const STATS_HEADING: L = {
    uz: 'Pack24 raqamlarda', ru: 'Pack24 в цифрах', en: 'Pack24 in Numbers',
    qr: 'Pack24 sanlarda', zh: 'Pack24 数据', tr: 'Pack24 Rakamlarla',
    tg: 'Pack24 дар рақамҳо', kk: 'Pack24 сандарда', tk: 'Pack24 sanlarynda', fa: 'Pack24 در اعداد',
};
const STATS_SUB: L = {
    uz: "Bizning yutuqlarimiz sizning ishonchingiz", ru: 'Наши достижения — ваше доверие',
    en: 'Our achievements — your trust', qr: "Bizin jetiskenlerimiz — sizin iseniminiz",
    zh: '我们的成就，您的信赖', tr: 'Başarılarımız — güveniniz',
    tg: 'Дастовардҳои мо — эътимоди шумо', kk: 'Жетістіктеріміз — сіздің сенімдеріңіз',
    tk: 'Üstünliklerimiz — ynam berýär', fa: 'دستاوردهای ما — اعتماد شما',
};

const SITE_STATS: { target: number; suffix: string; label: L }[] = [
    { target: 5000,  suffix: '+', label: { uz: 'Faol mijoz',           ru: 'Активных клиентов',   en: 'Active clients',       qr: 'Aktiv mijozlar',       zh: '活跃客户',   tr: 'Aktif Müşteri',    tg: 'Мизоҷони фаъол',       kk: 'Белсенді клиенттер', tk: 'Işjeň müşderiler',  fa: 'مشتریان فعال' } },
    { target: 40,    suffix: '+', label: { uz: 'Mahsulot kategoriyasi', ru: 'Категорий товаров',    en: 'Product categories',   qr: 'Mahsulot kategoriyalari', zh: '商品类别', tr: 'Ürün kategorisi',  tg: 'Категорияҳои маҳсулот', kk: 'Тауар санаттары',    tk: 'Haryt kategoriýalary',fa: 'دسته‌بندی محصول' } },
    { target: 1500,  suffix: '+', label: { uz: 'Mahsulot turi',         ru: 'Видов продуктов',     en: 'Product types',        qr: 'Mahsulot turleri',     zh: '产品种类',   tr: 'Ürün çeşidi',      tg: 'Намудҳои маҳсулот',    kk: 'Тауар түрлері',      tk: 'Haryt görnüşleri',  fa: 'انواع محصول' } },
    { target: 98,    suffix: '%', label: { uz: 'Mijoz qoniqishi',       ru: 'Удовлетворённость',   en: 'Customer satisfaction',qr: 'Mijoz qanaaati',       zh: '客户满意度', tr: 'Müşteri memnuniyeti',tg: 'Қаноатмандии мизоҷ',  kk: 'Клиент қанағаттануы', tk: 'Müşderi kanagatlanmasy',fa: 'رضایت مشتری' } },
];

function StatCard({ target, suffix, label }: { target: number; suffix: string; label: string }) {
    const { value, ref } = useAnimatedCounter(target);
    return (
        <div ref={ref} className="text-center">
            <p className="text-4xl lg:text-5xl font-black text-white mb-1">
                {value.toLocaleString()}{suffix}
            </p>
            <p className="text-blue-200/60 text-sm font-medium">{label}</p>
        </div>
    );
}

const FEATURES: { icon: string; title: L; sub: L }[] = [
    { icon: '🚚', title: { uz: 'Tez yetkazish',      ru: 'Быстрая доставка',      en: 'Fast Delivery',       qr: 'Tez jetkeriwshi',  zh: '快速配送',   tr: 'Hızlı Teslimat',   tg: 'Тавзеи тез',           kk: 'Жедел жеткізу',       tk: 'Çalt eltip bermek',  fa: 'تحویل سریع'    }, sub: { uz: "O'z kuni",        ru: 'В день заказа',         en: 'Same day',            qr: 'Siparis kuni',     zh: '当天送达',   tr: 'Sipariş günü',     tg: 'Рӯзи фармоиш',         kk: 'Тапсырыс күні',       tk: 'Sargyt günü',        fa: 'روز سفارش'     } },
    { icon: '💳', title: { uz: "Xavfsiz to'lov",    ru: 'Безопасная оплата',     en: 'Secure Payment',      qr: "Xawipsiz tólew",   zh: '安全支付',   tr: 'Güvenli Ödeme',    tg: 'Пардохти бехатар',     kk: 'Қауіпсіз төлем',      tk: 'Howpsuz töleg',      fa: 'پرداخت امن'    }, sub: { uz: 'Onlayn / naqd',  ru: 'Онлайн / наличные',    en: 'Online / cash',       qr: 'Onlayn / naqt',    zh: '在线/现金',  tr: 'Online / nakit',   tg: 'Онлайн / нақд',        kk: 'Онлайн / қолма-қол',  tk: 'Onlaýn / nagt',      fa: 'آنلاین / نقد'  } },
    { icon: '🏆', title: { uz: 'Sifat kafolati',     ru: 'Гарантия качества',     en: 'Quality Guarantee',   qr: 'Sapa kepilligi',   zh: '质量保证',   tr: 'Kalite Garantisi', tg: 'Кафолати сифат',       kk: 'Сапа кепілдігі',      tk: 'Hil kepilligi',      fa: 'ضمانت کیفیت'   }, sub: { uz: 'Sertifikatlangan',ru: 'Сертифицировано',       en: 'Certified',           qr: 'Sertifikatlangan', zh: '已认证',     tr: 'Sertifikalı',      tg: 'Сертификатсия шудааст',kk: 'Сертификатталған',    tk: 'Sertifisirlenilen',  fa: 'گواهی‌شده'     } },
    { icon: '📦', title: { uz: 'Katta assortiment',  ru: 'Большой ассортимент',   en: 'Huge Range',          qr: 'Uly assortiment',  zh: '大量商品',   tr: 'Geniş Ürün',       tg: 'Ассортименти васеъ',   kk: 'Кең ассортимент',     tk: 'Uly assortiment',    fa: 'محدوده گسترده' }, sub: { uz: '40+ kategoriya', ru: '40+ категорий',         en: '40+ categories',      qr: '40+ kategoriya',   zh: '40+类别',    tr: '40+ kategori',     tg: '40+ категория',        kk: '40+ санат',           tk: '40+ kategoriýa',     fa: '۴۰+ دسته‌بندی'} },
    { icon: '💰', title: { uz: 'Optom narxlar',      ru: 'Оптовые цены',          en: 'Wholesale Prices',    qr: 'Optom bahalar',    zh: '批发价格',   tr: 'Toptan Fiyatlar',  tg: 'Нархҳои яклухт',       kk: 'Көтерме бағалар',     tk: 'Lomaý bahalar',      fa: 'قیمت عمده'     }, sub: { uz: '100+ dona uchun', ru: 'От 100 штук',           en: 'From 100 pcs',        qr: '100+ dana úshin',  zh: '100件起',    tr: '100 adetten',      tg: 'Аз 100 дона',          kk: '100 данадан',         tk: '100 sanydan',        fa: 'از ۱۰۰ عدد'    } },
    { icon: '🎨', title: { uz: 'Brending',            ru: 'Брендирование',          en: 'Branding',            qr: 'Brending',         zh: '品牌定制',   tr: 'Markalama',        tg: 'Брендинг',             kk: 'Брендинг',            tk: 'Brending',           fa: 'برندسازی'      }, sub: { uz: 'Logotip bilan',   ru: 'С логотипом',           en: 'With logo',           qr: 'Logotip menen',    zh: '带Logo',     tr: 'Logo ile',         tg: 'Бо логотип',           kk: 'Логотиппен',          tk: 'Logotip bilen',      fa: 'با لوگو'       } },
];

const PACKAGING_MODELS: { label: L; svg: React.ReactNode }[] = [
    {
        label: { uz: 'Karton quti', ru: 'Карт. коробка', en: 'Cardboard box', qr: 'Karton qutı', zh: '纸板箱', tr: 'Karton kutu', tg: 'Қуттии картонӣ', kk: 'Картон қорап', tk: 'Karton guty', fa: 'جعبه کارتونی' },
        svg: (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <rect x="10" y="22" width="40" height="30" rx="2" fill="rgba(96,165,250,0.3)" stroke="rgba(147,197,253,0.8)" strokeWidth="1.5"/>
                <path d="M10 22 L30 14 L50 22" stroke="rgba(147,197,253,0.9)" strokeWidth="1.5" fill="rgba(59,130,246,0.2)"/>
                <path d="M30 14 L30 22" stroke="rgba(147,197,253,0.6)" strokeWidth="1" strokeDasharray="2 2"/>
                <path d="M10 22 L10 52 M50 22 L50 52" stroke="rgba(96,165,250,0.4)" strokeWidth="1"/>
                <rect x="20" y="30" width="20" height="1.5" rx="1" fill="rgba(147,197,253,0.5)"/>
            </svg>
        ),
    },
    {
        label: { uz: 'Kuryer paketi', ru: 'Курьер. пакет', en: 'Courier bag', qr: 'Kuryer paketi', zh: '快递袋', tr: 'Kurye poşeti', tg: 'Ҳалтаи курерӣ', kk: 'Курьер пакет', tk: 'Kurýer paketi', fa: 'کیف پیک' },
        svg: (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <rect x="12" y="15" width="36" height="40" rx="3" fill="rgba(52,211,153,0.2)" stroke="rgba(110,231,183,0.8)" strokeWidth="1.5"/>
                <path d="M12 24 L48 24" stroke="rgba(110,231,183,0.7)" strokeWidth="1.5"/>
                <path d="M22 19.5 Q30 14 38 19.5" stroke="rgba(110,231,183,0.9)" strokeWidth="1.5" fill="none"/>
                <rect x="23" y="29" width="14" height="8" rx="2" fill="none" stroke="rgba(110,231,183,0.6)" strokeWidth="1"/>
                <path d="M26 33 H34" stroke="rgba(110,231,183,0.7)" strokeWidth="1"/>
            </svg>
        ),
    },
    {
        label: { uz: 'BOPP paket', ru: 'BOPP пакет', en: 'BOPP bag', qr: 'BOPP paket', zh: 'BOPP袋', tr: 'BOPP poşet', tg: 'Ҳалтаи BOPP', kk: 'BOPP пакет', tk: 'BOPP paketi', fa: 'کیسه BOPP' },
        svg: (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <path d="M18 20 L18 52 Q18 55 30 55 Q42 55 42 52 L42 20 Q42 17 30 17 Q18 17 18 20 Z" fill="rgba(167,139,250,0.2)" stroke="rgba(196,181,253,0.8)" strokeWidth="1.5"/>
                <ellipse cx="30" cy="20" rx="12" ry="4" fill="rgba(139,92,246,0.3)" stroke="rgba(196,181,253,0.7)" strokeWidth="1.2"/>
                <path d="M22 12 L22 20 M38 12 L38 20" stroke="rgba(196,181,253,0.8)" strokeWidth="1.5"/>
                <path d="M22 12 Q30 9 38 12" stroke="rgba(196,181,253,0.9)" strokeWidth="1.5" fill="none"/>
                <path d="M24 35 H36" stroke="rgba(196,181,253,0.5)" strokeWidth="1" strokeDasharray="3 2"/>
            </svg>
        ),
    },
    {
        label: { uz: 'Yassi quti', ru: 'Плоская короб.', en: 'Flat box', qr: 'Yassi qutı', zh: '扁平箱', tr: 'Yassı kutu', tg: 'Қуттии ҳамвор', kk: 'Жалпақ қорап', tk: 'Tekiz guty', fa: 'جعبه تخت' },
        svg: (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <rect x="8" y="26" width="44" height="18" rx="2" fill="rgba(251,191,36,0.2)" stroke="rgba(252,211,77,0.8)" strokeWidth="1.5"/>
                <path d="M8 26 L18 18 L52 18 L52 26" fill="rgba(251,191,36,0.15)" stroke="rgba(252,211,77,0.7)" strokeWidth="1.2"/>
                <path d="M52 18 L52 36" stroke="rgba(252,211,77,0.5)" strokeWidth="1.2"/>
                <path d="M20 26 L20 44" stroke="rgba(252,211,77,0.4)" strokeWidth="1" strokeDasharray="2 2"/>
                <path d="M14 32 H46" stroke="rgba(252,211,77,0.4)" strokeWidth="1"/>
            </svg>
        ),
    },
    {
        label: { uz: 'Quvurli quti', ru: 'Тубус', en: 'Tube box', qr: 'Quvurlı qutı', zh: '圆筒', tr: 'Tüp kutu', tg: 'Қуттии қубурӣ', kk: 'Түтікті қорап', tk: 'Turba guty', fa: 'جعبه لوله‌ای' },
        svg: (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <ellipse cx="30" cy="15" rx="12" ry="4" fill="rgba(251,113,133,0.3)" stroke="rgba(252,165,165,0.8)" strokeWidth="1.5"/>
                <path d="M18 15 L18 48 Q18 52 30 52 Q42 52 42 48 L42 15" fill="rgba(251,113,133,0.15)" stroke="rgba(252,165,165,0.7)" strokeWidth="1.5"/>
                <ellipse cx="30" cy="49" rx="12" ry="4" fill="rgba(239,68,68,0.2)" stroke="rgba(252,165,165,0.6)" strokeWidth="1.2"/>
                <path d="M30 11 L30 15" stroke="rgba(252,165,165,0.7)" strokeWidth="1.5"/>
                <circle cx="30" cy="10" r="2" fill="rgba(252,165,165,0.8)"/>
            </svg>
        ),
    },
];

const DESIGN_TOOLS: {
    href: string; icon: string;
    title: L; desc: L; badge: L;
    badgeCls: string; borderCls: string; iconBg: string;
}[] = [
    {
        href: '/design-tools/mockup', icon: '🖼️',
        title: { uz: 'Mockup Generator', ru: 'Mockup Generator', en: 'Mockup Generator', qr: 'Mockup Generator', zh: 'Mockup生成器', tr: 'Mockup Generator', tg: 'Mockup Generator', kk: 'Mockup Generator', tk: 'Mockup Generator', fa: 'Mockup Generator' },
        desc:  { uz: "Mahsulotingizni haqiqiy ko'rinishda namoyish eting", ru: 'Представьте продукт в реалистичном виде', en: 'Display your product in a realistic view', qr: "Mahsulotıńızdı haqıyqıy ko'riniste", zh: '以真实视角展示您的产品', tr: 'Ürününüzü gerçekçi görünümde sergileyin', tg: 'Маҳсулоти худро дар намои воқеӣ нишон диҳед', kk: 'Өніміңізді нақты көріністе ұсыныңыз', tk: 'Harydyňyzy hakyky görnüşde görkeziň', fa: 'محصولتان را در نمای واقعی نمایش دهید' },
        badge: { uz: 'Bepul', ru: 'Бесплатно', en: 'Free', qr: 'Tegin', zh: '免费', tr: 'Ücretsiz', tg: 'Бепул', kk: 'Тегін', tk: 'Mugt', fa: 'رایگان' },
        badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        borderCls: 'hover:border-emerald-400/40', iconBg: 'bg-emerald-500/15',
    },
    {
        href: '/design-tools/dieline', icon: '📐',
        title: { uz: 'Dieline Template', ru: 'Dieline Template', en: 'Dieline Template', qr: 'Dieline Template', zh: 'Dieline模板', tr: 'Dieline Şablonu', tg: 'Dieline Template', kk: 'Dieline Template', tk: 'Dieline Template', fa: 'قالب Dieline' },
        desc:  { uz: 'Quti uchun professional kesish shablonlari', ru: 'Профессиональные шаблоны развёрток', en: 'Professional box cutting templates', qr: 'Qutı úshin professional kesiwshi shablonlar', zh: '专业纸箱切割模板', tr: 'Kutu için profesyonel kesim şablonları', tg: 'Шаблонҳои касбии буридани қутти', kk: 'Қорап кесуге арналған кәсіби үлгілер', tk: 'Guty üçin hünärmen kesiş şablonlary', fa: 'قالب‌های برش حرفه‌ای جعبه' },
        badge: { uz: 'PDF', ru: 'PDF', en: 'PDF', qr: 'PDF', zh: 'PDF', tr: 'PDF', tg: 'PDF', kk: 'PDF', tk: 'PDF', fa: 'PDF' },
        badgeCls: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        borderCls: 'hover:border-blue-400/40', iconBg: 'bg-blue-500/15',
    },
    {
        href: '/design-tools/ai', icon: '🤖',
        title: { uz: 'AI Dizayn', ru: 'AI Дизайн', en: 'AI Design', qr: 'AI Dizayn', zh: 'AI设计', tr: 'AI Tasarım', tg: 'Дизайни AI', kk: 'AI Дизайн', tk: 'AI Dizaýn', fa: 'طراحی هوش مصنوعی' },
        desc:  { uz: "Sun'iy intellekt yordamida avtomatik dizayn", ru: 'Автоматический дизайн с ИИ', en: 'Automatic design with AI', qr: "Jasıq intellekt járdeminde avtomatik dizayn", zh: '使用AI自动设计', tr: 'Yapay zeka ile otomatik tasarım', tg: 'Дизайни автоматии AI', kk: 'AI-мен автоматты дизайн', tk: 'AI bilen awtomatik dizaýn', fa: 'طراحی خودکار با هوش مصنوعی' },
        badge: { uz: 'Yangi', ru: 'Новинка', en: 'New', qr: 'Jańa', zh: '新', tr: 'Yeni', tg: 'Нав', kk: 'Жаңа', tk: 'Täze', fa: 'جدید' },
        badgeCls: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        borderCls: 'hover:border-purple-400/40', iconBg: 'bg-purple-500/15',
    },
];

const B2B_STATS: { num: string; label: L }[] = [
    { num: '-15%', label: { uz: 'Ulgurji chegirma', ru: 'Оптовая скидка', en: 'Wholesale discount', qr: 'Optom chegirma', zh: '批发折扣', tr: 'Toptan indirim', tg: 'Тахфифи яклухт', kk: 'Көтерме жеңілдік', tk: 'Lomaý arzanladyş', fa: 'تخفیف عمده' } },
    { num: '30',   label: { uz: 'Kun muddati', ru: 'Дней рассрочки', en: 'Day installment', qr: 'Kún múddeti', zh: '天分期', tr: 'Gün taksit', tg: 'Рӯзи қарз', kk: 'Күн мерзімі', tk: 'Gün möhleti', fa: 'روز اقساط' } },
    { num: '24/7', label: { uz: "Qo'llab-quvvatlash", ru: 'Поддержка', en: 'Support', qr: "Qollap-quwwatlash", zh: '支持', tr: 'Destek', tg: 'Дастгирӣ', kk: 'Қолдау', tk: 'Goldaw', fa: 'پشتیبانی' } },
    { num: '1',    label: { uz: 'Shaxsiy menejer', ru: 'Личный менеджер', en: 'Personal manager', qr: 'Shaxsiy menejer', zh: '专属经理', tr: 'Kişisel yönetici', tg: 'Мудири шахсӣ', kk: 'Жеке менеджер', tk: 'Şahsy menejer', fa: 'مدیر اختصاصی' } },
];

// UI matnlari
const UI: Record<string, L> = {
    badge3d:    { uz: '3D Konfigurator', ru: '3D Конфигуратор', en: '3D Configurator', qr: '3D Konfigurator', zh: '3D配置器', tr: '3D Yapılandırıcı', tg: '3D Конфигуратор', kk: '3D Конфигуратор', tk: '3D Konfigurator', fa: 'پیکربندی سه‌بعدی' },
    badgeB2b:   { uz: 'Korporativ hamkorlik', ru: 'Корпоративное сотрудничество', en: 'Corporate Partnership', qr: 'Korporativ hamkorlik', zh: '企业合作', tr: 'Kurumsal ortaklık', tg: 'Ҳамкории корпоративӣ', kk: 'Корпоративтік серіктестік', tk: 'Korporatiw hyzmatdaşlyk', fa: 'همکاری سازمانی' },
    heading:    { uz: 'Qadoqingizni loyihalang va buyurtma bering', ru: 'Спроектируйте упаковку и сделайте заказ', en: 'Design your packaging and place an order', qr: 'Qadowlawıńızdı loyihalań hám siparis beriń', zh: '设计您的包装并下单', tr: 'Ambalajınızı tasarlayın ve sipariş verin', tg: 'Бастабандии худро лоиҳа кунед ва фармоиш диҳед', kk: 'Қаптауыңызды жобалаңыз және тапсырыс беріңіз', tk: 'Gaplamaňyzy tasarlap sargyt ediň', fa: 'بسته‌بندی خود را طراحی کنید و سفارش دهید' },
    subtext:    { uz: '3D modelni tanlang, rang va hajmni sozlang. Optom buyurtmalarda maxsus narxlar, kredit va shaxsiy menejer mavjud.', ru: 'Выберите 3D-модель, настройте цвет и размер. Для оптовых заказов — спеццены, рассрочка и личный менеджер.', en: 'Choose a 3D model, customize color and size. Special prices, installments and a personal manager for wholesale orders.', qr: '3D modelli tańlań, reń hám hajmdı sazlań. Optom siparislerde arnaúlı bahalar, kredit hám shaxsiy menejer bar.', zh: '选择3D模型，自定义颜色和尺寸。批量订单享特价、分期付款和专属经理。', tr: '3D model seçin, renk ve boyutu ayarlayın. Toptan siparişlerde özel fiyatlar, taksit ve kişisel yönetici.', tg: 'Модели 3D-ро интихоб кунед, ранг ва андозаро танзим кунед. Барои фармоишҳои яклухт — нархҳои махсус, насия ва мудири шахсӣ.', kk: '3D-моделді таңдаңыз, түс пен өлшемді реттеңіз. Көтерме тапсырысларға — арнайы бағалар, мерзімді төлем және жеке менеджер.', tk: '3D modeli saýlaň, reňk we ölçegi sazlaň. Lomaý sargytlar üçin ýörite bahalar, karz we şahsy menejer.', fa: 'یک مدل سه‌بعدی انتخاب کنید، رنگ و اندازه را تنظیم کنید. برای سفارش‌های عمده — قیمت‌های ویژه، اقساط و مدیر اختصاصی.' },
    models:     { uz: 'Qadoq modellari', ru: 'Модели упаковки', en: 'Packaging Models', qr: 'Qadowlaw modelleri', zh: '包装型号', tr: 'Ambalaj Modelleri', tg: 'Моделҳои бастабандӣ', kk: 'Қаптама үлгілері', tk: 'Gaplama modelleri', fa: 'مدل‌های بسته‌بندی' },
    colorOq:    { uz: 'Oq', ru: 'Белый', en: 'White', qr: 'Aq', zh: '白色', tr: 'Beyaz', tg: 'Сафед', kk: 'Ақ', tk: 'Ak', fa: 'سفید' },
    colorQora:  { uz: 'Qora', ru: 'Чёрный', en: 'Black', qr: 'Qara', zh: '黑色', tr: 'Siyah', tg: 'Сиёҳ', kk: 'Қара', tk: 'Gara', fa: 'سیاه' },
    colorKok:   { uz: "Ko'k", ru: 'Синий', en: 'Blue', qr: "Kók", zh: '蓝色', tr: 'Mavi', tg: 'Кабуд', kk: 'Көк', tk: 'Gök', fa: 'آبی' },
    colorYash:  { uz: 'Yashil', ru: 'Зелёный', en: 'Green', qr: 'Jasıl', zh: '绿色', tr: 'Yeşil', tg: 'Сабз', kk: 'Жасыл', tk: 'Ýaşyl', fa: 'سبز' },
    order:      { uz: '🎨 Buyurtma berish', ru: '🎨 Заказать', en: '🎨 Order now', qr: '🎨 Siparis beriw', zh: '🎨 立即订购', tr: '🎨 Sipariş ver', tg: '🎨 Фармоиш диҳед', kk: '🎨 Тапсырыс беру', tk: '🎨 Sargyt et', fa: '🎨 سفارش دهید' },
    call:       { uz: "Qo'ng'iroq", ru: 'Позвонить', en: 'Call', qr: "Qońıraw", zh: '打电话', tr: 'Ara', tg: 'Занг занед', kk: 'Қоңырау шалу', tk: 'Jaň et', fa: 'تماس' },
    tools:      { uz: '🎨 Dizayn Asboblari', ru: '🎨 Инструменты Дизайна', en: '🎨 Design Tools', qr: '🎨 Dizayn ásbapları', zh: '🎨 设计工具', tr: '🎨 Tasarım Araçları', tg: '🎨 Асбобҳои Дизайн', kk: '🎨 Дизайн Құралдары', tk: '🎨 Dizaýn gurallary', fa: '🎨 ابزارهای طراحی' },
    allTools:   { uz: 'Barcha asboblar', ru: 'Все инструменты', en: 'All tools', qr: 'Barlıq ásbaplar', zh: '所有工具', tr: 'Tüm araçlar', tg: 'Ҳама асбобҳо', kk: 'Барлық құралдар', tk: 'Ähli gurallar', fa: 'همه ابزارها' },
};

export default function ConfiguratorSection() {
    const { language } = useLanguage();
    const ui = (key: string): string => UI[key]?.[language] ?? UI[key]?.['uz'] ?? key;
    const lbl = (l: L) => l[language] ?? l['en'] ?? l['uz'];

    return (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="bg-gradient-to-br from-brand-navy via-[#0f3460] to-[#16213e] rounded-3xl overflow-hidden relative">
                {/* Background blobs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08)_0%,_transparent_70%)] pointer-events-none" />

                <div className="relative z-10 p-6 lg:p-10">

                    {/* ── Feature kartochkalar (TEPA) ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 pb-8 border-b border-white/10">
                        {FEATURES.map((item) => (
                            <div
                                key={item.title.uz}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                            >
                                <span className="text-xl shrink-0">{item.icon}</span>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white leading-tight truncate">
                                        {item.title[language] ?? item.title.uz}
                                    </p>
                                    <p className="text-[10px] text-blue-200/50 leading-tight">
                                        {item.sub[language] ?? item.sub.uz}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col xl:flex-row gap-10">

                        {/* LEFT */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-bold text-blue-300">
                                    ✨ {ui('badge3d')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs font-bold text-emerald-300">
                                    <Users size={11} /> {ui('badgeB2b')}
                                </span>
                            </div>

                            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-3 leading-tight">
                                {ui('heading')}
                            </h2>
                            <p className="text-blue-200/80 text-sm mb-6 leading-relaxed">
                                {ui('subtext')}
                            </p>

                            {/* Packaging Models */}
                            <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">
                                {ui('models')}
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
                                {PACKAGING_MODELS.map((model, i) => (
                                    <button
                                        key={i}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105 ${
                                            i === 0
                                                ? 'border-blue-400/60 bg-blue-500/15'
                                                : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                                        }`}
                                    >
                                        {model.svg}
                                        <span className="text-[10px] font-semibold text-blue-200/80 text-center leading-tight">
                                            {lbl(model.label)}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Colors + CTA */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex gap-2">
                                    {[
                                        { cls: 'bg-[#c8a97e]',   label: 'Kraft' },
                                        { cls: 'bg-white',       label: ui('colorOq') },
                                        { cls: 'bg-[#1e293b]',   label: ui('colorQora') },
                                        { cls: 'bg-blue-500',    label: ui('colorKok') },
                                        { cls: 'bg-emerald-500', label: ui('colorYash') },
                                    ].map((c, i) => (
                                        <button
                                            key={i}
                                            title={c.label}
                                            aria-label={c.label}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${c.cls} ${i === 0 ? 'border-white' : 'border-white/30'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        href="/catalog?filter=custom"
                                        className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-blue-500/30 text-sm"
                                    >
                                        {ui('order')}
                                    </Link>
                                    <a
                                        href="tel:+998880557888"
                                        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/30 text-sm"
                                    >
                                        <Phone size={15} /> {ui('call')}
                                    </a>
                                    <a
                                        href="mailto:b2b@pack24.uz"
                                        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
                                    >
                                        <Mail size={15} /> Email
                                    </a>
                                </div>
                            </div>

                            {/* Design tools */}
                            <div className="mt-6 pt-5 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                                        {ui('tools')}
                                    </p>
                                    <Link
                                        href="/design-tools"
                                        className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                    >
                                        {ui('allTools')} <ChevronRight size={10} />
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {DESIGN_TOOLS.map((tool, i) => (
                                        <Link
                                            key={i}
                                            href={tool.href}
                                            className={`group flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-white/5 transition-all hover:bg-white/10 ${tool.borderCls}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className={`w-9 h-9 ${tool.iconBg} rounded-lg flex items-center justify-center text-lg`}>
                                                    {tool.icon}
                                                </div>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tool.badgeCls}`}>
                                                    {lbl(tool.badge)}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white group-hover:text-blue-200 transition-colors">
                                                    {lbl(tool.title)}
                                                </p>
                                                <p className="text-[10px] text-blue-200/60 leading-tight mt-0.5">
                                                    {lbl(tool.desc)}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: 3D Box + B2B Stats */}
                        <div className="shrink-0 flex flex-col items-center gap-6">
                            <div className="relative flex items-center justify-center w-48 h-48">
                                <div className="box-3d-wrapper flex items-center justify-center">
                                    <div className="box-3d">
                                        <div className="box-face box-front">
                                            <span className="text-3xl opacity-90">📦</span>
                                            <span className="text-[10px] font-bold text-white/80 mt-1 tracking-widest">PACK24</span>
                                        </div>
                                        <div className="box-face box-back" />
                                        <div className="box-face box-left" />
                                        <div className="box-face box-right" />
                                        <div className="box-face box-top" />
                                        <div className="box-face box-bottom" />
                                    </div>
                                </div>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-blue-500/30 rounded-full blur-xl" />
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full max-w-[220px]">
                                {B2B_STATS.map(({ num, label }, i) => (
                                    <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center border border-white/10">
                                        <p className="text-xl font-black text-white">{num}</p>
                                        <p className="text-[10px] text-blue-200/70 font-medium leading-tight mt-0.5">
                                            {lbl(label)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Stats raqamlari (birlashtirилди) ── */}
                <div className="relative z-10 mt-0 pt-8 border-t border-white/10 px-6 lg:px-10 pb-8">
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-extrabold text-white mb-1">
                            {STATS_HEADING[language] ?? STATS_HEADING.uz}
                        </h3>
                        <p className="text-blue-200/60 text-sm">
                            {STATS_SUB[language] ?? STATS_SUB.uz}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                        {SITE_STATS.map((s) => (
                            <StatCard
                                key={s.target}
                                target={s.target}
                                suffix={s.suffix}
                                label={s.label[language] ?? s.label.uz}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
