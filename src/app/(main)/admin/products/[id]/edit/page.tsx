'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import {
    ArrowLeft, Upload, Info, Plus, X, Loader2,
    Image as ImageIcon, Save, Film, Video
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { ChevronDown } from 'lucide-react';

// ─── Image Slot ───────────────────────────────────────────────────────────────
function ImageSlot({
    index, url, uploading, onFile, onRemove,
}: {
    index: number; url: string | null; uploading: boolean;
    onFile: (idx: number, file: File) => void; onRemove: (idx: number) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div
            className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden transition-all hover:border-blue-300 group aspect-[4/3]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(index, f); }}
        >
            <input ref={ref} type="file" accept="image/*" className="hidden"
                aria-label={index === 0 ? 'Asosiy rasmni yuklash' : `Rasm ${index + 1} ni yuklash`}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(index, f); }} />
            {url ? (
                <>
                    <Image src={url} alt={`Rasm ${index + 1}`} className="w-full h-full object-cover" width={300} height={300} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={() => ref.current?.click()}
                            className="bg-white/90 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white">
                            Almashtirish
                        </button>
                    </div>
                    <button type="button" onClick={() => onRemove(index)}
                        title="Rasmni o'chirish" aria-label="Rasmni o'chirish"
                        className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-white shadow-sm">
                        <X size={12} />
                    </button>
                    {index === 0 && (
                        <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Asosiy</span>
                    )}
                </>
            ) : uploading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-500">Yuklanmoqda...</span>
                </div>
            ) : (
                <button type="button" onClick={() => ref.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{index === 0 ? 'Asosiy rasm' : `Rasm ${index + 1}`}</span>
                </button>
            )}
        </div>
    );
}

// ─── Video Slot ────────────────────────────────────────────────────────────────
function VideoSlot({ url, uploading, onFile, onRemove }: {
    url: string | null; uploading: boolean;
    onFile: (file: File) => void; onRemove: () => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div className="relative rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 overflow-hidden transition-all hover:border-purple-400 group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
            <input ref={ref} type="file" accept="video/*" className="hidden"
                aria-label="Mahsulot videosini yuklash"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {url ? (
                <div className="p-3">
                    <video src={url} controls className="w-full rounded-lg max-h-52 object-contain bg-black" />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-purple-600 font-medium flex items-center gap-1"><Film size={12} /> Video yuklandi ✅</span>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => ref.current?.click()} className="text-xs text-gray-500 hover:text-gray-700">Almashtirish</button>
                            <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">O&apos;chirish</button>
                        </div>
                    </div>
                </div>
            ) : uploading ? (
                <div className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-500">Video yuklanmoqda...</span>
                </div>
            ) : (
                <button type="button" onClick={() => ref.current?.click()}
                    className="w-full p-8 flex flex-col items-center justify-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Video className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">Mahsulot videosini yuklang</p>
                        <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI • max 100 MB</p>
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-3 py-1 rounded-full">Video tanlash</span>
                </button>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const categories = useCategoryStore((state) => state.categories);
    const hasMounted = useHasMounted();

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [originalPrice, setOriginalPrice] = useState('');
    const [sku, setSku] = useState('');
    const [status, setStatus] = useState<'active' | 'draft' | 'archived'>('active');
    const [inStock, setInStock] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [specs, setSpecs] = useState<{ id: string; key: string; value: string }[]>([]);

    // Media state (3 rasm + 1 video)
    const [images, setImages] = useState<(string | null)[]>([null, null, null]);
    const [imageUploading, setImageUploading] = useState<boolean[]>([false, false, false]);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoUploading, setVideoUploading] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isUrlUploading, setIsUrlUploading] = useState(false);

    // ── Load product ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        setIsLoading(true);
        fetch(`/api/products/${id}`)
            .then(r => r.json())
            .then(product => {
                if (product.error) { toast.error('Mahsulot topilmadi'); router.push('/admin/products'); return; }
                setName(product.name || '');
                setDescription(product.description || '');
                setPrice(String(product.price || ''));
                setOriginalPrice(String(product.originalPrice || ''));
                setSku(product.sku || '');
                setStatus(product.status || 'active');
                setInStock(product.inStock !== false);
                setVideoUrl(product.videoUrl || null);

                // Gallery → 3 slot
                const gal: string[] = Array.isArray(product.gallery) ? product.gallery : [];
                const mainImg = product.image && product.image !== '/placeholder.png' ? product.image : null;
                setImages([
                    mainImg,
                    gal[0] || null,
                    gal[1] || null,
                ]);

                // Kategoriya aniqlash
                if (product.category) {
                    let matchedCat = categories.find(c => c.slug === product.category);
                    let matchedSub: typeof categories[0] | undefined;
                    if (!matchedCat) {
                        for (const cat of categories) {
                            const sub = cat.children?.find(s => s.slug === product.category);
                            if (sub) { matchedCat = cat; matchedSub = sub; break; }
                        }
                    }
                    if (!matchedCat) {
                        const norm = (s: string) => s.toLowerCase().replace(/[''`'ʻʼ]/g, '').trim();
                        matchedCat = categories.find(c =>
                            norm(c.name.uz) === norm(product.category) ||
                            norm(c.name.ru) === norm(product.category)
                        );
                    }
                    if (matchedCat) { setSelectedCategory(matchedCat.id); if (matchedSub) setSelectedSubCategory(matchedSub.id); }
                }

                // Specs
                if (product.specifications && typeof product.specifications === 'object') {
                    setSpecs(Object.entries(product.specifications as Record<string, string>).map(([key, value]) => ({
                        id: Math.random().toString(), key, value,
                    })));
                }
            })
            .catch(() => toast.error('Yuklashda xatolik'))
            .finally(() => setIsLoading(false));
    }, [id, categories]);

    const addSpec = () => setSpecs([...specs, { id: Date.now().toString(), key: '', value: '' }]);
    const updateSpec = (sid: string, field: 'key' | 'value', value: string) =>
        setSpecs(specs.map(s => s.id === sid ? { ...s, [field]: value } : s));
    const removeSpec = (sid: string) => setSpecs(specs.filter(s => s.id !== sid));

    // ── Upload helpers ────────────────────────────────────────────────────
    const uploadFile = async (file: File): Promise<string | null> => {
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await fetch('/api/upload/file', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok && data.success) return data.url;
            toast.error(data.error || 'Yuklashda xatolik'); return null;
        } catch { toast.error('Tarmoq xatosi'); return null; }
    };

    const handleImageFile = async (idx: number, file: File) => {
        if (!file.type.startsWith('image/')) { toast.error('Faqat rasm!'); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error('10 MB dan oshmasin!'); return; }
        setImageUploading(prev => { const n = [...prev]; n[idx] = true; return n; });
        const url = await uploadFile(file);
        if (url) { setImages(prev => { const n = [...prev]; n[idx] = url; return n; }); toast.success(`Rasm ${idx + 1} yuklandi ✅`); }
        setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; });
    };

    const handleImageRemove = (idx: number) => setImages(prev => { const n = [...prev]; n[idx] = null; return n; });

    const handleVideoFile = async (file: File) => {
        if (!file.type.startsWith('video/')) { toast.error('Faqat video!'); return; }
        if (file.size > 100 * 1024 * 1024) { toast.error('100 MB dan oshmasin!'); return; }
        setVideoUploading(true);
        const url = await uploadFile(file);
        if (url) { setVideoUrl(url); toast.success('Video yuklandi ✅'); }
        setVideoUploading(false);
    };

    const handleUrlUpload = async () => {
        if (!imageUrlInput) return;
        setIsUrlUploading(true);
        try {
            const res = await fetch('/api/upload/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: imageUrlInput }) });
            const data = await res.json();
            if (res.ok && data.success) {
                const emptyIdx = images.findIndex(img => img === null);
                if (emptyIdx !== -1) { setImages(prev => { const n = [...prev]; n[emptyIdx] = data.url; return n; }); toast.success("Rasm qo'shildi ✅"); }
                else toast.warning("Barcha 3 ta slot to'lgan");
                setImageUrlInput('');
            } else { toast.error(data.error || 'URL xatolik'); }
        } catch { toast.error('Server xatosi'); }
        finally { setIsUrlUploading(false); }
    };

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!name.trim()) { toast.error('Mahsulot nomini kiriting!'); return; }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) { toast.error("Narxni to'g'ri kiriting!"); return; }

        const selCatObj = categories.find(c => c.id === selectedCategory);
        let categorySlug = selCatObj ? selCatObj.slug : '';
        if (selectedSubCategory && selCatObj?.children) {
            const sub = selCatObj.children.find(s => s.id === selectedSubCategory);
            if (sub) categorySlug = sub.slug;
        }

        const validImages = images.filter(Boolean) as string[];
        const mainImage = validImages[0] || '/placeholder.png';
        const galleryImages = validImages.slice(1);

        const payload = {
            name: name.trim(), description,
            price: priceNum,
            originalPrice: parseFloat(originalPrice) > 0 ? parseFloat(originalPrice) : null,
            sku, category: categorySlug || undefined,
            image: mainImage,
            gallery: galleryImages,
            videoUrl: videoUrl || null,
            status, inStock,
            specifications: specs.reduce((acc, curr) => {
                if (curr.key.trim()) acc[curr.key.trim()] = curr.value.trim();
                return acc;
            }, {} as Record<string, string>),
        };

        setIsSaving(true);
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error || 'Server xatosi'); }
            toast.success('Mahsulot yangilandi ✅');
            router.push('/admin/products');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
        } finally { setIsSaving(false); }
    };

    if (isLoading) {
        return (
            <div className="p-6 min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm">Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#F9FAFB] z-10 py-2">
                <div className="flex items-center gap-4">
                    <Link href="/admin/products">
                        <Button variant="ghost" size="icon" className="rounded-full bg-white border border-gray-200">
                            <ArrowLeft className="w-5 h-5 text-gray-500" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Mahsulotni tahrirlash</h1>
                        <p className="text-xs text-gray-400">ID: {id}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/products"><Button variant="secondary" className="bg-white">Bekor qilish</Button></Link>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Saqlash
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Asosiy ma&apos;lumotlar</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Mahsulot nomi</label>
                                <Input placeholder="Mahsulot nomini kiriting" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ta&apos;rif</label>
                                <textarea
                                    className="w-full min-h-[120px] p-3 border border-gray-200 rounded-[10px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y text-sm text-gray-700 placeholder-gray-400"
                                    placeholder="Mahsulot haqida batafsil ma'lumot..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <Input label="SKU (Artikul)" placeholder="Masalan: PKG-001" value={sku} onChange={(e) => setSku(e.target.value)} />
                        </div>
                    </Card>

                    {/* ── MEDIA ─────────────────────────────────────────────── */}
                    <Card>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-gray-500" />
                                Rasm va Video
                                <span className="text-xs font-normal text-gray-400 ml-1">(3 ta rasm + 1 ta video)</span>
                            </h3>
                            <span className="text-xs text-gray-400">{images.filter(Boolean).length}/3 rasm</span>
                        </div>

                        {/* URL input */}
                        <div className="flex gap-2 mb-5">
                            <div className="relative flex-1">
                                <Input
                                    placeholder="Rasm URL (https://...) — Enter bosing"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
                                    className="pl-9 text-sm"
                                />
                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                            <Button variant="secondary" onClick={handleUrlUpload} disabled={isUrlUploading || !imageUrlInput} className="shrink-0">
                                {isUrlUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-1.5" />Qo&apos;shish</>}
                            </Button>
                        </div>

                        {/* 3 Image Slots */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {images.map((url, idx) => (
                                <ImageSlot key={idx} index={idx} url={url} uploading={imageUploading[idx]}
                                    onFile={handleImageFile} onRemove={handleImageRemove} />
                            ))}
                        </div>

                        <p className="text-xs text-gray-400 mb-5 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Birinchi rasm asosiy rasm bo&apos;ladi. 1600×1200 px, har biri 10 MB gacha.
                        </p>

                        <div className="border-t border-gray-100 pt-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Film className="w-4 h-4 text-purple-500" />
                                <h4 className="text-sm font-semibold text-gray-800">Mahsulot videosi</h4>
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">Ixtiyoriy</span>
                            </div>
                            <VideoSlot url={videoUrl} uploading={videoUploading} onFile={handleVideoFile} onRemove={() => setVideoUrl(null)} />
                        </div>
                    </Card>

                    {/* Pricing */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Narx</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Joriy narx (UZS)" placeholder="0" type="number" value={price}
                                onChange={(e) => setPrice(e.target.value)} icon={<span className="text-xs font-bold text-gray-500">UZS</span>} />
                            <Input label="Eski narx (ixtiyoriy)" placeholder="0" type="number" value={originalPrice}
                                onChange={(e) => setOriginalPrice(e.target.value)} icon={<span className="text-xs font-bold text-gray-500">UZS</span>} />
                        </div>
                        {parseFloat(originalPrice) > 0 && parseFloat(price) > 0 && (
                            <div className="mt-3 text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                                <Info className="w-4 h-4" />
                                Chegirma: {Math.round((1 - parseFloat(price) / parseFloat(originalPrice)) * 100)}%
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right sidebar */}
                <div className="space-y-6">
                    {/* Category */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Katalog</h3>
                        <div className="relative mb-4">
                            <label className="text-xs text-gray-500 mb-1 block">Asosiy Kategoriya</label>
                            {!hasMounted ? (
                                <div className="h-[42px] bg-gray-50 border border-gray-200 rounded-[10px] animate-pulse" />
                            ) : (
                                <div className="relative">
                                    <select aria-label="Kategoriyani tanlang"
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                                        value={selectedCategory}
                                        onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubCategory(''); }}>
                                        <option value="">Tanlang...</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name.uz || cat.name.ru}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            )}
                        </div>

                        {selectedCategory && categories.find(c => c.id === selectedCategory)?.children && (
                            <div className="relative">
                                <label className="text-xs text-gray-500 mb-1 block">Ichki Kategoriya</label>
                                <div className="relative">
                                    <select aria-label="Modelni tanlang"
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer"
                                        value={selectedSubCategory}
                                        onChange={(e) => setSelectedSubCategory(e.target.value)}>
                                        <option value="">Modelni tanlang...</option>
                                        {categories.find(c => c.id === selectedCategory)?.children?.map((sub) => (
                                            <option key={sub.id} value={sub.id}>{sub.name.uz || sub.name.ru}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Status */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Holat</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Faol (active)</span>
                                <Switch checked={status === 'active'} onCheckedChange={(c) => setStatus(c ? 'active' : 'draft')} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Omborda bor</span>
                                <Switch checked={inStock} onCheckedChange={setInStock} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {status === 'active' ? '✅ Faol' : '⚠️ Qoralama'}
                            </span>
                        </div>
                    </Card>

                    {/* Specs */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Xarakteristikalar</h3>
                        <div className="space-y-2 mb-3">
                            {specs.map((spec) => (
                                <div key={spec.id} className="flex gap-2 items-start">
                                    <Input placeholder="Nomi (Rang)" value={spec.key} onChange={(e) => updateSpec(spec.id, 'key', e.target.value)} className="h-8 text-xs" />
                                    <Input placeholder="Qiymati (Oq)" value={spec.value} onChange={(e) => updateSpec(spec.id, 'value', e.target.value)} className="h-8 text-xs" />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0" onClick={() => removeSpec(spec.id)}>
                                        <X size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full text-sm font-normal flex items-center gap-2" onClick={addSpec}>
                            <Plus size={14} /> Xarakteristika qo&apos;shish
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
