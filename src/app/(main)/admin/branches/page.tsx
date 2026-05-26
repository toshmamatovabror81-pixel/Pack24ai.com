'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
    Search,
    Plus,
    ToggleLeft,
    ToggleRight,
    MapPin,
    Copy,
    Check,
    Pencil,
    Trash2,
    GripVertical,
    X,
    Info
} from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    address: string;
    groupId: string;
    status: 'active' | 'inactive';
}

const INITIAL_BRANCHES: Branch[] = [
    {
        id: 1,
        name: 'Chilonzor Filiali',
        address: 'Toshkent sh, Chilonzor tumani, 19-mavze, 4-uy',
        groupId: '-100123456789',
        status: 'active'
    },
    {
        id: 2,
        name: 'Yunusobod Filiali',
        address: 'Toshkent sh, Yunusobod tumani, 4-mavze, 12-uy',
        groupId: '-100987654321',
        status: 'active'
    }
];

export default function BranchesPage() {
    const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    const handleCopy = (id: number, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleStatus = (id: number) => {
        setBranches(branches.map(b => b.id === id ? { ...b, status: b.status === 'active' ? 'inactive' : 'active' } : b));
    };

    const handleDelete = (id: number) => {
        if (confirm('Rostdan ham bu filialni o\'chirmoqchimisiz?')) {
            setBranches(branches.filter(b => b.id !== id));
        }
    };

    const openEditModal = (branch: Branch) => {
        setEditingBranch(branch);
        setIsModalOpen(true);
    };

    const openAddModal = () => {
        setEditingBranch(null);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Filiallar</h1>
                    <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none px-2 py-0.5 rounded-lg text-sm font-medium">
                        {branches.length} Filial
                    </Badge>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Input
                            placeholder="Filial nomi bo'yicha qidirish"
                            icon={<Search className="w-4 h-4 text-gray-400" />}
                            className="bg-white border-gray-200 pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={openAddModal} className="bg-brand-green hover:bg-[#053d2e] shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Filial qo&apos;shish
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[12px] border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="py-4 pl-6 w-12"></th>
                            <th className="py-4 px-4 font-medium">Filial Nomi</th>
                            <th className="py-4 px-4 font-medium">Manzil</th>
                            <th className="py-4 px-4 font-medium">Group ID</th>
                            <th className="py-4 px-4 font-medium">Holat</th>
                            <th className="py-4 px-6 font-medium text-right">Harakatlar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {branches
                            .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((branch) => (
                                <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="py-4 pl-6">
                                        <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="font-semibold text-gray-900">{branch.name}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <a
                                            href={`https://maps.google.com/?q=${encodeURIComponent(branch.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors max-w-xs truncate"
                                            title={branch.address}
                                        >
                                            <div className="p-1.5 bg-gray-100 rounded-lg shrink-0">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm truncate">{branch.address}</span>
                                        </a>
                                    </td>
                                    <td className="py-4 px-4">
                                        <button
                                            onClick={() => handleCopy(branch.id, branch.groupId)}
                                            className="inline-flex items-center gap-2 text-sm font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 hover:bg-white transition-all"
                                        >
                                            {branch.groupId}
                                            {copiedId === branch.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                                        </button>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium ${branch.status === 'active' ? 'text-green-700' : 'text-gray-500'}`}>
                                                {branch.status === 'active' ? 'Faol' : 'Faol emas'}
                                            </span>
                                            <button
                                                onClick={() => toggleStatus(branch.id)}
                                                className="text-gray-300 hover:text-brand-green transition-colors"
                                                aria-label={branch.status === 'active' ? 'Faolsizlantirish' : 'Faollashtirish'}
                                            >
                                                {branch.status === 'active' ? <ToggleRight className="w-9 h-9 text-brand-green" /> : <ToggleLeft className="w-9 h-9" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(branch)}
                                                className="p-2 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors"
                                                aria-label="Tahrirlash"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(branch.id)}
                                                className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                                aria-label="O'chirish"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
                {branches.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        Filiallar topilmadi
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsModalOpen(false)} aria-label="Yopish" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 mb-6">{editingBranch ? 'Filialni tahrirlash' : 'Yangi filial qo\'shish'}</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Filial Nomi</label>
                                <Input
                                    placeholder="Masalan: Chilonzor Filiali"
                                    defaultValue={editingBranch?.name}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Manzil</label>
                                <div className="relative">
                                    <textarea
                                        className="w-full min-h-[80px] px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-green/20 text-sm resize-none"
                                        placeholder="Filial manzilini kiriting..."
                                        defaultValue={editingBranch?.address}
                                    />
                                    <MapPin className="absolute bottom-3 right-3 text-gray-400 w-4 h-4" />
                                </div>
                                <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Xaritadan belgilash
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telegram Group ID</label>
                                <Input
                                    placeholder="-100..."
                                    defaultValue={editingBranch?.groupId}
                                    rightElement={
                                        <div className="flex items-center gap-2 cursor-pointer group" title="Botni guruhga qo'shib ID oling">
                                            <Info className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                        </div>
                                    }
                                />
                                <p className="text-xs text-gray-500 mt-1">Buyurtmalar aynan shu guruhga yuboriladi.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 border-transparent text-gray-700">Bekor qilish</Button>
                                <Button className="flex-1 bg-brand-green hover:bg-[#053d2e]">
                                    <Check className="w-4 h-4 mr-2" />
                                    Saqlash
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
