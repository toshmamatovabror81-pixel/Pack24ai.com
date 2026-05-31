"use client";

import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { availableModels } from '../lib/models';
import { BoxDimensions, Material } from '../lib/types';


interface Mini3DViewerProps {
    modelId: string;
    textureUrl?: string;
    logoUrl?: string;
}

// We removed auto-animating wrapper to prevent React max update depth crashes.
// We will use a manual slider instead.

const Mini3DViewer: React.FC<Mini3DViewerProps> = ({ modelId, textureUrl, logoUrl }) => {
    const boxModel = availableModels.find(m => m.id === modelId);
    const [fold, setFold] = useState(0.2); // Start slightly folded

    if (!boxModel) return null;

    // Default dimensions for preview
    const defaultDims: BoxDimensions = { l: 300, w: 200, h: 150 };
    const defaultMat: Material = { id: 'm-3', name: '3-ply', color: '#c29b70', pricePerSqMeter: 7000, thickness: 3 };

    return (
        <div className="w-full mt-3 mb-1 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl">
            <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <span className="text-xs font-semibold text-blue-200 truncate">{boxModel.name}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                    3D PREVIEW
                </span>
            </div>
            <div className="relative w-full h-48 cursor-grab active:cursor-grabbing">
                <Canvas shadows camera={{ position: [0.8, 0.8, 1.2], fov: 45 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                    <directionalLight position={[-5, -10, -5]} intensity={0.3} />
                    
                    <group position={[0, -0.1, 0]} scale={0.5}>
                        <Suspense fallback={null}>
                            {(() => {
                                const Model3DComponent = boxModel.Model3D;
                                return <Model3DComponent dimensions={defaultDims} material={defaultMat} foldProgress={fold} textureUrl={textureUrl} logoUrl={logoUrl} />;
                            })()}
                        </Suspense>
                    </group>
                    
                    <OrbitControls 
                        enablePan={false} 
                        enableZoom={true} 
                        minDistance={0.5} 
                        maxDistance={3}
                        autoRotate={true}
                        autoRotateSpeed={1.0}
                    />
                </Canvas>
            </div>
            
            {/* Interactive Slider below Canvas */}
            <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex items-center gap-2">
                <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Fold</span>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={fold}
                    onChange={(e) => setFold(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-white/20 rounded-full appearance-none outline-none cursor-pointer"
                />
            </div>
        </div>
    );
};

export default Mini3DViewer;
