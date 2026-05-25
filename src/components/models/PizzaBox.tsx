import React from 'react';
import { BoxModel, BoxModelProps, BoxDimensions } from '../../lib/types';

// ------------------------------------------------------------------
// GEOMETRY & CALCULATIONS
// ------------------------------------------------------------------
const getDielineSpecs = (dims: BoxDimensions) => {
    const { l, w, h } = dims;
    const t = 3;

    // Pizza box (FEFCO 0426 style) geometry
    // Similar to 0427 but often flatter.
    return {
        l, w, h,
        totalWidth: (h * 4) + l + (t * 4),
        totalHeight: (w * 2) + (h * 3) + 20,
        offset: { x: 150, y: 50 } // Offset for dimensions visibility
    };
};

// ------------------------------------------------------------------
// 3D MODEL COMPONENT
// ------------------------------------------------------------------
const Model3D: React.FC<BoxModelProps> = ({ dimensions, material, foldProgress }) => {
    const { l: L_mm, w: W_mm, h: H_mm } = dimensions;
    const l = L_mm / 1000;
    const w = W_mm / 1000;
    const h = H_mm / 1000;

    // Animation Steps
    // 1. Fold Sides & Front up
    const s1 = Math.min(foldProgress / 0.3, 1) * (Math.PI / 2);

    // 2. Fold Back up
    const s2 = foldProgress > 0.3 ? Math.min((foldProgress - 0.3) / 0.2, 1) * (Math.PI / 2) : 0;

    // 3. Close Lid (Relative to Back)
    const s3 = foldProgress > 0.5 ? Math.min((foldProgress - 0.5) / 0.3, 1) * (Math.PI / 2.05) : 0; // Close > 90 to tuck in? No, 90 + Tuck

    // 4. Tuck Flaps (Side flaps on Lid)
    const s4 = foldProgress > 0.8 ? Math.min((foldProgress - 0.8) / 0.2, 1) * (Math.PI / 2.2) : 0;

    // Locking tabs / Tuck on front
    const s5 = foldProgress > 0.8 ? Math.min((foldProgress - 0.8) / 0.2, 1) * (Math.PI / 2) : 0;

    const mat = <meshStandardMaterial color={material.color} side={2} roughness={0.7} metalness={0.1} />;

    return (
        <group>
            {/* Base */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
                <planeGeometry args={[l, w]} />
                {mat}
            </mesh>

            {/* Side Walls (Attached to Base) */}
            {[1, -1].map((side) => (
                <group key={side} position={[side * l / 2, 0, 0]} rotation={[0, 0, -side * s1]}>
                    <mesh position={[side * h / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <planeGeometry args={[h, w]} />
                        {mat}
                    </mesh>
                </group>
            ))}

            {/* Front Wall (Attached to Base) */}
            <group position={[0, 0, w / 2]} rotation={[-s1, 0, 0]}>
                <mesh position={[0, h / 2, 0]}>
                    <planeGeometry args={[l, h]} />
                    {mat}
                </mesh>
            </group>

            {/* Back Wall (Attached to Base) */}
            <group position={[0, 0, -w / 2]} rotation={[s2, 0, 0]}>
                <mesh position={[0, h / 2, 0]}>
                    <planeGeometry args={[l, h]} />
                    {mat}
                </mesh>

                {/* Lid (Attached to Back) */}
                <group position={[0, h, 0]} rotation={[s3, 0, 0]}>
                    <mesh position={[0, w / 2, 0]}>
                        <planeGeometry args={[l, w]} />
                        {mat}
                    </mesh>

                    {/* Side Dust Flaps (On Lid) - tuck inside base sides */}
                    {[1, -1].map((s) => (
                        <group key={s} position={[s * l / 2, w / 2, 0]} rotation={[0, s * Math.PI / 2, 0]}>
                            <group rotation={[s4, 0, 0]}> {/* Angle inward to tuck */}
                                <mesh position={[0, 0, 0]}>
                                    <planeGeometry args={[w * 0.8, h]} />
                                    {mat}
                                </mesh>
                            </group>
                        </group>
                    ))}

                    {/* Front Tuck Flap (On Lid) */}
                    <group position={[0, w, 0]} rotation={[s5, 0, 0]}>
                        <mesh position={[0, h / 2, 0]}>
                            <planeGeometry args={[l, h]} />
                            {mat}
                        </mesh>
                    </group>
                </group>
            </group>
        </group>
    );
};

// ------------------------------------------------------------------
// 2D LAYOUT COMPONENT
// ------------------------------------------------------------------
const Layout2D: React.FC<BoxModelProps> = ({ dimensions, t }) => {
    const { l, w, h } = dimensions;
    const { totalWidth, totalHeight } = getDielineSpecs(dimensions);
    const _t = t || ((k: string) => k);

    const fontSize = Math.max(l, w, h) / 8;
    const dimColor = "#ef4444";
    const panelColor = "#2563eb";

    return (
        <div className="overflow-auto bg-gray-50 p-4 rounded-lg flex items-center justify-center min-h-[400px]">
            <svg
                viewBox={`-${fontSize * 2} -${fontSize * 2} ${totalWidth + fontSize * 4} ${totalHeight + fontSize * 4}`}
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
                    {/* Base */}
                    <rect x={2 * h} y={h + w} width={l} height={w} strokeDasharray="5 5" fill="rgba(37, 99, 235, 0.05)" />
                    <text x={2 * h + l / 2} y={h + w + w / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="bold">{_t('part.base')}</text>

                    {/* Back */}
                    <rect x={2 * h} y={w} width={l} height={h} />
                    <text x={2 * h + l / 2} y={w + h / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize / 1.5} opacity="0.5">{_t('part.back')}</text>

                    {/* Lid */}
                    <rect x={2 * h} y={0} width={l} height={w} />
                    <text x={2 * h + l / 2} y={w / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="bold">{_t('part.lid')}</text>

                    {/* Lid Side Flaps (Dust Flaps) - Approx 0.8*w deep */}
                    {/* Left Flap on Lid */}
                    <path d={`
                        M ${2 * h} ${0}
                        L ${2 * h - (w * 0.8)} ${10}
                        L ${2 * h - (w * 0.8)} ${w - 10}
                        L ${2 * h} ${w}
                        Z
                    `} opacity="0.8" />
                    {/* Right Flap on Lid */}
                    <path d={`
                        M ${2 * h + l} ${0}
                        L ${2 * h + l + (w * 0.8)} ${10}
                        L ${2 * h + l + (w * 0.8)} ${w - 10}
                        L ${2 * h + l} ${w}
                        Z
                    `} opacity="0.8" />


                    {/* Side Walls (Attached to Base) */}
                    {/* Left */}
                    <rect x={h} y={h + w} width={h} height={w} />
                    {/* Right */}
                    <rect x={2 * h + l} y={h + w} width={h} height={w} />

                    {/* Front */}
                    <rect x={2 * h} y={h + w + w} width={l} height={h} />
                    <text x={2 * h + l / 2} y={h + w + w + h / 2} fill={panelColor} stroke="none" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize / 1.5} opacity="0.5">{_t('part.front')}</text>

                    {/* Tuck Flap (Classic Pizza Style - Angled) on Lid */}
                    <path d={`M ${2 * h} ${0} L ${2 * h + l} ${0} L ${2 * h + l - 15} ${-h} L ${2 * h + 15} ${-h} Z`} opacity="0.5" />
                </g>

                {/* Dimensions */}
                <g stroke={dimColor} strokeWidth="2" transform="translate(150, 50)" fontSize={fontSize} fontWeight="bold" fill={dimColor}>

                    {/* L */}
                    <line x1={2 * h} y1={h + w + w + h + 20} x2={2 * h + l} y2={h + w + w + h + 20} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={2 * h + l / 2} y={h + w + w + h + 20 + fontSize} stroke="none" textAnchor="middle">{l}</text>

                    {/* W */}
                    <line x1={-30} y1={h + w} x2={-30} y2={h + w + w} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={-40} y={h + w + w / 2} stroke="none" textAnchor="end" dominantBaseline="middle">{w}</text>

                    {/* H (Prominent) */}
                    <line x1={2 * h + l + h + h + 20} y1={h + w + w} x2={2 * h + l + h + h + 20} y2={h + w + w + h} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={2 * h + l + h + h + 20 + 10} y={h + w + w + h / 2} stroke="none" dominantBaseline="middle">H={h}</text>

                    {/* H (Side) */}
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
const PizzaBox: BoxModel = {
    id: 'pizza-box',
    name: 'Pizza Box (FEFCO 0426)',
    description: 'Pitsa va yassi mahsulotlar uchun klassik quti.',
    validate: (dims) => {
        // Pizza boxes are usually flat, L & W >> H
        if (dims.h > dims.w * 0.5) return { valid: false, error: "Pizza qutisi yassi bo'lishi kerak (H < W/2)" };
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

        import('../../lib/pdfUtils').then(({ generateUnformattedPDF }) => {
            generateUnformattedPDF({
                fileName: `pizza_box_${l}x${w}x${h}.pdf`,
                title: `PACK24 - Pizza Box (${l}x${w}x${h} mm)`,
                dims,
                t: _t,
                totalSize: { w: totalW, h: totalH },
                drawFn: (doc, startX, startY) => {
                    const FONT_SIZE_LARGE = 30;

                    // Lid & Tuck
                    doc.rect(startX + 2 * h, startY - h, l, h);
                    doc.rect(startX + 2 * h, startY, l, w);
                    doc.setFontSize(FONT_SIZE_LARGE);
                    doc.text(_t('part.lid'), startX + 2 * h + l / 2, startY + w / 2, { align: 'center', baseline: 'middle' });
                    doc.rect(startX + 2 * h, startY + w, l, h);

                    // Base & Sides
                    const baseY = startY + w + h;
                    doc.rect(startX + 2 * h, baseY, l, w);
                    doc.text(_t('part.base'), startX + 2 * h + l / 2, baseY + w / 2, { align: 'center', baseline: 'middle' });

                    doc.rect(startX + h, baseY, h, w);
                    doc.rect(startX, baseY, h, w); // Use h here, not 0 offset
                    doc.rect(startX + 2 * h + l, baseY, h, w);
                    doc.rect(startX + 2 * h + l + h, baseY, h, w);
                    doc.rect(startX + 2 * h, baseY + w, l, h);

                    // Dimensions
                    doc.setTextColor(239, 68, 68);
                    doc.setDrawColor(239, 68, 68);
                    doc.setFontSize(FONT_SIZE_LARGE);

                    // L
                    const bottomY = baseY + w + h + 20;
                    doc.line(startX + 2 * h, bottomY, startX + 2 * h + l, bottomY);
                    doc.text(`${l}`, startX + 2 * h + l / 2, bottomY + 12, { align: 'center' });

                    // W
                    const leftX = startX - 20;
                    doc.line(leftX, baseY, leftX, baseY + w);
                    doc.text(`${w}`, leftX - 5, baseY + w / 2, { align: 'right', baseline: 'middle' });

                    // H
                    const rightX = startX + 2 * h + l + 10;
                    doc.line(rightX, baseY + w, rightX, baseY + w + h);
                    doc.text(`H=${h}`, rightX + 5, baseY + w + h / 2, { align: 'left', baseline: 'middle' });

                    // H Side
                    const sideH_Y = baseY + w + 10;
                    doc.line(startX + h, sideH_Y, startX + 2 * h, sideH_Y);
                    doc.text(`${h}`, startX + 1.5 * h, sideH_Y + 12, { align: 'center' });
                }
            });
        });
    }
};

export default PizzaBox;
