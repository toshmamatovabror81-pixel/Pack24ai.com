'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
    Truck,
    MapPin,
    Pencil,
    Plus,
    Globe,
    X,
    Check,
    Info,
    Building2
} from 'lucide-react';

interface DeliveryMethod {
    id: string;
    name: string;
    type: 'internal' | 'external';
    icon: any;
    status: 'active' | 'inactive';
    details?: string;
    price?: number;
    isFree?: boolean;
}

const INITIAL_METHODS: DeliveryMethod[] = [
    {
        id: 'pickup',
        name: 'Olib ketish',
        type: 'internal',
        icon: Building2,
        status: 'active',
        details: 'Toshkent sh, Chilonzor tumani, 19-mavze'
    },
    {
        id: 'delivery',
        name: 'Yetkazib berish',
        type: 'internal',
        icon: Truck,
        status: 'active',
        details: 'Toshkent bo\'ylab',
        isFree: true
    }
];

const EXTERNAL_SERVICES = [
    { id: 'fargo', name: 'FARGO', logo: 'F', color: 'bg-red-600' },
    { id: 'uzpost', name: 'UZPOST', logo: 'U', color: 'bg-blue-600' }
];

export default function DeliveryPage() {
    const [internalMethods] = useState(INITIAL_METHODS);
    const [connectedServices, setConnectedServices] = useState<string[]>([]);

    // Modals
    const [isInternalModalOpen, setIsInternalModalOpen] = useState(false);
    const [editingInternal, setEditingInternal] = useState<DeliveryMethod | null>(null);

    const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);
    const [selectedExternal, setSelectedExternal] = useState<typeof EXTERNAL_SERVICES[0] | null>(null);

    const handleEditInternal = (method: DeliveryMethod) => {
        setEditingInternal(method);
        setIsInternalModalOpen(true);
    };

    const handleAddExternal = (service: typeof EXTERNAL_SERVICES[0]) => {
        setSelectedExternal(service);
        setIsExternalModalOpen(true);
    };

    const saveInternal = () => {
        setIsInternalModalOpen(false);
        setEditingInternal(null);
        // Logic to update state would go here
    };

    const connectExternal = () => {
        if (selectedExternal) {
            setConnectedServices([...connectedServices, selectedExternal.id]);
            setIsExternalModalOpen(false);
            setSelectedExternal(null);
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Yetkazib berish</h1>
                    <p className="text-sm text-gray-500 mt-1">Yetkazib berish turlari va kuryerlik xizmatlari</p>
                </div>
            </div>

            {/* 1. Internal Delivery */}
            <section>
                <div className="grid md:grid-cols-2 gap-6">
                    {internalMethods.map((method) => (
                        <Card key={method.id} className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                        <method.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{method.name}</h3>
                                        {method.status === 'active' && (
                                            <Badge className="bg-emerald-100 text-emerald-700 border-none mt-1">Faol</Badge>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleEditInternal(method)}
                                    aria-label="Tahrirlash"
                                    className="p-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2 mt-2">
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
                                    <span>{method.details}</span>
                                </div>
                                {method.isFree && (
                                    <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-1 rounded-md">
                                        <Check className="w-3 h-3" />
                                        Yetkazib berish bepul
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* 2. External Services */}
            <section>
                <h2 className="text-xl font-bold text-[#1e3a8a] mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Tashqi yetkazib berish xizmatlari
                </h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {EXTERNAL_SERVICES.map((service) => (
                        <Card key={service.id} className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${service.color}`}>
                                    {service.logo}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{service.name}</h3>
                                    <p className="text-xs text-gray-500">Kuryerlik xizmati</p>
                                </div>
                            </div>

                            {connectedServices.includes(service.id) ? (
                                <Badge className="bg-blue-50 text-blue-700 border-none">Ulanlangan</Badge>
                            ) : (
                                <Button
                                    onClick={() => handleAddExternal(service)}
                                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                    variant="outline"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Qo'shish
                                </Button>
                            )}
                        </Card>
                    ))}
                </div>
            </section>

            {/* Edit Internal Modal */}
            {isInternalModalOpen && editingInternal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsInternalModalOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 mb-6">{editingInternal.name}ni tahrirlash</h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Manzil / Hudud</label>
                                <div className="relative">
                                    <Input defaultValue={editingInternal.details} />
                                    <MapPin className="absolute right-3 top-3 text-gray-400 w-4 h-4" />
                                </div>
                                <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline">Xaritadan belgilash</p>
                            </div>

                            {!editingInternal.isFree && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Narx (so'm)</label>
                                    <Input type="number" placeholder="0" />
                                </div>
                            )}

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Hududiy narxlar (Tez orada)</p>
                                        <p className="text-xs text-gray-500">Har bir tuman yoki shahar uchun alohida narx belgilash imkoniyati.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setIsInternalModalOpen(false)} className="flex-1">Bekor qilish</Button>
                                <Button onClick={saveInternal} className="flex-1 bg-[#064E3B] hover:bg-[#053d2e]">Saqlash</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* External Service Modal */}
            {isExternalModalOpen && selectedExternal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsExternalModalOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-4 mb-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${selectedExternal.color}`}>
                                {selectedExternal.logo}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedExternal.name} integratsiyasi</h2>
                                <p className="text-sm text-gray-500">Shartnoma ma'lumotlarini kiriting</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
                                <Input type="password" placeholder="****************" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Shartnoma raqami</label>
                                <Input placeholder="Masalan: 123-456-789" />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setIsExternalModalOpen(false)} className="flex-1">Bekor qilish</Button>
                                <Button onClick={connectExternal} className="flex-1 bg-[#064E3B] hover:bg-[#053d2e]">Ulash</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
