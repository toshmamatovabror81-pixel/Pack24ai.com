'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
    QrCode,
    Download,
    Printer,
    Settings,
    BarChart3,
    Eye,
    Smartphone,
    Globe,
    Bot,
    Check,
    Image as ImageIcon,
    Type
} from 'lucide-react';

export default function QrCatalogPage() {
    // State
    const [qrColor, setQrColor] = useState('#000000');
    const [hasLogo, setHasLogo] = useState(true);
    const [targetType, setTargetType] = useState<'bot' | 'web'>('bot');
    const [tableRange, setTableRange] = useState({ start: 1, end: 10 });
    const [selectedTemplate, setSelectedTemplate] = useState('simple');

    // Mock Stats
    const stats = {
        totalScans: 12450,
        uniqueVisitors: 8900,
        weeklyGrowth: 12
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900">QR Katalog</h1>
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200">PRO</Badge>
                    </div>
                    <p className="text-sm text-gray-500">Mijozlar uchun raqamli menyu va buyurtma tizimi</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200">
                        <Printer className="w-4 h-4 mr-2" />
                        Chop etish
                    </Button>
                    <Button className="bg-[#064E3B] hover:bg-[#053d2e]">
                        <Download className="w-4 h-4 mr-2" />
                        Yuklab olish
                    </Button>
                </div>
            </div>

            <div className="grid xl:grid-cols-3 gap-8">
                {/* Left Column: Settings */}
                <div className="xl:col-span-2 space-y-8">

                    {/* 1. Statistics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="p-5 flex flex-col justify-center border border-gray-100 shadow-sm rounded-[12px]">
                            <div className="flex items-center gap-3 mb-2 text-gray-500">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <QrCode className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-medium">Jami Skanerlash</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalScans.toLocaleString()}</p>
                            <span className="text-xs text-green-600 flex items-center mt-1">
                                +{stats.weeklyGrowth}% o&apos;sish
                            </span>
                        </Card>
                        <Card className="p-5 flex flex-col justify-center border border-gray-100 shadow-sm rounded-[12px]">
                            <div className="flex items-center gap-3 mb-2 text-gray-500">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <Eye className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-medium">Ko&apos;rishlar</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{stats.uniqueVisitors.toLocaleString()}</p>
                        </Card>
                        <Card className="p-5 flex flex-col justify-center border border-gray-100 shadow-sm rounded-[12px] bg-[#064E3B] text-white">
                            <div className="flex items-center gap-3 mb-2 text-emerald-200">
                                <div className="p-2 bg-white/10 rounded-lg text-white">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-medium">Konversiya</span>
                            </div>
                            <p className="text-2xl font-bold text-white">4.8%</p>
                            <span className="text-xs text-emerald-200 mt-1">Buyurtmaga aylanish</span>
                        </Card>
                    </div>

                    {/* 2. QR Settings */}
                    <Card className="p-6 border border-gray-100 shadow-sm rounded-[16px] space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                            <Settings className="w-5 h-5 text-gray-500" />
                            <h2 className="text-lg font-bold text-gray-900">QR Kod Sozlamalari</h2>
                        </div>

                        {/* Target Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Yo&apos;naltirish (Dynamic QR)</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    onClick={() => setTargetType('bot')}
                                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-center gap-4 transition-all ${targetType === 'bot' ? 'border-[#064E3B] bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                                >
                                    <div className={`p-2 rounded-full ${targetType === 'bot' ? 'bg-[#064E3B] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        <Bot className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Telegram Bot</h3>
                                        <p className="text-xs text-gray-500">Mijoz botga o&apos;tadi</p>
                                    </div>
                                    {targetType === 'bot' && <div className="ml-auto bg-[#064E3B] text-white rounded-full p-0.5"><Check className="w-3 h-3" /></div>}
                                </div>
                                <div
                                    onClick={() => setTargetType('web')}
                                    className={`cursor-pointer border-2 rounded-xl p-4 flex items-center gap-4 transition-all ${targetType === 'web' ? 'border-[#064E3B] bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                                >
                                    <div className={`p-2 rounded-full ${targetType === 'web' ? 'bg-[#064E3B] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Veb-sayt</h3>
                                        <p className="text-xs text-gray-500">Brauzerda ochiladi</p>
                                    </div>
                                    {targetType === 'web' && <div className="ml-auto bg-[#064E3B] text-white rounded-full p-0.5"><Check className="w-3 h-3" /></div>}
                                </div>
                            </div>
                        </div>

                        {/* Visual Settings */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">QR Rangi</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        aria-label="QR Rangi"
                                        value={qrColor}
                                        onChange={(e) => setQrColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-none p-0"
                                    />
                                    <span className="text-sm text-gray-600 font-mono uppercase">{qrColor}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Logotip</label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${hasLogo ? 'bg-[#064E3B]' : 'bg-gray-300'}`}>
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${hasLogo ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-sm text-gray-700">QR markazida logotip</span>
                                    <input type="checkbox" className="hidden" checked={hasLogo} onChange={(e) => setHasLogo(e.target.checked)} />
                                </label>
                            </div>
                        </div>

                        {/* Table Numbers */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Stol Raqamlari</label>
                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="w-full">
                                    <span className="text-xs text-gray-500 mb-1 block">Boshlanishi</span>
                                    <Input
                                        type="number"
                                        value={tableRange.start}
                                        onChange={(e) => setTableRange({ ...tableRange, start: parseInt(e.target.value) })}
                                        className="bg-white"
                                    />
                                </div>
                                <span className="text-gray-400 font-bold">-</span>
                                <div className="w-full">
                                    <span className="text-xs text-gray-500 mb-1 block">Tugashi</span>
                                    <Input
                                        type="number"
                                        value={tableRange.end}
                                        onChange={(e) => setTableRange({ ...tableRange, end: parseInt(e.target.value) })}
                                        className="bg-white"
                                    />
                                </div>
                                <div className="w-full flex-shrink-0 pt-5">
                                    <p className="text-sm text-gray-600">Jami: <span className="font-bold text-gray-900">{tableRange.end - tableRange.start + 1}</span> ta QR kod</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 3. Download Options */}
                    <Card className="p-6 border border-gray-100 shadow-sm rounded-[16px]">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Yuklab olish formatlari</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <button className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#064E3B] hover:bg-emerald-50 transition-all group">
                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-[#064E3B]">
                                    <ImageIcon className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#064E3B]">PNG</span>
                            </button>
                            <button className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#064E3B] hover:bg-emerald-50 transition-all group">
                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-[#064E3B]">
                                    <Type className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#064E3B]">SVG</span>
                            </button>
                            <button className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#064E3B] hover:bg-emerald-50 transition-all group">
                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-[#064E3B]">
                                    <Printer className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#064E3B]">PDF (A5)</span>
                            </button>
                            <button className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#064E3B] hover:bg-emerald-50 transition-all group">
                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-[#064E3B]">
                                    <Printer className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#064E3B]">PDF (A6)</span>
                            </button>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Preview */}
                <div className="xl:col-span-1">
                    <div className="sticky top-6 space-y-6">
                        <Card className="p-8 border border-gray-100 shadow-lg rounded-[24px] bg-white flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-[#064E3B]"></div>

                            <h3 className="text-2xl font-bold text-gray-900 mb-1">Bizning Menyu</h3>
                            <p className="text-gray-500 text-sm mb-6">Skanerlang va buyurtma bering</p>

                            <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100 mb-6 relative">
                                {/* Simulated QR Code */}
                                <div
                                    className="w-48 h-48 bg-gray-900 pattern-isometric pattern-gray-500 pattern-bg-white pattern-size-4 pattern-opacity-10 rounded-lg flex items-center justify-center"
                                    ref={(el) => {
                                        if (el) el.style.backgroundColor = qrColor;
                                    }}
                                >
                                    <div className="absolute inset-0 grid grid-cols-7 grid-rows-7 gap-1 p-2">
                                        {/* Simple Grid to mimic QR */}
                                        <div className="col-span-2 row-span-2 bg-white rounded-sm border-4 border-current"></div>
                                        <div className="col-start-6 col-span-2 row-span-2 bg-white rounded-sm border-4 border-current"></div>
                                        <div className="col-start-1 col-span-2 row-start-6 row-span-2 bg-white rounded-sm border-4 border-current"></div>
                                    </div>
                                    {hasLogo && (
                                        <div className="bg-white p-1 rounded-full shadow-md z-10 w-12 h-12 flex items-center justify-center absolute">
                                            <span className="font-bold text-xs text-gray-900">LOGO</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gray-100 px-4 py-2 rounded-lg mb-6">
                                <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Stol Raqami</span>
                                <p className="text-3xl font-bold text-[#064E3B]">12</p>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Smartphone className="w-3 h-3" />
                                <span>Powered by Robosell</span>
                            </div>
                        </Card>

                        <div className="bg-[#064E3B] text-white p-6 rounded-[20px] shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>

                            <h4 className="font-bold text-lg mb-2">Dizayn Shablonlari</h4>
                            <p className="text-emerald-100 text-sm mb-4">Tayyor dizanlardan foydalanib stolingiz uchun stiker yarating.</p>

                            <div className="grid grid-cols-2 gap-2">
                                <div
                                    className={`bg-white/10 p-2 rounded-lg border cursor-pointer hover:bg-white/20 transition-all ${selectedTemplate === 'simple' ? 'border-white' : 'border-transparent'}`}
                                    onClick={() => setSelectedTemplate('simple')}
                                >
                                    <div className="h-10 bg-white/90 rounded mb-1"></div>
                                    <p className="text-[10px] text-center">Oddiy</p>
                                </div>
                                <div
                                    className={`bg-white/10 p-2 rounded-lg border cursor-pointer hover:bg-white/20 transition-all ${selectedTemplate === 'modern' ? 'border-white' : 'border-transparent'}`}
                                    onClick={() => setSelectedTemplate('modern')}
                                >
                                    <div className="h-10 bg-emerald-800/50 rounded mb-1"></div>
                                    <p className="text-[10px] text-center">Modern</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
