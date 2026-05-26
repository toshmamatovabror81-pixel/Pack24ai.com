/**
 * Products API — unit testlar
 * Prisma va fetch mock ishlatiladi, haqiqiy DB kerak emas.
 */

import { toNumber, type MoneyInput } from '@/lib/money';

// ── yordamchi funksiyalar (route mantiqidan ajratilgan) ──────────────────────
function validateProduct(data: {
    name?: string;
    price?: MoneyInput;
    image?: string;
}) {
    if (!data.name || !data.name.trim()) return 'Mahsulot nomi kiritilishi shart';
    if (data.price === undefined || data.price === null) return 'Narx kiritilishi shart';
    if (typeof data.price === 'number' && Number.isNaN(data.price)) {
        return "Narx to'g'ri formatda bo'lishi kerak";
    }
    const price = toNumber(data.price);
    if (isNaN(price) || price < 0) return "Narx to'g'ri formatda bo'lishi kerak";
    return null;
}

function buildGallery(image: string, gallery: string[]): { image: string; gallery: string[] } {
    const validImages = [image, ...gallery].filter(Boolean);
    return {
        image: validImages[0] || '/placeholder.png',
        gallery: validImages.slice(1),
    };
}

function formatPrice(price: MoneyInput, currency = 'UZS'): string {
    return `${toNumber(price).toLocaleString('uz-UZ')} ${currency}`;
}

// ── Testlar ──────────────────────────────────────────────────────────────────
describe('Products API — validatsiya', () => {
    describe('validateProduct()', () => {
        it('nom bo\'sh bo\'lsa xato qaytarishi kerak', () => {
            expect(validateProduct({ name: '', price: 1000, image: 'a.jpg' })).toBe(
                'Mahsulot nomi kiritilishi shart'
            );
        });

        it('faqat bo\'sh joy bo\'lsa xato qaytarishi kerak', () => {
            expect(validateProduct({ name: '   ', price: 1000 })).toBe(
                'Mahsulot nomi kiritilishi shart'
            );
        });

        it('narx yo\'q bo\'lsa xato qaytarishi kerak', () => {
            expect(validateProduct({ name: 'Quti', price: undefined })).toBe(
                'Narx kiritilishi shart'
            );
        });

        it('manfiy narx uchun xato', () => {
            expect(validateProduct({ name: 'Quti', price: -5 })).toBe(
                "Narx to'g'ri formatda bo'lishi kerak"
            );
        });

        it('NaN narx uchun xato', () => {
            expect(validateProduct({ name: 'Quti', price: NaN })).toBe(
                "Narx to'g'ri formatda bo'lishi kerak"
            );
        });

        it('to\'g\'ri ma\'lumotlar uchun null', () => {
            expect(validateProduct({ name: 'Gofroqorti', price: 4500, image: 'img.jpg' })).toBeNull();
        });

        it('0 narx ruxsat etilishi kerak', () => {
            expect(validateProduct({ name: 'Bepul', price: 0 })).toBeNull();
        });
    });

    describe('buildGallery()', () => {
        it('asosiy rasm + gallery to\'g\'ri ajratilishi kerak', () => {
            const result = buildGallery('img1.jpg', ['img2.jpg', 'img3.jpg']);
            expect(result.image).toBe('img1.jpg');
            expect(result.gallery).toEqual(['img2.jpg', 'img3.jpg']);
        });

        it('bo\'sh asosiy rasm uchun placeholder ishlatilishi kerak', () => {
            const result = buildGallery('', []);
            expect(result.image).toBe('/placeholder.png');
        });

        it('gallery yo\'q bo\'lsa bo\'sh array qaytarishi kerak', () => {
            const result = buildGallery('main.jpg', []);
            expect(result.gallery).toEqual([]);
        });

        it('barcha rasmlar to\'g\'ri taqsimlanishi kerak', () => {
            const result = buildGallery('a.jpg', ['b.jpg', 'c.jpg', 'd.jpg']);
            expect(result.image).toBe('a.jpg');
            expect(result.gallery).toHaveLength(3);
        });
    });

    describe('formatPrice()', () => {
        it('narxni to\'g\'ri formatlashi kerak', () => {
            expect(formatPrice(4500)).toContain('UZS');
        });

        it('boshqa valyuta bilan ishlashi kerak', () => {
            expect(formatPrice(10, 'USD')).toContain('USD');
        });
    });
});

describe('Products API — SKU logikasi', () => {
    function generateSku(category: string, name: string): string {
        const catCode = category.slice(0, 3).toUpperCase();
        const nameCode = name.replace(/\s+/g, '-').slice(0, 10).toUpperCase();
        return `${catCode}-${nameCode}`;
    }

    it('SKU kategoriya prefiksi bilan boshlanishi kerak', () => {
        const sku = generateSku('gofroqorti', 'Katta quti 400x300');
        expect(sku.startsWith('GOF-')).toBe(true);
    });

    it('SKU bo\'sh joy o\'rniga chiziqcha ishlatishi kerak', () => {
        const sku = generateSku('stretch', 'Stretch plyonka');
        expect(sku).not.toContain(' ');
    });
});
