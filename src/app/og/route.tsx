import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#102a45', color: 'white' }}>
        <div style={{ fontSize: 120, fontWeight: 900, display: 'flex' }}>
          PACK<span style={{ color: '#e33326' }}>24</span>
        </div>
        <div style={{ fontSize: 44, marginTop: 24, opacity: 0.9 }}>Qadoqlash mahsulotlari · Упаковка · Packaging</div>
        <div style={{ fontSize: 34, marginTop: 16, opacity: 0.7 }}>pack24.uz</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
