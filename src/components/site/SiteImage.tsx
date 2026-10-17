import Image, { type ImageProps } from 'next/image';

// next.config.ts dagi images.remotePatterns bilan bir xil bo'lishi kerak
const OPTIMIZED_HOSTS = new Set(['pack24.uz', 'www.pack24.uz']);

function optimizable(src: string): boolean {
  if (src.startsWith('/')) return true;
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * next/image, lekin admin kiritgan begona hostdagi rasm optimizatsiyasiz (<img>) ko'rsatiladi:
 * aks holda /_next/image ruxsat etilmagan host uchun 400 qaytarib, rasm sinib qoladi.
 */
export function SiteImage({ unoptimized, alt, ...props }: ImageProps & { src: string }) {
  return <Image {...props} alt={alt} unoptimized={unoptimized ?? !optimizable(props.src)} />;
}
