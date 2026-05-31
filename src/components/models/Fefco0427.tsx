import React from 'react';
import { BoxModel, BoxModelProps, BoxDimensions } from '../../lib/types';
import { useCardboardMaterial } from '../../lib/hooks/useCardboardMaterial';

// ------------------------------------------------------------------
// GEOMETRY & CALCULATIONS
// ------------------------------------------------------------------
const getDielineSpecs = (dims: BoxDimensions) => {
    const { l, w, h } = dims;
    const t = 3; // Material texnik qalinligi (mm) - hisob uchun

    // Aniqroq o'lchamlar (FEFCO 0427 standarti bo'yicha)
    return {
        l, w, h,
        // Yoyilma o'lchamlari
        totalWidth: (h * 4) + l + (t * 4), // Yon devorlar va ularning buklanishi
        totalHeight: (w * 2) + (h * 3) + 20, // Qopqoq, Orqa, Asos, Old, Qulf
        // Ofsetlar (chizishni boshlash nuqtasi)
        offset: { x: 50, y: 50 }
    };
};

// ------------------------------------------------------------------
// 3D MODEL COMPONENT
// ------------------------------------------------------------------
const Model3D: React.FC<BoxModelProps> = ({ dimensions, material, foldProgress, textureUrl }) => {
    const { l: L_mm, w: W_mm, h: H_mm } = dimensions;
    // ... (existing constants)
    const l = L_mm / 1000;
    const w = W_mm / 1000;
    const h = H_mm / 1000;
    const t = 0.003;

    // ... (animation logic s1...s5) 
    // Need to reconstruct s1-s5 here or keep them. 
    // Since I am replacing a small chunk, I should replicate necessary parts or target specific lines.

    // Let's replace the top part of Model3D to include textureUrl and Texture loading.

    // Animatsiya bosqichlari
    // 1. Yon devorlar ichki qismi buklanadi (Side Inner Walls)
    const s1 = Math.min(foldProgress / 0.3, 1) * Math.PI;

    // 2. Yon devorlar tiklanadi (Side Outer Walls)
    const s2 = Math.min(foldProgress / 0.3, 1) * (Math.PI / 2);

    // 3. Old devor (Front)
    const s3 = foldProgress > 0.3 ? Math.min((foldProgress - 0.3) / 0.3, 1) * (Math.PI / 2) : 0;

    // 4. Qopqoq (Lid) + Orqa (Back)
    const s4 = foldProgress > 0.5 ? Math.min((foldProgress - 0.5) / 0.3, 1) * (Math.PI / 2) : 0;

    // 5. Qulf (Tuck)
    const s5 = foldProgress > 0.8 ? Math.min((foldProgress - 0.8) / 0.2, 1) * (Math.PI / 2.2) : 0;

    const { surfaceMat } = useCardboardMaterial(material, textureUrl);

    return (
        <group>
            {/* ASOS (BASE) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow material={surfaceMat}>
                <planeGeometry args={[l, w]} />
            </mesh>

            {/* YON DEVORLAR (SIDES) */}
            {[1, -1].map((side) => (
                <group key={side} position={[side * l / 2, 0, 0]} rotation={[0, 0, -side * s2]}>
                    {/* Tashqi Yon Devor */}
                    <mesh position={[side * h / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={surfaceMat}>
                        <planeGeometry args={[h, w]} />
                    </mesh>

                    {/* Ichki Yon Devor (Double Wall) */}
                    <group position={[side * h, 0, 0]} rotation={[0, 0, -side * s1]}>
                        <mesh position={[side * h / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={surfaceMat}>
                            <planeGeometry args={[h - 2 * t, w]} /> {/* Birkichkina kichikroq sig'ishi uchun */}
                        </mesh>

                        {/* Qulflash tili (Side Locking Tabs - vizual) */}
                        <mesh position={[side * h, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={surfaceMat}>
                            <planeGeometry args={[t, w * 0.5]} />
                        </mesh>
                    </group>
                </group>
            ))}

            {/* OLD DEVOR (FRONT WALL) */}
            <group position={[0, 0, w / 2]} rotation={[-s3, 0, 0]}>
                <mesh position={[0, h / 2, 0]} material={surfaceMat}>
                    <planeGeometry args={[l, h]} />
                </mesh>
                {/* Old devor qanotlari (Dust Flaps for Front) */}
                {[1, -1].map((side) => (
                    <group key={side} position={[side * l / 2, h / 2, 0]} rotation={[0, -side * Math.PI / 2, 0]}>
                        <mesh position={[h / 2, 0, 0]} material={surfaceMat}>
                            <planeGeometry args={[h - 0.005, h - 0.005]} />
                        </mesh>
                    </group>
                ))}
            </group>

            {/* ORQA DEVOR (BACK WALL) */}
            <group position={[0, 0, -w / 2]} rotation={[s4, 0, 0]}>
                {/* Back Panel */}
                <mesh position={[0, h / 2, 0]} material={surfaceMat}>
                    <planeGeometry args={[l, h]} />
                </mesh>

                {/* QOPQOQ (LID) */}
                <group position={[0, h, 0]} rotation={[s4 > 0 ? Math.PI / 2 : 0, 0, 0]}>
                    {/* Note: In real 0427, Lid is attached to Back. 
                        Rotation s4 lifts Back up 90deg. 
                        Then we need another hinge for the Lid itself if we want it to curve, 
                        BUT 0427 usually: Back folds 90, Lid folds 90 relative to Back.
                        So Total Lid angle relative to ground is 180 (flat on top).
                    */}
                    <group rotation={[s4 * 0.2, 0, 0]}> {/* Slight curve or just flat */}
                        <mesh position={[0, w / 2, 0]} material={surfaceMat}>
                            <planeGeometry args={[l, w]} />
                        </mesh>

                        {/* YON QULOQLAR (DUST FLAPS - Lid Sides) */}
                        {[1, -1].map((s) => (
                            <group key={s} position={[s * l / 2, w / 2, 0]} rotation={[0, s * Math.PI / 2, 0]}>
                                <mesh position={[0, 0, 0]} material={surfaceMat}>
                                    <planeGeometry args={[w, h]} /> {/* Full depth flaps */}
                                </mesh>
                            </group>
                        ))}

                        {/* QULFLASH TILI (TUCK FLAP) */}
                        <group position={[0, w, 0]} rotation={[s5, 0, 0]}>
                            <mesh position={[0, h / 2, 0]} material={surfaceMat}>
                                <planeGeometry args={[l, h]} />
                            </mesh>
                        </group>
                    </group>
                </group>
            </group>
        </group>
    );
};

// ------------------------------------------------------------------
// 2D LAYOUT COMPONENT (SVG)
// ------------------------------------------------------------------
const Layout2D: React.FC<BoxModelProps> = ({ dimensions, t }) => {
    const { l, w, h } = dimensions;
    const { totalWidth, totalHeight } = getDielineSpecs(dimensions);
    const _t = t || ((k: string) => k); // Fallback

    // Font size calculation (large)
    const fontSize = Math.max(l, w, h) / 8;
    const dimColor = "#ef4444";
    const panelColor = "#2563eb";

    return (
        <div className="overflow-auto bg-gray-50 p-4 rounded-lg flex items-center justify-center min-h-[400px]">
            <svg
                viewBox={`-${fontSize} -${fontSize} ${totalWidth + 100} ${totalHeight + 100}`}
                className="w-full h-full max-h-[600px]"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2" />
                    </pattern>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill={dimColor} />
                    </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                <g transform={`translate(150, 50)`} fill="none" stroke={panelColor} strokeWidth="2">

                    {/* ASOS (BASE) */}
                    <rect x={2 * h} y={h + w} width={l} height={w} strokeDasharray="5 5" fill="rgba(37, 99, 235, 0.05)" />
                    <text x={2 * h + l / 2} y={h + w + w / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="bold">{_t('part.base')}</text>

                    {/* ORQA (BACK) */}
                    <rect x={2 * h} y={w} width={l} height={h} />

                    {/* QOPQOQ (LID) */}
                    <rect x={2 * h} y={0} width={l} height={w} />
                    <text x={2 * h + l / 2} y={w / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="bold">{_t('part.lid')}</text>

                    {/* YON DEVORLAR (SIDES) */}
                    {/* Chap */}
                    {/* H (Outer - Attached to Base) */}
                    <rect x={h} y={h + w} width={h} height={w} />
                    {/* 0 (Inner - Attached to Outer) - With locking tab shape */}
                    <path d={`
                        M ${h} ${h + w} 
                        L ${0} ${h + w} 
                        L ${0} ${h + 2 * w / 3}
                        L ${10} ${h + w / 2} 
                        L ${0} ${h + w / 3} 
                        L ${0} ${h + w + w} 
                        L ${h} ${h + w + w} 
                        Z
                    `} fill="none" />
                    <text x={h / 2} y={h + w + w / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize / 2} opacity="0.5" transform={`rotate(-90, ${h / 2}, ${h + w + w / 2})`}>{_t('part.inner')}</text>

                    {/* O'ng */}
                    {/* Outer */}
                    <rect x={2 * h + l} y={h + w} width={h} height={w} />
                    {/* Inner */}
                    <path d={`
                        M ${2 * h + l + h} ${h + w + w}
                        L ${2 * h + l + 2 * h} ${h + w + w}
                        L ${2 * h + l + 2 * h} ${h + w / 3}
                        L ${2 * h + l + 2 * h - 10} ${h + w / 2}
                        L ${2 * h + l + 2 * h} ${h + 2 * w / 3}
                        L ${2 * h + l + 2 * h} ${h + w}
                        L ${2 * h + l + h} ${h + w}
                        Z
                    `} fill="none" />

                    {/* OLD DEVOR (FRONT) */}
                    <rect x={2 * h} y={h + w + w} width={l} height={h} />
                    {/* Dust Flaps on Front */}
                    <rect x={2 * h - h + 10} y={h + w + w} width={h - 10} height={h} />
                    <rect x={2 * h + l} y={h + w + w} width={h - 10} height={h} />

                    {/* Qulf (Tuck) on Lid */}
                    <path d={`
                        M ${2 * h} ${0} 
                        L ${2 * h + l} ${0} 
                        L ${2 * h + l - 10} ${h} 
                        L ${2 * h + 10} ${h} 
                        Z
                    `} transform={`translate(0, -${h})`} />
                </g>

                {/* O'lcham chiziqlari (Dimensions) */}
                <g stroke={dimColor} strokeWidth="2" transform="translate(150, 50)" fontSize={fontSize} fontWeight="bold" fill={dimColor}>

                    {/* L (Uzunlik) - Asos ostida */}
                    <line x1={2 * h} y1={h + w + w + h + 20} x2={2 * h + l} y2={h + w + w + h + 20} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={2 * h + l / 2} y={h + w + w + h + 20 + fontSize} stroke="none" textAnchor="middle">{l}</text>

                    {/* W (Kenglik) - Chap tomonda */}
                    <line x1={-20} y1={h + w} x2={-20} y2={h + w + w} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={-20 - fontSize / 2} y={h + w + w / 2} stroke="none" textAnchor="end" dominantBaseline="middle">{w}</text>

                    {/* H (Balandlik) - Back Panel yonida */}
                    <line x1={2 * h + l + 10} y1={w} x2={2 * h + l + 10} y2={w + h} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={2 * h + l + 25} y={w + h / 2} stroke="none" dominantBaseline="middle">{h}</text>

                    {/* H (Front Panel) */}
                    <line x1={2 * h + l + 10} y1={h + w + w} x2={2 * h + l + 10} y2={h + w + w + h} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={2 * h + l + 25} y={h + w + w + h / 2} stroke="none" dominantBaseline="middle">{h}</text>

                    {/* Yon Devor H */}
                    <line x1={h} y1={h + w + w + 10} x2={2 * h} y2={h + w + w + 10} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={1.5 * h} y={h + w + w + 10 + fontSize} stroke="none" textAnchor="middle">{h}</text>

                </g>
            </svg>
        </div>
    );
};

// ------------------------------------------------------------------
// BOX MODEL DEFINITION
// ------------------------------------------------------------------
const Fefco0427: BoxModel = {
    id: 'fefco-0427',
    name: 'Mailer Box (FEFCO 0427)',
    description: 'E-tijorat uchun moʻljallangan, oʻzi qulflanadigan mustahkam quti.',
    validate: (dims) => {
        if (dims.h > dims.w * 0.8) {
            return { valid: false, error: "Balandlik kenglikning 80% idan oshmasligi kerak (yig'ish imkonsiz bo'ladi)." };
        }
        if (dims.l < 100 || dims.w < 100) {
            return { valid: false, error: "Minimal o'lchamlar 100x100mm bo'lishi kerak." };
        }
        return { valid: true };
    },
    Model3D,
    Layout2D,
    calculateArea: (dims: BoxDimensions) => {
        const { l, w, h } = dims;
        const t = 3;
        const totalWidth = (h * 4) + l + (t * 4);
        const totalHeight = (w * 2) + (h * 3) + 20;
        return (totalWidth / 1000) * (totalHeight / 1000); // m2
    },
    downloadPDF: (dims, t) => {
        const { l, w, h } = dims;
        const totalW = (h * 4) + l;
        const totalH = (w * 2) + (h * 3);
        const _t = t || ((k: string) => k);

        // Dynamic import to avoid SSR issues if any, though widely supported now
        import('../../lib/pdfUtils').then(({ generateUnformattedPDF }) => {
            generateUnformattedPDF({
                fileName: `fefco0427_${l}x${w}x${h}.pdf`,
                title: `PACK24 - FEFCO 0427 (${l}x${w}x${h} mm)`,
                dims,
                t: _t,
                totalSize: { w: totalW, h: totalH },
                drawFn: (doc, startX, startY) => {
                    const FONT_SIZE_LARGE = 30;

                    // 1. Qopqoq qismi (Lid + Tuck)
                    // Qulf (Tuck)
                    doc.rect(startX + 2 * h, startY - h, l, h);

                    // Qopqoq
                    doc.rect(startX + 2 * h, startY, l, w);
                    doc.setFontSize(FONT_SIZE_LARGE); // KATTA FONT
                    doc.text(_t('part.lid'), startX + 2 * h + l / 2, startY + w / 2, { align: 'center', baseline: 'middle' });

                    // Orqa
                    doc.rect(startX + 2 * h, startY + w, l, h);

                    // 2. Asosiy qism (Base + Sides)
                    const baseY = startY + w + h;
                    // Asos
                    doc.rect(startX + 2 * h, baseY, l, w);
                    doc.setFontSize(FONT_SIZE_LARGE); // KATTA FONT
                    doc.text(_t('part.base'), startX + 2 * h + l / 2, baseY + w / 2, { align: 'center', baseline: 'middle' });

                    // Chap devorlar
                    doc.rect(startX + h, baseY, h, w);     // Ichki
                    doc.rect(startX, baseY, h, w);         // Tashqi

                    // O'ng devorlar
                    doc.rect(startX + 2 * h + l, baseY, h, w);     // Ichki
                    doc.rect(startX + 2 * h + l + h, baseY, h, w); // Tashqi

                    // 3. Old devor
                    doc.rect(startX + 2 * h, baseY + w, l, h);


                    // ------------------------------------------------------
                    // DIMENSIONS (O'lchamlar) - Red & Large Font
                    // ------------------------------------------------------
                    doc.setTextColor(239, 68, 68); // Red-500
                    doc.setDrawColor(239, 68, 68);
                    doc.setFontSize(FONT_SIZE_LARGE);

                    // L (Uzunlik) - Asos ostida
                    // SVG: y = h + w + w + h + 20 (relative to start) -> PDF: baseY + w + h + 20
                    const bottomY = baseY + w + h + 20;
                    doc.line(startX + 2 * h, bottomY, startX + 2 * h + l, bottomY);
                    doc.text(`${l}`, startX + 2 * h + l / 2, bottomY + 10, { align: 'center' }); // Text below line

                    // W (Kenglik) - Chap tomonda
                    // SVG: x = -20 (relative) -> PDF: startX - 20
                    const leftX = startX - 20;
                    doc.line(leftX, baseY, leftX, baseY + w);
                    doc.text(`${w}`, leftX - 5, baseY + w / 2, { align: 'right', baseline: 'middle' });

                    // H (Balandlik) - Back Panel
                    const rightX = startX + 2 * h + l + 10;
                    doc.line(rightX, startY + w, rightX, startY + w + h);
                    doc.text(`${h}`, rightX + 5, startY + w + h / 2, { align: 'left', baseline: 'middle' });

                    // H (Front Panel)
                    doc.line(rightX, baseY + w, rightX, baseY + w + h);
                    doc.text(`${h}`, rightX + 5, baseY + w + h / 2, { align: 'left', baseline: 'middle' });

                    // H (Side Wall)
                    const sideH_Y = baseY + w + 10;
                    doc.line(startX + h, sideH_Y, startX + 2 * h, sideH_Y);
                    doc.text(`${h}`, startX + 1.5 * h, sideH_Y + 10, { align: 'center' });
                }
            });
        });
    }
};

export default Fefco0427;


