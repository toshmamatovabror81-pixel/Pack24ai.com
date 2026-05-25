'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';import { CheckCircle, XCircle, Banknote, CreditCard, RefreshCw } from 'lucide-react';

interface Driver {
    id: number;
    name: string;
    phone: string;
}

interface Payout {
    id: number;
    driverId: number;
    amount: number;
    description: string;
    status: 'pending' | 'completed' | 'rejected';
    createdAt: string;
    driver: Driver;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Kutilmoqda',
    completed: 'Bajarildi',
    rejected: 'Rad etildi',
};

export default function PayoutsTab() {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null);

    const fetchPayouts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/finance/payouts');
            if (res.ok) {
                setPayouts(await res.json());
            } else {
                toast.error('To\'lovlarni yuklashda xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

    const handleUpdateStatus = async (id: number, status: 'completed' | 'rejected') => {
        if (!confirm(`Haqiqatan ham bu arizani "${STATUS_LABELS[status]}" deb belgilamoqchimisiz?`)) return;
        
        setProcessing(id);
        try {
            const res = await fetch(`/api/admin/finance/payouts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast.success('Ariza holati yangilandi');
                fetchPayouts();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Xatolik');
            }
        } catch {
            toast.error('Server xatosi');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 font-medium">To{`'`}lovlar yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    const pendingCount = payouts.filter(p => p.status === 'pending').length;
    const _completedCount = payouts.filter(p => p.status === 'completed').length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    💳 Haydovchilar to{`'`}lovlari
                    <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {pendingCount} ta kutilayotgan
                    </span>
                </h2>
                <button 
                    onClick={fetchPayouts}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                >
                    <RefreshCw size={14} /> Yangilash
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {payouts.length === 0 ? (
                    <div className="text-center py-20">
                        <Banknote size={40} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 font-medium">Hali to{`'`}lov arizalari yo{`'`}q</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Ariza ID</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Sana</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Haydovchi</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Tafsilot (Karta)</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Summa</th>
                                    <th className="px-5 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Holati</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Harakatlar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payouts.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-4 text-sm font-bold text-gray-400">#{p.id}</td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-gray-900">{new Date(p.createdAt).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(p.createdAt).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-gray-900">{p.driver.name}</p>
                                            <p className="text-[10px] text-gray-500">{p.driver.phone}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <CreditCard size={14} className="text-blue-500" />
                                                <span className="text-xs text-gray-600">{p.description}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-sm font-black text-gray-900">{p.amount.toLocaleString()} so{`'`}m</span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[p.status]}`}>
                                                {STATUS_LABELS[p.status]}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            {p.status === 'pending' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        disabled={processing === p.id}
                                                        onClick={() => handleUpdateStatus(p.id, 'completed')}
                                                        className="flex items-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        <CheckCircle size={14} /> To{`'`}landi
                                                    </button>
                                                    <button
                                                        disabled={processing === p.id}
                                                        onClick={() => handleUpdateStatus(p.id, 'rejected')}
                                                        className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        <XCircle size={14} /> Rad
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
