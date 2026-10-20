import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, pageMetadata } from '../seo';

// Sayt manzili .env dan (APP_URL) olinadi — testda qat'iy
beforeEach(() => vi.stubEnv('APP_URL', 'https://pack24.uz/'));
afterEach(() => vi.unstubAllEnvs());

describe('seo', () => {
  it('absoluteUrl: admin yuklagan nisbiy rasm (/uploads/...) sxema uchun to\'liq manzilga aylanadi, to\'liq URL o\'zgarmaydi', () => {
    expect(absoluteUrl('/uploads/products/a.webp')).toBe('https://pack24.uz/uploads/products/a.webp');
    expect(absoluteUrl('images/x.png')).toBe('https://pack24.uz/images/x.png');
    expect(absoluteUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(absoluteUrl('http://cdn.example.com/a.jpg')).toBe('http://cdn.example.com/a.jpg');
  });

  it('pageMetadata: bosh sahifa sarlavhasi layout qolipiga ("| Pack24") qo\'yilmaydi — brend ikki marta chiqmasin', () => {
    const home = pageMetadata({ locale: 'uz', path: '/', title: 'Pack24: Qadoqlash mahsulotlari', description: 'd', absoluteTitle: true });
    expect(home.title).toEqual({ absolute: 'Pack24: Qadoqlash mahsulotlari' });
    expect(home.openGraph?.title).toBe('Pack24: Qadoqlash mahsulotlari');
    expect(home.alternates?.canonical).toBe('https://pack24.uz/uz');
    // Boshqa sahifalar: oddiy matn, qolip qo'shiladi
    const page = pageMetadata({ locale: 'ru', path: '/catalog', title: 'Katalog', description: 'd' });
    expect(page.title).toBe('Katalog');
    expect(page.alternates?.canonical).toBe('https://pack24.uz/ru/catalog');
  });

  it('pageMetadata: OG rasm — yuklangan rasm to\'liq manzil, aks holda brend banneri', () => {
    expect((pageMetadata({ locale: 'uz', path: '/p', title: 't', description: 'd', image: '/uploads/p/a.webp' }).openGraph as { images: { url: string }[] }).images[0].url).toBe('https://pack24.uz/uploads/p/a.webp');
    expect((pageMetadata({ locale: 'uz', path: '/p', title: 't', description: 'd', image: '/images/no-image.svg' }).openGraph as { images: { url: string }[] }).images[0].url).toBe('https://pack24.uz/og');
  });
});
