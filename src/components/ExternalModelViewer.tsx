"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';

interface ExternalModelViewerProps {
    prompt: string;
}

const MockBoxModel = () => (
    <mesh scale={1.5} position={[0, 0, 0]}>
        <boxGeometry args={[1, 0.5, 0.8]} />
        <meshStandardMaterial color="#c29867" roughness={0.9} />
    </mesh>
);

const GltfModel = ({ url }: { url: string }) => {
    const { scene } = useGLTF(url);
    return <primitive object={scene} scale={1.5} position={[0, -0.5, 0]} />;
};

const ModelRender = ({ url }: { url: string }) => {
    if (url === 'mock-box') {
        return <MockBoxModel />;
    }
    return <GltfModel url={url} />;
};

const ExternalModelViewer: React.FC<ExternalModelViewerProps> = ({ prompt }) => {
    const [status, setStatus] = useState<'pending' | 'generating' | 'completed' | 'error'>('pending');
    const [modelUrl, setModelUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        
        const generateModel = async () => {
            if (!prompt) return;
            setStatus('generating');
            try {
                const res = await fetch('/api/ai/generate-3d', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                if (!res.ok) throw new Error('API Error');
                const data = await res.json();
                
                if (isMounted && data.modelUrl) {
                    setModelUrl(data.modelUrl);
                    setStatus('completed');
                } else if (isMounted) {
                    setStatus('error');
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setStatus('error');
            }
        };

        generateModel();

        return () => { isMounted = false; };
    }, [prompt]);

    return (
        <div className="w-full mt-3 mb-1 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl">
            <div className="px-3 py-2 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-white/10 flex justify-between items-center">
                <span className="text-xs font-semibold text-blue-200 truncate flex items-center gap-2">
                    <span className="animate-pulse">✨</span> AI 3D Generatsiya
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                    {status === 'generating' ? 'YASALMOQDA...' : status === 'completed' ? 'TAYYOR' : 'XATO'}
                </span>
            </div>

            <div className="relative w-full h-56">
                {status === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                        <p className="text-xs text-blue-200 animate-pulse text-center px-4">
                            Tashqi AI tizimi qutini modelini yasamoqda...<br/>
                            <span className="text-[10px] text-blue-400 opacity-70">Bu jarayon 30-60 soniya vaqt olishi mumkin</span>
                        </p>
                    </div>
                )}
                
                {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/20 z-10">
                        <p className="text-xs text-red-400 text-center px-4">
                            Modelni yaratishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.
                        </p>
                    </div>
                )}

                {status === 'completed' && modelUrl && (
                    <Canvas shadows camera={{ position: [2, 1.5, 2], fov: 45 }}>
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                        <Environment preset="city" />
                        
                        <Suspense fallback={null}>
                            <ModelRender url={modelUrl} />
                        </Suspense>
                        
                        <OrbitControls 
                            enablePan={false} 
                            enableZoom={true} 
                            minDistance={1} 
                            maxDistance={5}
                            autoRotate={true}
                            autoRotateSpeed={2.0}
                        />
                    </Canvas>
                )}
            </div>
            
            <div className="px-3 py-2 bg-white/5 border-t border-white/10">
                <p className="text-[10px] text-white/50 italic truncate">
                    Prompt: "{prompt}"
                </p>
            </div>
        </div>
    );
};

export default ExternalModelViewer;
