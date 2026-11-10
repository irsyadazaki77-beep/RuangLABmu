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
  // Advanced Physics Modules Parameters
  pendulumLength?: number; // m (0.2 - 2.5)
  pendulumAngle?: number; // degrees (5 - 60)
  fluidViscosity?: number; // Pa·s (0.01 - 2.0)
  fluidViscosityPaS?: number;
  sphereRadius?: number; // mm (1 - 25)
  sphereRadiusMm?: number;
  sphereDensity?: number; // kg/m³
  sphereDensityKgM3?: number;
  fluidDensity?: number; // kg/m³
  fluidDensityKgM3?: number;
  circuitVoltage?: number; // V (1 - 30)
  circuitVoltageV?: number;
  resistorR1?: number; // Ohm (10 - 1000)
  bridgeR1?: number;
  resistorR2?: number; // Ohm (10 - 1000)
  bridgeR2?: number;
  resistorR3?: number; // Ohm (10 - 1000)
  bridgeR3?: number;
  resistorRx?: number; // Ohm (10 - 1000)
  bridgeRx?: number;
  slitDistance?: number; // mm (0.05 - 1.0)
  screenDistance?: number; // m (0.5 - 3.0)
  lightWavelength?: number; // nm (380 - 750)
  targetMetalWorkFunction?: number; // eV (2.0 - 5.5)
  photonFrequency?: number; // x10^14 Hz (4.0 - 15.0)
  stoppingPotential?: number; // V (0 - 5.0)
}

export interface PhysicsMetrics {
  weightForce: number;
  normalForce: number;
  gravityParallel: number;
  maxStaticFriction: number;
  frictionForce: number;
  netForce: number;
  acceleration: number;
  isMoving: boolean;
  universalGravityForce: number; // µN
  escapeVelocitySurface: number; // km/s
  maxProjectileHeight: number; // m
  projectileRange: number; // m
  timeOfFlight: number; // s
  initialTotalMomentum: number; // kg*m/s
  finalTotalMomentum: number; // kg*m/s
  v1Final: number; // m/s
  v2Final: number; // m/s
  kineticEnergyInitial: number; // J
  kineticEnergyFinal: number; // J
  energyLossPct: number; // %
  springRestoringForce: number; // F = -k*x (N)
  springPotentialEnergy: number; // Ep = 0.5*k*x^2 (J)
  oscillationPeriod: number; // T = 2*pi*sqrt(m/k) (s)
  angularFrequency: number; // omega = sqrt(k/m) (rad/s)
  // Advanced Module Metrics
  pendulumPeriod?: number; // s
  pendulumFrequency?: number; // Hz
  stokesTerminalVelocity?: number; // m/s
  stokesDragForce?: number; // N
  circuitCurrent?: number; // A
  galvanometerCurrent?: number; // mA
  bridgeBalanced?: boolean;
  fringeSpacingMm?: number; // mm
  photoelectricMaxKe?: number; // eV
  photoelectricStoppingVoltage?: number; // V
  photoelectricEmitted?: boolean;
}

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

export function calculatePhysicsMetrics(params: PhysicsParams): PhysicsMetrics {
  const m1 = Math.max(0.1, params.mass);
  const g = Math.max(0, params.gravity);
  const thetaRad = (params.inclineAngle * Math.PI) / 180;
  const launchRad = (params.launchAngle * Math.PI) / 180;

  const weightForce = m1 * g;
  const normalForce = weightForce * Math.cos(thetaRad);
  const gravityParallel = weightForce * Math.sin(thetaRad);

  const drivingForce = params.appliedForce - gravityParallel;
  const maxStaticFriction = params.frictionCoeffStatic * normalForce;
  const kineticFrictionMag = params.frictionCoeffKinetic * normalForce;

  let frictionForce = 0;
  let netForce = 0;
  let isMoving = false;

  if (Math.abs(drivingForce) > maxStaticFriction || Math.abs(params.initialVelocity) > 0.01) {
    isMoving = true;
    const direction =
      Math.abs(drivingForce) > 0.001
        ? Math.sign(drivingForce)
        : Math.sign(params.initialVelocity || 1);
    frictionForce = -direction * kineticFrictionMag;
    netForce = drivingForce + frictionForce;
  } else {
    isMoving = false;
    frictionForce = -drivingForce;
    netForce = 0;
  }

  const acceleration = netForce / m1;

  // Universal Gravitation
  const G_CONST = 6.6743e-11;
  const r = Math.max(0.5, params.separationDistance);
  const universalGravityForce = ((G_CONST * m1 * params.secondaryMass) / (r * r)) * 1e6; // µN

  // Projectile Kinematics
  const v0 = Math.max(0, params.initialVelocity);
  const v0y = v0 * Math.sin(launchRad);
  const v0x = v0 * Math.cos(launchRad);
  const h0 = Math.max(0, params.initialHeight);

  let maxProjectileHeight = h0;
  let timeOfFlight = 0;
  let projectileRange = 0;

  if (g > 0.001) {
    maxProjectileHeight = h0 + (v0y * v0y) / (2 * g);
    const discriminant = v0y * v0y + 2 * g * h0;
    timeOfFlight = (v0y + Math.sqrt(Math.max(0, discriminant))) / g;
    projectileRange = v0x * timeOfFlight;
  } else {
    timeOfFlight = 10;
    maxProjectileHeight = h0 + v0y * 10;
    projectileRange = v0x * 10;
  }

  const escapeVelocitySurface = Math.sqrt(2 * g * 6.371e6) / 1000;

  // 1D Collision & Momentum Conservation Calculations
  const m2 = Math.max(0.1, params.collisionMass2 || 3.0);
  const u1 = params.initialVelocity;
  const u2 = params.velocity2Initial ?? -2.0;
  const e = Math.max(0, Math.min(1, params.restitutionCoeff ?? 1.0));

  const initialTotalMomentum = m1 * u1 + m2 * u2;
  const v1Final = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / (m1 + m2);
  const v2Final = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);
  const finalTotalMomentum = m1 * v1Final + m2 * v2Final;

  const kineticEnergyInitial = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const kineticEnergyFinal =
    0.5 * m1 * v1Final * v1Final + 0.5 * m2 * v2Final * v2Final;
  const energyLossPct =
    kineticEnergyInitial > 0.0001
      ? Math.max(
          0,
          ((kineticEnergyInitial - kineticEnergyFinal) / kineticEnergyInitial) * 100
        )
      : 0;

  // Spring Hooke Oscillation Calculations
  const k = Math.max(5, params.springConstantK || 120);
  const xDisp = params.springDisplacement ?? 0.8;
  const springRestoringForce = -k * xDisp;
  const springPotentialEnergy = 0.5 * k * xDisp * xDisp;
  const angularFrequency = Math.sqrt(k / m1);
  const oscillationPeriod = (2 * Math.PI) / angularFrequency;

  // Advanced physics calculations
  const pLength = Math.max(0.1, params.pendulumLength ?? 1.0);
  const pendulumPeriod = 2 * Math.PI * Math.sqrt(pLength / Math.max(0.01, g));
  const pendulumFrequency = 1 / pendulumPeriod;

  const rStokesM = Math.max(0.001, (params.sphereRadiusMm ?? params.sphereRadius ?? 5) / 1000);
  const etaStokes = Math.max(0.01, params.fluidViscosityPaS ?? params.fluidViscosity ?? 0.8);
  const rhoSphere = params.sphereDensityKgM3 ?? params.sphereDensity ?? 7800;
  const rhoFluid = params.fluidDensityKgM3 ?? params.fluidDensity ?? 1260;
  const stokesTerminalVelocity = Math.max(
    0,
    (2 * rStokesM * rStokesM * (rhoSphere - rhoFluid) * g) / (9 * etaStokes)
  );
  const stokesDragForce = 6 * Math.PI * etaStokes * rStokesM * stokesTerminalVelocity;

  const vCircuit = params.circuitVoltageV ?? params.circuitVoltage ?? 12;
  const r1 = Math.max(1, params.bridgeR1 ?? params.resistorR1 ?? 100);
  const r2 = Math.max(1, params.bridgeR2 ?? params.resistorR2 ?? 200);
  const r3 = Math.max(1, params.bridgeR3 ?? params.resistorR3 ?? 150);
  const rx = Math.max(1, params.bridgeRx ?? params.resistorRx ?? 300);
  const rTop = r1 + r2;
  const rBot = r3 + rx;
  const rEq = (rTop * rBot) / (rTop + rBot);
  const circuitCurrent = vCircuit / rEq;
  const vA = vCircuit * (r2 / rTop);
  const vB = vCircuit * (rx / rBot);
  const galvanometerCurrent = (Math.abs(vA - vB) / 50) * 1000;
  const bridgeBalanced = Math.abs(r1 * rx - r2 * r3) < 0.5;

  const slitDistM = Math.max(1e-5, (params.slitDistance ?? 0.25) / 1000);
  const screenDistM = Math.max(0.1, params.screenDistance ?? 1.5);
  const lambdaM = Math.max(380, params.lightWavelength ?? 532) * 1e-9;
  const fringeSpacingMm = ((lambdaM * screenDistM) / slitDistM) * 1000;

  const hPlanckEv = 4.135667696e-15;
  const fPhotonHz = (params.photonFrequency ?? 7.5) * 1e14;
  const ePhotonEv = hPlanckEv * fPhotonHz;
  const workFuncEv = params.targetMetalWorkFunction ?? 2.28;
  const photoelectricMaxKe = Math.max(0, ePhotonEv - workFuncEv);
  const photoelectricStoppingVoltage = photoelectricMaxKe;
  const photoelectricEmitted = ePhotonEv > workFuncEv;

  return {
    weightForce: Number(weightForce.toFixed(3)),
    normalForce: Number(normalForce.toFixed(3)),
    gravityParallel: Number(gravityParallel.toFixed(3)),
    maxStaticFriction: Number(maxStaticFriction.toFixed(3)),
    frictionForce: Number(frictionForce.toFixed(3)),
    netForce: Number(netForce.toFixed(3)),
    acceleration: Number(acceleration.toFixed(3)),
    isMoving,
    universalGravityForce: Number(universalGravityForce.toFixed(4)),
    escapeVelocitySurface: Number(escapeVelocitySurface.toFixed(2)),
    maxProjectileHeight: Number(maxProjectileHeight.toFixed(2)),
    projectileRange: Number(projectileRange.toFixed(2)),
    timeOfFlight: Number(timeOfFlight.toFixed(2)),
    initialTotalMomentum: Number(initialTotalMomentum.toFixed(2)),
    finalTotalMomentum: Number(finalTotalMomentum.toFixed(2)),
    v1Final: Number(v1Final.toFixed(2)),
    v2Final: Number(v2Final.toFixed(2)),
    kineticEnergyInitial: Number(kineticEnergyInitial.toFixed(2)),
    kineticEnergyFinal: Number(kineticEnergyFinal.toFixed(2)),
    energyLossPct: Number(energyLossPct.toFixed(1)),
    springRestoringForce: Number(springRestoringForce.toFixed(2)),
    springPotentialEnergy: Number(springPotentialEnergy.toFixed(2)),
    oscillationPeriod: Number(oscillationPeriod.toFixed(2)),
    angularFrequency: Number(angularFrequency.toFixed(2)),
    pendulumPeriod: Number(pendulumPeriod.toFixed(2)),
    pendulumFrequency: Number(pendulumFrequency.toFixed(2)),
    stokesTerminalVelocity: Number(stokesTerminalVelocity.toFixed(3)),
    stokesDragForce: Number(stokesDragForce.toFixed(4)),
    circuitCurrent: Number(circuitCurrent.toFixed(3)),
    galvanometerCurrent: Number(galvanometerCurrent.toFixed(2)),
    bridgeBalanced,
    fringeSpacingMm: Number(fringeSpacingMm.toFixed(2)),
    photoelectricMaxKe: Number(photoelectricMaxKe.toFixed(2)),
    photoelectricStoppingVoltage: Number(photoelectricStoppingVoltage.toFixed(2)),
    photoelectricEmitted,
  };
}

export function evaluateKinematicsAtTime(params: PhysicsParams, t: number): KinematicsInstant {
  const metrics = calculatePhysicsMetrics(params);
  const time = Math.max(0, t);
  const m = Math.max(0.1, params.mass);
  const g = Math.max(0, params.gravity);

  if (params.mode === 'projectile-gravity') {
    const launchRad = (params.launchAngle * Math.PI) / 180;
    const v0x = params.initialVelocity * Math.cos(launchRad);
    const v0y = params.initialVelocity * Math.sin(launchRad);
    const effectiveTime = g > 0.001 ? Math.min(time, metrics.timeOfFlight) : time;

    const posX = v0x * effectiveTime;
    const posY = Math.max(
      0,
      params.initialHeight +
        v0y * effectiveTime -
        0.5 * g * effectiveTime * effectiveTime
    );
    const velX =
      posY <= 0 && effectiveTime >= metrics.timeOfFlight && g > 0.001 ? 0 : v0x;
    const velY =
      posY <= 0 && effectiveTime >= metrics.timeOfFlight && g > 0.001
        ? 0
        : v0y - g * effectiveTime;
    const speed = Math.sqrt(velX * velX + velY * velY);
    const ke = 0.5 * m * speed * speed;
    const pe = m * g * posY;

    return {
      time: Number(effectiveTime.toFixed(2)),
      positionX: Number(posX.toFixed(2)),
      positionY: Number(posY.toFixed(2)),
      velocityX: Number(velX.toFixed(2)),
      velocityY: Number(velY.toFixed(2)),
      speed: Number(speed.toFixed(2)),
      acceleration: Number((-g).toFixed(2)),
      kineticEnergy: Number(ke.toFixed(2)),
      potentialEnergy: Number(pe.toFixed(2)),
      totalMechanicalEnergy: Number((ke + pe).toFixed(2)),
      momentum: Number((m * speed).toFixed(2)),
    };
  }

  if (params.mode === 'spring-hooke') {
    const k = Math.max(5, params.springConstantK || 120);
    const A = params.springDisplacement ?? 0.8;
    const b = Math.max(0, params.dampingCoeff ?? 0.15);
    const gamma = b / (2 * m);
    const omega0 = Math.sqrt(k / m);
    const omegaD = Math.sqrt(Math.max(0.01, omega0 * omega0 - gamma * gamma));
    const envelope = Math.exp(-gamma * time);
    const posX = A * envelope * Math.cos(omegaD * time);
    const velX = -A * envelope * (gamma * Math.cos(omegaD * time) + omegaD * Math.sin(omegaD * time));
    const accX = -(k / m) * posX - (b / m) * velX;
    const ke = 0.5 * m * velX * velX;
    const pe = 0.5 * k * posX * posX;

    return {
      time: Number(time.toFixed(2)),
      positionX: Number(posX.toFixed(2)),
      positionY: 0,
      velocityX: Number(velX.toFixed(2)),
      velocityY: 0,
      speed: Number(Math.abs(velX).toFixed(2)),
      acceleration: Number(accX.toFixed(2)),
      kineticEnergy: Number(ke.toFixed(2)),
      potentialEnergy: Number(pe.toFixed(2)),
      totalMechanicalEnergy: Number((ke + pe).toFixed(2)),
      momentum: Number((m * Math.abs(velX)).toFixed(2)),
    };
  }

  if (params.mode === 'collision-momentum') {
    const collisionTime = 1.5;
    const isAfterImpact = time >= collisionTime;
    const vCurrent = isAfterImpact ? metrics.v1Final : params.initialVelocity;
    const posX = isAfterImpact
      ? params.initialVelocity * collisionTime +
        metrics.v1Final * (time - collisionTime)
      : params.initialVelocity * time;

    return {
      time: Number(time.toFixed(2)),
      positionX: Number(posX.toFixed(2)),
      positionY: 0,
      velocityX: Number(vCurrent.toFixed(2)),
      velocityY: 0,
      speed: Number(Math.abs(vCurrent).toFixed(2)),
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

  if (params.mode === 'pendulum-harmonic') {
    const L = Math.max(0.1, params.pendulumLength ?? 1.0);
    const theta0Rad = ((params.pendulumAngle ?? 25) * Math.PI) / 180;
    const omega = Math.sqrt(g / L);
    const thetaT = theta0Rad * Math.cos(omega * time) * Math.exp(-0.02 * time);
    const angVel = -theta0Rad * omega * Math.sin(omega * time) * Math.exp(-0.02 * time);
    const posX = L * Math.sin(thetaT);
    const posY = -L * Math.cos(thetaT);
    const speed = Math.abs(L * angVel);
    const ke = 0.5 * m * speed * speed;
    const pe = m * g * (posY + L);
    return {
      time: Number(time.toFixed(2)),
      positionX: Number(posX.toFixed(3)),
      positionY: Number(posY.toFixed(3)),
      velocityX: Number((speed * Math.cos(thetaT)).toFixed(3)),
      velocityY: Number((speed * Math.sin(thetaT)).toFixed(3)),
      speed: Number(speed.toFixed(3)),
      acceleration: Number((L * angVel * angVel).toFixed(2)),
      kineticEnergy: Number(ke.toFixed(2)),
      potentialEnergy: Number(pe.toFixed(2)),
      totalMechanicalEnergy: Number((ke + pe).toFixed(2)),
      momentum: Number((m * speed).toFixed(2)),
      pendulumAngleRad: thetaT,
      pendulumAngularVelocity: angVel,
    };
  }

  const a = metrics.acceleration;
  const v0 = params.initialVelocity;
  const s = v0 * time + 0.5 * a * time * time;
  const v = v0 + a * time;
  const thetaRad = (params.inclineAngle * Math.PI) / 180;
  const posX = s * Math.cos(thetaRad);
  const posY = Math.max(0, params.initialHeight + s * Math.sin(thetaRad));
  const speed = Math.abs(v);
  const ke = 0.5 * m * speed * speed;
  const pe = m * g * posY;

  return {
    time: Number(time.toFixed(2)),
    positionX: Number(posX.toFixed(2)),
    positionY: Number(posY.toFixed(2)),
    velocityX: Number((v * Math.cos(thetaRad)).toFixed(2)),
    velocityY: Number((v * Math.sin(thetaRad)).toFixed(2)),
    speed: Number(speed.toFixed(2)),
    acceleration: Number(a.toFixed(2)),
    kineticEnergy: Number(ke.toFixed(2)),
    potentialEnergy: Number(pe.toFixed(2)),
    totalMechanicalEnergy: Number((ke + pe).toFixed(2)),
    momentum: Number((m * speed).toFixed(2)),
  };
}
