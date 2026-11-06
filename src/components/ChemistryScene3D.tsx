import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChemistryParams,
  ChemistryMetrics,
  ThermoReactionPreset,
  RedoxCouplePreset,
  calculateTitrationPh,
} from '../utils/scienceEngine';

interface ChemistryScene3DProps {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  preset: ThermoReactionPreset;
  redoxPreset: RedoxCouplePreset;
  reactionProgress: number;
  isReacting: boolean;
}

type CameraPreset = 'isometric' | 'front' | 'top' | 'closeup';

export const ChemistryScene3D: React.FC<ChemistryScene3DProps> = ({
  params,
  metrics,
  preset,
  redoxPreset,
  reactionProgress,
  isReacting,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const miniChartRef = useRef<HTMLCanvasElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [showMiniCurve, setShowMiniCurve] = useState(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');

  const latestRef = useRef({
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
  });
  latestRef.current = {
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
  } | null>(null);

  // Draw companion 2D quantitative curve in bottom-right PiP canvas
  useEffect(() => {
    const canvas = miniChartRef.current;
    if (!canvas || !showMiniCurve) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    const padL = 32;
    const padR = 14;
    const padT = 24;
    const padB = 22;
    const cw = w - padL - padR;
    const ch = h - padT - padB;

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + ch);
    ctx.lineTo(padL + cw, padT + ch);
    ctx.stroke();

    if (params.mode === 'thermo-calorimetry') {
      const isExo = metrics.deltaHReaction < 0;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `PROFIL ENTALPI (Ea = ${metrics.effectiveEa} kJ/mol)`,
        padL,
        15
      );

      const rY = isExo ? padT + ch * 0.42 : padT + ch * 0.76;
      const pY = isExo ? padT + ch * 0.8 : padT + ch * 0.34;
      const peakY = params.useCatalyst ? padT + ch * 0.25 : padT + ch * 0.12;

      ctx.strokeStyle = params.useCatalyst ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(padL + 6, rY);
      ctx.lineTo(padL + cw * 0.22, rY);
      ctx.bezierCurveTo(
        padL + cw * 0.34,
        rY,
        padL + cw * 0.38,
        peakY,
        padL + cw * 0.5,
        peakY
      );
      ctx.bezierCurveTo(
        padL + cw * 0.62,
        peakY,
        padL + cw * 0.66,
        pY,
        padL + cw * 0.78,
        pY
      );
      ctx.lineTo(padL + cw - 4, pY);
      ctx.stroke();

      const mx = padL + 6 + reactionProgress * (cw - 10);
      const my =
        reactionProgress < 0.22
          ? rY
          : reactionProgress > 0.78
          ? pY
          : peakY +
            Math.pow((reactionProgress - 0.5) / 0.28, 2) *
              ((reactionProgress < 0.5 ? rY : pY) - peakY);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `ΔH = ${metrics.deltaHReaction} kJ/mol | ξ = ${(reactionProgress * 100).toFixed(0)}%`,
        padL + 4,
        h - 6
      );
    } else if (params.mode === 'acid-base-titration') {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `KURVA TITRASI pH (V_eq = ${metrics.equivalenceVolumeMl} mL)`,
        padL,
        15
      );

      const ph7Y = padT + ch - (7 / 14) * ch;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, ph7Y);
      ctx.lineTo(padL + cw, ph7Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v <= 50; v += 1) {
        const ph = calculateTitrationPh(
          params.analyteAcidConc,
          params.analyteVolumeMl,
          params.titrantBaseConc,
          v,
          params.acidPka
        );
        const px = padL + (v / 50) * cw;
        const py = padT + ch - (ph / 14) * ch;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const cx = padL + (Math.min(50, params.titrantAddedMl) / 50) * cw;
      const cy = padT + ch - (metrics.currentPh / 14) * ch;
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `V_NaOH = ${params.titrantAddedMl} mL → pH = ${metrics.currentPh}`,
        padL + 4,
        h - 6
      );
    } else {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(`PERSAMAAN NERNST SEL GALVANI`, padL, 15);

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const logQ = -3 + (i / 40) * 6;
        const eVal =
          metrics.standardCellPotentialE0 -
          (0.0257 / redoxPreset.electronsTransferred) * logQ * 2.303;
        const px = padL + (i / 40) * cw;
        const py =
          padT +
          ch -
          Math.max(0.05, Math.min(0.95, (eVal - (metrics.standardCellPotentialE0 - 0.15)) / 0.3)) *
            ch;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `E_sel = +${metrics.nernstCellPotentialE} V`,
        padL + 12,
        padT + 22
      );
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Q = ${metrics.reactionQuotientQ} | ΔG = ${metrics.electroFreeEnergyDeltaG} kJ/mol`,
        padL + 4,
        h - 6
      );
    }
  }, [params, metrics, reactionProgress, redoxPreset, showMiniCurve]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRenderer);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.02);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 4;
    controls.maxDistance = 28;

    const applyCameraPreset = (presetName: CameraPreset) => {
      if (presetName === 'isometric') {
        camera.position.set(4.2, 5.2, 10.2);
        controls.target.set(0, 2.2, 0);
      } else if (presetName === 'front') {
        camera.position.set(0, 2.6, 11.2);
        controls.target.set(0, 2.3, 0);
      } else if (presetName === 'top') {
        camera.position.set(0, 13.5, 0.8);
        controls.target.set(0, 1.5, 0);
      } else {
        camera.position.set(1.5, 2.8, 6.4);
        controls.target.set(0, 2.0, 0);
      }
      controls.update();
    };
    cameraCtrlRef.current = { setPreset: applyCameraPreset };
    applyCameraPreset('isometric');

    // Studio Lighting
    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.7));
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = !isSoftwareGl;
    scene.add(keyLight);

    const coolRim = new THREE.DirectionalLight(0x38bdf8, 1.2);
    coolRim.position.set(-7, 5, -6);
    scene.add(coolRim);

    // Lab Bench Surface & Grid
    const bench = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 45),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.8,
        metalness: 0.12,
      })
    );
    bench.rotation.x = -Math.PI / 2;
    bench.receiveShadow = true;
    scene.add(bench);

    const grid = new THREE.GridHelper(26, 26, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Shared Laboratory Glass & Metal Materials
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: isSoftwareGl ? 0.32 : 0.95,
      transmission: isSoftwareGl ? 0 : 0.88,
      roughness: 0.08,
      ior: 1.47,
      thickness: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.22,
    });
    const darkBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.4,
    });

    // =========================================================
    // 1. THERMO CALORIMETRY 3D GROUP
    // =========================================================
    const thermoGroup = new THREE.Group();
    scene.add(thermoGroup);

    // Hotplate / Magnetic Stirrer Base
    const stirrerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 0.45, 32),
      darkBaseMat
    );
    stirrerBase.position.set(0, 0.225, 0);
    thermoGroup.add(stirrerBase);

    const topPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 1.95, 0.08, 32),
      steelMat
    );
    topPlate.position.set(0, 0.48, 0);
    thermoGroup.add(topPlate);

    // 3D Calorimeter Glass Beaker (open cylinder + bottom disc + top lip torus)
    const beakerWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.65, 3.4, 36, 1, true),
      glassMat
    );
    beakerWall.position.set(0, 2.22, 0);
    thermoGroup.add(beakerWall);

    const beakerLip = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.055, 12, 36),
      glassMat
    );
    beakerLip.rotation.x = Math.PI / 2;
    beakerLip.position.set(0, 3.92, 0);
    thermoGroup.add(beakerLip);

    // Inner Calorimeter Solution Cylinder
    const thermoLiquidMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.68,
      roughness: 0.18,
      metalness: 0.05,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18,
    });
    const thermoLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(1.56, 1.56, 2.3, 32),
      thermoLiquidMat
    );
    thermoLiquid.position.set(0, 1.68, 0);
    thermoGroup.add(thermoLiquid);

    // Rotating Magnetic Stir Bar Capsule at bottom of beaker
    const stirBar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.65, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
    );
    stirBar.rotation.z = Math.PI / 2;
    stirBar.position.set(0, 0.66, 0);
    thermoGroup.add(stirBar);

    // 3D Glass Thermometer with Dynamic Mercury Column
    const thermometerGroup = new THREE.Group();
    thermometerGroup.position.set(0.95, 2.8, 0.4);
    thermoGroup.add(thermometerGroup);

    const thermoGlassStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 3.4, 16),
      glassMat
    );
    thermometerGroup.add(thermoGlassStem);

    const mercuryBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.35,
      })
    );
    mercuryBulb.position.set(0, -1.7, 0);
    thermometerGroup.add(mercuryBulb);

    const mercuryColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 12),
      mercuryBulb.material
    );
    thermometerGroup.add(mercuryColumn);

    // 3D Ball-and-Stick Molecule Showcase hovering above Beaker
    const moleculeShowGroup = new THREE.Group();
    moleculeShowGroup.position.set(0, 4.75, 0);
    thermoGroup.add(moleculeShowGroup);

    const centralAtom = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    moleculeShowGroup.add(centralAtom);

    const ligandOffsets = [
      new THREE.Vector3(0.75, 0.45, 0),
      new THREE.Vector3(-0.75, 0.45, 0),
      new THREE.Vector3(0, -0.65, 0.6),
      new THREE.Vector3(0, -0.65, -0.6),
    ];
    ligandOffsets.forEach((off) => {
      const atom = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 18, 18),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 })
      );
      atom.position.copy(off);
      moleculeShowGroup.add(atom);

      const bondLen = off.length();
      const bond = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, bondLen, 10),
        steelMat
      );
      bond.position.copy(off.clone().multiplyScalar(0.5));
      bond.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        off.clone().normalize()
      );
      moleculeShowGroup.add(bond);
    });

    // InstancedMesh 3D Reacting Particles inside Calorimeter Solution
    const PARTICLE_COUNT = 36;
    const partGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const partMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.15,
    });
    const instancedParticles = new THREE.InstancedMesh(
      partGeo,
      partMat,
      PARTICLE_COUNT
    );
    thermoGroup.add(instancedParticles);

    const particleSeeds = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i * 2.39996) % (Math.PI * 2),
      radius: 0.25 + ((i * 17) % 100) / 100,
      yBase: 0.85 + ((i * 31) % 100) / 100 * 1.7,
      speed: 0.8 + (i % 5) * 0.25,
    }));

    // =========================================================
    // 2. ACID-BASE TITRATION 3D GROUP
    // =========================================================
    const titrationGroup = new THREE.Group();
    scene.add(titrationGroup);

    // Retort Stand Base & Vertical Rod
    const retortBase = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.24, 2.8),
      darkBaseMat
    );
    retortBase.position.set(-0.4, 0.12, 0);
    titrationGroup.add(retortBase);

    const retortRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 7.2, 16),
      steelMat
    );
    retortRod.position.set(-1.75, 3.6, 0);
    titrationGroup.add(retortRod);

    const clampArm = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.14, 0.22),
      steelMat
    );
    clampArm.position.set(-0.85, 5.4, 0);
    titrationGroup.add(clampArm);

    // Vertical Glass Burette
    const buretteTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 3.5, 24, 1, true),
      glassMat
    );
    buretteTube.position.set(0, 5.2, 0);
    titrationGroup.add(buretteTube);

    const buretteLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 3.0, 20),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
      })
    );
    buretteLiquid.position.set(0, 5.0, 0);
    titrationGroup.add(buretteLiquid);

    // Stopcock Valve
    const stopcock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.55, 14),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
    );
    stopcock.rotation.x = Math.PI / 2;
    stopcock.position.set(0, 3.35, 0);
    titrationGroup.add(stopcock);

    // Falling Droplet Sphere
    const dropletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.4,
      })
    );
    titrationGroup.add(dropletMesh);

    // 3D Conical Erlenmeyer Flask (Cone body + cylindrical neck)
    const flaskCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 1.48, 2.0, 32, 1, true),
      glassMat
    );
    flaskCone.position.set(0, 1.25, 0);
    titrationGroup.add(flaskCone);

    const flaskNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.75, 28, 1, true),
      glassMat
    );
    flaskNeck.position.set(0, 2.62, 0);
    titrationGroup.add(flaskNeck);

    const flaskRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.045, 10, 28),
      glassMat
    );
    flaskRim.rotation.x = Math.PI / 2;
    flaskRim.position.set(0, 3.0, 0);
    titrationGroup.add(flaskRim);

    const analyteLiquidMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.76,
      roughness: 0.15,
      emissive: 0xf472b6,
      emissiveIntensity: 0.18,
    });
    const analyteLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.42, 1.15, 32),
      analyteLiquidMat
    );
    analyteLiquid.position.set(0, 0.84, 0);
    titrationGroup.add(analyteLiquid);

    // =========================================================
    // 3. ELECTROCHEMISTRY GALVANI CELL 3D GROUP
    // =========================================================
    const electroGroup = new THREE.Group();
    scene.add(electroGroup);

    const anodeBeaker = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 2.8, 32, 1, true),
      glassMat
    );
    anodeBeaker.position.set(-2.4, 1.45, 0);
    electroGroup.add(anodeBeaker);

    const cathodeBeaker = anodeBeaker.clone();
    cathodeBeaker.position.set(2.4, 1.45, 0);
    electroGroup.add(cathodeBeaker);

    const anodeLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.38, 2.1, 28),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.2,
      })
    );
    anodeLiquid.position.set(-2.4, 1.1, 0);
    electroGroup.add(anodeLiquid);

    const cathodeLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.38, 2.1, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.62,
        roughness: 0.2,
      })
    );
    cathodeLiquid.position.set(2.4, 1.1, 0);
    electroGroup.add(cathodeLiquid);

    // Anode Plate (Zinc/Metal) & Cathode Plate (Copper/Silver)
    const anodePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 2.6, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.85,
        roughness: 0.25,
      })
    );
    anodePlate.position.set(-2.85, 2.0, 0);
    electroGroup.add(anodePlate);

    const cathodePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 2.6, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.22,
      })
    );
    cathodePlate.position.set(2.85, 2.0, 0);
    electroGroup.add(cathodePlate);

    // 3D U-Shaped Glass Salt Bridge connecting Half-Cells
    const saltBridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.55, 1.2, 0),
      new THREE.Vector3(-1.55, 3.25, 0),
      new THREE.Vector3(0, 3.65, 0),
      new THREE.Vector3(1.55, 3.25, 0),
      new THREE.Vector3(1.55, 1.2, 0),
    ]);
    const saltBridgeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(saltBridgeCurve, 32, 0.22, 16, false),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.65,
        roughness: 0.2,
      })
    );
    electroGroup.add(saltBridgeMesh);

    // Overhead Wire Arch + Digital Voltmeter 3D Housing
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.85, 3.3, 0),
      new THREE.Vector3(-2.85, 4.9, 0),
      new THREE.Vector3(0, 5.1, 0),
      new THREE.Vector3(2.85, 4.9, 0),
      new THREE.Vector3(2.85, 3.3, 0),
    ]);
    const wireTube = new THREE.Mesh(
      new THREE.TubeGeometry(wireCurve, 36, 0.045, 10, false),
      steelMat
    );
    electroGroup.add(wireTube);

    const voltmeterBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.95, 0.55),
      darkBaseMat
    );
    voltmeterBox.position.set(0, 5.05, 0);
    electroGroup.add(voltmeterBox);

    const voltmeterScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.65),
      new THREE.MeshBasicMaterial({ color: 0x064e3b })
    );
    voltmeterScreen.position.set(0, 5.05, 0.285);
    electroGroup.add(voltmeterScreen);

    // Animated Glowing Electrons Flowing Along Wire Arch
    const ELECTRON_COUNT = 10;
    const electronSpheres: THREE.Mesh[] = [];
    const electronGeo = new THREE.SphereGeometry(0.11, 14, 14);
    const electronMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
    });
    for (let i = 0; i < ELECTRON_COUNT; i++) {
      const el = new THREE.Mesh(electronGeo, electronMat);
      electronSpheres.push(el);
      electroGroup.add(el);
    }

    // =========================================================
    // ANIMATION LOOP WITH SOFTWARE-GL FENCE PACING
    // =========================================================
    let disposed = false;
    let rafId = 0;
    const dummy = new THREE.Object3D();
    const colorTmp = new THREE.Color();

    function afterDraw(cb: () => void) {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        if (!sync) {
          setTimeout(cb, 80);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (
          status === gl.ALREADY_SIGNALED ||
          status === gl.CONDITION_SATISFIED
        ) {
          gl.deleteSync(sync);
          setTimeout(cb, 80);
        } else {
          setTimeout(poll, 16);
        }
      };
      setTimeout(poll, 16);
    }

    const startTime = performance.now();

    const tick = () => {
      if (disposed) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const {
        params: p,
        metrics: m,
        reactionProgress: prog,
        isReacting: reacting,
      } = latestRef.current;

      thermoGroup.visible = p.mode === 'thermo-calorimetry';
      titrationGroup.visible = p.mode === 'acid-base-titration';
      electroGroup.visible = p.mode === 'electrochemistry-cell';

      if (p.mode === 'thermo-calorimetry') {
        const isExo = m.deltaHReaction < 0;
        const targetColor = isExo
          ? new THREE.Color(0xf43f5e).lerp(new THREE.Color(0x10b981), prog)
          : new THREE.Color(0xf59e0b).lerp(new THREE.Color(0x38bdf8), prog);
        thermoLiquidMat.color.copy(targetColor);
        thermoLiquidMat.emissive.copy(targetColor);

        const volScale = Math.max(
          0.55,
          Math.min(1.15, p.solutionVolumeMl / 300)
        );
        thermoLiquid.scale.set(1, volScale, 1);
        thermoLiquid.position.y = 0.55 + 1.15 * volScale;

        // Rotate magnetic stir bar & hovering 3D molecule
        stirBar.rotation.y = elapsed * (reacting ? 12 : 4);
        moleculeShowGroup.rotation.y = elapsed * 0.85;
        moleculeShowGroup.position.y = 4.75 + Math.sin(elapsed * 2.2) * 0.12;

        // Update thermometer mercury height
        const curTemp = p.initialTempC + m.deltaTempC * prog;
        const mercH = Math.max(0.4, Math.min(2.8, (curTemp + 20) / 65));
        mercuryColumn.scale.set(1, mercH, 1);
        mercuryColumn.position.set(0, -1.6 + mercH / 2, 0);

        // Update InstancedMesh 3D molecules inside beaker
        const thermalSpeed = Math.max(0.6, (curTemp + 273.15) / 298.15);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const seed = particleSeeds[i];
          const ang = seed.angle + elapsed * seed.speed * thermalSpeed;
          const rad = seed.radius * 1.25;
          const py =
            0.75 +
            ((seed.yBase + elapsed * seed.speed * 0.45 * thermalSpeed) %
              (1.9 * volScale));
          dummy.position.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
          const converted = i / PARTICLE_COUNT < prog;
          dummy.scale.setScalar(converted ? 1.15 : 0.9);
          dummy.updateMatrix();
          instancedParticles.setMatrixAt(i, dummy.matrix);

          colorTmp.setHex(
            converted ? (isExo ? 0x10b981 : 0x38bdf8) : 0xfbbf24
          );
          instancedParticles.setColorAt(i, colorTmp);
        }
        instancedParticles.instanceMatrix.needsUpdate = true;
        if (instancedParticles.instanceColor) {
          instancedParticles.instanceColor.needsUpdate = true;
        }
      } else if (p.mode === 'acid-base-titration') {
        // Update Burette level and Erlenmeyer indicator color
        const bFrac = Math.max(0.12, 1 - p.titrantAddedMl / 55);
        buretteLiquid.scale.set(1, bFrac, 1);
        buretteLiquid.position.y = 3.55 + 1.5 * bFrac;

        analyteLiquidMat.color.set(m.indicatorColorHex);
        analyteLiquidMat.emissive.set(m.indicatorColorHex);
        const flaskScaleY = Math.min(
          1.35,
          0.85 + (p.titrantAddedMl / 50) * 0.45
        );
        analyteLiquid.scale.set(1, flaskScaleY, 1);
        analyteLiquid.position.y = 0.3 + 0.56 * flaskScaleY;

        // Falling droplet animation
        const dropCycle = (elapsed * (reacting ? 3.8 : 1.4)) % 1;
        dropletMesh.position.set(0, 3.25 - dropCycle * 1.85, 0);
      } else if (p.mode === 'electrochemistry-cell') {
        const eSpeed = Math.max(0.3, m.nernstCellPotentialE * 0.65);
        electronSpheres.forEach((el, idx) => {
          const u = ((idx / ELECTRON_COUNT) + elapsed * eSpeed * 0.35) % 1;
          const pt = wireCurve.getPointAt(u);
          el.position.copy(pt);
        });
      }

      controls.update();
      renderer.render(scene, camera);
      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 760;
      const h = container.clientHeight || 380;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectCameraPreset = (presetName: CameraPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#0B1120]">
      <div
        ref={mountRef}
        data-testid="chemistry-simulation-canvas"
        className="w-full h-[340px] sm:h-[380px] block cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left 3D Chemistry Status Badge */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-slate-700 bg-[#0F172A] px-3 py-2 text-xs shadow-md">
        <div className="font-mono text-[11px] font-semibold text-emerald-400">
          {params.mode === 'thermo-calorimetry'
            ? `KALORIMETER 3D · T = ${(params.initialTempC + metrics.deltaTempC * reactionProgress).toFixed(1)} °C`
            : params.mode === 'acid-base-titration'
            ? `BURET & ERLENMEYER 3D · pH = ${metrics.currentPh}`
            : `SEL GALVANI 3D · E_sel = +${metrics.nernstCellPotentialE} V`}
        </div>
        <div className="mt-0.5 font-mono text-xs font-semibold text-slate-100">
          {params.mode === 'thermo-calorimetry'
            ? `${preset.equation}`
            : params.mode === 'acid-base-titration'
            ? `Indikator: ${metrics.indicatorColorName}`
            : `${redoxPreset.anodeHalf} || ${redoxPreset.cathodeHalf}`}
        </div>
      </div>

      {/* Bottom-Right Companion 2D Quantitative Curve PiP */}
      {showMiniCurve && !hudCollapsed && (
        <div className="pointer-events-none absolute top-3 right-3 hidden md:block overflow-hidden rounded-md border border-slate-700 bg-[#0F172A] shadow-lg">
          <canvas
            ref={miniChartRef}
            width={255}
            height={128}
            className="block"
          />
        </div>
      )}

      {/* Collapsible Bottom 3D Camera & Curve Dock */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        {!hudCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 shadow-lg">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">
              Kamera 3D:
            </span>
            {(
              [
                { id: 'isometric', label: 'Isometrik 3D' },
                { id: 'front', label: 'Tampak Depan' },
                { id: 'top', label: 'Tampak Atas' },
                { id: 'closeup', label: 'Fokus Bejana' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectCameraPreset(p.id)}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                  activePreset === p.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowMiniCurve((s) => !s)}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                showMiniCurve
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {showMiniCurve ? 'Kurva 2D: Aktif' : 'Kurva 2D: Nonaktif'}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="rounded border border-slate-700 bg-[#0F172A] px-2.5 py-0.5 text-[10px] font-mono text-slate-300 hover:text-white shadow"
        >
          {hudCollapsed ? '▴ Tampilkan Kontrol Kamera 3D' : '▾ Sembunyikan HUD'}
        </button>
      </div>
    </div>
  );
};
