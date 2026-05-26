'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';import { Search, Trash2, AlertCircle, Loader2 } from 'lucide-react';

// Mock Data for Saved Codes
const SAVED_CODES = [
    { id: 1, code: '04812000000000000', name: 'Polietilen paketlar (Qoplar)', unit: 'dona', status: 'active' },
    { id: 2, code: '04819000000000000', name: 'Qog\'oz qutilar', unit: 'dona', status: 'active' },
    { id: 3, code: '10620000000000000', name: 'Yelimli lentalar (Skotch)', unit: 'rulon', status: 'inactive' },
];

// Mock API Response
const MOCK_TASNIF_RESULTS = [
    { code: '04812000000000000', name: 'Polietilen paketlar (Qoplar)', group: 'Qadoqlash materiallari', unit: 'dona' },
    { code: '04812000001000000', name: 'Polietilen paketlar (mayka)', group: 'Qadoqlash materiallari', unit: 'dona' },
    { code: '04812000002000000', name: 'Polietilen paketlar (yuk uchun)', group: 'Qadoqlash materiallari', unit: 'dona' },
];

export default function IKPUPage() {
    const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<typeof MOCK_TASNIF_RESULTS>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');

    // Validation Logic
    const _validateIKPU = (code: string) => {
        // Remove non-digits
        const cleanCode = code.replace(/\D/g, '');
        if (cleanCode.length !== 17 && cleanCode.length > 0) {
            return false;
        }
        return true;
    };

    const handleSearch = () => {
        setError('');
        if (!searchQuery) return;

        // Check format only if it looks like a code (digits)
        if (/^\d+$/.test(searchQuery) && searchQuery.length !== 17) {
            setError("IKPU kodi 17 xonali bo'lishi shart");
            return;
        }

        setIsSearching(true);
        // Simulate API delay
        setTimeout(() => {
            setSearchResults(MOCK_TASNIF_RESULTS);
            setIsSearching(false);
        }, 800);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="p-6 bg-[#F9FAFB] min-h-screen">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        IKPU / TASNIF Kodlari
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none text-xs">PRO</Badge>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Soliq qo&apos;mitasi tasniflash tizimi (MXIK)</p>
                </div>
            </div>

            <Card noPadding className="mb-8 overflow-hidden border border-gray-100 shadow-sm rounded-[12px]">
                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${activeTab === 'search' ? 'text-brand-green bg-white' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        Qidiruv va Biriktirish
                        {activeTab === 'search' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('saved')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${activeTab === 'saved' ? 'text-brand-green bg-white' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        Saqlangan Kodlar
                        {activeTab === 'saved' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green" />}
                    </button>
                </div>

                {activeTab === 'search' ? (
                    <div className="p-6">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex flex-col gap-4 mb-8">
                                <label className="text-sm font-medium text-gray-700">Mahsulot nomi yoki 17 xonali kodni kiriting</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Input
                                            placeholder="Masalan: 04812000000000000 yoki Polietilen paket"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className={error ? 'border-red-500 focus:ring-red-200' : ''}
                                            icon={<Search className="w-4 h-4" />}
                                        />
                                        {error && (
                                            <p className="absolute -bottom-6 left-0 text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> {error}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleSearch}
                                        disabled={isSearching}
                                        className="bg-brand-green hover:bg-[#053d2e] min-w-[120px]"
                                    >
                                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Qidirish'}
                                    </Button>
                                </div>
                            </div>

                            {/* Results */}
                            {searchResults.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                                        Qidiruv natijalari
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {searchResults.map((result, idx) => (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                                                            {result.code}
                                                        </span>
                                                        <span className="text-xs text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">
                                                            {result.unit}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-medium text-gray-800">{result.name}</h4>
                                                    <p className="text-xs text-gray-500">{result.group}</p>
                                                </div>
                                                <Button variant="outline" size="sm" className="text-brand-green border-brand-green hover:bg-brand-green hover:text-white">
                                                    Tanlash
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchResults.length === 0 && !isSearching && searchQuery && !error && (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p>Natijalar topilmadi</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                    <th className="py-4 pl-6 font-medium">IKPU Kodi</th>
                                    <th className="py-4 px-4 font-medium">Nomi</th>
                                    <th className="py-4 px-4 font-medium">O&apos;lchov birligi</th>
                                    <th className="py-4 px-4 font-medium">Holat</th>
                                    <th className="py-4 px-6 font-medium text-right">Harakat</th>
                                </tr>
                            </thead>
                            <tbody className="text-[14px] text-gray-700 divide-y divide-gray-50">
                                {SAVED_CODES.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 pl-6 font-mono font-medium text-gray-900">{item.code}</td>
                                        <td className="py-4 px-4">{item.name}</td>
                                        <td className="py-4 px-4">
                                            <Badge variant="neutral" className="bg-gray-100 text-gray-600">{item.unit}</Badge>
                                        </td>
                                        <td className="py-4 px-4">
                                            {item.status === 'active'
                                                ? <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-none">Faol</Badge>
                                                : <Badge variant="neutral">Nofaol</Badge>
                                            }
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button aria-label="O'chirish" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
