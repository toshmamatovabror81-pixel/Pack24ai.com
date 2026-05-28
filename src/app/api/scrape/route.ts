import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { roundUZS, toNumber } from '@/lib/money';

export async function POST(request: NextRequest) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;

    try {
        const { url } = await request.json();

        if (!url || !url.includes('pack24.ru')) {
            return NextResponse.json({ error: 'Invalid URL. Only pack24.ru is supported.' }, { status: 400 });
        }

        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract Data
        const name = $('h1').first().text().trim();
        const priceText = $('.price_value').first().text().replace(/\D/g, ''); // Extract numbers
        const price = toNumber(roundUZS(priceText ? parseInt(priceText, 10) : 0));

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

        const mainImage = images[0] || '/images/no-image.svg';

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
        console.error('Scraping error:', error);
        // Fallback for development/demo if blocking occurs
        return NextResponse.json({
            name: 'Imported Product (Fallback)',
            price: 100,
            description: 'Could not scrape live site. Check console.',
            image: '/images/no-image.svg',
            specifications: {}
        });
    }
}
