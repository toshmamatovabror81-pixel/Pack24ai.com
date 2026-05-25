'use client';

import { useCartStore } from '@/lib/store/useCartStore';import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, totalAmount } = useCartStore();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCheckout = async () => {
        if (items.length === 0) return;
        setIsSubmitting(true);

        try {
            // Ideally get telegramUserId from context or storage
            // For now, we simulate or use a stored ID
            const telegramUserId = localStorage.getItem('telegramUserId') || 'guest';

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUserId,
                    items: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity
                    }))
                })
            });

            if (res.ok) {
                const order = await res.json();
                router.push(`/mobile/checkout/${order.id}`);
            } else {
                toast.error("Buyurtma yaratishda xatolik");
            }
        } catch (error) {
            console.error(error);
            toast.error("Tizim xatosi");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBag className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Savatingiz bo&apos;sh</h3>
                <p className="text-sm text-gray-500 mb-6">Mahsulotlarni tanlab, bu yerga qo&apos;shing</p>
                <Link href="/mobile/catalog">
                    <button className="bg-[#064E3B] text-white px-6 py-3 rounded-xl font-medium text-sm">
                        Katalogga o&apos;tish
                    </button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] pb-32">
            <div className="bg-white p-4 sticky top-0 z-10 border-b border-gray-50 mb-4">
                <h1 className="text-lg font-bold text-gray-900">Savat</h1>
                <p className="text-xs text-gray-500">{items.length} ta mahsulot</p>
            </div>

            <div className="px-4 space-y-3">
                {items.map((item) => (
                    <div key={item.productId} className="bg-white p-3 rounded-2xl flex gap-3 shadow-sm">
                        <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 pr-2">{item.name}</h3>
                                <button
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    onClick={() => removeFromCart(item.productId)}
                                    aria-label="O'chirish"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="mt-auto flex justify-between items-center">
                                <span className="font-bold text-[#064E3B] text-sm">{item.price.toLocaleString()} co&apos;m</span>
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button
                                        className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 text-xs active:scale-90"
                                        onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                                        title="Kamaytirish"
                                    >
                                        -
                                    </button>
                                    <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                                    <button
                                        className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 text-xs active:scale-90"
                                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                        title="Ko'paytirish"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Price Summary */}
            <div className="bg-white m-4 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mahsulotlar narxi</span>
                    <span className="font-medium">{totalAmount().toLocaleString()} co&apos;m</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Yetkazib berish</span>
                    <span className="font-medium text-purple-600">Bepul</span>
                </div>
                <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Jami</span>
                    <span className="font-bold text-xl text-[#064E3B]">{totalAmount().toLocaleString()} co&apos;m</span>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe-area-inset-bottom z-50">
                <button
                    onClick={handleCheckout}
                    disabled={isSubmitting}
                    className="w-full bg-[#5D5FEF] text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/30 active:scale-[0.98] transition-all disabled:opacity-70"
                >
                    {isSubmitting ? 'Kutilmoqda...' : (
                        <>
                            Rasmiylashtirish <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>

            {/* Bottom Nav Spacer */}
            <div className="h-16"></div>
        </div>
    );
}
