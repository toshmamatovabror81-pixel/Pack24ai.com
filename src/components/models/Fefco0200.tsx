import { BoxModel, BoxModelProps, BoxDimensions } from '../../lib/types';
import jsPDF from 'jspdf';
import { useCardboardMaterial } from '../../lib/hooks/useCardboardMaterial';

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
const Model3D: React.FC<BoxModelProps> = ({ dimensions, material, foldProgress, textureUrl }) => {
    const { l: L, w: W, h: H } = dimensions;

    const l = L / 1000;
    const w = W / 1000;
    const h = H / 1000;
    const flapW = w / 2; // Bottom flaps meet in the middle
    const lineT = 0.001; 

    const fold = foldProgress;
    const wallRad = (Math.PI / 2) * Math.min(fold / 0.5, 1);
    const flapRad = fold > 0.5 ? (Math.PI / 2) * Math.min((fold - 0.5) / 0.5, 1) : 0;

    const { surfaceMat, edgeMat, creaseMat, matArray } = useCardboardMaterial(material, textureUrl);

    const HCrease = ({ pw, y }: { pw: number; y: number }) => (
        <mesh position={[0, y, 0.005]} material={creaseMat}>
            <boxGeometry args={[pw, lineT, lineT]} />
        </mesh>
    );

    return (
        <group position={[-l / 2, -h / 2, w / 2]} scale={1.2}>
            {/* L1 FRONT */}
            <mesh material={matArray}>
                <boxGeometry args={[l, h, 0.003]} />
                <HCrease pw={l} y={-h/2} />
                
                {/* No top flap for 0200 */}
                <group position={[0, -h / 2, 0]} rotation={[-flapRad, 0, 0]}>
                    <mesh position={[0, -flapW / 2, 0]} material={matArray}><boxGeometry args={[l, flapW, 0.002]} /></mesh>
                </group>

                {/* W1 RIGHT */}
                <group position={[l / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                    <mesh position={[w / 2, 0, 0]} material={matArray}>
                        <boxGeometry args={[w, h, 0.003]} />
                        <HCrease pw={w} y={-h/2} />
                        
                        <group position={[0, -h / 2, 0.001]} rotation={[-flapRad, 0, 0]}>
                            <mesh position={[0, -flapW / 2, 0]} material={matArray}><boxGeometry args={[w, flapW, 0.002]} /></mesh>
                        </group>

                        {/* L2 BACK */}
                        <group position={[w / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                            <mesh position={[l / 2, 0, 0]} material={matArray}>
                                <boxGeometry args={[l, h, 0.003]} />
                                <HCrease pw={l} y={-h/2} />
                                
                                <group position={[0, -h / 2, 0]} rotation={[-flapRad, 0, 0]}>
                                    <mesh position={[0, -flapW / 2, 0]} material={matArray}><boxGeometry args={[l, flapW, 0.002]} /></mesh>
                                </group>

                                {/* W2 LEFT */}
                                <group position={[l / 2, 0, 0]} rotation={[0, -wallRad, 0]}>
                                    <mesh position={[w / 2, 0, 0]} material={matArray}>
                                        <boxGeometry args={[w, h, 0.003]} />
                                        <HCrease pw={w} y={-h/2} />
                                        
                                        <group position={[0, -h / 2, 0.001]} rotation={[-flapRad, 0, 0]}>
                                            <mesh position={[0, -flapW / 2, 0]} material={matArray}><boxGeometry args={[w, flapW, 0.002]} /></mesh>
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
    const topFlap = 0; // FEFCO 0200 has no top flap
    const bottomFlap = W / 2;

    const totalSheetWidth = (L * 2) + (W * 2) + glue;
    const totalSheetHeight = H + bottomFlap;

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

                {/* External Dimensions */}
                <g stroke={dimColor} strokeWidth="2" fontSize={fontSize} fontWeight="bold" fill={dimColor}>
                    <line x1={0} y1={totalSheetHeight + 50} x2={totalSheetWidth} y2={totalSheetHeight + 50} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <text x={totalSheetWidth / 2} y={totalSheetHeight + 50 + fontSize} stroke="none" textAnchor="middle">{_t('label.total')}: {totalSheetWidth}</text>

                    <line x1={-50} y1={topFlap} x2={-50} y2={topFlap + H} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <text x={-50 - 10} y={topFlap + H / 2} stroke="none" textAnchor="end" dominantBaseline="middle">{H}</text>
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
    const topFlap = 0;
    const bottomFlap = W / 2;
    const _t = t || ((k: string) => k);

    const totalSheetWidth = (L * 2) + (W * 2) + glue;
    const totalSheetHeight = topFlap + H + bottomFlap;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [totalSheetWidth + 300, Math.max(totalSheetHeight + 200, 297)]
    });

    const FONT_SIZE_LARGE = 30;

    doc.setFontSize(24);
    doc.text(`PACK24 - FEFCO 0200 (${L}x${W}x${H} mm)`, 20, 20);

    const startX = 150;
    const startY = 50;

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);

    const drawPanel = (x: number, w: number, text: string) => {
        doc.setDrawColor(0, 0, 0);
        doc.rect(x, startY, w, H);

        doc.setDrawColor(239, 68, 68);
        doc.setLineDashPattern([5, 5], 0);
        doc.rect(x, startY + H, w, W / 2); // Bottom flap only
        doc.setLineDashPattern([], 0);

        doc.setTextColor(37, 99, 235);
        doc.setFontSize(FONT_SIZE_LARGE);
        doc.text(text, x + w / 2, startY + H / 2, { align: 'center', baseline: 'middle' });
    };

    drawPanel(startX, L, `${L}`);
    let currentX = startX + L;
    drawPanel(currentX, W, `${W}`);
    currentX += W;
    drawPanel(currentX, L, `${L}`);
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

    doc.setTextColor(239, 68, 68);
    doc.setDrawColor(239, 68, 68);
    doc.setFontSize(FONT_SIZE_LARGE);

    const bottomY = startY + H + bottomFlap + 20;
    doc.line(startX, bottomY, startX + totalSheetWidth, bottomY);
    doc.text(`${_t('label.total')}: ${totalSheetWidth}`, startX + totalSheetWidth / 2, bottomY + 10, { align: 'center' });

    const leftX = startX - 20;
    doc.line(leftX, startY, leftX, startY + H);
    doc.text(`${H}`, leftX - 5, startY + H / 2, { align: 'right', baseline: 'middle' });

    doc.save(`box_fefco0200_${L}x${W}x${H}.pdf`);
};

const Fefco0200: BoxModel = {
    id: 'fefco-0200',
    name: 'Open Top Box (FEFCO 0200)',
    description: 'Half slotted container with no top flaps. Often used as a tray.',
    validate: (dims: BoxDimensions) => {
        const { l, w, h } = dims;
        const maxHoriz = CONSTANTS.MAX_HORIZ;
        const maxH = CONSTANTS.MAX_H;

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
        const topFlap = 0;
        const bottomFlap = W / 2;
        const totalSheetWidth = (L * 2) + (W * 2) + glue;
        const totalSheetHeight = topFlap + H + bottomFlap;
        return (totalSheetWidth / 1000) * (totalSheetHeight / 1000);
    }
};

export default Fefco0200;
