import { v4 as uuidv4 } from 'uuid';
import { uploadBufferToSupabase } from './supabase-storage';

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg':  '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
    'image/avif': '.avif',
};

/**
 * Downloads a file from an external URL and uploads it to Supabase.
 * Returns the public Supabase URL.
 * If the URL is already internal or invalid, it returns the original URL.
 */
export async function downloadAndUploadToSupabase(url: string | null | undefined): Promise<string> {
    if (!url || typeof url !== 'string') return url || '';

    // Tasodifan bo'sh bo'lsa yoki o'zimizniki (yoki nisbiy yo'l) bo'lsa teginmaymiz
    if (url.startsWith('/')) return url;
    if (url.includes('supabase.co') || url.includes('pack24.uz')) return url;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'uz-UZ,uz;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
                Referer: 'https://pack24.ru/',
            },
            // Timeout to prevent hanging
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.warn(`[media-utils] Rasm yuklab bo'lmadi URL: ${url}. Status: ${response.status}`);
            return url;
        }

        const contentType = response.headers.get('content-type') ?? '';
        
        let extension = '.jpg';
        if (contentType.startsWith('image/')) {
            extension = MIME_TO_EXT[contentType.split(';')[0].trim()] ?? '.jpg';
        }

        const filename = `${uuidv4()}${extension}`;
        const buffer = Buffer.from(await response.arrayBuffer());

        return await uploadBufferToSupabase(buffer, filename, contentType || 'image/jpeg');
    } catch (error) {
        console.error(`[media-utils] Xato yuz berdi (${url}):`, error);
        return url;
    }
}

/**
 * Processes an array of URLs concurrently. Any failed URLs will become '/placeholder.png'.
 * We filter them out so the gallery only has working images.
 */
export async function processGalleryUrls(urls: string[] | null | undefined): Promise<string[]> {
    if (!Array.isArray(urls)) return [];
    
    // Process concurrently
    const promises = urls.map(url => downloadAndUploadToSupabase(url));
    const results = await Promise.all(promises);
    
    // Remove placeholders from gallery so we don't have blank images in slider
    return results.filter(url => url !== '/placeholder.png');
}
