'use client';

import Image from 'next/image';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { useCartStore } from '@/lib/store/useCartStore';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useCurrencySafe } from '@/lib/contexts/CurrencyContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';import { LogOut, Package, User as UserIcon, Settings, ShoppingCart, ChevronRight, Loader2, Clock, Phone, Shield, Bell, Gift, MessageCircle, KeyRound, Copy, CheckCircle2, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const PushNotificationButton = dynamic(() => import('@/components/PushNotificationButton'), { ssr: false });

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    new:        { bg: 'bg-blue-50',    text: 'text-blue-700',   label: 'Yangi' },
    pending:    { bg: 'bg-amber-50',   text: 'text-amber-700',  label: 'Kutilmoqda' },
    processing: { bg: 'bg-indigo-50',  text: 'text-indigo-700', label: 'Jarayonda' },
    shipping:   { bg: 'bg-purple-50',  text: 'text-purple-700', label: "Yo'lda" },
    delivered:  { bg: 'bg-emerald-50', text: 'text-emerald-700',label: 'Yetkazildi' },
    cancelled:  { bg: 'bg-red-50',     text: 'text-red-700',    label: 'Bekor' },
};

type TabKey = 'orders' | 'cart' | 'settings';
type OnStatsReady = (stats: { totalSpent: number; orderCount: number }) => void;

interface DbProfileProductSnippet {
    image?: string;
    name?: string;
}

interface DbProfileOrderLine {
    product?: DbProfileProductSnippet;
    price: number;
    quantity: number;
}

interface DbProfileOrderRow {
    id: string | number;
    status: string;
    createdAt: string;
    items?: DbProfileOrderLine[];
    totalAmount?: number;
}

export default function ProfilePage() {
    const { user, logout, orders } = useAuthStore();
    const { status } = useSession();
    const cartItems = useCartStore(s => s.items);
    const { language } = useLanguage();
    const { format } = useCurrencySafe();
    const router = useRouter();
    const [tab, setTab] = useState<TabKey>('orders');
    const [editName, setEditName] = useState('');
    const [totalSpent, setTotalSpent] = useState(0);
    const [orderCount, setOrderCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [fullUser, setFullUser] = useState<{ telegramId?: string | null; telegramVerifiedAt?: string | null; telegramCode?: string | null; ecoPoints?: number; referralCode?: string | null } | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);

    const t = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [router, status]);

    useEffect(() => {
        if (user) setEditName(user.name);
    }, [user]);

    useEffect(() => {
        if (user) {
            fetch('/api/auth/me')
                .then(r => r.ok ? r.json() : null)
                .then(d => d && setFullUser(d))
                .catch(() => {});
        }
    }, [user]);

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        });
    };

    if (status === 'loading' || (status === 'authenticated' && !user)) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
        </div>
    );

    if (!user) return null;

    const cartTotal  = cartItems.reduce((acc, i) => acc + i.price * i.quantity, 0);

    const TABS: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
        { key: 'orders',   label: t("Buyurtmalar", "Заказы"),   icon: Package,      badge: orderCount || orders.length },
        { key: 'cart',     label: t("Savat", "Корзина"),        icon: ShoppingCart, badge: cartItems.length },
        { key: 'settings', label: t("Sozlamalar", "Настройки"), icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-surface-page">
            {/* Hero banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-12">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-end gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-extrabold text-white border-4 border-white/30 shadow-xl">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 pb-1">
                            <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-blue-200 text-sm flex items-center gap-1"><Phone size={12} />{user.phone}</span>
                                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                                    {user.role === 'admin' ? '👑 Admin' : '⭐ Mijoz'}
                                </span>
                                {fullUser?.telegramId && (
                                    <span className="text-[10px] bg-blue-500/30 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <MessageCircle size={9} /> Telegram
                                    </span>
                                )}
                                {(fullUser?.ecoPoints ?? 0) > 0 && (
                                    <span className="text-[10px] bg-green-500/30 text-white px-2 py-0.5 rounded-full font-bold">
                                        🌱 {fullUser?.ecoPoints} ball
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="hidden sm:grid grid-cols-2 gap-3 pb-1">
                            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
                                <p className="text-xl font-extrabold text-white">{orderCount || orders.length}</p>
                                <p className="text-blue-200 text-xs">{t("Buyurtma", "Заказов")}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
                                <p className="text-xl font-extrabold text-white">{format(totalSpent)}</p>
                                <p className="text-blue-200 text-xs">{t("Jami xarid", "Всего куплено")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex border-b border-gray-100">
                        {TABS.map(tb => {
                            const Icon = tb.icon;
                            return (
                            <button
                                key={tb.key}
                                onClick={() => setTab(tb.key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors relative ${
                                    tab === tb.key
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Icon size={15} />
                                <span className="hidden sm:inline">{tb.label}</span>
                                {tb.badge !== undefined && tb.badge > 0 && (
                                    <span className="w-5 h-5 text-[10px] font-extrabold bg-blue-600 text-white rounded-full flex items-center justify-center">
                                        {tb.badge}
                                    </span>
                                )}
                            </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 pb-12">
                    {/* ── Tab: Buyurtmalar ─────────────────────────────── */}
                    {tab === 'orders' && (
                        <div className="space-y-3">
                            <ProfileOrdersList user={user} language={language} format={format} t={t} onStatsReady={(stats) => { setTotalSpent(stats.totalSpent); setOrderCount(stats.orderCount); }} />
                        </div>
                    )}

                    {/* ── Tab: Savat ───────────────────────────────────── */}
                    {tab === 'cart' && (
                        <div>
                            {cartItems.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                                    <ShoppingCart size={48} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-500 font-semibold">{t("Savat bo'sh", "Корзина пуста")}</p>
                                    <Link href="/catalog" className="mt-4 inline-flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline">
                                        {t("Xarid qilish", "Начать покупки")} <ChevronRight size={14} />
                                    </Link>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="divide-y divide-gray-50">
                                        {cartItems.map((item, i) => (
                                            <div key={i} className="flex items-center gap-4 p-4">
                                                <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                                                    {item.image ? <Image src={item.image} alt={item.name} className="w-full h-full object-contain" width={300} height={300} /> : <Package size={18} className="m-auto mt-2 text-gray-300" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                                    <p className="text-xs text-gray-400">{item.quantity} {t("dona", "шт.")}</p>
                                                </div>
                                                <p className="font-bold text-gray-900 shrink-0">{format(item.price * item.quantity)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-gray-50 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500">{t("Jami", "Итого")}</p>
                                            <p className="text-xl font-extrabold text-gray-900">{format(cartTotal)}</p>
                                        </div>
                                        <Link href="/cart" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
                                            {t("Savatga o'tish", "Перейти в корзину")}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Tab: Sozlamalar ──────────────────────────────── */}
                    {tab === 'settings' && (
                        <div className="space-y-4">
                            {/* Push Notifications */}
                            <PushNotificationButton />

                            {/* Shaxsiy ma'lumot */}
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
                                    <UserIcon size={16} className="text-blue-500" />
                                    {t("Shaxsiy ma'lumot", "Личные данные")}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="profile-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                            {t("Ism", "Имя")}
                                        </label>
                                        <input
                                            id="profile-name"
                                            title={t("Ismingizni kiriting", "Введите имя")}
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                                            placeholder={t("Ismingizni kiriting", "Введите имя")}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="profile-phone" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                            {t("Telefon", "Телефон")}
                                        </label>
                                        <input
                                            id="profile-phone"
                                            title={t("Telefon raqam", "Номер телефона")}
                                            value={user.phone}
                                            readOnly
                                            className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400"
                                            placeholder={t("Telefon", "Телефон")}
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setSaving(true);
                                            try {
                                                const res = await fetch('/api/auth/me', {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ name: editName.trim() }),
                                                });
                                                if (!res.ok) {
                                                    const err = await res.json();
                                                    toast.error(err.error || t("Saqlab bo'lmadi", "Не удалось сохранить"));
                                                } else {
                                                    const { user: updated } = await res.json();
                                                    useAuthStore.getState().updateUser({ name: updated.name });
                                                    toast.success(t("Saqlandi ✓", "Сохранено ✓"));
                                                }
                                            } catch {
                                                toast.error(t("Xatolik yuz berdi", "Произошла ошибка"));
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                        disabled={saving || editName.trim() === user.name}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                                    >
                                        {saving ? t("Saqlanmoqda...", "Сохраняется...") : t("Saqlash", "Сохранить")}
                                    </button>
                                </div>
                            </div>

                            {/* Telegram holati */}
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <MessageCircle size={16} className="text-blue-500" />
                                    {t("Telegram hisobi", "Telegram аккаунт")}
                                </h3>

                                {fullUser?.telegramId ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle2 size={16} />
                                            <span className="text-sm font-semibold">
                                                {t("Telegram ulangan", "Telegram подключён")}
                                            </span>
                                        </div>
                                        {fullUser?.telegramVerifiedAt && (
                                            <p className="text-xs text-gray-400">
                                                {t("Tasdiqlangan", "Подтверждено")}:{' '}
                                                {new Date(fullUser.telegramVerifiedAt).toLocaleDateString('uz-UZ')}
                                            </p>
                                        )}

                                        {/* Kirish kodi */}
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">
                                                {t("Telegram kirish kodi", "Код входа Telegram")}
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                                    <KeyRound size={14} className="text-gray-400" />
                                                    <span className="font-mono text-lg font-bold tracking-widest text-gray-800">
                                                        {fullUser?.telegramCode
                                                            ? fullUser.telegramCode
                                                            : '• • • • •'}
                                                    </span>
                                                </div>
                                                {fullUser?.telegramCode && (
                                                    <button
                                                        onClick={() => copyCode(fullUser.telegramCode!)}
                                                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                                                    >
                                                        {codeCopied ? (
                                                            <><CheckCircle2 size={13} /> {t("Nusxalandi", "Скопировано")}</>
                                                        ) : (
                                                            <><Copy size={13} /> {t("Nusxalash", "Копировать")}</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {t(
                                                    "Bu kod bilan saytga kirish mumkin (parol o'rniga)",
                                                    "Этот код можно использовать вместо пароля"
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-500">
                                            {t(
                                                "Telegram hisobingiz hali ulanmagan. Botdan ro'yxatdan o'ting.",
                                                "Telegram аккаунт ещё не подключён. Зарегистрируйтесь через бот."
                                            )}
                                        </p>
                                        <a
                                            href="https://t.me/Pack24AI_bot"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-green hover:bg-[#053d2e] px-4 py-2.5 rounded-xl transition-colors"
                                        >
                                            <MessageCircle size={15} />
                                            @Pack24AI_bot orqali ulash
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Quick links */}
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                {[
                                    { icon: Shield, label: t("Xavfsizlik", "Безопасность"), href: '#' },
                                    { icon: Bell, label: t("Bildirishnomalar", "Уведомления"), href: '#' },
                                    { icon: Gift, label: t("Bonus dasturi", "Бонусная программа"), href: '#' },
                                ].map((item, i) => (
                                    <Link
                                        key={i}
                                        href={item.href}
                                        className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                                <item.icon size={14} className="text-blue-500" />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-400" />
                                    </Link>
                                ))}
                            </div>

                            {/* Logout */}
                            <button
                                onClick={() => {
                                    logout();
                                    router.push('/');
                                    toast.success(t("Tizimdan chiqdingiz", "Вы вышли из системы"));
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl border border-red-100 text-sm transition-colors"
                            >
                                <LogOut size={15} /> {t("Tizimdan chiqish", "Выйти из системы")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Profile Orders Sub-component — DB'dan fetch qiladi ──────────
function ProfileOrdersList({ user: _user, language: _language, format, t, onStatsReady }: {
    user: { phone: string };
    language: string;
    format: (n: number) => string;
    t: (uz: string, ru: string) => string;
    onStatsReady?: OnStatsReady;
}) {
    const [dbOrders, setDbOrders] = useState<DbProfileOrderRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orders');
            if (res.ok) {
                const data = (await res.json()) as DbProfileOrderRow[];
                setDbOrders(data);
                // Calculate totalSpent from delivered orders
                const spent = data
                    .filter((o) => o.status === 'delivered')
                    .reduce((sum: number, o) => sum + (o.totalAmount ?? 0), 0);
                onStatsReady?.({ totalSpent: spent, orderCount: data.length });
            }
        } catch (e) {
            console.error('Failed to fetch orders', e);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
        );
    }

    if (dbOrders.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                <Package size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-500 font-semibold">{t("Buyurtmalar yo'q", "Нет заказов")}</p>
                <Link href="/catalog" className="mt-4 inline-flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline">
                    {t("Xarid qilish", "Начать покупки")} <ChevronRight size={14} />
                </Link>
            </div>
        );
    }

    return (
        <>
            {dbOrders.slice(0, 5).map((order) => {
                const s = STATUS_STYLES[order.status] ?? STATUS_STYLES.new;
                const date = new Date(order.createdAt);
                return (
                    <Link key={order.id} href={`/orders/${order.id}`} className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-blue-200 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                            <div>
                                <span className="font-extrabold text-gray-900 text-sm">#{order.id}</span>
                                <span className="text-xs text-gray-400 ml-2 inline-flex items-center gap-1">
                                    <Clock size={10} />
                                    {date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                        </div>
                        <div className="px-5 py-3">
                            {(order.items ?? []).slice(0, 2).map((item, j: number) => (
                                <div key={j} className="flex items-center gap-3 py-1.5">
                                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                                        {item.product?.image ? <Image src={item.product.image} alt="" className="w-full h-full object-contain" width={300} height={300} /> : <Package size={12} className="m-auto mt-2 text-gray-300" />}
                                    </div>
                                    <p className="text-sm text-gray-700 truncate flex-1">{item.product?.name ?? 'Mahsulot'}</p>
                                    <p className="text-xs font-bold text-gray-900 shrink-0">{format(item.price * item.quantity)}</p>
                                </div>
                            ))}
                            {(order.items ?? []).length > 2 && (
                                <p className="text-xs text-gray-400">+{(order.items ?? []).length - 2} {t("ta mahsulot", "товара")}</p>
                            )}
                        </div>
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
                            <p className="font-extrabold text-gray-900">{format(order.totalAmount ?? 0)}</p>
                            <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                                {t("Batafsil", "Подробнее")} <ChevronRight size={12} />
                            </span>
                        </div>
                    </Link>
                );
            })}
            {dbOrders.length > 5 && (
                <Link href="/my-orders" className="block text-center py-4 bg-white rounded-2xl border border-gray-100 text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors">
                    {t("Barcha buyurtmalarni ko'rish", "Посмотреть все заказы")} ({dbOrders.length}) →
                </Link>
            )}
            <Link href="/my-orders" className="block text-center py-3 text-blue-600 font-semibold text-sm hover:underline">
                {t("Buyurtmalar tarixi", "История заказов")} →
            </Link>
        </>
    );
}
