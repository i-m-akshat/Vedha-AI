import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface VoxelMatrixCanvasProps {
  className?: string;
}

export const VoxelMatrixCanvas: React.FC<VoxelMatrixCanvasProps> = ({ className = 'w-full h-full' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 300;
    let height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Architectural Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);

    const dirLightBack = new THREE.DirectionalLight(0x555555, 0.6);
    dirLightBack.position.set(-10, -10, -10);
    scene.add(dirLightBack);

    // Voxel Monolith Group
    const group = new THREE.Group();
    scene.add(group);

    const boxSize = 0.85;
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const edges = new THREE.EdgesGeometry(boxGeo);

    const matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matGray = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const matWire = new THREE.LineBasicMaterial({ color: 0x444444 });

    const voxels: THREE.Mesh[] = [];
    const gridSize = 4;
    const offset = ((gridSize - 1) * boxSize * 1.05) / 2;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const distFromCenter = Math.sqrt(
            Math.pow(x - 1.5, 2) + Math.pow(y - 1.5, 2) + Math.pow(z - 1.5, 2)
          );
          if (distFromCenter < 1.1 || distFromCenter > 2.2) continue;

          const isWhite = (x + y + z) % 3 === 0;
          const mesh = new THREE.Mesh(boxGeo, isWhite ? matWhite : matGray);

          mesh.position.set(
            x * boxSize * 1.1 - offset,
            y * boxSize * 1.1 - offset,
            z * boxSize * 1.1 - offset
          );

          mesh.userData = {
            baseX: mesh.position.x,
            baseY: mesh.position.y,
            baseZ: mesh.position.z,
            freq: 1.5 + Math.random() * 2.0,
            phase: Math.random() * Math.PI * 2,
          };

          const line = new THREE.LineSegments(edges, matWire);
          mesh.add(line);

          group.add(mesh);
          voxels.push(mesh);
        }
      }
    }

    // Outer pixel bounding wireframe box
    const outerBoxGeo = new THREE.BoxGeometry(5.4, 5.4, 5.4);
    const outerEdges = new THREE.EdgesGeometry(outerBoxGeo);
    const outerBoxLine = new THREE.LineSegments(
      outerEdges,
      new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8 })
    );
    group.add(outerBoxLine);

    // Floating pixel dots orbit
    const dotCount = 80;
    const dotGeo = new THREE.BufferGeometry();
    const dotPositions = new Float32Array(dotCount * 3);
    for (let i = 0; i < dotCount; i++) {
      dotPositions[i * 3] = (Math.random() - 0.5) * 14;
      dotPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      dotPositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    const dotMat = new THREE.PointsMaterial({ color: 0x888888, size: 0.12 });
    const dotPoints = new THREE.Points(dotGeo, dotMat);
    group.add(dotPoints);

    // Mouse Parallax Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left - rect.width / 2;
      const clientY = e.clientY - rect.top - rect.height / 2;
      mouseX = clientX * 0.001;
      mouseY = clientY * 0.001;
    };

    window.addEventListener('mousemove', handleMouseMove);

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

    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      targetRotX += (mouseY - targetRotX) * 0.05;
      targetRotY += (mouseX - targetRotY) * 0.05;

      group.rotation.y += 0.4 * delta + targetRotY * 0.1;
      group.rotation.x += 0.25 * delta + targetRotX * 0.1;

      // Gentle breathing animation of individual voxels
      voxels.forEach((v) => {
        const s = 1.0 + Math.sin(time * v.userData.freq + v.userData.phase) * 0.08;
        v.scale.set(s, s, s);
      });

      dotPoints.rotation.y -= 0.1 * delta;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      boxGeo.dispose();
      outerBoxGeo.dispose();
      edges.dispose();
      outerEdges.dispose();
      dotGeo.dispose();
      matWhite.dispose();
      matGray.dispose();
      matWire.dispose();
      dotMat.dispose();
    };
  }, []);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%' }} />;
};
