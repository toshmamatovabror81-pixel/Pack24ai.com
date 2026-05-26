'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Plus, Copy, Trash2, RefreshCcw, Search, Check, PauseCircle, PlayCircle, X } from 'lucide-react';

// Mock Data
const PROMOS = [
    {
        id: 1,
        code: 'YANGI2026',
        type: 'percent',
        value: 20,
        limit: 100,
        used: 45,
        minAmount: 0,
        expiry: '2026-02-01',
        status: 'active'
    },
    {
        id: 2,
        code: 'WELCOME50',
        type: 'fixed',
        value: 50000,
        limit: 500,
        used: 120,
        minAmount: 200000,
        expiry: '2026-06-01',
        status: 'active'
    },
    {
        id: 3,
        code: 'SUMMER_SALE',
        type: 'percent',
        value: 15,
        limit: 50,
        used: 50,
        minAmount: 100000,
        expiry: '2025-08-31',
        status: 'expired'
    }
];

export default function PromoCodesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [promos, setPromos] = useState(PROMOS);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Form State
    const [newCode, setNewCode] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');

    const handleCopy = (id: number, code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleStatus = (id: number) => {
        setPromos(promos.map(p => {
            if (p.id === id) {
                return { ...p, status: p.status === 'active' ? 'paused' : 'active' };
            }
            return p;
        }));
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewCode(result);
    };

    const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setNewCode(val);
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Promokodlar</h1>
                    <p className="text-sm text-gray-500 mt-1">Chegirma kuponlarini boshqarish</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-brand-green hover:bg-[#053d2e]">
                    <Plus className="w-4 h-4 mr-2" />
                    Promokod Yaratish
                </Button>
            </div>

            <Card noPadding className="mb-6 border border-gray-100 shadow-sm rounded-[12px]">
                <div className="p-4">
                    <div className="relative max-w-md">
                        <Input
                            placeholder="Promokod qidirish..."
                            icon={<Search className="w-4 h-4" />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="py-4 pl-6 font-medium">Promokod</th>
                                <th className="py-4 px-4 font-medium">Chegirma</th>
                                <th className="py-4 px-4 font-medium">Ishlatildi</th>
                                <th className="py-4 px-4 font-medium">Muddat</th>
                                <th className="py-4 px-4 font-medium">Holat</th>
                                <th className="py-4 px-6 font-medium text-right">Amallar</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                            {promos.filter(p => p.code.includes(searchTerm.toUpperCase())).map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-4 pl-6">
                                        <div
                                            className="inline-flex items-center gap-2 font-mono font-bold text-gray-800 bg-gray-50 px-3 py-1.5 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer group hover:border-brand-green hover:text-brand-green transition-all"
                                            onClick={() => handleCopy(item.id, item.code)}
                                        >
                                            {item.code}
                                            {copiedId === item.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400 group-hover:text-brand-green" />}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="font-semibold text-gray-900">
                                            {item.type === 'percent' ? `${item.value}%` : `${item.value.toLocaleString()} so'm`}
                                        </span>
                                        {item.minAmount > 0 && <span className="text-xs text-gray-400 block">Min: {item.minAmount.toLocaleString()}</span>}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    ref={(el) => {
                                                        if (el) el.style.width = `${(item.used / item.limit) * 100}%`;
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500 whitespace-nowrap">{item.used} / {item.limit}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500">
                                        {item.expiry}
                                    </td>
                                    <td className="py-4 px-4">
                                        {item.status === 'active' && <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none">Faol</Badge>}
                                        {item.status === 'paused' && <Badge variant="warning" className="bg-amber-100 text-amber-700 border-none">To&apos;xtatilgan</Badge>}
                                        {item.status === 'expired' && <Badge variant="error" className="bg-red-50 text-red-600 border-red-100">Muddati o&apos;tgan</Badge>}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => toggleStatus(item.id)}
                                                className={`p-2 rounded-lg transition-colors ${item.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                                                title={item.status === 'active' ? "To'xtatish" : "Faollashtirish"}
                                            >
                                                {item.status === 'active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                                            </button>
                                            <button aria-label="O'chirish" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsModalOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 mb-6">Yangi Promokod</h2>

                        <div className="space-y-5">
                            {/* Code Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Promokod Nomi</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            value={newCode}
                                            onChange={handleCodeInput}
                                            placeholder="Masalan: SALE2024"
                                            className="uppercase font-mono font-bold tracking-wide border-dashed focus:border-solid"
                                        />
                                    </div>
                                    <Button variant="outline" onClick={generateCode} className="shrink-0" title="Avtomatik yaratish">
                                        <RefreshCcw className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Faqat lotin harflari va raqamlar</p>
                            </div>

                            {/* Type & Value */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Chegirma turi</label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setDiscountType('percent')}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${discountType === 'percent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Foiz (%)
                                        </button>
                                        <button
                                            onClick={() => setDiscountType('fixed')}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${discountType === 'fixed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Summa
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Qiymati</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        rightElement={<span className="text-gray-500 text-sm">{discountType === 'percent' ? '%' : "so'm"}</span>}
                                    />
                                </div>
                            </div>

                            {/* Limits & Min Amount */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Umumiy Limit</label>
                                        <Input type="number" placeholder="∞" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. Xarid</label>
                                        <Input type="number" placeholder="0" rightElement={<span className="text-gray-500 text-sm">so&apos;m</span>} />
                                    </div>
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Boshlanish</label>
                                    <Input type="date" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Tugash</label>
                                    <Input type="date" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 border-transparent text-gray-700">Bekor qilish</Button>
                                <Button className="flex-1 bg-brand-green hover:bg-[#053d2e]">Saqlash</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
