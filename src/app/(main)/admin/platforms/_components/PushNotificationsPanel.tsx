'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Send, Users, CheckCircle, AlertTriangle, Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

interface PushStats {
    total: number;
    active: number;
    inactive: number;
}

interface NotificationForm {
    title: string;
    body: string;
    url: string;
    userId: string;
}

const EMPTY_FORM: NotificationForm = {
    title:  '',
    body:   '',
    url:    '/',
    userId: '',
};

// ─── Push Notification Admin Paneli ───────────────────────────────────────────
export default function PushNotificationsPanel() {
    const [stats, setStats]    = useState<PushStats | null>(null);
    const [form, setForm]      = useState<NotificationForm>(EMPTY_FORM);
    const [sending, setSending] = useState(false);
    const [lastResult, setLastResult] = useState<{ sent: number; failed: number } | null>(null);
    const [webPushAvailable, setWebPushAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/push/send');
            if (res.status === 503) {
                // web-push yuklanmagan
                setWebPushAvailable(false);
                return;
            }
            if (res.status === 401) { return; } // admin cookie not set in dev preview
            if (res.ok) {
                setWebPushAvailable(true);
                setStats(await res.json());
            }
        } catch {
            /* ignore */
        }
    };

    const handleSend = async () => {
        if (!form.title.trim() || !form.body.trim()) {
            toast.error('Sarlavha va matn majburiy!');
            return;
        }

        setSending(true);
        setLastResult(null);
        try {
            const res = await fetch('/api/push/send', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    title:  form.title,
                    body:   form.body,
                    url:    form.url || '/',
                    ...(form.userId ? { userId: Number(form.userId) } : {}),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setLastResult({ sent: data.sent, failed: data.failed ?? 0 });
                toast.success(`✅ ${data.sent} ta qurilmaga push yuborildi`);
                setForm(EMPTY_FORM);
                fetchStats();
            } else {
                toast.error(data.error || 'Xatolik yuz berdi');
            }
        } catch {
            toast.error('Server bilan ulanishda xatolik');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                        <Bell size={20} className="text-blue-600" />
                        Push Bildirishnomalar
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Foydalanuvchilarga real-time xabar yuborish
                    </p>
                </div>
                <button
                    onClick={fetchStats}
                    className="text-xs text-blue-600 hover:underline"
                >
                    Yangilash ↻
                </button>
            </div>

            {/* web-push ogohlantirish */}
            {webPushAvailable === false && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">web-push paketi kerak</p>
                        <p className="text-xs text-amber-600 mt-1">
                            Terminalda quyidagini bajaring:
                        </p>
                        <code className="block mt-2 bg-amber-100 text-amber-900 text-xs rounded-lg px-3 py-2 font-mono">
                            npm install web-push @types/web-push
                        </code>
                        <p className="text-xs text-amber-600 mt-2">
                            Keyin <code>.env</code> ga VAPID kalitlarini qo&apos;ying. VAPID generatsiya:
                        </p>
                        <code className="block mt-1 bg-amber-100 text-amber-900 text-xs rounded-lg px-3 py-2 font-mono">
                            npx web-push generate-vapid-keys
                        </code>
                    </div>
                </div>
            )}

            {/* Statistika */}
            {stats && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Jami obunachi", value: stats.total,    icon: Users,     color: 'text-blue-600',   bg: 'bg-blue-50' },
                        { label: "Faol",           value: stats.active,  icon: Bell,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: "Nofaol",         value: stats.inactive,icon: BellOff,  color: 'text-gray-500',   bg: 'bg-gray-50' },
                    ].map((s) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                                <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                                    <Icon size={16} className={s.color} />
                                </div>
                                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Yuborish formasi */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Megaphone size={15} className="text-blue-500" />
                    Yangi bildirishnoma
                </h3>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Sarlavha *
                    </label>
                    <input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Yangi aksiya! 🎉"
                        maxLength={80}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Matn *
                    </label>
                    <textarea
                        value={form.body}
                        onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Barcha mahsulotlarda 20% chegirma. Bugun tugaydi!"
                        maxLength={200}
                        rows={3}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    />
                    <p className="text-[10px] text-gray-400 text-right mt-1">{form.body.length}/200</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Havola (URL)
                        </label>
                        <input
                            value={form.url}
                            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                            placeholder="/discounts"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Foydalanuvchi ID (ixtiyoriy)
                        </label>
                        <input
                            value={form.userId}
                            onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                            placeholder="Barchasi (bo'sh)"
                            type="number"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSend}
                    disabled={sending || !form.title.trim() || !form.body.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                    {sending
                        ? <><Loader2 size={16} className="animate-spin" /> Yuborilmoqda...</>
                        : <><Send size={16} /> Barcha qurilmalarga yuborish</>
                    }
                </button>

                {/* Oxirgi natija */}
                {lastResult && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <CheckCircle size={16} className="text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-700">
                            {lastResult.sent} ta qurilmaga yuborildi
                            {lastResult.failed > 0 && `, ${lastResult.failed} ta muvaffaqiyatsiz`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
