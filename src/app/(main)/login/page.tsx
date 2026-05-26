'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Loader2, Send, KeyRound, Lock, Phone, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type LoginMode = 'telegram' | 'password';
type TgStep = 'phone' | 'otp';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('from') || '/profile';
    const referralCode = searchParams.get('ref');

    const [mode, setMode] = useState<LoginMode>('telegram');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [tgStep, setTgStep] = useState<TgStep>('phone');
    const [countdown, setCountdown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // ── Telegram OTP: kod yuborish ────────────────────────────────────────
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            const data = await res.json();

            if (!res.ok || data.noTelegram) {
                toast.error(
                    data.error || "Xatolik yuz berdi",
                    { duration: 8000 }
                );
                return;
            }

            toast.success("Kod Telegramga yuborildi! ✅");
            setTgStep('otp');
            // 5 daqiqa countdown
            let secs = data.expiresIn || 300;
            setCountdown(secs);
            const timer = setInterval(() => {
                secs--;
                setCountdown(secs);
                if (secs <= 0) clearInterval(timer);
            }, 1000);
        } catch {
            toast.error("Server bilan bog'lanishda xatolik");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Telegram OTP: kodni tekshirish va kirish ─────────────────────────
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim()) return;
        setIsLoading(true);
        try {
            const result = await signIn('telegram-otp', {
                phone: phone.trim(),
                otp: otp.trim(),
                redirect: false,
            });
            if (result?.ok) {
                toast.success("Xush kelibsiz! 🎉");
                router.push(redirectTo);
            } else {
                toast.error("Noto'g'ri kod yoki muddati tugagan");
                setOtp('');
            }
        } catch {
            toast.error("Server xatosi");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Parol bilan kirish ────────────────────────────────────────────────
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await signIn('credentials', {
                phone: phone.trim(),
                password,
                redirect: false,
            });
            if (result?.ok) {
                toast.success("Xush kelibsiz!");
                router.push(redirectTo);
            } else {
                toast.error("Telefon yoki parol noto'g'ri");
            }
        } catch {
            toast.error("Tizim xatosi");
        } finally {
            setIsLoading(false);
        }
    };

    const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-[#F9FAFB] p-4">
            <Card className="w-full max-w-md p-8 shadow-xl">

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-brand-green flex items-center justify-center mx-auto mb-3">
                        <Lock size={24} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Kirish</h1>
                    <p className="text-gray-500 text-sm mt-1">Pack24 hisobingizga kiring</p>
                </div>

                {/* Mode toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => { setMode('telegram'); setTgStep('phone'); setOtp(''); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'telegram'
                                ? 'bg-white shadow text-brand-green'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <MessageCircle size={15} />
                        Telegram kodi
                    </button>
                    <button
                        onClick={() => setMode('password')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'password'
                                ? 'bg-white shadow text-brand-green'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <KeyRound size={15} />
                        Parol bilan
                    </button>
                </div>

                {/* ── TELEGRAM OTP MODE ──────────────────────────────── */}
                {mode === 'telegram' && (
                    <>
                        {tgStep === 'phone' && (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                                    <p className="font-semibold mb-1">📱 Telegram orqali kirish</p>
                                    <p className="text-blue-600 text-xs">
                                        Telefon raqamingizni kiriting — 6 raqamli kod
                                        <strong> @Pack24AI_bot</strong> orqali Telegramga yuboriladi.
                                    </p>
                                </div>

                                <Input
                                    label="Telefon raqami"
                                    type="tel"
                                    placeholder="+998 90 123 45 67"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />

                                <Button
                                    type="submit"
                                    className="w-full bg-brand-green hover:bg-[#053d2e] h-11 text-base gap-2"
                                    disabled={isLoading || !phone.trim()}
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Kodni Telegramga yuborish
                                </Button>
                            </form>
                        )}

                        {tgStep === 'otp' && (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                    <p className="text-sm font-semibold text-green-700 mb-1">✅ Kod yuborildi!</p>
                                    <p className="text-xs text-green-600">
                                        <strong>@Pack24AI_bot</strong> dan kelgan 6 raqamli kodni kiriting.
                                    </p>
                                    {countdown > 0 && (
                                        <p className="text-xs text-green-600 mt-1">
                                            ⏱ Amal qilish vaqti: <strong>{formatCountdown(countdown)}</strong>
                                        </p>
                                    )}
                                    {countdown <= 0 && (
                                        <p className="text-xs text-red-500 mt-1">❌ Kod muddati tugadi</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Telegram kodi
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="• • • • • •"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full text-center text-3xl font-mono font-bold tracking-[0.4em] border-2 border-gray-200 focus:border-brand-green rounded-xl px-4 py-4 outline-none transition-colors"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-brand-green hover:bg-[#053d2e] h-11 text-base gap-2"
                                    disabled={isLoading || otp.length !== 6 || countdown <= 0}
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                                    Tasdiqlash va Kirish
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { setTgStep('phone'); setOtp(''); setCountdown(0); }}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
                                >
                                    ← Telefon raqamni o&apos;zgartirish
                                </button>
                            </form>
                        )}
                    </>
                )}

                {/* ── PAROL MODE ─────────────────────────────────────── */}
                {mode === 'password' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                            💡 <strong>@Pack24AI_bot</strong> orqali ro&apos;yxatdan o&apos;tganlar{' '}
                            <strong>5 raqamli Telegram kodini</strong> parol sifatida kiriting.
                        </div>
                        <Input
                            label="Telefon raqami"
                            type="tel"
                            placeholder="+998 90 123 45 67"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                        <Input
                            label="Parol yoki 5 raqamli Telegram kodi"
                            type="password"
                            placeholder="••••• yoki ••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Button
                            type="submit"
                            className="w-full bg-brand-green hover:bg-[#053d2e] h-11 text-base"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Kirish
                        </Button>
                    </form>
                )}

                {/* Footer */}
                <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
                    <div className="text-center text-sm">
                        <span className="text-gray-500">Hisobingiz yo&apos;qmi? </span>
                        <Link
                            href={referralCode ? `/register?ref=${encodeURIComponent(referralCode)}` : '/register'}
                            className="text-brand-green font-semibold hover:underline"
                        >
                            Ro&apos;yxatdan o&apos;tish
                        </Link>
                    </div>
                    <div className="text-center">
                        <a
                            href="https://t.me/Pack24AI_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline"
                        >
                            <Phone size={12} />
                            Telegram orqali ro&apos;yxatdan o&apos;tish → @Pack24AI_bot
                        </a>
                    </div>
                </div>
            </Card>
        </div>
    );
}
