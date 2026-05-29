'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Calculator, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { BoxCalculatorConfig } from '@/lib/domain/boxCalculatorConfig';
import { DEFAULT_BOX_CALCULATOR_CONFIG } from '@/lib/domain/boxCalculatorConfig';
import type { PaperLayerProfileId } from '@/lib/domain/boxCalculator';

const PROFILE_LABELS: Record<PaperLayerProfileId, string> = {
    'e-flute': 'E-Flute m² narxi',
    'b-flute': 'B-Flute m² narxi',
    'eb-flute': 'EB-Flute m² narxi',
    'bc-flute': 'BC-Flute m² narxi',
};

export default function BoxCalculatorSettings() {
    const [config, setConfig] = useState<BoxCalculatorConfig>(DEFAULT_BOX_CALCULATOR_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/box-calculator/config');
            if (res.ok) setConfig(await res.json());
            else toast.error('Yuklashda xatolik');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/box-calculator/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                setConfig(await res.json());
                toast.success('Kalkulyator narxlari saqlandi');
            } else {
                toast.error('Saqlashda xatolik');
            }
        } finally {
            setSaving(false);
        }
    };

    const setNum = (key: keyof BoxCalculatorConfig, value: string) => {
        const n = parseFloat(value);
        setConfig(c => ({ ...c, [key]: Number.isFinite(n) ? n : 0 }));
    };

    const setProfilePrice = (id: PaperLayerProfileId, value: string) => {
        const n = parseFloat(value);
        setConfig(c => ({
            ...c,
            profilePricePerSqM: {
                ...c.profilePricePerSqM,
                [id]: Number.isFinite(n) ? n : 0,
            },
        }));
    };

    if (loading) {
        return (
            <Card className="p-6 border border-gray-200 rounded-[12px] bg-white animate-pulse">
                <div className="h-6 bg-gray-100 rounded w-48 mb-4" />
                <div className="h-32 bg-gray-50 rounded" />
            </Card>
        );
    }

    return (
        <Card className="p-6 border border-gray-200 shadow-sm rounded-[12px] bg-white">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-500" /> Quti kalkulyatori narxlari
                </h2>
                <button type="button" onClick={load} className="text-gray-400 hover:text-gray-600" title="Yangilash">
                    <RefreshCw size={16} />
                </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
                Ustama va tannarx parametrlari faqat admin uchun. Mijoz saytda faqat taxminiy sotuv narxini ko&apos;radi.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <Field label="Ustama (foyda) %" value={config.markupPercent} onChange={v => setNum('markupPercent', v)} />
                <Field label="Chiqindi koeffitsienti (1.10 = +10%)" value={config.wasteFactor} onChange={v => setNum('wasteFactor', v)} step="0.01" />
                <Field label="Pechat + yelim (so'm/dona)" value={config.printGlueUzs} onChange={v => setNum('printGlueUzs', v)} />
                <Field label="Ishchi ulushi (so'm/dona)" value={config.laborUzs} onChange={v => setNum('laborUzs', v)} />
                <Field label="Doimiy xarajat ulushi (so'm/dona)" value={config.fixedUzs} onChange={v => setNum('fixedUzs', v)} />
                <Field label="Ofset pechat sozlama (1 marta)" value={config.offsetOneTimePrintUzs} onChange={v => setNum('offsetOneTimePrintUzs', v)} />
                <Field label="Ofset dizayn sozlama (1 marta)" value={config.offsetOneTimeDesignUzs} onChange={v => setNum('offsetOneTimeDesignUzs', v)} />
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Gofrokarton narxi (so&apos;m / m²)</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
                {(Object.keys(PROFILE_LABELS) as PaperLayerProfileId[]).map(id => (
                    <Field
                        key={id}
                        label={PROFILE_LABELS[id]}
                        value={config.profilePricePerSqM[id]}
                        onChange={v => setProfilePrice(id, v)}
                    />
                ))}
            </div>

            <Button onClick={save} disabled={saving} className="gap-2">
                <Save size={16} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
        </Card>
    );
}

function Field({
    label, value, onChange, step = '1',
}: {
    label: string; value: number; onChange: (v: string) => void; step?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <Input
                type="number"
                step={step}
                min={0}
                value={value}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}
