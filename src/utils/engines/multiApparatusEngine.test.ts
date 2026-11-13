import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  MultiApparatusEngine,
  computePortDistance3D,
  findSceneObjectByParamKey,
  resolveAiCameraTargetPosition,
  triggerDomainApparatusSnap,
} from './multiApparatusEngine';
import { executeDrLabMuUIAction } from '../../hooks/useDrLabMuChat';
import { computeDraggedParameterValue } from '../threeInteractionHelper';
import {
  evaluateAdaptiveScaffolding,
  resolveScaffoldingTier,
  adaptiveScaffoldingEngine,
} from './adaptiveScaffoldingEngine';
import { evaluateSafetyHazard } from './statisticsAndRegression';
import {
  computeSnapPitchHz,
  computeHazardAlarmProfile,
  shouldTriggerCooldownAudio,
} from '../soundEngine';
import { useLabStore } from '../../stores/useLabStore';

describe('Fase 2: MultiApparatusEngine & AdaptiveScaffoldingEngine', () => {
  beforeEach(() => {
    useLabStore.getState().clearApparatusDockings();
    adaptiveScaffoldingEngine.reset();
  });

  it('TUGAS 1: detects Snap-to-Port magnetic candidate within 0.5 units and locks connection into useLabStore', () => {
    const engine = new MultiApparatusEngine(0.5);

    engine.registerNode({
      id: 'buret-a',
      type: 'source',
      ports: [{ id: 'tip-out', type: 'fluid', position: [0, 2.8, 0] }],
      state: { volumeMl: 50, flowRateMlPerSec: 2.5, valveOpen: true },
    });

    engine.registerNode({
      id: 'erlenmeyer-b',
      type: 'detector',
      ports: [{ id: 'neck-in', type: 'fluid', position: [0, 1.5, 0] }],
      state: { volumeMl: 25, receivedFluidMl: 0, pH: 1.0 },
    });

    // Initially distance is 1.3 units (>= 0.5) -> no snap candidate
    assert.strictEqual(
      computePortDistance3D([0, 2.8, 0], [0, 1.5, 0]),
      1.3
    );
    assert.strictEqual(engine.findMagneticSnapCandidate('buret-a'), null);

    // Move buret-a port to [0, 1.82, 0] -> distance is 0.32 units (< 0.5)
    const snapCandidate = engine.moveNodeAndEvaluateSnap('buret-a', {
      'tip-out': [0, 1.82, 0],
    });
    assert.ok(snapCandidate, 'Expected magnetic snap candidate when distance < 0.5');
    assert.strictEqual(snapCandidate?.isWithinSnapRadius, true);
    assert.strictEqual(snapCandidate?.distance, 0.32);
    assert.strictEqual(snapCandidate?.portType, 'fluid');
    assert.deepStrictEqual(snapCandidate?.snapPosition, [0, 1.5, 0]);

    // Release mouse to commit snap docking and verify useLabStore receives event
    const docked = engine.commitActiveSnapOnRelease();
    assert.ok(docked);
    assert.strictEqual(docked?.sourceNodeId, 'buret-a');
    assert.strictEqual(docked?.targetNodeId, 'erlenmeyer-b');

    const buretNode = engine.getNode('buret-a')!;
    const flaskNode = engine.getNode('erlenmeyer-b')!;
    assert.strictEqual(buretNode.ports[0].connectedTo, 'erlenmeyer-b:neck-in');
    assert.strictEqual(flaskNode.ports[0].connectedTo, 'buret-a:tip-out');
    assert.deepStrictEqual(buretNode.ports[0].position, [0, 1.5, 0]);

    const storeConns = useLabStore.getState().dockedConnections;
    assert.strictEqual(storeConns.length, 1);
    assert.strictEqual(storeConns[0].sourceNodeId, 'buret-a');
  });

  it('TUGAS 1: simulates fluid flow, electric current (Ohm), and optical beam refraction (Snell) across docked ports', () => {
    const engine = new MultiApparatusEngine(0.5);

    // 1. Fluid pair: Burette (0.1M NaOH) -> Erlenmeyer (25mL of 0.1M HCl)
    engine.registerNode({
      id: 'buret',
      type: 'source',
      ports: [{ id: 'p-out', type: 'fluid', position: [0, 1, 0] }],
      state: { volumeMl: 50, flowRateMlPerSec: 5.0, concentrationM: 0.1, valveOpen: true },
    });
    engine.registerNode({
      id: 'flask',
      type: 'detector',
      ports: [{ id: 'p-in', type: 'fluid', position: [0, 1, 0] }],
      state: {
        volumeMl: 25,
        initialAcidVolumeMl: 25,
        initialAcidM: 0.1,
        receivedFluidMl: 0,
        pH: 1.0,
      },
    });
    engine.connectPorts('buret', 'p-out', 'flask', 'p-in');

    // 2. Electric pair: 12V Power Supply -> 4 Ohm Resistor
    engine.registerNode({
      id: 'dc-supply',
      type: 'source',
      ports: [{ id: 'e-out', type: 'electric', position: [2, 1, 0] }],
      state: { voltageV: 12, resistanceOhm: 0, switchClosed: true },
    });
    engine.registerNode({
      id: 'ammeter-load',
      type: 'detector',
      ports: [{ id: 'e-in', type: 'electric', position: [2, 1, 0] }],
      state: { resistanceOhm: 4 },
    });
    engine.connectPorts('dc-supply', 'e-out', 'ammeter-load', 'e-in');

    // 3. Optical pair: 20mW 532nm Laser -> Lens/Photodetector (T = 0.85, n = 1.5)
    engine.registerNode({
      id: 'laser-src',
      type: 'source',
      ports: [{ id: 'o-out', type: 'optical', position: [4, 1, 0] }],
      state: { intensityMw: 20, wavelengthNm: 532, incidentAngleDeg: 30, laserOn: true },
    });
    engine.registerNode({
      id: 'photo-det',
      type: 'detector',
      ports: [{ id: 'o-in', type: 'optical', position: [4, 1, 0] }],
      state: { transmittance: 0.85, refractiveIndex: 1.5 },
    });
    engine.connectPorts('laser-src', 'o-out', 'photo-det', 'o-in');

    // Step simulation for dt = 5.0 seconds (5.0 mL/s * 5 s = 25 mL NaOH -> equivalence point pH 7.0!)
    const summary = engine.stepTransfer(5.0);
    assert.strictEqual(summary.activeConnectionsCount, 3);
    assert.strictEqual(summary.fluidTransferredMl, 25);
    assert.strictEqual(summary.electricCurrentAmp, 3);
    assert.strictEqual(summary.opticalIntensityMw, 17);

    const buretState = engine.getNode('buret')!.state;
    const flaskState = engine.getNode('flask')!.state;
    assert.strictEqual(buretState.volumeMl, 25);
    assert.strictEqual(flaskState.volumeMl, 50);
    assert.strictEqual(flaskState.pH, 7.0);

    const loadState = engine.getNode('ammeter-load')!.state;
    assert.strictEqual(loadState.currentAmp, 3);
    assert.strictEqual(loadState.powerWatt, 36);

    const detState = engine.getNode('photo-det')!.state;
    assert.strictEqual(detState.detectedIntensityMw, 17);
    assert.strictEqual(detState.refractedAngleDeg, 19.47);
  });

  it('TUGAS 2: classifies Stagnant Trial, Erratic Outliers (R² < 0.70), and Safety Violation across 3 scaffolding tiers', () => {
    const now = 1_700_000_000_000;

    // 1. Stagnant Trial (> 2 minutes idle while recordsCount < 3)
    const stagnantHint = evaluateAdaptiveScaffolding({
      nowTimestamp: now,
      lastInteractionTimestamp: now - 135_000, // 2m 15s idle
      recordsCount: 1,
      targetRecordsCount: 3,
      rSquaredHistory: [0.96],
      domain: 'Fisika',
      occurrenceCount: 1,
    });
    assert.ok(stagnantHint);
    assert.strictEqual(stagnantHint?.condition, 'stagnant_trial');
    assert.strictEqual(stagnantHint?.tier, 1);

    // 2. Erratic Outliers (repeated R² < 0.70) -> Tier 2 Targeted Clue
    const outlierHint = evaluateAdaptiveScaffolding({
      nowTimestamp: now,
      lastInteractionTimestamp: now - 10_000,
      recordsCount: 3,
      rSquaredHistory: [0.64, 0.55],
      domain: 'Kimia',
      occurrenceCount: 3, // resolves to Tier 2 (occ - 1 = 2)
    });
    assert.ok(outlierHint);
    assert.strictEqual(outlierHint?.condition, 'erratic_outliers');
    assert.strictEqual(outlierHint?.tier, 2);
    assert.ok(outlierHint?.targetedVariable?.includes('Titran'));

    // 3. Safety Violation (Temperature > 85°C) -> Tier 3 Visual Focus
    const safetyHint = evaluateAdaptiveScaffolding({
      nowTimestamp: now,
      lastInteractionTimestamp: now - 5_000,
      recordsCount: 2,
      rSquaredHistory: [0.99],
      temperatureC: 96,
      maxSafeTemperatureC: 85,
      domain: 'Kimia',
      occurrenceCount: 2,
    });
    assert.ok(safetyHint);
    assert.strictEqual(safetyHint?.condition, 'safety_violation');
    assert.strictEqual(safetyHint?.tier, 3);
    assert.strictEqual(resolveScaffoldingTier('erratic_outliers', 3), 3);
  });

  it('FASE 5: triggerDomainApparatusSnap docks domain-specific ports and transfers fluid/electric/optical energy', () => {
    const engine = new MultiApparatusEngine(0.5);

    const chemSnap = triggerDomainApparatusSnap('Kimia', engine);
    assert.ok(chemSnap.docked);
    assert.strictEqual(chemSnap.docked?.portType, 'fluid');
    assert.ok((chemSnap.transfer?.fluidTransferredMl ?? 0) > 0);

    const physSnap = triggerDomainApparatusSnap('Fisika', engine);
    assert.ok(physSnap.docked);
    assert.strictEqual(physSnap.docked?.portType, 'electric');
    assert.strictEqual(physSnap.transfer?.electricCurrentAmp, 2);

    const bioSnap = triggerDomainApparatusSnap('Biologi', engine);
    assert.ok(bioSnap.docked);
    assert.strictEqual(bioSnap.docked?.portType, 'optical');
    assert.ok((bioSnap.transfer?.opticalIntensityMw ?? 0) > 0);

    assert.ok(useLabStore.getState().dockedConnections.length >= 3);
  });

  it('FASE 5: evaluateSafetyHazard detects K3 thermal runaway, overpressure, corrosive overflow, and mechanical overload while keeping defaults safe', () => {
    const safeChem = evaluateSafetyHazard('Kimia', undefined, {
      mode: 'acid-base-titration',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      reactantConcentration: 0.5,
      solutionVolumeMl: 100,
      pressureAtm: 1,
      useCatalyst: false,
      stirringRpm: 200,
      analyteAcidConc: 0.1,
      analyteVolumeMl: 25,
      titrantBaseConc: 0.1,
      titrantAddedMl: 25,
      acidPka: 1,
      indicatorType: 'fenolftalein',
      redoxPairId: 'zn-cu',
      anodeConcM: 1,
      cathodeConcM: 1,
    });
    assert.strictEqual(safeChem.isHazardous, false);

    const thermalRunaway = evaluateSafetyHazard('Kimia', undefined, {
      mode: 'reaction-kinetics-arrhenius',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      kineticsTempC: 92,
      kineticsConcA: 2.0,
      reactantConcentration: 1.0,
      solutionVolumeMl: 100,
      pressureAtm: 1,
      useCatalyst: false,
      stirringRpm: 200,
      analyteAcidConc: 0.1,
      analyteVolumeMl: 25,
      titrantBaseConc: 0.1,
      titrantAddedMl: 0,
      acidPka: 1,
      indicatorType: 'fenolftalein',
      redoxPairId: 'zn-cu',
      anodeConcM: 1,
      cathodeConcM: 1,
    });
    assert.strictEqual(thermalRunaway.isHazardous, true);
    assert.strictEqual(thermalRunaway.hazardCode, 'CHEM_THERMAL_RUNAWAY');
    assert.strictEqual(thermalRunaway.severity, 'critical');

    const overflow = evaluateSafetyHazard('Kimia', undefined, {
      mode: 'acid-base-titration',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      reactantConcentration: 0.5,
      solutionVolumeMl: 100,
      pressureAtm: 1,
      useCatalyst: false,
      stirringRpm: 200,
      analyteAcidConc: 1.9,
      analyteVolumeMl: 25,
      titrantBaseConc: 1.8,
      titrantAddedMl: 49,
      acidPka: 1,
      indicatorType: 'fenolftalein',
      redoxPairId: 'zn-cu',
      anodeConcM: 1,
      cathodeConcM: 1,
    });
    assert.strictEqual(overflow.isHazardous, true);
    assert.strictEqual(overflow.hazardCode, 'CHEM_CORROSIVE_OVERFLOW');

    const pendulumHazard = evaluateSafetyHazard('Fisika', {
      mode: 'pendulum-harmonic',
      mass: 5,
      appliedForce: 0,
      frictionCoeffStatic: 0.2,
      frictionCoeffKinetic: 0.1,
      inclineAngle: 0,
      gravity: 9.8,
      initialVelocity: 0,
      launchAngle: 45,
      initialHeight: 0,
      secondaryMass: 5,
      separationDistance: 5,
      collisionMass2: 5,
      velocity2Initial: 0,
      dampingCoeff: 0.1,
      springConstantK: 50,
      springDisplacement: 0.5,
      pendulumLength: 1.2,
      pendulumAngle: 85,
      restitutionCoeff: 1,
    });
    assert.strictEqual(pendulumHazard.isHazardous, true);
    assert.strictEqual(pendulumHazard.hazardCode, 'PHYS_PENDULUM_EXTREME_ANGLE');
  });

  it('FASE 5: pure soundEngine helpers compute distinct snap pitches and enforce alarm cooldowns', () => {
    const fluidPitch = computeSnapPitchHz('fluid');
    const electricPitch = computeSnapPitchHz('electric');
    const opticalPitch = computeSnapPitchHz('optical');
    assert.notStrictEqual(fluidPitch.accentHz, electricPitch.accentHz);
    assert.notStrictEqual(electricPitch.accentHz, opticalPitch.accentHz);

    const alarm = computeHazardAlarmProfile();
    assert.ok(alarm.primaryHz > alarm.secondaryHz);
    assert.strictEqual(shouldTriggerCooldownAudio(2000, 1000, alarm.cooldownMs), false);
    assert.strictEqual(shouldTriggerCooldownAudio(2600, 1000, alarm.cooldownMs), true);
  });

  it('FASE 2 3D ENHANCEMENT: computeDraggedParameterValue snaps steps, respects bounds, and prioritizes dominant drag axis', () => {
    // Upward vertical drag (-deltaY = +140px out of 280px span) increases half range
    const vUp = computeDraggedParameterValue(450, 10, -140, 400, 700, 10, 280);
    assert.strictEqual(vUp, 600);

    // Clamps strictly to [min, max]
    assert.strictEqual(computeDraggedParameterValue(650, 500, 0, 400, 700, 10, 280), 700);
    assert.strictEqual(computeDraggedParameterValue(450, -500, 0, 400, 700, 10, 280), 400);

    // Fractional steps preserve decimal precision
    const vPh = computeDraggedParameterValue(7.0, 14, 0, 0, 14, 0.1, 280);
    assert.strictEqual(vPh, 7.7);
  });

  it('FASE 2 3D ENHANCEMENT: MultiApparatusEngine.bindPortAnchor & syncMeshAnchors track live THREE.Object3D world positions and snap < 0.5u', () => {
    const engine = new MultiApparatusEngine(0.5);

    engine.registerNode({
      id: 'buret-live',
      type: 'source',
      ports: [{ id: 'nozzle-out', type: 'fluid', position: [0, 3, 0] }],
      state: { volumeMl: 50, flowRateMlPerSec: 2, valveOpen: true },
    });
    engine.registerNode({
      id: 'flask-live',
      type: 'detector',
      ports: [{ id: 'neck-in', type: 'fluid', position: [0, 1, 0] }],
      state: { volumeMl: 25, receivedFluidMl: 0, pH: 1.0 },
    });

    const parentGroup = new THREE.Group();
    const buretteObj = new THREE.Object3D();
    buretteObj.position.set(0, 3.0, 0);
    const flaskObj = new THREE.Object3D();
    flaskObj.position.set(0, 1.0, 0);
    parentGroup.add(buretteObj, flaskObj);

    assert.strictEqual(engine.bindPortAnchor('buret-live', 'nozzle-out', buretteObj), true);
    assert.strictEqual(engine.bindPortAnchor('flask-live', 'neck-in', flaskObj), true);
    assert.strictEqual(engine.bindPortAnchor('missing-node', 'p', buretteObj), false);

    // Distance = 2.0 (>= 0.5) -> no snap candidate yet
    assert.strictEqual(engine.syncMeshAnchors(), null);

    // Move burette mesh within 0.25 units of flask neck -> sync detects candidate & docks on release
    buretteObj.position.set(0, 1.25, 0);
    const candidate = engine.syncMeshAnchors();
    assert.ok(candidate);
    assert.strictEqual(candidate?.isWithinSnapRadius, true);
    assert.strictEqual(candidate?.sourceNodeId, 'buret-live');
    assert.strictEqual(candidate?.targetNodeId, 'flask-live');
    assert.strictEqual(candidate?.distance, 0.25);

    const docked = engine.commitActiveSnapOnRelease();
    assert.ok(docked);
    assert.strictEqual(docked?.portType, 'fluid');
    assert.strictEqual(docked?.targetPortId, 'neck-in');

    engine.clearPortAnchors();
  });

  it('FASE 4: Dr. LabMu 3D scaffolding halo helpers resolve visible parameter meshes, camera targets, and slider highlights', () => {
    const scene = new THREE.Scene();
    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    hiddenMesh.userData = { draggableParam: 'titrantAddedMl' };
    hiddenGroup.add(hiddenMesh);

    const visibleGroup = new THREE.Group();
    visibleGroup.position.set(1.2, 2.1, -0.4);
    const activeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    activeMesh.userData = { draggableParam: 'titrantAddedMl' };
    visibleGroup.add(activeMesh);

    scene.add(hiddenGroup, visibleGroup);

    const found = findSceneObjectByParamKey(scene, 'titrantAddedMl');
    assert.strictEqual(found, activeMesh);
    assert.strictEqual(findSceneObjectByParamKey(scene, 'nonExistentParam'), null);

    assert.deepStrictEqual(resolveAiCameraTargetPosition('burette_tip'), [0, 1.85, 0]);
    assert.deepStrictEqual(resolveAiCameraTargetPosition('pendulum_bob'), [0.6, 2.4, 0]);
    assert.deepStrictEqual(resolveAiCameraTargetPosition('left_ventricle'), [0.35, 0.35, 0.2]);
    assert.deepStrictEqual(resolveAiCameraTargetPosition('planet_focus'), [0, 0.5, 0]);

    executeDrLabMuUIAction({
      type: 'HIGHLIGHT_SLIDER',
      paramKey: 'titrantAddedMl',
      durationMs: 2500,
    });
    assert.strictEqual(useLabStore.getState().highlightedParamKey, 'titrantAddedMl');
  });
});
