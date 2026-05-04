'use client';

import { Phone, X, Box } from 'lucide-react';

interface IncomingCall {
    name: string;
    phone: string;
    avatar: string;
    lastOrder: string;
}

interface AdminCallPopupProps {
    call: IncomingCall;
    onAnswer: () => void;
    onDecline: () => void;
}

export default function AdminCallPopup({ call, onAnswer, onDecline }: AdminCallPopupProps) {
    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-slate-700 w-80">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider">Kiruvchi qo&apos;ng&apos;iroq...</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-lg">
                        {call.avatar}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">{call.name}</h3>
                        <p className="text-slate-400 text-sm mt-0.5">{call.phone}</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-3 mb-6 border border-slate-700/50">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Oxirgi xarid:</p>
                    <div className="flex items-center gap-2">
                        <Box size={14} className="text-blue-400" />
                        <span className="text-sm font-medium text-slate-200">{call.lastOrder}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onDecline}
                        className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl font-semibold transition-colors border border-red-500/20"
                    >
                        <X size={20} />
                        Rad etish
                    </button>
                    <button
                        onClick={onAnswer}
                        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02]"
                    >
                        <Phone size={20} />
                        Qabul qilish
                    </button>
                </div>
            </div>
        </div>
    );
}
