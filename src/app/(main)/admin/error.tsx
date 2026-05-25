'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw, LayoutDashboard, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        console.error('[Pack24 Admin Error]:', error);
    }, [error]);

    const copyError = () => {
        const text = `Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\nTime: ${new Date().toISOString()}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="min-h-[60vh] flex items-center justify-center bg-[#f8fafc] p-6">
            <div className="max-w-md w-full">
                {/* Card */}
                <div className="bg-white border border-red-100 rounded-2xl p-8 shadow-sm text-center">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl flex items-center justify-center shadow-sm">
                            <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
                        </div>
                    </div>

                    <h1 className="text-lg font-extrabold text-slate-900 mb-2">
                        Xatolik yuz berdi
                    </h1>
                    <p className="text-slate-500 text-sm mb-5 leading-relaxed">
                        Admin panel bu sahifani yuklay olmadi.<br />
                        Qayta urilib ko&apos;ring yoki dasturchilar bilan bog&apos;laning.
                    </p>

                    {/* Error info */}
                    {(error?.message || error?.digest) && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-5 text-left relative">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    {error.message && (
                                        <p className="text-[11px] text-slate-500 font-mono truncate">
                                            {error.message}
                                        </p>
                                    )}
                                    {error.digest && (
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            #{error.digest}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={copyError}
                                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                                    title="Xatoni nusxalash"
                                >
                                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={reset}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-100 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <RefreshCcw size={14} />
                            Qayta yuklash
                        </button>
                        <Link
                            href="/admin/dashboard"
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                        >
                            <LayoutDashboard size={14} />
                            Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
