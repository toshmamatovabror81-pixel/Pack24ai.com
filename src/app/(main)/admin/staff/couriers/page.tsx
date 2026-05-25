'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Truck, Wallet, TrendingUp, MoreHorizontal, User, X, Check } from 'lucide-react';

const COURIERS = [
    { id: 1, name: 'Azizov B.', status: 'active', orders: 154, balance: '1,250,000', service: 'Yandex Go' },
    { id: 2, name: 'Karimov D.', status: 'busy', orders: 89, balance: '850,000', service: 'MyTaxi' },
    { id: 3, name: 'Valiyev S.', status: 'offline', orders: 210, balance: '3,400,000', service: 'UzPost' },
];

export default function CouriersPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900">Kuryerlar</h1>
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none text-[10px] px-1.5 py-0.5">PRO</Badge>
                    </div>
                    <p className="text-sm text-gray-500">Yetkazib beruvchilar va ularning statistikasi</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-[#064E3B]">
                    + Kuryer qo&apos;shish
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="p-5 flex items-center gap-4 border border-gray-200 shadow-sm">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Truck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Faol kuryerlar</p>
                        <h3 className="text-2xl font-bold text-gray-900">12 ta</h3>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 border border-gray-200 shadow-sm">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Jami depozit</p>
                        <h3 className="text-2xl font-bold text-gray-900">15.4 M</h3>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 border border-gray-200 shadow-sm">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Bugungi buyurtmalar</p>
                        <h3 className="text-2xl font-bold text-gray-900">45 ta</h3>
                    </div>
                </Card>
            </div>

            {/* Couriers List */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {COURIERS.map(courier => (
                    <Card key={courier.id} className="p-5 border border-gray-200 shadow-sm rounded-[12px] bg-white hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{courier.name}</h3>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${courier.status === 'active' ? 'bg-green-100 text-green-700' :
                                            courier.status === 'busy' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {courier.status === 'active' ? 'Bo\'sh' : courier.status === 'busy' ? 'Band' : 'Oflayn'}
                                    </span>
                                </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600" aria-label="Kuryer sozlamalari">
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-gray-50">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Xizmat:</span>
                                <span className="font-medium text-gray-900">{courier.service}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Balans:</span>
                                <span className="font-bold text-gray-900">{courier.balance} so&apos;m</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Yetkazilgan:</span>
                                <span className="font-bold text-gray-900">{courier.orders} ta</span>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full mt-4 border-emerald-100 text-emerald-700 hover:bg-emerald-50">
                            Batafsil
                        </Button>
                    </Card>
                ))}
            </div>

            {/* Add Courier Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsModalOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 mb-6">Yangi kuryer qo&apos;shish</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">F.I.O</label>
                                <Input placeholder="Kuryer ism sharifi" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon raqami</label>
                                <Input placeholder="+998" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Yetkazib berish xizmati</label>
                                <select className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#064E3B]/20" aria-label="Xizmatni tanlash">
                                    <option>Yandex Go</option>
                                    <option>MyTaxi</option>
                                    <option>UzPost</option>
                                    <option>Fargo</option>
                                    <option>Internal Delivery (O&apos;zimizniki)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Kuryer qaysi xizmat turiga tegishli ekanligini belgilang.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 border-transparent text-gray-700">Bekor qilish</Button>
                                <Button className="flex-1 bg-[#064E3B] hover:bg-[#053d2e]">
                                    <Check className="w-4 h-4 mr-2" />
                                    Saqlash
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
