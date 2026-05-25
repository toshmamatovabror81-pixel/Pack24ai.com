'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
    Search, Download, MapPin, Bot,
    RefreshCw, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import OrderDrawer from './_components/OrderDrawer';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = [
    { id: 'all',        label: 'Barchasi' },
    { id: 'new',        label: 'Yangi',       dot: 'bg-blue-500' },
    { id: 'processing', label: 'Jarayonda',   dot: 'bg-purple-500' },
    { id: 'shipping',   label: "Yo'lda",      dot: 'bg-amber-500' },
    { id: 'delivered',  label: 'Yetkazildi',  dot: 'bg-emerald-500' },
    { id: 'cancelled',  label: 'Bekor',       dot: 'bg-red-400' },
];

const STATUS_STYLES: Record<string, string> = {
    new:        'bg-blue-50 text-blue-700 border-blue-100',
    processing: 'bg-purple-50 text-purple-700 border-purple-100',
    shipping:   'bg-amber-50 text-amber-700 border-amber-100',
    delivered:  'bg-emerald-50 text-emerald-700 border-emerald-100',
    cancelled:  'bg-red-50 text-red-600 border-red-100',
    draft:      'bg-gray-50 text-gray-500 border-gray-100',
};

const PAGE_SIZE = 15;

function fmt(n: number) { return n.toLocaleString('ru-RU'); }

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRows() {
    return (
        <>
            {[...Array(8)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                    <td className="py-3 pl-4"><div className="h-3 bg-gray-100 rounded w-10" /></td>
                    <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100" />
                            <div>
                                <div className="h-3 bg-gray-100 rounded w-28 mb-1.5" />
                                <div className="h-2.5 bg-gray-50 rounded w-20" />
                            </div>
                        </div>
                    </td>
                    <td className="py-3 px-4"><div className="h-3 bg-gray-100 rounded w-32" /></td>
                    <td className="py-3 px-4"><div className="h-3 bg-gray-200 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-5 bg-gray-100 rounded-full w-20" /></td>
                    <td className="py-3 px-4"><div className="h-5 bg-blue-50 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="flex gap-2 justify-center"><div className="h-7 bg-gray-100 rounded-lg w-14" /><div className="h-7 bg-gray-100 rounded-lg w-8" /></div></td>
                </tr>
            ))}
        </>
    );
}

// ─── Main content ──────────────────────────────────────────────────────────────
function OrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get('search') || searchParams.get('orderId') || '';

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(initialSearch);
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [page, setPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Buyurtmalarni yuklashda xatolik");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Sync status to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (status === 'all') params.delete('status'); else params.set('status', status);
        router.replace(`?${params.toString()}`, { scroll: false });
        setPage(1);
    }, [status]);

    const handleStatusUpdate = async (id: number, newStatus: string) => {
        if (!confirm("Statusni o'zgartirmoqchimisiz?")) return;
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) { toast.success('Status yangilandi'); fetchOrders(); }
            else toast.error('Xatolik yuz berdi');
        } catch { toast.error('Tarmoq xatoligi'); }
    };

    // Filter + search + paginate
    const filtered = orders.filter(o => {
        const term = search.toLowerCase();
        const matchSearch = !term ||
            o.id?.toString().includes(term) ||
            o.customerName?.toLowerCase().includes(term) ||
            o.contactPhone?.includes(term);
        const matchStatus = status === 'all' || o.status === status;
        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const statusCounts = STATUSES.reduce((acc, s) => {
        acc[s.id] = s.id === 'all' ? orders.length : orders.filter(o => o.status === s.id).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Buyurtmalar</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Jami: {orders.length} ta</p>
                </div>
                <button
                    onClick={() => window.open('/api/admin/export?type=orders&period=90', '_blank')}
                    title="CSV yuklash"
                    aria-label="CSV yuklash"
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                >
                    <Download size={12} /> Export
                </button>
                <button
                    onClick={fetchOrders}
                    disabled={loading}
                    title="Yangilash"
                    aria-label="Yangilash"
                    className="w-9 h-9 bg-white rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw size={14} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Status tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                {STATUSES.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setStatus(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                            status === s.id
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        {s.dot && <span className={`w-2 h-2 rounded-full ${s.dot}`} />}
                        {s.label}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status === s.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                            {statusCounts[s.id]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    placeholder="ID, ism yoki telefon..."
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors bg-white"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                                <th className="py-3 pl-4 w-20">ID</th>
                                <th className="py-3 px-4">Mijoz</th>
                                <th className="py-3 px-4">Manzil</th>
                                <th className="py-3 px-4">Summa</th>
                                <th className="py-3 px-4">Holat</th>
                                <th className="py-3 px-4">Manba</th>
                                <th className="py-3 px-4 text-center">Amallar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <SkeletonRows />
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-gray-300">
                                        <div className="text-4xl mb-2">📭</div>
                                        <p className="text-sm">Buyurtmalar topilmadi</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map(order => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                                        onClick={() => { setSelectedOrder(order); setDrawerOpen(true); }}
                                    >
                                        <td className="py-3 pl-4 font-mono font-bold text-blue-600">#{order.id}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                                                    {(order.customerName?.[0] ?? '?').toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-xs">{order.customerName || "Noma'lum"}</p>
                                                    <p className="text-[10px] text-gray-400">{order.contactPhone || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 max-w-xs">
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <MapPin size={11} className="text-gray-300 flex-shrink-0" />
                                                <span className="truncate max-w-[140px]">{order.shippingAddress || '–'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-gray-900 text-xs">
                                            {fmt(order.totalAmount ?? 0)} so&apos;m
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge className={`border text-[10px] px-2 py-0.5 font-semibold ${STATUS_STYLES[order.status] ?? STATUS_STYLES.draft}`}>
                                                {STATUSES.find(s => s.id === order.status)?.label ?? order.status}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg w-fit">
                                                <Bot size={10} /> Telegram
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setDrawerOpen(true); }}
                                                    title="Ko'rish"
                                                    aria-label="Ko'rish"
                                                    className="h-7 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold flex items-center gap-1 transition-colors"
                                                >
                                                    <Eye size={11} /> Ko&apos;r
                                                </button>
                                                <button
                                                    onClick={() => window.open(`/api/orders/${order.id}/invoice`, '_blank')}
                                                    title="PDF Hisobnoma"
                                                    aria-label="PDF yuklash"
                                                    className="h-7 w-7 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                >
                                                    <Download size={11} />
                                                </button>
                                                {order.status === 'new' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(order.id, 'processing')}
                                                        className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors"
                                                    >
                                                        Qabul
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="border-t border-gray-50 px-4 py-3 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
                        </p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                aria-label="Oldingi sahifa"
                                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                aria-label="Keyingi sahifa"
                                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <OrderDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                order={selectedOrder}
            />
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function OrdersPage() {
    return (
        <Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-gray-100 rounded w-48 mb-6" /></div>}>
            <OrdersContent />
        </Suspense>
    );
}
