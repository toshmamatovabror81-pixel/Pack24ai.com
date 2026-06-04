'use client';

import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Text, Float, Grid } from '@react-three/drei';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────
interface ProductViewer3DProps {
    width?: number;
    height?: number;
    color?: string;
    label?: string;
    dimensions?: { width: number; height: number; depth: number };
}

// ─── Scale factor: cm → Three.js units ──────────────────────────
const CM_SCALE = 0.01;

// ─── Rotating Box Component ─────────────────────────────────────
function PackagingBox({
    dimensions,
    color,
    label,
}: {
    dimensions: { width: number; height: number; depth: number };
    color: string;
    label: string;
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Slow idle rotation
    useFrame((_state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.3;
        }
    });

    const w = dimensions.width * CM_SCALE;
    const h = dimensions.height * CM_SCALE;
    const d = dimensions.depth * CM_SCALE;

    // Create materials array for each face — front face gets label later via <Text>
    const materials = useMemo(() => {
        const base = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.1,
            roughness: 0.55,
        });
        return Array(6).fill(base);
    }, [color]);

    return (
        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.15}>
            <group>
                <mesh
                    ref={meshRef}
                    material={materials}
                    castShadow
                    receiveShadow
                    position={[0, h / 2, 0]}
                >
                    <boxGeometry args={[w, h, d]} />
                    {/* Front face label */}
                    {label && (
                        <Text
                            position={[0, 0, d / 2 + 0.001]}
                            fontSize={Math.min(w, h) * 0.15}
                            maxWidth={w * 0.85}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                            font="/fonts/Inter-Bold.woff"
                            outlineWidth={0.002}
                            outlineColor="#00000044"
                        >
                            {label}
                        </Text>
                    )}
                    {/* Back face label */}
                    {label && (
                        <Text
                            position={[0, 0, -(d / 2 + 0.001)]}
                            fontSize={Math.min(w, h) * 0.15}
                            maxWidth={w * 0.85}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                            rotation={[0, Math.PI, 0]}
                            outlineWidth={0.002}
                            outlineColor="#00000044"
                        >
                            {label}
                        </Text>
                    )}
                </mesh>
            </group>
        </Float>
    );
}

// ─── Floor Grid ─────────────────────────────────────────────────
function FloorGrid() {
    return (
        <Grid
            args={[10, 10]}
            cellSize={0.1}
            cellThickness={0.5}
            cellColor="#6e6e6e"
            sectionSize={0.5}
            sectionThickness={1}
            sectionColor="#9d4b4b"
            fadeDistance={4}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid
            position={[0, -0.001, 0]}
        />
    );
}

// ─── Scene ──────────────────────────────────────────────────────
function Scene({
    dimensions,
    color,
    label,
}: {
    dimensions: { width: number; height: number; depth: number };
    color: string;
    label: string;
}) {
    const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth) * CM_SCALE;
    const camDist = maxDim * 2.5;

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
                position={[5, 8, 5]}
                intensity={1.4}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />
            <directionalLight position={[-3, 4, -5]} intensity={0.3} />

            {/* Environment for reflections */}
            <Environment preset="city" />

            {/* Product */}
            <PackagingBox dimensions={dimensions} color={color} label={label} />

            {/* Contact shadows on the floor */}
            <ContactShadows
                position={[0, -0.001, 0]}
                opacity={0.35}
                scale={maxDim * 6}
                blur={2.5}
                far={maxDim * 3}
            />

            {/* Floor grid */}
            <FloorGrid />

            {/* Controls */}
            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={camDist * 0.4}
                maxDistance={camDist * 2}
                autoRotate
                autoRotateSpeed={1.5}
                maxPolarAngle={Math.PI / 2}
                target={[0, (dimensions.height * CM_SCALE) / 2, 0]}
            />
        </>
    );
}

// ─── CSS 3D Fallback ────────────────────────────────────────────
function CSS3DFallback({
    color,
    label,
    dimensions,
}: {
    color: string;
    label: string;
    dimensions: { width: number; height: number; depth: number };
}) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="box-3d-wrapper flex items-center justify-center">
                <div
                    className="box-3d"
                    style={{
                        '--box-color': color,
                        width: `${Math.min(dimensions.width * 2, 200)}px`,
                        height: `${Math.min(dimensions.height * 2, 160)}px`,
                    } as React.CSSProperties}
                >
                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm drop-shadow">
                        {label}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Loading Spinner ────────────────────────────────────────────
function LoadingFallback() {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 font-medium">Loading 3D…</span>
        </div>
    );
}

// ─── WebGL Detection ────────────────────────────────────────────
function useWebGLSupport() {
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        try {
            const canvas = document.createElement('canvas');
            const gl =
                canvas.getContext('webgl2') ||
                canvas.getContext('webgl') ||
                canvas.getContext('experimental-webgl');
            setSupported(!!gl);
        } catch {
            setSupported(false);
        }
    }, []);

    return supported;
}

// ─── Main Component ─────────────────────────────────────────────
export default function ProductViewer3D({
    width,
    height,
    color = '#c29b70',
    label = '',
    dimensions = { width: 30, height: 20, depth: 15 },
}: ProductViewer3DProps) {
    const webglSupported = useWebGLSupport();
    const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth) * CM_SCALE;
    const camDist = maxDim * 2.5;

    const containerStyle: React.CSSProperties = {
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%',
        minHeight: 300,
    };

    if (!webglSupported) {
        return (
            <div style={containerStyle}>
                <CSS3DFallback color={color} label={label} dimensions={dimensions} />
            </div>
        );
    }

    return (
        <div style={containerStyle} className="rounded-xl overflow-hidden cursor-grab active:cursor-grabbing">
            <Suspense fallback={<LoadingFallback />}>
                <Canvas
                    shadows
                    camera={{
                        position: [camDist * 0.8, camDist * 0.6, camDist],
                        fov: 45,
                        near: 0.01,
                        far: 100,
                    }}
                    gl={{ antialias: true, alpha: true }}
                    style={{ background: 'transparent' }}
                >
                    <Scene dimensions={dimensions} color={color} label={label} />
                </Canvas>
            </Suspense>
        </div>
    );
}
