import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Material } from '../types';

export function useCardboardMaterial(material: Material, textureUrl?: string) {
    // Load all textures in a single call to prevent suspense deadlocks
    const textures = useTexture([
        textureUrl || '/textures/kraft.png', // custom or fallback
        '/textures/kraft.png',
        '/textures/flute.png'
    ]);
    
    const customTexture = textures[0];
    const kraftTex = textures[1];
    const fluteTex = textures[2];
    
    return useMemo(() => {
        const isWhite = material.name.toLowerCase().includes('white') || material.color === '#ffffff';
        
        kraftTex.wrapS = kraftTex.wrapT = THREE.RepeatWrapping;
        kraftTex.repeat.set(3, 3);
        kraftTex.needsUpdate = true;
        
        fluteTex.wrapS = fluteTex.wrapT = THREE.RepeatWrapping;
        fluteTex.repeat.set(10, 1);
        fluteTex.needsUpdate = true;
        
        if (textureUrl) {
            customTexture.wrapS = customTexture.wrapT = THREE.ClampToEdgeWrapping;
            customTexture.flipY = false;
            customTexture.needsUpdate = true;
        }

        const surfaceTex = textureUrl ? customTexture : kraftTex;
        const surfaceColor = textureUrl ? '#ffffff' : (isWhite ? '#f5f5f5' : '#c29b70');
        const edgeColor = isWhite ? '#e8e8e8' : '#a07850';

        const surfaceMat = new THREE.MeshStandardMaterial({
            map: surfaceTex,
            color: surfaceColor,
            roughness: textureUrl ? 0.4 : 0.9,
            bumpMap: kraftTex,
            bumpScale: textureUrl ? 0 : 0.002,
            side: THREE.DoubleSide,
        });

        const edgeMat = new THREE.MeshStandardMaterial({
            map: fluteTex,
            color: edgeColor,
            roughness: 1,
            bumpMap: fluteTex,
            bumpScale: 0.005,
            side: THREE.DoubleSide,
        });
        
        const creaseMat = new THREE.MeshStandardMaterial({
            color: surfaceColor,
            roughness: 0.9,
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide,
        });
        
        // Right, Left, Top, Bottom, Front, Back
        const matArray = [edgeMat, edgeMat, edgeMat, edgeMat, surfaceMat, surfaceMat];

        return { surfaceMat, edgeMat, creaseMat, matArray };
    }, [material, textureUrl, kraftTex, fluteTex, customTexture]);
}
