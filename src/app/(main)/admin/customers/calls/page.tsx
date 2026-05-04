'use client';

import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Search, SlidersHorizontal, Mic, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// --- Mock Call Log Data ---

const callLogs = [
    { id: 1, type: 'incoming', name: 'Aziz Rakhimov', phone: '+998 90 123 45 67', duration: '02:14', time: '14:30', status: 'answered', rating: 4, recording: true },
    { id: 2, type: 'outgoing', name: 'Malika Karimova', phone: '+998 93 987 65 43', duration: '00:45', time: '13:15', status: 'answered', rating: 5, recording: true },
    { id: 3, type: 'incoming', name: 'Unknown', phone: '+998 99 000 00 00', duration: '00:00', time: '12:00', status: 'missed', rating: 0, recording: false },
    { id: 4, type: 'incoming', name: 'Sofia Kim', phone: '+998 90 777 88 99', duration: '05:30', time: '10:45', status: 'answered', rating: 5, recording: true },
    { id: 5, type: 'outgoing', name: 'Bekzod Aliyev', phone: '+998 99 555 44 33', duration: '01:10', time: '09:30', status: 'answered', rating: 3, recording: true },
];

export default function CallCenterPage() {
    return (
        <div className="space-y-6">

            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Call Center (Aloqa Markazi)</h1>
                    <p className="text-slate-500 text-sm mt-1">Bugungi ko'rsatkichlar: 24 ta qo'ng'iroq, 95% javob berish darajasi</p>
                </div>
                <div className="bg-emerald-500 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-emerald-500/20">
                    <div>
                        <p className="text-emerald-100 text-xs font-bold uppercase">Online Operatorlar</p>
                        <h3 className="text-2xl font-black">4 / 6</h3>
                    </div>
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Mic size={20} />
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Qo'ng'iroqlar tarixidan qidirish..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <PhoneMissed className="w-4 h-4 mr-2 text-red-500" />
                        O'tkazib yuborilgan
                    </Button>
                    <Button variant="outline">
                        <SlidersHorizontal className="w-4 h-4 mr-2" />
                        Filtr
                    </Button>
                </div>
            </div>

            {/* Call Log List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Holat</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mijoz</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vaqt & Davomiylik</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Yozuv (Audio)</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Baho</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {callLogs.map((call) => (
                            <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${call.status === 'missed' ? 'bg-red-50 text-red-500' :
                                            call.type === 'incoming' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'
                                            }`}>
                                            {call.status === 'missed' ? <PhoneMissed size={18} /> :
                                                call.type === 'incoming' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800">{call.name}</span>
                                        <span className="text-xs text-slate-400 font-mono">{call.phone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-700">{call.time}</span>
                                        <span className="text-xs text-slate-400">{call.duration}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {call.recording ? (
                                        <div className="flex items-center justify-center">
                                            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-600 rounded-full transition-colors text-xs font-bold text-slate-600 group">
                                                <Play size={12} className="fill-current" />
                                                Play
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {call.rating > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-bold text-slate-700">{call.rating}.0</span>
                                            <Star size={14} className="fill-amber-400 text-amber-400" />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
