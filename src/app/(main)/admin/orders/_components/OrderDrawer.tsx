'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    X,
    Printer,
    MapPin,
    User,
    Calendar,
    Truck,
    CheckCircle2,
    Clock,
    Package,
    Factory
} from 'lucide-react';

/** API list row plus optional richer fields used by the drawer / print mock */
export interface AdminOrderDrawerPayload {
    id: number;
    status: string;
    statusLabel?: string;
    date?: string;
    createdAt?: string | null;
    customerName?: string | null;
    contactPhone?: string | null;
    shippingAddress?: string | null;
    customer?: {
        name: string;
        phone: string;
        address: string;
    };
    items?: unknown;
    totalAmount?: number | null;
    totalSum?: string;
    finalTotal?: string;
}

interface OrderDrawerLine {
    name: string;
    ikpu: string;
    qty: number;
    price: string;
    total: string;
}

function normalizeDrawerItems(raw: unknown): OrderDrawerLine[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item): OrderDrawerLine => {
        if (item && typeof item === 'object') {
            const o = item as Record<string, unknown>;
            const prod = o.product && typeof o.product === 'object' ? (o.product as Record<string, unknown>) : undefined;
            const name =
                typeof o.name === 'string'
                    ? o.name
                    : typeof prod?.name === 'string'
                      ? prod.name
                      : 'Mahsulot';
            const qty = Number(o.qty ?? o.quantity ?? 0);
            const priceRaw = Number(o.price ?? 0);
            const priceStr =
                typeof o.price === 'string' ? o.price : `${priceRaw.toLocaleString('ru-RU')} so'm`;
            const totalNum =
                typeof o.total === 'number'
                    ? o.total
                    : typeof o.total === 'string'
                      ? Number.parseFloat(o.total)
                      : priceRaw * (Number.isFinite(qty) ? qty : 0);
            const totalStr =
                typeof o.total === 'string'
                    ? o.total
                    : `${(Number.isFinite(totalNum) ? totalNum : 0).toLocaleString('ru-RU')} so'm`;
            const ikpu = typeof o.ikpu === 'string' ? o.ikpu : '—';
            return { name, ikpu, qty: Number.isFinite(qty) ? qty : 0, price: priceStr, total: totalStr };
        }
        return { name: 'Mahsulot', ikpu: '—', qty: 0, price: '0', total: '0' };
    });
}

interface OrderDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    order: AdminOrderDrawerPayload | null;
}

export default function OrderDrawer({ isOpen, onClose, order }: OrderDrawerProps) {
    if (!isOpen || !order) return null;

    const customer =
        order.customer ?? {
            name: order.customerName ?? '—',
            phone: order.contactPhone ?? '—',
            address: order.shippingAddress ?? '—',
        };
    const displayDate =
        order.date ??
        (order.createdAt ? new Date(order.createdAt).toLocaleString('uz-UZ') : '—');
    const drawerLines = normalizeDrawerItems(order.items);
    const totalSumDisplay =
        order.totalSum ??
        `${(order.totalAmount ?? 0).toLocaleString('ru-RU')} so'm`;
    const finalTotalDisplay = order.finalTotal ?? totalSumDisplay;
    const statusLabelDisplay = order.statusLabel ?? order.status;

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end print:hidden">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                {/* Drawer */}
                <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-xl font-bold text-gray-900">Buyurtma #{order.id}</h2>
                                <Badge className={`${order.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {order.status === 'new' ? 'Yangi' : statusLabelDisplay}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> {displayDate}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="hidden sm:flex"
                                aria-label="Chop etish"
                                onClick={handlePrint}
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                Chop etish
                            </Button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Yopish">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Customer & Delivery */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <User className="w-4 h-4 text-emerald-600" /> Mijoz ma&apos;lumotlari
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Mijoz:</span>
                                        <span className="text-sm font-medium">{customer.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Telefon:</span>
                                        <span className="text-sm font-medium font-mono">{customer.phone}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200">
                                        <div className="flex items-start gap-2 text-sm text-gray-700">
                                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                            {customer.address}
                                        </div>
                                        <div className="mt-2 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">
                                            Xarita Preview
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-emerald-600" /> Logistika
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Filialga biriktirish</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" aria-label="Filialni tanlash">
                                            <option>Markaziy ofis</option>
                                            <option>Chilonzor Filiali</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Kuryer biriktirish</label>
                                        <select className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" aria-label="Kuryerni tanlash">
                                            <option value="">Tanlanmagan</option>
                                            <option>Azizov B. (Yandex)</option>
                                            <option>Karimov D. (MyTaxi)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Package className="w-4 h-4 text-emerald-600" /> Savatcha
                            </h3>
                            <div className="border border-gray-200 rounded-[12px] overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Mahsulot</th>
                                            <th className="px-4 py-3 font-medium text-center">Soni</th>
                                            <th className="px-4 py-3 font-medium text-right">Narx</th>
                                            <th className="px-4 py-3 font-medium text-right">Jami</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {drawerLines.map((item, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">{item.name}</p>
                                                    <p className="text-xs text-gray-500">IKPU: {item.ikpu}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">{item.qty}</td>
                                                <td className="px-4 py-3 text-right">{item.price}</td>
                                                <td className="px-4 py-3 text-right font-medium">{item.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Jami summa:</td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900">{totalSumDisplay}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Yetkazib berish:</td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900">20 000 so&apos;m</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-900 text-lg border-t border-gray-200">Yakuniy:</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600 text-lg border-t border-gray-200">{finalTotalDisplay}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-600" /> Status tarixi
                            </h3>
                            <div className="relative pl-4 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                                {[
                                    { status: 'Yangi buyurtma', time: '14:30', active: true },
                                    { status: 'Operator qabul qildi', time: '14:35', active: true },
                                    { status: 'Kuryerga berildi', time: '14:45', active: false },
                                    { status: 'Yetkazildi', time: '-', active: false },
                                ].map((step, i) => (
                                    <div key={i} className="relative flex items-center gap-4">
                                        <div className={`absolute -left-4 w-2.5 h-2.5 rounded-full border-2 ${step.active ? 'bg-emerald-500 border-white ring-2 ring-emerald-100' : 'bg-gray-200 border-white'
                                            }`} />
                                        <div className="flex-1 flex justify-between items-center">
                                            <span className={`text-sm ${step.active ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                                                {step.status}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">{step.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ERP / Task Automation Section */}
                    <div className="border-t border-gray-100 p-6 bg-slate-50">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            Smart Task Automation
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                onClick={() => {
                                    alert("Vazifa #TSK-2093 yaratildi: 'Omborchi (Faxriyor)'ga 350 ta qadoqlash buyurildi.");
                                }}
                            >
                                <div className="flex items-center gap-2 font-bold">
                                    <Package size={16} /> Omborga
                                </div>
                                <span className="text-[10px] opacity-70">Tayyor mahsulot (Qadoqlash)</span>
                            </Button>

                            <Button variant="outline" className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                onClick={() => {
                                    alert("Ishlab chiqarishga yuborildi: 'X-Pack' hamkor korxonasi tanlandi (Deadline: 15.01.2025)");
                                }}
                            >
                                <div className="flex items-center gap-2 font-bold">
                                    <Factory size={16} /> Ishlab Chiqarish
                                </div>
                                <span className="text-[10px] opacity-70">B2B / Katta hajm</span>
                            </Button>
                        </div>

                        {/* Automated Timeline Preview */}
                        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-200 pt-3 opacity-60">
                            <span>Order #1024</span>
                            <span>→</span>
                            <span className="text-indigo-500 font-bold">Warehouse</span>
                            <span>→</span>
                            <span>Logistics</span>
                            <span>→</span>
                            <span>Client</span>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                        <Button variant="secondary" className="flex-1 bg-white border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200">
                            Bekor qilish
                        </Button>
                        <Button className="flex-[2] bg-[#064E3B] hover:bg-[#053d2e] shadow-lg shadow-emerald-900/10">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Qabul qilish & Tayyorlash
                        </Button>
                    </div>
                </div>

            </div>

            {/* Print Layout (Only visible when printing) */}
            <div className="hidden print:block p-4 font-mono text-xs w-[80mm] mx-auto">
                <div className="text-center mb-4 border-b border-black pb-4">
                    <h1 className="text-xl font-bold mb-1">PACK24.UZ</h1>
                    <p className="text-[10px]">O&apos;zbekistondagi eng katta qadoqlash<br />mahsulotlari do&apos;koni</p>
                    <p className="mt-2 font-bold">Buyurtma #{order.id}</p>
                    <p className="text-[10px]">{displayDate}</p>
                </div>

                <div className="mb-4 text-[10px]">
                    <p><span className="font-bold">Mijoz:</span> {customer.name}</p>
                    <p><span className="font-bold">Tel:</span> {customer.phone}</p>
                    <p className="mt-1"><span className="font-bold">Manzil:</span> {customer.address}</p>
                </div>

                <table className="w-full text-left mb-4">
                    <thead className="border-b border-black border-dashed">
                        <tr>
                            <th className="py-1">Mahsulot</th>
                            <th className="py-1 text-right">Soni</th>
                            <th className="py-1 text-right">Jami</th>
                        </tr>
                    </thead>
                    <tbody className="border-b border-black border-dashed">
                        {drawerLines.map((item, i) => (
                            <tr key={i}>
                                <td className="py-2 pr-2">
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-[9px] text-gray-600">{item.ikpu}</div>
                                </td>
                                <td className="py-2 text-right align-top">{item.qty}</td>
                                <td className="py-2 text-right align-top">{item.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="space-y-1 text-right font-bold mb-6">
                    <div className="flex justify-between">
                        <span>Jami:</span>
                        <span>{totalSumDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Yetkazib berish:</span>
                        <span>20 000 so&apos;m</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-black">
                        <span>TO&apos;LOV:</span>
                        <span>{finalTotalDisplay}</span>
                    </div>
                </div>

                <div className="text-center text-[10px]">
                    <p>Xaridingiz uchun rahmat!</p>
                    <p className="mt-1 font-bold">www.pack24.uz</p>
                    <p>+998 71 200 00 00</p>
                </div>
            </div>
        </>
    );
}
