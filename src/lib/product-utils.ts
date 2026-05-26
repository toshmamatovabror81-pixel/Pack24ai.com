/**
 * Product JSON maydonlari uchun type-safe utility funksiyalar.
 *
 * PostgreSQL Json tipidan foydalanilgandan so'ng, Prisma o'zi
 * serialize/deserialize qiladi — JSON.parse/stringify kerak emas.
 */
import { serializeMoney } from '@/lib/money';

export interface ProductSpecification {
    key: string;
    value: string;
}

// ─── Type-safe getters ────────────────────────────────────────────────────────

/** gallery (Json) → string[] */
export function parseGallery(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as string[];
    return [];
}

/** specifications (Json) → Record<string, string> | ProductSpecification[] */
export function parseSpecifications(raw: unknown): ProductSpecification[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as ProductSpecification[];
    if (typeof raw === 'object') {
        return Object.entries(raw as Record<string, string>).map(([key, value]) => ({
            key,
            value: String(value),
        }));
    }
    return [];
}

/** tags (Json) → string[] */
export function parseTags(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as string[];
    return [];
}

// ─── Product parse helper ────────────────────────────────────────────────────

/**
 * Prisma dan kelgan Product ni type-safe qiladi.
 * gallery, specifications, tags endi Prisma tomonidan
 * avtomatik parse qilinadi — faqat type assertion kerak.
 * Money maydonlari (price, originalPrice) number ga aylantiriladi.
 */
export function parseProduct<T extends Record<string, unknown>>(raw: T) {
    const withJson = {
        ...raw,
        gallery:        parseGallery(raw.gallery),
        specifications: parseSpecifications(raw.specifications),
        tags:           parseTags(raw.tags),
    };
    return serializeMoney(withJson) as Omit<T, 'gallery' | 'specifications' | 'tags'> & {
        gallery: string[];
        specifications: ProductSpecification[];
        tags: string[];
    };
}
