'use client';

import Image from 'next/image';
// Fixed accessibility issues (Axe diagnostics) in this file by adding aria-labels
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';import { Upload, RefreshCcw, Globe, Phone, Instagram, Send, Facebook, Youtube, Clock, MapPin, Info, Check } from 'lucide-react';

const WEEKDAYS = [
    { id: 'mon', name: 'Dushanba' },
    { id: 'tue', name: 'Seshanba' },
    { id: 'wed', name: 'Chorshanba' },
    { id: 'thu', name: 'Payshanba' },
    { id: 'fri', name: 'Juma' },
    { id: 'sat', name: 'Shanba' },
    { id: 'sun', name: 'Yakshanba' }
];

const CURRENCIES = ['UZS', 'USD'];

export default function SettingsPage() {
    const [logo, _setLogo] = useState<string | null>(null);
    const [schedule, setSchedule] = useState<Record<string, { active: boolean; start: string; end: string }>>({
        mon: { active: true, start: '09:00', end: '18:00' },
        tue: { active: true, start: '09:00', end: '18:00' },
        wed: { active: true, start: '09:00', end: '18:00' },
        thu: { active: true, start: '09:00', end: '18:00' },
        fri: { active: true, start: '09:00', end: '18:00' },
        sat: { active: false, start: '10:00', end: '16:00' },
        sun: { active: false, start: '10:00', end: '16:00' },
    });

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen space-y-8 pb-24">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Do&apos;kon Sozlamalari</h1>
                <p className="text-sm text-gray-500 mt-1">Asosiy ma&apos;lumotlar, ish tartibi va aloqa kanallari</p>
            </div>

            {/* 1. General Info & Logo */}
            <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-gray-400" /> Umumiy ma&apos;lumotlar
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logotip</label>
                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center relative group cursor-pointer hover:bg-gray-100 transition-colors">
                                {logo ? (
                                    <Image src={logo} alt="Logo" className="w-full h-full object-contain p-2" width={300} height={300} />
                                ) : (
                                    <Upload className="w-8 h-8 text-gray-400" />
                                )}
                                {logo && (
                                    <button aria-label="Logotipni yangilash" className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center rounded-xl transition-all">
                                        <RefreshCcw className="w-6 h-6 text-white" />
                                    </button>
                                )}
                            </div>
                            <div className="text-sm text-gray-500 max-w-xs">
                                <p>Tavsiya etilgan o&apos;lcham: 500x500px.</p>
                                <p>Format: PNG, JPG.</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Kompaniya Nomi</label>
                        <Input placeholder="PACK24UZ" defaultValue="PACK24UZ" />
                    </div>
                </div>
            </Card>

            {/* 2. Languages & Content */}
            <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-gray-400" /> Til va Kontent
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Faol tillar</label>
                        <div className="flex gap-4">
                            {['O\'zbek', 'Русский', 'English', 'Türkçe'].map(lang => (
                                <label key={lang} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-green focus:ring-brand-green" defaultChecked={lang === 'O\'zbek'} />
                                    <span className="text-sm text-gray-700">{lang}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Asosiy til</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="main_lang" className="w-4 h-4 text-brand-green focus:ring-brand-green" defaultChecked />
                                <span className="text-sm text-gray-700">O&apos;zbek</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="main_lang" className="w-4 h-4 text-brand-green focus:ring-brand-green" />
                                <span className="text-sm text-gray-700">Русский</span>
                            </label>
                        </div>
                    </div>

                    {/* Rich Text Editor Placeholder */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Biz haqimizda (Rich Text)</label>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex gap-2">
                                {/* Toolbar placeholder */}
                                <button className="p-1 hover:bg-gray-200 rounded font-bold w-6 text-center">B</button>
                                <button className="p-1 hover:bg-gray-200 rounded italic w-6 text-center">I</button>
                                <button className="p-1 hover:bg-gray-200 rounded underline w-6 text-center">U</button>
                            </div>
                            <textarea className="w-full p-3 min-h-[100px] outline-none text-sm resize-y" placeholder="Kompaniya haqida ma'lumot..."></textarea>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 3. Contacts & Socials */}
            <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-gray-400" /> Aloqa va Ijtimoiy tarmoqlar
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon raqami</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                🇺🇿 +998
                            </span>
                            <Input className="rounded-l-none" placeholder="90 123 45 67" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram</label>
                        <Input icon={<Instagram className="w-4 h-4 text-pink-600" />} placeholder="@username" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Telegram</label>
                        <Input icon={<Send className="w-4 h-4 text-blue-500" />} placeholder="@username" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Facebook</label>
                        <Input icon={<Facebook className="w-4 h-4 text-blue-700" />} placeholder="Facebook Link" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">YouTube</label>
                        <Input icon={<Youtube className="w-4 h-4 text-red-600" />} placeholder="YouTube Channel" />
                    </div>
                </div>
            </Card>

            {/* 4. Schedule & Currency */}
            <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" /> Ish tartibi va Valyuta
                </h2>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2" id="currency-label">Asosiy Valyuta</label>
                    <select aria-labelledby="currency-label" className="w-full max-w-xs bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-green focus:border-brand-green">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Valyuta o&apos;zgarganda barcha narxlar qayta hisoblanadi.</p>
                </div>

                <div className="space-y-3">
                    {WEEKDAYS.map(day => (
                        <div key={day.id} className="flex flex-wrap items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                            <div className="w-32 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    aria-label={`${day.name} ish kunini yoqish`}
                                    className="w-4 h-4 text-brand-green rounded focus:ring-brand-green"
                                    checked={schedule[day.id].active}
                                    onChange={(e) => setSchedule({ ...schedule, [day.id]: { ...schedule[day.id], active: e.target.checked } })}
                                />
                                <span className={`text-sm ${schedule[day.id].active ? 'text-gray-900' : 'text-gray-400'}`}>{day.name}</span>
                            </div>

                            {schedule[day.id].active ? (
                                <div className="flex items-center gap-2">
                                    <input aria-label={`${day.name} boshlanish vaqti`} type="time" defaultValue={schedule[day.id].start} className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-700" />
                                    <span className="text-gray-400">-</span>
                                    <input aria-label={`${day.name} tugash vaqti`} type="time" defaultValue={schedule[day.id].end} className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-700" />
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400 italic">Dam olish kuni</span>
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            {/* 5. Map */}
            <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" /> Manzil va Xarita
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Filial Nomi (Bosh ofis)</label>
                        <Input placeholder="Bosh ofis" defaultValue="Markaziy ofis" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Manzilni qidirish</label>
                        <Input icon={<MapPin className="w-4 h-4 text-gray-400" />} placeholder="Manzilni kiriting..." />
                    </div>

                    {/* Map Stub */}
                    <div className="h-64 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-gray-200 relative group">
                        <MapPin className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">Xarita bu yerda yuklanadi</p>
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="outline" className="bg-white">
                                Koordinatalarni belgilash
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Footer Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40 flex justify-end gap-3 md:pl-64">
                <Button variant="secondary" className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-transparent">
                    Bekor qilish
                </Button>
                <Button className="bg-brand-green hover:bg-[#053d2e] shadow-lg shadow-emerald-900/20">
                    <Check className="w-4 h-4 mr-2" />
                    O&apos;zgarishlarni saqlash
                </Button>
            </div>
        </div>
    );
}
