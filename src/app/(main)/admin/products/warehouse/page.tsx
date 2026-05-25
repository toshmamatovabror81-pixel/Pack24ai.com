'use client';

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';import { Search, Plus, ArrowRightLeft, Download, AlertTriangle, ArrowRight, Home, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WarehousePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isTransferOpen, setIsTransferOpen] = useState(false);

    // Data State
    const [inventory, setInventory] = useState<UnsafeAny[]>([]);
    const [warehouses, setWarehouses] = useState<UnsafeAny[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');

    // Transfer State
    const [transferType, setTransferType] = useState<'IN' | 'OUT' | 'TRANSFER'>('TRANSFER');
    const [transferData, setTransferData] = useState({
        productId: '',
        fromWarehouseId: '',
        toWarehouseId: '',
        quantity: '',
        reason: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Warehouses
            const whRes = await fetch('/api/warehouse');
            if (whRes.ok) {
                const whData = await whRes.json();
                setWarehouses(whData);

                // Set default to main warehouse if exists
                if (whData.length > 0 && selectedWarehouseId === 'all') {
                    // keep 'all' or set to first? let's keep 'all'
                }
            }

            // Fetch Inventory
            const params = new URLSearchParams();
            if (selectedWarehouseId !== 'all') params.append('warehouseId', selectedWarehouseId);
            if (searchTerm) params.append('search', searchTerm);

            const invRes = await fetch(`/api/warehouse/inventory?${params.toString()}`);
            if (invRes.ok) {
                const invData = await invRes.json();
                setInventory(invData);
            }
        } catch (error) {
            console.error(error);
            toast.error("Ma'lumotlarni yuklashda xatolik");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWarehouseId, searchTerm]);

    const handleTransfer = async () => {
        if (!transferData.productId || !transferData.quantity) {
            toast.error("Barcha maydonlarni to'ldiring");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/warehouse/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: transferType,
                    ...transferData
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Operatsiya muvaffaqiyatli bajarildi");
                setIsTransferOpen(false);
                setTransferData({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reason: '' }); // Reset
                fetchData(); // Refresh list
            } else {
                toast.error(data.error || "Xatolik yuz berdi");
            }
        } catch (_error) {
            toast.error("Tizim xatosi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStockBadge = (count: number) => {
        if (count < 5) return <Badge variant="error" className="bg-red-50 text-red-600 border-red-100">Tugamoqda</Badge>;
        if (count < 20) return <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-100">Oz qoldi</Badge>;
        return <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-100">Yetarli</Badge>;
    };

    const getStockColor = (count: number) => {
        if (count < 5) return 'text-red-600 font-bold';
        if (count < 20) return 'text-amber-600 font-semibold';
        return 'text-gray-900';
    };

    // Calculate total stock if 'all' is selected (backend returns individual rows)
    // Actually backend returns Inventory items. If 'all', we might see duplicates for same product in diff warehouses.
    // For simpler UI, let's keep it as is.

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Omborxona <span className="text-gray-400 font-normal text-lg">/ {inventory.length} yozuv</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="bg-white text-gray-700 border-gray-200">
                        <Download className="w-4 h-4 mr-2" />
                        Eksport
                    </Button>
                    <Button
                        className="bg-[#064E3B] hover:bg-[#053d2e]"
                        onClick={() => {
                            setTransferType('IN');
                            setIsTransferOpen(true);
                        }}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Kirim qilish
                    </Button>
                </div>
            </div>

            {/* Stats / Filters */}
            <Card noPadding className="mb-6 border border-gray-100 shadow-sm rounded-[12px]">
                <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Input
                                placeholder="Mahsulot nomi..."
                                icon={<Search className="w-4 h-4" />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <select
                                aria-label="Ombor bo'yicha filtrlash"
                                className="h-10 pl-3 pr-8 bg-white border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-[#064E3B]/20 outline-none appearance-none cursor-pointer"
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            >
                                <option value="all">Barcha omborlar</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                            <Home className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setTransferType('OUT');
                                setIsTransferOpen(true);
                            }}
                            className="w-full md:w-auto text-red-600 bg-red-50 hover:bg-red-100 border-red-100"
                        >
                            Chiqim
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setTransferType('TRANSFER');
                                setIsTransferOpen(true);
                            }}
                            className="w-full md:w-auto text-[#064E3B] bg-emerald-50 hover:bg-emerald-100 border-emerald-100"
                        >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            O&apos;tkazish
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Inventory Table */}
            <Card noPadding className="overflow-hidden border border-gray-100 shadow-sm rounded-[12px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="py-4 pl-6 font-medium">Mahsulot</th>
                                <th className="py-4 px-4 font-medium">SKU</th>
                                <th className="py-4 px-4 font-medium">Ombor</th>
                                <th className="py-4 px-4 font-medium">Narx</th>
                                <th className="py-4 px-4 font-medium text-center">Qoldiq</th>
                                <th className="py-4 px-4 font-medium">Holat</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-400">Yuklanmoqda...</td>
                                </tr>
                            ) : inventory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-400">Ma&apos;lumot topilmadi</td>
                                </tr>
                            ) : inventory.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                                    <td className="py-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            {item.product.image && (
                                                <Image src={item.product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200" width={300} height={300} />
                                            )}
                                            <span className="font-medium text-gray-900 group-hover:text-[#064E3B] transition-colors">{item.product.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 font-mono text-xs text-gray-500">{item.product.sku}</td>
                                    <td className="py-4 px-4 text-gray-500">{item.warehouse.name}</td>
                                    <td className="py-4 px-4 font-medium text-gray-900">{item.product.price?.toLocaleString()}</td>
                                    <td className={`py-4 px-4 text-center font-bold ${getStockColor(item.quantity)}`}>
                                        {item.quantity}
                                    </td>
                                    <td className="py-4 px-4">
                                        {getStockBadge(item.quantity)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Operation Modal */}
            {isTransferOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            {transferType === 'IN' && <Plus className="w-5 h-5 text-emerald-600" />}
                            {transferType === 'OUT' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                            {transferType === 'TRANSFER' && <ArrowRightLeft className="w-5 h-5 text-blue-600" />}

                            {transferType === 'IN' ? "Kirim qilish" : transferType === 'OUT' ? "Chiqim qilish" : "Omborlararo o'tkazish"}
                        </h3>

                        <div className="space-y-4">
                            {transferType === 'TRANSFER' && (
                                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex-1 text-center">
                                        <span className="text-xs text-gray-400 block mb-1">QAYERDAN</span>
                                        <select
                                            aria-label="Qaysi ombordan"
                                            className="w-full bg-transparent text-sm font-semibold text-center outline-none"
                                            value={transferData.fromWarehouseId}
                                            onChange={(e) => setTransferData({ ...transferData, fromWarehouseId: e.target.value })}
                                        >
                                            <option value="">Tanlang</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1 text-center">
                                        <span className="text-xs text-gray-400 block mb-1">QAYERGA</span>
                                        <select
                                            aria-label="Qaysi omborga"
                                            className="w-full bg-transparent text-sm font-semibold text-center outline-none"
                                            value={transferData.toWarehouseId}
                                            onChange={(e) => setTransferData({ ...transferData, toWarehouseId: e.target.value })}
                                        >
                                            <option value="">Tanlang</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {transferType === 'IN' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Qaysi omborga</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm outline-none focus:ring-2 ring-[#064E3B]/20 border-[#064E3B]"
                                        value={transferData.toWarehouseId}
                                        onChange={(e) => setTransferData({ ...transferData, toWarehouseId: e.target.value })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {transferType === 'OUT' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Qaysi ombordan</label>
                                    <select
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm outline-none focus:ring-2 ring-[#064E3B]/20 border-[#064E3B]"
                                        value={transferData.fromWarehouseId}
                                        onChange={(e) => setTransferData({ ...transferData, fromWarehouseId: e.target.value })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mahsulot ID</label>
                                {/* In real app, this should be a search combo box */}
                                <Input
                                    placeholder="Mahsulot ID raqami"
                                    value={transferData.productId}
                                    onChange={(e) => setTransferData({ ...transferData, productId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Miqdori</label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={transferData.quantity}
                                    onChange={(e) => setTransferData({ ...transferData, quantity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sabab / Izoh</label>
                                <Input
                                    placeholder="Masalan: Yangi partiya"
                                    value={transferData.reason}
                                    onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button variant="secondary" className="flex-1 bg-gray-100 hover:bg-gray-200 border-transparent text-gray-700" onClick={() => setIsTransferOpen(false)}>Bekor qilish</Button>
                            <Button
                                className="flex-1 bg-[#064E3B] hover:bg-[#053d2e]"
                                onClick={handleTransfer}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Tasdiqlash"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
