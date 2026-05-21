import { unstable_cache } from 'next/cache';
import HomeHero from '@/components/home/HomeHero';
import MobileCategoryStrip from '@/components/home/MobileCategoryStrip';
import ConfiguratorSection from '@/components/home/ConfiguratorSection';
import AISection from '@/components/home/AISection';
import ReviewsSection from '@/components/home/ReviewsSection';
import CTABanner from '@/components/home/CTABanner';
import { OrganizationLd, WebSiteLd } from '@/components/seo/JsonLd';
import { prisma } from '@/lib/prisma';
import type { Product } from '@/lib/store/useProductStore';

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
                price: p.price,
                originalPrice: p.originalPrice ?? undefined,
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
        <div className="min-h-screen bg-[#f5f6fa]">
            {/* SEO: JSON-LD Structured Data */}
            <OrganizationLd />
            <WebSiteLd />

            {/* Slider + Category Showcase
                initialProducts → Zustand store ni birinchi render da seed qiladi
                shuning uchun kategoriya kartalari darhol ko'rinadi */}
            <HomeHero initialProducts={initialProducts} />

            {/* Mobil kategoriyalar */}
            <MobileCategoryStrip />

            {/* 3D konfigurator + B2B + Stats + Features (barchasi birlashtirildi) */}
            <ConfiguratorSection />

            {/* Pack24 AI Section */}
            <AISection />

            {/* Sharhlar */}
            <ReviewsSection />

            {/* CTA */}
            <CTABanner />
        </div>
    );
}