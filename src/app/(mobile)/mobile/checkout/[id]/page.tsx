'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, CreditCard, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: orderId } = use(params);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        address: '',
        location: '',
        phone: '+998',
        paymentMethod: 'cash'
    });

    // Fetch initial data if needed (e.g. user profile phone)
    useEffect(() => {
        // Mock default phone
        setFormData(prev => ({ ...prev, phone: '+998 90 123 45 67' }));
    }, []);

    const updateOrder = async (updates: any) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error();
            return true;
        } catch (error) {
            toast.error("Xatolik yuz berdi");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (step === 1) {
            if (!formData.address) return toast.error("Manzilni kiriting");
            const success = await updateOrder({ shippingAddress: formData.address });
            if (success) setStep(2);
        } else if (step === 2) {
            if (!formData.phone) return toast.error("Telefon raqamni kiriting");
            const success = await updateOrder({ contactPhone: formData.phone });
            if (success) setStep(3);
        } else if (step === 3) {
            const success = await updateOrder({
                paymentMethod: formData.paymentMethod,
                status: 'new' // Finalize order
            });
            if (success) {
                toast.success("Buyurtma qabul qilindi!");
                router.push('/mobile/orders'); // Or success page
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <button onClick={() => step === 1 ? router.back() : setStep(step - 1)} className="p-1 -ml-1" aria-label="Orqaga">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">
                    {step === 1 ? 'Yetkazib berish' : step === 2 ? 'Aloqa' : 'To\'lov'}
                </h1>
                <div className="ml-auto text-sm text-gray-500 font-medium">
                    {step} / 3
                </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
                {/* Progress Bar */}
                <div className="flex gap-2 mb-8">
                    <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                    <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                    <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-[#5D5FEF]' : 'bg-gray-200'}`} />
                </div>

                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-4 rounded-2xl shadow-sm">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Manzil</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                <textarea
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Ko'cha, uy raqami, mo'ljal..."
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20 h-32 resize-none"
                                />
                            </div>
                        </div>
                        <button className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                            <MapPin className="w-4 h-4" /> Kartadan belgilash (Tez orada)
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-4 rounded-2xl shadow-sm">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Telefon raqam</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                <input
                                    type="tel"
                                    id="phone-input"
                                    name="phone"
                                    aria-label="Telefon raqami"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/20"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Kuryer siz bilan bog&apos;lanishi uchun</p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-3">
                            <div
                                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                                className={`bg-white p-4 rounded-2xl border-2 flex items-center gap-4 cursor-pointer transition-colors ${formData.paymentMethod === 'cash' ? 'border-[#5D5FEF] bg-blue-50/10' : 'border-transparent shadow-sm'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    💵
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900">Naqd pul</h3>
                                    <p className="text-xs text-gray-500">Qabul qilib olganda</p>
                                </div>
                                {formData.paymentMethod === 'cash' && <CheckCircle2 className="w-6 h-6 text-[#5D5FEF]" />}
                            </div>

                            <div
                                onClick={() => setFormData({ ...formData, paymentMethod: 'card' })}
                                className={`bg-white p-4 rounded-2xl border-2 flex items-center gap-4 cursor-pointer transition-colors ${formData.paymentMethod === 'card' ? 'border-[#5D5FEF] bg-blue-50/10' : 'border-transparent shadow-sm'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900">Karta orqali</h3>
                                    <p className="text-xs text-gray-500">Payme / Click (Tez orada)</p>
                                </div>
                                {formData.paymentMethod === 'card' && <CheckCircle2 className="w-6 h-6 text-[#5D5FEF]" />}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Bar */}
            <div className="bg-white p-4 border-t border-gray-100 pb-safe-area-inset-bottom">
                <button
                    onClick={handleNext}
                    disabled={loading}
                    className="w-full bg-[#5D5FEF] text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#5D5FEF]/30 active:scale-[0.98] transition-all disabled:opacity-70"
                >
                    {loading ? 'Kutilmoqda...' : step === 3 ? 'Buyurtma berish' : 'Davom etish'}
                </button>
            </div>
        </div>
    );
}
