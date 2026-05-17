import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Factory,
    MessageSquare,
    Box,
    TrendingUp,
    Bot,
    CreditCard,
    Truck,
    MapPin,
    UserCog,
    Crown,
    Store,
    Newspaper,
    Recycle,
    CheckCircle2,
    FileSignature,
    Receipt,
    Leaf,
    Settings,
    type LucideIcon,
} from 'lucide-react';

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    badge?: string;
    subItems?: { name: string; href: string; badge?: string }[];
    hasDropdown?: boolean;
}

export const navItems: NavItem[] = [
    { name: 'Boshqaruv paneli', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Buyurtmalar', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Hisobotlar', href: '/admin/reports', icon: TrendingUp },
    { name: 'Ishlab chiqarish (B2B)', href: '/admin/production', icon: Factory },
    {
        name: 'Mijozlar (CRM)',
        href: '/admin/customers',
        icon: Users,
        hasDropdown: true,
        subItems: [
            { name: 'Mijozlar bazasi', href: '/admin/customers' },
            { name: 'Call Center', href: '/admin/customers/calls' },
        ],
    },
    { name: 'Chat', href: '/admin/chat', icon: MessageSquare },
    { name: 'Vazifalar', href: '/admin/tasks', icon: CheckCircle2 },
    {
        name: 'Mahsulotlar',
        href: '/admin/products',
        icon: Box,
        hasDropdown: true,
        subItems: [
            { name: 'Каталог товаров', href: '/admin/products/categories' },
            { name: 'Mahsulotlar', href: '/admin/products' },
            { name: 'Import (CSV/Excel)', href: '/admin/products/import', badge: 'NEW' },
            { name: 'Chegirma (Pro)', href: '/admin/products/discounts', badge: 'PRO' },
            { name: 'IKPU', href: '/admin/products/ikpu', badge: 'PRO' },
            { name: 'Omborxona (Pro)', href: '/admin/products/warehouse', badge: 'PRO' },
        ],
    },
    {
        name: 'Marketing',
        href: '/admin/marketing',
        icon: TrendingUp,
        hasDropdown: true,
        subItems: [
            { name: 'Rassilka', href: '/admin/marketing/newsletter' },
            { name: 'Promokod', href: '/admin/marketing/promo' },
            { name: 'Manbalar', href: '/admin/marketing/sources', badge: 'PRO' },
            { name: 'SMS rassilka', href: '/admin/marketing/sms' },
            { name: 'Kanal uchun post', href: '/admin/marketing/posts' },
            { name: 'Banner', href: '/admin/marketing/banners' },
            { name: 'Sharhlar', href: '/admin/marketing/reviews' },
        ],
    },
    { name: 'Yangiliklar', href: '/admin/news', icon: Newspaper },
    {
        name: 'Platformalar',
        href: '/admin/platforms',
        icon: Bot,
        hasDropdown: true,
        subItems: [
            { name: 'Telegram bot', href: '/admin/platforms/telegram' },
            { name: 'Telegram Botlar (3x)', href: '/admin/platforms/bots', badge: 'NEW' },
            { name: 'Veb-sayt', href: '/admin/platforms/website' },
            { name: 'QR katalog', href: '/admin/platforms/qr', badge: 'PRO' },
        ],
    },
    { name: 'To\u2018lov turi', href: '/admin/payments', icon: CreditCard },
    { name: 'Shartnomalar', href: '/admin/contracts', icon: FileSignature, badge: 'NEW' },
    { name: 'Fakturalar', href: '/admin/invoices', icon: Receipt, badge: 'NEW' },
    { name: 'Yetkazib berish', href: '/admin/delivery', icon: Truck },
    { name: 'Filiallar', href: '/admin/branches', icon: MapPin },
    {
        name: 'Qayta ishlash',
        href: '/admin/recycling',
        icon: Recycle,
        hasDropdown: true,
        subItems: [
            { name: 'Arizalar', href: '/admin/recycling' },
            { name: 'Xarita (GPS)', href: '/admin/logistics', badge: 'NEW' },
            { name: 'Hisobot', href: '/admin/recycling?tab=finance', badge: 'PRO' },
        ],
    },
    { name: 'PRTS Monitor', href: '/admin/prts', icon: Leaf, badge: 'ECO' },
    {
        name: 'Xodimlar',
        href: '/admin/staff',
        icon: UserCog,
        hasDropdown: true,
        subItems: [
            { name: 'Xodimlar', href: '/admin/staff' },
            { name: 'Rollar', href: '/admin/staff/roles', badge: 'PRO' },
            { name: 'Kuryer', href: '/admin/staff/couriers', badge: 'PRO' },
        ],
    },
    { name: 'Tarif rejasi', href: '/admin/subscription', icon: Crown },
    { name: 'Robo market', href: '/admin/market', icon: Store },
    { name: 'Sozlamalar', href: '/admin/settings', icon: Settings },
];
