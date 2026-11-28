import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  type PhysicsParams,
} from './engines/physicsEngine';
import {
  computeMechanicalEnergySplit,
  computeCollisionShockwaveState,
  computeWheatstoneNeedleAngle,
  computePhotoelectricElectronX,
  photonFrequencyToWavelengthNm,
  computeInclineVisualState,
  computeSpringVisualKinematics,
  computePendulumVisualKinematics,
  computeCollisionCartKinematics,
  computeOrbitalAngularVelocity,
  computeStokesDropState,
  computeYoungFringeIntensity,
  computeWheatstoneBranchCurrents,
  computeFaradayInductionVisualState,
} from './physicsVisualHelpers';

const BASE_PHYSICS_PARAMS: PhysicsParams = {
  mode: 'newton-incline',
  mass: 5,
  inclineAngle: 30,
  launchAngle: 45,
  gravity: 9.81,
  appliedForce: 0,
  frictionCoeffStatic: 0.3,
  frictionCoeffKinetic: 0.2,
  initialVelocity: 0,
  initialHeight: 0,
  springConstantK: 80,
  springDisplacement: 0.5,
  dampingCoeff: 0.25,
  pendulumLength: 2.0,
  pendulumAngle: 25,
  secondaryMass: 5,
  collisionMass2: 2,
  velocity2Initial: -4,
  restitutionCoeff: 0.85,
  separationDistance: 4,
};

test('computeMechanicalEnergySplit normalizes kinetic and potential energy safely', () => {
  const split = computeMechanicalEnergySplit(75, 25);
  assert.ok(split.ekNorm > split.epNorm);
  assert.equal(split.etotNorm, 1.0);

  const zeroSplit = computeMechanicalEnergySplit(0, 0);
  assert.equal(zeroSplit.ekNorm, 0.06);
  assert.equal(zeroSplit.epNorm, 0.06);
});

test('computeCollisionShockwaveState activates only within impact window', () => {
  const before = computeCollisionShockwaveState(1.1, 1.4, 0.45);
  assert.equal(before.visible, false);

  const during = computeCollisionShockwaveState(1.5, 1.4, 0.45);
  assert.equal(during.visible, true);
  assert.ok(during.scale > 0.35);
  assert.ok(during.opacity > 0);

  const after = computeCollisionShockwaveState(2.1, 1.4, 0.45);
  assert.equal(after.visible, false);
});

test('computeWheatstoneNeedleAngle detects balanced bridge and signed deflection', () => {
  const balanced = computeWheatstoneNeedleAngle(100, 200, 150, 300, 0);
  assert.equal(balanced.isBalanced, true);
  assert.equal(balanced.angleRad, 0);

  const unbalanced = computeWheatstoneNeedleAngle(100, 200, 100, 50, 22);
  assert.equal(unbalanced.isBalanced, false);
  assert.ok(unbalanced.angleRad > 0);
});

test('computePhotoelectricElectronX models parabolic turnaround when stopping potential exceeds Ek_max', () => {
  const repelled = computePhotoelectricElectronX(0.5, 1.0, 2.0);
  assert.equal(repelled.reachesAnode, false);
  assert.ok(repelled.x < 1.1);
  // At turnaround apex (p = 0.5), speedFactor must be ~0
  assert.ok(repelled.speedFactor < 0.05);

  const collected = computePhotoelectricElectronX(0.95, 2.5, 1.0);
  assert.equal(collected.reachesAnode, true);
  assert.ok(collected.x > 0.8);
});

test('photonFrequencyToWavelengthNm converts 10^14 Hz accurately via λ = c/f', () => {
  // 6.0e14 Hz -> ~500 nm cyan-green; 10e14 Hz -> ~300 nm UV
  const wl500 = photonFrequencyToWavelengthNm(6.0);
  assert.ok(Math.abs(wl500 - 499.7) < 0.5);
  const wlUv = photonFrequencyToWavelengthNm(10.0);
  assert.ok(Math.abs(wlUv - 299.8) < 0.5);
});

test('computeInclineVisualState locks stationary block and signs friction accurately', () => {
  // High static friction holds block stationary on 20° ramp (mg sin 20° < mu_s mg cos 20°)
  const staticParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    inclineAngle: 20,
    appliedForce: 0,
    frictionCoeffStatic: 0.7,
    frictionCoeffKinetic: 0.5,
  };
  const staticMetrics = calculatePhysicsMetrics(staticParams);
  assert.equal(staticMetrics.isMoving, false);
  const staticVis = computeInclineVisualState(staticParams, staticMetrics, 3.0);
  assert.equal(staticVis.blockRampOffset, 0, 'Static friction lock must keep block stationary');
  assert.equal(staticVis.frictionDirSign, 1, 'Static friction opposes downhill gravity (+1 uphill)');

  // Large applied uphill force overcomes gravity & friction -> friction points downhill (-1)
  const uphillParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    inclineAngle: 20,
    appliedForce: 80,
    frictionCoeffStatic: 0.2,
    frictionCoeffKinetic: 0.15,
  };
  const uphillMetrics = calculatePhysicsMetrics(uphillParams);
  const uphillVis = computeInclineVisualState(uphillParams, uphillMetrics, 1.0);
  assert.equal(uphillVis.frictionDirSign, -1, 'Uphill motion must have downhill (-1) friction arrow');
  assert.ok(uphillVis.blockRampOffset > 0, 'Block must move uphill');
});

test('computeSpringVisualKinematics matches evaluateKinematicsAtTime exactly and stays still at x=0', () => {
  const zeroParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'spring-hooke',
    springDisplacement: 0,
  };
  const zeroVis = computeSpringVisualKinematics(zeroParams, 1.2);
  assert.equal(zeroVis.displacementM, 0, 'Zero initial displacement must not artificially oscillate');

  const dampedParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'spring-hooke',
    springDisplacement: 0.8,
    dampingCoeff: 0.6,
  };
  const vis = computeSpringVisualKinematics(dampedParams, 1.5);
  const exact = evaluateKinematicsAtTime(dampedParams, 1.5);
  assert.ok(Math.abs(vis.displacementM - exact.positionX) < 1e-4);
  assert.ok(Math.abs(vis.restoringForceN - -dampedParams.springConstantK * exact.positionX) < 1e-2);
});

test('computePendulumVisualKinematics matches damped engine angle and physical tension', () => {
  const pendParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'pendulum-harmonic',
    mass: 3,
    pendulumLength: 2.0,
    pendulumAngle: 30,
  };
  const vis = computePendulumVisualKinematics(pendParams, 0.8);
  const exact = evaluateKinematicsAtTime(pendParams, 0.8);
  assert.ok(Math.abs(vis.angleRad - (exact.pendulumAngleRad ?? 0)) < 1e-4);
  assert.ok(vis.tensionForceN > 0, 'Pendulum rod tension must be positive');
});

test('computeCollisionCartKinematics keeps stationary target cart still until impact at t=1.5s', () => {
  const params: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'collision-momentum',
    mass: 4,
    initialVelocity: 6,
    collisionMass2: 4,
    velocity2Initial: 0,
    restitutionCoeff: 1.0,
  };
  const metrics = calculatePhysicsMetrics(params);
  assert.equal(metrics.mode, 'collision-momentum');
  const t0 = computeCollisionCartKinematics(params, metrics, 0.2);
  const t1 = computeCollisionCartKinematics(params, metrics, 1.0);
  // Stationary cart2 (u2 = 0) MUST stay at exact same position before impact!
  assert.equal(t0.cart2X, t1.cart2X, 'Stationary cart must not drift before being hit');
  assert.ok(t1.cart1X > t0.cart1X, 'Moving cart1 must approach stationary cart2');

  // After elastic equal-mass collision, cart1 stops (v1Final = 0) and cart2 moves right (v2Final = 6)
  const tPost1 = computeCollisionCartKinematics(params, metrics, 1.8);
  const tPost2 = computeCollisionCartKinematics(params, metrics, 2.3);
  assert.equal(tPost1.cart1X, tPost2.cart1X, 'Cart1 stops after equal-mass elastic hit');
  assert.ok(tPost2.cart2X > tPost1.cart2X, 'Cart2 moves right after impact');
});

test('computeOrbitalAngularVelocity increases with higher central mass and smaller radius', () => {
  const base = computeOrbitalAngularVelocity(5, 4);
  const closer = computeOrbitalAngularVelocity(5, 2);
  const heavier = computeOrbitalAngularVelocity(12, 4);
  assert.ok(closer.angularSpeedRadS > base.angularSpeedRadS * 2);
  assert.ok(heavier.angularSpeedRadS > base.angularSpeedRadS);
});

test('computeStokesDropState floats low-density spheres and balances Fb + Fd = W at terminal velocity', () => {
  const floatParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'stokes-viscosity',
    sphereDensity: 900,
    fluidDensity: 1260,
    fluidViscosity: 0.95,
    sphereRadius: 5,
  };
  const floatM = calculatePhysicsMetrics(floatParams);
  assert.equal(floatM.mode, 'stokes-viscosity');
  const floatVis = computeStokesDropState(floatParams, floatM, 2.0);
  assert.equal(floatVis.isFloating, true, 'Sphere lighter than fluid must float instead of sinking');
  assert.equal(floatVis.instantVelocityMs, 0);

  const sinkParams: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'stokes-viscosity',
    sphereDensity: 7800,
    fluidDensity: 1260,
    fluidViscosity: 1.2,
    sphereRadius: 4,
  };
  const sinkM = calculatePhysicsMetrics(sinkParams);
  assert.equal(sinkM.mode, 'stokes-viscosity');
  // At large t >> tau, F_b + F_d must equal W visually!
  const sinkVis = computeStokesDropState(sinkParams, sinkM, 1.5);
  assert.equal(sinkVis.isFloating, false);
  assert.ok(
    Math.abs(sinkVis.buoyancyArrowLen + sinkVis.dragArrowLen - sinkVis.weightArrowLen) < 0.08,
    'At terminal velocity, buoyancy + drag vectors must balance weight vector'
  );
});

test('computeYoungFringeIntensity matches exact Δy = λL/d peaks and troughs', () => {
  // λ = 500 nm, d = 0.25 mm, L = 1.5 m -> Δy = 0.5e-3 * 1.5 / 0.25 = 3.0 mm
  const center = computeYoungFringeIntensity(0, 500, 0.25, 1.5);
  assert.equal(center.fringeSpacingMm, 3.0);
  assert.equal(center.intensity, 1);

  const firstDark = computeYoungFringeIntensity(1.5, 500, 0.25, 1.5);
  assert.ok(firstDark.intensity < 1e-4, 'Half-fringe y = Δy/2 must be dark trough');

  const firstBright = computeYoungFringeIntensity(3.0, 500, 0.25, 1.5);
  assert.ok(firstBright.intensity > 0.7, 'Full fringe y = Δy must be bright peak');
});

test('computeWheatstoneBranchCurrents yields zero bridge current at balance', () => {
  const bal = computeWheatstoneBranchCurrents(100, 200, 150, 300, 12);
  assert.equal(bal.isBalanced, true);
  assert.equal(bal.iGalvoSignedMa, 0);

  const unbal = computeWheatstoneBranchCurrents(100, 200, 100, 50, 12);
  assert.equal(unbal.isBalanced, false);
  assert.ok(unbal.iGalvoSignedMa > 0);
});

test('computeFaradayInductionVisualState maintains 90-degree phase quadrature between flux and EMF', () => {
  const base: PhysicsParams = {
    ...BASE_PHYSICS_PARAMS,
    mode: 'faraday-induction',
    coilTurnsN: 100,
    magneticFieldTesla: 0.5,
    magnetOscillationHz: 1.0,
    coilAreaCm2: 20,
    loadResistanceOhm: 10,
  };
  // At t=0 (cos(0)=1, sin(0)=0): flux is peak, EMF and current are 0!
  const atPeakFlux = computeFaradayInductionVisualState(base, 0);
  assert.ok(atPeakFlux.instantFluxMwb > 0.99);
  assert.equal(Math.abs(atPeakFlux.instantEmfV) < 1e-3, true);

  // At t=0.25s for f=1 Hz (quarter period -> cos=0, sin=1): flux is 0, EMF is peak!
  const atPeakEmf = computeFaradayInductionVisualState(base, 0.25);
  assert.ok(Math.abs(atPeakEmf.instantFluxMwb) < 1e-3);
  assert.ok(Math.abs(atPeakEmf.instantEmfV - atPeakEmf.peakEmfV) < 1e-3);
  assert.ok(atPeakEmf.bulbGlow > 0.1);
});
