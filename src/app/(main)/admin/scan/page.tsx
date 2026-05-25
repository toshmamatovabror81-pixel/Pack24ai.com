'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';import { ArrowLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export default function MobileScannerPage() {
    const router = useRouter();
    const [data, setData] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- Native BarcodeDetector (Chrome/Edge 83+, Safari 17.2+) ---
    useEffect(() => {
        if (!isScanning) return;

        let active = true;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // Check BarcodeDetector support
                if (!('BarcodeDetector' in window)) {
                    toast.error("Bu brauzer QR skanerni qo'llab-quvvatlamaydi. Chrome yoki Safari ishlating.");
                    return;
                }

                // @ts-expect-error — BarcodeDetector is not in TS lib yet
                const detector = new BarcodeDetector({ formats: ['qr_code'] });

                intervalRef.current = setInterval(async () => {
                    if (!videoRef.current || !canvasRef.current || !active) return;
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    if (!ctx || video.readyState < 2) return;

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);

                    try {
                        const barcodes = await detector.detect(canvas);
                        if (barcodes.length > 0) {
                            const scanData = barcodes[0].rawValue;
                            if (!scanData) return;
                            handleResult(scanData);
                        }
                    } catch {
                        // detection frame error — skip
                    }
                }, 300);
            } catch (_err) {
                toast.error("Kamerani ochishda xato. Ruxsat berilganligini tekshiring.");
            }
        };

        startCamera();

        return () => {
            active = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScanning]);

    const handleResult = (scanData: string) => {
        setData(scanData);
        setIsScanning(false);
        toast.success("QR-kod muvaffaqiyatli o'qildi!");

        // Stop camera
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }

        // Parse QR data
        let targetId = scanData;

        if (scanData.includes('?id=')) {
            targetId = scanData.split('?id=')[1];
        } else if (scanData.includes('/production/')) {
            const parts = scanData.split('/production/');
            targetId = parts[1];
        }

        setTimeout(() => {
            router.push(`/admin/production/${targetId}?view=worker`);
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="p-4 flex items-center justify-between bg-black/50 backdrop-blur fixed top-0 w-full z-10">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="text-white hover:bg-white/10"
                >
                    <ArrowLeft size={24} />
                </Button>
                <h1 className="font-bold text-lg">Skaner (Terminal)</h1>
                <div className="w-10"></div>
            </div>

            {/* Scanner Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative mt-16">
                {isScanning ? (
                    <div className="w-full max-w-md aspect-square relative overflow-hidden rounded-3xl border-2 border-emerald-500/50 mx-4">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Overlay Guide */}
                        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
                            <div className="w-full h-full border-2 border-emerald-400 relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400"></div>
                            </div>
                        </div>
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="bg-black/60 px-3 py-1 rounded-full text-xs font-mono text-emerald-400 animate-pulse">
                                QR-kodni kameraga to&apos;g&apos;irlang
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                            <Camera size={40} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Muvaffaqiyatli!</h2>
                        <p className="text-gray-400 font-mono text-sm mb-6">{data}</p>
                        <p className="text-emerald-400 text-sm">Yo&apos;naltirilmoqda...</p>
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            <div className="p-6 pb-8 bg-zinc-900 rounded-t-3xl">
                <p className="text-center text-zinc-500 text-xs mb-4">
                    Pack24 Smart Warehouse System v1.0
                </p>
                <div className="flex gap-4">
                    <Button
                        className="flex-1 py-6 text-lg bg-zinc-800 hover:bg-zinc-700 border-zinc-700"
                        onClick={() => setIsScanning(!isScanning)}
                    >
                        {isScanning ? "To'xtatish" : 'Qayta Skanerlash'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
