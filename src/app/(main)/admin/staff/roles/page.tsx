'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Check } from 'lucide-react';

const ROLES = [
    { id: 'admin', name: 'Admin', users: 2, badge: 'All Access' },
    { id: 'seller', name: 'Sotuvchi', users: 5 },
    { id: 'courier', name: 'Kuryer', users: 12 },
];

const PERMISSIONS = [
    { section: 'Boshqaruv', items: ['Dashboard ko\'rish', 'Hisobotlar'] },
    { section: 'Mahsulotlar', items: ['Mahsulot qo\'shish', 'Tahrirlash', 'O\'chirish', 'Omborni ko\'rish'] },
    { section: 'Buyurtmalar', items: ['Buyurtmalarni ko\'rish', 'Statusni o\'zgartirish', 'Bekor qilish'] },
    { section: 'Marketing', items: ['Promokodlar', 'Rassilka', 'Kanalga post'] },
    { section: 'Sozlamalar', items: ['Tizim sozlamalari', 'Xodimlar boshqaruvi'] },
];

export default function RolesPage() {
    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900">Rollar va Ruxsatnomalar</h1>
                    <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none text-[10px] px-1.5 py-0.5">PRO</Badge>
                </div>
                <p className="text-sm text-gray-500">Xodimlar uchun tizimga kirish huquqlarini boshqarish</p>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
                {/* Roles List */}
                <div className="lg:col-span-1 space-y-3">
                    {ROLES.map(role => (
                        <div key={role.id} className={`p-4 rounded-[12px] border cursor-pointer transition-all ${role.id === 'seller' ? 'bg-white border-[#064E3B] shadow-md ring-1 ring-[#064E3B]/20' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <Shield className={`w-5 h-5 ${role.id === 'seller' ? 'text-[#064E3B]' : 'text-gray-400'}`} />
                                {role.badge && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{role.badge}</span>}
                            </div>
                            <h3 className={`font-bold ${role.id === 'seller' ? 'text-[#064E3B]' : 'text-gray-900'}`}>{role.name}</h3>
                            <p className="text-xs text-gray-500">{role.users} ta xodim</p>
                        </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed border-gray-300 text-gray-500 hover:border-[#064E3B] hover:text-[#064E3B]">
                        + Yangi rol qo&apos;shish
                    </Button>
                </div>

                {/* Permissions Matrix */}
                <div className="lg:col-span-3">
                    <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Sotuvchi</h2>
                                <p className="text-sm text-gray-500">Ushbu rol uchun ruxsatnomalarni belgilang</p>
                            </div>
                            <Button className="bg-[#064E3B] hover:bg-[#053d2e]">
                                <Check className="w-4 h-4 mr-2" />
                                Saqlash
                            </Button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {PERMISSIONS.map((group) => (
                                <div key={group.section} className="space-y-3">
                                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-1">{group.section}</h3>
                                    <div className="space-y-2">
                                        {group.items.map(item => (
                                            <label key={item} className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${['Dashboard ko\'rish', 'Buyurtmalarni ko\'rish'].includes(item) ? 'bg-[#064E3B] border-[#064E3B]' : 'border-gray-300 bg-white group-hover:border-[#064E3B]'}`}>
                                                    {['Dashboard ko\'rish', 'Buyurtmalarni ko\'rish'].includes(item) && <Check className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <span className="text-sm text-gray-700">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
