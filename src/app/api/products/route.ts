import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { ProductStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { parseProduct } from '@/lib/product-utils';
import { downloadAndUploadToSupabase, processGalleryUrls } from '@/lib/media-utils';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { toDecimal } from '@/lib/money';



export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const status   = searchParams.get('status');
        const search   = searchParams.get('search');
        const featured = searchParams.get('featured');
        const onSale   = searchParams.get('onSale');
        const limitRaw = searchParams.get('limit');
        const sort     = searchParams.get('sort');

        const where: Prisma.ProductWhereInput = {};

        if (category && category !== 'all') where.category = category;
        if (status   && status   !== 'all') where.status   = status as ProductStatus;
        if (search)                          where.name     = { contains: search, mode: 'insensitive' };
        if (featured === '1') where.isFeatured = true;
        if (onSale === '1') where.originalPrice = { not: null };

        const limit = limitRaw
            ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 100))
            : 100;

        let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
        if (sort === 'price-asc') orderBy = { price: 'asc' };
        else if (sort === 'price-desc') orderBy = { price: 'desc' };

        const products = await prisma.product.findMany({
            where,
            orderBy,
            take: limit,
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
                specifications: true,
                tags: true,
                minQuantity: true,
                inStock: true,
                rating: true,
                reviews: true,
                status: true,
                isFeatured: true,
                sourceUrl: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(products.map(parseProduct), {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        logger.error({ error }, 'GET /api/products');
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const body = await request.json();

        // Validatsiya
        if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
            return NextResponse.json({ error: 'Mahsulot nomi majburiy' }, { status: 400 });
        }
        const price = parseFloat(body.price);
        if (isNaN(price) || price < 0) {
            return NextResponse.json({ error: "Narx noto'g'ri" }, { status: 400 });
        }

        const validStatuses: ProductStatus[] = [ProductStatus.active, ProductStatus.draft, ProductStatus.archived];
        const status = body.status && validStatuses.includes(body.status as ProductStatus)
            ? (body.status as ProductStatus)
            : ProductStatus.draft;

        const newProduct = await prisma.product.create({
            data: {
                name:           body.name.trim(),
                description:    body.description   || '',
                price: toDecimal(price),
                originalPrice:  body.originalPrice ? toDecimal(parseFloat(body.originalPrice)) : null,
                sku:            body.sku            || null,
                category:       body.category       || null,
                image:          await downloadAndUploadToSupabase(body.image || '/placeholder.png'),
                gallery:        Array.isArray(body.gallery) ? await processGalleryUrls(body.gallery) : [],
                videoUrl:       await downloadAndUploadToSupabase(body.videoUrl || null),
                specifications: body.specifications ?? {},
                tags:           Array.isArray(body.tags) ? body.tags : [],
                minQuantity:    body.minQuantity    ? (parseInt(body.minQuantity) || 1) : 1,
                status:         status,
                inStock:        body.inStock        !== false,
            },
        });

        return NextResponse.json(parseProduct(newProduct), { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'POST /api/products');
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
