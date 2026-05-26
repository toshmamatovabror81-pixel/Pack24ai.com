"use client";

import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { useBoxModel } from '../lib/hooks/useBoxModel';
import { materials } from '../lib/materials';
import { availableModels, defaultModel } from '../lib/models'; // Import registry
import { useLanguage } from '../lib/contexts/LanguageContext';
import AIConsultant from './AIConsultant';

export default function BoxConfigurator() {
  const { t, tm, language, setLanguage: _setLanguage } = useLanguage();

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
  const [_langMenuOpen, _setLangMenuOpen] = useState(false);
  const [textureUrl, setTextureUrl] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  // Alias components for JSX
  const ActiveModel3D = model.Model3D;
  const ActiveLayout2D = model.Layout2D;

  // Extract totals for UI using model logic if possible, or simple math for now
  // Note: simpler to just calculate for 0201 since we know it, or need a helper in model
  // For now, let's keep the UI simple or recalculate specific to the specific model needs?
  // Ideally, the Model component returns some metadata or specific UI, but we can standardise.

  // PRICING CALCULATION
  const areaSqM = model.calculateArea ? model.calculateArea(dims) : 0;
  // Calculate total sheet dims for display (approximate for display only if needed, otherwise rely on model)
  // For UI display of sheet size, we might need another method, but for now let's focus on price.

  const pricePerUnit = areaSqM * (material.pricePerSqMeter || 0);
  const totalPrice = pricePerUnit * quantity;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(price);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] w-full bg-gray-50 font-sans overflow-hidden">

      {/* 1. SETTINGS PANEL */}
      <div className="w-full lg:w-[340px] bg-white border-r border-gray-200 p-6 z-10 overflow-y-auto flex flex-col shadow-lg">
        {/* Header removed as it is in global Navbar */}

        {/* Model Selection */}

        {/* Model Selector */}
        <div className="mb-6">
          <label htmlFor="model-select" className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">{t('settings.model')}</label>
          <select
            id="model-select"
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium"
            value={model.id}
            onChange={(e) => {
              const selected = availableModels.find(m => m.id === e.target.value);
              if (selected) setModel(selected);
            }}
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>
                {t(`model.${m.id.replace('pizza-box', 'pizza').replace('fefco-', 'fefco')}`) || m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Material Selector */}
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">{t('settings.material')}</label>
          <div className="flex gap-2">
            {materials.map((m) => (
              <button
                key={m.id}
                onClick={() => setMaterial(m)}
                className={`flex-1 py-2 px-1 text-xs rounded-md border ${material.id === m.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {tm(m.id)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
          <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">{t('settings.availableModels')}</p>
          <p className="text-sm font-medium text-gray-700">
            {availableModels.length} {t('settings.modelsTypes')}
          </p>
        </div>

        <div className="space-y-5">
          {['l', 'w', 'h'].map((k) => (
            <div key={k}>
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">
                {k === 'l' ? t('settings.length') : k === 'w' ? t('settings.width') : t('settings.height')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputs[k as keyof typeof inputs]}
                  onChange={(e) => handleInputChange(k as keyof typeof inputs, e.target.value)}
                  className={`w-full p-3 bg-gray-50 border-2 rounded-lg text-gray-900 font-bold outline-none transition-all placeholder-gray-300 ${!validation.valid ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                    }`}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">mm</span>
              </div>
            </div>
          ))}
          {!validation.valid && (
            <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-md border border-red-100">
              {validation.error}
            </p>
          )}

          {/* QUANTITY & PRICE */}
          <div className="pt-6 border-t border-gray-200">
            <label htmlFor="quantity-input" className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">{t('settings.quantity')}</label>
            <input
              id="quantity-input"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full p-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 font-bold outline-none focus:border-blue-500 mb-4"
            />

            <div className="p-4 bg-green-50 rounded-xl border border-green-100 space-y-2">
              <div>
                <p className="text-[11px] font-bold text-green-800 uppercase tracking-wider mb-1">{t('settings.totalPrice')}</p>
                <p className="text-2xl font-black text-green-700 tracking-tight">{formatPrice(totalPrice)}</p>
              </div>

              <div className="pt-2 border-t border-green-200/50 text-xs text-green-700 space-y-1">
                <div className="flex justify-between">
                  <span>{t('settings.sheetArea')}:</span>
                  <span className="font-bold">{areaSqM.toFixed(3)} m²</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('settings.materialPrice')}:</span>
                  <span className="font-bold">{formatPrice(material.pricePerSqMeter || 0)} / m²</span>
                </div>
                <div className="flex justify-between text-green-800 font-bold pt-1">
                  <span>{t('settings.unitPrice')}:</span>
                  <span>{formatPrice(pricePerUnit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA (2D & 3D) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 lg:p-8 bg-gray-100/50 overflow-y-auto">

          {/* 2D VIEW */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col relative min-h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700">{t('view.2d')}</h3>
              <span className="bg-gray-100 text-gray-500 text-xs py-1 px-2 rounded-md font-mono">
                {t(`model.${model.id.replace('pizza-box', 'pizza').replace('fefco-', 'fefco')}`) || model.name}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-4">
              {/* DYNAMIC MODEL RENDER */}
              <ActiveLayout2D dimensions={dims} material={material} foldProgress={fold} t={t} />
            </div>
          </div>

          {/* 3D VIEW */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-0 overflow-hidden flex flex-col relative h-auto">
            <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-sm py-1 px-3 rounded-md border border-gray-200">
              <span className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {t('view.3d')}
              </span>
            </div>
            <div className="w-full h-[400px]">
              <Canvas camera={{ position: [2, 2, 2], fov: 45 }} className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100">
                <ambientLight intensity={0.7} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />

                {/* DYNAMIC MODEL RENDER */}
                <ActiveModel3D dimensions={dims} material={material} foldProgress={fold} textureUrl={textureUrl} />

                <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
                <Environment preset="city" />
                <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} color="#000000" />
              </Canvas>
            </div>

            {/* Controls Area (Moved here) */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">

              {/* AI DESIGN GENERATOR */}
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <label className="text-xs font-bold text-blue-800 mb-2 block uppercase flex items-center gap-2">
                  <span className="text-lg">🎨</span> {language === 'uz' ? 'AI Dizayn' : 'AI Design'}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={language === 'uz' ? "Masalan: Yashil o'rmon va qahva..." : "E.g., Green forest and coffee..."}
                    className="flex-1 p-2 text-sm border border-blue-200 rounded-lg outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      setIsGenerating(true);
                      // Simulate generic design generation
                      setTimeout(() => {
                        // Using a placeholders for now. In real app, this comes from backend.
                        // A nice pattern texture.
                        setTextureUrl('https://images.unsplash.com/photo-1620641788421-7f1c918e749e?q=80&w=1000&auto=format&fit=crop');
                        setIsGenerating(false);
                      }, 2000);
                    }}
                    disabled={isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <span className="animate-spin block">↻</span>
                    ) : (
                      'GO'
                    )}
                  </button>
                </div>
                {textureUrl && (
                  <button onClick={() => setTextureUrl(undefined)} className="text-xs text-red-500 hover:underline w-full text-right">
                    {language === 'uz' ? "Dizaynni o'chirish" : "Remove Design"}
                  </button>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="fold-range" className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">
                  {t('settings.fold')} ({Math.round(fold * 100)}%)
                </label>
                <input
                  id="fold-range"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fold}
                  onChange={(e) => setFold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <button
                onClick={() => model.downloadPDF(dims, t)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {t('btn.downloadPDF')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AIConsultant
        model={model}
        dims={dims}
        totalPrice={totalPrice}
        unitPrice={pricePerUnit}
        material={material}
        quantity={quantity}
      />
    </div >
  );
}
