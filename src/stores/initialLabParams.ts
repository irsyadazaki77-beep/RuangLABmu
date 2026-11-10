import {
  PhysicsParams,
  ChemistryParams,
  BiologyTelemetryContext,
  AstronomyParams,
} from '../utils/scienceEngine';

export const STUDENT_PROFILES = [
  { name: 'Alya Pratama', group: 'Kelompok 1 — Mekanika' },
  { name: 'Bima Wijaya', group: 'Kelompok 1 — Mekanika' },
  { name: 'Citra Lestari', group: 'Kelompok 2 — Termokimia' },
  { name: 'Dimas Nugroho', group: 'Kelompok 2 — Termokimia' },
  { name: 'Elena Putri', group: 'Kelompok 3 — Astrofisika' },
];

export const INITIAL_PHYSICS_PARAMS: PhysicsParams = {
  mass: 4.0,
  appliedForce: 45,
  inclineAngle: 15,
  frictionCoeffStatic: 0.2,
  frictionCoeffKinetic: 0.15,
  gravity: 9.81,
  initialVelocity: 0,
  launchAngle: 45,
  initialHeight: 0,
  secondaryMass: 1500,
  separationDistance: 5,
  collisionMass2: 2.0,
  velocity2Initial: -2.0,
  restitutionCoeff: 1.0,
  springConstantK: 120,
  springDisplacement: 0.8,
  dampingCoeff: 0.15,
  mode: 'newton-incline',
};

export const INITIAL_CHEMISTRY_PARAMS: ChemistryParams = {
  mode: 'thermo-calorimetry',
  reactionId: 'neutralization-hcl-naoh',
  initialTempC: 25,
  reactantConcentration: 1.5,
  solutionVolumeMl: 250,
  pressureAtm: 1.0,
  useCatalyst: false,
  stirringRpm: 240,
  analyteAcidConc: 0.2,
  analyteVolumeMl: 25,
  titrantBaseConc: 0.25,
  titrantAddedMl: 18.0,
  acidPka: 1.0,
  indicatorType: 'fenolftalein',
  redoxPairId: 'zn-cu-daniell',
  anodeConcM: 1.0,
  cathodeConcM: 1.0,
};

export const INITIAL_BIOLOGY_CONTEXT: BiologyTelemetryContext = {
  moduleId: 'photosynthesis-ingenhousz',
  params: {
    lightDistanceCm: 25,
    nahco3ConcPct: 0.5,
    waterTempC: 28,
    wavelengthNm: 660,
  },
};

export const INITIAL_ASTRONOMY_PARAMS: AstronomyParams = {
  mode: 'solar-kepler',
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
  exoplanetRadiusEarth: 10.91,
  exoplanetOrbitAu: 1.0,
};
