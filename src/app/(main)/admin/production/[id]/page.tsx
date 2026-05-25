'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';import { ArrowLeft, CheckCircle2, Circle, Clock, AlertTriangle, Truck, Printer, Layers, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import QRCodeGenerator from '@/components/admin/QRCodeGenerator';
import { toast } from 'sonner';

// This would normally come from an API based on params.id
const mockOrderDetails = {
    id: 'ORD-1024',
    client: 'Imzo Akfa',
    product: 'Pizza Box 30x30 (Logo)',
    quantity: 3500,
    startTime: '10:00 (Bugun)',
    deadline: '18:00 (Bugun)',
    history: [
        { stage: 'Menejer Tasdiqladi', time: '09:30', done: true },
        { stage: 'Gofra List Kesish', time: '11:15', done: true, operator: 'Botir K.' },
        { stage: 'Pechat (Logo)', time: 'Jarayonda...', done: false, active: true, operator: 'Aziz R.' },
        { stage: 'Yig\'uv va Bog\'lash', time: '-', done: false },
        { stage: 'Sifat Nazorati (QC)', time: '-', done: false },
        { stage: 'Yuklash (Logistika)', time: '-', done: false },
    ]
};

export default function ProductionDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isWorkerView = searchParams.get('view') === 'worker';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [order, setOrder] = useState(mockOrderDetails);

    const handleCompleteStage = () => {
        toast.success("Bosqich muvaffaqiyatli yakunlandi!");
        toast.info("Keyingi xodimga xabar yuborildi.");
        // Simulate update
        setTimeout(() => {
            router.push('/admin/scan'); // Go back to scanner
        }, 2000);
    };

    if (isWorkerView) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col p-6 max-w-lg mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Button onClick={() => router.back()} variant="ghost" size="icon" className="shrink-0">
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Ishchi Terminali</h1>
                        <p className="text-slate-500 text-sm">{order.product}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2 animate-bounce">
                        <Layers size={48} />
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Pechat (Logo)</h2>
                        <p className="text-slate-500">Jarayonni yakunlash uchun pastdagi tugmani bosing.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl w-full border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">Buyurtma</span>
                            <span className="font-bold text-slate-800">#{params.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Miqdor</span>
                            <span className="font-bold text-slate-800">{order.quantity.toLocaleString()} ta</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleCompleteStage}
                        className="w-full py-8 text-xl font-bold bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-200 rounded-2xl transition-all active:scale-95"
                    >
                        <CheckCircle2 size={24} className="mr-2" />
                        Bosqichni Yakunlash
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Button onClick={() => router.back()} variant="ghost" size="sm">
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        Buyurtma #{params.id}
                        <span className="text-xs font-medium bg-blue-100 text-blue-600 px-2 py-1 rounded-full border border-blue-200">
                            Jarayonda
                        </span>
                    </h1>
                    <p className="text-slate-500 text-sm">To&apos;liq ishlab chiqarish tarixi</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Info Card */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b border-gray-100 pb-2">Buyurtma Tafsilotlari</h3>

                        <div className="space-y-4">
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase block">Mijoz</span>
                                <span className="text-sm font-bold text-slate-700">{order.client}</span>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase block">Mahsulot</span>
                                <span className="text-sm font-bold text-slate-700">{order.product}</span>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase block">Miqdor</span>
                                <span className="text-xl font-black text-slate-800">{order.quantity.toLocaleString()} dona</span>
                            </div>
                            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                <span className="text-xs text-red-400 font-bold uppercase block flex items-center gap-1">
                                    <Clock size={12} /> Deadline
                                </span>
                                <span className="text-sm font-bold text-red-600">{order.deadline}</span>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
                            <Button className="flex-1 bg-slate-800">
                                <FileText size={16} className="mr-2" /> Hujjatlar
                            </Button>
                            <Button variant="outline" className="flex-1 text-red-500 border-red-100 hover:bg-red-50">
                                <AlertTriangle size={16} className="mr-2" /> Stop
                            </Button>
                        </div>

                        {/* Smart ID & QR */}
                        <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center">
                            <QRCodeGenerator
                                value={`https://pack24.uz/admin/tasks/scan?id=${order.id}`}
                                size={120}
                            />
                            <div className="mt-3 text-center w-full">
                                <Button size="sm" variant="outline" className="w-full bg-white text-xs">
                                    <Printer size={14} className="mr-2" /> Yorliqni chop etish
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Stepper Timeline */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6">Ishlab chiqarish zanjiri</h3>

                        <div className="relative">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-100"></div>

                            <div className="space-y-8">
                                {order.history.map((step, index) => (
                                    <div key={index} className="relative flex gap-6 group">
                                        {/* Icon */}
                                        <div className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center shrink-0 z-10 border-4 transition-all",
                                            step.done
                                                ? "bg-emerald-500 border-emerald-100 text-white"
                                                : step.active
                                                    ? "bg-blue-500 border-blue-100 text-white animate-pulse"
                                                    : "bg-white border-gray-100 text-gray-300"
                                        )}>
                                            {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </div>

                                        {/* Content */}
                                        <div className={cn(
                                            "flex-1 p-4 rounded-xl border transition-all",
                                            step.active ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-transparent hover:bg-gray-50"
                                        )}>
                                            <div className="flex justify-between items-start">
                                                <h4 className={cn("font-bold text-sm", step.active ? "text-blue-700" : "text-slate-700")}>
                                                    {step.stage}
                                                </h4>
                                                <span className="text-xs font-mono font-medium text-slate-400">{step.time}</span>
                                            </div>
                                            {step.operator && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 bg-white/50 px-2 py-1 rounded w-fit">
                                                    <div className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold">
                                                        {step.operator.charAt(0)}
                                                    </div>
                                                    Mask&apos;ul: {step.operator}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                            <p className="text-slate-400 text-xs mb-3">Jarayonni tezlatish kerakmi?</p>
                            <div className="flex justify-center gap-4">
                                <Button variant="outline" className="text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                                    <Truck size={16} className="mr-2" />
                                    Logistikani ogohlantirish
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
