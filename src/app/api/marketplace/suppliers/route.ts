import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PriceRange {
    min: number;
    max: number;
    currency: string;
}

interface Supplier {
    id: number;
    name: string;
    location: string;
    materials: string[];
    rating: number;
    reviewCount: number;
    minOrderKg: number;
    priceRange: PriceRange;
    delivery: boolean;
    certified: boolean;
    ecoFriendly: boolean;
    responseTime: string;
    image: string | null;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SUPPLIERS: Supplier[] = [
    {
        id: 1,
        name: "O'zPack Materials",
        location: "Toshkent",
        materials: ["Gofra karton", "Kraft qog'oz", "Linerboard"],
        rating: 4.8,
        reviewCount: 156,
        minOrderKg: 500,
        priceRange: { min: 3500, max: 8000, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: true,
        responseTime: "2 soat",
        image: null,
    },
    {
        id: 2,
        name: "SamarPak",
        location: "Samarqand",
        materials: ["Gofra karton", "Plastik plyonka"],
        rating: 4.6,
        reviewCount: 89,
        minOrderKg: 300,
        priceRange: { min: 2800, max: 6500, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: false,
        responseTime: "3 soat",
        image: null,
    },
    {
        id: 3,
        name: "EcoBox Uzbekistan",
        location: "Toshkent",
        materials: ["Kraft qog'oz", "Qayta ishlangan karton", "Bioplyonka"],
        rating: 4.9,
        reviewCount: 234,
        minOrderKg: 200,
        priceRange: { min: 4200, max: 9500, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: true,
        responseTime: "1 soat",
        image: null,
    },
    {
        id: 4,
        name: "BuxoroPack",
        location: "Buxoro",
        materials: ["Gofra karton", "Linerboard", "Karton quti"],
        rating: 4.3,
        reviewCount: 67,
        minOrderKg: 1000,
        priceRange: { min: 2500, max: 5500, currency: "UZS" },
        delivery: false,
        certified: false,
        ecoFriendly: false,
        responseTime: "6 soat",
        image: null,
    },
    {
        id: 5,
        name: "Navoiy Karton",
        location: "Navoiy",
        materials: ["Gofra karton", "Kraft qog'oz"],
        rating: 4.5,
        reviewCount: 112,
        minOrderKg: 500,
        priceRange: { min: 3000, max: 7000, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: false,
        responseTime: "4 soat",
        image: null,
    },
    {
        id: 6,
        name: "FerghanaPack Pro",
        location: "Farg'ona",
        materials: ["Plastik plyonka", "Stretch plyonka", "Pufakchali plyonka"],
        rating: 4.4,
        reviewCount: 98,
        minOrderKg: 100,
        priceRange: { min: 4000, max: 11000, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: false,
        responseTime: "3 soat",
        image: null,
    },
    {
        id: 7,
        name: "GreenWrap UZ",
        location: "Toshkent",
        materials: ["Bioplyonka", "Qayta ishlangan karton", "Kraft qog'oz"],
        rating: 4.7,
        reviewCount: 178,
        minOrderKg: 150,
        priceRange: { min: 5000, max: 12000, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: true,
        responseTime: "2 soat",
        image: null,
    },
    {
        id: 8,
        name: "Andijon Qadoq",
        location: "Andijon",
        materials: ["Gofra karton", "Karton quti", "Linerboard"],
        rating: 4.2,
        reviewCount: 45,
        minOrderKg: 800,
        priceRange: { min: 2200, max: 5000, currency: "UZS" },
        delivery: false,
        certified: false,
        ecoFriendly: false,
        responseTime: "8 soat",
        image: null,
    },
    {
        id: 9,
        name: "ToshPak Premium",
        location: "Toshkent",
        materials: ["Kraft qog'oz", "Linerboard", "Plastik plyonka", "Gofra karton"],
        rating: 4.9,
        reviewCount: 312,
        minOrderKg: 250,
        priceRange: { min: 4500, max: 10000, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: true,
        responseTime: "1 soat",
        image: null,
    },
    {
        id: 10,
        name: "QashqaPack",
        location: "Qashqadaryo",
        materials: ["Gofra karton", "Karton quti"],
        rating: 4.1,
        reviewCount: 34,
        minOrderKg: 1500,
        priceRange: { min: 2000, max: 4500, currency: "UZS" },
        delivery: false,
        certified: false,
        ecoFriendly: false,
        responseTime: "12 soat",
        image: null,
    },
    {
        id: 11,
        name: "Xorazm Packaging",
        location: "Xorazm",
        materials: ["Kraft qog'oz", "Gofra karton", "Stretch plyonka"],
        rating: 4.4,
        reviewCount: 76,
        minOrderKg: 400,
        priceRange: { min: 3200, max: 7500, currency: "UZS" },
        delivery: true,
        certified: true,
        ecoFriendly: false,
        responseTime: "5 soat",
        image: null,
    },
    {
        id: 12,
        name: "NamPack Solutions",
        location: "Namangan",
        materials: ["Plastik plyonka", "Pufakchali plyonka", "Karton quti"],
        rating: 4.3,
        reviewCount: 58,
        minOrderKg: 200,
        priceRange: { min: 3800, max: 9000, currency: "UZS" },
        delivery: true,
        certified: false,
        ecoFriendly: false,
        responseTime: "4 soat",
        image: null,
    },
];

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const material = searchParams.get('material');
        const location = searchParams.get('location');
        const sort = searchParams.get('sort');

        let filtered = [...SUPPLIERS];

        // Filter by material
        if (material) {
            const materialLower = material.toLowerCase();
            filtered = filtered.filter((s) =>
                s.materials.some((m) => m.toLowerCase().includes(materialLower))
            );
        }

        // Filter by location
        if (location) {
            const locationLower = location.toLowerCase();
            filtered = filtered.filter(
                (s) => s.location.toLowerCase() === locationLower
            );
        }

        // Sort
        if (sort === 'rating') {
            filtered.sort((a, b) => b.rating - a.rating);
        } else if (sort === 'price') {
            filtered.sort((a, b) => a.priceRange.min - b.priceRange.min);
        }

        // Calculate stats
        const totalSuppliers = SUPPLIERS.length;
        const averageRating =
            Math.round(
                (SUPPLIERS.reduce((sum, s) => sum + s.rating, 0) / totalSuppliers) * 10
            ) / 10;
        const totalMaterials = new Set(SUPPLIERS.flatMap((s) => s.materials)).size;

        return NextResponse.json(
            {
                suppliers: filtered,
                stats: { totalSuppliers, averageRating, totalMaterials },
            },
            {
                headers: {
                    'Cache-Control':
                        'public, s-maxage=300, stale-while-revalidate=600',
                },
            }
        );
    } catch {
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        );
    }
}
