'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
    Bot, Users, ShoppingCart, Save, RefreshCcw,
    Smartphone, Globe, Loader2, Package, Wallet,
    CheckCircle2, Clock3,
    Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Stats {
    totalUsers: number;
    totalOrders: number;
    totalCollections: number;
    pendingCollections: number;
    paidCollections: number;
}

interface TelegramTestResultRow {
    status?: string;
}

interface TelegramWebhookInfoStub {
    url?: string;
    pending_update_count?: number;
}

export default function TelegramBotPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);

    // Config
    const [botToken, setBotToken] = useState('');
    const [welcomeText, setWelcomeText] = useState('Assalomu alaykum, {user}! Pack24uz botiga xush kelibsiz.');
    const [mainButtonText, setMainButtonText] = useState("Do'kon 🏪");
    const [salesChatId, setSalesChatId] = useState('');
    const [botUsername, setBotUsername] = useState('@...');
    const [botName] = useState('Pack24 Bot');
    const [isActive, setIsActive] = useState(false);
    const [webhookInfo, setWebhookInfo] = useState<TelegramWebhookInfoStub | null>(null);
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0, totalOrders: 0,
        totalCollections: 0, pendingCollections: 0, paidCollections: 0,
    });

    const fetchConfig = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const res = await fetch('/api/admin/telegram/config');
            if (res.ok) {
                const data = await res.json();
                setBotToken(data.botToken || '');
                setWelcomeText(data.welcomeMessage || 'Assalomu alaykum, {user}!');
                setMainButtonText(data.mainButton || "Do'kon 🏪");
                setSalesChatId(data.salesChatId || '');
                setBotUsername(data.botUsername || '@...');
                setIsActive(!!data.isActive);
                setWebhookInfo(data.webhookInfo);
                if (data.stats) setStats(data.stats);
            }
        } catch {
            toast.error('Sozlamalarni yuklashda xatolik');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/telegram/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botToken, welcomeMessage: welcomeText, mainButton: mainButtonText, salesChatId }),
            });
            if (res.ok) {
                const data = await res.json();
                setBotUsername(data.botUsername || botUsername);
                setIsActive(true);
                toast.success('✅ Sozlamalar saqlandi');
                fetchConfig(true);
            } else {
                toast.error('Saqlashda xatolik yuz berdi');
            }
        } catch {
            toast.error('Server bilan bog\'lanishda xatolik');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTestLoading(true);
        try {
            const res = await fetch('/api/admin/telegram/test', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const ok = (data.results as TelegramTestResultRow[] | undefined)?.filter((r) => r.status === 'success').length || 0;
                if (ok > 0) {
                    toast.success(`${ok} ta manzilga test xabari yuborildi!`);
                } else {
                    toast.warning('Bot ishlayapti, lekin Chat ID kiritilmagan yoki noto\'g\'ri.');
                }
            } else {
                toast.error(data.error || 'Testda xatolik');
            }
        } catch {
            toast.error('Server bilan bog\'lanishda xatolik');
        } finally {
            setTestLoading(false);
        }
    };

    const copyChatId = () => {
        navigator.clipboard.writeText('/start').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (loading) return (
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <p className="text-sm text-gray-500">Bot ma&apos;lumotlari yuklanmoqda...</p>
            </div>
        </div>
    );

    const webhookOk = !!webhookInfo?.url;

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen space-y-6">

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Telegram Bot</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Pack24 — barcha rollar uchun avtomatlashtirilgan bot</p>
                </div>
                <button
                    onClick={() => fetchConfig(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Yangilash
                </button>
            </div>

            {/* ── Bot Identity ────────────────────────────────────────── */}
            <Card className="p-6 border border-gray-100 shadow-sm rounded-2xl">
                <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg ${isActive ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-200' : 'bg-gradient-to-br from-gray-300 to-gray-400'}`}>
                        <Bot className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-extrabold text-gray-900">{botName}</h2>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                                {isActive ? '● Faol' : '○ Faol emas'}
                            </span>
                        </div>
                        <p className="text-emerald-600 font-semibold text-sm mt-0.5">{botUsername}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 text-xs font-medium">v2.0.0 · Recycling Ready</span>
                            {webhookOk && (
                                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded">
                                    <CheckCircle2 size={11} /> Webhook faol
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── Stats Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Users,      label: 'Foydalanuvchilar', value: stats.totalUsers,        color: 'purple',  bg: 'bg-purple-50',  text: 'text-purple-600' },
                    { icon: ShoppingCart, label: 'Buyurtmalar',   value: stats.totalOrders,        color: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-600'   },
                    { icon: Package,    label: 'Yig\'ishlar',     value: stats.totalCollections,   color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600'},
                    { icon: Wallet,     label: 'To\'langan',      value: stats.paidCollections,    color: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-600'  },
                ].map(({ icon: Icon, label, value, bg, text }) => (
                    <Card key={label} className="p-5 border border-gray-100 shadow-sm rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 ${bg} rounded-xl`}>
                                <Icon className={`w-5 h-5 ${text}`} />
                            </div>
                            <span className="text-xs font-semibold text-gray-500">{label}</span>
                        </div>
                        <p className="text-2xl font-extrabold text-gray-900">{value.toLocaleString()}</p>
                    </Card>
                ))}
            </div>

            {/* ── Pending payments banner ─────────────────────────── */}
            {stats.pendingCollections > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <Clock3 className="text-amber-500 shrink-0" size={18} />
                    <p className="text-sm text-amber-800 font-medium">
                        <strong>{stats.pendingCollections}</strong> ta yig&apos;ish to&apos;lovni kutmoqda — bot orqali to&apos;lash uchun /tolash
                    </p>
                </div>
            )}

            <div className="grid xl:grid-cols-3 gap-6">
                {/* ── Left: Settings ────────────────────────────── */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Webhook status */}
                    {botToken && (
                        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-l-4 ${webhookOk
                            ? 'bg-emerald-50/50 border-emerald-500'
                            : 'bg-amber-50/50 border-amber-400'
                        }`}>
                            <div className="flex items-center gap-3">
                                <Globe className={webhookOk ? 'text-emerald-600' : 'text-amber-500'} size={18} />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Webhook holati</p>
                                    <p className="text-xs text-gray-500 font-mono truncate max-w-xs">
                                        {webhookInfo?.url || 'Webhook sozlanmagan — NEXT_PUBLIC_APP_URL ni kiriting'}
                                    </p>
                                </div>
                            </div>
                            {(() => {
                                const pending = webhookInfo?.pending_update_count ?? 0;
                                return pending > 0 ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                    {pending} kutilmoqda
                                </Badge>
                                ) : null;
                            })()}
                        </div>
                    )}

                    {/* Token + ChatId */}
                    <Card className="p-6 border border-gray-100 shadow-sm rounded-2xl space-y-5">
                        <h3 className="font-bold text-gray-900">Bot ulanishi</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bot Token <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="password"
                                value={botToken}
                                onChange={(e) => setBotToken(e.target.value)}
                                placeholder="123456789:ABCdef..."
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1.5">
                                BotFather&apos;dan: /newbot → /mybots → API Token
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Menejerlar Guruh ID
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={salesChatId}
                                    onChange={(e) => setSalesChatId(e.target.value)}
                                    placeholder="-1001234567890"
                                    className="font-mono text-sm flex-1"
                                />
                                <button
                                    onClick={copyChatId}
                                    className="px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
                                    title="Nusxa"
                                >
                                    {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5">
                                Botni guruhga qo&apos;shing va /start yuboring. Vergul bilan bir nechta ID kiritish mumkin.
                            </p>
                        </div>
                    </Card>

                    {/* Welcome text */}
                    <Card className="p-6 border border-gray-100 shadow-sm rounded-2xl space-y-5">
                        <h3 className="font-bold text-gray-900">Xush kelibsiz matni</h3>
                        <div>
                            <textarea
                                value={welcomeText}
                                onChange={(e) => setWelcomeText(e.target.value)}
                                className="w-full min-h-[110px] p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-700 resize-none text-sm"
                                placeholder="Botga kirganda chiqadigan matn..."
                            />
                            <p className="text-[11px] text-gray-500 mt-2">
                                Placeholder: <code className="bg-blue-50 text-blue-600 px-1 rounded mx-0.5">{'{user}'}</code> — ismi,
                                <code className="bg-blue-50 text-blue-600 px-1 rounded mx-0.5">{'{bot}'}</code> — bot nomi
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Web App tugmasi</label>
                            <Input
                                value={mainButtonText}
                                onChange={(e) => setMainButtonText(e.target.value)}
                                placeholder="Masalan: Do'kon 🏪"
                            />
                        </div>
                    </Card>

                    {/* Setup guide */}
                    <Card className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900">Sozlash bo&apos;yicha qo&apos;llanma</h3>
                        </div>
                        <ol className="p-6 space-y-4">
                            {[
                                { n: 1, title: 'Token kiriting', desc: 'BotFather\'dan olingan tokenni kiriting va saqlang. Webhook avtomatik sozlanadi.' },
                                { n: 2, title: 'Masul va Haydovchilarni biriktiring', desc: 'Recycling bo\'limida har bir xodimning Telegram ID si kiritilsin.' },
                                { n: 3, title: 'Botni guruhga qo\'shing', desc: 'Arizalar guruhga tushishini xohlasangiz, botni guruhga qo\'shing va guruh ID sini kiriting.' },
                                { n: 4, title: 'NEXT_PUBLIC_APP_URL sozlang', desc: 'Production domeningizni .env ga kiriting: https://pack24.uz (webhook uchun kerak).' },
                            ].map(step => (
                                <li key={step.n} className="flex gap-4">
                                    <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">{step.n}</span>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{step.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </Card>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button
                            onClick={handleTest}
                            disabled={testLoading || !botToken}
                            variant="secondary"
                            className="border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-6 py-2.5 rounded-xl font-bold"
                        >
                            {testLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Smartphone className="w-4 h-4 mr-2" />}
                            Botni tekshirish
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !botToken}
                            className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 px-8 py-2.5 rounded-xl font-bold"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Saqlash
                        </Button>
                    </div>
                </div>

                {/* ── Right: iPhone Preview ────────────────────── */}
                <div className="hidden xl:block">
                    <div className="sticky top-6">
                        <p className="text-center text-gray-400 text-[11px] uppercase font-bold tracking-widest mb-4">Botni ko&apos;rinishi</p>
                        <div className="border-[10px] border-gray-900 rounded-[3rem] overflow-hidden shadow-2xl bg-gray-100">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-900 rounded-b-xl z-20" />

                            {/* Telegram header */}
                            <div className="bg-[#517DA2] text-white px-4 pt-8 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-emerald-400 flex items-center justify-center font-black text-sm shadow">P</div>
                                    <div>
                                        <p className="font-bold text-sm leading-tight">{botName}</p>
                                        <p className="text-[10px] opacity-70">bot</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chat */}
                            <div className="p-3 space-y-3 min-h-[360px] bg-[#C8D5DF]/30">
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none max-w-[90%] shadow-sm text-[12px] text-gray-800 leading-relaxed">
                                    {welcomeText.replace('{user}', 'Sardor').replace('{bot}', botName)}
                                    {"\n\n"}
                                    <span className="text-[#0088CC]">♻️ Makulatura topshirish uchun /ariza</span>
                                </div>
                            </div>

                            {/* Keyboard */}
                            <div className="bg-[#F0F2F5]/95 p-2.5 border-t border-gray-200 space-y-1.5">
                                <button className="w-full bg-white py-2.5 rounded-xl text-[13px] text-[#0088CC] font-bold shadow-sm border border-gray-200">
                                    {mainButtonText}
                                </button>
                                <button className="w-full bg-white py-2.5 rounded-xl text-[13px] text-gray-700 font-medium shadow-sm border border-gray-200">
                                    ♻️ Ariza yuborish
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
