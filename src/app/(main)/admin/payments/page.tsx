'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ToggleLeft, ToggleRight, Info, CreditCard, Banknote, Smartphone, Wallet, X, Check } from 'lucide-react';

interface PaymentMethod {
    id: string;
    name: string;
    icon: any;
    status: 'active' | 'inactive' | 'not_connected';
    updatedAt: string;
    type: 'cash' | 'card' | 'wallet' | 'installment';
    isPro?: boolean;
    description?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: 'cash',
        name: 'Naqd pul',
        icon: Banknote,
        status: 'active',
        updatedAt: '12.01.2025',
        type: 'cash',
        description: 'Mijoz naqd to\'lov qilganda, fiskal chek berishni unutmang'
    },
    {
        id: 'uzum_nasiya',
        name: 'Uzum Nasiya',
        icon: Wallet,
        status: 'not_connected',
        updatedAt: '-',
        type: 'installment',
        isPro: true
    },
    {
        id: 'click',
        name: 'Click',
        icon: Smartphone,
        status: 'active',
        updatedAt: '10.01.2025',
        type: 'card'
    },
    {
        id: 'payme',
        name: 'Payme',
        icon: Smartphone,
        status: 'inactive',
        updatedAt: '05.01.2025',
        type: 'card'
    },
    {
        id: 'card_to_card',
        name: 'Kartadan kartaga',
        icon: CreditCard,
        status: 'active',
        updatedAt: '11.01.2025',
        type: 'card',
        description: 'Mablag\' kelib tushgandan so\'ng buyurtma tasdiqlanadi'
    },
    {
        id: 'alif_nasiya',
        name: 'Alif Nasiya',
        icon: Wallet,
        status: 'not_connected',
        updatedAt: '-',
        type: 'installment',
        isPro: true
    },
    {
        id: 'bank',
        name: 'Bank orqali',
        icon: Banknote,
        status: 'active',
        updatedAt: '01.01.2025',
        type: 'cash'
    },
    {
        id: 'robo_pay',
        name: 'Robo Pay',
        icon: Smartphone,
        status: 'not_connected',
        updatedAt: '-',
        type: 'card'
    },
    {
        id: 'installment',
        name: 'Muddatli to\'lov',
        icon: Wallet,
        status: 'inactive',
        updatedAt: '08.01.2025',
        type: 'installment',
        isPro: true
    }
];

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState(PAYMENT_METHODS);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const toggleMethod = (method: PaymentMethod) => {
        if (method.status === 'not_connected' || method.type === 'card' || method.type === 'installment') {
            // Open settings for API keys or connection
            setSelectedMethod(method);
            setIsSettingsOpen(true);
        } else {
            // Simple toggle for cash/other
            setMethods(methods.map(m => {
                if (m.id === method.id) {
                    return { ...m, status: m.status === 'active' ? 'inactive' : 'active', updatedAt: new Date().toLocaleDateString('ru-RU') };
                }
                return m;
            }));
        }
    };

    const handleSaveSettings = () => {
        if (selectedMethod) {
            setMethods(methods.map(m => {
                if (m.id === selectedMethod.id) {
                    return { ...m, status: 'active', updatedAt: new Date().toLocaleDateString('ru-RU') };
                }
                return m;
            }));
            setIsSettingsOpen(false);
            setSelectedMethod(null);
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">To&apos;lov usullari</h1>
                <p className="text-sm text-gray-500 mt-1">To&apos;lov tizimlarini boshqarish va sozlash</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {methods.map((method) => (
                    <Card
                        key={method.id}
                        className="relative p-6 border border-gray-200 shadow-sm rounded-[12px] hover:shadow-md transition-shadow bg-white flex flex-col justify-between min-h-[160px]"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-600">
                                    <method.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900">{method.name}</h3>
                                        {method.isPro && (
                                            <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none px-1.5 py-0.5 text-[10px]">PRO</Badge>
                                        )}
                                    </div>
                                    <div className="mt-1">
                                        {method.status === 'active' && <Badge className="bg-green-50 text-green-700 border-none px-2 py-0.5 text-xs font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Faol</Badge>}
                                        {method.status === 'inactive' && <Badge className="bg-red-50 text-red-700 border-none px-2 py-0.5 text-xs font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Faol emas</Badge>}
                                        {method.status === 'not_connected' && <Badge className="bg-gray-100 text-gray-500 border-none px-2 py-0.5 text-xs font-medium">Ulanmagan</Badge>}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleMethod(method)}
                                aria-label={method.status === 'active' ? "O'chirish" : "Yoqish"}
                                className="text-gray-400 hover:text-[#064E3B] transition-colors"
                            >
                                {method.status === 'active' ? <ToggleRight className="w-8 h-8 text-[#064E3B]" /> : <ToggleLeft className="w-8 h-8" />}
                            </button>
                        </div>

                        <div className="border-t border-gray-50 pt-4 mt-auto">
                            <div className="text-xs text-gray-400 font-medium">Oxirgi yangilanish: {method.updatedAt}</div>
                            {method.description && (
                                <p className="text-[11px] text-gray-400 mt-2 leading-tight">
                                    <Info className="w-3 h-3 inline mr-1" />
                                    {method.description}
                                </p>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && selectedMethod && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsSettingsOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                                <selectedMethod.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{selectedMethod.name} Sozlamalari</h2>
                                <p className="text-sm text-gray-500">Integratsiya ma&apos;lumotlarini kiriting</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {selectedMethod.name === 'Click' || selectedMethod.name === 'Payme' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Merchant ID</label>
                                        <Input placeholder="Enter Merchant ID" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Secret Key</label>
                                        <Input type="password" placeholder="Enter Secret Key" />
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg flex gap-2 border border-blue-100">
                                        <Info className="w-5 h-5 text-blue-600 shrink-0" />
                                        <p className="text-xs text-blue-700">
                                            Ushbu ma&apos;lumotlarni {selectedMethod.name} shaxsiy kabinetidan olishingiz mumkin.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-600">Ushbu to&apos;lov usulini faollashtirish uchun tasdiqlash tugmasini bosing.</p>
                                </div>
                            )}

                            {selectedMethod.type === 'cash' && (
                                <div className="bg-amber-50 p-3 rounded-lg flex gap-2 border border-amber-100">
                                    <Info className="w-5 h-5 text-amber-600 shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        Fiskal ma&apos;lumotlarni to&apos;g&apos;ri kiritish soliq qonunchiligiga rioya qilish uchun muhimdir.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-6">
                            <Button variant="secondary" onClick={() => setIsSettingsOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 border-transparent text-gray-700">Bekor qilish</Button>
                            <Button onClick={handleSaveSettings} className="flex-1 bg-[#064E3B] hover:bg-[#053d2e]">
                                <Check className="w-4 h-4 mr-2" />
                                Saqlash va Yoqish
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
