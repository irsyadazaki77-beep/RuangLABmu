import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { disposeThreeSceneResources } from '../utils/threeStudioKit';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';

export interface EarthScienceScene3DProps {
  moduleId: string;
  params: Record<string, number>;
  outputs: Record<string, number>;
}

/**
 * Lightweight Procedural 3D Viewport for Earth & Environmental Science (Pilar 3)
 * Uses low-poly procedural geometry & ring-wave shaders/meshes to maintain >30 FPS on 3T devices.
 */
export const EarthScienceScene3D: React.FC<EarthScienceScene3DProps> = ({
  moduleId,
  params,
  outputs,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const paramsRef = useRef(params);
  const outputsRef = useRef(outputs);
  paramsRef.current = params;
  outputsRef.current = outputs;

  const isSimulating = useLabStore((s) => s.isSimulating);
  const isSimulatingRef = useRef(isSimulating);
  isSimulatingRef.current = isSimulating;

  const liteDeviceMode = useUIStore((s) => s.liteDeviceMode);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.FogExp2(0x0b1220, 0.032);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(6.5, 5.2, 8.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !liteDeviceMode,
      powerPreference: liteDeviceMode ? 'low-power' : 'high-performance',
    });
    renderer.setPixelRatio(liteDeviceMode ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.5;
    controls.maxDistance = 22;

    // Three-point studio lighting
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(8, 12, 8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-8, 4, -6);
    scene.add(rimLight);

    // Subtle ground grid
    const grid = new THREE.GridHelper(16, 16, 0x334155, 0x1e293b);
    grid.position.y = -1.6;
    scene.add(grid);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Dynamic objects updated per frame
    let pRing: THREE.Mesh | null = null;
    let sRing: THREE.Mesh | null = null;
    let stationNeedle: THREE.Mesh | null = null;
    let earthMesh: THREE.Mesh | null = null;
    let atmoShell: THREE.Mesh | null = null;
    let waterParticles: THREE.Points | null = null;
    let decayParticles: THREE.Points | null = null;

    if (moduleId === 'earth-seismic-waves') {
      // Stratified tectonic crust block
      const mantle = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.4, 5),
        new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85 })
      );
      mantle.position.y = -0.9;
      rootGroup.add(mantle);

      const crust = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.6, 5),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 })
      );
      crust.position.y = 0.1;
      rootGroup.add(crust);

      // Hypocenter focus glow
      const focus = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.9 })
      );
      focus.position.set(-2.2, -0.45, 0);
      rootGroup.add(focus);

      // P-Wave & S-Wave expanding seismic rings
      pRing = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.45, 32),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      pRing.rotation.x = -Math.PI / 2;
      pRing.position.set(-2.2, 0.43, 0);
      rootGroup.add(pRing);

      sRing = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.48, 32),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      sRing.rotation.x = -Math.PI / 2;
      sRing.position.set(-2.2, 0.45, 0);
      rootGroup.add(sRing);

      // Seismograph station beacon
      const station = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.3, roughness: 0.4 })
      );
      station.position.set(2.4, 0.62, 0);
      rootGroup.add(station);

      stationNeedle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.5 })
      );
      stationNeedle.position.set(2.4, 1.15, 0);
      rootGroup.add(stationNeedle);
    } else if (moduleId === 'earth-greenhouse-radiation') {
      earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 28, 28),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55, metalness: 0.1 })
      );
      rootGroup.add(earthMesh);

      atmoShell = new THREE.Mesh(
        new THREE.SphereGeometry(2.38, 24, 24),
        new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.25,
          roughness: 0.15,
          transmission: 0.3,
        })
      );
      rootGroup.add(atmoShell);

      // Incoming solar rays
      for (let i = -1; i <= 1; i++) {
        const ray = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 4.2, 8),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        ray.rotation.z = Math.PI / 2;
        ray.position.set(-4.3, i * 0.9, 0);
        rootGroup.add(ray);
      }
    } else if (moduleId === 'earth-hydrology-darcy') {
      // Porous aquifer tank
      const tank = new THREE.Mesh(
        new THREE.BoxGeometry(7, 2.4, 2.8),
        new THREE.MeshPhysicalMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.22,
          roughness: 0.1,
        })
      );
      rootGroup.add(tank);

      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 1.3, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 })
      );
      soil.position.y = -0.45;
      rootGroup.add(soil);

      const count = 120;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 6.4;
        positions[i * 3 + 1] = -0.9 + Math.random() * 1.1;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      waterParticles = new THREE.Points(
        geom,
        new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.12 })
      );
      rootGroup.add(waterParticles);
    } else {
      // Radioactive decay chamber + Geiger-Muller probe
      const sample = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.15, 1),
        new THREE.MeshStandardMaterial({
          color: 0x22c55e,
          emissive: 0x16a34a,
          emissiveIntensity: 0.7,
          roughness: 0.3,
        })
      );
      sample.position.set(-1.4, 0.2, 0);
      rootGroup.add(sample);

      const gmTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 2.4, 16),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 })
      );
      gmTube.rotation.z = Math.PI / 2;
      gmTube.position.set(2.0, 0.2, 0);
      rootGroup.add(gmTube);

      const count = 90;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = -1.4 + Math.random() * 3.4;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      decayParticles = new THREE.Points(
        geom,
        new THREE.PointsMaterial({ color: 0x4ade80, size: 0.11 })
      );
      rootGroup.add(decayParticles);
    }

    let rafId = 0;
    let simClock = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (isSimulatingRef.current) {
        simClock += dt;
      }

      if (pRing && sRing) {
        const pScale = 1 + ((simClock * 2.4) % 9.5);
        const sScale = 1 + ((simClock * 1.35) % 9.5);
        pRing.scale.set(pScale, pScale, 1);
        sRing.scale.set(sScale, sScale, 1);
      }
      if (stationNeedle) {
        const amp = Math.min(0.45, Math.abs(outputsRef.current.waveAmplitudeMm ?? 0) * 0.015);
        stationNeedle.rotation.z = Math.sin(simClock * 18) * (0.06 + amp);
      }
      if (earthMesh && atmoShell) {
        earthMesh.rotation.y += dt * 0.25;
        const co2 = paramsRef.current.co2Concentration ?? 420;
        const heatRatio = Math.max(0, Math.min(1, (co2 - 200) / 800));
        const mat = atmoShell.material as THREE.MeshPhysicalMaterial;
        mat.color.setRGB(0.22 + heatRatio * 0.72, 0.74 - heatRatio * 0.42, 0.97 - heatRatio * 0.75);
        mat.opacity = 0.2 + heatRatio * 0.35;
      }
      if (waterParticles) {
        const flux = Math.max(0.2, outputsRef.current.darcyFluxMPerDay ?? 1.0);
        const posAttr = waterParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          let x = posAttr.getX(i) + dt * Math.min(4, flux * 0.7);
          if (x > 3.2) x = -3.2;
          posAttr.setX(i, x);
        }
        posAttr.needsUpdate = true;
      }
      if (decayParticles) {
        const frac = Math.max(0.05, (outputsRef.current.remainingPercent ?? 50) / 100);
        const posAttr = decayParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          let x = posAttr.getX(i) + dt * (1.5 + frac * 2.5);
          if (x > 2.4) x = -1.4;
          posAttr.setX(i, x);
        }
        posAttr.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposeThreeSceneResources(scene, renderer);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [moduleId, liteDeviceMode]);

  return <div ref={mountRef} className="w-full h-full relative" data-testid="earth-science-3d-canvas" />;
};
