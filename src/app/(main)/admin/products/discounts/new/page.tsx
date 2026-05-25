'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';import { ArrowLeft, Calendar, Save, Calculator, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewDiscountPage() {
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<string>('');

    // Mock Product for Preview
    const mockProductPrice = 150000;

    const calculateNewPrice = () => {
        const val = parseFloat(discountValue) || 0;
        if (discountType === 'percentage') {
            return mockProductPrice - (mockProductPrice * val / 100);
        } else {
            return Math.max(0, mockProductPrice - val);
        }
    };

    const newPrice = calculateNewPrice();

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#F9FAFB]/95 backdrop-blur z-10 py-4 border-b border-transparent">
                <div className="flex items-center gap-4">
                    <Link href="/admin/products/discounts">
                        <Button variant="ghost" size="icon" className="rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Yangi chegirma yaratish</h1>
                        <p className="text-sm text-gray-500">Aksiya yoki mavsumiy chegirmalar</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" className="bg-white border-gray-200">Bekor qilish</Button>
                    <Button className="bg-[#064E3B] hover:bg-[#053d2e] gap-2">
                        <Save className="w-4 h-4" /> Saqlash
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 rounded-[12px]">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-[#064E3B] rounded-full block"></span>
                            Asosiy ma&apos;lumotlar
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chegirma nomi</label>
                                <Input placeholder="Masalan: Yangi yil aksiyasi" className="bg-gray-50 border-gray-200" />
                                <p className="text-xs text-gray-500 mt-1">Bu nom faqat admin panelda ko&apos;rinadi.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Chegirma turi</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${discountType === 'percentage' ? 'border-[#064E3B] bg-[#064E3B]/5 ring-1 ring-[#064E3B]' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                className="hidden"
                                                checked={discountType === 'percentage'}
                                                onChange={() => setDiscountType('percentage')}
                                            />
                                            <span className="font-medium text-sm text-gray-900">Foiz (%)</span>
                                        </label>
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${discountType === 'fixed' ? 'border-[#064E3B] bg-[#064E3B]/5 ring-1 ring-[#064E3B]' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                className="hidden"
                                                checked={discountType === 'fixed'}
                                                onChange={() => setDiscountType('fixed')}
                                            />
                                            <span className="font-medium text-sm text-gray-900">Aniq summa</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Qiymat</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        icon={<span className="font-bold text-gray-500 text-sm">{discountType === 'percentage' ? '%' : 'UZS'}</span>}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Boshlanish sanasi</label>
                                    <div className="relative">
                                        <Input type="date" className="pl-10 text-sm" />
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tugash sanasi</label>
                                    <div className="relative">
                                        <Input type="date" className="pl-10 text-sm" />
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input type="checkbox" id="no-expiry" className="rounded border-gray-300 text-[#064E3B] focus:ring-[#064E3B]" />
                                        <label htmlFor="no-expiry" className="text-xs text-gray-600">Cheklovsiz</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 rounded-[12px]">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-[#064E3B] rounded-full block"></span>
                            Mahsulotlarni tanlash
                        </h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                            <p className="text-sm text-gray-500 mb-4">Qaysi mahsulotlarga chegirma qo&apos;llanilishini tanlang</p>
                            <Button variant="outline" className="bg-white">Mahsulotlarni tanlash (Select)</Button>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Preview */}
                <div className="space-y-6">
                    <Card className="p-6 sticky top-24 rounded-[12px] border-[#064E3B]/10 shadow-[0_4px_20px_rgba(6,78,59,0.05)]">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Narx namunasi
                        </h3>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-1 text-sm">
                                <span className="text-gray-500">Mahsulot narxi:</span>
                                <span className="font-medium">{mockProductPrice.toLocaleString()} UZS</span>
                            </div>
                            <div className="flex justify-between items-center mb-3 text-sm">
                                <span className="text-gray-500">Chegirma:</span>
                                <span className="font-medium text-red-500">
                                    {discountType === 'percentage' ? `-${discountValue || 0}%` : `-${Number(discountValue || 0).toLocaleString()} UZS`}
                                </span>
                            </div>
                            <div className="h-px bg-gray-200 mb-3"></div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-900">Yangi narx:</span>
                                <span className="font-bold text-lg text-[#064E3B]">{newPrice.toLocaleString()} UZS</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex gap-2 items-start border border-blue-100">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>Ushbu chegirma avtomatik ravishda tanlangan mahsulotlarning &quot;Eski narx&quot; maydonini to&apos;ldiradi va yangi narxni hisoblaydi.</p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
