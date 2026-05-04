'use client';

import { useState } from 'react';
import {
    MessageSquare,
    CheckCircle2,
    XCircle,
    Search,
    MoreHorizontal,
    Star,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// --- Types ---
type ReviewStatus = 'new' | 'approved' | 'rejected';

interface ReviewItem {
    id: number;
    user: {
        name: string;
        avatar: string;
        email: string;
    };
    productName: string;
    content: string;
    rating: number;
    date: string;
    status: ReviewStatus;
}

// --- Mock Data (Migrated from Chat) ---
const initialReviews: ReviewItem[] = [
    {
        id: 1,
        user: { name: 'Aziz Rakhimov', avatar: 'A', email: 'aziz@example.com' },
        productName: 'Antigravity GPT-4',
        content: 'Juda ajoyib model! O\'zbek tilini mukammal tushunadi. Tavsiya qilaman.',
        rating: 5,
        date: '10:45 AM',
        status: 'new'
    },
    {
        id: 3,
        user: { name: 'Jahongir O.', avatar: 'J', email: 'jahon@mail.ru' },
        productName: 'Telegram Bot Integration',
        content: 'O\'rnatish biroz qiyin bo\'ldi, lekin ishlashi zo\'r.',
        rating: 4,
        date: 'Kecha',
        status: 'new' // Changed from 'pending' to 'new' for simplicity in this view
    },
    {
        id: 5,
        user: { name: 'Malika Karimova', avatar: 'M', email: 'malika@test.uz' },
        productName: 'SEO Content Writer',
        content: 'Matn sifati kutilganidan pastroq. Yana ishlash kerak.',
        rating: 3,
        date: '2 kun oldin',
        status: 'rejected'
    }
];

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
    const [filter, setFilter] = useState<'all' | 'new' | 'approved' | 'rejected'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredReviews = reviews.filter(review => {
        const matchesFilter = filter === 'all' || review.status === filter;
        const matchesSearch = review.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            review.user.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleStatusChange = (id: number, newStatus: ReviewStatus) => {
        setReviews(reviews.map(r => r.id === id ? { ...r, status: newStatus } : r));
    };

    const handleDelete = (id: number) => {
        if (confirm("Haqiqatan ham ushbu sharhni o'chirmoqchimisiz?")) {
            setReviews(reviews.filter(r => r.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Mijozlar Sharhlari</h1>
                    <p className="text-slate-500 text-sm mt-1">Mahsulotlar bo'yicha fikr-mulohazalar moderatsiyasi</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Qidirish..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-white p-1 rounded-xl border border-gray-100 w-fit">
                {(['all', 'new', 'approved', 'rejected'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all",
                            filter === tab
                                ? "bg-slate-800 text-white shadow-md"
                                : "text-slate-500 hover:text-slate-700 hover:bg-gray-50"
                        )}
                    >
                        {tab === 'all' ? 'Barchasi' : tab === 'new' ? 'Yangilar' : tab === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
                    </button>
                ))}
            </div>

            {/* Reviews Grid */}
            <div className="grid gap-4">
                {filteredReviews.map((review) => (
                    <div key={review.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                        {/* User Info */}
                        <div className="flex items-center gap-4 min-w-[200px]">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm">
                                {review.user.avatar}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{review.user.name}</h3>
                                <p className="text-xs text-slate-500">{review.user.email}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{review.date}</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex text-amber-400">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} size={14} className={star <= review.rating ? "fill-current" : "text-gray-200"} />
                                    ))}
                                </div>
                                <span className="text-xs font-bold text-slate-400">•</span>
                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    {review.productName}
                                </span>
                                {review.status === 'new' && <Badge variant="warning" className="ml-2">Yangi</Badge>}
                                {review.status === 'approved' && <Badge variant="success" className="ml-2">Tasdiqlangan</Badge>}
                                {review.status === 'rejected' && <Badge variant="error" className="ml-2">Rad etilgan</Badge>}
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">"{review.content}"</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 md:border-l md:pl-6 md:border-gray-50">
                            {review.status === 'new' && (
                                <>
                                    <Button
                                        onClick={() => handleStatusChange(review.id, 'approved')}
                                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100"
                                        size="sm"
                                        title="Tasdiqlash"
                                        aria-label="Tasdiqlash"
                                    >
                                        <CheckCircle2 size={18} />
                                    </Button>
                                    <Button
                                        onClick={() => handleStatusChange(review.id, 'rejected')}
                                        className="bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
                                        size="sm"
                                        title="Rad etish"
                                        aria-label="Rad etish"
                                    >
                                        <XCircle size={18} />
                                    </Button>
                                </>
                            )}
                            {(review.status === 'approved' || review.status === 'rejected') && (
                                <Button
                                    onClick={() => handleStatusChange(review.id, 'new')}
                                    variant="outline"
                                    size="sm"
                                    title="Qayta ko'rib chiqish"
                                    aria-label="Qayta ko'rib chiqish"
                                >
                                    <MoreHorizontal size={18} />
                                </Button>
                            )}
                            <Button
                                onClick={() => handleDelete(review.id)}
                                variant="ghost"
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                                size="sm"
                                title="O'chirish"
                                aria-label="O'chirish"
                            >
                                <Trash2 size={18} />
                            </Button>
                        </div>
                    </div>
                ))}

                {filteredReviews.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
                        <MessageSquare className="mx-auto text-gray-300 mb-3" size={48} />
                        <h3 className="text-slate-800 font-bold">Sharhlar topilmadi</h3>
                        <p className="text-slate-500 text-sm">Filtrni o'zgartirib ko'ring yoki yangi sharhlarni kuting.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
