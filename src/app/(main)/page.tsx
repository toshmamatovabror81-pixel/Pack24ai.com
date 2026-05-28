import { unstable_cache } from 'next/cache';
import dynamic from 'next/dynamic';
import HomeHero from '@/components/home/HomeHero';
import SectionSkeleton from '@/components/home/SectionSkeleton';
import { OrganizationLd, WebSiteLd } from '@/components/seo/JsonLd';
import { prisma } from '@/lib/prisma';
import type { Product } from '@/lib/store/useProductStore';
import { toNumber } from '@/lib/money';

const PackagingShowcase = dynamic(
    () => import('@/components/home/PackagingShowcase'),
    { loading: () => <SectionSkeleton height={600} /> },
);

// Server Component: mahsulotlar SSR — 60s cache (Neon tarmoq kechikishini kamaytiradi)
const getInitialProducts = unstable_cache(
    async (): Promise<Product[]> => {
        try {
            const rows = await prisma.product.findMany({
                where: { status: 'active' },
                orderBy: { createdAt: 'desc' },
                take: 24,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    originalPrice: true,
                    sku: true,
                    category: true,
                    image: true,
                    gallery: true,
                    videoUrl: true,
                    tags: true,
                    minQuantity: true,
                    inStock: true,
                    rating: true,
                    reviews: true,
                    status: true,
                    isFeatured: true,
                    sourceUrl: true,
                },
            });
            return rows.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description ?? undefined,
                price: toNumber(p.price),
                originalPrice: p.originalPrice != null ? toNumber(p.originalPrice) : undefined,
                sku: p.sku ?? undefined,
                category: p.category ?? undefined,
                image: p.image,
                gallery: Array.isArray(p.gallery) ? (p.gallery as string[]) : [],
                videoUrl: p.videoUrl ?? undefined,
                tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
                minQuantity: p.minQuantity,
                inStock: p.inStock,
                rating: p.rating,
                reviews: p.reviews,
                status: p.status as 'active' | 'draft' | 'archived',
                isFeatured: p.isFeatured,
                sourceUrl: p.sourceUrl ?? undefined,
            }));
        } catch {
            return [];
        }
    },
    ['home-active-products'],
    { revalidate: 60 }
);

export default async function Home() {
    const initialProducts = await getInitialProducts();

    return (
        <div className="min-h-screen bg-surface-page">
            {/* SEO: JSON-LD Structured Data */}
            <OrganizationLd />
            <WebSiteLd />

            {/* Banner + Mashhur mahsulotlar */}
            <HomeHero initialProducts={initialProducts} />

            {/* Pacdora AI hamkorlik showcase */}
            <PackagingShowcase />
        </div>
    );
}