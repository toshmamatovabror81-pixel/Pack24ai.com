'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';import { Search, Plus, Calendar, Percent, Tag, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';

// Mock Data for Discounts
const DISCOUNTS = [
    {
        id: 1,
        name: 'Yangi yil aksiyasi (New Year Sale)',
        type: 'percentage',
        value: 15,
        startDate: '2025-12-25',
        endDate: '2026-01-05',
        status: 'active',
        productCount: 45
    },
    {
        id: 2,
        name: 'Bahorgi tozalash (Spring Clearance)',
        type: 'fixed',
        value: 20000,
        startDate: '2026-03-01',
        endDate: '2026-03-15',
        status: 'pending',
        productCount: 12
    },
    {
        id: 3,
        name: 'Eski kolleksiya (Last Year Stock)',
        type: 'percentage',
        value: 30,
        startDate: '2025-11-01',
        endDate: '2025-11-30',
        status: 'expired',
        productCount: 8
    }
];

export default function DiscountsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'expired'>('all');

    const filteredDiscounts = DISCOUNTS.filter(discount => {
        const matchesSearch = discount.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || discount.status === activeTab;
        return matchesSearch && matchesTab;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none">Faol</Badge>;
            case 'pending':
                return <Badge variant="warning" className="bg-amber-100 text-amber-700 border-none">Kutilmoqda</Badge>;
            case 'expired':
                return <Badge variant="neutral" className="bg-gray-100 text-gray-700 border-none">Muddati o&apos;tgan</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Chegirmalar</h1>
                <Link href="/admin/products/discounts/new">
                    <Button className="gap-2 bg-[#064E3B] hover:bg-[#053d2e] rounded-[10px]">
                        <Plus className="w-4 h-4" />
                        Chegirma qo&apos;shish
                    </Button>
                </Link>
            </div>

            <Card noPadding className="mb-8 overflow-hidden border border-gray-100 shadow-sm rounded-[12px]">
                {/* Filters & Search */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                    <div className="flex gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                        {(['all', 'active', 'pending', 'expired'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab
                                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700'
                                    } capitalize`}
                            >
                                {tab === 'all' ? 'Barchasi' : tab === 'active' ? 'Faol' : tab === 'pending' ? 'Kutilmoqda' : "O'tgan"}
                            </button>
                        ))}
                    </div>

                    <div className="w-full md:w-1/3">
                        <Input
                            placeholder="Chegirma nomini qidirish"
                            icon={<Search className="w-4 h-4" />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="py-4 pl-6 font-medium">Chegirma nomi</th>
                                <th className="py-4 px-4 font-medium">Turi</th>
                                <th className="py-4 px-4 font-medium">Qiymati</th>
                                <th className="py-4 px-4 font-medium">Amal qilish muddati</th>
                                <th className="py-4 px-4 font-medium">Mahsulotlar</th>
                                <th className="py-4 px-4 font-medium">Holat</th>
                                <th className="py-4 px-6 font-medium text-right">Harakat</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                            {filteredDiscounts.map((discount) => (
                                <tr key={discount.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="py-4 pl-6">
                                        <div className="font-medium text-gray-900">{discount.name}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-1.5">
                                            {discount.type === 'percentage'
                                                ? <Percent className="w-4 h-4 text-blue-500" />
                                                : <Tag className="w-4 h-4 text-green-500" />
                                            }
                                            <span className="capitalize">{discount.type === 'percentage' ? 'Foiz' : 'Summa'}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 font-semibold text-gray-900">
                                        {discount.type === 'percentage' ? `-${discount.value}%` : `-${discount.value.toLocaleString()} UZS`}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2 text-gray-500 text-xs bg-gray-50 px-2 py-1 rounded w-fit">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>{discount.startDate} — {discount.endDate}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                            {discount.productCount} ta
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        {getStatusBadge(discount.status)}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button aria-label="Tahrirlash" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                <Pencil className="w-4 h-4" />
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
                    {filteredDiscounts.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            Hech qanday chegirma topilmadi
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
