/**
 * Pure visual-to-formula synchronization helpers for Physics 3D rigs.
 * Guarantees 1:1 agreement between canonical physicsEngine formulas and 3D scene motion,
 * force/velocity vectors, optical interference patterns, and electrical/thermal readouts.
 */
import {
  evaluateKinematicsAtTime,
  type PhysicsMetrics,
  type PhysicsParams,
} from './engines/physicsEngine';

export interface MechanicalEnergySplit {
  ekNorm: number;
  epNorm: number;
  etotNorm: number;
  ekJoules: number;
  epJoules: number;
}

/**
 * Computes normalized (0.06..1.0) heights for 3D Kinetic & Potential energy bars.
 */
export function computeMechanicalEnergySplit(
  kineticEnergyJ: number,
  potentialEnergyJ: number
): MechanicalEnergySplit {
  const ek = Math.max(0, Number.isFinite(kineticEnergyJ) ? kineticEnergyJ : 0);
  const ep = Math.max(0, Number.isFinite(potentialEnergyJ) ? potentialEnergyJ : 0);
  const total = Math.max(1e-3, ek + ep);
  const scaleCap = Math.max(50, total);
  return {
    ekNorm: Math.max(0.06, Math.min(1.0, ek / scaleCap)),
    epNorm: Math.max(0.06, Math.min(1.0, ep / scaleCap)),
    etotNorm: Math.max(0.1, Math.min(1.0, (ek + ep) / scaleCap)),
    ekJoules: ek,
    epJoules: ep,
  };
}

/**
 * Computes transient shockwave ring scale and opacity right after a 1D cart collision.
 */
export function computeCollisionShockwaveState(
  cycleSec: number,
  impactTimeSec = 1.5,
  durationSec = 0.45
): { visible: boolean; scale: number; opacity: number } {
  const dt = cycleSec - impactTimeSec;
  if (dt < 0 || dt > durationSec) {
    return { visible: false, scale: 0.2, opacity: 0 };
  }
  const progress = Math.max(0, Math.min(1, dt / durationSec));
  return {
    visible: true,
    scale: Number((0.35 + progress * 1.95).toFixed(3)),
    opacity: Number(((1 - progress) * 0.85).toFixed(3)),
  };
}

/**
 * Computes the signed galvanometer needle angle (in radians) for a Wheatstone bridge.
 */
export function computeWheatstoneNeedleAngle(
  r1: number,
  r2: number,
  r3: number,
  rx: number,
  galvanometerCurrentMa: number
): { angleRad: number; isBalanced: boolean } {
  const sR1 = Math.max(1, r1);
  const sR2 = Math.max(1, r2);
  const sR3 = Math.max(1, r3);
  const sRx = Math.max(1, rx);
  const vDiff = sR2 / (sR1 + sR2) - sRx / (sR3 + sRx);
  const isBalanced = Math.abs(vDiff) < 1e-4 || Math.abs(galvanometerCurrentMa) < 0.05;
  const dirSign = isBalanced ? 0 : Math.sign(vDiff);
  const rawAngle = dirSign * (Math.abs(galvanometerCurrentMa) / 45) * Math.PI * 0.42;
  const clamped = Math.max(-0.68, Math.min(0.68, rawAngle));
  return {
    angleRad: Number(clamped.toFixed(4)),
    isBalanced,
  };
}

/**
 * Computes the horizontal X coordinate of a photoelectron between cathode (-1.1) and anode (+1.1),
 * modeling classical parabolic deceleration & turnaround under stopping potential V0:
 * a = -e*V0 / (m*d), turning distance x_turn / d = Ek_max / (e*V0).
 */
export function computePhotoelectricElectronX(
  phase01: number,
  maxKeEv: number,
  stoppingPotentialV: number
): { x: number; reachesAnode: boolean; speedFactor: number } {
  const p = ((phase01 % 1) + 1) % 1;
  const safeKe = Math.max(0, Number.isFinite(maxKeEv) ? maxKeEv : 0);
  const safeStop = Math.max(0, Number.isFinite(stoppingPotentialV) ? stoppingPotentialV : 0);
  const dSpan = 2.2;
  const xStart = -1.1;

  if (safeStop > safeKe && safeStop > 1e-4) {
    // True constant-deceleration parabola: s(u) = 4 * s_max * u * (1 - u)
    const maxFraction = Math.min(0.95, safeKe / safeStop);
    const turnOffset = maxFraction * 2.0;
    const parabolic = 4 * p * (1 - p);
    const x = xStart + turnOffset * parabolic;
    const speedFactor = Math.abs(1 - 2 * p) * Math.sqrt(Math.max(0.05, safeKe));
    return {
      x: Number(x.toFixed(4)),
      reachesAnode: false,
      speedFactor: Number(speedFactor.toFixed(3)),
    };
  }

  // Reaches anode with smooth kinematic deceleration under opposing V0 <= Ek_max
  const ratio = safeKe > 1e-4 ? Math.min(0.98, safeStop / safeKe) : 0;
  // Kinematic displacement normalized to [0, 1] for constant deceleration from v0 to vf = v0*sqrt(1 - ratio)
  const vRatio = Math.sqrt(Math.max(0.02, 1 - ratio));
  const avgSpeedNorm = 0.5 * (1 + vRatio);
  const sNorm = Math.min(1, Math.max(0, (p - 0.5 * (1 - vRatio) * p * p) / Math.max(0.1, avgSpeedNorm)));
  const x = xStart + sNorm * dSpan;
  const speedFactor = Math.sqrt(Math.max(0.05, safeKe * (1 - ratio * sNorm)));
  return {
    x: Number(x.toFixed(4)),
    reachesAnode: true,
    speedFactor: Number(speedFactor.toFixed(3)),
  };
}

/**
 * Converts photon frequency (in 10^14 Hz, as stored in PhysicsParams.photonFrequency)
 * directly to wavelength in nm via exact λ = c / f = 2997.92458 / f_14.
 */
export function photonFrequencyToWavelengthNm(photonFrequency14Hz: number): number {
  const safeF = Number.isFinite(photonFrequency14Hz) ? Math.max(0.5, photonFrequency14Hz) : 8.5;
  return Number((2997.92458 / safeF).toFixed(1));
}

export interface InclineVisualState {
  /** Signed displacement along ramp in scene meters (respects static friction lock) */
  blockRampOffset: number;
  /** Signed direction of friction along ramp (+1 uphill, -1 downhill, 0 if zero) */
  frictionDirSign: number;
  /** Visual scale lengths for Normal, Weight, Applied, Friction, GravityParallel, and Net Force arrows */
  normalArrowLen: number;
  weightArrowLen: number;
  appliedArrowLen: number;
  frictionArrowLen: number;
  gravityParallelArrowLen: number;
  netForceArrowLen: number;
  netForceDirSign: number;
  /** Volumetric mass block scale factor (cbrt(mass / 5)) */
  blockScale: number;
  /** Normalized sliding friction thermal intensity (0..1) */
  frictionHeatGlow: number;
}

/**
 * Synchronizes 3D Newton Incline force arrows, static-friction lock, and motion
 * strictly with calculatePhysicsMetrics() output.
 */
export function computeInclineVisualState(
  params: PhysicsParams,
  metrics: PhysicsMetrics,
  simTime: number
): InclineVisualState {
  const mass = Math.max(0.5, Number.isFinite(params.mass) ? params.mass : 5);
  const applied = Number.isFinite(params.appliedForce) ? params.appliedForce : 0;
  const v0 = Number.isFinite(params.initialVelocity) ? params.initialVelocity : 0;
  const t = Math.max(0, Number.isFinite(simTime) ? simTime : 0);

  // Respect static friction lock: if !isMoving, displacement stays strictly 0!
  let blockRampOffset = 0;
  if (metrics.isMoving) {
    // Smooth periodic ramp glide (2.8s window) scaled to the 6.8 m visual incline track
    // so uphill acceleration moves monotonically toward +X and downhill toward -X.
    const tLoop = t % 2.8;
    const rawDisp = v0 * tLoop + 0.5 * metrics.acceleration * tLoop * tLoop;
    const scaled = rawDisp * 0.28;
    blockRampOffset = Math.max(-3.3, Math.min(3.3, scaled));
  }

  // Exact friction sign directly from physicsEngine.frictionForce (+1 uphill, -1 downhill)
  const frictionMag = Math.abs(metrics.frictionForce);
  const frictionDirSign = frictionMag < 0.05 ? 0 : Math.sign(metrics.frictionForce);
  const netMag = Math.abs(metrics.netForce);
  const netForceDirSign = netMag < 0.05 ? 0 : Math.sign(metrics.netForce);

  const scaleForce = (newtons: number) =>
    newtons < 0.05 ? 0 : Math.min(2.6, Math.max(0.32, newtons * 0.026));

  const blockScale = Math.max(0.72, Math.min(1.42, Math.cbrt(mass / 5)));
  const speedApprox = metrics.isMoving ? Math.abs(v0 + metrics.acceleration * t) : 0;
  const frictionHeatGlow = metrics.isMoving
    ? Math.min(1, (frictionMag * Math.min(12, speedApprox)) / 180)
    : 0;

  return {
    blockRampOffset: Number(blockRampOffset.toFixed(4)),
    frictionDirSign,
    normalArrowLen: Number(scaleForce(metrics.normalForce).toFixed(3)),
    weightArrowLen: Number(scaleForce(metrics.weightForce).toFixed(3)),
    appliedArrowLen: Number(scaleForce(Math.abs(applied)).toFixed(3)),
    frictionArrowLen: Number(scaleForce(frictionMag).toFixed(3)),
    gravityParallelArrowLen: Number(scaleForce(metrics.gravityParallel).toFixed(3)),
    netForceArrowLen: Number(scaleForce(netMag).toFixed(3)),
    netForceDirSign,
    blockScale: Number(blockScale.toFixed(3)),
    frictionHeatGlow: Number(frictionHeatGlow.toFixed(3)),
  };
}

export interface SpringVisualKinematics {
  displacementM: number;
  velocityMs: number;
  restoringForceN: number;
  kineticEnergyJ: number;
  potentialEnergyJ: number;
  coilWireRadius: number;
  blockScale: number;
}

/**
 * Evaluates exact damped Hooke's Law kinematics via evaluateKinematicsAtTime so 3D spring
 * motion matches physicsEngine (x(t) = A * exp(-gamma*t) * cos(omegaD*t)) 1:1.
 */
export function computeSpringVisualKinematics(
  params: PhysicsParams,
  simTime: number
): SpringVisualKinematics {
  const k = Math.max(1, Number.isFinite(params.springConstantK) ? params.springConstantK : 80);
  const m = Math.max(0.2, Number.isFinite(params.mass) ? params.mass : 5);
  const inst = evaluateKinematicsAtTime({ ...params, mode: 'spring-hooke' }, Math.max(0, simTime));
  const x = inst.positionX;
  const v = inst.velocityX;
  return {
    displacementM: Number(x.toFixed(5)),
    velocityMs: Number(v.toFixed(5)),
    restoringForceN: Number((-k * x).toFixed(4)),
    kineticEnergyJ: inst.kineticEnergy,
    potentialEnergyJ: inst.potentialEnergy,
    coilWireRadius: Number(Math.max(0.032, Math.min(0.088, 0.03 + Math.sqrt(k) * 0.0042)).toFixed(4)),
    blockScale: Number(Math.max(0.74, Math.min(1.38, Math.cbrt(m / 5))).toFixed(3)),
  };
}

export interface PendulumVisualKinematics {
  angleRad: number;
  angularVelocityRadS: number;
  speedMs: number;
  restoringForceN: number;
  tensionForceN: number;
  weightForceN: number;
  kineticEnergyJ: number;
  potentialEnergyJ: number;
  bobRadiusScale: number;
}

/**
 * Evaluates exact pendulum angle, restoring force (-m*g*sin θ), and rod tension (m*g*cos θ + m*v²/L)
 * via evaluateKinematicsAtTime so 3D pendulum damping and vectors match the engine exactly.
 */
export function computePendulumVisualKinematics(
  params: PhysicsParams,
  simTime: number
): PendulumVisualKinematics {
  const m = Math.max(0.2, Number.isFinite(params.mass) ? params.mass : 2);
  const g = Math.max(0.05, Number.isFinite(params.gravity) ? params.gravity : 9.81);
  const L = Math.max(
    0.2,
    typeof params.pendulumLength === 'number' && Number.isFinite(params.pendulumLength)
      ? params.pendulumLength
      : 2.0
  );
  const inst = evaluateKinematicsAtTime({ ...params, mode: 'pendulum-harmonic' }, Math.max(0, simTime));
  const theta = inst.pendulumAngleRad ?? 0;
  const omega = inst.pendulumAngularVelocity ?? 0;
  const v = inst.speed;
  const weightForceN = m * g;
  const restoringForceN = -m * g * Math.sin(theta);
  const tensionForceN = m * g * Math.cos(theta) + (m * v * v) / L;

  return {
    angleRad: Number(theta.toFixed(5)),
    angularVelocityRadS: Number(omega.toFixed(5)),
    speedMs: Number(v.toFixed(4)),
    restoringForceN: Number(restoringForceN.toFixed(4)),
    tensionForceN: Number(tensionForceN.toFixed(4)),
    weightForceN: Number(weightForceN.toFixed(4)),
    kineticEnergyJ: inst.kineticEnergy,
    potentialEnergyJ: inst.potentialEnergy,
    bobRadiusScale: Number(Math.max(0.75, Math.min(1.42, Math.cbrt(m / 2))).toFixed(3)),
  };
}

export interface CollisionVisualState {
  cart1X: number;
  cart2X: number;
  inPostCollision: boolean;
  isStuckTogether: boolean;
  bumperCompression: number;
  impactHeatGlow: number;
  v1Current: number;
  v2Current: number;
  cart1Scale: number;
  cart2Scale: number;
}

/**
 * Computes physically exact 1D pre-impact and post-impact cart trajectories
 * matching physicsEngine.ts (collisionTime = 1.5 s).
 * Stationary carts (u = 0) remain strictly stationary until struck!
 */
export function computeCollisionCartKinematics(
  params: PhysicsParams,
  metrics: { v1Final: number; v2Final: number; energyLossPct: number },
  simTime: number
): CollisionVisualState {
  const IMPACT_T = 1.5;
  const CYCLE_T = 3.2;
  const SCALE_X = 0.22;
  const HALF_CART_SUM = 0.72; // visual contact half-width sum between cart centers

  const m1 = Math.max(0.5, Number.isFinite(params.mass) ? params.mass : 5);
  const m2 = Math.max(0.5, Number.isFinite(params.collisionMass2) ? params.collisionMass2 : 2);
  const u1 = Number.isFinite(params.initialVelocity) ? params.initialVelocity : 8;
  const u2 = Number.isFinite(params.velocity2Initial) ? params.velocity2Initial : -2;
  const e = Math.max(0, Math.min(1, Number.isFinite(params.restitutionCoeff) ? params.restitutionCoeff : 0.85));

  const cycleT = ((simTime % CYCLE_T) + CYCLE_T) % CYCLE_T;
  const inPost = cycleT >= IMPACT_T;
  const isStuckTogether = inPost && e <= 0.05;

  // Choose collision contact midpoint X = 0 (cart1 left contact = -HALF_CART_SUM/2, cart2 right contact = +HALF_CART_SUM/2)
  const contact1X = -HALF_CART_SUM * 0.5;
  const contact2X = HALF_CART_SUM * 0.5;

  let cart1X: number;
  let cart2X: number;
  let v1Current: number;
  let v2Current: number;

  if (!inPost) {
    const dtBefore = IMPACT_T - cycleT; // positive, approaches 0 at impact
    cart1X = contact1X - u1 * SCALE_X * dtBefore;
    cart2X = contact2X - u2 * SCALE_X * dtBefore;
    v1Current = u1;
    v2Current = u2;
  } else {
    const dtAfter = cycleT - IMPACT_T;
    cart1X = contact1X + metrics.v1Final * SCALE_X * dtAfter;
    cart2X = contact2X + metrics.v2Final * SCALE_X * dtAfter;
    v1Current = metrics.v1Final;
    v2Current = metrics.v2Final;
  }

  // Clamp cleanly within the 9.6 m air-track span while keeping carts separated
  cart1X = Math.max(-4.1, Math.min(3.5, cart1X));
  cart2X = Math.max(-3.5, Math.min(4.1, cart2X));
  if (cart2X - cart1X < HALF_CART_SUM) {
    const mid = 0.5 * (cart1X + cart2X);
    cart1X = mid - HALF_CART_SUM * 0.5;
    cart2X = mid + HALF_CART_SUM * 0.5;
  }

  const distFromImpact = Math.abs(cycleT - IMPACT_T);
  const bumperCompression = distFromImpact < 0.14 ? Math.cos((distFromImpact / 0.14) * Math.PI * 0.5) : 0;
  const impactHeatGlow =
    inPost && cycleT - IMPACT_T < 0.9
      ? Math.min(1, (metrics.energyLossPct / 65) * (1 - (cycleT - IMPACT_T) / 0.9))
      : 0;

  return {
    cart1X: Number(cart1X.toFixed(4)),
    cart2X: Number(cart2X.toFixed(4)),
    inPostCollision: inPost,
    isStuckTogether,
    bumperCompression: Number(bumperCompression.toFixed(3)),
    impactHeatGlow: Number(impactHeatGlow.toFixed(3)),
    v1Current: Number(v1Current.toFixed(3)),
    v2Current: Number(v2Current.toFixed(3)),
    cart1Scale: Number(Math.max(0.78, Math.min(1.28, Math.cbrt(m1 / 5))).toFixed(3)),
    cart2Scale: Number(Math.max(0.78, Math.min(1.28, Math.cbrt(m2 / 5))).toFixed(3)),
  };
}

/**
 * Computes Keplerian/Newtonian orbital angular velocity ω ∝ sqrt(M / r³) for the 3D orbital gravity rig.
 */
export function computeOrbitalAngularVelocity(massKg: number, separationDistanceM: number): {
  angularSpeedRadS: number;
  orbitalSpeedScale: number;
  planetScale: number;
  wellDepthScale: number;
} {
  const m = Math.max(0.5, Number.isFinite(massKg) ? massKg : 5);
  const r = Math.max(0.5, Number.isFinite(separationDistanceM) ? separationDistanceM : 4);
  // Normalized at baseline m = 5, r = 4 -> ω = 1.15 rad/s
  const angularSpeedRadS = Math.min(
    4.2,
    Math.max(0.22, 1.15 * Math.sqrt((m / 5) / Math.pow(r / 4, 3)))
  );
  const orbitalSpeedScale = Math.min(2.2, Math.max(0.45, Math.sqrt((m / 5) / (r / 4))));
  const planetScale = Math.min(1.55, Math.max(0.68, Math.cbrt(m / 5)));
  const wellDepthScale = Math.min(1.75, Math.max(0.55, 0.7 + (m / 12) * 0.65));
  return {
    angularSpeedRadS: Number(angularSpeedRadS.toFixed(4)),
    orbitalSpeedScale: Number(orbitalSpeedScale.toFixed(3)),
    planetScale: Number(planetScale.toFixed(3)),
    wellDepthScale: Number(wellDepthScale.toFixed(3)),
  };
}

export interface StokesDropVisualState {
  sphereY: number;
  instantVelocityMs: number;
  isFloating: boolean;
  weightArrowLen: number;
  buoyancyArrowLen: number;
  dragArrowLen: number;
  fluidColorHex: number;
  fluidOpacity: number;
}

/**
 * Models transient approach to Stokes terminal velocity v(t) = v_t * (1 - exp(-t/τ))
 * and force equilibrium F_b + F_d(t) = W (sphere floats at surface if ρ_s <= ρ_f!).
 */
export function computeStokesDropState(
  params: PhysicsParams,
  metrics: { stokesTerminalVelocity: number; stokesDragForce: number },
  simTime: number
): StokesDropVisualState {
  const rMm = Math.max(
    0.5,
    typeof params.sphereRadius === 'number' && Number.isFinite(params.sphereRadius)
      ? params.sphereRadius
      : 5
  );
  const rM = rMm / 1000;
  const rhoS = Math.max(
    100,
    typeof params.sphereDensity === 'number' && Number.isFinite(params.sphereDensity)
      ? params.sphereDensity
      : 7800
  );
  const rhoF = Math.max(
    100,
    typeof params.fluidDensity === 'number' && Number.isFinite(params.fluidDensity)
      ? params.fluidDensity
      : 1260
  );
  const eta = Math.max(
    0.01,
    typeof params.fluidViscosity === 'number' && Number.isFinite(params.fluidViscosity)
      ? params.fluidViscosity
      : 0.95
  );
  const g = Math.max(0.1, Number.isFinite(params.gravity) ? params.gravity : 9.81);
  const vt = Math.max(0, Number.isFinite(metrics.stokesTerminalVelocity) ? metrics.stokesTerminalVelocity : 0);

  const vol = (4 / 3) * Math.PI * rM * rM * rM;
  const weightN = rhoS * vol * g;
  const buoyancyN = rhoF * vol * g;
  const isFloating = rhoS <= rhoF || vt <= 1e-5;

  // Fluid visual color reflects viscosity (water clear cyan -> oil amber -> glycerin dense honey)
  const fluidColorHex = eta < 0.2 ? 0x38bdf8 : eta < 1.2 ? 0xf59e0b : 0xd97706;
  const fluidOpacity = Math.min(0.62, Math.max(0.22, 0.24 + Math.min(eta, 3.0) * 0.11));

  // Characteristic relaxation time τ = (2 * ρ_s * r²) / (9 * η)
  const tau = Math.max(0.06, (2 * rhoS * rM * rM) / (9 * eta));
  const dropTopY = 4.55;
  const dropBottomY = 0.88;
  const dropSpan = dropTopY - dropBottomY;

  let sphereY = dropTopY;
  let instantVelocityMs = 0;
  let dragN = 0;

  if (isFloating) {
    // Floats gently at the liquid meniscus
    sphereY = dropTopY + Math.sin(simTime * 2.5) * 0.04;
    instantVelocityMs = 0;
    dragN = 0;
  } else {
    // Map vt into observable drop speed while keeping exact monotonic proportionality to vt
    const visualVt = Math.min(3.4, Math.max(0.08, vt * 1.15));
    const cycleDuration = dropSpan / visualVt + 0.65;
    const tCycle = ((simTime % cycleDuration) + cycleDuration) % cycleDuration;
    const expTerm = Math.exp(-tCycle / tau);
    instantVelocityMs = vt * (1 - expTerm);
    const visualDist = visualVt * (tCycle - tau * (1 - expTerm));
    sphereY = Math.max(dropBottomY, dropTopY - visualDist);
    dragN = Math.max(0, (weightN - buoyancyN) * (1 - expTerm));
  }

  // Normalize arrows relative to Weight = 1.25 units so student clearly sees F_b + F_d = W at terminal velocity!
  const refLen = 1.25;
  const weightArrowLen = refLen;
  const buoyancyArrowLen = Math.min(1.5, Math.max(0.08, (buoyancyN / Math.max(1e-9, weightN)) * refLen));
  const dragArrowLen = isFloating
    ? 0
    : Math.min(1.4, Math.max(0.0, (dragN / Math.max(1e-9, weightN)) * refLen));

  return {
    sphereY: Number(sphereY.toFixed(4)),
    instantVelocityMs: Number(instantVelocityMs.toFixed(4)),
    isFloating,
    weightArrowLen: Number(weightArrowLen.toFixed(3)),
    buoyancyArrowLen: Number(buoyancyArrowLen.toFixed(3)),
    dragArrowLen: Number(dragArrowLen.toFixed(3)),
    fluidColorHex,
    fluidOpacity: Number(fluidOpacity.toFixed(3)),
  };
}

/**
 * Exact Young Double-Slit combined interference + single-slit diffraction envelope:
 * I(y) = cos²(π d y / (λ L)) * sinc²(π a y / (λ L)), where a = 0.22 * d.
 */
export function computeYoungFringeIntensity(
  yMm: number,
  wavelengthNm: number,
  slitDistanceMm: number,
  screenDistanceM: number
): { intensity: number; fringeSpacingMm: number } {
  const wlNm = Math.max(380, Math.min(750, Number.isFinite(wavelengthNm) ? wavelengthNm : 532));
  const dMm = Math.max(0.05, Number.isFinite(slitDistanceMm) ? slitDistanceMm : 0.25);
  const LM = Math.max(0.3, Number.isFinite(screenDistanceM) ? screenDistanceM : 1.5);

  // Δy (mm) = (λ_nm * 1e-6 mm) * (L_m * 1e3 mm) / d_mm = (wlNm * 1e-3 * LM) / dMm
  const fringeSpacingMm = (wlNm * 1e-3 * LM) / dMm;
  const beta = (Math.PI * yMm) / Math.max(1e-5, fringeSpacingMm);
  const cos2 = Math.pow(Math.cos(beta), 2);

  // Single-slit diffraction envelope with finite slit width a = 0.22 * d
  const alpha = beta * 0.22;
  const sinc = Math.abs(alpha) < 1e-5 ? 1 : Math.sin(alpha) / alpha;
  const intensity = Math.max(0, Math.min(1, cos2 * sinc * sinc));

  return {
    intensity: Number(intensity.toFixed(5)),
    fringeSpacingMm: Number(fringeSpacingMm.toFixed(4)),
  };
}

/**
 * Computes exact branch currents in a Wheatstone bridge (in mA) so 3D current carrier dots
 * match Ohm's Law and halt in the central bridge wire when R1*Rx = R2*R3.
 */
export function computeWheatstoneBranchCurrents(
  r1: number,
  r2: number,
  r3: number,
  rx: number,
  supplyVoltageV: number
): {
  iBranchTopMa: number;
  iBranchBottomMa: number;
  iGalvoSignedMa: number;
  isBalanced: boolean;
} {
  const sR1 = Math.max(1, r1);
  const sR2 = Math.max(1, r2);
  const sR3 = Math.max(1, r3);
  const sRx = Math.max(1, rx);
  const v = Math.max(0, supplyVoltageV);

  const iBranchTopMa = (v / (sR1 + sR2)) * 1000;
  const iBranchBottomMa = (v / (sR3 + sRx)) * 1000;
  const vA = v * (sR2 / (sR1 + sR2));
  const vB = v * (sRx / (sR3 + sRx));
  const iGalvoSignedMa = ((vA - vB) / 50) * 1000;
  const isBalanced = Math.abs(vA - vB) < 0.05;

  return {
    iBranchTopMa: Number(iBranchTopMa.toFixed(2)),
    iBranchBottomMa: Number(iBranchBottomMa.toFixed(2)),
    iGalvoSignedMa: Number(iGalvoSignedMa.toFixed(2)),
    isBalanced,
  };
}

export interface FaradayInductionVisualState {
  magnetCenterX: number;
  instantFluxMwb: number;
  instantEmfV: number;
  instantCurrentMa: number;
  peakEmfV: number;
  galvoNeedleAngleRad: number;
  bulbGlow: number;
  coilTurnsVisible: number;
  coilRadiusScale: number;
  /** +1 means approaching/increasing flux; -1 means receding/decreasing flux; 0 near turnaround */
  fluxChangeSign: number;
  lenzOpposingDirectionX: number;
}

/**
 * Evaluates exact sinusoidal magnet motion x(t), magnetic flux Φ(t) = B·A·cos(ωt),
 * induced EMF ε(t) = -N·dΦ/dt = N·B·A·ω·sin(ωt), Lenz opposing polarity, and galvanometer angle.
 */
export function computeFaradayInductionVisualState(
  params: PhysicsParams,
  simTime: number
): FaradayInductionVisualState {
  const N = Math.max(10, Number.isFinite(params.coilTurnsN) ? params.coilTurnsN! : 120);
  const B = Math.max(0.02, Number.isFinite(params.magneticFieldTesla) ? params.magneticFieldTesla! : 0.45);
  const f = Math.max(0.05, Number.isFinite(params.magnetOscillationHz) ? params.magnetOscillationHz! : 1.2);
  const areaCm2 = Math.max(4, Number.isFinite(params.coilAreaCm2) ? params.coilAreaCm2! : 25);
  const R = Math.max(0.5, Number.isFinite(params.loadResistanceOhm) ? params.loadResistanceOhm! : 12);

  const areaM2 = areaCm2 * 1e-4;
  const omega = 2 * Math.PI * f;
  const phase = omega * Math.max(0, simTime);
  const cosPhase = Math.cos(phase);
  const sinPhase = Math.sin(phase);

  const peakFluxMwb = B * areaM2 * 1000;
  const peakEmfV = N * B * areaM2 * omega;

  // Magnet oscillates between solenoid center (x ≈ -0.65) and outer actuator stroke (x ≈ -3.65)
  // Using -2.15 + 1.45 * cos(ωt) so magnet enters solenoid deepest at ωt = 0 (max Φ, dΦ/dt = 0)
  const magnetCenterX = -2.15 + 1.45 * cosPhase;
  const instantFluxMwb = peakFluxMwb * cosPhase;
  const instantEmfV = peakEmfV * sinPhase;
  const instantCurrentMa = (instantEmfV / R) * 1000;

  // Center-zero galvanometer deflects ±0.72 rad cleanly proportionally to normalized EMF / current
  const galvoNorm = Math.max(-1, Math.min(1, instantEmfV / Math.max(0.8, peakEmfV * 0.85)));
  const galvoNeedleAngleRad = -galvoNorm * 0.68;

  // Load bulb filament luminosity tracks instantaneous power I^2 * R
  const instPowerW = (instantEmfV * instantEmfV) / R;
  const bulbGlow = Math.min(1, Math.sqrt(instPowerW / 1.8));

  // Scale visible copper loops from 8 to 26 rings matching N (20..400) & coil radius ∝ sqrt(A)
  const coilTurnsVisible = Math.max(8, Math.min(26, Math.round(6 + (N / 400) * 20)));
  const coilRadiusScale = Math.max(0.68, Math.min(1.42, Math.sqrt(areaCm2 / 25)));

  // Flux derivative dΦ/dt ∝ -sin(ωt); Lenz induced field opposes dΦ/dt
  const fluxRate = -sinPhase;
  const fluxChangeSign = Math.abs(fluxRate) < 0.08 ? 0 : Math.sign(fluxRate);
  const lenzOpposingDirectionX = fluxChangeSign === 0 ? 0 : -fluxChangeSign;

  return {
    magnetCenterX: Number(magnetCenterX.toFixed(4)),
    instantFluxMwb: Number(instantFluxMwb.toFixed(3)),
    instantEmfV: Number(instantEmfV.toFixed(3)),
    instantCurrentMa: Number(instantCurrentMa.toFixed(1)),
    peakEmfV: Number(peakEmfV.toFixed(3)),
    galvoNeedleAngleRad: Number(galvoNeedleAngleRad.toFixed(4)),
    bulbGlow: Number(bulbGlow.toFixed(3)),
    coilTurnsVisible,
    coilRadiusScale: Number(coilRadiusScale.toFixed(3)),
    fluxChangeSign,
    lenzOpposingDirectionX,
  };
}

