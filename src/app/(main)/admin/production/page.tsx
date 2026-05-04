'use client';

import { useState, useEffect } from 'react';
import {
    Factory,
    Layers,
    Printer,
    Box,
    CheckCircle2,
    Clock,
    ChevronRight,
    Plus,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface ProductionOrder {
    id: number;
    orderNo: string;
    clientName: string;
    productName: string;
    quantity: number;
    deadline: string;
    currentStage: string;
    progress: number;
    status: string;
    stages: any[];
}

export default function ProductionDashboard() {
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'delayed'>('all');

    // New Order State
    const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
    const [newOrder, setNewOrder] = useState({
        clientName: '',
        productName: '',
        quantity: '',
        deadline: '',
        priority: 'normal'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/production/orders');
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (_error) {
            console.error(_error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        // Poll every 10 seconds for "Live" feel
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateOrder = async () => {
        if (!newOrder.clientName || !newOrder.productName || !newOrder.quantity || !newOrder.deadline) {
            toast.error("Barcha maydonlarni to'ldiring");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/production/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrder)
            });

            if (res.ok) {
                toast.success("Buyurtma yaratildi");
                setIsNewOrderOpen(false);
                setNewOrder({ clientName: '', productName: '', quantity: '', deadline: '', priority: 'normal' });
                fetchOrders();
            } else {
                toast.error("Xatolik yuz berdi");
            }
        } catch (_error) {
            toast.error("Tizim xatosi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === 'delayed');

    const getStageIcon = (stage: string) => {
        switch (stage) {
            case 'gofra': return <Layers size={16} />;
            case 'pechat': return <Printer size={16} />;
            case 'yiguv': return <Box size={16} />;
            case 'qc': return <CheckCircle2 size={16} />;
            default: return <Factory size={16} />;
        }
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'gofra': return "text-emerald-600 bg-emerald-100";
            case 'pechat': return "text-blue-600 bg-blue-100";
            case 'yiguv': return "text-amber-600 bg-amber-100";
            case 'qc': return "text-purple-600 bg-purple-100";
            default: return "text-slate-600 bg-slate-100";
        }
    };

    const getOperator = (order: ProductionOrder) => {
        const currentStageData = order.stages?.find((s: any) => s.stage === order.currentStage);
        return currentStageData?.operator || 'Tayinlanmagan';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Factory className="text-emerald-500" />
                        Ishlab Chiqarish (Live)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Hozirgi vaqtda sexlardagi holat va buyurtmalar ijrosi</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsNewOrderOpen(true)} className="bg-[#064E3B] hover:bg-[#053d2e]">
                        <Plus className="w-4 h-4 mr-2" />
                        Yangi Buyurtma
                    </Button>
                </div>
            </div>

            {/* Stats Overview (Live Counts) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['gofra', 'pechat', 'yiguv', 'qc'].map((stage) => {
                    const count = orders.filter(o => o.currentStage === stage && o.status !== 'completed').length;
                    return (
                        <div key={stage} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div className={cn("p-2 rounded-lg", getStageColor(stage).replace('text-', 'text-').replace('bg-', 'bg-'))}>
                                    {getStageIcon(stage)}
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase">{stage} Sexi</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">{count}</h3>
                            <p className="text-xs text-slate-500 font-bold flex items-center gap-1 mt-1">
                                <Clock size={12} /> jarayonda
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Active Orders List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">Faol Buyurtmalar</h3>
                    <div className="flex gap-2 text-xs">
                        <button
                            onClick={() => setFilter('all')}
                            className={cn("px-3 py-1 rounded-md font-bold transition-all", filter === 'all' ? "bg-white shadow text-slate-800" : "text-slate-500")}
                        >
                            Barchasi
                        </button>
                        <button
                            onClick={() => setFilter('delayed')}
                            className={cn("px-3 py-1 rounded-md font-bold transition-all", filter === 'delayed' ? "bg-red-100 text-red-600" : "text-slate-500")}
                        >
                            Muammoli
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {isLoading ? (
                        <div className="p-8 text-center text-slate-400">Yuklanmoqda...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">Hozirda faol buyurtmalar yo'q</div>
                    ) : (
                        filteredOrders.map((order) => (
                            <div key={order.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row items-center gap-4">
                                {/* Order Info */}
                                <div className="flex-1 min-w-[200px]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-black text-slate-800">{order.orderNo}</span>
                                        {order.status === 'delayed' && (
                                            <Badge variant="error" className="py-0 px-1.5 text-[10px]">KECIKMOQDA</Badge>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-slate-700 text-sm truncate">{order.productName}</h4>
                                    <p className="text-xs text-slate-500">{order.clientName}</p>
                                </div>

                                {/* Stage Visualizer */}
                                <div className="flex-[2] w-full">
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                        <span className={cn("flex items-center gap-1 font-bold uppercase", getStageColor(order.currentStage))}>
                                            {getStageIcon(order.currentStage)}
                                            {order.currentStage}
                                        </span>
                                        <span>Operator: {getOperator(order)}</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000 relative w-[var(--progress)]",
                                                order.status === 'delayed' ? "bg-red-500" : "bg-emerald-500"
                                            )}
                                            style={{ '--progress': `${order.progress}%` } as React.CSSProperties}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-4 min-w-[150px] justify-end">
                                    <div className="text-right">
                                        <span className="block font-bold text-slate-800 text-sm">{order.quantity.toLocaleString()} ta</span>
                                        <span className="text-[10px] text-slate-400 font-bold">{new Date(order.deadline).toLocaleDateString()}</span>
                                    </div>
                                    {/* Link to detail page (to be implemented) */}
                                    <Button size="sm" variant="ghost" className="bg-slate-100 hover:bg-slate-200 text-slate-600">
                                        Ko'rish <ChevronRight size={14} className="ml-1" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* New Order Modal */}
            {isNewOrderOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Yangi Ishlab Chiqarish Buyurtmasi</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Mijoz</label>
                                <Input
                                    value={newOrder.clientName}
                                    onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
                                    placeholder="Mijoz nomi"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Mahsulot</label>
                                <Input
                                    value={newOrder.productName}
                                    onChange={(e) => setNewOrder({ ...newOrder, productName: e.target.value })}
                                    placeholder="Mahsulot nomi"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Miqdori</label>
                                <Input
                                    type="number"
                                    value={newOrder.quantity}
                                    onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Muddat</label>
                                <Input
                                    type="datetime-local"
                                    value={newOrder.deadline}
                                    onChange={(e) => setNewOrder({ ...newOrder, deadline: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="secondary" className="flex-1" onClick={() => setIsNewOrderOpen(false)}>Bekor qilish</Button>
                            <Button className="flex-1" onClick={handleCreateOrder} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Yaratish"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
