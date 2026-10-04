import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CornerBrackets } from './index';

export type FormStudyType = 'monolith' | 'gem' | 'torus';

interface StudioCanvas3DProps {
  className?: string;
  defaultForm?: FormStudyType;
  interactive?: boolean;
}

export const StudioCanvas3D: React.FC<StudioCanvas3DProps> = ({
  className = '',
  defaultForm = 'gem',
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentForm, setCurrentForm] = useState<FormStudyType>(defaultForm);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [azimuth, setAzimuth] = useState<number>(45);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mouse & interaction state
  const mouseState = useRef({
    isDown: false,
    prevX: 0,
    prevY: 0,
    targetRotX: 0.3,
    targetRotY: 0.5,
    rotX: 0.3,
    rotY: 0.5,
    autoRotate: true,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 260;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 4.8;

    // 3. Renderer with alpha
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights (Studio lighting setup inspired by Depth.fyi)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Key rim light (Electric Indigo / Sky)
    const rimLight1 = new THREE.DirectionalLight(0x818cf8, 3.5);
    rimLight1.position.set(4, 5, 4);
    scene.add(rimLight1);

    // Fill light (Teal / Emerald)
    const rimLight2 = new THREE.DirectionalLight(0x34d399, 2.0);
    rimLight2.position.set(-4, -3, -2);
    scene.add(rimLight2);

    // Specular top pin
    const pinLight = new THREE.PointLight(0xffffff, 2.0, 10);
    pinLight.position.set(0, 3, 2);
    scene.add(pinLight);

    // 5. Mesh Group
    const group = new THREE.Group();
    scene.add(group);
    meshGroupRef.current = group;

    const buildGeometries = () => {
      group.clear();

      let geom: THREE.BufferGeometry;
      if (currentForm === 'gem') {
        geom = new THREE.IcosahedronGeometry(1.3, 0);
      } else if (currentForm === 'torus') {
        geom = new THREE.TorusKnotGeometry(0.85, 0.28, 96, 16);
      } else {
        // Monolith prism
        geom = new THREE.CylinderGeometry(0.8, 1.1, 2.0, 6);
      }

      // Studio obsidian glass material
      const mainMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x181824),
        emissive: new THREE.Color(0x080812),
        metalness: 0.85,
        roughness: 0.18,
        reflectivity: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        wireframe: wireframeMode,
      });

      const mesh = new THREE.Mesh(geom, mainMaterial);
      group.add(mesh);

      // Outer delicate wireframe cage (signature high-tech aesthetic)
      if (!wireframeMode) {
        const wireframeGeom = new THREE.WireframeGeometry(geom);
        const wireframeMat = new THREE.LineBasicMaterial({
          color: 0x818cf8,
          transparent: true,
          opacity: 0.35,
        });
        const wireframeLines = new THREE.LineSegments(wireframeGeom, wireframeMat);
        wireframeLines.scale.set(1.02, 1.02, 1.02);
        group.add(wireframeLines);
      }
    };

    buildGeometries();

    // 6. Interaction Event Handlers
    const onPointerDown = (e: PointerEvent) => {
      mouseState.current.isDown = true;
      mouseState.current.prevX = e.clientX;
      mouseState.current.prevY = e.clientY;
      mouseState.current.autoRotate = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (mouseState.current.isDown) {
        const deltaX = e.clientX - mouseState.current.prevX;
        const deltaY = e.clientY - mouseState.current.prevY;
        mouseState.current.targetRotY += deltaX * 0.008;
        mouseState.current.targetRotX += deltaY * 0.008;
        mouseState.current.prevX = e.clientX;
        mouseState.current.prevY = e.clientY;
      } else {
        // Subtle mouse hovering parallax
        const rect = container.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width - 0.5;
        const normY = (e.clientY - rect.top) / rect.height - 0.5;
        mouseState.current.targetRotY = normX * 1.2;
        mouseState.current.targetRotX = normY * 0.8;
      }
    };

    const onPointerUp = () => {
      mouseState.current.isDown = false;
      // Resume slow auto rotate after 2 seconds
      setTimeout(() => {
        if (!mouseState.current.isDown) {
          mouseState.current.autoRotate = true;
        }
      }, 2000);
    };

    if (interactive) {
      container.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    // 7. Animation Loop with smooth inertia (LERP)
    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (mouseState.current.autoRotate) {
        mouseState.current.targetRotY += 0.4 * dt;
      }

      // Inertia interpolation (Damping)
      mouseState.current.rotX += (mouseState.current.targetRotX - mouseState.current.rotX) * 0.08;
      mouseState.current.rotY += (mouseState.current.targetRotY - mouseState.current.rotY) * 0.08;

      if (group) {
        group.rotation.x = mouseState.current.rotX;
        group.rotation.y = mouseState.current.rotY;

        // Calculate live azimuth angle in degrees for the UI readout
        const deg = Math.round(((mouseState.current.rotY % (Math.PI * 2)) / (Math.PI * 2)) * 360);
        const normDeg = deg < 0 ? deg + 360 : deg;
        setAzimuth(normDeg);
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // 8. Responsive Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        const newH = entry.contentRect.height;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      if (interactive) {
        container.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      }
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [currentForm, wireframeMode, interactive]);

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/50 dark:bg-zinc-950/70 backdrop-blur-2xl ${className}`}>
      <CornerBrackets size="w-2 h-2" className="border-indigo-400/40" />

      {/* Depth-style technical metadata bar */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono tracking-widest uppercase text-slate-500 dark:text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>FORM STUDY // 01</span>
        </span>
        <span>AZIMUTH {String(azimuth).padStart(3, '0')}°</span>
      </div>

      {/* 3D WebGL Canvas container */}
      <div 
        ref={mountRef} 
        className="w-full h-48 sm:h-56 cursor-grab active:cursor-grabbing touch-none select-none"
        title="Touch & drag to rotate 3D form"
      />

      {/* Interactive Controls Bar */}
      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between z-10">
        {/* Form Selector Pills */}
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-900/90 border border-slate-300/60 dark:border-white/[0.08] text-[9px] font-mono uppercase tracking-wider backdrop-blur-md">
          {(['gem', 'monolith', 'torus'] as FormStudyType[]).map((f) => (
            <button
              key={f}
              onClick={() => setCurrentForm(f)}
              className={`px-2 py-0.5 rounded-full transition-colors ${
                currentForm === f
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Wireframe Toggle */}
        <button
          onClick={() => setWireframeMode(!wireframeMode)}
          className={`px-2.5 py-1 rounded-full border text-[9px] font-mono uppercase tracking-wider transition-colors backdrop-blur-md ${
            wireframeMode
              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400 font-bold'
              : 'border-slate-300 dark:border-white/[0.08] bg-slate-200/70 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {wireframeMode ? 'MESH // ON' : 'MESH // OFF'}
        </button>
      </div>
    </div>
  );
};
