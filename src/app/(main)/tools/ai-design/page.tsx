'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { useBoxModel } from '@/lib/hooks/useBoxModel';
import { materials } from '@/lib/materials';
import { availableModels, defaultModel } from '@/lib/models';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Sparkles, RefreshCw, Wand2, Copy, AlertCircle, ChevronRight, Settings, Download, FileText, Layers, Package, ShoppingBag, Wine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// Config for Packaging Types
// ─────────────────────────────────────────────────────────────
const MOCKUP_CATS = [
    { id: 'box', uz: 'Qutichalar', ru: 'Коробки', emoji: '📦' },
    { id: 'pouch', uz: 'Paketlar', ru: 'Пакеты', emoji: '🛍️' },
    { id: 'bottle', uz: 'Shishalar', ru: 'Бутылки', emoji: '🍾' },
    { id: 'can', uz: 'Bankalar', ru: 'Банки', emoji: '🥫' },
];

const DEMO_ITEMS = [
    { id: 'fefco-0201', cat: 'box', name: 'FEFCO 0201', emoji: '📦', modelId: 'fefco-0201' },
    { id: 'fefco-0427', cat: 'box', name: 'FEFCO 0427', emoji: '📦', modelId: 'fefco-0427' },
    { id: 'pizza-box', cat: 'box', name: 'Pizza Box', emoji: '🍕', modelId: 'pizza-box' },
    { id: 'kraft-bag', cat: 'pouch', name: 'Kraft Bag', emoji: '🛍️' },
    { id: 'zip-pouch', cat: 'pouch', name: 'Zip Pouch', emoji: '👝' },
    { id: 'pet-bottle', cat: 'bottle', name: 'PET Bottle', emoji: '🍾' },
    { id: 'glass-jar', cat: 'can', name: 'Glass Jar', emoji: '🫙' },
    { id: 'aluminum-can', cat: 'can', name: 'Aluminum Can', emoji: '🥫' },
];

const STYLE_OPTIONS = [
    { id: 'minimalist',  uz: 'Minimalist',    ru: 'Минималист',    emoji: '⬜' },
    { id: 'luxury',      uz: 'Hashamatli',    ru: 'Роскошный',     emoji: '✨' },
    { id: 'eco',         uz: 'Ekologik',      ru: 'Экологичный',   emoji: '🌿' },
    { id: 'bold',        uz: 'Dadil',         ru: 'Дерзкий',       emoji: '🎨' },
    { id: 'vintage',     uz: 'Vintage',       ru: 'Ретро',         emoji: '🎞️' },
    { id: 'playful',     uz: 'Quvnoq',        ru: 'Игривый',       emoji: '🎉' },
];

export default function AIDesignPage() {
    const { language } = useLanguage();

    // Packaging Type State
    const [selectedCat, setSelectedCat] = useState('box');
    const [selectedType, setSelectedType] = useState('fefco-0201');
    
    // Dynamic dimensions for Bottle/Can
    const [bottleDims, setBottleDims] = useState({
        mouth: '20',
        body: '95',
        bottom: '96',
        height: '180'
    });
    
    const activeTypeItem = DEMO_ITEMS.find(i => i.id === selectedType);

    // Box Model State (Only used if category is 'box')
    const {
        model,
        setModel,
        material,
        setMaterial,
        inputs,
        handleInputChange,
        dims,
        validation
    } = useBoxModel({ initialModel: defaultModel });

    const [fold, setFold] = useState(0.5);
    const [quantity, setQuantity] = useState(100);
    
    // AI State
    const [prompt, setPrompt] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('minimalist');
    const [isGenerating, setIsGenerating] = useState(false);
    const [textureUrl, setTextureUrl] = useState<string | undefined>(undefined);
    const [aiVariants, setAiVariants] = useState<Array<{ index: number; seed: number; dataUrl: string }>>([]);
    const [selectedVariant, setSelectedVariant] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const t_local = (uz: string, ru: string) => language === 'ru' ? ru : uz;

    // Alias components for JSX
    const ActiveModel3D = model.Model3D;
    const ActiveLayout2D = model.Layout2D;

    // Pricing
    const areaSqM = model.calculateArea ? model.calculateArea(dims) : 0;
    const pricePerUnit = areaSqM * (material.pricePerSqMeter || 0);
    const totalPrice = pricePerUnit * quantity;

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(price);
    };

    // Filter items by category
    const filteredItems = DEMO_ITEMS.filter(i => i.cat === selectedCat);

    // Handle type change
    const handleTypeChange = (typeId: string) => {
        setSelectedType(typeId);
        const item = DEMO_ITEMS.find(i => i.id === typeId);
        if (item && item.modelId) {
            const selectedModel = availableModels.find(m => m.id === item.modelId);
            if (selectedModel) setModel(selectedModel);
        }
    };

    // ── Generate AI Design ──────────────────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);

        // Add packaging type to prompt for better results
        const typeName = activeTypeItem ? activeTypeItem.name : 'packaging';
        const fullPrompt = `${typeName} design: ${prompt.trim()}`;

        try {
            const res = await fetch('/api/tools/ai-design/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fullPrompt, style: selectedStyle, count: 4, width: 768, height: 768 }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Xato' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const images = data.images ?? [];

            if (images.length === 0) {
                throw new Error(t_local('Hech qanday rasm yuklanmadi. Qayta urining.', 'Ни одного изображения не загружено. Попробуйте снова.'));
            }

            setAiVariants(images);
            setSelectedVariant(0);
            setTextureUrl(images[0].dataUrl);
            toast.success(t_local(`${images.length} ta variant yaratildi!`, `Создано ${images.length} вариантов!`));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Noma\'lum xato';
            setError(msg);
            toast.error(t_local('Yaratishda xato: ' + msg, 'Ошибка: ' + msg));
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, selectedStyle, activeTypeItem, language]);

    // Texture Loader for Simple Shapes
    const texture = useMemo(() => {
        if (!textureUrl) return null;
        const loader = new THREE.TextureLoader();
        return loader.load(textureUrl);
    }, [textureUrl]);

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] w-full bg-[#1a1a2e] font-sans overflow-hidden">

            {/* 1. SETTINGS PANEL (Left) */}
            <div className="w-full lg:w-[380px] bg-[#16162a] border-r border-white/5 p-4 z-10 overflow-y-auto flex flex-col" style={{boxShadow:'2px 0 20px rgba(0,0,0,0.3)'}}>
                
                {/* Header */}
                <div className="mb-5">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Link href="/tools" className="hover:text-cyan-400 transition-colors">{t_local('Asboblar', 'Инструменты')}</Link>
                        <ChevronRight size={12} />
                        <span className="text-gray-400 font-medium">AI Packaging Studio</span>
                    </div>
                    <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"><Sparkles size={16} className="text-white" /></span>
                        PACK24 Studio
                    </h1>
                </div>

                {/* STEP 1: Qadoq Turini Tanlash */}
                <div className="mb-5">
                    <label className="text-[10px] font-bold text-cyan-400/80 mb-2 block uppercase tracking-[0.15em]">
                        1. {t_local('Qadoq turini tanlang', 'Выберите тип упаковки')}
                    </label>
                    
                    {/* Categories */}
                    <div className="flex gap-1 overflow-x-auto pb-1 mb-2">
                        {MOCKUP_CATS.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setSelectedCat(cat.id);
                                    const firstItem = DEMO_ITEMS.find(i => i.cat === cat.id);
                                    if (firstItem) handleTypeChange(firstItem.id);
                                }}
                                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 ${
                                    selectedCat === cat.id
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg shadow-cyan-500/20'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {cat.emoji} {language === 'ru' ? cat.ru : cat.uz}
                            </button>
                        ))}
                    </div>

                    {/* Items Grid */}
                    <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto p-1 bg-white/[0.03] rounded-lg border border-white/5">
                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleTypeChange(item.id)}
                                className={`text-xs p-2 rounded-md border text-left flex items-center gap-2 transition-all duration-200 ${
                                    selectedType === item.id
                                        ? 'border-cyan-500/50 bg-cyan-500/10 font-bold text-cyan-300'
                                        : 'border-white/5 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white'
                                }`}
                            >
                                <span>{item.emoji}</span>
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* STEP 2: AI Dizayn */}
                <div className="mb-5 p-4 bg-white/[0.03] rounded-xl border border-white/5">
                    <label className="text-[10px] font-bold text-cyan-400/80 mb-2 block uppercase tracking-[0.15em] flex items-center gap-2">
                        2. <Sparkles size={12} /> {t_local('AI Dizayn Yaratish', 'Создать AI Дизайн')}
                    </label>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder={t_local("Masalan: Organik asal brendi uchun minimalist...", "Например: Минималистичный дизайн для...")}
                        rows={3}
                        className="w-full p-2.5 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-none mb-2 text-gray-200 placeholder-gray-600"
                    />
                    
                    {/* Styles */}
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">{t_local('Uslub', 'Стиль')}</label>
                    <div className="grid grid-cols-3 gap-1 mb-3">
                        {STYLE_OPTIONS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedStyle(s.id)}
                                className={`text-[10px] p-1.5 rounded-md border text-center transition-all duration-200 ${
                                    selectedStyle === s.id
                                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                                        : 'border-white/5 bg-white/[0.03] text-gray-500 hover:border-white/20 hover:text-gray-300'
                                }`}
                            >
                                <span className="block text-sm">{s.emoji}</span>
                                <span className="text-[8px] truncate block">{language === 'ru' ? s.ru : s.uz}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isGenerating}
                        className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 rounded-lg text-xs hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-200"
                    >
                        {isGenerating ? (
                            <><RefreshCw size={12} className="animate-spin" /> {t_local('Yaratilmoqda...', 'Генерация...')}</>
                        ) : (
                            <><Wand2 size={12} /> {t_local('Dizayn yaratish', 'Создать дизайн')}</>
                        )}
                    </button>
                    
                    {aiVariants.length > 0 && (
                        <div className="mt-3">
                            <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase tracking-[0.15em]">
                                {t_local(`Variantlar (${aiVariants.length})`, `Варианты (${aiVariants.length})`)}
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                                {aiVariants.map((v, i) => (
                                    <button
                                        key={v.seed}
                                        onClick={() => {
                                            setSelectedVariant(i);
                                            setTextureUrl(v.dataUrl);
                                        }}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 group ${
                                            selectedVariant === i
                                                ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                                                : 'border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        <img src={v.dataUrl} alt={`Variant ${v.index}`} className="w-full h-20 object-cover" />
                                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                                            selectedVariant === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        }`}>
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                                selectedVariant === i
                                                    ? 'bg-cyan-500 text-white'
                                                    : 'bg-black/60 text-white'
                                            }`}>
                                                {selectedVariant === i ? '✓ ' + t_local('Tanlangan', 'Выбрано') : t_local('Tanlash', 'Выбрать')}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim() || isGenerating}
                                    className="flex-1 flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-1.5 rounded text-[10px] font-bold transition-all"
                                >
                                    <RefreshCw size={10} /> {t_local('Qayta yaratish', 'Пересоздать')}
                                </button>
                                <button
                                    onClick={() => { setAiVariants([]); setTextureUrl(undefined); setSelectedVariant(0); }}
                                    className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded text-[10px] font-bold transition-all"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Conditional Settings based on Category */}
                {selectedCat === 'box' ? (
                    <>
                        <div className="mb-4">
                            <label className="text-[10px] font-bold text-gray-500 mb-2 block uppercase tracking-[0.15em]">{t_local("O'lchamlar (mm)", "Размеры (мм)")}</label>
                            <div className="space-y-2">
                                {['l', 'w', 'h'].map((k) => (
                                    <div key={k} className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-gray-500 w-4 uppercase">{k}</label>
                                        <input
                                            type="text"
                                            value={inputs[k as keyof typeof inputs]}
                                            onChange={(e) => handleInputChange(k as any, e.target.value)}
                                            className="flex-1 p-1.5 bg-white/5 border border-white/10 rounded-md text-sm font-bold text-white focus:border-cyan-500/50 outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-[0.15em]">
                                {t_local('Buklash', 'Складывание')} ({Math.round(fold * 100)}%)
                            </label>
                            <input
                                type="range"
                                min="0" max="1" step="0.01"
                                value={fold}
                                onChange={(e) => setFold(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    </>
                ) : selectedCat === 'bottle' || selectedCat === 'can' ? (
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-gray-500 mb-2 block uppercase tracking-[0.15em]">{t_local("O'lchamlar (mm)", "Размеры (мм)")}</label>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500 w-16 uppercase">{t_local('Og\'iz', 'Горло')}</label>
                                <input type="text" value={bottleDims.mouth} onChange={(e) => setBottleDims({...bottleDims, mouth: e.target.value})} className="flex-1 p-1.5 bg-white/5 border border-white/10 rounded-md text-sm font-bold text-white focus:border-cyan-500/50 outline-none" placeholder="20" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500 w-16 uppercase">{t_local('Qorin', 'Тело')}</label>
                                <input type="text" value={bottleDims.body} onChange={(e) => setBottleDims({...bottleDims, body: e.target.value})} className="flex-1 p-1.5 bg-white/5 border border-white/10 rounded-md text-sm font-bold text-white focus:border-cyan-500/50 outline-none" placeholder="95" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500 w-16 uppercase">{t_local('Osti', 'Дно')}</label>
                                <input type="text" value={bottleDims.bottom} onChange={(e) => setBottleDims({...bottleDims, bottom: e.target.value})} className="flex-1 p-1.5 bg-white/5 border border-white/10 rounded-md text-sm font-bold text-white focus:border-cyan-500/50 outline-none" placeholder="96" />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-500 w-16 uppercase">{t_local('Balandlik', 'Высота')}</label>
                                <input type="text" value={bottleDims.height} onChange={(e) => setBottleDims({...bottleDims, height: e.target.value})} className="flex-1 p-1.5 bg-white/5 border border-white/10 rounded-md text-sm font-bold text-white focus:border-cyan-500/50 outline-none" placeholder="180" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/10 text-xs text-cyan-400/70">
                        {t_local('Ushbu qadoq turi uchun o\'lchamlar va buklash funksiyasi tez kunda qo\'shiladi.', 'Размеры и складывание для этого типа появятся скоро.')}
                    </div>
                )}

                {/* Pricing & Download */}
                {selectedCat === 'box' && (
                    <div className="mt-auto pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{t_local('Jami narx', 'Итого')}</span>
                            <span className="text-lg font-black text-cyan-400">{formatPrice(totalPrice)}</span>
                        </div>
                        <button
                            onClick={() => model.downloadPDF(dims, t_local)}
                            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5"
                        >
                            <Download size={14} /> {t_local('PDF chizmani yuklash', 'Скачать PDF чертеж')}
                        </button>
                    </div>
                )}
            </div>

            {/* 2. MAIN CONTENT AREA (Right) */}
            <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
                
                {/* 3D View */}
                <div className="flex-1 relative h-1/2 lg:h-full bg-gradient-to-b from-[#e0e0ec] to-[#c8c8d8]">
                    <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md py-1.5 px-3 rounded-lg border border-white/10">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                            3D View — {activeTypeItem ? activeTypeItem.name : 'Mockup'}
                        </span>
                    </div>
                    
                    <Canvas camera={{ position: [2, 2, 2], fov: 45 }} className="w-full h-full">
                        <ambientLight intensity={1.2} />
                        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
                        <pointLight position={[-5, 5, -5]} intensity={0.5} />
                        <pointLight position={[0, -5, 5]} intensity={0.3} />
                        
                        {/* DYNAMIC MODEL RENDER */}
                        {selectedCat === 'box' ? (
                            <ActiveModel3D dimensions={dims} material={material} foldProgress={fold} textureUrl={textureUrl} />
                        ) : selectedCat === 'bottle' || selectedCat === 'can' ? (
                            <mesh position={[0, 0, 0]} castShadow>
                                <cylinderGeometry args={[0.6, 0.6, 2, 32]} />
                                <meshStandardMaterial 
                                    color={textureUrl ? "white" : "#888890"} 
                                    map={texture} 
                                    roughness={0.3}
                                    metalness={0.1}
                                />
                            </mesh>
                        ) : (
                            <mesh position={[0, 0, 0]} castShadow>
                                <boxGeometry args={[1, 1.5, 0.2]} />
                                <meshStandardMaterial 
                                    color={textureUrl ? "white" : "#a09070"} 
                                    map={texture}
                                    roughness={0.6}
                                />
                            </mesh>
                        )}
                        
                        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
                    </Canvas>
                </div>

                {/* 2D View (Chizma) */}
                <div className="w-full lg:w-[350px] bg-[#16162a] border-l border-white/5 flex flex-col h-1/2 lg:h-full">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="font-bold text-white/80 text-sm">2D Chizma (Dieline)</h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                        {selectedCat === 'box' ? (
                            <div className="w-full h-full max-w-[300px] max-h-[300px] border border-dashed border-white/10 rounded-xl bg-white/[0.02] p-4 flex items-center justify-center">
                                <ActiveLayout2D dimensions={dims} material={material} foldProgress={fold} t={t_local} />
                            </div>
                        ) : selectedCat === 'pouch' ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <svg width="100%" height="100%" viewBox="0 0 200 250" className="max-w-[200px] max-h-[250px]">
                                    {/* Outer border */}
                                    <rect x="10" y="10" width="180" height="230" fill="none" stroke="#444" strokeWidth="1" />
                                    {/* Seals */}
                                    <rect x="15" y="15" width="170" height="220" fill="none" stroke="#555" strokeWidth="1" strokeDasharray="2,2" />
                                    {/* Zip line */}
                                    <line x1="15" y1="40" x2="185" y2="40" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4,2" />
                                    <text x="100" y="35" textAnchor="middle" fontSize="10" fill="#22d3ee" fontStyle="italic">ZIP</text>
                                    {/* Dimensions */}
                                    <text x="100" y="130" textAnchor="middle" fontSize="12" fill="#888" fontWeight="bold">W: 180mm</text>
                                    <text x="100" y="150" textAnchor="middle" fontSize="12" fill="#888" fontWeight="bold">H: 230mm</text>
                                    <text x="100" y="210" textAnchor="middle" fontSize="10" fill="#555">Dieline (Pouch)</text>
                                </svg>
                            </div>
                        ) : selectedCat === 'bottle' ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <svg width="100%" height="100%" viewBox="0 0 200 250" className="max-w-[200px] max-h-[250px]">
                                    {/* Bottle Outline */}
                                    <path d="M 90 30 L 110 30 L 110 60 L 135 100 L 135 210 L 65 210 L 65 100 L 90 60 Z" fill="none" stroke="#666" strokeWidth="2" />
                                    <line x1="90" y1="20" x2="110" y2="20" stroke="#22d3ee" strokeWidth="1" />
                                    <line x1="90" y1="15" x2="90" y2="25" stroke="#22d3ee" strokeWidth="1" />
                                    <line x1="110" y1="15" x2="110" y2="25" stroke="#22d3ee" strokeWidth="1" />
                                    <text x="100" y="12" textAnchor="middle" fontSize="10" fill="#22d3ee" fontWeight="bold">{bottleDims.mouth} mm</text>
                                    
                                    {/* Belly/Body Dimension */}
                                    <line x1="65" y1="140" x2="135" y2="140" stroke="#ff4500" strokeWidth="1" strokeDasharray="2,2" />
                                    <line x1="65" y1="135" x2="65" y2="145" stroke="#ff4500" strokeWidth="1" />
                                    <line x1="135" y1="135" x2="135" y2="145" stroke="#ff4500" strokeWidth="1" />
                                    <text x="100" y="135" textAnchor="middle" fontSize="10" fill="#ff4500" fontWeight="bold">{bottleDims.body} mm</text>
                                    
                                    {/* Bottom Dimension */}
                                    <line x1="65" y1="230" x2="135" y2="230" stroke="#ff4500" strokeWidth="1" />
                                    <line x1="65" y1="225" x2="65" y2="235" stroke="#ff4500" strokeWidth="1" />
                                    <line x1="135" y1="225" x2="135" y2="235" stroke="#ff4500" strokeWidth="1" />
                                    <text x="100" y="225" textAnchor="middle" fontSize="10" fill="#ff4500" fontWeight="bold">{bottleDims.bottom} mm</text>
                                    
                                    {/* Height Dimension */}
                                    <line x1="155" y1="30" x2="155" y2="210" stroke="#666" strokeWidth="1" />
                                    <line x1="150" y1="30" x2="160" y2="30" stroke="#666" strokeWidth="1" />
                                    <line x1="150" y1="210" x2="160" y2="210" stroke="#666" strokeWidth="1" />
                                    <text x="165" y="125" textAnchor="left" fontSize="10" fill="#666" transform="rotate(90,165,125)">H: {bottleDims.height}mm</text>
                                    
                                    <text x="100" y="250" textAnchor="middle" fontSize="10" fill="#aaa">Shisha Profili (Technical)</text>
                                </svg>
                            </div>
                        ) : selectedCat === 'can' ? (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <svg width="100%" height="100%" viewBox="0 0 200 200" className="max-w-[200px] max-h-[200px]">
                                    {/* Can Outline */}
                                    <rect x="60" y="30" width="80" height="130" rx="5" fill="none" stroke="#666" strokeWidth="2" />
                                    
                                    {/* Diameter Dimension */}
                                    <line x1="60" y1="20" x2="140" y2="20" stroke="#ff4500" strokeWidth="1" />
                                    <line x1="60" y1="15" x2="60" y2="25" stroke="#ff4500" strokeWidth="1" />
                                    <line x1="140" y1="15" x2="140" y2="25" stroke="#ff4500" strokeWidth="1" />
                                    <text x="100" y="12" textAnchor="middle" fontSize="10" fill="#ff4500" fontWeight="bold">Ø {bottleDims.body} mm</text>
                                    
                                    {/* Height Dimension */}
                                    <line x1="160" y1="30" x2="160" y2="160" stroke="#666" strokeWidth="1" />
                                    <line x1="155" y1="30" x2="165" y2="30" stroke="#666" strokeWidth="1" />
                                    <line x1="155" y1="160" x2="165" y2="160" stroke="#666" strokeWidth="1" />
                                    <text x="170" y="100" textAnchor="left" fontSize="10" fill="#666" transform="rotate(90,170,100)">H: {bottleDims.height}mm</text>
                                    
                                    <text x="100" y="190" textAnchor="middle" fontSize="10" fill="#aaa">Banka Profili (Technical)</text>
                                </svg>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 p-4">
                                <FileText size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-xs">
                                    {t_local('Ushbu qadoq turi uchun 2D chizma hozircha mavjud emas.', '2D чертеж для этого типа пока недоступен.')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
