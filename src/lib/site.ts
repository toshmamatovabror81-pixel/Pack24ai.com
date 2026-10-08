export function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://pack24.uz';
  return url.replace(/\/+$/, '');
}
