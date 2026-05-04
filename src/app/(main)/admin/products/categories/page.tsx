'use client';

import { useState } from 'react';
import { useCategoryStore, type Category } from '@/lib/store/useCategoryStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Plus, Trash2, Edit2, Archive, Search, Save, X,
    ChevronDown, ChevronRight, Layers, FolderPlus
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';

// ─── Sub-Category Form ─────────────────────────────────────────────────────────
interface SubFormData {
    id?: string;
    nameUz: string;
    nameRu: string;
    nameEn: string;
    icon: string;
    slug: string;
    isActive: boolean;
}

const emptySubForm: SubFormData = {
    nameUz: '', nameRu: '', nameEn: '', icon: 'Box', slug: '', isActive: true,
};

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminCategoriesPage() {
    const { categories, addCategory, updateCategory, deleteCategory } = useCategoryStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    // Category form
    const [formData, setFormData] = useState<Partial<Category>>({
        name: { uz: '', ru: '', en: '' },
        icon: 'Box',
        slug: '',
        isActive: true,
        children: [],
    });

    // Sub-category inline editing
    const [subForm, setSubForm] = useState<SubFormData>(emptySubForm);
    const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
    const [editingSubId, setEditingSubId] = useState<string | null>(null);

    // ── Slug generator ──
    const generateSlug = (text: string) =>
        text.toLowerCase()
            .replace(/[''`'ʻʼ]/g, '')
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '');

    // ── Toggle expand ──
    const toggleExpand = (catId: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(catId)) {
                next.delete(catId);
            } else {
                next.add(catId);
            }
            return next;
        });
    };

    // ── Save category ──
    const handleSave = () => {
        if (!formData.name?.uz || !formData.slug) {
            toast.error("Nomi va Slug majburiy!");
            return;
        }

        if (editingId) {
            updateCategory(editingId, formData);
            toast.success("Kategoriya yangilandi! ✅");
        } else {
            addCategory({
                name: formData.name as { uz: string; ru: string; en: string },
                icon: formData.icon || 'Box',
                slug: formData.slug!,
                isActive: true,
                children: formData.children || [],
            });
            toast.success("Yangi kategoriya qo'shildi! 🚀");
        }
        resetForm();
    };

    // ── Edit category ──
    const handleEdit = (category: Category) => {
        setEditingId(category.id);
        setFormData({ ...category });
        setIsAdding(true);
    };

    // ── Delete category ──
    const handleDelete = (id: string, name: string) => {
        if (confirm(`Rostdan ham "${name}" kategoriyasini o'chirmoqchimisiz?`)) {
            deleteCategory(id);
            toast.success("Kategoriya o'chirildi.");
        }
    };

    const resetForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({
            name: { uz: '', ru: '', en: '' },
            icon: 'Box', slug: '', isActive: true, children: [],
        });
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Sub-category functions (inline — to'g'ridan-to'g'ri category ro'yxatida)
    // ═══════════════════════════════════════════════════════════════════════

    const startAddSub = (catId: string) => {
        setAddingSubTo(catId);
        setEditingSubId(null);
        setSubForm(emptySubForm);
        setExpandedCats(prev => new Set(prev).add(catId));
    };

    const startEditSub = (catId: string, sub: Category) => {
        setAddingSubTo(catId);
        setEditingSubId(sub.id);
        setSubForm({
            id: sub.id,
            nameUz: sub.name.uz,
            nameRu: sub.name.ru,
            nameEn: sub.name.en,
            icon: sub.icon,
            slug: sub.slug,
            isActive: sub.isActive,
        });
    };

    const cancelSubForm = () => {
        setAddingSubTo(null);
        setEditingSubId(null);
        setSubForm(emptySubForm);
    };

    const saveSub = (catId: string) => {
        if (!subForm.nameUz || !subForm.slug) {
            toast.error("Sub-kategoriya nomi va slug majburiy!");
            return;
        }

        const parentCat = categories.find(c => c.id === catId);
        if (!parentCat) return;

        const currentChildren = parentCat.children || [];

        if (editingSubId) {
            // Update existing sub
            const updatedChildren = currentChildren.map(ch =>
                ch.id === editingSubId ? {
                    ...ch,
                    name: { uz: subForm.nameUz, ru: subForm.nameRu, en: subForm.nameEn },
                    icon: subForm.icon,
                    slug: subForm.slug,
                    isActive: subForm.isActive,
                } : ch
            );
            updateCategory(catId, { children: updatedChildren });
            toast.success("Sub-kategoriya yangilandi! ✅");
        } else {
            // Add new sub
            const newSub: Category = {
                id: `sub-${Date.now()}`,
                name: { uz: subForm.nameUz, ru: subForm.nameRu, en: subForm.nameEn },
                icon: subForm.icon || 'Box',
                slug: subForm.slug,
                productCount: 0,
                isActive: subForm.isActive,
            };
            updateCategory(catId, { children: [...currentChildren, newSub] });
            toast.success("Sub-kategoriya qo'shildi! 🎉");
        }

        cancelSubForm();
    };

    const deleteSub = (catId: string, subId: string, subName: string) => {
        if (!confirm(`"${subName}" sub-kategoriyasini o'chirmoqchimisiz?`)) return;
        const parentCat = categories.find(c => c.id === catId);
        if (!parentCat) return;
        const updatedChildren = (parentCat.children || []).filter(ch => ch.id !== subId);
        updateCategory(catId, { children: updatedChildren });
        toast.success("Sub-kategoriya o'chirildi.");
    };

    // ── Filtered ──
    const filteredCategories = categories.filter(c =>
        c.name.uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.ru.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6 max-w-5xl mx-auto p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Каталог товаров</h1>
                    <p className="text-slate-500 text-sm">Kategoriyalar va sub-kategoriyalarni boshqarish</p>
                </div>
                <Button onClick={() => setIsAdding(true)} className="bg-emerald-500 hover:bg-emerald-600">
                    <Plus size={18} className="mr-2" /> Katalogga qo&apos;shish
                </Button>
            </div>

            {/* ════════════════ List View ════════════════ */}
            {!isAdding ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Search */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text" placeholder="Qidirish..."
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {filteredCategories.map((cat) => {
                            const Icon = (LucideIcons as any)[cat.icon] || LucideIcons.Box;
                            const isExpanded = expandedCats.has(cat.id);
                            const hasSubs = cat.children && cat.children.length > 0;

                            return (
                                <div key={cat.id}>
                                    {/* ── Category Row ── */}
                                    <div className="p-4 flex items-center hover:bg-gray-50 transition-colors group">
                                        {/* Expand toggle */}
                                        <button
                                            onClick={() => toggleExpand(cat.id)}
                                            className="w-7 h-7 rounded flex items-center justify-center mr-2 hover:bg-gray-100 transition-colors"
                                        >
                                            {hasSubs
                                                ? (isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-400" />)
                                                : <span className="w-4" />
                                            }
                                        </button>

                                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-4">
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm truncate">
                                                {cat.name.uz} <span className="text-gray-400 font-normal">/ {cat.name.ru}</span>
                                            </h3>
                                            <p className="text-xs text-slate-400 font-mono">/{cat.slug}</p>
                                        </div>
                                        <div className="flex items-center gap-3 mr-4">
                                            {hasSubs && (
                                                <span className="text-xs font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded-md">
                                                    {cat.children!.length} sub
                                                </span>
                                            )}
                                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${cat.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {cat.isActive ? 'Faol' : 'Nofaol'}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="icon" variant="ghost" title="Sub-kategoriya qo'shish"
                                                onClick={() => startAddSub(cat.id)}>
                                                <FolderPlus size={16} className="text-purple-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(cat)}>
                                                <Edit2 size={16} className="text-slate-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(cat.id, cat.name.uz)}>
                                                <Trash2 size={16} className="text-red-500" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* ── Sub-categories ── */}
                                    {isExpanded && (
                                        <div className="bg-gray-50/60 border-t border-gray-100">
                                            {cat.children && cat.children.map((sub) => {
                                                const SubIcon = (LucideIcons as any)[sub.icon] || LucideIcons.Box;
                                                return (
                                                    <div key={sub.id} className="pl-16 pr-4 py-3 flex items-center hover:bg-white/60 transition-colors group/sub border-b border-gray-100 last:border-0">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center mr-3">
                                                            <SubIcon size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-slate-700 text-[13px] truncate">
                                                                {sub.name.uz} <span className="text-gray-400 font-normal">/ {sub.name.ru}</span>
                                                            </h4>
                                                            <p className="text-[11px] text-slate-400 font-mono">/{sub.slug}</p>
                                                        </div>
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded mr-3 ${sub.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                            {sub.isActive ? 'Faol' : 'Nofaol'}
                                                        </span>
                                                        <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7"
                                                                onClick={() => startEditSub(cat.id, sub)}>
                                                                <Edit2 size={14} className="text-slate-500" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7"
                                                                onClick={() => deleteSub(cat.id, sub.id, sub.name.uz)}>
                                                                <Trash2 size={14} className="text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* ── Add/Edit Sub-category inline form ── */}
                                            {addingSubTo === cat.id && (
                                                <div className="pl-16 pr-4 py-4 bg-purple-50/40 border-t border-purple-100">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Layers size={16} className="text-purple-500" />
                                                        <span className="text-sm font-bold text-purple-700">
                                                            {editingSubId ? 'Sub-kategoriyani tahrirlash' : 'Yangi sub-kategoriya'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                        <Input placeholder="Nomi (UZ)" value={subForm.nameUz}
                                                            onChange={(e) => {
                                                                setSubForm({ ...subForm, nameUz: e.target.value });
                                                                if (!editingSubId) setSubForm(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
                                                            }}
                                                            className="h-9 text-sm" />
                                                        <Input placeholder="Nomi (RU)" value={subForm.nameRu}
                                                            onChange={(e) => setSubForm({ ...subForm, nameRu: e.target.value })}
                                                            className="h-9 text-sm" />
                                                        <Input placeholder="Nomi (EN)" value={subForm.nameEn}
                                                            onChange={(e) => setSubForm({ ...subForm, nameEn: e.target.value })}
                                                            className="h-9 text-sm" />
                                                        <Input placeholder="Slug (URL)" value={subForm.slug}
                                                            onChange={(e) => setSubForm({ ...subForm, slug: e.target.value })}
                                                            className="h-9 text-sm font-mono" />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <Input placeholder="Icon (Box, Layers...)" value={subForm.icon}
                                                                onChange={(e) => setSubForm({ ...subForm, icon: e.target.value })}
                                                                className="h-9 text-sm w-40" />
                                                            <div className="w-9 h-9 rounded bg-white border flex items-center justify-center shrink-0">
                                                                {(() => {
                                                                    const P = (LucideIcons as any)[subForm.icon] || LucideIcons.Box;
                                                                    return <P size={16} />;
                                                                })()}
                                                            </div>
                                                            <label className="flex items-center gap-2 text-xs text-slate-600 ml-2 cursor-pointer">
                                                                <input type="checkbox" checked={subForm.isActive}
                                                                    onChange={(e) => setSubForm({ ...subForm, isActive: e.target.checked })}
                                                                    className="w-4 h-4 rounded text-emerald-500" />
                                                                Faol
                                                            </label>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="ghost" className="h-9 text-xs" onClick={cancelSubForm}>
                                                                <X size={14} className="mr-1" /> Bekor
                                                            </Button>
                                                            <Button className="h-9 text-xs bg-purple-600 hover:bg-purple-700"
                                                                onClick={() => saveSub(cat.id)}>
                                                                <Save size={14} className="mr-1" /> Saqlash
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Quick add button if not already adding */}
                                            {addingSubTo !== cat.id && (
                                                <button
                                                    onClick={() => startAddSub(cat.id)}
                                                    className="w-full pl-16 pr-4 py-2.5 text-left text-xs text-purple-500 hover:text-purple-700 hover:bg-purple-50/50 transition-colors flex items-center gap-2"
                                                >
                                                    <Plus size={14} /> Sub-kategoriya qo&apos;shish
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {filteredCategories.length === 0 && (
                            <div className="p-12 text-center text-slate-400">
                                <Archive size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Kategoriyalar topilmadi</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ════════════════ Add/Edit Category Form ════════════════ */
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm animate-in slide-in-from-bottom-4">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                        {editingId ? 'Kategoriyani Tahrirlash' : 'Yangi kategoriya'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nomi (O&apos;zbek)</label>
                                <Input
                                    value={formData.name?.uz}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: { ...formData.name!, uz: e.target.value } });
                                        if (!editingId) setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
                                    }}
                                    placeholder="Masalan: Karton Qutilar"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nomi (Rus)</label>
                                <Input
                                    value={formData.name?.ru}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name!, ru: e.target.value } })}
                                    placeholder="Например: Картонные коробки"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nomi (English)</label>
                                <Input
                                    value={formData.name?.en}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name!, en: e.target.value } })}
                                    placeholder="e.g. Cardboard Boxes"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Slug (URL)</label>
                                <Input
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    placeholder="karton-qutilar"
                                    className="font-mono text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Icon (Lucide)</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        placeholder="Box, Layers, Zap..."
                                    />
                                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                        {(() => {
                                            const PreviewIcon = (LucideIcons as any)[formData.icon || 'Box'] || LucideIcons.HelpCircle;
                                            return <PreviewIcon size={20} />;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="font-bold text-slate-700 block text-sm">Kategoriya Faol</span>
                                        <span className="text-xs text-slate-400">Saytda ko&apos;rinadi</span>
                                    </div>
                                </label>
                            </div>

                            {/* Sub-categories preview (edit mode) */}
                            {editingId && formData.children && formData.children.length > 0 && (
                                <div className="mt-2 p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                                    <p className="text-xs font-bold text-purple-600 mb-2 flex items-center gap-1">
                                        <Layers size={12} /> {formData.children.length} ta sub-kategoriya mavjud
                                    </p>
                                    <p className="text-[11px] text-purple-400">
                                        Sub-kategoriyalarni asosiy ro&apos;yxatda tahrirlang (saqlashdan keyin).
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                        <Button variant="ghost" onClick={resetForm}>Bekor qilish</Button>
                        <Button onClick={handleSave} className="bg-slate-900 text-white hover:bg-slate-800 px-8">
                            <Save size={16} className="mr-2" /> Saqlash
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
