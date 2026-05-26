
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { Suspense } from 'react';

function AdminLoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('from') || '/admin/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push(redirectTo);
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Login yoki parol noto'g'ri");
            }
        } catch {
            setError("Tarmoq xatosi. Qayta urinib ko'ring.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">
                        PACK24 <span className="text-blue-600">AI</span>
                    </h1>
                    <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Admin Panel</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="admin-login" className="block text-sm font-bold text-gray-700 mb-2 uppercase">Login</label>
                        <input
                            id="admin-login"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="admin"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div>
                        <label htmlFor="admin-password" className="block text-sm font-bold text-gray-700 mb-2 uppercase">Parol</label>
                        <div className="relative">
                            <input
                                id="admin-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="••••••"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-brand-dark text-white font-bold py-4 rounded-lg hover:bg-[#1e4b75] disabled:opacity-60 disabled:cursor-not-allowed transition-colors uppercase tracking-wide shadow-lg shadow-blue-900/20"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Tekshirilmoqda...
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                Kirish
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function AdminLogin() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AdminLoginForm />
        </Suspense>
    );
}
