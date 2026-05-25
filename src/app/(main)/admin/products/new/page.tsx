'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';import { ArrowLeft, Sparkles, Wand2, Upload, Info, Plus, X, Loader2, Image as ImageIcon, Video, Film, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useProductStore } from '@/lib/store/useProductStore';
import { useRouter } from 'next/navigation';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useHasMounted } from '@/lib/hooks/useHasMounted';

const LANGUAGES = [
    { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' }
];

const MAX_IMAGES = 3;

// ─── Media Upload Cell ────────────────────────────────────────────────────────
function ImageSlot({
    index,
    url,
    uploading,
    onFile,
    onRemove,
}: {
    index: number;
    url: string | null;
    uploading: boolean;
    onFile: (idx: number, file: File) => void;
    onRemove: (idx: number) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(index, file);
    };

    return (
        <div
        className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden transition-all hover:border-blue-300 group aspect-[4/3]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <input
                ref={ref}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label={index === 0 ? 'Asosiy rasmni yuklash' : `Rasm ${index + 1} ni yuklash`}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(index, f); }}
            />

            {url ? (
                <>
                    <Image src={url} alt={`Rasm ${index + 1}`} className="w-full h-full object-cover" width={300} height={300} />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => ref.current?.click()}
                            className="bg-white/90 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
                        >
                            Almashtirish
                        </button>
                    </div>
                    {/* Remove btn */}
                    <button
                        type="button"
                        title="Rasmni o'chirish"
                        aria-label="Rasmni o'chirish"
                        onClick={() => onRemove(index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-white hover:text-red-600 transition-colors shadow-sm"
                    >
                        <X size={12} />
                    </button>
                    {/* Badge */}
                    {index === 0 && (
                        <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Asosiy
                        </span>
                    )}
                </>
            ) : uploading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-500">Yuklanmoqda...</span>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                        {index === 0 ? 'Asosiy rasm' : `Rasm ${index + 1}`}
                    </span>
                </button>
            )}
        </div>
    );
}

// ─── Video Upload Cell ─────────────────────────────────────────────────────────
function VideoSlot({
    url,
    uploading,
    onFile,
    onRemove,
}: {
    url: string | null;
    uploading: boolean;
    onFile: (file: File) => void;
    onRemove: () => void;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
    };

    return (
        <div
            className="relative rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 overflow-hidden transition-all hover:border-purple-400 group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <input
                ref={ref}
                type="file"
                accept="video/*"
                className="hidden"
                aria-label="Mahsulot videosini yuklash"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />

            {url ? (
                <div className="p-3">
                    <video
                        src={url}
                        controls
                        className="w-full rounded-lg max-h-52 object-contain bg-black"
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                            <Film size={12} /> Video yuklandi ✅
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => ref.current?.click()}
                                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                            >
                                Almashtirish
                            </button>
                            <button
                                type="button"
                                onClick={onRemove}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                                O&apos;chirish
                            </button>
                        </div>
                    </div>
                </div>
            ) : uploading ? (
                <div className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-500">Video yuklanmoqda...</span>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="w-full p-8 flex flex-col items-center justify-center gap-3 cursor-pointer"
                >
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Video className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">Mahsulot videosini yuklang</p>
                        <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI • max 100 MB</p>
                        <p className="text-xs text-purple-500 mt-1">
                            pack24.ru dagidek mahsulot ko&apos;rinishi uchun video qo&apos;shing
                        </p>
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-3 py-1 rounded-full group-hover:bg-purple-200 transition-colors">
                        Video tanlash
                    </span>
                </button>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NewProductPage() {
    const [activeLang, setActiveLang] = useState('uz');
    const categories = useCategoryStore((state) => state.categories);
    const hasMounted = useHasMounted();

    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const router = useRouter();
    const _addProduct = useProductStore(state => state.addProduct);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Specifications State
    const [specs, setSpecs] = useState<{ id: string; key: string; value: string }[]>([]);
    const addSpec = () => setSpecs([...specs, { id: Date.now().toString(), key: '', value: '' }]);
    const updateSpec = (id: string, field: 'key' | 'value', value: string) =>
        setSpecs(specs.map(s => s.id === id ? { ...s, [field]: value } : s));
    const removeSpec = (id: string) => setSpecs(specs.filter(s => s.id !== id));

    // ── Media State ──────────────────────────────────────────────────────
    // 3 ta rasm slot: [url | null, url | null, url | null]
    const [images, setImages] = useState<(string | null)[]>([null, null, null]);
    const [imageUploading, setImageUploading] = useState<boolean[]>([false, false, false]);

    // 1 ta video slot
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoUploading, setVideoUploading] = useState(false);

    // URL input (asosiy rasm uchun)
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isUrlUploading, setIsUrlUploading] = useState(false);

    // ── Upload helpers ────────────────────────────────────────────────────
    const uploadFileToServer = async (file: File): Promise<string | null> => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload/file', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.success) return data.url as string;
            toast.error(data.error || 'Yuklashda xatolik');
            return null;
        } catch {
            toast.error('Tarmoq xatosi');
            return null;
        }
    };

    const handleImageFile = async (idx: number, file: File) => {
        if (!file.type.startsWith('image/')) { toast.error('Faqat rasm fayllari!'); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error('Rasm 10 MB dan oshmasin!'); return; }

        setImageUploading(prev => { const n = [...prev]; n[idx] = true; return n; });
        const url = await uploadFileToServer(file);
        if (url) {
            setImages(prev => { const n = [...prev]; n[idx] = url; return n; });
            toast.success(`Rasm ${idx + 1} yuklandi ✅`);
        }
        setImageUploading(prev => { const n = [...prev]; n[idx] = false; return n; });
    };

    const handleImageRemove = (idx: number) => {
        setImages(prev => { const n = [...prev]; n[idx] = null; return n; });
    };

    const handleVideoFile = async (file: File) => {
        if (!file.type.startsWith('video/')) { toast.error('Faqat video fayllari!'); return; }
        if (file.size > 100 * 1024 * 1024) { toast.error('Video 100 MB dan oshmasin!'); return; }

        setVideoUploading(true);
        const url = await uploadFileToServer(file);
        if (url) {
            setVideoUrl(url);
            toast.success('Video yuklandi ✅');
        }
        setVideoUploading(false);
    };

    const handleUrlUpload = async () => {
        if (!imageUrlInput) return;
        setIsUrlUploading(true);
        try {
            const res = await fetch('/api/upload/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: imageUrlInput }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // Birinchi bo'sh slotga joylashtirish
                const emptyIdx = images.findIndex(img => img === null);
                if (emptyIdx !== -1) {
                    setImages(prev => { const n = [...prev]; n[emptyIdx] = data.url; return n; });
                    toast.success('Rasm qo\'shildi ✅');
                } else {
                    toast.warning('Barcha 3 ta rasm sloti to\'lgan. Birini o\'chirib qo\'shing.');
                }
                setImageUrlInput('');
            } else {
                toast.error(data.error || 'URL dan yuklashda xatolik');
            }
        } catch {
            toast.error('Server bilan bog\'lanishda xatolik');
        } finally {
            setIsUrlUploading(false);
        }
    };

    // ── Pricing ───────────────────────────────────────────────────────────
    const [cost, setCost] = useState('');
    const [profit, setProfit] = useState('');
    const [price, setPrice] = useState('');
    const [margin, setMargin] = useState('');

    useEffect(() => {
        const c = parseFloat(cost) || 0;
        const p = parseFloat(profit) || 0;
        const total = c + p;
        setPrice(total > 0 ? total.toFixed(2) : '');
        setMargin(total > 0 ? ((p / total) * 100).toFixed(2) : '');
    }, [cost, profit]);

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!name) { toast.error('Mahsulot nomini kiriting!'); return; }
        const finalPrice = parseFloat(price) || (parseFloat(cost) + parseFloat(profit)) || 0;
        if (!finalPrice) { toast.error('Narxni kiriting!'); return; }
        if (!selectedCategory) { toast.error('Kategoriyani tanlang!'); return; }

        const selectedCatObj = categories.find(c => c.id === selectedCategory);
        let categorySlug = selectedCatObj ? selectedCatObj.slug : selectedCategory;
        if (selectedSubCategory && selectedCatObj?.children) {
            const sub = selectedCatObj.children.find(s => s.id === selectedSubCategory);
            if (sub) categorySlug = sub.slug;
        }

        // Birinchi bo'lmagan rasm → asosiy rasm
        const validImages = images.filter(Boolean) as string[];
        const mainImage = validImages[0] || '/placeholder.png';
        const galleryImages = validImages.slice(1); // qolgan rasmlar gallery ga

        const payload = {
            name,
            description,
            price: finalPrice,
            originalPrice: parseFloat(cost) > 0 ? parseFloat(cost) : null,
            image: mainImage,
            category: categorySlug,
            status: 'active',
            inStock: true,
            gallery: galleryImages,
            videoUrl: videoUrl || null,
            specifications: specs.reduce((acc, curr) => {
                if (curr.key.trim()) acc[curr.key.trim()] = curr.value.trim();
                return acc;
            }, {} as Record<string, string>),
        };

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Server xatosi');
            }
            toast.success('Mahsulot muvaffaqiyatli saqlandi! ✅');
            router.push('/admin/products');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
        }
    };

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
                    <h1 className="text-2xl font-bold text-gray-900">Mahsulot qo&apos;shish</h1>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" className="bg-white" onClick={() => router.back()}>Bekor qilish</Button>
                    <Button onClick={handleSave}>Saqlash</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Language Tabs & Basic Info */}
                    <Card>
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-gray-100">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => setActiveLang(lang.code)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeLang === lang.code
                                        ? 'bg-white shadow-sm border border-gray-200 text-gray-900 ring-1 ring-black/5'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <span>{lang.flag}</span>
                                    {lang.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-medium text-gray-700 ml-1">
                                        Mahsulot nomi ({LANGUAGES.find(l => l.code === activeLang)?.label})
                                    </label>
                                    <button className="text-xs flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 font-medium transition-colors border border-purple-100">
                                        <Sparkles className="w-3 h-3" /> Tarjima qilish
                                    </button>
                                </div>
                                <Input placeholder="Mahsulot nomini kiriting" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-medium text-gray-700 ml-1">
                                        Ta&apos;rif ({LANGUAGES.find(l => l.code === activeLang)?.label})
                                    </label>
                                    <button className="text-xs flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 font-medium transition-colors border border-purple-100">
                                        <Wand2 className="w-3 h-3" /> Yaratish
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea
                                        className="w-full min-h-[120px] p-3 border border-gray-200 rounded-[10px] outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-y text-sm text-gray-700 placeholder-gray-400"
                                        placeholder="Mahsulot haqida batafsil ma'lumot (xususiyatlari, o'lchamlari, ishlatilishi...)"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
                                        {description.length} belgi
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* ── MEDIA CARD ─────────────────────────────────────────── */}
                    <Card>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-gray-500" />
                                Rasm va Video
                                <span className="text-xs font-normal text-gray-400 ml-1">
                                    (3 ta rasm + 1 ta video)
                                </span>
                            </h3>
                            <span className="text-xs text-gray-400">
                                {images.filter(Boolean).length}/{MAX_IMAGES} rasm
                            </span>
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
                            <Button
                                variant="secondary"
                                onClick={handleUrlUpload}
                                disabled={isUrlUploading || !imageUrlInput}
                                className="shrink-0"
                            >
                                {isUrlUploading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <><Upload className="w-4 h-4 mr-1.5" /> Qo&apos;shish</>
                                }
                            </Button>
                        </div>

                        {/* 3 Image Slots */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {images.map((url, idx) => (
                                <ImageSlot
                                    key={idx}
                                    index={idx}
                                    url={url}
                                    uploading={imageUploading[idx]}
                                    onFile={handleImageFile}
                                    onRemove={handleImageRemove}
                                />
                            ))}
                        </div>

                        <p className="text-xs text-gray-400 mb-5 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Birinchi rasm asosiy rasm bo&apos;ladi. 1600×1200 px (4:3), har biri 10 MB gacha. PNG, JPG, WEBP qo&apos;llab-quvvatlanadi.
                        </p>

                        <div className="border-t border-gray-100 pt-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Film className="w-4 h-4 text-purple-500" />
                                <h4 className="text-sm font-semibold text-gray-800">Mahsulot videosi</h4>
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                                    Ixtiyoriy
                                </span>
                            </div>
                            <VideoSlot
                                url={videoUrl}
                                uploading={videoUploading}
                                onFile={handleVideoFile}
                                onRemove={() => setVideoUrl(null)}
                            />
                        </div>
                    </Card>

                    {/* Pricing */}
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-6">Narx va Qoldiq</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <Input
                                label="Narx (Avtomatik hisoblanadi)"
                                value={price}
                                readOnly
                                className="bg-gray-50 text-gray-500 font-semibold"
                                icon={<span className="text-xs font-bold text-gray-500">UZS</span>}
                            />
                            <Input label="O'lchov Birligi" placeholder="Masalan, dona" />
                        </div>

                        <Input
                            label="Eski narx"
                            placeholder="Eski narxni kiriting"
                            className="mb-6"
                            icon={<span className="text-xs font-bold text-gray-500">UZS</span>}
                        />

                        <div className="border-t border-gray-100 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input
                                    label="Tannarx"
                                    placeholder="0.00"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    type="number"
                                    icon={<span className="text-xs font-bold text-gray-500">UZS</span>}
                                />
                                <Input
                                    label="Foyda"
                                    placeholder="0.00"
                                    value={profit}
                                    onChange={(e) => setProfit(e.target.value)}
                                    type="number"
                                    icon={<span className="text-xs font-bold text-gray-500">UZS</span>}
                                />
                                <Input
                                    label="Marja (%)"
                                    placeholder="0.00"
                                    value={margin}
                                    readOnly
                                    className="bg-gray-50 text-gray-500 font-semibold"
                                    icon={<span className="text-xs font-bold text-gray-500">%</span>}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-3 flex gap-1 items-center">
                                <Info className="w-3 h-3" />
                                Foyda va Tannarx kiritilganda Narx va Marja avtomatik hisoblanadi.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6 lg:order-first">
                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Katalog</h3>

                        <div className="relative mb-4">
                            <label className="text-xs text-gray-500 mb-1 block">Asosiy Kategoriya</label>
                            {!hasMounted ? (
                                <div className="h-[42px] bg-gray-50 border border-gray-200 rounded-[10px] animate-pulse" />
                            ) : (
                                <div className="relative">
                                    <select
                                        aria-label="Kategoriyani tanlang"
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-[#064E3B]/20 focus:border-[#064E3B] outline-none transition-all appearance-none cursor-pointer"
                                        value={selectedCategory}
                                        onChange={(e) => {
                                            setSelectedCategory(e.target.value);
                                            setSelectedSubCategory('');
                                        }}
                                    >
                                        <option value="" disabled>Tanlang...</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name[activeLang as keyof typeof cat.name] || cat.name.ru}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            )}
                        </div>

                        {selectedCategory && categories.find(c => c.id === selectedCategory)?.children && (
                            <div className="relative">
                                <label className="text-xs text-gray-500 mb-1 block">Ichki Kategoriya (Model)</label>
                                <div className="relative">
                                    <select
                                        aria-label="Modelni tanlang"
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-[10px] text-sm focus:ring-2 focus:ring-[#064E3B]/20 focus:border-[#064E3B] outline-none transition-all appearance-none cursor-pointer"
                                        value={selectedSubCategory}
                                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                                    >
                                        <option value="" disabled>Modelni tanlang...</option>
                                        {categories.find(c => c.id === selectedCategory)?.children?.map((sub) => (
                                            <option key={sub.id} value={sub.id}>
                                                {sub.name[activeLang as keyof typeof sub.name] || sub.name.ru}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Holat</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Faol</span>
                            <Switch defaultChecked />
                        </div>
                    </Card>

                    <Card>
                        <h3 className="font-medium text-gray-900 mb-4">Qo&apos;shimcha</h3>
                        <div className="space-y-3 mb-4">
                            {specs.map((spec) => (
                                <div key={spec.id} className="flex gap-2 items-start">
                                    <Input
                                        placeholder="Nomi (masalan: Rang)"
                                        value={spec.key}
                                        onChange={(e) => updateSpec(spec.id, 'key', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                    <Input
                                        placeholder="Qiymati (masalan: Oq)"
                                        value={spec.value}
                                        onChange={(e) => updateSpec(spec.id, 'value', e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0"
                                        onClick={() => removeSpec(spec.id)}
                                    >
                                        <X size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            className="w-full justify-start text-left text-sm font-normal flex items-center gap-2"
                            onClick={addSpec}
                        >
                            <Plus size={14} /> Xarakteristika qo&apos;shish
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
