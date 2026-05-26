'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Download, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { useProductStore, type ImportData } from '@/lib/store/useProductStore';
import { toast } from 'sonner';

type ScrapePreview = ImportData & { categoryPath?: string[] };

interface ImportProductModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ImportProductModal({ isOpen, onClose }: ImportProductModalProps) {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState<ScrapePreview | null>(null);
    const { importProduct } = useProductStore();

    if (!isOpen) return null;

    const handleScrape = async () => {
        if (!url) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
            } else {
                setPreviewData(data as ScrapePreview);
                toast.success('Ma\'lumotlar yuklandi!');
            }
        } catch (_e) {
            toast.error("Xatolik yuz berdi");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!previewData) return;

        // Auto-download image if it's a remote URL
        let finalImage = previewData.image;
        if (previewData.image && previewData.image.startsWith('http')) {
            try {
                const uploadRes = await fetch('/api/upload/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: previewData.image })
                });
                const uploadData = await uploadRes.json();
                if (uploadRes.ok && uploadData.success) {
                    finalImage = uploadData.url;
                    toast.success("Rasm serverga yuklab olindi");
                } else {
                    toast.warning("Rasm yuklab olinmadi, asl havola saqlandi");
                }
            } catch (err) {
                console.error("Image download failed", err);
                toast.warning("Rasm yuklab olinmadi (Network Error)");
            }
        }

        const { categoryPath: _cp, ...importPayload } = previewData;
        void _cp;
        importProduct({ ...importPayload, image: finalImage });
        toast.success("Mahsulot 'Qoralama'ga qo'shildi!");
        onClose();
        setUrl('');
        setPreviewData(null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Download className="text-blue-600" />
                        Pack24.ru Import
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {!previewData ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                            <p className="text-sm text-blue-700">
                                <b>Eslatma:</b> Faqat <code>pack24.ru</code> mahsulot havolalarini kiriting.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="https://pack24.ru/catalog/..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleScrape} disabled={isLoading || !url} className="bg-blue-600 hover:bg-blue-700">
                                {isLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <Image src={previewData.image ?? '/icons/box.png'} alt="" className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white" width={300} height={300} />
                            <div className="flex-1 space-y-2">
                                <h3 className="font-bold text-gray-800 text-lg leading-tight">{previewData.name}</h3>

                                {/* Breadcrumbs Preview */}
                                {previewData.categoryPath && previewData.categoryPath.length > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                        <span className="font-semibold">Kategoriya:</span>
                                        {previewData.categoryPath.map((crumb: string, i: number) => (
                                            <span key={i} className="flex items-center">
                                                {i > 0 && <span className="mx-1 text-gray-400">/</span>}
                                                {crumb}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 items-center">
                                    <span className="text-sm font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                        Narx: {previewData.price} RUB
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Specifications Table */}
                        {previewData.specifications && Object.keys(previewData.specifications).length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Texnik Xususiyatlar (Exact Match)</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    {Object.entries(previewData.specifications).map(([key, value]) => (
                                        <div key={key} className="flex justify-between border-b border-gray-200 pb-1 last:border-0">
                                            <span className="text-gray-500">{key}:</span>
                                            <span className="font-medium text-gray-900 text-right">{(value as string)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <Button variant="ghost" onClick={() => setPreviewData(null)}>Bekor qilish</Button>
                            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                <CheckCircle size={16} /> Saqlash (Draft)
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
