'use client';

import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, ContactShadows, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────
interface VirtualForestProps {
  treesCount: number;
  totalWeight: number;
  co2Saved: number;
  ecoLevel: string;
}

interface TreeData {
  position: [number, number, number];
  scale: number;
  trunkHeight: number;
  canopyRadius: number;
  canopyHeight: number;
  color: string;
  rotation: number;
}

// ─── Constants ───────────────────────────────────────────────────
const MAX_VISIBLE_TREES = 50;
const CANOPY_GREENS = [
  '#228B22', '#2E8B57', '#3CB371', '#006400', '#32CD32',
  '#196F3D', '#27AE60', '#1E8449', '#239B56', '#2ECC71',
];

const GROUND_RADIUS = 18;

// ─── Helpers ─────────────────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateTreePositions(count: number): TreeData[] {
  const visibleCount = Math.min(count, MAX_VISIBLE_TREES);
  const scaleFactor = count > MAX_VISIBLE_TREES ? 1 + (count - MAX_VISIBLE_TREES) / 100 : 1;
  const rand = seededRandom(42);
  const trees: TreeData[] = [];

  for (let i = 0; i < visibleCount; i++) {
    // Sunflower / Vogel spiral for natural distribution
    const angle = i * 2.39996323; // golden angle
    const radius = Math.sqrt(i / visibleCount) * (GROUND_RADIUS - 2);
    const jitterX = (rand() - 0.5) * 1.8;
    const jitterZ = (rand() - 0.5) * 1.8;
    const x = Math.cos(angle) * radius + jitterX;
    const z = Math.sin(angle) * radius + jitterZ;

    const maturityRatio = Math.min(i / Math.max(visibleCount - 1, 1), 1);
    const baseScale = (0.5 + maturityRatio * 0.7) * scaleFactor;
    const trunkH = 0.6 + maturityRatio * 0.9;
    const canopyR = 0.5 + maturityRatio * 0.5;
    const canopyH = 0.8 + maturityRatio * 0.6;

    trees.push({
      position: [x, 0, z],
      scale: baseScale,
      trunkHeight: trunkH,
      canopyRadius: canopyR,
      canopyHeight: canopyH,
      color: CANOPY_GREENS[i % CANOPY_GREENS.length],
      rotation: rand() * Math.PI * 2,
    });
  }

  return trees;
}

// ─── Tree mesh ───────────────────────────────────────────────────
function Tree({ data, index }: { data: TreeData; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const [grown, setGrown] = useState(false);
  const startTime = useRef(0);

  useEffect(() => {
    // Stagger start so trees "pop up" sequentially
    startTime.current = performance.now() + index * 60;
  }, [index]);

  useFrame(() => {
    if (!groupRef.current) return;
    if (grown) return;

    const elapsed = (performance.now() - startTime.current) / 1000;
    if (elapsed < 0) {
      groupRef.current.scale.setScalar(0);
      return;
    }
    // Spring-like ease
    const progress = Math.min(elapsed / 0.7, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const springScale = data.scale * eased;
    groupRef.current.scale.setScalar(springScale);

    if (progress >= 1) setGrown(true);
  });

  return (
    <group
      ref={groupRef}
      position={data.position}
      rotation={[0, data.rotation, 0]}
      scale={0}
    >
      {/* Trunk */}
      <mesh position={[0, data.trunkHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, data.trunkHeight, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>

      {/* Canopy */}
      <mesh
        position={[0, data.trunkHeight + data.canopyHeight / 2 - 0.1, 0]}
        castShadow
      >
        <coneGeometry args={[data.canopyRadius, data.canopyHeight, 8]} />
        <meshStandardMaterial color={data.color} roughness={0.8} flatShading />
      </mesh>

      {/* Second canopy layer for fullness */}
      <mesh
        position={[0, data.trunkHeight + data.canopyHeight * 0.8, 0]}
        castShadow
      >
        <coneGeometry args={[data.canopyRadius * 0.65, data.canopyHeight * 0.6, 8]} />
        <meshStandardMaterial
          color={data.color}
          roughness={0.75}
          flatShading
        />
      </mesh>
    </group>
  );
}

// ─── Ground ──────────────────────────────────────────────────────
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
      <circleGeometry args={[GROUND_RADIUS, 64]} />
      <meshStandardMaterial color="#4ade80" roughness={1} />
    </mesh>
  );
}

// ─── Scene ───────────────────────────────────────────────────────
function ForestScene({ treesCount }: { treesCount: number }) {
  const trees = useMemo(() => generateTreePositions(treesCount), [treesCount]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Sky */}
      <Sky
        sunPosition={[100, 50, 100]}
        turbidity={8}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Ground */}
      <Ground />

      {/* Contact shadows */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={40}
        blur={2}
        far={20}
      />

      {/* Trees */}
      {trees.map((treeData, i) => (
        <Tree key={i} data={treeData} index={i} />
      ))}

      {/* Floating leaf particles */}
      <Sparkles
        count={60}
        scale={[GROUND_RADIUS * 2, 8, GROUND_RADIUS * 2]}
        size={3}
        speed={0.4}
        color="#90EE90"
        opacity={0.6}
      />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
}

// ─── Loading fallback ────────────────────────────────────────────
function CanvasLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-100 to-emerald-50">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-bounce">🌳</span>
        <p className="text-sm text-emerald-700 font-medium">O&apos;rmon yuklanmoqda...</p>
      </div>
    </div>
  );
}

// ─── No-WebGL fallback ───────────────────────────────────────────
function NoWebGLFallback({ treesCount, totalWeight, co2Saved, ecoLevel }: VirtualForestProps) {
  const treeEmojis = '🌳'.repeat(Math.min(treesCount, 30));
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-emerald-50 to-green-100 rounded-2xl p-8">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-3xl leading-relaxed break-all">{treeEmojis || '🌱'}</p>
        <h3 className="text-xl font-bold text-emerald-800">
          Sizning virtual o&apos;rmoningiz
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-2xl font-bold text-emerald-700">{treesCount}</p>
            <p className="text-emerald-600">daraxt</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-700">{totalWeight} kg</p>
            <p className="text-blue-600">qayta ishlandi</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-2xl font-bold text-cyan-700">{co2Saved} kg</p>
            <p className="text-cyan-600">CO₂ tejaldi</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-2xl font-bold text-amber-700">{ecoLevel}</p>
            <p className="text-amber-600">daraja</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WebGL detection ─────────────────────────────────────────────
function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') || canvas.getContext('webgl2')
    );
  } catch {
    return false;
  }
}

// ─── Main export ─────────────────────────────────────────────────
export default function VirtualForest(props: VirtualForestProps) {
  const { treesCount, totalWeight, co2Saved, ecoLevel } = props;
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    setWebglSupported(hasWebGL());
  }, []);

  if (!webglSupported) {
    return <NoWebGLFallback {...props} />;
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-gradient-to-b from-sky-200 to-emerald-100">
      <Suspense fallback={<CanvasLoader />}>
        <Canvas
          shadows
          camera={{
            position: [12, 14, 12],
            fov: 50,
            near: 0.1,
            far: 200,
          }}
          gl={{ antialias: true, alpha: false }}
        >
          <ForestScene treesCount={treesCount || 0} />
        </Canvas>
      </Suspense>

      {/* Overlay stats badge */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg text-xs sm:text-sm font-medium">
          <span className="text-emerald-700 dark:text-emerald-400">
            🌳 {treesCount} ta daraxt
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-blue-700 dark:text-blue-400">
            ♻️ {totalWeight} kg
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
          <span className="text-cyan-700 dark:text-cyan-400 hidden sm:inline">
            💨 {co2Saved} kg CO₂
          </span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
          <span className="text-amber-700 dark:text-amber-400 hidden sm:inline">
            🏆 {ecoLevel}
          </span>
        </div>
      </div>
    </div>
  );
}
