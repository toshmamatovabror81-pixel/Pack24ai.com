'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

export default function NewCampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'telegram',
        content: '',
        audience: 'all',
        sentAt: '',
        status: 'draft', // 'sent' usually means send immediately, 'scheduled' for later
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Determine status based on sentAt
        const payload = {
            ...formData,
            status: formData.sentAt ? 'scheduled' : 'sent',
            sentAt: formData.sentAt || new Date().toISOString(),
            receivers: 0, // Mock initial count
        };

        try {
            const res = await fetch('/api/marketing/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                router.push('/admin/marketing/newsletter');
            } else {
                alert('Xatolik yuz berdi');
            }
        } catch (error) {
            console.error('Error creating campaign:', error);
            alert('Xatolik yuz berdi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="mb-6">
                <Link href="/admin/marketing/newsletter" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Orqaga qaytish
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Yangi xabar yaratish</h1>
                <p className="text-sm text-gray-500 mt-1">Mijozlarga yuboriladigan yangi kampaniya ma&apos;lumotlarini kiriting</p>
            </div>

            <Card className="max-w-2xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Xabar turi</label>
                        <select
                            name="type"
                            aria-label="Xabar turi"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="telegram">Telegram</option>
                            <option value="sms">SMS</option>
                            <option value="email">Email</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Auditoriya</label>
                        <select
                            name="audience"
                            aria-label="Auditoriya"
                            value={formData.audience}
                            onChange={handleChange}
                            className="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Barcha mijozlar</option>
                            <option value="active">Faol xaridorlar</option>
                            <option value="new">Yangi mijozlar (oxirgi 30 kun)</option>
                            <option value="inactive">Faol bo&apos;lmaganlar</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Xabar matni</label>
                        <textarea
                            name="content"
                            value={formData.content}
                            onChange={handleChange}
                            required
                            rows={6}
                            placeholder="Mijozlarga yuboriladigan xabar matnini kiriting..."
                            className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                        />
                        <p className="text-xs text-gray-400 text-right">
                            {formData.content.length} belgilar
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Yuborish vaqti (ixtiyoriy)</label>
                        <Input
                            type="datetime-local"
                            name="sentAt"
                            value={formData.sentAt}
                            onChange={handleChange}
                            className="w-full"
                        />
                        <p className="text-xs text-gray-500">
                            Agar bo&apos;sh qoldirilsa, xabar <strong>darhol</strong> yuboriladi.
                        </p>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <Link href="/admin/marketing/newsletter">
                            <Button variant="outline" type="button">Bekor qilish</Button>
                        </Link>
                        <Button
                            type="submit"
                            className="bg-brand-green hover:bg-[#053d2e] min-w-[120px]"
                            disabled={loading}
                        >
                            {loading ? 'Yuborilmoqda...' : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Yuborish
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
