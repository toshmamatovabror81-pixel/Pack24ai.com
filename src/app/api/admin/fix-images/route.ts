import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadAndUploadToSupabase, processGalleryUrls } from '@/lib/media-utils';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    try {
        const products = await prisma.product.findMany();
        let fixedCount = 0;

        for (const product of products) {
            let changed = false;
            
            let newImage = product.image;
            let newVideoUrl = product.videoUrl;
            let newGallery = Array.isArray(product.gallery) ? [...product.gallery] as string[] : [];

            // 1. Asosiy rasm
            if (product.image && product.image.startsWith('http') && !product.image.includes('supabase.co')) {
                newImage = await downloadAndUploadToSupabase(product.image);
                if (newImage !== product.image) changed = true;
            }

            // 2. Video
            if (product.videoUrl && product.videoUrl.startsWith('http') && !product.videoUrl.includes('supabase.co')) {
                newVideoUrl = await downloadAndUploadToSupabase(product.videoUrl);
                if (newVideoUrl !== product.videoUrl) changed = true;
            }

            // 3. Galereya
            if (newGallery.length > 0) {
                const updatedGallery = await processGalleryUrls(newGallery);
                if (JSON.stringify(updatedGallery) !== JSON.stringify(newGallery)) {
                    newGallery = updatedGallery;
                    changed = true;
                }
            }

            if (changed) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: {
                        image: newImage,
                        videoUrl: newVideoUrl,
                        gallery: newGallery
                    }
                });
                fixedCount++;
            }
        }

        return NextResponse.json({ success: true, message: `${fixedCount} ta mahsulot rasmlari tuzatildi.` });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[fix-images Error]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
