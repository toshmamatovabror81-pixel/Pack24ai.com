'use client';

import { Slider } from '@/components/ui/Slider';
import { Checkbox } from '@/components/ui/Checkbox';

/** Mirrors `availableFilters` from `useProductFilter` */
export interface CatalogAvailableFilters {
    price: { min: number; max: number };
    dimensions: { width: number; height: number; length: number };
    attributes: Record<string, string[]>;
}

interface FilterSidebarProps {
    availableFilters: CatalogAvailableFilters;
    priceRange: [number, number];
    setPriceRange: (range: [number, number]) => void;
    selectedAttributes: Record<string, string[]>;
    setSelectedAttributes: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export function FilterSidebar({
    availableFilters,
    priceRange,
    setPriceRange,
    selectedAttributes,
    setSelectedAttributes
}: FilterSidebarProps) {
    const handleAttributeChange = (key: string, value: string, checked: boolean) => {
        setSelectedAttributes(prev => {
            const current = prev[key] || [];
            if (checked) {
                return { ...prev, [key]: [...current, value] };
            } else {
                return { ...prev, [key]: current.filter(v => v !== value) };
            }
        });
    };

    return (
        <div className="space-y-8">
            {/* Price Filter */}
            <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                    Narx oralig&apos;i
                    <span className="text-xs font-normal text-gray-500">RUB</span>
                </h3>
                <Slider
                    defaultValue={[availableFilters.price.min, availableFilters.price.max]}
                    value={priceRange}
                    min={availableFilters.price.min}
                    max={availableFilters.price.max}
                    step={1}
                    onValueChange={(val: number[]) => setPriceRange([val[0] ?? 0, val[1] ?? 0])}
                    className="mb-4"
                />
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {priceRange[0]}
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {priceRange[1]}
                    </div>
                </div>
            </div>

            {/* Dynamic Attributes */}
            {Object.entries(availableFilters.attributes).map(([key, values]) => (
                <div key={key}>
                    <h3 className="font-bold text-gray-900 mb-3 capitalize">{key.replace(/_/g, ' ')}</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                        {values.map((val: string) => (
                            <div key={val} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`${key}-${val}`}
                                    checked={selectedAttributes[key]?.includes(val) || false}
                                    onCheckedChange={(checked) => handleAttributeChange(key, val, checked as boolean)}
                                />
                                <label
                                    htmlFor={`${key}-${val}`}
                                    className="text-sm text-gray-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    {val}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
