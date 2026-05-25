import { BoxModel, BoxModelProps, BoxDimensions } from '../../lib/types';
import jsPDF from 'jspdf';

// Helper for geometry constants
const CONSTANTS = {
    MAX_HORIZ: 2600,
    MAX_H: 800,
    GLUE: 35,
    TRIM: 20,
};

// ------------------------------------------------------------------
// 3D MODEL
// ------------------------------------------------------------------
const Model3D: React.FC<BoxModelProps> = ({ dimensions, material, foldProgress }) => {
    const { l: L, w: W, h: H } = dimensions;

    const l = L / 1000;
    const w = W / 1000;
    const h = H / 1000;
    const flapW = w / 2;
    const lineT = 0.001; // fold line thickness

    const fold = foldProgress;
    const wallRad = (Math.PI / 2) * Math.min(fold / 0.5, 1);
    const flapRad = fold > 0.5 ? (Math.PI / 2) * Math.min((fold - 0.5) / 0.5, 1) : 0;

    const mat = <meshStandardMaterial color={material.color} side={2} roughness={0.8} />;
    const foldMat = <meshBasicMaterial color="#1d4ed8" side={2} />;

    // Horizontal fold line (across panel width at y position)
    const HCrease = ({ pw, y }: { pw: number; y: number }) => (
        <mesh position={[0, y, 0.005]}>
            <boxGeometry args={[pw, lineT, lineT]} />
            {foldMat}
        </mesh>
    );

    return (
        <group position={[-l / 2, -h / 2, w / 2]} scale={1.2}>
            {/* L1 FRONT */}
            <mesh>
                <boxGeometry args={[l, h, 0.003]} />{mat}
                <HCrease pw={l} y={h/2} />
                <HCrease pw={l} y={-h/2} />
                {/* vertical crease at right edge */}
                <mesh position={[l/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                
                <group position={[0, h / 2, 0]} rotation={[flapRad, 0, 0]}>
                    <mesh position={[0, flapW / 2, 0]}><boxGeometry args={[l, flapW, 0.002]} />{mat}</mesh>
                </group>
                <group position={[0, -h / 2, 0]} rotation={[-flapRad, 0, 0]}>
                    <mesh position={[0, -flapW / 2, 0]}><boxGeometry args={[l, flapW, 0.002]} />{mat}</mesh>
                </group>

                {/* W1 RIGHT */}
                <group position={[l / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                    <mesh position={[w / 2, 0, 0]}>
                        <boxGeometry args={[w, h, 0.003]} />{mat}
                        <HCrease pw={w} y={h/2} />
                        <HCrease pw={w} y={-h/2} />
                        <mesh position={[w/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                        <mesh position={[-w/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                        <group position={[0, h / 2, 0.001]} rotation={[flapRad, 0, 0]}>
                            <mesh position={[0, flapW / 2, 0]}><boxGeometry args={[w, flapW, 0.002]} />{mat}</mesh>
                        </group>
                        <group position={[0, -h / 2, 0.001]} rotation={[-flapRad, 0, 0]}>
                            <mesh position={[0, -flapW / 2, 0]}><boxGeometry args={[w, flapW, 0.002]} />{mat}</mesh>
                        </group>

                        {/* L2 BACK */}
                        <group position={[w / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                            <mesh position={[l / 2, 0, 0]}>
                                <boxGeometry args={[l, h, 0.003]} />{mat}
                                <HCrease pw={l} y={h/2} />
                                <HCrease pw={l} y={-h/2} />
                                <mesh position={[l/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                                <mesh position={[-l/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                                <group position={[0, h / 2, 0]} rotation={[flapRad, 0, 0]}>
                                    <mesh position={[0, flapW / 2, 0]}><boxGeometry args={[l, flapW, 0.002]} />{mat}</mesh>
                                </group>
                                <group position={[0, -h / 2, 0]} rotation={[-flapRad, 0, 0]}>
                                    <mesh position={[0, -flapW / 2, 0]}><boxGeometry args={[l, flapW, 0.002]} />{mat}</mesh>
                                </group>

                                {/* W2 LEFT */}
                                <group position={[l / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                                    <mesh position={[w / 2, 0, 0]}>
                                        <boxGeometry args={[w, h, 0.003]} />{mat}
                                        <HCrease pw={w} y={h/2} />
                                        <HCrease pw={w} y={-h/2} />
                                        <mesh position={[w/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                                        <mesh position={[-w/2, 0, 0.005]}><boxGeometry args={[lineT, h + flapW*2, lineT]} />{foldMat}</mesh>
                                        <group position={[0, h / 2, 0.001]} rotation={[flapRad, 0, 0]}>
                                            <mesh position={[0, flapW / 2, 0]}><boxGeometry args={[w, flapW, 0.002]} />{mat}</mesh>
                                        </group>
                                        <group position={[0, -h / 2, 0.001]} rotation={[-flapRad, 0, 0]}>
                                            <mesh position={[0, -flapW / 2, 0]}><boxGeometry args={[w, flapW, 0.002]} />{mat}</mesh>
                                        </group>
                                    </mesh>
                                </group>
                            </mesh>
                        </group>
                    </mesh>
                </group>
            </mesh>
        </group>
    );
};

// ------------------------------------------------------------------
// 2D LAYOUT
// ------------------------------------------------------------------
const Layout2D: React.FC<BoxModelProps> = ({ dimensions, t }) => {
    const { l: L, w: W, h: H } = dimensions;
    const _t = t || ((k: string) => k);

    const glue = CONSTANTS.GLUE;
    const topFlap = W / 2;
    const bottomFlap = W / 2;

    const totalSheetWidth = (L * 2) + (W * 2) + glue;
    const totalSheetHeight = topFlap + H + bottomFlap;

    // Font size calculation (large)
    const fontSize = Math.max(L, W, H) / 8;
    const dimColor = "#ef4444";
    const panelColor = "#2563eb";

    return (
        <svg viewBox={`-${fontSize} -${fontSize} ${totalSheetWidth + 300} ${totalSheetHeight + 300}`} className="w-full h-full max-h-[600px]" preserveAspectRatio="xMidYMid meet">
            <defs>
                <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2" />
                </pattern>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill={dimColor} />
                </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform="translate(150, 50)" fill="none" strokeWidth="2">
                {/* Main Panels */}
                {[0, L, L + W, L * 2 + W].map((x, i) => {
                    const width = i % 2 === 0 ? L : W;
                    const isL = i % 2 === 0;
                    return (
                        <g key={i}>
                            <rect x={x} y={topFlap} width={width} height={H} stroke={panelColor} fill="rgba(37, 99, 235, 0.05)" />
                            {/* Top Flap */}
                            <rect x={x} y={0} width={width} height={topFlap} stroke={dimColor} strokeDasharray="5,5" fill="rgba(239, 68, 68, 0.05)" />
                            {/* Bottom Flap */}
                            <rect x={x} y={topFlap + H} width={width} height={bottomFlap} stroke={dimColor} strokeDasharray="5,5" fill="rgba(239, 68, 68, 0.05)" />

                            {/* Internal Dimension Text */}
                            <text x={x + width / 2} y={topFlap + H / 2} fill={panelColor} stroke="none" fontWeight="bold" fontSize={fontSize} textAnchor="middle" dominantBaseline="middle">
                                {isL ? L : W}
                            </text>
                        </g>
                    );
                })}

                {/* Glue Tab */}
                <path d={`M ${L * 2 + W * 2} ${topFlap + 10} L ${L * 2 + W * 2 + glue} ${topFlap + 20} L ${L * 2 + W * 2 + glue} ${topFlap + H - 20} L ${L * 2 + W * 2} ${topFlap + H - 10} Z`} stroke={panelColor} fill="rgba(0,0,0,0.1)" />

                {/* External Dimensions (Arrows) */}
                <g stroke={dimColor} strokeWidth="2" fontSize={fontSize} fontWeight="bold" fill={dimColor}>
                    {/* Total Width (Bottom) */}
                    <line x1={0} y1={totalSheetHeight + 50} x2={totalSheetWidth} y2={totalSheetHeight + 50} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <text x={totalSheetWidth / 2} y={totalSheetHeight + 50 + fontSize} stroke="none" textAnchor="middle">{_t('label.total')}: {totalSheetWidth}</text>

                    {/* H (Left) */}
                    <line x1={-50} y1={topFlap} x2={-50} y2={topFlap + H} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <text x={-50 - 10} y={topFlap + H / 2} stroke="none" textAnchor="end" dominantBaseline="middle">{H}</text>

                    {/* Flap H (Left) */}
                    <line x1={-50} y1={0} x2={-50} y2={topFlap} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <text x={-50 - 10} y={topFlap / 2} stroke="none" textAnchor="end" dominantBaseline="middle">{topFlap}</text>
                </g>
            </g>
        </svg>
    );
};

// ------------------------------------------------------------------
// BOX MODEL DEFINITION
// ------------------------------------------------------------------
const downloadPDF = (dims: BoxDimensions, t: (key: string) => string) => {
    const { l: L, w: W, h: H } = dims;
    const glue = CONSTANTS.GLUE;
    const topFlap = W / 2;
    const bottomFlap = W / 2;
    const _t = t || ((k: string) => k);

    const totalSheetWidth = (L * 2) + (W * 2) + glue;
    const totalSheetHeight = topFlap + H + bottomFlap;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [totalSheetWidth + 300, Math.max(totalSheetHeight + 200, 297)] // Increased canvas
    });

    const FONT_SIZE_LARGE = 30; // Requested size

    doc.setFontSize(24);
    doc.text(`PACK24 - FEFCO 0201 (${L}x${W}x${H} mm)`, 20, 20);

    const startX = 150; // Shifted right
    const startY = 50 + (W / 2);

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);

    // Draw Panels logic for PDF
    // Helper used for rects
    const drawPanel = (x: number, w: number, text: string) => {
        // Main
        doc.setDrawColor(0, 0, 0); // Black lines
        doc.rect(x, startY, w, H);

        // Flaps
        doc.setDrawColor(239, 68, 68); // Red dashed
        doc.setLineDashPattern([5, 5], 0);
        doc.rect(x, startY - (W / 2), w, W / 2); // Top
        doc.rect(x, startY + H, w, W / 2);     // Bottom
        doc.setLineDashPattern([], 0); // Reset

        // Text
        doc.setTextColor(37, 99, 235); // Blue
        doc.setFontSize(FONT_SIZE_LARGE);
        doc.text(text, x + w / 2, startY + H / 2, { align: 'center', baseline: 'middle' });
    };

    // Panel 1: L
    drawPanel(startX, L, `${L}`);

    // Panel 2: W
    let currentX = startX + L;
    drawPanel(currentX, W, `${W}`);

    // Panel 3: L
    currentX += W;
    drawPanel(currentX, L, `${L}`);

    // Panel 4: W
    currentX += L;
    drawPanel(currentX, W, `${W}`);

    // Glue Tab
    currentX += W;
    doc.setDrawColor(0, 0, 0);
    doc.lines([
        [glue, 10],
        [0, H - 20],
        [-glue, 10]
    ], currentX, startY + 10, [1, 1], 'S', true);

    // ------------------------------------------------------
    // DIMENSIONS (O'lchamlar) - Red & Large Font
    // ------------------------------------------------------
    doc.setTextColor(239, 68, 68); // Red
    doc.setDrawColor(239, 68, 68);
    doc.setFontSize(FONT_SIZE_LARGE);

    // Total Width
    const bottomY = startY + H + bottomFlap + 20;
    doc.line(startX, bottomY, startX + totalSheetWidth, bottomY);
    doc.text(`${_t('label.total')}: ${totalSheetWidth}`, startX + totalSheetWidth / 2, bottomY + 10, { align: 'center' }); // Text below

    // H
    const leftX = startX - 20;
    doc.line(leftX, startY, leftX, startY + H);
    doc.text(`${H}`, leftX - 5, startY + H / 2, { align: 'right', baseline: 'middle' }); // H right aligned

    // Top Flap H
    doc.line(leftX, startY - topFlap, leftX, startY);
    doc.text(`${topFlap}`, leftX - 5, startY - topFlap / 2, { align: 'right', baseline: 'middle' }); // Flap right aligned


    doc.save(`box_fefco0201_${L}x${W}x${H}.pdf`);
};

const Fefco0201: BoxModel = {
    id: 'fefco-0201',
    name: 'Standard Box (FEFCO 0201)',
    description: 'Most common shipping box type with flaps meeting in the middle.',
    validate: (dims: BoxDimensions) => {
        const { l, w, h } = dims;
        const maxHoriz = CONSTANTS.MAX_HORIZ;
        const maxH = CONSTANTS.MAX_H;

        // Logic from original file:
        // if (numValue + other > MAX_HORIZ) ...
        // here we just check if it exceeds limits
        if (h > maxH) return { valid: false, error: `Height cannot exceed ${maxH}mm` };
        if ((l + w) * 2 + CONSTANTS.GLUE > maxHoriz) return { valid: false, error: `Total length exceeds production limit (${maxHoriz}mm)` };

        return { valid: true };
    },
    Model3D,
    Layout2D,
    downloadPDF,
    calculateArea: (dims: BoxDimensions) => {
        const { l: L, w: W, h: H } = dims;
        const glue = CONSTANTS.GLUE;
        const topFlap = W / 2;
        const bottomFlap = W / 2;
        const totalSheetWidth = (L * 2) + (W * 2) + glue;
        const totalSheetHeight = topFlap + H + bottomFlap;
        return (totalSheetWidth / 1000) * (totalSheetHeight / 1000); // m2
    }
};

export default Fefco0201;
