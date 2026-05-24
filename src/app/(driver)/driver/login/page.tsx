'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/lib/store/useDriverStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type LoginMethod = 'phone' | 'email' | 'telegram';
type PageMode = 'login' | 'reset';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriverLoginPage() {
    const router = useRouter();
    const setAuth = useDriverStore((s) => s.setAuth);
    const existingToken = useDriverStore((s) => s.token);

    const [mode, setMode] = useState<PageMode>('login');

    useEffect(() => {
        if (existingToken) router.replace('/driver/dashboard');
    }, [existingToken, router]);

    if (mode === 'reset') {
        return <ResetPasswordView onBack={() => setMode('login')} />;
    }

    return <LoginView onForgot={() => setMode('reset')} setAuth={setAuth} router={router} />;
}

// ─── Login View ───────────────────────────────────────────────────────────────

function LoginView({
    onForgot,
    setAuth,
    router,
}: {
    onForgot: () => void;
    setAuth: ReturnType<typeof useDriverStore.getState>['setAuth'];
    router: ReturnType<typeof useRouter>;
}) {
    const [method, setMethod] = useState<LoginMethod>('phone');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Usul o'zgarganda inputni tozalash
    const switchMethod = (m: LoginMethod) => {
        setMethod(m);
        setIdentifier('');
        setError(null);
        setSuccess(null);
    };

    const METHOD_CONFIG = {
        phone: {
            label: 'Telefon',
            placeholder: '+998 90 000 00 00',
            inputType: 'tel',
            autoComplete: 'tel',
            icon: <PhoneIcon />,
        },
        email: {
            label: 'Email',
            placeholder: 'haydovchi@mail.com',
            inputType: 'email',
            autoComplete: 'email',
            icon: <MailIcon />,
        },
        telegram: {
            label: 'Telegram ID',
            placeholder: '123456789  (botdan olingan)',
            inputType: 'text',
            autoComplete: 'off',
            icon: <TelegramIcon />,
        },
    };

    const cfg = METHOD_CONFIG[method];

    const validate = () => {
        if (!identifier.trim()) {
            setError(`${cfg.label}ni kiriting`);
            return false;
        }
        if (!password.trim()) {
            setError('Parolni kiriting');
            return false;
        }
        if (method === 'telegram' && !/^\d+$/.test(identifier.trim())) {
            setError('Telegram ID faqat raqamlardan iborat bo\'lishi kerak');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (!validate()) return;

        setLoading(true);
        try {
            const body: Record<string, string> = { password };
            if (method === 'phone') body.phone = identifier.trim();
            if (method === 'email') body.email = identifier.trim();
            if (method === 'telegram') body.telegramId = identifier.trim();

            const res = await fetch('/api/auth/driver/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-pack24-source': 'app',
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? `Xatolik: ${res.status}`);
                return;
            }

            setSuccess('Muvaffaqiyatli kirdingiz!');
            setTimeout(() => {
                setAuth(data.token, data.driver);
                router.replace('/driver/dashboard');
            }, 500);
        } catch {
            setError('Tarmoq xatosi. Internetni tekshiring.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5 py-10">

            {/* Logo */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-900/40 mb-4">
                    <TruckIcon />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Pack24</h1>
                <p className="text-slate-400 text-sm mt-1">Haydovchi ilovasi</p>
            </div>

            <div className="w-full max-w-sm space-y-4">

                {/* Card */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
                    <h2 className="text-lg font-bold text-white mb-5">Tizimga kirish</h2>

                    {/* Method tabs */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-800 rounded-2xl p-1 mb-5">
                        {(['phone', 'email', 'telegram'] as const).map((m) => (
                            <button
                                key={m}
                                id={`login-tab-${m}`}
                                type="button"
                                onClick={() => switchMethod(m)}
                                className={`
                                    flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
                                    text-[10px] font-bold transition-all duration-200
                                    ${method === m
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }
                                `}
                            >
                                <MethodTabIcon method={m} active={method === m} />
                                {m === 'phone' ? 'Telefon' : m === 'email' ? 'Email' : 'Telegram'}
                            </button>
                        ))}
                    </div>

                    {/* Telegram hint */}
                    {method === 'telegram' && (
                        <div className="flex items-start gap-2.5 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl mb-4">
                            <InfoIcon />
                            <p className="text-sky-400 text-xs leading-relaxed">
                                <span className="font-bold">@pack24MX_bot</span> da ro&apos;yxatdan o&apos;tgandan so&apos;ng sizga <span className="font-bold">Telegram ID</span> va parol yuboriladi.
                            </p>
                        </div>
                    )}

                    <form id="driver-login-form" onSubmit={handleSubmit} className="space-y-4" noValidate>

                        {/* Identifier input */}
                        <div>
                            <label htmlFor="driver-identifier" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                {cfg.label}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                                    {cfg.icon}
                                </span>
                                <input
                                    id="driver-identifier"
                                    type={cfg.inputType}
                                    autoComplete={cfg.autoComplete}
                                    placeholder={cfg.placeholder}
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="driver-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    Parol
                                </label>
                                <button
                                    type="button"
                                    id="forgot-password-btn"
                                    onClick={onForgot}
                                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                                >
                                    Parolni unutdim?
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                                    <LockIcon />
                                </span>
                                <input
                                    id="driver-password"
                                    type={showPass ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                                    aria-label={showPass ? 'Yashirish' : 'Ko\'rsatish'}
                                >
                                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {/* Error / Success */}
                        {error && (
                            <div id="driver-login-error" role="alert" className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <AlertIcon color="red" />
                                <p className="text-red-400 text-sm leading-snug">{error}</p>
                            </div>
                        )}
                        {success && (
                            <div id="driver-login-success" role="status" className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <CheckIcon />
                                <p className="text-emerald-400 text-sm">{success}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="driver-login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Tekshirilmoqda...
                                </span>
                            ) : 'Kirish'}
                        </button>
                    </form>
                </div>

                {/* Register hint */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
                    <p className="text-slate-400 text-xs">
                        Ro&apos;yxatdan o&apos;tmagansizmi?
                    </p>
                    <p className="text-slate-300 text-xs mt-1">
                        <span className="text-emerald-400 font-bold">@pack24MX_bot</span> ga yozing → haydovchi sifatida ro&apos;yxatdan o&apos;ting
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Reset Password View ──────────────────────────────────────────────────────

type ResetStep = 'identify' | 'sent';

function ResetPasswordView({ onBack }: { onBack: () => void }) {
    const [step, setStep] = useState<ResetStep>('identify');
    const [resetMethod, setResetMethod] = useState<'phone' | 'email'>('phone');
    const [identifier, setIdentifier] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!identifier.trim()) {
            setError(resetMethod === 'phone' ? 'Telefon raqamini kiriting' : 'Email manzilini kiriting');
            return;
        }
        if (!newPassword.trim() || newPassword.length < 6) {
            setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Parollar mos kelmadi');
            return;
        }

        setLoading(true);
        try {
            const body: Record<string, string> = { newPassword };
            if (resetMethod === 'phone') body.phone = identifier.trim();
            if (resetMethod === 'email') body.email = identifier.trim();

            const res = await fetch('/api/auth/driver/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-pack24-source': 'app',
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? 'Xatolik yuz berdi');
                return;
            }

            setSuccess(data.message ?? 'Parol muvaffaqiyatli yangilandi!');
            setStep('sent');
        } catch {
            setError('Tarmoq xatosi. Internetni tekshiring.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5 py-10">

            {/* Logo */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl shadow-amber-900/40 mb-4">
                    <KeyIcon />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Parolni tiklash</h1>
                <p className="text-slate-400 text-sm mt-1">Pack24 Driver</p>
            </div>

            <div className="w-full max-w-sm">
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">

                    {step === 'identify' ? (
                        <>
                            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                                Ro&apos;yxatdan o&apos;tgan <span className="text-white font-semibold">telefon</span> yoki <span className="text-white font-semibold">email</span> orqali yangi parol o&apos;rnating.
                            </p>

                            {/* Method switch */}
                            <div className="grid grid-cols-2 gap-1 bg-slate-800 rounded-2xl p-1 mb-5">
                                {(['phone', 'email'] as const).map((m) => (
                                    <button
                                        key={m}
                                        id={`reset-tab-${m}`}
                                        type="button"
                                        onClick={() => { setResetMethod(m); setIdentifier(''); setError(null); }}
                                        className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${resetMethod === m ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/30' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {m === 'phone' ? '📞 Telefon' : '✉️ Email'}
                                    </button>
                                ))}
                            </div>

                            <form id="driver-reset-form" onSubmit={handleReset} className="space-y-4" noValidate>
                                {/* Identifier */}
                                <div>
                                    <label htmlFor="reset-identifier" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                        {resetMethod === 'phone' ? 'Telefon raqam' : 'Email manzil'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                                            {resetMethod === 'phone' ? <PhoneIcon /> : <MailIcon />}
                                        </span>
                                        <input
                                            id="reset-identifier"
                                            type={resetMethod === 'phone' ? 'tel' : 'email'}
                                            placeholder={resetMethod === 'phone' ? '+998 90 000 00 00' : 'misol@mail.com'}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-200"
                                        />
                                    </div>
                                </div>

                                {/* New password */}
                                <div>
                                    <label htmlFor="reset-new-password" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                        Yangi parol
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                                            <LockIcon />
                                        </span>
                                        <input
                                            id="reset-new-password"
                                            type={showPass ? 'text' : 'password'}
                                            placeholder="Kamida 6 ta belgi"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-200"
                                        />
                                        <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 transition-colors">
                                            {showPass ? <EyeOffIcon /> : <EyeIcon />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm password */}
                                <div>
                                    <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                        Parolni tasdiqlang
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500">
                                            <LockIcon />
                                        </span>
                                        <input
                                            id="reset-confirm-password"
                                            type={showPass ? 'text' : 'password'}
                                            placeholder="Parolni qaytaring"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-200"
                                        />
                                    </div>
                                    {/* Password strength */}
                                    {newPassword.length > 0 && (
                                        <div className="mt-2 flex gap-1">
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                    newPassword.length > i * 2 + 2
                                                        ? newPassword.length >= 10 ? 'bg-emerald-500'
                                                            : newPassword.length >= 6 ? 'bg-amber-500'
                                                            : 'bg-red-500'
                                                        : 'bg-slate-700'
                                                }`} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div id="reset-error" role="alert" className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                                        <AlertIcon color="red" />
                                        <p className="text-red-400 text-sm leading-snug">{error}</p>
                                    </div>
                                )}

                                <button
                                    id="reset-submit"
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-900/30 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saqlanmoqda...
                                        </span>
                                    ) : 'Parolni yangilash'}
                                </button>
                            </form>
                        </>
                    ) : (
                        /* Success state */
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                                <CheckCircleIcon />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Parol yangilandi!</h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-6">{success}</p>
                            <button
                                id="reset-go-login"
                                onClick={onBack}
                                className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98] transition-all duration-200"
                            >
                                Kirish sahifasiga qaytish
                            </button>
                        </div>
                    )}
                </div>

                {/* Back button */}
                {step === 'identify' && (
                    <button
                        id="reset-back-btn"
                        onClick={onBack}
                        className="w-full mt-4 py-3 text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        <BackArrowIcon />
                        Orqaga qaytish
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function MethodTabIcon({ method, active }: { method: LoginMethod; active: boolean }) {
    const cls = `w-4 h-4 ${active ? 'text-white' : 'text-slate-500'}`;
    if (method === 'phone') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.52 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
    if (method === 'email') return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;
    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.9-.992 2.337.068 3.637.46.581.034-.29 8.361 4.049-.061.028 2.429 1.032 3.714 1.586 1.286.553 2.439.941 3.054 1.066 1.167.235 2.354-.485 2.354-1.807V5.577a2.242 2.242 0 0 0-1.874-2.144z" /></svg>;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function TruckIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect width="9" height="11" x="12" y="6" rx="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>;
}
function KeyIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></svg>;
}
function PhoneIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.52 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function MailIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;
}
function TelegramIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.9-.992 2.337.068 3.637.46.581.034-.29 8.361 4.049-.061.028 2.429 1.032 3.714 1.586 1.286.553 2.439.941 3.054 1.066 1.167.235 2.354-.485 2.354-1.807V5.577a2.242 2.242 0 0 0-1.874-2.144z" /></svg>;
}
function LockIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
function EyeIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function EyeOffIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>;
}
function AlertIcon({ color }: { color: 'red' | 'amber' }) {
    const cls = color === 'red' ? 'text-red-400' : 'text-amber-400';
    return <svg className={`w-4 h-4 ${cls} shrink-0 mt-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>;
}
function CheckIcon() {
    return <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function CheckCircleIcon() {
    return <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function InfoIcon() {
    return <svg className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
}
function BackArrowIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
}
