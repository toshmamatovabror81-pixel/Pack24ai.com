'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Image as ImageIcon, Copy } from 'lucide-react';

export default function ChannelPostsPage() {
    const [selectedProduct] = useState('Polietilen paket (Mayka)');

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Kanal uchun Post</h1>
                <p className="text-sm text-gray-500 mt-1">Telegram kanal uchun tayyor post generatsiyasi</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                    <Card className="p-6 border border-gray-100 shadow-sm rounded-[12px]">
                        <h3 className="font-bold text-gray-900 mb-4">Post sozlamalari</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mahsulotni tanlang</label>
                                <select aria-label="Mahsulotni tanlash" className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm outline-none focus:ring-2 ring-brand-green/20 border-brand-green">
                                    <option>Polietilen paket (Mayka)</option>
                                    <option>Pizza qutisi 30sm</option>
                                </select>
                            </div>
                            <Button className="w-full bg-brand-green hover:bg-[#053d2e]">
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Rasmni yangilash
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Preview */}
                <div>
                    <h3 className="font-bold text-gray-900 mb-4">Natija (Ko&apos;rinish)</h3>
                    <div className="bg-[#f0f2f5] p-4 rounded-xl max-w-sm mx-auto border border-gray-200 shadow-sm">
                        <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                            <div className="h-48 bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-sm">Product Image Placeholder</span>
                            </div>
                            <div className="p-3">
                                <p className="font-bold text-brand-green mb-1">🔥 {selectedProduct}</p>
                                <p className="text-sm text-gray-700 mb-2">
                                    Yuqori sifatli qadoqlash materiallari endi yanada arzon narxlarda!
                                    <br /><br />
                                    💰 Narxi: <b>150 so&apos;m</b> / dona
                                    <br />
                                    📦 Minimal buyurtma: 100 dona
                                </p>
                                <a href="#" className="text-blue-500 text-sm">#aksiya #qadoqlash #robosell</a>
                            </div>
                            <div className="bg-gray-50 p-2 border-t border-gray-100">
                                <button className="w-full py-2 bg-[#3390ec] text-white rounded-lg text-sm font-medium hover:bg-[#2883d9] transition-colors">
                                    Buyurtma berish ↗
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-center mt-4">
                            <Button variant="outline" className="bg-white text-gray-700 hover:bg-gray-50 border-gray-200">
                                <Copy className="w-4 h-4 mr-2" />
                                Matnni nusxalash
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
