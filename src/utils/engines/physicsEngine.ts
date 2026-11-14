export type PhysicsMode =
  | 'newton-incline'
  | 'projectile-gravity'
  | 'orbital-gravity'
  | 'collision-momentum'
  | 'spring-hooke'
  | 'pendulum-harmonic'
  | 'stokes-viscosity'
  | 'ohm-wheatstone'
  | 'optics-young-slit'
  | 'photoelectric-planck';

export interface PhysicsParams {
  mass: number; // kg (0.5 - 50)
  appliedForce: number; // N (-200 to 500)
  inclineAngle: number; // degrees (0 - 60)
  frictionCoeffStatic: number; // mu_s (0 - 1.0)
  frictionCoeffKinetic: number; // mu_k (0 - 0.8)
  gravity: number; // m/s^2
  initialVelocity: number; // m/s (v0 or v1_initial)
  launchAngle: number; // degrees (0 - 85)
  initialHeight: number; // m (0 - 100)
  secondaryMass: number; // kg (for universal gravity or m2 in collision)
  separationDistance: number; // m (1 - 50)
  collisionMass2: number; // kg (0.5 - 30)
  velocity2Initial: number; // m/s (-30 to 30)
  restitutionCoeff: number; // e (0.0 inelastic to 1.0 elastic)
  springConstantK: number; // N/m (10 - 500)
  springDisplacement: number; // m (-2.0 to 2.0)
  dampingCoeff: number; // N*s/m (0 - 5)
  mode: PhysicsMode;
  // Advanced Physics Modules Canonical Parameters
  pendulumLength?: number; // m (0.2 - 2.5)
  pendulumAngle?: number; // degrees (5 - 60)
  fluidViscosity?: number; // Pa·s (0.01 - 2.0)
  sphereRadius?: number; // mm (1 - 25)
  sphereDensity?: number; // kg/m³
  fluidDensity?: number; // kg/m³
  circuitVoltage?: number; // V (1 - 30)
  resistorR1?: number; // Ohm (10 - 1000)
  resistorR2?: number; // Ohm (10 - 1000)
  resistorR3?: number; // Ohm (10 - 1000)
  resistorRx?: number; // Ohm (10 - 1000)
  slitDistance?: number; // mm (0.05 - 1.0)
  screenDistance?: number; // m (0.5 - 3.0)
  lightWavelength?: number; // nm (380 - 750)
  targetMetalWorkFunction?: number; // eV (2.0 - 5.5)
  photonFrequency?: number; // x10^14 Hz (4.0 - 15.0)
  stoppingPotential?: number; // V (0 - 5.0)
}

export function normalizeLegacyPhysicsParams(
  raw: Record<string, unknown>
): PhysicsParams {
  const copy: Record<string, unknown> = { ...raw };
  const aliasPairs: Array<[string, keyof PhysicsParams]> = [
    ['fluidViscosityPaS', 'fluidViscosity'],
    ['sphereRadiusMm', 'sphereRadius'],
    ['sphereDensityKgM3', 'sphereDensity'],
    ['fluidDensityKgM3', 'fluidDensity'],
    ['circuitVoltageV', 'circuitVoltage'],
    ['bridgeR1', 'resistorR1'],
    ['bridgeR2', 'resistorR2'],
    ['bridgeR3', 'resistorR3'],
    ['bridgeRx', 'resistorRx'],
  ];

  for (const [legacyKey, canonicalKey] of aliasPairs) {
    if (copy[canonicalKey] === undefined && copy[legacyKey] !== undefined) {
      copy[canonicalKey] = copy[legacyKey];
    }
    delete copy[legacyKey];
  }

  if (copy.mode === 'projectile-motion') copy.mode = 'projectile-gravity';
  if (copy.mode === 'gravity-orbital') copy.mode = 'orbital-gravity';

  return copy as unknown as PhysicsParams;
}

export interface PhysicsMetricsBase {
  mode: PhysicsMode;
  weightForce: number;
  normalForce: number;
  gravityParallel: number;
  maxStaticFriction: number;
  frictionForce: number;
  netForce: number;
  acceleration: number;
  isMoving: boolean;
}

export interface NewtonInclineMetrics extends PhysicsMetricsBase {
  mode: 'newton-incline';
}

export interface ProjectileGravityMetrics extends PhysicsMetricsBase {
  mode: 'projectile-gravity';
  maxProjectileHeight: number; // m
  projectileRange: number; // m
  timeOfFlight: number; // s
}

export interface OrbitalGravityMetrics extends PhysicsMetricsBase {
  mode: 'orbital-gravity';
  universalGravityForce: number; // µN
  escapeVelocitySurface: number; // km/s
}

export interface CollisionMomentumMetrics extends PhysicsMetricsBase {
  mode: 'collision-momentum';
  initialTotalMomentum: number; // kg*m/s
  finalTotalMomentum: number; // kg*m/s
  v1Final: number; // m/s
  v2Final: number; // m/s
  kineticEnergyInitial: number; // J
  kineticEnergyFinal: number; // J
  energyLossPct: number; // %
}

export interface SpringHookeMetrics extends PhysicsMetricsBase {
  mode: 'spring-hooke';
  springRestoringForce: number; // F = -k*x (N)
  springPotentialEnergy: number; // Ep = 0.5*k*x^2 (J)
  oscillationPeriod: number; // T = 2*pi*sqrt(m/k) (s)
  angularFrequency: number; // omega = sqrt(k/m) (rad/s)
}

export interface PendulumHarmonicMetrics extends PhysicsMetricsBase {
  mode: 'pendulum-harmonic';
  pendulumPeriod: number; // s
  pendulumFrequency: number; // Hz
}

export interface StokesViscosityMetrics extends PhysicsMetricsBase {
  mode: 'stokes-viscosity';
  stokesTerminalVelocity: number; // m/s
  stokesDragForce: number; // N
}

export interface OhmWheatstoneMetrics extends PhysicsMetricsBase {
  mode: 'ohm-wheatstone';
  circuitCurrent: number; // A
  galvanometerCurrent: number; // mA
  bridgeBalanced: boolean;
}

export interface OpticsYoungSlitMetrics extends PhysicsMetricsBase {
  mode: 'optics-young-slit';
  fringeSpacingMm: number; // mm
}

export interface PhotoelectricPlanckMetrics extends PhysicsMetricsBase {
  mode: 'photoelectric-planck';
  photoelectricMaxKe: number; // eV
  photoelectricStoppingVoltage: number; // V
  photoelectricEmitted: boolean;
}

export type PhysicsMetrics =
  | NewtonInclineMetrics
  | ProjectileGravityMetrics
  | OrbitalGravityMetrics
  | CollisionMomentumMetrics
  | SpringHookeMetrics
  | PendulumHarmonicMetrics
  | StokesViscosityMetrics
  | OhmWheatstoneMetrics
  | OpticsYoungSlitMetrics
  | PhotoelectricPlanckMetrics;

export interface KinematicsInstant {
  time: number; // s
  positionX: number; // m
  positionY: number; // m
  velocityX: number; // m/s
  velocityY: number; // m/s
  speed: number; // m/s
  acceleration: number; // m/s^2
  kineticEnergy: number; // J
  potentialEnergy: number; // J
  totalMechanicalEnergy: number; // J
  momentum: number; // kg*m/s
  // Advanced trajectory states
  pendulumAngleRad?: number;
  pendulumAngularVelocity?: number;
}

export const GRAVITY_PRESETS = [
  { id: 'earth', name: 'Bumi (g = 9.81 m/s²)', g: 9.81 },
  { id: 'moon', name: 'Bulan (g = 1.62 m/s²)', g: 1.62 },
  { id: 'mars', name: 'Mars (g = 3.72 m/s²)', g: 3.72 },
  { id: 'jupiter', name: 'Jupiter (g = 24.79 m/s²)', g: 24.79 },
  { id: 'zero-g', name: 'Mikrogravitasi Orbit (g = 0.05 m/s²)', g: 0.05 },
];

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeRound(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

function normalizePhysicsMode(mode: PhysicsMode | string): PhysicsMode {
  if (mode === 'projectile-motion') return 'projectile-gravity';
  if (mode === 'gravity-orbital') return 'orbital-gravity';
  return mode as PhysicsMode;
}

export function calculatePhysicsMetrics(params: PhysicsParams): PhysicsMetrics {
  const mode = normalizePhysicsMode(params.mode);
  const m1 = Math.max(finiteOr(params.mass, 1.0), 1e-6);
  const g = Math.max(finiteOr(params.gravity, 9.81), 0);
  const gSafe = Math.max(g, 1e-6);
  const inclineAngle = finiteOr(params.inclineAngle, 0);
  const launchAngle = finiteOr(params.launchAngle, 0);
  const appliedForce = finiteOr(params.appliedForce, 0);
  const frictionStatic = Math.max(finiteOr(params.frictionCoeffStatic, 0), 0);
  const frictionKinetic = Math.max(finiteOr(params.frictionCoeffKinetic, 0), 0);
  const initialVelocity = finiteOr(params.initialVelocity, 0);

  const thetaRad = (inclineAngle * Math.PI) / 180;
  const launchRad = (launchAngle * Math.PI) / 180;

  const weightForce = m1 * g;
  const normalForce = weightForce * Math.cos(thetaRad);
  const gravityParallel = weightForce * Math.sin(thetaRad);

  const drivingForce = appliedForce - gravityParallel;
  const maxStaticFriction = frictionStatic * normalForce;
  const kineticFrictionMag = frictionKinetic * normalForce;

  let frictionForce = 0;
  let netForce = 0;
  let isMoving = false;

  if (Math.abs(drivingForce) > maxStaticFriction || Math.abs(initialVelocity) > 0.01) {
    isMoving = true;
    const direction =
      Math.abs(drivingForce) > 0.001
        ? Math.sign(drivingForce)
        : Math.sign(initialVelocity || 1);
    frictionForce = -direction * kineticFrictionMag;
    netForce = drivingForce + frictionForce;
  } else {
    isMoving = false;
    frictionForce = -drivingForce;
    netForce = 0;
  }

  const acceleration = netForce / Math.max(m1, 1e-6);

  const base = {
    weightForce: safeRound(weightForce, 3),
    normalForce: safeRound(normalForce, 3),
    gravityParallel: safeRound(gravityParallel, 3),
    maxStaticFriction: safeRound(maxStaticFriction, 3),
    frictionForce: safeRound(frictionForce, 3),
    netForce: safeRound(netForce, 3),
    acceleration: safeRound(acceleration, 3),
    isMoving,
  };

  switch (mode) {
    case 'projectile-gravity': {
      const v0 = Math.max(0, initialVelocity);
      const v0y = v0 * Math.sin(launchRad);
      const v0x = v0 * Math.cos(launchRad);
      const h0 = Math.max(0, finiteOr(params.initialHeight, 0));

      let maxProjectileHeight = h0;
      let timeOfFlight = 0;
      let projectileRange = 0;

      if (g > 0.001) {
        maxProjectileHeight = h0 + (v0y * v0y) / Math.max(2 * gSafe, 1e-6);
        const discriminant = Math.max(0, v0y * v0y + 2 * gSafe * h0);
        timeOfFlight = (v0y + Math.sqrt(discriminant)) / gSafe;
        projectileRange = v0x * timeOfFlight;
      } else {
        timeOfFlight = 10;
        maxProjectileHeight = h0 + v0y * 10;
        projectileRange = v0x * 10;
      }

      return {
        ...base,
        mode: 'projectile-gravity',
        maxProjectileHeight: safeRound(maxProjectileHeight, 2),
        projectileRange: safeRound(projectileRange, 2),
        timeOfFlight: safeRound(timeOfFlight, 2),
      };
    }

    case 'orbital-gravity': {
      const G_CONST = 6.6743e-11;
      const r = Math.max(finiteOr(params.separationDistance, 1.0), 1e-6);
      const secondaryMass = Math.max(finiteOr(params.secondaryMass, 0), 0);
      const universalGravityForce =
        ((G_CONST * m1 * secondaryMass) / Math.max(r * r, 1e-6)) * 1e6; // µN
      const escapeVelocitySurface = Math.sqrt(Math.max(0, 2 * g * 6.371e6)) / 1000;

      return {
        ...base,
        mode: 'orbital-gravity',
        universalGravityForce: safeRound(universalGravityForce, 4),
        escapeVelocitySurface: safeRound(escapeVelocitySurface, 2),
      };
    }

    case 'collision-momentum': {
      const m2 = Math.max(finiteOr(params.collisionMass2, 3.0), 1e-6);
      const totalCollisionMass = Math.max(m1 + m2, 1e-6);
      const u1 = initialVelocity;
      const u2 = finiteOr(params.velocity2Initial, -2.0);
      const e = Math.max(0, Math.min(1, finiteOr(params.restitutionCoeff, 1.0)));

      const initialTotalMomentum = m1 * u1 + m2 * u2;
      const v1Final = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / totalCollisionMass;
      const v2Final = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / totalCollisionMass;
      const finalTotalMomentum = m1 * v1Final + m2 * v2Final;

      const kineticEnergyInitial = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
      const kineticEnergyFinal =
        0.5 * m1 * v1Final * v1Final + 0.5 * m2 * v2Final * v2Final;
      const energyLossPct =
        kineticEnergyInitial > 0.0001
          ? Math.max(
              0,
              ((kineticEnergyInitial - kineticEnergyFinal) /
                Math.max(kineticEnergyInitial, 1e-6)) *
                100
            )
          : 0;

      return {
        ...base,
        mode: 'collision-momentum',
        initialTotalMomentum: safeRound(initialTotalMomentum, 2),
        finalTotalMomentum: safeRound(finalTotalMomentum, 2),
        v1Final: safeRound(v1Final, 2),
        v2Final: safeRound(v2Final, 2),
        kineticEnergyInitial: safeRound(kineticEnergyInitial, 2),
        kineticEnergyFinal: safeRound(kineticEnergyFinal, 2),
        energyLossPct: safeRound(energyLossPct, 1),
      };
    }

    case 'spring-hooke': {
      const k = Math.max(finiteOr(params.springConstantK, 120), 1e-6);
      const xDisp = finiteOr(params.springDisplacement, 0.8);
      const springRestoringForce = -k * xDisp;
      const springPotentialEnergy = 0.5 * k * xDisp * xDisp;
      const angularFrequency = Math.max(Math.sqrt(Math.max(k / Math.max(m1, 1e-6), 1e-6)), 1e-6);
      const oscillationPeriod = (2 * Math.PI) / Math.max(angularFrequency, 1e-6);

      return {
        ...base,
        mode: 'spring-hooke',
        springRestoringForce: safeRound(springRestoringForce, 2),
        springPotentialEnergy: safeRound(springPotentialEnergy, 2),
        oscillationPeriod: safeRound(oscillationPeriod, 2),
        angularFrequency: safeRound(angularFrequency, 2),
      };
    }

    case 'pendulum-harmonic': {
      const pLength = Math.max(finiteOr(params.pendulumLength, 1.0), 1e-6);
      const pendulumPeriod = Math.max(
        2 * Math.PI * Math.sqrt(Math.max(pLength / gSafe, 1e-6)),
        1e-6
      );
      const pendulumFrequency = 1 / Math.max(pendulumPeriod, 1e-6);

      return {
        ...base,
        mode: 'pendulum-harmonic',
        pendulumPeriod: safeRound(pendulumPeriod, 2),
        pendulumFrequency: safeRound(pendulumFrequency, 2),
      };
    }

    case 'stokes-viscosity': {
      const rStokesM = Math.max(finiteOr(params.sphereRadius, 5), 1e-6) / 1000;
      const etaStokes = Math.max(finiteOr(params.fluidViscosity, 0.8), 1e-6);
      const rhoSphere = finiteOr(params.sphereDensity, 7800);
      const rhoFluid = finiteOr(params.fluidDensity, 1260);
      const stokesTerminalVelocity = Math.max(
        0,
        (2 * rStokesM * rStokesM * (rhoSphere - rhoFluid) * g) /
          Math.max(9 * etaStokes, 1e-6)
      );
      const stokesDragForce = 6 * Math.PI * etaStokes * rStokesM * stokesTerminalVelocity;

      return {
        ...base,
        mode: 'stokes-viscosity',
        stokesTerminalVelocity: safeRound(stokesTerminalVelocity, 3),
        stokesDragForce: safeRound(stokesDragForce, 4),
      };
    }

    case 'ohm-wheatstone': {
      const vCircuit = finiteOr(params.circuitVoltage, 12);
      const r1 = Math.max(finiteOr(params.resistorR1, 100), 1e-6);
      const r2 = Math.max(finiteOr(params.resistorR2, 200), 1e-6);
      const r3 = Math.max(finiteOr(params.resistorR3, 150), 1e-6);
      const rx = Math.max(finiteOr(params.resistorRx, 300), 1e-6);
      const rTop = Math.max(r1 + r2, 1e-6);
      const rBot = Math.max(r3 + rx, 1e-6);
      const rEq = Math.max((rTop * rBot) / Math.max(rTop + rBot, 1e-6), 1e-6);
      const circuitCurrent = vCircuit / rEq;
      const vA = vCircuit * (r2 / rTop);
      const vB = vCircuit * (rx / rBot);
      const galvanometerCurrent = (Math.abs(vA - vB) / 50) * 1000;
      const bridgeBalanced = Math.abs(r1 * rx - r2 * r3) < 0.5;

      return {
        ...base,
        mode: 'ohm-wheatstone',
        circuitCurrent: safeRound(circuitCurrent, 3),
        galvanometerCurrent: safeRound(galvanometerCurrent, 2),
        bridgeBalanced,
      };
    }

    case 'optics-young-slit': {
      const slitDistMm = Math.max(finiteOr(params.slitDistance, 0.25), 1e-6);
      const screenDistM = Math.max(finiteOr(params.screenDistance, 1.5), 1e-6);
      const lambdaNm = Math.max(finiteOr(params.lightWavelength, 532), 1e-6);
      const fringeSpacingMm = (lambdaNm * 1e-6 * screenDistM * 1000) / slitDistMm;

      return {
        ...base,
        mode: 'optics-young-slit',
        fringeSpacingMm: safeRound(fringeSpacingMm, 2),
      };
    }

    case 'photoelectric-planck': {
      const hPlanckEv = 4.135667696e-15;
      const fPhotonHz = Math.max(finiteOr(params.photonFrequency, 7.5), 0) * 1e14;
      const ePhotonEv = hPlanckEv * fPhotonHz;
      const workFuncEv = Math.max(finiteOr(params.targetMetalWorkFunction, 2.28), 0);
      const photoelectricMaxKe = Math.max(0, ePhotonEv - workFuncEv);
      const photoelectricStoppingVoltage = photoelectricMaxKe;
      const photoelectricEmitted = ePhotonEv > workFuncEv;

      return {
        ...base,
        mode: 'photoelectric-planck',
        photoelectricMaxKe: safeRound(photoelectricMaxKe, 2),
        photoelectricStoppingVoltage: safeRound(photoelectricStoppingVoltage, 2),
        photoelectricEmitted,
      };
    }

    case 'newton-incline':
    default:
      return {
        ...base,
        mode: 'newton-incline',
      };
  }
}

export function evaluateKinematicsAtTime(params: PhysicsParams, t: number): KinematicsInstant {
  const metrics = calculatePhysicsMetrics(params);
  const time = Math.max(0, finiteOr(t, 0));
  const m = Math.max(finiteOr(params.mass, 1.0), 1e-6);
  const g = Math.max(0, finiteOr(params.gravity, 9.81));
  const initialVelocity = finiteOr(params.initialVelocity, 0);
  const initialHeight = finiteOr(params.initialHeight, 0);

  if (metrics.mode === 'projectile-gravity') {
    const launchRad = (finiteOr(params.launchAngle, 0) * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(launchRad);
    const v0y = initialVelocity * Math.sin(launchRad);
    const effectiveTime = g > 0.001 ? Math.min(time, metrics.timeOfFlight) : time;

    const posX = v0x * effectiveTime;
    const posY = Math.max(
      0,
      initialHeight +
        v0y * effectiveTime -
        0.5 * g * effectiveTime * effectiveTime
    );
    const velX =
      posY <= 0 && effectiveTime >= metrics.timeOfFlight && g > 0.001 ? 0 : v0x;
    const velY =
      posY <= 0 && effectiveTime >= metrics.timeOfFlight && g > 0.001
        ? 0
        : v0y - g * effectiveTime;
    const speed = Math.sqrt(Math.max(0, velX * velX + velY * velY));
    const ke = 0.5 * m * speed * speed;
    const pe = m * g * posY;

    return {
      time: safeRound(effectiveTime, 2),
      positionX: safeRound(posX, 2),
      positionY: safeRound(posY, 2),
      velocityX: safeRound(velX, 2),
      velocityY: safeRound(velY, 2),
      speed: safeRound(speed, 2),
      acceleration: safeRound(-g, 2),
      kineticEnergy: safeRound(ke, 2),
      potentialEnergy: safeRound(pe, 2),
      totalMechanicalEnergy: safeRound(ke + pe, 2),
      momentum: safeRound(m * speed, 2),
    };
  }

  if (metrics.mode === 'spring-hooke') {
    const k = Math.max(finiteOr(params.springConstantK, 120), 1e-6);
    const A = finiteOr(params.springDisplacement, 0.8);
    const b = Math.max(0, finiteOr(params.dampingCoeff, 0.15));
    const gamma = b / Math.max(2 * m, 1e-6);
    const omega0 = Math.sqrt(Math.max(k / m, 1e-6));
    const omegaD = Math.sqrt(Math.max(1e-6, omega0 * omega0 - gamma * gamma));
    const envelope = Math.exp(-gamma * time);
    const posX = A * envelope * Math.cos(omegaD * time);
    const velX = -A * envelope * (gamma * Math.cos(omegaD * time) + omegaD * Math.sin(omegaD * time));
    const accX = -(k / m) * posX - (b / m) * velX;
    const ke = 0.5 * m * velX * velX;
    const pe = 0.5 * k * posX * posX;

    return {
      time: safeRound(time, 2),
      positionX: safeRound(posX, 2),
      positionY: 0,
      velocityX: safeRound(velX, 2),
      velocityY: 0,
      speed: safeRound(Math.abs(velX), 2),
      acceleration: safeRound(accX, 2),
      kineticEnergy: safeRound(ke, 2),
      potentialEnergy: safeRound(pe, 2),
      totalMechanicalEnergy: safeRound(ke + pe, 2),
      momentum: safeRound(m * Math.abs(velX), 2),
    };
  }

  if (metrics.mode === 'collision-momentum') {
    const collisionTime = 1.5;
    const isAfterImpact = time >= collisionTime;
    const vCurrent = isAfterImpact ? metrics.v1Final : initialVelocity;
    const posX = isAfterImpact
      ? initialVelocity * collisionTime +
        metrics.v1Final * Math.max(time - collisionTime, 1e-6)
      : initialVelocity * time;

    return {
      time: safeRound(time, 2),
      positionX: safeRound(posX, 2),
      positionY: 0,
      velocityX: safeRound(vCurrent, 2),
      velocityY: 0,
      speed: safeRound(Math.abs(vCurrent), 2),
      acceleration: 0,
      kineticEnergy: isAfterImpact
        ? metrics.kineticEnergyFinal
        : metrics.kineticEnergyInitial,
      potentialEnergy: 0,
      totalMechanicalEnergy: isAfterImpact
        ? metrics.kineticEnergyFinal
        : metrics.kineticEnergyInitial,
      momentum: metrics.initialTotalMomentum,
    };
  }

  if (metrics.mode === 'pendulum-harmonic') {
    const L = Math.max(finiteOr(params.pendulumLength, 1.0), 1e-6);
    const theta0Rad = (finiteOr(params.pendulumAngle, 25) * Math.PI) / 180;
    const omega = Math.sqrt(Math.max(g, 0) / Math.max(L, 1e-6));
    const thetaT = theta0Rad * Math.cos(omega * time) * Math.exp(-0.02 * time);
    const angVel = -theta0Rad * omega * Math.sin(omega * time) * Math.exp(-0.02 * time);
    const posX = L * Math.sin(thetaT);
    const posY = -L * Math.cos(thetaT);
    const speed = Math.abs(L * angVel);
    const ke = 0.5 * m * speed * speed;
    const pe = m * g * (posY + L);
    return {
      time: safeRound(time, 2),
      positionX: safeRound(posX, 3),
      positionY: safeRound(posY, 3),
      velocityX: safeRound(speed * Math.cos(thetaT), 3),
      velocityY: safeRound(speed * Math.sin(thetaT), 3),
      speed: safeRound(speed, 3),
      acceleration: safeRound(L * angVel * angVel, 2),
      kineticEnergy: safeRound(ke, 2),
      potentialEnergy: safeRound(pe, 2),
      totalMechanicalEnergy: safeRound(ke + pe, 2),
      momentum: safeRound(m * speed, 2),
      pendulumAngleRad: safeRound(thetaT, 6),
      pendulumAngularVelocity: safeRound(angVel, 6),
    };
  }

  const a = metrics.acceleration;
  const v0 = initialVelocity;
  const s = v0 * time + 0.5 * a * time * time;
  const v = v0 + a * time;
  const thetaRad = (finiteOr(params.inclineAngle, 0) * Math.PI) / 180;
  const posX = s * Math.cos(thetaRad);
  const posY = Math.max(0, initialHeight + s * Math.sin(thetaRad));
  const speed = Math.abs(v);
  const ke = 0.5 * m * speed * speed;
  const pe = m * g * posY;

  return {
    time: safeRound(time, 2),
    positionX: safeRound(posX, 2),
    positionY: safeRound(posY, 2),
    velocityX: safeRound(v * Math.cos(thetaRad), 2),
    velocityY: safeRound(v * Math.sin(thetaRad), 2),
    speed: safeRound(speed, 2),
    acceleration: safeRound(a, 2),
    kineticEnergy: safeRound(ke, 2),
    potentialEnergy: safeRound(pe, 2),
    totalMechanicalEnergy: safeRound(ke + pe, 2),
    momentum: safeRound(m * speed, 2),
  };
}

