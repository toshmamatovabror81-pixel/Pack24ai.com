import { useState, useMemo, useEffect } from 'react';
import { Product } from '../store/useProductStore';
import { toNumber } from '@/lib/money';

export interface FilterState {
    priceRange: [number, number];
    dimensions: {
        width: [number, number]; // mm
        height: [number, number]; // mm
        length: [number, number]; // mm
    };
    attributes: Record<string, string[]>; // e.g., Color: ['Red', 'Blue']
    searchQuery: string;
}

export function useProductFilter(products: Product[]) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [dimensionRange, setDimensionRange] = useState<{
        width: [number, number];
        height: [number, number];
        length: [number, number];
    }>({
        width: [0, 1000],
        height: [0, 1000],
        length: [0, 1000]
    });

    // 1. Calculate available filters dynamically from products
    const availableFilters = useMemo(() => {
        const attrs: Record<string, Set<string>> = {};
        let minPrice = Infinity;
        let maxPrice = 0;
        let maxWidth = 0;
        let maxHeight = 0;
        let maxLength = 0;

        products.forEach(p => {
            const price = toNumber(p.price);
            // Price Stats
            if (price < minPrice) minPrice = price;
            if (price > maxPrice) maxPrice = price;

            // Dimension Stats
            if (p.dimensions) {
                if (p.dimensions.width > maxWidth) maxWidth = p.dimensions.width;
                if (p.dimensions.height > maxHeight) maxHeight = p.dimensions.height;
                if (p.dimensions.length && p.dimensions.length > maxLength) maxLength = p.dimensions.length;
            }

            // Attribute Stats (Deep Scraping Data)
            if (p.specifications) {
                Object.entries(p.specifications).forEach(([key, value]) => {
                    if (!attrs[key]) attrs[key] = new Set();
                    attrs[key].add(value);
                });
            }
        });

        return {
            price: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
            dimensions: { width: maxWidth, height: maxHeight, length: maxLength },
            attributes: Object.entries(attrs).reduce((acc, [key, update]) => {
                acc[key] = Array.from(update);
                return acc;
            }, {} as Record<string, string[]>)
        };
    }, [products]);

    // Initialize ranges once available filters are calculated the first time
    useEffect(() => {
        if (availableFilters.price.max > 0) {
            setPriceRange([availableFilters.price.min, availableFilters.price.max]);
        }
    }, [availableFilters.price.min, availableFilters.price.max]);

    // 2. Filter Logic
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Search (Fuzzy-ish: simple includes for now + keyword match)
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const text = `${p.name} ${p.description || ''} ${p.sku || ''}`.toLowerCase();
                if (!text.includes(q)) return false;
            }

            // Price Range
            const price = toNumber(p.price);
            if (price < priceRange[0] || price > priceRange[1]) return false;

            // Dimensions Range (Only if product has dimensions)
            // If product doesn't have dimensions, should we show it? Maybe?
            // User requested dimension filter.
            if (p.dimensions) {
                // Width
                if (p.dimensions.width < dimensionRange.width[0] || p.dimensions.width > dimensionRange.width[1]) return false;
                // Height
                if (p.dimensions.height < dimensionRange.height[0] || p.dimensions.height > dimensionRange.height[1]) return false;
                // Length (if exists and filter is active? For now assuming if filter is active we check)
                if (p.dimensions.length && (p.dimensions.length < dimensionRange.length[0] || p.dimensions.length > dimensionRange.length[1])) return false;
            }

            // Attributes
            for (const [key, selectedValues] of Object.entries(selectedAttributes)) {
                if (selectedValues.length === 0) continue;
                // If product doesn't have this spec, exclude it? Or include?
                // Usually exclude if filter is applied.
                if (!p.specifications || !p.specifications[key] || !selectedValues.includes(p.specifications[key])) {
                    return false;
                }
            }

            return true;
        });
    }, [products, searchQuery, priceRange, dimensionRange, selectedAttributes]);

    return {
        searchQuery, setSearchQuery,
        priceRange, setPriceRange,
        dimensionRange, setDimensionRange,
        selectedAttributes, setSelectedAttributes,
        filteredProducts,
        availableFilters
    };
}
