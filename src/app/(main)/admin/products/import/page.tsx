'use client';

import { useState, useRef } from 'react';
import {
    Upload, FileSpreadsheet, Download, CheckCircle,
    AlertCircle, Loader2, ChevronRight, X, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface ImportResult {
    created: number;
    updated: number;
    total: number;
    errors: { row: number; error: string }[];
}

// ─── CSV parser (client-side, faqat text/CSV) ────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values: string[] = [];
        let cur = '';
        let inQ = false;
        for (const ch of line) {
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; continue; }
            cur += ch;
        }
        values.push(cur.trim());
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? '' }), {} as Record<string, string>);
    });
}

export default function BulkImportPage() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [rows, setRows]         = useState<Record<string, string>[]>([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading]   = useState(false);
    const [result, setResult]     = useState<ImportResult | null>(null);
    const [previewMax]            = useState(5);

    const handleFile = (file: File) => {
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
            toast.error('Faqat .csv yoki .json fayl qabul qilinadi');
            return;
        }
        setResult(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = (e.target?.result as string) ?? '';
            try {
                if (file.name.endsWith('.json')) {
                    const parsed = JSON.parse(text);
                    setRows(Array.isArray(parsed) ? parsed : [parsed]);
                } else {
                    setRows(parseCSV(text));
                }
                toast.success('Fayl o\'qildi');
            } catch {
                toast.error('Faylni o\'qishda xatolik');
            }
        };
        reader.readAsText(file, 'utf-8');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleImport = async () => {
        if (!rows.length) { toast.error('Avval fayl yuklang'); return; }
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/products/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: rows }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResult(data);
                toast.success(`✅ ${data.created} ta yaratildi, ${data.updated} ta yangilandi`);
            } else {
                toast.error(data.error ?? 'Import muvaffaqiyatsiz');
            }
        } catch {
            toast.error('Tarmoq xatosi');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        window.open('/api/products/bulk-import', '_blank');
    };

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <Link href="/admin/products" className="hover:text-blue-600">Mahsulotlar</Link>
                <ChevronRight size={14} />
                <span className="text-gray-700 font-medium">Bulk Import</span>
            </div>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Excel / CSV Import</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Bir vaqtda 500 tagacha mahsulot qo&apos;shing yoki yangilang</p>
                </div>
                <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-4 py-2.5 rounded-xl transition-colors"
                >
                    <Download size={14} /> CSV Namuna
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Upload zone */}
                <div className="lg:col-span-2 space-y-5">
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
                            rows.length > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                        }`}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.json"
                            className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                            aria-label="CSV yoki JSON fayl tanlash"
                        />
                        {rows.length > 0 ? (
                            <div>
                                <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
                                <p className="font-bold text-emerald-700 text-lg">{fileName}</p>
                                <p className="text-sm text-emerald-600 mt-1">{rows.length} ta qator topildi</p>
                                <button
                                    onClick={e => { e.stopPropagation(); setRows([]); setFileName(''); setResult(null); }}
                                    className="mt-3 text-xs text-red-400 hover:text-red-600 flex items-center gap-1 mx-auto"
                                >
                                    <X size={12} /> Bekor qilish
                                </button>
                            </div>
                        ) : (
                            <div>
                                <Upload size={40} className="mx-auto text-gray-300 mb-3" />
                                <p className="font-semibold text-gray-600">CSV yoki JSON faylni tashlab keting</p>
                                <p className="text-sm text-gray-400 mt-1">yoki <span className="text-blue-600 font-semibold">bosib tanlang</span></p>
                                <p className="text-xs text-gray-300 mt-3">Maksimal 500 qator · .csv, .json</p>
                            </div>
                        )}
                    </div>

                    {/* Preview table */}
                    {rows.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                                <p className="text-sm font-bold text-gray-800">
                                    Ko&apos;rish ({Math.min(previewMax, rows.length)}/{rows.length} qator)
                                </p>
                                <span className="text-xs text-gray-400">{columns.length} ta ustun</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            {columns.map(col => (
                                                <th key={col} className="py-2 px-3 text-left text-gray-500 font-semibold whitespace-nowrap">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {rows.slice(0, previewMax).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                {columns.map(col => (
                                                    <td key={col} className="py-2 px-3 text-gray-600 truncate max-w-[140px]">{row[col] || '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className={`rounded-2xl border p-5 ${result.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                {result.errors.length > 0 ? <AlertCircle size={18} className="text-amber-600" /> : <CheckCircle size={18} className="text-emerald-600" />}
                                <p className="font-bold text-gray-800">Import natijasi</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-3">
                                <div className="text-center bg-white rounded-xl p-3 border border-emerald-100">
                                    <p className="text-2xl font-extrabold text-emerald-600">{result.created}</p>
                                    <p className="text-xs text-gray-400">Yaratildi</p>
                                </div>
                                <div className="text-center bg-white rounded-xl p-3 border border-blue-100">
                                    <p className="text-2xl font-extrabold text-blue-600">{result.updated}</p>
                                    <p className="text-xs text-gray-400">Yangilandi</p>
                                </div>
                                <div className="text-center bg-white rounded-xl p-3 border border-red-100">
                                    <p className="text-2xl font-extrabold text-red-500">{result.errors.length}</p>
                                    <p className="text-xs text-gray-400">Xato</p>
                                </div>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                                    {result.errors.map((e, i) => (
                                        <p key={i} className="text-red-600"><span className="font-bold">Qator {e.row}:</span> {e.error}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Instructions */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <p className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-emerald-500" /> Majburiy ustunlar
                        </p>
                        <div className="space-y-2">
                            {[
                                { col: 'name', req: true, desc: "Mahsulot nomi" },
                                { col: 'price', req: true, desc: "So'm birligida narx" },
                                { col: 'sku', req: false, desc: "Unikal kod (yangilash uchun)" },
                                { col: 'categorySlug', req: false, desc: "Kategoriya slug" },
                                { col: 'minPrice', req: false, desc: "Ulgurji narx" },
                                { col: 'description', req: false, desc: "Tavsif" },
                                { col: 'image', req: false, desc: "Rasm URL" },
                                { col: 'status', req: false, desc: "active / inactive" },
                            ].map(item => (
                                <div key={item.col} className="flex items-start gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${item.req ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {item.req ? 'Maj' : 'Ixt'}
                                    </span>
                                    <div>
                                        <p className="text-xs font-mono font-bold text-gray-700">{item.col}</p>
                                        <p className="text-[10px] text-gray-400">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={loading || rows.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors shadow-lg shadow-blue-200"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {loading ? 'Import qilinmoqda...' : `${rows.length > 0 ? rows.length + ' ta ' : ''}Mahsulotni import qilish`}
                    </button>

                    <Link href="/admin/products" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 w-full py-2">
                        ← Mahsulotlarga qaytish
                    </Link>
                </div>
            </div>
        </div>
    );
}
