import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePhysicsMetrics,
  calculateChemistryMetrics,
  calculateAstronomyMetrics,
  evaluateKinematicsAtTime,
} from './scienceEngine';
import {
  PRESET_MYSTERY_CHALLENGES,
  evaluateMysterySubmission,
  MysterySampleChallenge,
} from './mysteryChallengeEngine';

test('Physics v2.0: Harmonic Pendulum, Stokes Viscosity, Ohm Wheatstone, Young Slit, Photoelectric', () => {
  // 1. Pendulum harmonic
  const mPendulum = calculatePhysicsMetrics({
    mass: 1.0,
    appliedForce: 0,
    inclineAngle: 0,
    frictionCoeffStatic: 0,
    frictionCoeffKinetic: 0,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 0,
    initialHeight: 0,
    secondaryMass: 0,
    separationDistance: 0,
    collisionMass2: 0,
    velocity2Initial: 0,
    restitutionCoeff: 1,
    springConstantK: 100,
    springDisplacement: 0,
    dampingCoeff: 0,
    mode: 'pendulum-harmonic',
    pendulumLength: 1.0,
    pendulumAngle: 10,
  });
  // T = 2π * sqrt(1.0 / 9.81) = 2.006 s
  assert.ok(mPendulum.pendulumPeriod && mPendulum.pendulumPeriod > 1.95 && mPendulum.pendulumPeriod < 2.05);
  assert.ok(mPendulum.pendulumFrequency && mPendulum.pendulumFrequency > 0.45);

  // Trajectory at t = 0.5s
  const kinPendulum = evaluateKinematicsAtTime(
    {
      mass: 1.0,
      appliedForce: 0,
      inclineAngle: 0,
      frictionCoeffStatic: 0,
      frictionCoeffKinetic: 0,
      gravity: 9.81,
      initialVelocity: 0,
      launchAngle: 0,
      initialHeight: 0,
      secondaryMass: 0,
      separationDistance: 0,
      collisionMass2: 0,
      velocity2Initial: 0,
      restitutionCoeff: 1,
      springConstantK: 100,
      springDisplacement: 0,
      dampingCoeff: 0,
      mode: 'pendulum-harmonic',
      pendulumLength: 1.0,
      pendulumAngle: 15,
    },
    0.5
  );
  assert.ok(typeof kinPendulum.positionX === 'number');
  assert.ok(typeof kinPendulum.positionY === 'number');

  // 2. Stokes Viscosity
  const mStokes = calculatePhysicsMetrics({
    mass: 1.0,
    appliedForce: 0,
    inclineAngle: 0,
    frictionCoeffStatic: 0,
    frictionCoeffKinetic: 0,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 0,
    initialHeight: 0,
    secondaryMass: 0,
    separationDistance: 0,
    collisionMass2: 0,
    velocity2Initial: 0,
    restitutionCoeff: 1,
    springConstantK: 100,
    springDisplacement: 0,
    dampingCoeff: 0,
    mode: 'stokes-viscosity',
    sphereRadiusMm: 5.0, // 0.005 m
    fluidViscosityPaS: 1.5,
    sphereDensityKgM3: 7850,
    fluidDensityKgM3: 1260,
  });
  assert.ok(mStokes.stokesTerminalVelocity && mStokes.stokesTerminalVelocity > 0);
  assert.ok(mStokes.stokesDragForce !== undefined);

  // 3. Ohm & Wheatstone Bridge
  const mOhm = calculatePhysicsMetrics({
    mass: 1.0,
    appliedForce: 0,
    inclineAngle: 0,
    frictionCoeffStatic: 0,
    frictionCoeffKinetic: 0,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 0,
    initialHeight: 0,
    secondaryMass: 0,
    separationDistance: 0,
    collisionMass2: 0,
    velocity2Initial: 0,
    restitutionCoeff: 1,
    springConstantK: 100,
    springDisplacement: 0,
    dampingCoeff: 0,
    mode: 'ohm-wheatstone',
    circuitVoltageV: 12.0,
    bridgeR1: 100,
    bridgeR2: 100,
    bridgeR3: 200,
    bridgeRx: 200, // Balanced bridge R1/R2 = R3/Rx => 1 = 1
  });
  assert.equal(mOhm.bridgeBalanced, true);
  assert.ok(mOhm.circuitCurrent && mOhm.circuitCurrent > 0);
  assert.ok(Math.abs(mOhm.galvanometerCurrent || 0) < 0.001);

  // 4. Young Double Slit Optics
  const mOptics = calculatePhysicsMetrics({
    mass: 1.0,
    appliedForce: 0,
    inclineAngle: 0,
    frictionCoeffStatic: 0,
    frictionCoeffKinetic: 0,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 0,
    initialHeight: 0,
    secondaryMass: 0,
    separationDistance: 0,
    collisionMass2: 0,
    velocity2Initial: 0,
    restitutionCoeff: 1,
    springConstantK: 100,
    springDisplacement: 0,
    dampingCoeff: 0,
    mode: 'optics-young-slit',
    lightWavelength: 632.8, // He-Ne red
    slitDistance: 0.25,
    screenDistance: 1.5,
  });
  // Fringe separation = (632.8e-9 * 1.5) / 0.25e-3 = 3.7968 mm
  assert.ok(mOptics.fringeSpacingMm && mOptics.fringeSpacingMm > 3.7 && mOptics.fringeSpacingMm < 3.9);

  // 5. Photoelectric Effect Planck
  const mPhoto = calculatePhysicsMetrics({
    mass: 1.0,
    appliedForce: 0,
    inclineAngle: 0,
    frictionCoeffStatic: 0,
    frictionCoeffKinetic: 0,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 0,
    initialHeight: 0,
    secondaryMass: 0,
    separationDistance: 0,
    collisionMass2: 0,
    velocity2Initial: 0,
    restitutionCoeff: 1,
    springConstantK: 100,
    springDisplacement: 0,
    dampingCoeff: 0,
    mode: 'photoelectric-planck',
    photonFrequency: 10.0, // 10 x 10^14 Hz = 1.0 x 10^15 Hz => h*f = 4.14 eV
    targetMetalWorkFunction: 2.2, // 4.14 - 2.2 = 1.94 eV
  });
  assert.equal(mPhoto.photoelectricEmitted, true);
  assert.ok(mPhoto.photoelectricMaxKe && mPhoto.photoelectricMaxKe > 1.8);
});

test('Chemistry v2.0: Ideal Gas Boyle, Arrhenius Kinetics, UV-Vis Beer-Lambert', () => {
  // 1. Ideal Gas Boyle
  const mGas = calculateChemistryMetrics({
    mode: 'ideal-gas-boyle',
    reactionId: 'neutralization-hcl-naoh',
    initialTempC: 25,
    reactantConcentration: 1.0,
    solutionVolumeMl: 200,
    pressureAtm: 1.0,
    useCatalyst: false,
    stirringRpm: 200,
    analyteAcidConc: 0.2,
    analyteVolumeMl: 25,
    titrantBaseConc: 0.25,
    titrantAddedMl: 20,
    acidPka: 1.0,
    indicatorType: 'fenolftalein',
    redoxPairId: 'zn-cu-daniell',
    anodeConcM: 1.0,
    cathodeConcM: 1.0,
    gasVolumeL: 10.0,
    gasTemperatureK: 300,
    gasMoles: 1.0,
  });
  // P = nRT/V = 1 * 0.08206 * 300 / 10 = 2.46 atm
  assert.ok(mGas.gasPressureAtm && mGas.gasPressureAtm > 2.4 && mGas.gasPressureAtm < 2.5);
  assert.ok(mGas.gasPressureKpa && mGas.gasPressureKpa > 240);

  // 2. Reaction Kinetics Arrhenius
  const mKinetics = calculateChemistryMetrics({
    mode: 'reaction-kinetics-arrhenius',
    reactionId: 'neutralization-hcl-naoh',
    initialTempC: 25,
    reactantConcentration: 1.0,
    solutionVolumeMl: 200,
    pressureAtm: 1.0,
    useCatalyst: false,
    stirringRpm: 200,
    analyteAcidConc: 0.2,
    analyteVolumeMl: 25,
    titrantBaseConc: 0.25,
    titrantAddedMl: 20,
    acidPka: 1.0,
    indicatorType: 'fenolftalein',
    redoxPairId: 'zn-cu-daniell',
    anodeConcM: 1.0,
    cathodeConcM: 1.0,
    kineticsTempC: 35,
    kineticsEaKj: 55,
  });
  assert.ok(mKinetics.kineticsHalfLifeSec && mKinetics.kineticsHalfLifeSec > 0);

  // 3. Spectrophotometry Beer-Lambert
  const mBeer = calculateChemistryMetrics({
    mode: 'spectrophotometry-beer',
    reactionId: 'neutralization-hcl-naoh',
    initialTempC: 25,
    reactantConcentration: 1.0,
    solutionVolumeMl: 200,
    pressureAtm: 1.0,
    useCatalyst: false,
    stirringRpm: 200,
    analyteAcidConc: 0.2,
    analyteVolumeMl: 25,
    titrantBaseConc: 0.25,
    titrantAddedMl: 20,
    acidPka: 1.0,
    indicatorType: 'fenolftalein',
    redoxPairId: 'zn-cu-daniell',
    anodeConcM: 1.0,
    cathodeConcM: 1.0,
    spectroConcMm: 0.1,
    spectroPathLengthCm: 1.0,
    spectroMolarAbsorptivity: 9500,
  });
  assert.ok(mBeer.spectroAbsorbance && mBeer.spectroAbsorbance > 0);
  assert.ok(mBeer.spectroTransmittancePct && mBeer.spectroTransmittancePct > 0 && mBeer.spectroTransmittancePct < 100);
});

test('Astronomy v2.0: Stellar Wien Spectrum & Hubble Cosmic Expansion', () => {
  // 1. Stellar Wien Spectrum
  const mWien = calculateAstronomyMetrics({
    mode: 'stellar-wien-spectrum',
    selectedPlanetId: 'earth',
    customSemiMajorAxisAu: 1.0,
    customEccentricity: 0.017,
    centralStarMassSolar: 1.0,
    showKeplerAreaSweep: true,
    timeScaleSpeed: 1.0,
    galactocentricRadiusKpc: 8.2,
    bulgeDiskMassFactor: 1.0,
    darkMatterHaloFraction: 1.0,
    sgrAStarMassMillionSolar: 4.15,
    starEffectiveTempK: 5778, // Sun-like
    starRadiusSolar: 1.0,
    exoplanetRadiusEarth: 1.0,
    exoplanetOrbitAu: 1.0,
  });
  // λ_max = 2.89777e6 / 5778 = 501.5 nm (green-yellow)
  assert.ok(mWien.wienPeakWavelengthNm && mWien.wienPeakWavelengthNm > 495 && mWien.wienPeakWavelengthNm < 510);
  assert.equal(mWien.spectralClass, 'G');

  // 2. Hubble Cosmic Expansion
  const mHubble = calculateAstronomyMetrics({
    mode: 'hubble-expansion',
    selectedPlanetId: 'earth',
    customSemiMajorAxisAu: 1.0,
    customEccentricity: 0.017,
    centralStarMassSolar: 1.0,
    showKeplerAreaSweep: true,
    timeScaleSpeed: 1.0,
    galactocentricRadiusKpc: 8.2,
    bulgeDiskMassFactor: 1.0,
    darkMatterHaloFraction: 1.0,
    sgrAStarMassMillionSolar: 4.15,
    starEffectiveTempK: 5778,
    starRadiusSolar: 1.0,
    exoplanetRadiusEarth: 1.0,
    exoplanetOrbitAu: 1.0,
    galaxyDistanceMpc: 100,
    hubbleConstantH0: 70,
  });
  // v = H0 * d = 70 * 100 = 7000 km/s
  assert.equal(mHubble.hubbleRecessionVelocityKmS, 7000);
  // z = 7000 / 299792 = ~0.0233
  assert.ok(mHubble.hubbleRedshiftZ && mHubble.hubbleRedshiftZ > 0.02 && mHubble.hubbleRedshiftZ < 0.03);
});

test('Mystery Sample Challenge Engine: scoring, error tolerance, and presets', () => {
  assert.ok(PRESET_MYSTERY_CHALLENGES.length >= 7);

  // Test challenge: Kepler-452b gravity (actual: 12.35 m/s², tolerance: 5%)
  const gravChallenge = PRESET_MYSTERY_CHALLENGES.find((c) => c.id === 'phys-mystery-gravity') as MysterySampleChallenge;
  assert.ok(gravChallenge);

  // Exact guess (0% error)
  const resExact = evaluateMysterySubmission(gravChallenge, 12.35);
  assert.equal(resExact.errorPercentage, 0);
  assert.equal(resExact.score, 100);
  assert.equal(resExact.passed, true);
  assert.equal(resExact.verdict, 'Sempurna (A+)');

  // Within 3% tolerance (score >= 90)
  const resClose = evaluateMysterySubmission(gravChallenge, 12.60);
  assert.ok(resClose.errorPercentage <= 3);
  assert.ok(resClose.score >= 90);
  assert.equal(resClose.passed, true);

  // Outside 20% error
  const resFar = evaluateMysterySubmission(gravChallenge, 20.0);
  assert.ok(resFar.errorPercentage > 50);
  assert.ok(resFar.score < 50);
  assert.equal(resFar.passed, false);
});
