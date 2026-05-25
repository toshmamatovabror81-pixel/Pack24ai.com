'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';import { ArrowLeft, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<UnsafeAny[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Mock stored ID
        const userId = localStorage.getItem('telegramUserId') || 'guest';
        fetch(`/api/orders?telegramUserId=${userId}`)
            .then(res => res.json())
            .then(data => setOrders(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700';
            case 'processing': return 'bg-yellow-100 text-yellow-700';
            case 'shipping': return 'bg-indigo-100 text-indigo-700';
            case 'delivered': return 'bg-emerald-100 text-emerald-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'new': return 'Yangi';
            case 'processing': return 'Jarayonda';
            case 'shipping': return 'Yo\'lda';
            case 'delivered': return 'Yetkazildi';
            case 'cancelled': return 'Bekor qilindi';
            default: return 'Qoralama';
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <Link href="/mobile/profile" className="p-1 -ml-1">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <h1 className="text-lg font-bold text-gray-900">Buyurtmalarim</h1>
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <div>Yuklanmoqda...</div>
                ) : orders.filter(o => o.status !== 'draft').length === 0 ? (
                    <div className="text-center py-10 text-gray-400">Buyurtmalar yo&apos;q</div>
                ) : (
                    orders.filter(o => o.status !== 'draft').map(order => (
                        <div
                            key={order.id}
                            onClick={() => router.push(`/mobile/orders/${order.id}`)}
                            className="bg-white p-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="text-xs text-gray-400 block mb-1">
                                        Buyurtma #{order.id}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${getStatusColor(order.status)}`}>
                                        {getStatusText(order.status)}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(order.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-2">
                                        {order.items.slice(0, 3).map((item: UnsafeAny) => (
                                            <div key={item.id} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white overflow-hidden">
                                                <Image src={item.product?.image} alt={item.product?.name || 'Mahsulot'} className="w-full h-full object-cover" width={300} height={300} />
                                            </div>
                                        ))}
                                    </div>
                                    {order.items.length > 3 && (
                                        <span className="text-xs text-gray-400">+{order.items.length - 3}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#064E3B]">{order.totalAmount.toLocaleString()} so&apos;m</span>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
