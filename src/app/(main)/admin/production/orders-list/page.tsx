'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Download, Printer, Factory } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface ProductionOrder {
    id: number;
    createdAt: string;
    orderNo: string;
    size: string;
    clientName: string;
    productName: string;
    sheetLength: number;
    sheetWidth: number;
    quantity: number;
    areaPerPiece: number;
    totalArea: number;
    layerCount: number;
    layer1: string;
    layer2: string;
    layer3: string;
    layer4: string;
    layer5: string;
    printType: string;
}

export default function OrdersListPage() {
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // New Order Modal State
    const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        clientName: '',
        productName: '',
        quantity: '',
        deadline: new Date().toISOString().slice(0, 16),
        size: '',
        sheetLength: '',
        sheetWidth: '',
        layerCount: '',
        layer1: '',
        layer2: '',
        layer3: '',
        layer4: '',
        layer5: '',
        printType: ''
    });

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/production/orders');
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Buyurtmalarni yuklashda xatolik");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateOrder = async () => {
        if (!formData.clientName || !formData.productName || !formData.quantity) {
            toast.error("Iltimos asosiy maydonlarni to'ldiring (Mijoz, Nomi, Soni)");
            return;
        }

        // Auto calculate area if dimensions exist
        let areaPerPiece = 0;
        let totalArea = 0;
        const length = parseFloat(formData.sheetLength);
        const width = parseFloat(formData.sheetWidth);
        const qty = parseInt(formData.quantity);

        if (!isNaN(length) && !isNaN(width)) {
            areaPerPiece = (length * width) / 1_000_000;
        }
        if (!isNaN(qty) && areaPerPiece > 0) {
            totalArea = areaPerPiece * qty;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/production/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    areaPerPiece: areaPerPiece > 0 ? areaPerPiece : undefined,
                    totalArea: totalArea > 0 ? totalArea : undefined,
                })
            });

            if (res.ok) {
                toast.success("Buyurtma qo'shildi");
                setIsNewOrderOpen(false);
                fetchOrders();
                // reset form
                setFormData({
                    clientName: '', productName: '', quantity: '', deadline: new Date().toISOString().slice(0, 16),
                    size: '', sheetLength: '', sheetWidth: '', layerCount: '',
                    layer1: '', layer2: '', layer3: '', layer4: '', layer5: '', printType: ''
                });
            } else {
                toast.error("Xatolik yuz berdi");
            }
        } catch (error) {
            toast.error("Tizim xatosi");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Factory className="text-emerald-500" />
                        ОСТАТКИ ЗАКАЗОВ (Buyurtmalar Qoldig&apos;i)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Ishlab chiqarish bo&apos;limining batafsil buyurtmalar ro&apos;yxati</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="text-slate-600 bg-white" onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-2" />
                        Chop etish
                    </Button>
                    <Button onClick={() => setIsNewOrderOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Yangi Buyurtma
                    </Button>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="text-[10px] uppercase bg-slate-50 border-b border-gray-200 font-bold text-slate-600">
                            <tr>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">Дата</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">ИД</th>
                                <th className="px-3 py-4 border-r border-gray-200">Размер</th>
                                <th className="px-3 py-4 border-r border-gray-200 min-w-[150px]">Покупатель</th>
                                <th className="px-3 py-4 border-r border-gray-200 min-w-[200px]">Наим.</th>
                                <th className="px-3 py-4 border-r border-emerald-300 bg-emerald-100 text-emerald-800 text-center">Длина<br/>(лист)</th>
                                <th className="px-3 py-4 border-r border-amber-300 bg-amber-100 text-amber-800 text-center">Ширина<br/>(лист)</th>
                                <th className="px-3 py-4 border-r border-rose-300 bg-rose-100 text-rose-800 text-center">Кол-во<br/>шт.</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">пл м2</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">общие м2</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">Слой</th>
                                <th className="px-3 py-4 border-r border-blue-200 bg-blue-50 text-center text-blue-800">1 слой</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">2 слой</th>
                                <th className="px-3 py-4 border-r border-amber-200 bg-amber-50 text-center text-amber-800">3 слой</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">4 слой</th>
                                <th className="px-3 py-4 border-r border-gray-200 text-center">5 слой</th>
                                <th className="px-3 py-4 text-center">п/б</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={17} className="px-6 py-8 text-center text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Yuklanmoqda...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={17} className="px-6 py-8 text-center text-slate-400">
                                        Buyurtmalar topilmadi
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-2 border-r border-gray-100 text-center">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center font-mono">{order.id}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-slate-600 font-medium">{order.size || '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 font-bold text-slate-800">{order.clientName}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-slate-700 whitespace-normal min-w-[200px]">{order.productName}</td>
                                        
                                        <td className="px-3 py-2 border-r border-emerald-100 bg-emerald-50/50 text-emerald-900 text-center font-bold">
                                            {order.sheetLength || '-'}
                                        </td>
                                        <td className="px-3 py-2 border-r border-amber-100 bg-amber-50/50 text-amber-900 text-center font-bold">
                                            {order.sheetWidth || '-'}
                                        </td>
                                        <td className="px-3 py-2 border-r border-rose-100 bg-rose-50/50 text-rose-900 text-center font-bold">
                                            {order.quantity.toLocaleString()}
                                        </td>
                                        
                                        <td className="px-3 py-2 border-r border-gray-100 text-center">{order.areaPerPiece ? order.areaPerPiece.toFixed(2) : '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center font-medium bg-slate-50">{order.totalArea ? order.totalArea.toFixed(2) : '-'}</td>
                                        
                                        <td className="px-3 py-2 border-r border-gray-100 text-center font-bold">{order.layerCount ? `${order.layerCount}-слой` : '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center text-slate-600 bg-blue-50/30">{order.layer1 || '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center text-slate-600">{order.layer2 || '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center text-slate-600 bg-amber-50/30">{order.layer3 || '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center text-slate-600">{order.layer4 || '-'}</td>
                                        <td className="px-3 py-2 border-r border-gray-100 text-center text-slate-600">{order.layer5 || '-'}</td>
                                        <td className="px-3 py-2 text-center text-blue-700 font-medium">{order.printType || 'б/п'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Order Modal */}
            {isNewOrderOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h3 className="text-lg font-black text-slate-800">Yangi Buyurtma Qo&apos;shish</h3>
                            <button onClick={() => setIsNewOrderOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Section 1: Asosiy */}
                            <div className="space-y-4 col-span-full md:col-span-1">
                                <h4 className="font-bold text-sm text-emerald-600 uppercase mb-2 border-b pb-1">1. Asosiy Ma&apos;lumotlar</h4>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Mijoz (Покупатель) *</label>
                                    <Input name="clientName" value={formData.clientName} onChange={handleChange} placeholder="Mijoz nomi" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Nomi (Наим.) *</label>
                                    <Input name="productName" value={formData.productName} onChange={handleChange} placeholder="Mahsulot nomi" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Miqdori (Кол-во шт.) *</label>
                                    <Input name="quantity" type="number" value={formData.quantity} onChange={handleChange} placeholder="0" className="bg-rose-50" />
                                </div>
                            </div>

                            {/* Section 2: O'lchamlar */}
                            <div className="space-y-4 col-span-full md:col-span-1">
                                <h4 className="font-bold text-sm text-blue-600 uppercase mb-2 border-b pb-1">2. O&apos;lchamlar</h4>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">O&apos;lcham (Размер)</label>
                                    <Input name="size" value={formData.size} onChange={handleChange} placeholder="masalan: 2270*1080" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Uzunlik (Длина)</label>
                                        <Input name="sheetLength" type="number" value={formData.sheetLength} onChange={handleChange} placeholder="L" className="bg-emerald-50" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Kenglik (Ширина)</label>
                                        <Input name="sheetWidth" type="number" value={formData.sheetWidth} onChange={handleChange} placeholder="W" className="bg-amber-50" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Pechat turi (п/б)</label>
                                    <Input name="printType" value={formData.printType} onChange={handleChange} placeholder="печат / б/п" />
                                </div>
                            </div>

                            {/* Section 3: Qatlamlar */}
                            <div className="space-y-4 col-span-full lg:col-span-1">
                                <h4 className="font-bold text-sm text-amber-600 uppercase mb-2 border-b pb-1">3. Qatlamlar (Слой)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500">Qatlamlar soni</label>
                                        <Input name="layerCount" type="number" value={formData.layerCount} onChange={handleChange} placeholder="masalan: 3 yoki 5" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">1-qatlam</label>
                                        <Input name="layer1" value={formData.layer1} onChange={handleChange} placeholder="kraft/pros" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">2-qatlam</label>
                                        <Input name="layer2" value={formData.layer2} onChange={handleChange} placeholder="kley/fluting" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">3-qatlam</label>
                                        <Input name="layer3" value={formData.layer3} onChange={handleChange} placeholder="pros/ang" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">4-qatlam</label>
                                        <Input name="layer4" value={formData.layer4} onChange={handleChange} placeholder="kley/pros" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500">5-qatlam</label>
                                        <Input name="layer5" value={formData.layer5} onChange={handleChange} placeholder="ang/kraft" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex gap-3 justify-end rounded-b-2xl">
                            <Button variant="outline" className="bg-white text-slate-600" onClick={() => setIsNewOrderOpen(false)}>Bekor qilish</Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[150px]" onClick={handleCreateOrder} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Saqlash"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
