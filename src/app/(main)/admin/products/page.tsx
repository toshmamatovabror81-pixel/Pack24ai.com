'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Search, Plus, Download, Pencil, Trash2, Filter, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useProductStore, type Product } from '@/lib/store/useProductStore';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import ImportProductModal from '@/components/admin/ImportProductModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
    const { products, loading, fetchProducts, updateProduct, deleteProduct, bulkUpdatePrice } = useProductStore();
    const allCategories = useCategoryStore(s => s.categories);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Slug yoki nom bo'yicha kategoriya display nomini topish
    const getCategoryDisplay = (slug?: string | null): string => {
        if (!slug) return '-';
        for (const cat of allCategories) {
            if (cat.slug === slug) return cat.name.uz || cat.name.ru;
            const sub = cat.children?.find(s => s.slug === slug);
            if (sub) return `${cat.name.uz} › ${sub.name.uz}`;
        }
        return slug; // fallback: slug as is
    };

    // Quick Edit State
    const [editingPriceId, setEditingPriceId] = useState<number | string | null>(null);
    const [tempPrice, setTempPrice] = useState<string>('');

    React.useEffect(() => {
        fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

    const handlePriceClick = (product: Product) => {
        setEditingPriceId(product.id);
        setTempPrice(product.price.toString());
    };

    const handlePriceSave = async (id: number | string) => {
        const newPrice = parseInt(tempPrice);
        if (!isNaN(newPrice)) {
            await updateProduct(id, { price: newPrice });
            toast.success("Narx yangilandi");
        }
        setEditingPriceId(null);
    };

    const handleBulkUpdate = async () => {
        const percent = prompt("Narxlarni necha foizga o'zgartirmoqchisiz? (masalan: 10 yoki -5)");
        if (percent && !isNaN(parseInt(percent))) {
            if (confirm(`Barcha mahsulotlar narxi ${percent}% ga o'zgaradi. Tasdiqlaysizmi?`)) {
                await bulkUpdatePrice('all', parseInt(percent));
                toast.success("Narxlar ommaviy yangilandi");
            }
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <ImportProductModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Mahsulotlar
                        {loading && <div className="text-xs text-gray-400 font-normal animate-pulse">(Yuklanmoqda...)</div>}
                    </h1>
                    <div className="flex gap-2 mt-2">
                        <span
                            onClick={() => setStatusFilter('all')}
                            className={cn("cursor-pointer text-sm font-medium px-2 py-1 rounded-md transition-colors", statusFilter === 'all' ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100")}
                        >
                            Barchasi ({products.length})
                        </span>
                        <span
                            onClick={() => setStatusFilter('active')}
                            className={cn("cursor-pointer text-sm font-medium px-2 py-1 rounded-md transition-colors", statusFilter === 'active' ? "bg-emerald-100 text-emerald-700" : "text-gray-500 hover:bg-gray-100")}
                        >
                            Faol ({products.filter(p => p.status === 'active').length})
                        </span>
                        <span
                            onClick={() => setStatusFilter('draft')}
                            className={cn("cursor-pointer text-sm font-medium px-2 py-1 rounded-md transition-colors", statusFilter === 'draft' ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-100")}
                        >
                            Qoralama ({products.filter(p => p.status === 'draft').length})
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleBulkUpdate} className="text-gray-600">
                        % Narxlarni o&apos;zgartirish
                    </Button>
                </div>
            </div>

            <Card noPadding className="mb-8">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-white rounded-t-[10px]">
                    <div className="w-full md:w-1/3">
                        <Input
                            placeholder="Qidiruv..."
                            icon={<Search className="w-4 h-4" />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative">
                            <select aria-label="Kategoriya bo'yicha filtrlash" className="appearance-none h-10 pl-4 pr-10 bg-white border border-gray-200 rounded-[10px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#064E3B]/20 text-[15px]">
                                <option value="all">Barcha Kategoriyalar</option>
                                {categories.map(c => <option key={c} value={c as string}>{c}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <Filter size={14} />
                            </div>
                        </div>

                        <Button variant="secondary" className="gap-2" onClick={() => setIsImportModalOpen(true)}>
                            <Download className="w-4 h-4" />
                            Import (Pack24.ru)
                        </Button>

                        <Link href="/admin/products/new">
                            <Button className="gap-2 bg-[#064E3B] hover:bg-[#053d2e]">
                                <Plus className="w-4 h-4" />
                                Qo&apos;shish
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider bg-gray-50/50">
                                <th className="py-4 pl-4 w-10">#</th>
                                <th className="py-4 pl-2 font-medium">Mahsulot</th>
                                <th className="py-4 px-4 font-medium w-32">Narx (UZS)</th>
                                <th className="py-4 px-4 font-medium">Kategoriya</th>
                                <th className="py-4 px-4 font-medium">Import Info</th>
                                <th className="py-4 px-4 font-medium">Holat</th>
                                <th className="py-4 px-2 font-medium text-center w-8" title="Namuna mahsulot">⭐</th>
                                <th className="py-4 px-4 font-medium text-center">Amallar</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className={cn("hover:bg-gray-50 transition-colors group", product.status === 'draft' ? "bg-amber-50/30" : "")}>
                                    <td className="py-3 pl-4 text-xs text-gray-400">
                                        {product.id}
                                    </td>
                                    <td className="py-3 pl-2">
                                        <div className="flex items-center gap-3">
                                            <Image src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200" width={300} height={300} />
                                            <div>
                                                <span className="font-medium text-gray-900 block max-w-xs truncate" title={product.name}>{product.name}</span>
                                                {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-medium">
                                        {editingPriceId === product.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    autoFocus
                                                    aria-label="Narxni tahrirlash"
                                                    className="w-20 px-1 py-0.5 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={tempPrice}
                                                    onChange={(e) => setTempPrice(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handlePriceSave(product.id)}
                                                    onBlur={() => handlePriceSave(product.id)}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="group/price flex items-center gap-2 cursor-pointer hover:text-blue-600"
                                                onClick={() => handlePriceClick(product)}
                                            >
                                                {product.price.toLocaleString()}
                                                <Pencil size={10} className="opacity-0 group-hover/price:opacity-100 transition-opacity" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-gray-500 text-xs">
                                        {getCategoryDisplay(product.category)}
                                    </td>
                                    <td className="py-3 px-4 text-xs">
                                        {product.originalPrice ? (
                                            <span className="text-gray-400" title="Import qilingan narx">Orig: {product.originalPrice} RUB</span>
                                        ) : '-'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            {product.status === 'draft' ? (
                                                <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <AlertCircle size={10} /> Qoralama
                                                </span>
                                            ) : (
                                                <Switch
                                                    checked={product.status === 'active'}
                                                    onCheckedChange={(checked) => updateProduct(product.id, { status: checked ? 'active' : 'archived' })}
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                        <button
                                            title={product.isFeatured ? "Namuna belgi olib tashlash" : "Kategoriya namunasi sifatida belgilash"}
                                            onClick={async () => {
                                                await fetch(`/api/products/${product.id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ isFeatured: !product.isFeatured }),
                                                });
                                                fetchProducts();
                                                toast.success(product.isFeatured ? 'Namuna belgisi olib tashlandi' : '⭐ Namuna mahsulot belgilandi!');
                                            }}
                                            className={`text-lg transition-all hover:scale-125 ${product.isFeatured ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                                        >
                                            ⭐
                                        </button>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {product.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2"
                                                    onClick={() => {
                                                        updateProduct(product.id, { status: 'active' });
                                                        toast.success("Mahsulot e'lon qilindi!");
                                                    }}
                                                >
                                                    Publish
                                                </Button>
                                            )}
                                            <Link href={`/admin/products/${product.id}/edit`}>
                                                <Button variant="secondary" size="icon" className="h-8 w-8 text-blue-600 border-blue-100 bg-blue-50 hover:bg-blue-100">
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                            </Link>
                                            <Button variant="secondary" size="icon" className="h-8 w-8 text-red-600 border-red-100 bg-red-50 hover:bg-red-100" onClick={() => deleteProduct(product.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-gray-400">
                                        Mahsulotlar topilmadi
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
