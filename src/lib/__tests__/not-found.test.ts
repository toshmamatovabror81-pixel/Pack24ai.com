import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/** 404 sahifasi tilni manzildan oladi: rus yoki ingliz saytidagi yo'q sahifa o'z tilida chiqadi va /uz ga qaytarib yubormaydi */
(globalThis as { React?: unknown }).React = React;
const s = vi.hoisted(() => ({ pathname: '/uz/x' }));
vi.mock('server-only', () => ({}));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: React.ReactNode }) => React.createElement('a', { href }, children) }));
vi.mock('next/navigation', () => ({ usePathname: () => s.pathname }));

const { default: NotFound } = await import('@/app/[lang]/not-found');
const render = () => renderToStaticMarkup(NotFound());

describe('404 sahifasi', () => {
  it('rus manzilida ruscha matn va /ru havolalari', () => {
    s.pathname = '/ru/product/123-karton-quti';
    const html = render();
    expect(html).toContain('href="/ru"');
    expect(html).toContain('href="/ru/catalog"');
    expect(html).toContain('Страница не найдена');
    expect(html).not.toContain('Sahifa topilmadi');
  });

  it('ingliz manzilida inglizcha; tilsiz yoki noma\'lum manzilda o\'zbekcha', () => {
    s.pathname = '/en/blog/nope';
    expect(render()).toContain('href="/en/catalog"');
    s.pathname = '/xx/yy';
    const uz = render();
    expect(uz).toContain('href="/uz"');
    expect(uz).toContain('Sahifa topilmadi');
    s.pathname = '';
    expect(render()).toContain('href="/uz/catalog"');
  });
});
