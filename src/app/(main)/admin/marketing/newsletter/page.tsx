'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Plus, Send, MessageCircle, Mail, Smartphone, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';

interface NewsletterCampaign {
    id: number;
    type: string;
    content: string;
    audience: string;
    sentAt: string | null;
    receivers: number;
    views?: number;
    status: string;
}

export default function NewsletterPage() {
    const [campaigns, setCampaigns] = React.useState<NewsletterCampaign[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchCampaigns = async () => {
        try {
            const res = await fetch('/api/marketing/campaigns');
            if (res.ok) {
                const data = (await res.json()) as NewsletterCampaign[];
                setCampaigns(data);
            }
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchCampaigns();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Haqiqatan ham bu kampaniyani o\'chirmoqchimisiz?')) return;

        try {
            const res = await fetch(`/api/marketing/campaigns/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setCampaigns(campaigns.filter(c => c.id !== id));
            } else {
                alert('O\'chirishda xatolik yuz berdi');
            }
        } catch (error) {
            console.error('Error deleting campaign:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'telegram': return <MessageCircle className="w-5 h-5 text-blue-500" />;
            case 'sms': return <Smartphone className="w-5 h-5 text-amber-500" />;
            case 'email': return <Mail className="w-5 h-5 text-indigo-500" />;
            default: return <Send className="w-5 h-5" />;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('uz-UZ', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Rassilka (Xabarnomalar)</h1>
                    <p className="text-sm text-gray-500 mt-1">Mijozlarga ommaviy xabar yuborish va tarixni kuzatish</p>
                </div>
                <Link href="/admin/marketing/newsletter/new">
                    <Button className="bg-[#064E3B] hover:bg-[#053d2e]">
                        <Plus className="w-4 h-4 mr-2" />
                        Yangi xabar yaratish
                    </Button>
                </Link>
            </div>

            <Card noPadding className="border border-gray-100 shadow-sm rounded-[12px] overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Yuklanmoqda...</div>
                ) : campaigns.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Hozircha hech qanday kampaniya yo&apos;q</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="py-4 pl-6 font-medium">Xabar turi</th>
                                <th className="py-4 px-4 font-medium">Kontent</th>
                                <th className="py-4 px-4 font-medium">Auditoriya</th>
                                <th className="py-4 px-4 font-medium">Vaqt</th>
                                <th className="py-4 px-4 font-medium text-center">Statistika</th>
                                <th className="py-4 px-4 font-medium">Holat</th>
                                <th className="py-4 px-6 font-medium text-right">Amallar</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                            {campaigns.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                                                {getIcon(item.type)}
                                            </div>
                                            <span className="capitalize font-medium text-gray-900">{item.type}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 max-w-xs">
                                        <p className="truncate text-gray-600">{item.content}</p>
                                    </td>
                                    <td className="py-4 px-4">
                                        <Badge variant="neutral" className="bg-gray-100 text-gray-600">{item.audience}</Badge>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500 text-xs">
                                        {item.status === 'sent' ? 'Yuborildi:' : 'Rejalashtirildi:'} <br />
                                        <span className="font-medium text-gray-900">{formatDate(item.sentAt)}</span>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-gray-400">Qabul qiluvchilar</span>
                                            <span className="font-bold text-gray-900">{item.receivers}</span>
                                            {item.status === 'sent' && (
                                                <span className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                                                    <Eye className="w-3 h-3" /> {item.views}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        {item.status === 'sent'
                                            ? <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none">Yuborilgan</Badge>
                                            : <Badge variant="warning" className="bg-amber-100 text-amber-700 border-none">Kutilmoqda</Badge>
                                        }
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            aria-label="O'chirish"
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
