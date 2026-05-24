'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/lib/store/useDriverStore';

export default function DriverLoginPage() {
    const router = useRouter();
    const setAuth = useDriverStore((s) => s.setAuth);
    const existingToken = useDriverStore((s) => s.token);

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Allaqachon kirgan bo'lsa — dashboard'ga
    useEffect(() => {
        if (existingToken) {
            router.replace('/driver/dashboard');
        }
    }, [existingToken, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!phone.trim()) { setError("Telefon raqamini kiriting"); return; }
        if (!password.trim()) { setError("Parolni kiriting"); return; }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/driver/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-pack24-source': 'app',
                },
                body: JSON.stringify({ phone: phone.trim(), password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? `Xatolik: ${res.status}`);
                return;
            }

            setAuth(data.token, data.driver);
            router.replace('/driver/dashboard');
        } catch {
            setError('Tarmoq xatosi. Internetni tekshiring.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5 py-12">

            {/* Logo area */}
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-900/40 mb-5">
                    <TruckIcon />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Pack24</h1>
                <p className="text-slate-400 text-sm mt-1">Haydovchi ilovasi</p>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm">
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
                    <h2 className="text-lg font-bold text-white mb-6">Tizimga kirish</h2>

                    <form id="driver-login-form" onSubmit={handleSubmit} className="space-y-4" noValidate>

                        {/* Phone */}
                        <div>
                            <label htmlFor="driver-phone" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                Telefon raqam
                            </label>
                            <div className="relative">
                                <PhoneIcon />
                                <input
                                    id="driver-phone"
                                    type="tel"
                                    autoComplete="tel"
                                    placeholder="+998 90 000 00 00"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="
                                        w-full bg-slate-800 border border-slate-700 rounded-xl
                                        pl-11 pr-4 py-3.5 text-white placeholder-slate-500 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                                        transition-all duration-200
                                    "
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="driver-password" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                Parol
                            </label>
                            <div className="relative">
                                <LockIcon />
                                <input
                                    id="driver-password"
                                    type={showPass ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="
                                        w-full bg-slate-800 border border-slate-700 rounded-xl
                                        pl-11 pr-12 py-3.5 text-white placeholder-slate-500 text-sm
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                                        transition-all duration-200
                                    "
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                                    aria-label={showPass ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                                >
                                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                id="driver-login-error"
                                role="alert"
                                className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl"
                            >
                                <AlertIcon />
                                <p className="text-red-400 text-sm leading-snug">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="driver-login-submit"
                            type="submit"
                            disabled={loading}
                            className="
                                w-full py-3.5 rounded-xl font-bold text-sm
                                bg-gradient-to-r from-emerald-500 to-teal-500
                                text-white shadow-lg shadow-emerald-900/30
                                hover:from-emerald-400 hover:to-teal-400
                                active:scale-[0.98]
                                disabled:opacity-50 disabled:cursor-not-allowed
                                transition-all duration-200
                            "
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Kirish...
                                </span>
                            ) : 'Kirish'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-600 text-xs mt-6">
                    Muammo bo&apos;lsa admin bilan bog&apos;laning
                </p>
            </div>
        </div>
    );
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function TruckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
            <rect width="9" height="11" x="12" y="6" rx="2" />
            <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
        </svg>
    );
}

function PhoneIcon() {
    return (
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.52 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function EyeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
    );
}

function AlertIcon() {
    return (
        <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    );
}
