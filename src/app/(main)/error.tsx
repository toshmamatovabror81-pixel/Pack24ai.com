'use client';

import { useEffect } from 'react';
import { RefreshCcw, Home, AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Pack24 Error]:', error);
    }, [error]);

    return (
        <div className="min-h-[75vh] flex items-center justify-center px-4 bg-gradient-to-b from-white to-gray-50">
            <div className="max-w-md w-full text-center">

                {/* Icon */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center shadow-sm">
                            <AlertTriangle className="w-12 h-12 text-red-400" strokeWidth={1.5} />
                        </div>
                        {/* Error code badge */}
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ERR
                        </span>
                    </div>
                </div>

                {/* Text */}
                <h1 className="text-2xl font-extrabold text-gray-900 mb-3">
                    Xatolik yuz berdi
                </h1>
                <p className="text-gray-500 text-sm mb-2 leading-relaxed">
                    Sahifani yuklashda texnik muammo bo&apos;ldi.<br />
                    Bir necha daqiqa kutib, qayta urinib ko&apos;ring.
                </p>

                {/* Error digest */}
                {error?.digest && (
                    <div className="mt-3 mb-6 inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                        <span className="text-[11px] text-gray-400 font-mono">
                            {error.digest}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <button
                        onClick={reset}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-100 hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <RefreshCcw size={15} />
                        Qayta urinish
                    </button>
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-xl text-sm transition-colors hover:bg-gray-50"
                    >
                        <Home size={15} />
                        Bosh sahifa
                    </Link>
                </div>

                {/* Help links */}
                <div className="mt-10 pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-3">Muammo davom etsa:</p>
                    <div className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                        <Link href="/contacts" className="flex items-center gap-1 hover:underline">
                            Qo&apos;llab-quvvatlash <ChevronRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
