'use client';

import { useEffect, useState, use } from 'react';import { ArrowLeft, MapPin, Phone, Package, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetch(`/api/orders/${id}`)
            .then(res => res.json())
            .then(data => setOrder(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading || !order) return <div className="min-h-screen bg-white flex items-center justify-center">Yuklanmoqda...</div>;

    const steps = [
        { id: 'new', label: 'Qabul qilindi', icon: Check },
        { id: 'processing', label: 'Tayyorlanmoqda', icon: Package },
        { id: 'shipping', label: 'Yo\'lda', icon: MapPin },
        { id: 'delivered', label: 'Yetkazildi', icon: Check },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);
    // Simple logic: if status not found (e.g. cancelled), treat as -1

    return (
        <div className="min-h-screen bg-[#F9FAFB] pb-10">
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Orqaga">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">Buyurtma #{order.id}</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Status Timeline */}
                <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <h2 className="font-bold text-gray-900 mb-4">Buyurtma holati</h2>
                    <div className="relative pl-6 space-y-6 before:absolute before:left-[21px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                        {steps.map((step, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            const isActive = idx === currentStepIndex;
                            return (
                                <div key={step.id} className="relative">
                                    <div className={`absolute -left-[33px] w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white z-10 ${isCompleted ? 'border-[#5D5FEF] text-[#5D5FEF]' : 'border-gray-200 text-gray-300'}`}>
                                        <div className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-[#5D5FEF]' : 'bg-transparent'}`} />
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</h3>
                                        {isActive && <p className="text-xs text-[#5D5FEF] mt-0.5">Hozirgi bosqich</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Details */}
                <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                            <span className="text-xs text-gray-500 block">Yetkazib berish manzili</span>
                            <span className="text-sm font-medium text-gray-900">{order.shippingAddress}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                            <span className="text-xs text-gray-500 block">Telefon raqam</span>
                            <span className="text-sm font-medium text-gray-900">{order.contactPhone}</span>
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <h2 className="font-bold text-gray-900 mb-3">Mahsulotlar</h2>
                    <div className="space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                                    <img src={item.product?.image} alt={item.product?.name || 'Item'} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{item.product?.name}</h4>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-xs text-gray-500">{item.quantity} x {item.price.toLocaleString()}</span>
                                        <span className="text-sm font-bold text-gray-900">{(item.quantity * item.price).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                            <span className="font-medium">Jami</span>
                            <span className="font-bold text-[#064E3B] text-lg">{order.totalAmount.toLocaleString()} so&apos;m</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
