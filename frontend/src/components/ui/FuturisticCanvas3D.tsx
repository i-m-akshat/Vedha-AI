import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FuturisticCanvas3DProps {
  className?: string;
  interactive?: boolean;
}

/**
 * Futuristic 3D Cybernetic Ambient Canvas
 * High-performance WebGL ambient starfield and neural constellation.
 * Features smooth mouse parallax, glowing nodes, and clean minimalist depth.
 */
export const FuturisticCanvas3D: React.FC<FuturisticCanvas3DProps> = ({
  className = '',
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 240;

    // 2. High-Performance Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Neural Particles & Floating Nodes
    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities: { x: number; y: number; z: number }[] = [];

    const palette = [
      new THREE.Color('#6366f1'), // Indigo / Quantum Purple
      new THREE.Color('#38bdf8'), // Sky / Cyber Cyan
      new THREE.Color('#10b981'), // Emerald / Terminal Green
      new THREE.Color('#818cf8'), // Soft Violet
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 350;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 220;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      velocities.push({
        x: (Math.random() - 0.5) * 0.12,
        y: (Math.random() - 0.5) * 0.12,
        z: (Math.random() - 0.5) * 0.08,
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material with Soft Glow Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(129, 140, 248, 0.8)');
      gradient.addColorStop(0.8, 'rgba(99, 102, 241, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const pointMaterial = new THREE.PointsMaterial({
      size: 4.5,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, pointMaterial);
    scene.add(points);

    // 4. Subtle Interconnection Lines (Neural Constellation)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    });

    const lineGeom = new THREE.BufferGeometry();
    const maxLineSegments = particleCount * 4;
    const linePositions = new Float32Array(maxLineSegments * 6);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(lines);

    // 5. Minimalist 3D Rotating Cyber Ring
    const torusGeom = new THREE.TorusGeometry(75, 0.4, 16, 80);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const torus = new THREE.Mesh(torusGeom, torusMat);
    torus.rotation.x = Math.PI / 3;
    scene.add(torus);

    // Mouse movement listener
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      mouse.current.targetX = (e.clientX / window.innerWidth - 0.5) * 40;
      mouse.current.targetY = -(e.clientY / window.innerHeight - 0.5) * 30;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 6. Animation Loop
    let animId: number;
    let isVisible = true;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      // Smooth camera parallax easing
      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.04;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.04;
      camera.position.x = mouse.current.x;
      camera.position.y = mouse.current.y;
      camera.lookAt(0, 0, 0);

      // Rotate torus
      torus.rotation.z += 0.0015;
      torus.rotation.y += 0.0008;

      // Update particles
      const pos = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velocities[i].x;
        pos[i * 3 + 1] += velocities[i].y;
        pos[i * 3 + 2] += velocities[i].z;

        // Soft bounce boundaries
        if (Math.abs(pos[i * 3]) > 175) velocities[i].x *= -1;
        if (Math.abs(pos[i * 3 + 1]) > 110) velocities[i].y *= -1;
        if (Math.abs(pos[i * 3 + 2]) > 80) velocities[i].z *= -1;
      }
      geometry.attributes.position.needsUpdate = true;

      // Update dynamic lines between nearest neighbors
      let lineIdx = 0;
      const posArray = lineGeom.attributes.position.array as Float32Array;
      const connectDist = 45;

      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < connectDist * connectDist && lineIdx < maxLineSegments * 6 - 6) {
            posArray[lineIdx++] = pos[i * 3];
            posArray[lineIdx++] = pos[i * 3 + 1];
            posArray[lineIdx++] = pos[i * 3 + 2];
            posArray[lineIdx++] = pos[j * 3];
            posArray[lineIdx++] = pos[j * 3 + 1];
            posArray[lineIdx++] = pos[j * 3 + 2];
          }
        }
      }
      lineGeom.setDrawRange(0, lineIdx / 3);
      lineGeom.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      geometry.dispose();
      pointMaterial.dispose();
      texture.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      torusGeom.dispose();
      torusMat.dispose();
      renderer.dispose();
    };
  }, [interactive]);

  return (
    <div
      ref={mountRef}
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-60 dark:opacity-40 transition-opacity duration-1000 ${className}`}
      aria-hidden="true"
    />
  );
};
