'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────
interface ARPreviewProps {
    width?: number;
    height?: number;
    depth?: number;
    color?: string;
    label?: string;
    rotating?: boolean;
    onScreenshot?: (dataUrl: string) => void;
}

type CameraState = 'permission-request' | 'loading' | 'active' | 'error';

// ─── Component ───────────────────────────────────────────────────
const ARPreview: React.FC<ARPreviewProps> = ({
    width = 120,
    height = 120,
    depth = 120,
    color = '#3b82f6',
    label = '',
    rotating = true,
    onScreenshot,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [cameraState, setCameraState] = useState<CameraState>('permission-request');
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const lastPinchDist = useRef<number | null>(null);

    // ── Camera setup ─────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraState('loading');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraState('active');
        } catch {
            setCameraState('error');
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        };
    }, [startCamera]);

    // ── Center box on mount ──────────────────────────────────────
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({ x: rect.width / 2, y: rect.height / 2 });
        }
    }, []);

    // ── Drag (mouse + touch) ─────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.pointerType === 'touch' && e.isPrimary) || e.pointerType === 'mouse') {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y,
        });
    };

    const handlePointerUp = () => setIsDragging(false);

    // ── Pinch to resize ──────────────────────────────────────────
    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (lastPinchDist.current !== null) {
                    const delta = dist / lastPinchDist.current;
                    setScale((prev) => Math.min(3, Math.max(0.3, prev * delta)));
                }
                lastPinchDist.current = dist;
            }
        },
        []
    );

    const handleTouchEnd = useCallback(() => {
        lastPinchDist.current = null;
    }, []);

    // ── Screenshot ───────────────────────────────────────────────
    const captureScreenshot = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw camera feed or fallback
        if (videoRef.current && cameraState === 'active') {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#e2e8f0');
            grad.addColorStop(1, '#94a3b8');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw a simple box representation
        const bx = position.x - (width * scale) / 2;
        const by = position.y - (height * scale) / 2;
        const bw = width * scale;
        const bh = height * scale;
        ctx.fillStyle = color + '88';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        if (label) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${14 * scale}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(label, position.x, position.y + 5);
        }

        const dataUrl = canvas.toDataURL('image/png');
        onScreenshot?.(dataUrl);
    }, [cameraState, color, height, label, onScreenshot, position, scale, width]);

    // ── Expose capture to parent via data attribute ──────────────
    useEffect(() => {
        if (containerRef.current) {
            (containerRef.current as HTMLDivElement & { capture: () => void }).capture = captureScreenshot;
        }
    }, [captureScreenshot]);

    // ── Computed box dims ─────────────────────────────────────────
    const w = width * scale;
    const h = height * scale;
    const d = depth * scale;
    const halfD = d / 2;

    // ── Color helpers ────────────────────────────────────────────
    const hexToRgba = (hex: string, a: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
    };

    const faceBase = hexToRgba(color, 0.45);
    const faceDark = hexToRgba(color, 0.35);
    const faceLight = hexToRgba(color, 0.55);

    // ── Render ────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden select-none bg-gradient-to-br from-slate-200 to-slate-400 touch-none"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Hidden canvas for screenshots */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera feed */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                style={{ display: cameraState === 'active' ? 'block' : 'none' }}
            />

            {/* Camera states */}
            {cameraState === 'permission-request' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-white/80 text-sm">Kamera yuklanmoqda...</p>
                    </div>
                </div>
            )}

            {cameraState === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
            )}

            {cameraState === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-500">
                    <p className="text-white/70 text-sm text-center px-4">
                        Kamera mavjud emas. Quti orqa fonda ko&apos;rsatilmoqda.
                    </p>
                </div>
            )}

            {/* 3D Box overlay */}
            <div
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                    left: position.x,
                    top: position.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div
                    style={{
                        perspective: '600px',
                        width: w,
                        height: h,
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: w,
                            height: h,
                            transformStyle: 'preserve-3d',
                            transform: 'rotateX(-20deg) rotateY(30deg)',
                            animation: rotating ? 'arBoxSpin 12s linear infinite' : 'none',
                        }}
                    >
                        {/* Front */}
                        <div
                            style={{
                                position: 'absolute',
                                width: w,
                                height: h,
                                background: `linear-gradient(135deg, ${faceBase}, ${faceDark})`,
                                border: '1.5px solid rgba(255,255,255,0.2)',
                                transform: `translateZ(${halfD}px)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backfaceVisibility: 'visible',
                            }}
                        >
                            {label && (
                                <span className="text-white font-bold text-xs text-center px-1 drop-shadow-md" style={{ fontSize: Math.max(10, Math.min(16, w / 8)) }}>
                                    {label}
                                </span>
                            )}
                        </div>
                        {/* Back */}
                        <div
                            style={{
                                position: 'absolute',
                                width: w,
                                height: h,
                                background: `linear-gradient(135deg, ${faceDark}, ${hexToRgba(color, 0.3)})`,
                                border: '1.5px solid rgba(255,255,255,0.15)',
                                transform: `rotateY(180deg) translateZ(${halfD}px)`,
                                backfaceVisibility: 'visible',
                            }}
                        />
                        {/* Left */}
                        <div
                            style={{
                                position: 'absolute',
                                width: d,
                                height: h,
                                background: `linear-gradient(135deg, ${faceDark}, ${hexToRgba(color, 0.25)})`,
                                border: '1.5px solid rgba(255,255,255,0.15)',
                                transform: `rotateY(-90deg) translateZ(0px)`,
                                transformOrigin: 'left center',
                                backfaceVisibility: 'visible',
                            }}
                        />
                        {/* Right */}
                        <div
                            style={{
                                position: 'absolute',
                                width: d,
                                height: h,
                                background: `linear-gradient(135deg, ${hexToRgba(color, 0.3)}, ${faceDark})`,
                                border: '1.5px solid rgba(255,255,255,0.15)',
                                transform: `rotateY(90deg) translateZ(${w}px)`,
                                transformOrigin: 'left center',
                                backfaceVisibility: 'visible',
                            }}
                        />
                        {/* Top */}
                        <div
                            style={{
                                position: 'absolute',
                                width: w,
                                height: d,
                                background: `linear-gradient(135deg, ${faceLight}, ${faceBase})`,
                                border: '1.5px solid rgba(255,255,255,0.2)',
                                transform: `rotateX(90deg) translateZ(0px)`,
                                transformOrigin: 'top center',
                                backfaceVisibility: 'visible',
                            }}
                        />
                        {/* Bottom */}
                        <div
                            style={{
                                position: 'absolute',
                                width: w,
                                height: d,
                                background: `linear-gradient(135deg, ${hexToRgba(color, 0.25)}, ${hexToRgba(color, 0.2)})`,
                                border: '1.5px solid rgba(255,255,255,0.1)',
                                transform: `rotateX(-90deg) translateZ(${h}px)`,
                                transformOrigin: 'bottom center',
                                backfaceVisibility: 'visible',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Animation keyframes */}
            <style jsx>{`
                @keyframes arBoxSpin {
                    from { transform: rotateX(-20deg) rotateY(0deg); }
                    to   { transform: rotateX(-20deg) rotateY(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ARPreview;
