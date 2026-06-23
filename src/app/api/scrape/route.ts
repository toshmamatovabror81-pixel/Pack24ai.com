import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { aiLimiter, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;

    // Rate limiting: 10 so'rov/daqiqa
    const ip = getClientIp(request);
    const rl = aiLimiter.check(`scrape:${ip}`);
    if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL kiritilmagan' }, { status: 400 });
        }

        // SSRF himoyasi: faqat https://pack24.ru ruxsat etilgan
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json({ error: 'URL formati noto\'g\'ri' }, { status: 400 });
        }

        if (parsed.protocol !== 'https:' ||
            !(parsed.hostname === 'pack24.ru' || parsed.hostname.endsWith('.pack24.ru'))) {
            return NextResponse.json(
                { error: 'Faqat https://pack24.ru domeni ruxsat etilgan' },
                { status: 400 },
            );
        }

        const response = await fetch(parsed.href);
        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract Data
        const name = $('h1').first().text().trim();
        const priceText = $('.price_value').first().text().replace(/\D/g, ''); // Extract numbers
        const price = priceText ? parseInt(priceText) : 0;

        // Extract Breadcrumbs for Category Sync
        const breadcrumbs: string[] = [];
        $('.breadcrumbs span, .breadcrumb span, .path span').each((_, el) => {
            const text = $(el).text().trim();
            if (text) breadcrumbs.push(text);
        });

        // Extract Images (HD preference)
        const images: string[] = [];
        $('.product-images-slider a').each((_, el) => {
            const href = $(el).attr('href'); // Often links to the zoom/HD version
            if (href && (href.endsWith('.jpg') || href.endsWith('.png'))) {
                images.push(href.startsWith('http') ? href : `https://pack24.ru${href}`);
            }
        });

        // Fallback to img src if no links found
        if (images.length === 0) {
            $('.product-images-slider img').each((_, el) => {
                const src = $(el).attr('src');
                if (src) images.push(src.startsWith('http') ? src : `https://pack24.ru${src}`);
            });
        }

        const mainImage = images[0] || 'https://placehold.co/400x400?text=No+Image';

        // Deep Extract Specifications
        const specifications: Record<string, string> = {};
        $('.product-features tr, .features-table tr').each((_, el) => {
            const key = $(el).find('td').first().text().trim().replace(':', '');
            const value = $(el).find('td').last().text().trim();
            if (key && value) specifications[key] = value;
        });

        // Extract Description
        const description = $('.product-description, .desc-text').text().trim();

        return NextResponse.json({
            name,
            price, // Original RUB price
            image: mainImage,
            images,
            specifications,
            categoryPath: breadcrumbs, // Send full path for syncing
            description,
            url
        });

    } catch (error) {
        console.error('Scraping error:', error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json(
            { error: 'Saytdan ma\'lumot olishda xatolik yuz berdi' },
            { status: 502 },
        );
    }
}
