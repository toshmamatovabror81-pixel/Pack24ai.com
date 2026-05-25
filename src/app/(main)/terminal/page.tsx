'use client';

import Link from 'next/link';
import { User, Printer, Box, Layers, LogIn } from 'lucide-react';

export default function TerminalLoginPage() {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                        <Box className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Pack24 Terminal</h1>
                </div>
                <p className="text-slate-400">Ishni boshlash uchun o&apos;z seximizni tanlang</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {/* Gofra Sexi */}
                <Link href="/terminal/gofra" className="group relative overflow-hidden bg-slate-800 hover:bg-emerald-600 transition-all p-8 rounded-3xl border border-slate-700 hover:border-emerald-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Layers size={100} />
                    </div>
                    <div className="flex flex-col items-center text-center relative z-10">
                        <div className="w-16 h-16 bg-slate-700 group-hover:bg-white/20 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <Layers className="text-emerald-400 group-hover:text-white w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Gofra Sexi</h2>
                        <p className="text-sm text-slate-400 group-hover:text-emerald-100">List tayyorlash va kesish</p>
                    </div>
                </Link>

                {/* Pechat Sexi */}
                <Link href="/terminal/pechat" className="group relative overflow-hidden bg-slate-800 hover:bg-blue-600 transition-all p-8 rounded-3xl border border-slate-700 hover:border-blue-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Printer size={100} />
                    </div>
                    <div className="flex flex-col items-center text-center relative z-10">
                        <div className="w-16 h-16 bg-slate-700 group-hover:bg-white/20 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <Printer className="text-blue-400 group-hover:text-white w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Pechat & Dizayn</h2>
                        <p className="text-sm text-slate-400 group-hover:text-blue-100">Chop etish va bo&apos;yoq</p>
                    </div>
                </Link>

                {/* Yig'uv Sexi */}
                <Link href="/terminal/yiguv" className="group relative overflow-hidden bg-slate-800 hover:bg-amber-600 transition-all p-8 rounded-3xl border border-slate-700 hover:border-amber-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Box size={100} />
                    </div>
                    <div className="flex flex-col items-center text-center relative z-10">
                        <div className="w-16 h-16 bg-slate-700 group-hover:bg-white/20 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <Box className="text-amber-400 group-hover:text-white w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Yig&apos;uv & Qadoqlash</h2>
                        <p className="text-sm text-slate-400 group-hover:text-amber-100">Kleylash va bog&apos;lash</p>
                    </div>
                </Link>

                {/* Admin Mode */}
                <Link href="/admin/login" className="group relative overflow-hidden bg-slate-800 hover:bg-slate-700 transition-all p-8 rounded-3xl border border-slate-700 hover:border-slate-500">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <User size={100} />
                    </div>
                    <div className="flex flex-col items-center text-center relative z-10">
                        <div className="w-16 h-16 bg-slate-700 group-hover:bg-white/10 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <LogIn className="text-slate-400 group-hover:text-white w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Admin Panel</h2>
                        <p className="text-sm text-slate-400">Boshqaruvga qaytish</p>
                    </div>
                </Link>
            </div>

            <div className="mt-12 text-center text-slate-500 text-xs">
                System v2.4 (Beta) • Antigravity AI Project
            </div>
        </div>
    );
}
