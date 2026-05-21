'use client';

import { AlertTriangle, CheckCircle, MapPin, Package, Recycle, Truck } from 'lucide-react';
import {
    STATUS_COLORS, STATUS_LABELS, computeRecyclingStats, getPointName,
    type RecyclePoint, type RecycleRequest,
} from '../_lib/types';

type Props = { points: RecyclePoint[]; requests: RecycleRequest[]; onOpenRequests: () => void };

export default function DashboardTab({ points, requests, onOpenRequests }: Props) {
    const stats = computeRecyclingStats(points, requests);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Jami bazalar', value: stats.totalPoints, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Faol bazalar', value: stats.activePoints, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Jami arizalar', value: stats.totalRequests, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Yangi arizalar', value: stats.newRequests, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
                                    <Icon size={20} className={s.color} />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{s.value}</p>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-500 mb-3">Ariza statuslari</h3>
                    <div className="space-y-2">
                        {Object.entries(STATUS_LABELS).map(([key, label]) => {
                            const count = requests.filter(r => r.status === key).length;
                            const pct = stats.totalRequests > 0 ? (count / stats.totalRequests * 100) : 0;
                            const sc = STATUS_COLORS[key];
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{label}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${sc.bg.replace('100', '500')}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-500 mb-3">Umumiy hajm</h3>
                    <div className="flex items-end gap-2">
                        <p className="text-4xl font-black text-emerald-600">{(stats.totalVolume / 1000).toFixed(1)}</p>
                        <p className="text-lg font-bold text-gray-400 mb-1">tonna</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">≈ {Math.round(stats.totalVolume / 1000 * 17)} ta daraxt saqlanadi 🌳</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-500 mb-3">Topshirish usullari</h3>
                    <div className="space-y-3 mt-2">
                        {[
                            { type: 'base', label: 'Bazaga olib kelish', icon: MapPin, count: requests.filter(r => r.pickupType === 'base').length },
                            { type: 'pickup', label: 'Kuryer chiqishi', icon: Truck, count: requests.filter(r => r.pickupType === 'pickup').length },
                        ].map(item => {
                            const Icon = item.icon;
                            return (
                                <div key={item.type} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                                        <Icon size={16} className="text-gray-400" />
                                    </div>
                                    <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-500">So&apos;nggi arizalar</h3>
                    <button type="button" onClick={onOpenRequests} className="text-xs font-semibold text-blue-600 hover:underline">
                        Barchasini ko&apos;rish →
                    </button>
                </div>
                {requests.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Recycle size={16} className="text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900 truncate">{r.name}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[r.status]?.bg || 'bg-gray-100'} ${STATUS_COLORS[r.status]?.text || 'text-gray-600'}`}>
                                    {STATUS_LABELS[r.status] || r.status}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400">{r.phone} • {getPointName(points, r.pointId)}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-gray-700">{r.volume ? `${r.volume} kg` : '—'}</p>
                            <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('ru-RU')}</p>
                        </div>
                    </div>
                ))}
                {requests.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Hali arizalar yo&apos;q</p>}
            </div>
        </div>
    );
}
