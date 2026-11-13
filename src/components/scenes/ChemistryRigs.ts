import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ChemistryParams, ChemistryMetrics } from '../../utils/scienceEngine';
import { createInstancedParticlePool } from '../../utils/threeStudioKit';
import {
  computeArrheniusKineticsState,
  computeBeerLambertBeamState,
  computeGasPistonVisualState,
} from '../../utils/chemistryVisualHelpers';
import { labSound } from '../../utils/soundEngine';

export interface ChemistryRigsMaterials {
  sharedBeakerGeo: THREE.LatheGeometry;
  flaskGeo: THREE.LatheGeometry;
  glassMat: THREE.Material;
  brushedSteelMat: THREE.Material;
  brassMat: THREE.Material;
  darkFrameMat: THREE.Material;
  beakerScaleTex: THREE.CanvasTexture | null;
  graduationOverlayMat: (tex: THREE.CanvasTexture | null) => THREE.MeshBasicMaterial;
  createLiquidWobbleMaterial: (initialHex: number, initialOpacity?: number) => THREE.ShaderMaterial;
  liquidShaderMaterials: THREE.ShaderMaterial[];
}

export interface ChemistryRigUpdateContext {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  simTime: number;
  isLite: boolean;
  reacting: boolean;
  isSimTimeAdvancing: boolean;
}

export interface ChemistrySpecialRigsHandle {
  redoxGroup: THREE.Group;
  gasGroup: THREE.Group;
  kineticsGroup: THREE.Group;
  spectroGroup: THREE.Group;
  pistonHead: THREE.Mesh;
  update: (ctx: ChemistryRigUpdateContext) => void;
}

export function buildChemistrySpecialRigs(
  scene: THREE.Scene,
  mats: ChemistryRigsMaterials
): ChemistrySpecialRigsHandle {
  const {
    sharedBeakerGeo,
    flaskGeo,
    glassMat,
    brushedSteelMat,
    brassMat,
    darkFrameMat,
    beakerScaleTex,
    graduationOverlayMat,
    createLiquidWobbleMaterial,
    liquidShaderMaterials,
  } = mats;

  // =========================================================
  // 3. ELECTROCHEMISTRY GALVANIC CELL 3D GROUP
  // =========================================================
  const redoxGroup = new THREE.Group();
  scene.add(redoxGroup);

  const beakerLeft = new THREE.Mesh(sharedBeakerGeo, glassMat);
  beakerLeft.position.set(-1.8, 0.29, 0);
  beakerLeft.castShadow = true;
  if (beakerScaleTex) {
    const beakerLeftScale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.926, 0.926, 1.5, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    beakerLeftScale.position.set(-1.8, 1.15, 0);
    beakerLeftScale.rotation.y = -Math.PI * 0.4;
    redoxGroup.add(beakerLeftScale);
  }
  const anodeLiquidMat = createLiquidWobbleMaterial(0x94a3b8, 0.72);
  liquidShaderMaterials.push(anodeLiquidMat);
  const anodeLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 1.25, 32, 12),
    anodeLiquidMat
  );
  anodeLiquid.position.set(-1.8, 0.96, 0);
  const anodeElectrode = new THREE.Mesh(
    new RoundedBoxGeometry(0.28, 2.0, 0.09, 2, 0.015),
    brushedSteelMat
  );
  anodeElectrode.position.set(-1.8, 1.4, 0);
  anodeElectrode.castShadow = true;
  anodeElectrode.userData = {
    draggableParam: 'anodeConcM',
    min: 0.01,
    max: 2.0,
    step: 0.05,
    label: '[Anoda]',
  };
  redoxGroup.add(beakerLeft, anodeLiquid, anodeElectrode);

  const beakerRight = new THREE.Mesh(sharedBeakerGeo, glassMat);
  beakerRight.position.set(1.8, 0.29, 0);
  beakerRight.castShadow = true;
  if (beakerScaleTex) {
    const beakerRightScale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.926, 0.926, 1.5, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    beakerRightScale.position.set(1.8, 1.15, 0);
    beakerRightScale.rotation.y = -Math.PI * 0.4;
    redoxGroup.add(beakerRightScale);
  }
  const cathodeLiquidMat = createLiquidWobbleMaterial(0x0284c7, 0.76);
  liquidShaderMaterials.push(cathodeLiquidMat);
  const cathodeLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 1.25, 32, 12),
    cathodeLiquidMat
  );
  cathodeLiquid.position.set(1.8, 0.96, 0);
  const cathodeElectrode = new THREE.Mesh(
    new RoundedBoxGeometry(0.28, 2.0, 0.09, 2, 0.015),
    brassMat
  );
  cathodeElectrode.position.set(1.8, 1.4, 0);
  cathodeElectrode.castShadow = true;
  cathodeElectrode.userData = {
    draggableParam: 'cathodeConcM',
    min: 0.01,
    max: 2.0,
    step: 0.05,
    label: '[Katoda]',
  };
  redoxGroup.add(beakerRight, cathodeLiquid, cathodeElectrode);

  // Electrode oxidation/reduction reaction rings at liquid surface
  const anodeGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const anodeGlowRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.46, 24), anodeGlowMat);
  anodeGlowRing.rotation.x = -Math.PI / 2;
  anodeGlowRing.position.set(-1.8, 1.59, 0);
  redoxGroup.add(anodeGlowRing);

  const cathodeGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const cathodeGlowRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.46, 24), cathodeGlowMat);
  cathodeGlowRing.rotation.x = -Math.PI / 2;
  cathodeGlowRing.position.set(1.8, 1.59, 0);
  redoxGroup.add(cathodeGlowRing);

  // Salt Bridge U-Tube
  const saltBridge = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.12, 14, 36, Math.PI),
    glassMat
  );
  saltBridge.position.set(0, 1.6, 0);
  saltBridge.castShadow = true;
  redoxGroup.add(saltBridge);

  // Salt Bridge Migrating Ions (K+ cations moving right to cathode, NO3- anions moving left to anode)
  const saltIonGeo = new THREE.SphereGeometry(0.045, 10, 10);
  const cationMat = new THREE.MeshBasicMaterial({ color: 0xc084fc }); // K+
  const anionMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee }); // NO3-
  const cationMeshes: THREE.Mesh[] = [];
  const anionMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const cMesh = new THREE.Mesh(saltIonGeo, cationMat);
    const aMesh = new THREE.Mesh(saltIonGeo, anionMat);
    redoxGroup.add(cMesh, aMesh);
    cationMeshes.push(cMesh);
    anionMeshes.push(aMesh);
  }

  // Digital Voltmeter Housing
  const voltMeter = new THREE.Mesh(
    new RoundedBoxGeometry(1.65, 1.0, 0.82, 3, 0.05),
    darkFrameMat
  );
  voltMeter.position.set(0, 2.8, -1.2);
  voltMeter.castShadow = true;
  redoxGroup.add(voltMeter);

  // =========================================================
  // 4. IDEAL GAS & BOYLE COMPRESSION 3D GROUP
  // =========================================================
  const gasGroup = new THREE.Group();
  scene.add(gasGroup);

  const gasCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 4.4, 32, 1, true),
    glassMat
  );
  gasCylinder.position.set(0, 2.5, 0);
  gasCylinder.castShadow = true;
  gasGroup.add(gasCylinder);

  const gasCylBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.25, 32), darkFrameMat);
  gasCylBase.position.set(0, 0.4, 0);
  gasCylBase.castShadow = true;
  gasCylBase.receiveShadow = true;
  gasGroup.add(gasCylBase);

  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(1.58, 1.58, 0.35, 32),
    brushedSteelMat
  );
  pistonHead.position.set(0, 3.2, 0);
  pistonHead.castShadow = true;
  pistonHead.userData = {
    draggableParam: 'gasVolumeL',
    min: 2.0,
    max: 25.0,
    step: 0.5,
    label: 'Volume Gas V (L)',
  };
  gasGroup.add(pistonHead);

  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16),
    brushedSteelMat
  );
  pistonRod.position.set(0, 4.4, 0);
  pistonRod.castShadow = true;
  gasGroup.add(pistonRod);

  const pressureDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.2, 28),
    brassMat
  );
  pressureDial.rotation.x = Math.PI / 2;
  pressureDial.position.set(2.2, 2.6, 0);
  pressureDial.castShadow = true;
  gasGroup.add(pressureDial);

  const pressureNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.5, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  pressureNeedle.position.set(2.2, 2.6, 0.12);
  gasGroup.add(pressureNeedle);

  const GAS_PARTICLES_MAX = 48;
  const gasParticleStates: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = [];
  const gasPartGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const gasPartMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const gasPool = createInstancedParticlePool(
    GAS_PARTICLES_MAX,
    gasPartGeo,
    gasPartMat,
    gasGroup
  );
  for (let i = 0; i < GAS_PARTICLES_MAX; i++) {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      0.6 + Math.random() * 2.2,
      (Math.random() - 0.5) * 2.2
    );
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    gasParticleStates.push({ pos, vel });
    gasPool.setTransform(i, pos.x, pos.y, pos.z, 1);
  }
  gasPool.commit(GAS_PARTICLES_MAX);

  // =========================================================
  // 5. REACTION KINETICS & ARRHENIUS 3D GROUP
  // =========================================================
  const kineticsGroup = new THREE.Group();
  scene.add(kineticsGroup);

  const hotplateBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 3.6), darkFrameMat);
  hotplateBase.position.set(0, 0.68, 0);
  hotplateBase.castShadow = true;
  hotplateBase.receiveShadow = true;
  hotplateBase.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  kineticsGroup.add(hotplateBase);

  const hotplateCeramicTopMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.15,
    emissive: 0xf97316,
    emissiveIntensity: 0.25,
  });
  const hotplateCeramicTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32),
    hotplateCeramicTopMat
  );
  hotplateCeramicTop.position.set(0, 1.12, 0);
  hotplateCeramicTop.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  kineticsGroup.add(hotplateCeramicTop);

  const heaterLight = new THREE.PointLight(0xf97316, 0.8, 3.0);
  heaterLight.position.set(0, 1.35, 0);
  kineticsGroup.add(heaterLight);

  const heaterRingMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0xf97316,
    emissiveIntensity: 0.6,
  });
  const heaterFlameRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.05, 12, 32),
    heaterRingMat
  );
  heaterFlameRing.rotation.x = Math.PI / 2;
  heaterFlameRing.position.set(0, 1.17, 0);
  kineticsGroup.add(heaterFlameRing);

  const tempKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 16), brassMat);
  tempKnob.rotation.x = Math.PI / 2;
  tempKnob.position.set(0, 0.68, 1.85);
  tempKnob.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  kineticsGroup.add(tempKnob);

  const kFlask = new THREE.Mesh(flaskGeo, glassMat);
  kFlask.position.set(0, 1.18, 0);
  kFlask.castShadow = true;
  kineticsGroup.add(kFlask);

  const kLiquidMat = createLiquidWobbleMaterial(0xfef08a, 0.8);
  liquidShaderMaterials.push(kLiquidMat);
  const kLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 1.32, 1.0, 32, 16),
    kLiquidMat
  );
  kLiquid.position.set(0, 1.7, 0);
  kineticsGroup.add(kLiquid);

  // Swirling convection vortex ring on top of solution
  const vortexMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const vortexRing = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.58, 28), vortexMat);
  vortexRing.rotation.x = -Math.PI / 2;
  vortexRing.position.set(0, 2.21, 0);
  kineticsGroup.add(vortexRing);

  const stirBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  stirBar.rotation.z = Math.PI / 2;
  stirBar.position.set(0, 1.25, 0);
  kineticsGroup.add(stirBar);

  // =========================================================
  // 6. SPECTROPHOTOMETRY UV-VIS (BEER'S LAW) 3D GROUP
  // =========================================================
  const spectroGroup = new THREE.Group();
  scene.add(spectroGroup);

  const spectroChassis = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 4.8), darkFrameMat);
  spectroChassis.position.set(0, 1.38, 0);
  spectroChassis.castShadow = true;
  spectroChassis.receiveShadow = true;
  spectroGroup.add(spectroChassis);

  const spectroLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.2), brushedSteelMat);
  spectroLid.position.set(-0.8, 2.55, 0.4);
  spectroLid.castShadow = true;
  spectroGroup.add(spectroLid);

  // Monochromator dispersion prism before cuvette
  const monoPrism = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.72, 3),
    glassMat
  );
  monoPrism.position.set(-2.05, 2.8, 0.4);
  spectroGroup.add(monoPrism);

  const cuvette = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.65), glassMat);
  cuvette.position.set(-0.8, 2.8, 0.4);
  cuvette.castShadow = true;
  spectroGroup.add(cuvette);

  const analyteSolutionCuvette = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 1.6, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xd946ef, transparent: true, opacity: 0.75 })
  );
  analyteSolutionCuvette.position.set(-0.8, 2.8, 0.4);
  analyteSolutionCuvette.userData = {
    draggableParam: 'spectroConcMm',
    min: 0.01,
    max: 0.25,
    step: 0.01,
    label: 'Konsentrasi c (mM)',
  };
  spectroGroup.add(analyteSolutionCuvette);

  // Split beam: Incident beam (full brightness) & Transmitted beam (attenuated by Beer-Lambert 10^-A)
  const incidentBeamMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.85,
  });
  const incidentBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.85, 12),
    incidentBeamMat
  );
  incidentBeam.rotation.z = Math.PI / 2;
  incidentBeam.position.set(-1.75, 2.8, 0.4);
  spectroGroup.add(incidentBeam);

  const transmittedBeamMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.5,
  });
  const transmittedBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1.85, 12),
    transmittedBeamMat
  );
  transmittedBeam.rotation.z = Math.PI / 2;
  transmittedBeam.position.set(0.15, 2.8, 0.4);
  spectroGroup.add(transmittedBeam);

  const update = (ctx: ChemistryRigUpdateContext) => {
    const { params: p, metrics: m, simTime: t, isLite, reacting, isSimTimeAdvancing } = ctx;

    const isRedox =
      p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
    redoxGroup.visible = isRedox;
    gasGroup.visible = p.mode === 'ideal-gas-boyle';
    kineticsGroup.visible = p.mode === 'reaction-kinetics-arrhenius';
    spectroGroup.visible = p.mode === 'spectrophotometry-beer';

    if (isRedox) {
      const eCell = Math.max(0.15, Math.abs(m.nernstCellPotentialE ?? 1.1));
      // Migrate K+ cations toward right beaker (cathode) and NO3- anions toward left beaker (anode)
      cationMeshes.forEach((cMesh, idx) => {
        const u = ((t * 0.25 * eCell) + idx / cationMeshes.length) % 1.0;
        const angle = Math.PI * (1 - u); // pi (left) -> 0 (right)
        cMesh.position.set(1.8 * Math.cos(angle), 1.6 + 1.8 * Math.sin(angle), 0.03);
      });
      anionMeshes.forEach((aMesh, idx) => {
        const u = ((t * 0.25 * eCell) + idx / anionMeshes.length) % 1.0;
        const angle = Math.PI * u; // 0 (right) -> pi (left)
        aMesh.position.set(1.8 * Math.cos(angle), 1.6 + 1.8 * Math.sin(angle), -0.03);
      });
      const pulse = 0.28 + 0.18 * Math.sin(t * 4.2);
      anodeGlowMat.opacity = pulse;
      cathodeGlowMat.opacity = pulse;
      anodeGlowRing.scale.setScalar(0.95 + 0.1 * Math.sin(t * 3.6));
      cathodeGlowRing.scale.setScalar(0.95 + 0.1 * Math.cos(t * 3.6));
    } else if (p.mode === 'ideal-gas-boyle') {
      const gasState = computeGasPistonVisualState(
        p.gasVolumeL ?? 10.0,
        p.gasTemperatureK ?? 300
      );
      pistonHead.position.y = gasState.pistonY;
      pistonRod.position.y = gasState.rodY;

      const pAtm = m.gasPressureAtm ?? 1.0;
      const needleAngle = Math.max(-1.4, Math.min(1.4, (pAtm / 5.0) * Math.PI - Math.PI / 2));
      pressureNeedle.rotation.z = -needleAngle;

      const activeGasCount = isLite ? 24 : GAS_PARTICLES_MAX;
      for (let idx = 0; idx < activeGasCount; idx++) {
        const part = gasParticleStates[idx];
        part.pos.addScaledVector(part.vel, gasState.particleSpeed);
        if (part.pos.y > gasState.pistonY - 0.2 || part.pos.y < 0.6) {
          part.vel.y *= -1;
          part.pos.y = Math.max(0.6, Math.min(gasState.pistonY - 0.2, part.pos.y));
        }
        if (Math.abs(part.pos.x) > 1.2) {
          part.vel.x *= -1;
          part.pos.x = Math.sign(part.pos.x) * 1.2;
        }
        if (Math.abs(part.pos.z) > 1.2) {
          part.vel.z *= -1;
          part.pos.z = Math.sign(part.pos.z) * 1.2;
        }
        gasPool.setTransform(idx, part.pos.x, part.pos.y, part.pos.z, 1);
        gasPool.setColor(idx, gasState.gasColorHex);
      }
      gasPool.commit(activeGasCount);
    } else if (p.mode === 'reaction-kinetics-arrhenius') {
      const tempC = p.kineticsTempC ?? 25;
      const kinState = computeArrheniusKineticsState(tempC, p.stirringRpm ?? 240, reacting);
      const rpmSpeed = ((p.stirringRpm ?? 240) / 60) * (reacting ? 4.2 : 1.6);
      stirBar.rotation.y = t * Math.max(1.2, rpmSpeed);
      vortexRing.rotation.z = -t * Math.max(1.5, rpmSpeed * 0.85);
      vortexMat.opacity = kinState.vortexOpacity;

      const eaFraction = Math.min(1, Math.max(0, tempC / 70));
      kLiquidMat.uniforms.uOpacity.value = 0.55 + eaFraction * 0.4;
      hotplateCeramicTopMat.emissiveIntensity = Math.min(0.6, 0.15 + eaFraction * 0.45);
      heaterRingMat.emissiveIntensity = Math.min(0.6, 0.25 + eaFraction * 0.35);
      heaterLight.intensity = Math.min(0.8, 0.3 + eaFraction * 0.5);
      if (isSimTimeAdvancing && tempC >= 60) {
        labSound.playThermalBubbling((tempC - 55) / 45);
      }
    } else if (p.mode === 'spectrophotometry-beer') {
      const absVal = m.spectroAbsorbance ?? 0.8;
      const beamState = computeBeerLambertBeamState(p.spectroWavelengthNm ?? 525, absVal);
      const opacity = Math.min(0.95, Math.max(0.2, absVal * 0.4));
      (analyteSolutionCuvette.material as THREE.MeshStandardMaterial).opacity = opacity;
      incidentBeamMat.color.setHex(beamState.beamColorHex);
      incidentBeamMat.opacity = beamState.incidentOpacity;
      transmittedBeamMat.color.setHex(beamState.beamColorHex);
      transmittedBeamMat.opacity = beamState.transmittedOpacity;
    }
  };

  return {
    redoxGroup,
    gasGroup,
    kineticsGroup,
    spectroGroup,
    pistonHead,
    update,
  };
}
