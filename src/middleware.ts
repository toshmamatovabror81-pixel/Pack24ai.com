import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from './lib/i18n/config';
import { SESSION_COOKIE, STAFF_ROLES, verifySession } from './lib/auth/session';
import { DRIVER_COOKIE, verifyDriverSession } from './lib/auth/driverSession';
import { UTM_COOKIE, UTM_KEYS } from './lib/utm';

/** Eski saytdagi manzillar -> yangi manzillar (Google'dagi havolalar buzilmasin) */
const LEGACY: Record<string, string> = {
  '/category': '/catalog',
  '/active-vacancies': '/vacancies',
  '/special-offers': '/catalog',
  '/discounts': '/catalog',
  '/mockup-request': '/wholesale',
  '/configurator': '/wholesale',
  '/corporate': '/wholesale',
  '/pricing': '/wholesale',
  '/news': '/blog',
  '/my-orders': '/profile',
  '/eco-dashboard': '/recycling',
  '/prts': '/recycling',
  '/referral': '/',
  '/carbon-market': '/',
  '/marketplace': '/catalog',
  '/tools': '/wholesale',
  '/terminal': '/',
  '/wishlist': '/catalog',
  '/mobile': '/',
};

function legacyTarget(pathname: string): string {
  for (const [from, to] of Object.entries(LEGACY)) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      // /category/slug -> /catalog/slug; boshqalari faqat bo'lim sahifasiga
      if (from === '/category') return `/catalog${pathname.slice(from.length)}`;
      return to;
    }
  }
  return pathname;
}

async function adminGuard(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!session || !STAFF_ROLES.includes(session.role)) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/** Haydovchi kabineti: login va parol tiklash sahifalaridan tashqari hammasi sessiya talab qiladi */
async function driverGuard(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/driver/login' || pathname === '/driver/forgot') return NextResponse.next();
  const session = await verifyDriverSession(req.cookies.get(DRIVER_COOKIE)?.value).catch(() => null);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/driver/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

function withAttribution(req: NextRequest, res: NextResponse) {
  const params = req.nextUrl.searchParams;
  if (!UTM_KEYS.some((k) => params.get(k))) return res;
  const data: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) data[k] = v.slice(0, 200);
  }
  const ref = req.headers.get('referer');
  if (ref) data.referrer = ref.slice(0, 500);
  data.landing = `${req.nextUrl.pathname}${req.nextUrl.search}`.slice(0, 500);
  res.cookies.set(UTM_COOKIE, JSON.stringify(data), { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminGuard(req);
  if (pathname === '/driver' || pathname.startsWith('/driver/')) return driverGuard(req);

  const first = pathname.split('/')[1];
  if (isLocale(first)) return withAttribution(req, NextResponse.next());

  // Tilsiz manzil: til prefiksini qo'shib yo'naltirish
  const url = req.nextUrl.clone();
  const target = legacyTarget(pathname);
  url.pathname = `/${defaultLocale}${target === '/' ? '' : target}`;
  return withAttribution(req, NextResponse.redirect(url, 308));
}

export const config = {
  matcher: [
    // API, Next ichki fayllari, statik fayllar va SEO fayllaridan tashqari hammasi
    '/((?!api|_next|images|uploads|og|favicon.ico|icon|robots.txt|sitemap.xml|feed.xml|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|js|css)$).*)',
  ],
};
