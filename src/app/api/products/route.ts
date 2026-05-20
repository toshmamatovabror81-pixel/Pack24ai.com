import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProductStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { parseProduct } from '@/lib/product-utils';
import { downloadAndUploadToSupabase, processGalleryUrls } from '@/lib/media-utils';



export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const status   = searchParams.get('status');
        const search   = searchParams.get('search');

        const where: Prisma.ProductWhereInput = {};

        if (category && category !== 'all') where.category = category;
        if (status   && status   !== 'all') where.status   = status as any;
        if (search)                          where.name     = { contains: search, mode: 'insensitive' };

        const products = await prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        // Type-safe JSON parse (gallery, specifications, tags — Prisma Json tipidan)
        return NextResponse.json(products.map(parseProduct));
    } catch (error) {
        console.error('[GET /api/products]', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}

export async function POST(request: Request) {
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

        const newProduct = await prisma.product.create({
            data: {
                name:           body.name.trim(),
                description:    body.description   || '',
                price,
                originalPrice:  body.originalPrice ? parseFloat(body.originalPrice) : null,
                sku:            body.sku            || null,
                category:       body.category       || null,
                image:          await downloadAndUploadToSupabase(body.image || '/placeholder.png'),
                gallery:        Array.isArray(body.gallery) ? await processGalleryUrls(body.gallery) : [],
                videoUrl:       await downloadAndUploadToSupabase(body.videoUrl || null),
                specifications: body.specifications ?? {},
                tags:           Array.isArray(body.tags) ? body.tags : [],
                minQuantity:    body.minQuantity    ? parseInt(body.minQuantity) : 1,
                status:         (body.status as ProductStatus) || ProductStatus.draft,
                inStock:        body.inStock        !== false,
            },
        });

        return NextResponse.json(parseProduct(newProduct), { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[POST /api/products]', msg);
        return NextResponse.json({ error: 'Server xatosi: ' + msg }, { status: 500 });
    }
}
