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

export type ChemistryMode =
  | 'thermo-calorimetry'
  | 'acid-base-titration'
  | 'electrochemistry-cell'
  | 'ideal-gas-boyle'
  | 'reaction-kinetics-arrhenius'
  | 'spectrophotometry-beer';

export type AstronomyMode =
  | 'solar-kepler'
  | 'milkyway-galaxy'
  | 'stellar-exoplanet'
  | 'stellar-wien-spectrum'
  | 'hubble-expansion';

export type BiologyMode =
  | 'photosynthesis-ingenhousz'
  | 'enzyme-kinetics'
  | 'enzyme-catalase'
  | 'predator-prey-dynamics'
  | 'cell-osmosis-tonicity'
  | 'osmosis-plasmolysis';

export type ScienceDomain = 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';

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

export interface ThermoReactionPreset {
  id: string;
  name: string;
  equation: string;
  deltaHStandard: number; // kJ/mol
  deltaSStandard: number; // J/(mol*K)
  activationEnergy: number; // kJ/mol
  catalysedEa: number; // kJ/mol
  specificHeatCapacity: number; // J/(g*K)
  category: 'Eksotermik' | 'Endotermik' | 'Reversibel';
  description: string;
}

export interface RedoxCouplePreset {
  id: string;
  name: string;
  anodeHalf: string;
  cathodeHalf: string;
  e0Anode: number; // V
  e0Cathode: number; // V
  electronsTransferred: number; // n
}

export interface ChemistryParams {
  mode: ChemistryMode;
  reactionId: string;
  initialTempC: number; // Celsius
  reactantConcentration: number; // mol/L
  solutionVolumeMl: number; // mL
  pressureAtm: number; // atm
  useCatalyst: boolean;
  stirringRpm: number; // RPM
  analyteAcidConc: number; // M_a (mol/L, 0.05 - 1.0)
  analyteVolumeMl: number; // V_a (mL, 10 - 100)
  titrantBaseConc: number; // M_b (mol/L, 0.05 - 1.0)
  titrantAddedMl: number; // V_b (mL, 0 - 100)
  acidPka: number; // pKa
  indicatorType: 'fenolftalein' | 'bromtimol-biru' | 'metil-jingga';
  redoxPairId: string;
  anodeConcM: number; // [Anode ion] mol/L (0.001 - 2.0)
  cathodeConcM: number; // [Cathode ion] mol/L (0.001 - 2.0)
  // Advanced Chemistry Modules
  gasMoles?: number; // mol (0.1 - 2.0)
  gasTemperatureK?: number; // K (250 - 550)
  gasVolumeL?: number; // L (2 - 25)
  gasIsAdiabatic?: boolean;
  kineticsTempC?: number; // °C (10 - 70)
  kineticsConcA?: number; // M (0.1 - 2.0)
  kineticsEaKj?: number; // kJ/mol (30 - 90)
  spectroConcMm?: number; // mM (0.01 - 0.25)
  spectroPathLengthCm?: number; // cm (0.5 - 2.0)
  spectroMolarAbsorptivity?: number; // L/(mol·cm)
  spectroWavelengthNm?: number; // nm (400 - 700)
}

export interface ChemistryMetrics {
  tempKelvin: number;
  finalTempC: number;
  deltaTempC: number;
  molesReacted: number;
  heatReleasedJoules: number;
  deltaHReaction: number;
  deltaSReaction: number;
  deltaG: number;
  isSpontaneous: boolean;
  effectiveEa: number;
  rateConstantK: number;
  reactionRate: number;
  equilibriumConstantKeq: number;
  thermalClassification: 'Eksotermik' | 'Endotermik' | 'Atermal';
  spontaneityLabel: string;
  currentPh: number;
  equivalenceVolumeMl: number;
  titrationRegion: 'Pra-Ekuivalen (Asam)' | 'Titik Ekuivalen' | 'Pasca-Ekuivalen (Basa)';
  indicatorColorHex: string;
  indicatorColorName: string;
  standardCellPotentialE0: number; // V
  nernstCellPotentialE: number; // V
  reactionQuotientQ: number;
  electroFreeEnergyDeltaG: number; // kJ/mol (-nFE)
  // Advanced Module Metrics
  gasPressureAtm?: number; // atm
  gasPressureKpa?: number; // kPa
  gasInternalEnergyJ?: number; // J
  gasDensity?: number; // g/L
  kineticsHalfLifeSec?: number; // s
  spectroAbsorbance?: number;
  spectroTransmittancePct?: number; // %
  boyleConstantPv?: number;
  arrheniusK?: number;
  absorbanceA?: number;
  transmittancePct?: number;
  molarExtinctionEpsilon?: number;
  absorbedColorName?: string;
}

export interface SolarPlanetPreset {
  id: string;
  name: string;
  category: 'Planet Kebumian' | 'Raksasa Gas' | 'Raksasa Es' | 'Komet & Sabuk Kuiper';
  semiMajorAxisAu: number; // a (AU)
  eccentricity: number; // e
  massEarth: number; // M_earth
  radiusKm: number; // km
  surfaceTempC: number; // °C
  moonsCount: number;
  atmosphere: string;
  colorHex: string;
  hasRings?: boolean;
  description: string;
}

export interface AstronomyParams {
  mode: AstronomyMode;
  selectedPlanetId: string;
  customSemiMajorAxisAu: number; // AU (0.3 - 35.0)
  customEccentricity: number; // e (0.0 - 0.85)
  centralStarMassSolar: number; // M_sun (0.2 - 5.0)
  showKeplerAreaSweep: boolean;
  timeScaleSpeed: number; // 0.5 - 4.0
  // Milky Way Galaxy & Dark Matter Rotation Curve
  galactocentricRadiusKpc: number; // R in kpc (0.5 - 25.0, Solar System ~ 8.2 kpc)
  bulgeDiskMassFactor: number; // 0.5 - 2.0
  darkMatterHaloFraction: number; // 0.0 (no DM) to 1.5 (heavy DM halo)
  sgrAStarMassMillionSolar: number; // default 4.15 million M_sun
  // Stellar H-R Diagram & Exoplanet Transit
  starEffectiveTempK: number; // 2800 - 30000 K
  starRadiusSolar: number; // 0.1 - 15.0 R_sun
  exoplanetRadiusEarth: number; // 0.5 - 15.0 R_earth
  exoplanetOrbitAu: number; // 0.05 - 5.0 AU
  // Advanced Astronomy Modules
  galaxyDistanceMpc?: number; // Mpc (20 - 600)
  hubbleConstantH0?: number; // km/s/Mpc (65 - 78)
  restWavelengthNm?: number; // nm (390 - 660)
}

export interface AstronomyMetrics {
  // Solar System & Kepler Metrics
  orbitalPeriodYears: number; // T = sqrt(a^3 / M_star)
  perihelionAu: number; // a(1 - e)
  aphelionAu: number; // a(1 + e)
  meanOrbitalVelocityKms: number; // km/s
  perihelionVelocityKms: number; // km/s
  aphelionVelocityKms: number; // km/s
  keplerRatioT2OverA3: number; // T^2 / a^3
  // Milky Way & Sgr A* Metrics
  keplerianVelocityKms: number; // km/s (without dark matter)
  observedDarkMatterVelocityKms: number; // km/s (with dark matter halo)
  velocityAnomalyKms: number; // km/s
  galacticOrbitalPeriodMyr: number; // million years
  enclosedMassBillionSolar: number; // 10^9 M_sun
  sgrASchwarzschildRadiusMillionKm: number; // million km
  // Stellar H-R & Exoplanet Metrics
  spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
  starColorHex: string;
  stellarLuminositySolar: number; // L / L_sun
  mainSequenceLifetimeGyr: number; // Gyr
  transitDepthPct: number; // %
  transitDepthPpm: number; // ppm
  habitableZoneInnerAu: number; // AU
  habitableZoneOuterAu: number; // AU
  isInHabitableZone: boolean;
  // Advanced Modules Metrics
  wienPeakWavelengthNm?: number; // nm
  peakWavelengthNm?: number; // nm
  surfaceFluxWPerM2?: number; // W/m²
  hubbleRecessionVelocityKmS?: number; // km/s
  recessionVelocityKms?: number; // km/s
  hubbleRedshiftZ?: number;
  redshiftZ?: number;
  hubbleObservedWavelengthNm?: number; // nm
  hubbleAgeBillionYears?: number; // Gyr
}

export interface ExperimentRecord {
  id: string;
  timestamp: string;
  studentName: string;
  groupId: string;
  domain: ScienceDomain;
  experimentTitle: string;
  parametersSummary: string;
  keyMetrics: Record<string, number | string>;
  numericX?: number;
  numericY1?: number;
  numericY2?: number;
  notes: string;
}

export interface LabNotification {
  id: string;
  timestamp: string;
  severity: 'nominal' | 'elevated' | 'critical';
  domain: ScienceDomain | 'Kolaborasi' | 'Pengajar';
  title: string;
  message: string;
  formulaHint?: string;
}

export interface DataPointMultiAxis {
  label: string;
  x: number;
  y1: number;
  y2: number;
}

export interface LinearRegressionResult {
  slopeM: number;
  interceptC: number;
  rSquared: number;
  equationString: string;
  meanX: number;
  meanY: number;
  stdDevY: number;
  predictedPoints: { x: number; yPred: number }[];
}

export interface WorksheetQuestion {
  id: string;
  domain: ScienceDomain;
  topic: string;
  questionText: string;
  formulaHint: string;
  unit: string;
  correctValue: number;
  tolerance: number;
  explanation: string;
  scaffoldedHints?: [string, string, string];
}

export interface RubricScoreBreakdown {
  studentId: string;
  studentName: string;
  groupId: string;
  experimentScore: number; // 0-100 (weight 25%)
  regressionAnalysisScore: number; // 0-100 (weight 25%)
  collaborationScore: number; // 0-100 (weight 25%)
  worksheetQuizScore: number; // 0-100 (weight 25%)
  finalTotalScore: number; // 0-100
  letterGrade: 'A' | 'B' | 'C' | 'D';
  predicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan';
}

export const SOLAR_PLANET_PRESETS: SolarPlanetPreset[] = [
  {
    id: 'mercury',
    name: 'Merkurius',
    category: 'Planet Kebumian',
    semiMajorAxisAu: 0.39,
    eccentricity: 0.206,
    massEarth: 0.055,
    radiusKm: 2439.7,
    surfaceTempC: 167,
    moonsCount: 0,
    atmosphere: 'Eksosfer sangat tipis (O₂, Na, H₂, He)',
    colorHex: '#94A3B8',
    description: 'Planet terdekat dari Matahari dengan eksentrisitas orbit tertinggi di antara 8 planet utama.',
  },
  {
    id: 'venus',
    name: 'Venus',
    category: 'Planet Kebumian',
    semiMajorAxisAu: 0.72,
    eccentricity: 0.007,
    massEarth: 0.815,
    radiusKm: 6051.8,
    surfaceTempC: 464,
    moonsCount: 0,
    atmosphere: '96.5% CO₂, 3.5% N₂ (Efek Rumah Kaca Ekstrem)',
    colorHex: '#FBBF24',
    description: 'Memiliki orbit paling mendekati lingkaran sempurna (e = 0.007) dan rotasi retrograd.',
  },
  {
    id: 'earth',
    name: 'Bumi',
    category: 'Planet Kebumian',
    semiMajorAxisAu: 1.0,
    eccentricity: 0.017,
    massEarth: 1.0,
    radiusKm: 6371.0,
    surfaceTempC: 15,
    moonsCount: 1,
    atmosphere: '78% N₂, 21% O₂, 1% Ar & H₂O',
    colorHex: '#38BDF8',
    description: 'Standar satuan astronomi (a = 1.00 AU, T = 1.00 tahun) yang berada tepat di zona laik huni.',
  },
  {
    id: 'mars',
    name: 'Mars',
    category: 'Planet Kebumian',
    semiMajorAxisAu: 1.52,
    eccentricity: 0.093,
    massEarth: 0.107,
    radiusKm: 3389.5,
    surfaceTempC: -65,
    moonsCount: 2,
    atmosphere: '95% CO₂, 2.6% N₂, 1.9% Ar',
    colorHex: '#F97316',
    description: 'Data pengamatan orbit elips Mars oleh Tycho Brahe menjadi dasar penemuan Hukum I & II Kepler.',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    category: 'Raksasa Gas',
    semiMajorAxisAu: 5.2,
    eccentricity: 0.049,
    massEarth: 317.8,
    radiusKm: 69911,
    surfaceTempC: -110,
    moonsCount: 95,
    atmosphere: '89.8% H₂, 10.2% He, Amonia',
    colorHex: '#FB923C',
    description: 'Planet terbesar di Tata Surya (318 M⊕) yang mendominasi dinamika gravitasi sabuk asteroid.',
  },
  {
    id: 'saturn',
    name: 'Saturnus',
    category: 'Raksasa Gas',
    semiMajorAxisAu: 9.58,
    eccentricity: 0.057,
    massEarth: 95.2,
    radiusKm: 58232,
    surfaceTempC: -140,
    moonsCount: 146,
    atmosphere: '96.3% H₂, 3.25% He, Metana',
    colorHex: '#FDE047',
    hasRings: true,
    description: 'Dikenal dengan sistem cincin es spektakuler dan periode orbit ~29.6 tahun Bumi.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    category: 'Raksasa Es',
    semiMajorAxisAu: 19.2,
    eccentricity: 0.046,
    massEarth: 14.5,
    radiusKm: 25362,
    surfaceTempC: -195,
    moonsCount: 28,
    atmosphere: '82.5% H₂, 15.2% He, 2.3% CH₄',
    colorHex: '#22D3EE',
    hasRings: true,
    description: 'Raksasa es dengan kemiringan sumbu rotasi ekstrem (97.8°) dan atmosfer metana biru-sian.',
  },
  {
    id: 'neptune',
    name: 'Neptunus',
    category: 'Raksasa Es',
    semiMajorAxisAu: 30.05,
    eccentricity: 0.011,
    massEarth: 17.1,
    radiusKm: 24622,
    surfaceTempC: -200,
    moonsCount: 16,
    atmosphere: '80% H₂, 19% He, 1.5% CH₄',
    colorHex: '#3B82F6',
    description: 'Planet terjauh yang ditemukan melalui prediksi matematis perturbasi gravitasi orbit Uranus.',
  },
  {
    id: 'halley-comet',
    name: 'Komet 1P/Halley (Orbit Elips Ekstrem)',
    category: 'Komet & Sabuk Kuiper',
    semiMajorAxisAu: 17.8,
    eccentricity: 0.82,
    massEarth: 0.00001,
    radiusKm: 11,
    surfaceTempC: -70,
    moonsCount: 0,
    atmosphere: 'Koma uap H₂O, CO, CO₂ saat perihelion',
    colorHex: '#A855F7',
    description: 'Contoh ideal Hukum II Kepler: bergerak sangat cepat saat perihelion dan lambat di aphelion.',
  },
];

export const THERMO_PRESETS: ThermoReactionPreset[] = [
  {
    id: 'neutralization-hcl-naoh',
    name: 'Netralisasi HCl + NaOH',
    equation: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)',
    deltaHStandard: -57.3,
    deltaSStandard: 80.4,
    activationEnergy: 18.5,
    catalysedEa: 14.0,
    specificHeatCapacity: 4.184,
    category: 'Eksotermik',
    description: 'Reaksi kalorimetri klasik pelepasan kalor netralisasi ion H⁺ dan OH⁻ membentuk molekul air.',
  },
  {
    id: 'combustion-methane',
    name: 'Pembakaran Metana CH₄',
    equation: 'CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(g)',
    deltaHStandard: -802.3,
    deltaSStandard: -5.2,
    activationEnergy: 78.0,
    catalysedEa: 42.5,
    specificHeatCapacity: 4.184,
    category: 'Eksotermik',
    description: 'Reaksi eksotermik berenergi tinggi dengan pelepasan entalpi besar ke lingkungan kalorimeter.',
  },
  {
    id: 'dissolution-nh4no3',
    name: 'Pelarutan Endotermik NH₄NO₃',
    equation: 'NH₄NO₃(s) + H₂O(l) → NH₄⁺(aq) + NO₃⁻(aq)',
    deltaHStandard: 25.7,
    deltaSStandard: 108.7,
    activationEnergy: 32.0,
    catalysedEa: 24.5,
    specificHeatCapacity: 4.184,
    category: 'Endotermik',
    description: 'Reaksi penyerapan kalor dari lingkungan yang didorong oleh peningkatan entropi (ΔS > 0).',
  },
  {
    id: 'decomposition-caco3',
    name: 'Dekomposisi Termal CaCO₃',
    equation: 'CaCO₃(s) ⇌ CaO(s) + CO₂(g)',
    deltaHStandard: 178.3,
    deltaSStandard: 160.6,
    activationEnergy: 112.0,
    catalysedEa: 76.0,
    specificHeatCapacity: 3.85,
    category: 'Endotermik',
    description: 'Reaksi endotermik yang hanya spontan pada suhu tinggi ketika faktor T·ΔS melampaui ΔH.',
  },
  {
    id: 'haber-ammonia',
    name: 'Sintesis Amonia Haber-Bosch',
    equation: 'N₂(g) + 3H₂(g) ⇌ 2NH₃(g)',
    deltaHStandard: -92.4,
    deltaSStandard: -198.3,
    activationEnergy: 95.0,
    catalysedEa: 46.0,
    specificHeatCapacity: 4.10,
    category: 'Reversibel',
    description: 'Reaksi eksotermik dengan penurunan entropi; katalis besi mempercepat laju tanpa menggeser ΔG.',
  },
];

export const REDOX_PRESETS: RedoxCouplePreset[] = [
  {
    id: 'zn-cu-daniell',
    name: 'Sel Daniell (Zn | Zn²⁺ || Cu²⁺ | Cu)',
    anodeHalf: 'Zn(s) → Zn²⁺(aq) + 2e⁻',
    cathodeHalf: 'Cu²⁺(aq) + 2e⁻ → Cu(s)',
    e0Anode: -0.76,
    e0Cathode: 0.34,
    electronsTransferred: 2,
  },
  {
    id: 'mg-ag-high',
    name: 'Sel Magnesium-Perak (Mg | Mg²⁺ || Ag⁺ | Ag)',
    anodeHalf: 'Mg(s) → Mg²⁺(aq) + 2e⁻',
    cathodeHalf: '2Ag⁺(aq) + 2e⁻ → 2Ag(s)',
    e0Anode: -2.37,
    e0Cathode: 0.80,
    electronsTransferred: 2,
  },
  {
    id: 'fe-cu-volta',
    name: 'Sel Besi-Tembaga (Fe | Fe²⁺ || Cu²⁺ | Cu)',
    anodeHalf: 'Fe(s) → Fe²⁺(aq) + 2e⁻',
    cathodeHalf: 'Cu²⁺(aq) + 2e⁻ → Cu(s)',
    e0Anode: -0.44,
    e0Cathode: 0.34,
    electronsTransferred: 2,
  },
  {
    id: 'ni-ag-volta',
    name: 'Sel Nikel-Perak (Ni | Ni²⁺ || Ag⁺ | Ag)',
    anodeHalf: 'Ni(s) → Ni²⁺(aq) + 2e⁻',
    cathodeHalf: '2Ag⁺(aq) + 2e⁻ → 2Ag(s)',
    e0Anode: -0.25,
    e0Cathode: 0.80,
    electronsTransferred: 2,
  },
];

export const GRAVITY_PRESETS = [
  { id: 'earth', name: 'Bumi (g = 9.81 m/s²)', g: 9.81 },
  { id: 'moon', name: 'Bulan (g = 1.62 m/s²)', g: 1.62 },
  { id: 'mars', name: 'Mars (g = 3.72 m/s²)', g: 3.72 },
  { id: 'jupiter', name: 'Jupiter (g = 24.79 m/s²)', g: 24.79 },
  { id: 'zero-g', name: 'Mikrogravitasi Orbit (g = 0.05 m/s²)', g: 0.05 },
];

export const WORKSHEET_QUESTIONS: WorksheetQuestion[] = [
  {
    id: 'q-newton-1',
    domain: 'Fisika',
    topic: 'Hukum II Newton & Gaya Gesek',
    questionText:
      'Sebuah balok bermassa m = 5 kg ditarik pada bidang datar (θ = 0°) dengan gaya mendatar F = 50 N. Jika koefisien gesek kinetis μk = 0.10 dan g = 10 m/s², berapakah percepatan balok a?',
    formulaHint: 'a = (F - μk · m · g) / m',
    unit: 'm/s²',
    correctValue: 9.0,
    tolerance: 0.15,
    explanation:
      'Gaya normal N = m·g = 50 N, gaya gesek kinetis fk = 0.10 × 50 = 5 N. Resultan gaya ΣF = 50 - 5 = 45 N, sehingga a = 45 / 5 = 9.0 m/s².',
    scaffoldedHints: [
      'Konsep Fisis: Gaya gesek kinetis (fk) selalu berlawanan arah dengan gaya tarik F dan mengurangi gaya resultan yang mempercepat balok.',
      'Identifikasi Variabel: Hitung dulu gaya normal N = m · g = 5 × 10 = 50 N, lalu cari gaya gesek fk = μk · N.',
      'Langkah Substitusi: fk = 0.10 × 50 = 5 N. Kurangkan dari F (50 - 5 = 45 N), lalu bagi dengan massa m = 5 kg.',
    ],
  },
  {
    id: 'q-collision-2',
    domain: 'Fisika',
    topic: 'Tumbukan Sentral & Kekekalan Momentum',
    questionText:
      'Benda m₁ = 4 kg bergerak dengan kecepatan v₁ = 6 m/s menumbuk benda m₂ = 2 kg yang diam (v₂ = 0 m/s) secara tidak lenting sama sekali (e = 0). Berapakah kecepatan akhir kedua benda setelah menyatu?',
    formulaHint: "v' = (m₁·v₁ + m₂·v₂) / (m₁ + m₂)",
    unit: 'm/s',
    correctValue: 4.0,
    tolerance: 0.1,
    explanation:
      "Momentum awal p = 4×6 + 2×0 = 24 kg·m/s. Setelah tumbukan inelastis sempurna (e=0), v' = 24 / (4 + 2) = 4.0 m/s.",
    scaffoldedHints: [
      'Konsep Fisis: Pada tumbukan tidak lenting sama sekali (e = 0), kedua benda menyatu setelah tumbukan dan bergerak bersama dengan satu kecepatan akhir v\'.',
      'Identifikasi Variabel: Momentum total awal p_awal = m₁·v₁ + m₂·v₂ = (4 × 6) + (2 × 0) = 24 kg·m/s.',
      'Langkah Substitusi: Bagi momentum total awal (24 kg·m/s) dengan jumlah massa gabungan (m₁ + m₂ = 4 + 2 = 6 kg).',
    ],
  },
  {
    id: 'q-thermo-3',
    domain: 'Kimia',
    topic: 'Energi Bebas Gibbs & Spontanitas Reaksi',
    questionText:
      'Suatu reaksi kimia memiliki perubahan entalpi ΔH° = -60 kJ/mol dan perubahan entropi ΔS° = 100 J/(mol·K) pada suhu T = 300 K. Hitunglah nilai energi bebas Gibbs ΔG dalam satuan kJ/mol!',
    formulaHint: 'ΔG = ΔH - T · (ΔS / 1000)',
    unit: 'kJ/mol',
    correctValue: -90.0,
    tolerance: 0.5,
    explanation:
      'ΔG = -60 kJ/mol - (300 K × 0.100 kJ/(mol·K)) = -60 - 30 = -90.0 kJ/mol (Reaksi berlangsung spontan).',
    scaffoldedHints: [
      'Konsep Fisis: Hati-hati terhadap perbedaan satuan! ΔH dalam kJ/mol sedangkan ΔS diberikan dalam J/(mol·K).',
      'Identifikasi Variabel: Ubah ΔS ke kJ/(mol·K) terlebih dahulu: 100 J/(mol·K) ÷ 1000 = 0.10 kJ/(mol·K).',
      'Langkah Substitusi: Hitung suku T·ΔS = 300 × 0.10 = 30 kJ/mol, lalu masukkan ke ΔG = -60 - 30.',
    ],
  },
  {
    id: 'q-titration-4',
    domain: 'Kimia',
    topic: 'Stoikiometri Titrasi Asam-Basa',
    questionText:
      'Sebanyak 25 mL larutan HCl 0.20 M dititrasi dengan larutan standar NaOH 0.25 M. Pada volume NaOH berapakah titik ekuivalen (pH = 7.0) tercapai?',
    formulaHint: 'M_a · V_a = M_b · V_b',
    unit: 'mL',
    correctValue: 20.0,
    tolerance: 0.2,
    explanation:
      'Pada titik ekuivalen mol H⁺ = mol OH⁻: 0.20 M × 25 mL = 0.25 M × V_b ⇒ V_b = 5.0 / 0.25 = 20.0 mL.',
    scaffoldedHints: [
      'Konsep Fisis: Titik ekuivalen asam kuat HCl (valensi 1) dan basa kuat NaOH (valensi 1) tercapai saat milimol H⁺ tepat sama dengan milimol OH⁻.',
      'Identifikasi Variabel: Hitung milimol asam HCl = M_a × V_a = 0.20 M × 25 mL = 5.0 mmol.',
      'Langkah Substitusi: Karena mmol NaOH = 5.0 mmol dan M_b = 0.25 M, maka V_b = 5.0 ÷ 0.25 mL.',
    ],
  },
  {
    id: 'q-kepler-5',
    domain: 'Astronomi',
    topic: 'Hukum III Kepler Orbit Planet',
    questionText:
      'Sebuah planet ekstrasurya mengorbit bintang bermassa identik Matahari (1.0 M☉) pada sumbu semi-mayor a = 4.0 AU. Berapakah periode orbit planet tersebut (T) dalam satuan tahun Bumi?',
    formulaHint: 'T² = a³ / M_*',
    unit: 'tahun',
    correctValue: 8.0,
    tolerance: 0.15,
    explanation:
      'Berdasarkan Hukum III Kepler untuk M_* = 1 M☉: T² = a³ = 4³ = 64 ⇒ T = √64 = 8.0 tahun Bumi.',
    scaffoldedHints: [
      'Konsep Fisis: Hukum III Kepler menyatakan kuadrat periode orbit (T²) berbanding lurus dengan pangkat tiga jarak rata-rata (a³).',
      'Identifikasi Variabel: Untuk M_* = 1.0 M☉, berlaku T² = a³. Hitung nilai pangkat tiga dari a = 4.0 AU (4 × 4 × 4).',
      'Langkah Substitusi: Karena a³ = 64, maka T² = 64. Tarik akar kuadrat dari 64 untuk memperoleh periode T.',
    ],
  },
  {
    id: 'q-exoplanet-6',
    domain: 'Astronomi',
    topic: 'Fotometri Transit Eksoplanet',
    questionText:
      'Sebuah eksoplanet berjari-jari Rp = 0.10 R* melintas tepat di depan piringan bintang induknya. Berapa persen penurunan fluks cahaya bintang (kedalaman transit ΔF/F) yang teramati teleskop?',
    formulaHint: 'ΔF/F (%) = (Rp / R*)² × 100%',
    unit: '%',
    correctValue: 1.0,
    tolerance: 0.05,
    explanation:
      'Kedalaman transit sebanding dengan rasio luas penampang planet terhadap bintang: (0.10)² × 100% = 0.01 × 100% = 1.0%.',
    scaffoldedHints: [
      'Konsep Fisis: Penurunan kecerahan bintang saat transit sebanding dengan luas lingkaran planet dibagi luas lingkaran bintang.',
      'Identifikasi Variabel: Rasio jari-jari Rp / R* sudah diketahui sebesar 0.10. Kuadratkan rasio tersebut: (0.10)².',
      'Langkah Substitusi: (0.10)² = 0.01. Kalikan dengan 100% untuk mendapatkan persentase peredupan cahaya.',
    ],
  },
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

export function calculateTitrationPh(
  acidConc: number,
  acidVolMl: number,
  baseConc: number,
  baseVolMl: number,
  acidPka = 1.0
): number {
  const nAcid = acidConc * acidVolMl;
  const nBase = baseConc * baseVolMl;
  const totalVol = Math.max(1, acidVolMl + baseVolMl);
  const isWeakAcid = acidPka > 2.0;

  if (Math.abs(nAcid - nBase) < 1e-4) {
    if (!isWeakAcid) return 7.0;
    const saltConc = nAcid / totalVol;
    const pKb = 14 - acidPka;
    const pOH = 0.5 * (pKb - Math.log10(Math.max(1e-6, saltConc)));
    return Number(Math.min(13.5, Math.max(7.0, 14 - pOH)).toFixed(2));
  }

  if (nBase < nAcid) {
    if (!isWeakAcid) {
      const hConc = (nAcid - nBase) / totalVol;
      return Number(Math.max(0.3, -Math.log10(hConc)).toFixed(2));
    }
    if (nBase <= 0.01) {
      const hConc = Math.sqrt(Math.pow(10, -acidPka) * acidConc);
      return Number(Math.max(1.0, -Math.log10(hConc)).toFixed(2));
    }
    const ratio = nBase / Math.max(1e-5, nAcid - nBase);
    return Number(Math.max(1.0, acidPka + Math.log10(ratio)).toFixed(2));
  }

  const ohConc = (nBase - nAcid) / totalVol;
  const pOH = -Math.log10(Math.max(1e-7, ohConc));
  return Number(Math.min(13.8, 14 - pOH).toFixed(2));
}

export function calculateChemistryMetrics(params: ChemistryParams): ChemistryMetrics {
  const preset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) || THERMO_PRESETS[0];
  const tempKelvin = params.initialTempC + 273.15;
  const volumeL = Math.max(0.01, params.solutionVolumeMl / 1000);
  const molesReacted = params.reactantConcentration * volumeL;

  const deltaHReaction = preset.deltaHStandard;
  const deltaSReaction = preset.deltaSStandard;
  const deltaG = deltaHReaction - tempKelvin * (deltaSReaction / 1000);
  const isSpontaneous = deltaG < 0;

  const massSolutionGrams = Math.max(10, params.solutionVolumeMl);
  const heatReleasedJoules = -molesReacted * deltaHReaction * 1000;
  const deltaTempC =
    heatReleasedJoules / (massSolutionGrams * preset.specificHeatCapacity);
  const finalTempC = Math.max(
    -20,
    Math.min(350, params.initialTempC + deltaTempC)
  );

  const R = 8.314;
  const effectiveEa = params.useCatalyst
    ? preset.catalysedEa
    : preset.activationEnergy;
  const stirringFactor = 1 + (params.stirringRpm - 100) / 1000;
  const pressureFactor = Math.pow(Math.max(0.5, params.pressureAtm), 0.35);
  const preExponentialA = 1.2e4 * stirringFactor * pressureFactor;
  const rateConstantK =
    preExponentialA * Math.exp(-(effectiveEa * 1000) / (R * tempKelvin));
  const reactionRate = rateConstantK * params.reactantConcentration;

  const rawExponent = Math.max(
    -15,
    Math.min(15, -(deltaG * 1000) / (R * tempKelvin))
  );
  const equilibriumConstantKeq = Math.exp(rawExponent);

  const thermalClassification: 'Eksotermik' | 'Endotermik' | 'Atermal' =
    deltaHReaction < -0.5
      ? 'Eksotermik'
      : deltaHReaction > 0.5
      ? 'Endotermik'
      : 'Atermal';

  const spontaneityLabel = isSpontaneous
    ? 'Spontan (ΔG < 0)'
    : Math.abs(deltaG) < 0.5
    ? 'Kesetimbangan (ΔG ≈ 0)'
    : 'Non-Spontan (ΔG > 0)';

  const ma = Math.max(0.01, params.analyteAcidConc || 0.2);
  const va = Math.max(5, params.analyteVolumeMl || 25);
  const mb = Math.max(0.01, params.titrantBaseConc || 0.2);
  const vb = Math.max(0, params.titrantAddedMl ?? 15);
  const pka = params.acidPka ?? 1.0;

  const equivalenceVolumeMl = (ma * va) / mb;
  const currentPh = calculateTitrationPh(ma, va, mb, vb, pka);
  const titrationRegion:
    | 'Pra-Ekuivalen (Asam)'
    | 'Titik Ekuivalen'
    | 'Pasca-Ekuivalen (Basa)' =
    Math.abs(vb - equivalenceVolumeMl) <= 0.6
      ? 'Titik Ekuivalen'
      : vb < equivalenceVolumeMl
      ? 'Pra-Ekuivalen (Asam)'
      : 'Pasca-Ekuivalen (Basa)';

  let indicatorColorHex = '#F8FAFC';
  let indicatorColorName = 'Bening (Tak Berwarna)';
  if (params.indicatorType === 'bromtimol-biru') {
    if (currentPh < 6.0) {
      indicatorColorHex = '#FACC15';
      indicatorColorName = 'Kuning Asam (pH < 6.0)';
    } else if (currentPh <= 7.6) {
      indicatorColorHex = '#10B981';
      indicatorColorName = 'Hijau Transisi Netral (6.0–7.6)';
    } else {
      indicatorColorHex = '#0284C7';
      indicatorColorName = 'Biru Basa (pH > 7.6)';
    }
  } else if (params.indicatorType === 'metil-jingga') {
    if (currentPh < 3.1) {
      indicatorColorHex = '#F43F5E';
      indicatorColorName = 'Merah Asam (pH < 3.1)';
    } else if (currentPh <= 4.4) {
      indicatorColorHex = '#FB923C';
      indicatorColorName = 'Jingga Transisi (3.1–4.4)';
    } else {
      indicatorColorHex = '#FACC15';
      indicatorColorName = 'Kuning (pH > 4.4)';
    }
  } else {
    if (currentPh < 8.2) {
      indicatorColorHex = '#E2E8F0';
      indicatorColorName = 'Bening Asam/Netral (pH < 8.2)';
    } else if (currentPh <= 10.0) {
      indicatorColorHex = '#F472B6';
      indicatorColorName = 'Merah Muda Titrasi (8.2–10.0)';
    } else {
      indicatorColorHex = '#E11D48';
      indicatorColorName = 'Magenta Pekat Basa (pH > 10)';
    }
  }

  const redox =
    REDOX_PRESETS.find((r) => r.id === params.redoxPairId) || REDOX_PRESETS[0];
  const standardCellPotentialE0 = redox.e0Cathode - redox.e0Anode;
  const cAnode = Math.max(0.0001, params.anodeConcM || 1.0);
  const cCathode = Math.max(0.0001, params.cathodeConcM || 1.0);
  const reactionQuotientQ = cAnode / cCathode;
  const FARADAY = 96485;
  const nernstCellPotentialE =
    standardCellPotentialE0 -
    ((R * tempKelvin) / (redox.electronsTransferred * FARADAY)) *
      Math.log(reactionQuotientQ);
  const electroFreeEnergyDeltaG =
    (-redox.electronsTransferred * FARADAY * nernstCellPotentialE) / 1000;

  // Advanced chemistry modules calculations
  const nGas = Math.max(0.1, params.gasMoles ?? 1.0);
  const tGasK = Math.max(100, params.gasTemperatureK ?? 300);
  const vGasL = Math.max(1.0, params.gasVolumeL ?? 10.0);
  const R_L_atm = 0.082057; // L·atm/(mol·K)
  const gasPressureAtm = (nGas * R_L_atm * tGasK) / vGasL;
  const gasPressureKpa = gasPressureAtm * 101.325;
  const gasInternalEnergyJ = 1.5 * nGas * 8.314 * tGasK;
  const gasDensity = (gasPressureAtm * 28.97) / (R_L_atm * tGasK);

  const tKinC = params.kineticsTempC ?? 25;
  const tKinK = tKinC + 273.15;
  const eaKinJ = (params.kineticsEaKj ?? 52) * 1000;
  const kKinetics = 1.0e8 * Math.exp(-eaKinJ / (8.314 * tKinK));
  const kineticsHalfLifeSec = Math.LN2 / Math.max(1e-9, kKinetics);

  const cAnalyteMm = params.spectroConcMm ?? 0.08;
  const bPathCm = params.spectroPathLengthCm ?? 1.0;
  const epsMolar = params.spectroMolarAbsorptivity ?? 9500;
  const cAnalyteM = cAnalyteMm / 1000;
  const spectroAbsorbance = Math.min(3.5, epsMolar * bPathCm * cAnalyteM);
  const spectroTransmittancePct = Math.max(0, 100 * Math.pow(10, -spectroAbsorbance));

  return {
    tempKelvin: Number(tempKelvin.toFixed(2)),
    finalTempC: Number(finalTempC.toFixed(2)),
    deltaTempC: Number(deltaTempC.toFixed(2)),
    molesReacted: Number(molesReacted.toFixed(3)),
    heatReleasedJoules: Number(heatReleasedJoules.toFixed(1)),
    deltaHReaction: Number(deltaHReaction.toFixed(2)),
    deltaSReaction: Number(deltaSReaction.toFixed(2)),
    deltaG: Number(deltaG.toFixed(2)),
    isSpontaneous,
    effectiveEa: Number(effectiveEa.toFixed(2)),
    rateConstantK: Number(rateConstantK.toFixed(4)),
    reactionRate: Number(reactionRate.toFixed(4)),
    equilibriumConstantKeq: Number(equilibriumConstantKeq.toFixed(3)),
    thermalClassification,
    spontaneityLabel,
    currentPh: Number(currentPh.toFixed(2)),
    equivalenceVolumeMl: Number(equivalenceVolumeMl.toFixed(1)),
    titrationRegion,
    indicatorColorHex,
    indicatorColorName,
    standardCellPotentialE0: Number(standardCellPotentialE0.toFixed(3)),
    nernstCellPotentialE: Number(nernstCellPotentialE.toFixed(3)),
    reactionQuotientQ: Number(reactionQuotientQ.toFixed(4)),
    electroFreeEnergyDeltaG: Number(electroFreeEnergyDeltaG.toFixed(2)),
    gasPressureAtm: Number(gasPressureAtm.toFixed(3)),
    gasPressureKpa: Number(gasPressureKpa.toFixed(1)),
    gasInternalEnergyJ: Number(gasInternalEnergyJ.toFixed(1)),
    gasDensity: Number(gasDensity.toFixed(3)),
    kineticsHalfLifeSec: Number(kineticsHalfLifeSec.toFixed(1)),
    spectroAbsorbance: Number(spectroAbsorbance.toFixed(3)),
    spectroTransmittancePct: Number(spectroTransmittancePct.toFixed(2)),
    boyleConstantPv: Number((gasPressureAtm * vGasL).toFixed(3)),
    arrheniusK: Number(kKinetics.toExponential(3)),
    absorbanceA: Number(spectroAbsorbance.toFixed(3)),
    transmittancePct: Number(spectroTransmittancePct.toFixed(2)),
    molarExtinctionEpsilon: epsMolar,
    absorbedColorName: params.spectroWavelengthNm ? (params.spectroWavelengthNm < 450 ? 'Violet/Biru' : params.spectroWavelengthNm < 520 ? 'Sian/Hijau' : params.spectroWavelengthNm < 590 ? 'Kuning' : 'Jingga/Merah') : 'Sian/Biru (480-520 nm)',
  };
}

export function calculateAstronomyMetrics(
  params: AstronomyParams
): AstronomyMetrics {
  // 1. Solar System & Kepler Orbit Calculations
  const a = Math.max(0.1, params.customSemiMajorAxisAu || 1.0);
  const e = Math.max(0, Math.min(0.95, params.customEccentricity ?? 0.017));
  const mStar = Math.max(0.1, params.centralStarMassSolar || 1.0);

  const orbitalPeriodYears = Math.sqrt((a * a * a) / mStar);
  const perihelionAu = a * (1 - e);
  const aphelionAu = a * (1 + e);

  // Earth mean orbital velocity is 29.78 km/s at a = 1 AU, M = 1 M_sun
  const meanOrbitalVelocityKms = 29.78 * Math.sqrt(mStar / a);
  const perihelionVelocityKms =
    meanOrbitalVelocityKms * Math.sqrt((1 + e) / Math.max(0.02, 1 - e));
  const aphelionVelocityKms =
    meanOrbitalVelocityKms * Math.sqrt(Math.max(0.02, 1 - e) / (1 + e));
  const keplerRatioT2OverA3 =
    (orbitalPeriodYears * orbitalPeriodYears) / (a * a * a);

  // 2. Milky Way Galaxy Rotation Curve & Sgr A* Calculations
  const rKpc = Math.max(0.3, params.galactocentricRadiusKpc || 8.2);
  const bulgeDiskFactor = Math.max(0.2, params.bulgeDiskMassFactor || 1.0);
  const dmFraction = Math.max(0, params.darkMatterHaloFraction ?? 1.0);
  const sgrAMassMillion = Math.max(1.0, params.sgrAStarMassMillionSolar || 4.15);

  // Luminous bulge + disk mass profile (rises up to ~3.5 kpc then falls as r^-1/2)
  const bulgeRadiusScale = 2.2;
  const luminousVelocitySq =
    bulgeDiskFactor *
    ((235 * 235 * rKpc) / Math.pow(rKpc * rKpc + bulgeRadiusScale * bulgeRadiusScale, 0.75)) *
    (3.2 / Math.max(2.5, rKpc));
  const keplerianVelocityKms = Math.sqrt(Math.max(400, luminousVelocitySq));

  // Isothermal Dark Matter Halo contribution maintains ~220-238 km/s flat curve at large R
  const haloAsymptoticV = 215 * Math.sqrt(dmFraction);
  const dmVelocitySq =
    haloAsymptoticV *
    haloAsymptoticV *
    (1 - (2.5 / Math.max(0.5, rKpc)) * Math.atan(rKpc / 2.5));
  const observedDarkMatterVelocityKms = Math.sqrt(
    keplerianVelocityKms * keplerianVelocityKms + Math.max(0, dmVelocitySq)
  );
  const velocityAnomalyKms = Math.max(
    0,
    observedDarkMatterVelocityKms - keplerianVelocityKms
  );

  // T_gal (Myr): 1 kpc = 3.086e16 km, 1 Myr = 3.154e13 s => T(Myr) ≈ 977.8 * (2*pi*R_kpc) / v_kms
  const galacticOrbitalPeriodMyr =
    (977.8 * 2 * Math.PI * rKpc) / Math.max(10, observedDarkMatterVelocityKms);

  // Enclosed Mass M(<R) = v^2 * R / G (in units of 10^9 M_sun, G ≈ 4.301e-6 kpc (km/s)^2 / M_sun)
  const enclosedMassBillionSolar =
    (observedDarkMatterVelocityKms * observedDarkMatterVelocityKms * rKpc) /
    (4.301e-6 * 1e9);

  // Schwarzschild radius R_s = 2.95 km * (M / M_sun)
  const sgrASchwarzschildRadiusMillionKm =
    (2.95 * sgrAMassMillion * 1e6) / 1e6;

  // 3. Stellar H-R Diagram & Exoplanet Transit Photometry
  const tEff = Math.max(2500, params.starEffectiveTempK || 5778);
  const rStar = Math.max(0.08, params.starRadiusSolar || 1.0);
  const rPlanetEarth = Math.max(0.2, params.exoplanetRadiusEarth || 1.0);
  const dPlanetAu = Math.max(0.02, params.exoplanetOrbitAu || 1.0);

  // Stefan-Boltzmann L/L_sun = (R/R_sun)^2 * (T/5778)^4
  const stellarLuminositySolar =
    rStar * rStar * Math.pow(tEff / 5778, 4);

  let spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' = 'G';
  let starColorHex = '#FDE047';
  if (tEff >= 25000) {
    spectralClass = 'O';
    starColorHex = '#60A5FA';
  } else if (tEff >= 10000) {
    spectralClass = 'B';
    starColorHex = '#93C5FD';
  } else if (tEff >= 7500) {
    spectralClass = 'A';
    starColorHex = '#F8FAFC';
  } else if (tEff >= 6000) {
    spectralClass = 'F';
    starColorHex = '#FEF08A';
  } else if (tEff >= 5200) {
    spectralClass = 'G';
    starColorHex = '#FACC15';
  } else if (tEff >= 3700) {
    spectralClass = 'K';
    starColorHex = '#FB923C';
  } else {
    spectralClass = 'M';
    starColorHex = '#F87171';
  }

  // Approximate main-sequence lifetime tau ≈ 10 Gyr * (L / L_sun)^(-0.7)
  const mainSequenceLifetimeGyr = Math.min(
    200,
    10 * Math.pow(Math.max(0.001, stellarLuminositySolar), -0.65)
  );

  // Transit depth: R_sun = 109.1 R_earth => (Rp / R*) = (rPlanetEarth) / (109.1 * rStar)
  const radiusRatio = rPlanetEarth / (109.1 * rStar);
  const transitDepthPct = Math.min(25, radiusRatio * radiusRatio * 100);
  const transitDepthPpm = Math.round(transitDepthPct * 10000);

  const habitableZoneInnerAu = Math.sqrt(stellarLuminositySolar / 1.1);
  const habitableZoneOuterAu = Math.sqrt(stellarLuminositySolar / 0.53);
  const isInHabitableZone =
    dPlanetAu >= habitableZoneInnerAu && dPlanetAu <= habitableZoneOuterAu;

  // Advanced astronomy modules
  const tWienK = Math.max(1000, params.starEffectiveTempK || 5800);
  const wienPeakWavelengthNm = 2.89777e6 / tWienK;

  const dHubbleMpc = Math.max(1, params.galaxyDistanceMpc ?? 150);
  const h0Hubble = params.hubbleConstantH0 ?? 70;
  const hubbleRecessionVelocityKmS = h0Hubble * dHubbleMpc;
  const hubbleRedshiftZ = hubbleRecessionVelocityKmS / 299792;
  const restLambdaNm = params.restWavelengthNm ?? 393.4;
  const hubbleObservedWavelengthNm = restLambdaNm * (1 + hubbleRedshiftZ);

  return {
    orbitalPeriodYears: Number(orbitalPeriodYears.toFixed(3)),
    perihelionAu: Number(perihelionAu.toFixed(3)),
    aphelionAu: Number(aphelionAu.toFixed(3)),
    meanOrbitalVelocityKms: Number(meanOrbitalVelocityKms.toFixed(2)),
    perihelionVelocityKms: Number(perihelionVelocityKms.toFixed(2)),
    aphelionVelocityKms: Number(aphelionVelocityKms.toFixed(2)),
    keplerRatioT2OverA3: Number(keplerRatioT2OverA3.toFixed(3)),
    keplerianVelocityKms: Number(keplerianVelocityKms.toFixed(1)),
    observedDarkMatterVelocityKms: Number(
      observedDarkMatterVelocityKms.toFixed(1)
    ),
    velocityAnomalyKms: Number(velocityAnomalyKms.toFixed(1)),
    galacticOrbitalPeriodMyr: Number(galacticOrbitalPeriodMyr.toFixed(1)),
    enclosedMassBillionSolar: Number(enclosedMassBillionSolar.toFixed(2)),
    sgrASchwarzschildRadiusMillionKm: Number(
      sgrASchwarzschildRadiusMillionKm.toFixed(2)
    ),
    spectralClass,
    starColorHex,
    stellarLuminositySolar: Number(stellarLuminositySolar.toFixed(3)),
    mainSequenceLifetimeGyr: Number(mainSequenceLifetimeGyr.toFixed(2)),
    transitDepthPct: Number(transitDepthPct.toFixed(4)),
    transitDepthPpm,
    habitableZoneInnerAu: Number(habitableZoneInnerAu.toFixed(2)),
    habitableZoneOuterAu: Number(habitableZoneOuterAu.toFixed(2)),
    isInHabitableZone,
    wienPeakWavelengthNm: Number(wienPeakWavelengthNm.toFixed(1)),
    peakWavelengthNm: Number(wienPeakWavelengthNm.toFixed(1)),
    surfaceFluxWPerM2: Number((5.670374e-8 * Math.pow(tWienK, 4)).toPrecision(4)),
    hubbleRecessionVelocityKmS: Number(hubbleRecessionVelocityKmS.toFixed(1)),
    recessionVelocityKms: Number(hubbleRecessionVelocityKmS.toFixed(1)),
    hubbleRedshiftZ: Number(hubbleRedshiftZ.toFixed(4)),
    redshiftZ: Number(hubbleRedshiftZ.toFixed(4)),
    hubbleObservedWavelengthNm: Number(hubbleObservedWavelengthNm.toFixed(2)),
    hubbleAgeBillionYears: Number((977.8 / Math.max(1, h0Hubble)).toFixed(1)),
  };
}

// ============================================================================
// QUANTITATIVE BIOLOGY COMPUTATION ENGINE (TAHAP 2)
// 1. Michaelis-Menten Enzyme Kinetics with Arrhenius & Thermal Denaturation
// 2. Lotka-Volterra Predator-Prey Ecosystem Differential Equations
// 3. Van 't Hoff Cell Osmosis, Transmembrane Water Flux & Turgor Pressure
// ============================================================================

export interface EnzymeKineticsParams {
  substrateConcMm: number; // [S] in mM (0.1 - 100)
  vMaxBase: number; // V_max in umol/(L*s) (default 120)
  kmConstantMm: number; // K_m in mM (default 4.5)
  temperatureC: number; // T in Celsius (0 - 90, optimum ~37°C, denaturation > 45°C)
  optimalTempC?: number; // T_opt (default 37°C)
  denaturationThresholdC?: number; // T_denat (default 45°C)
  activationEnergyEaJ?: number; // E_a in J/mol (default 45000)
  solutionPh: number; // pH (1 - 14)
  optimalPh?: number; // pH_opt (default 7.0)
  phToleranceSigma?: number; // bell curve width (default 2.2)
}

export interface EnzymeKineticsMetrics {
  reactionVelocityV: number; // v = (V_max * [S]) / (K_m + [S]) * f(T) * f(pH)
  effectiveVmax: number; // V_max * f(T) * f(pH)
  saturationFraction: number; // [S] / (K_m + [S])
  arrheniusFactor: number; // thermal activation factor
  denaturationFactor: number; // remaining folded protein fraction (0 - 1)
  denaturationDegreePct: number; // % denatured protein (0 - 100)
  thermalFactor: number; // combined f(T)
  phFactor: number; // bell-shaped f(pH)
  lineweaverSlope: number; // K_m / V_max_eff
  lineweaverIntercept: number; // 1 / V_max_eff
}

export interface LotkaVolterraParams {
  preyPopulationX: number; // x (mangsa, e.g., 40)
  predatorPopulationY: number; // y (predator, e.g., 9)
  preyGrowthRateAlpha: number; // alpha (laju lahir mangsa, e.g., 1.1)
  predationRateBeta: number; // beta (laju dimangsa, e.g., 0.04)
  predatorReproductionDelta: number; // delta (efisiensi reproduksi predator, e.g., 0.01)
  predatorMortalityGamma: number; // gamma (laju kematian predator, e.g., 0.4)
}

export interface LotkaVolterraMetrics {
  dPreyDt: number; // dx/dt = alpha*x - beta*x*y
  dPredatorDt: number; // dy/dt = delta*x*y - gamma*y
  equilibriumPreyX: number; // x* = gamma / delta
  equilibriumPredatorY: number; // y* = alpha / beta
  preyNetGrowthRatePct: number; // ((alpha - beta*y) * 100)
  predatorNetGrowthRatePct: number; // ((delta*x - gamma) * 100)
  phaseInvariantH: number; // delta*x - gamma*ln(x) + beta*y - alpha*ln(y)
  oscillationPeriodApprox: number; // 2*pi / sqrt(alpha * gamma)
}

export interface CellOsmosisParams {
  intracellularMolarityM: number; // M_int (mol/L, e.g., 0.28 M)
  extracellularMolarityM: number; // M_ext (mol/L, e.g., 0.10 - 1.00 M)
  vantHoffFactorInt?: number; // i_int (default 1.0)
  vantHoffFactorExt?: number; // i_ext (default 1.0 for sucrose, 2.0 for NaCl)
  temperatureC: number; // T in Celsius (default 25°C)
  initialCellVolumeUm3?: number; // V_0 in um^3 (default 1000)
  currentCellVolumeUm3?: number; // V(t) in um^3
  membranePermeabilityLp?: number; // L_p hydraulic conductivity (default 0.18 um/(s*atm))
  cellSurfaceAreaUm2?: number; // A_cell in um^2 (default 484)
  cellWallElasticModulusAtm?: number; // epsilon_wall (default 12.0 atm, 0 for animal RBC)
  hasCellWall?: boolean; // true for plant cell (turgor/plasmolysis), false for animal cell (lysis/crenation)
}

export interface CellOsmosisMetrics {
  osmoticPressureIntAtm: number; // Pi_int = i * M_int * R * T (atm)
  osmoticPressureExtAtm: number; // Pi_ext = i * M_ext * R * T (atm)
  osmoticPressureIntMpa: number; // MPa
  osmoticPressureExtMpa: number; // MPa
  turgorPressureAtm: number; // P_turgor (atm)
  netWaterPotentialAtm: number; // Delta_Psi = (Pi_int - Pi_ext) - P_turgor
  netWaterFluxUm3PerSec: number; // dV/dt = L_p * A * Delta_Psi
  equilibriumVolumeRatioPct: number; // (V_eq / V_0) * 100%
  volumeChangePct: number; // ((V - V_0) / V_0) * 100%
  tonicityState: 'Hipotonik (Lisis)' | 'Hipotonik (Turgid)' | 'Isotonik (Setimbang)' | 'Hipertonik (Plasmolisis)';
  isPlasmolyzed: boolean;
  isLysed: boolean;
}

export interface BiologyParams {
  mode: BiologyMode;
  // Enzyme Kinetics
  substrateConcMm?: number;
  vMaxBase?: number;
  kmConstantMm?: number;
  temperatureC?: number;
  optimalTempC?: number;
  denaturationThresholdC?: number;
  solutionPh?: number;
  optimalPh?: number;
  // Lotka-Volterra Predator-Prey
  preyPopulationX?: number;
  predatorPopulationY?: number;
  preyGrowthRateAlpha?: number;
  predationRateBeta?: number;
  predatorReproductionDelta?: number;
  predatorMortalityGamma?: number;
  // Cell Osmosis & Tonicity
  intracellularMolarityM?: number;
  extracellularMolarityM?: number;
  vantHoffFactorInt?: number;
  vantHoffFactorExt?: number;
  initialCellVolumeUm3?: number;
  currentCellVolumeUm3?: number;
  hasCellWall?: boolean;
}

export interface BiologyMetrics {
  enzymeKinetics: EnzymeKineticsMetrics;
  predatorPrey: LotkaVolterraMetrics;
  cellOsmosis: CellOsmosisMetrics;
}

/**
 * 1. Kinetika Enzim Michaelis-Menten:
 * v = (V_max * [S]) / (K_m + [S]) * f(T) * f(pH)
 * Includes Arrhenius thermal activation up to T_opt and exponential protein denaturation above T_opt / 45°C,
 * plus a bell-shaped pH activity curve.
 */
export function calculateEnzymeKinetics(params: EnzymeKineticsParams): EnzymeKineticsMetrics {
  const S = Math.max(0, params.substrateConcMm);
  const vMax = Math.max(0.01, params.vMaxBase);
  const km = Math.max(0.01, params.kmConstantMm);
  const tempC = params.temperatureC;
  const tOptC = params.optimalTempC ?? 37.0;
  const tDenatC = params.denaturationThresholdC ?? 45.0;
  const ea = params.activationEnergyEaJ ?? 45000;
  const ph = params.solutionPh;
  const phOpt = params.optimalPh ?? 7.0;
  const phSigma = Math.max(0.2, params.phToleranceSigma ?? 2.2);

  const R_GAS = 8.314462618; // J/(mol·K)
  const tempK = Math.max(250, tempC + 273.15);
  const tOptK = tOptC + 273.15;

  // Arrhenius thermal activation normalized to 1.0 at T_opt
  const rawArrhenius = Math.exp((-ea / R_GAS) * (1 / tempK - 1 / tOptK));
  const arrheniusFactor = Math.min(1.6, Math.max(0.01, rawArrhenius));

  // Protein folding stability & exponential thermal denaturation above T_opt (and steep drop for T > 45°C)
  let denaturationFactor = 1.0;
  if (tempC > tOptC) {
    if (tempC <= tDenatC) {
      const mildExcess = tempC - tOptC;
      denaturationFactor = Math.exp(-0.012 * mildExcess * mildExcess);
    } else {
      const preThresholdFactor = Math.exp(-0.012 * Math.pow(tDenatC - tOptC, 2));
      const severeExcess = tempC - tDenatC;
      // Exponential protein denaturation for T > T_denat (45°C)
      denaturationFactor = preThresholdFactor * Math.exp(-0.16 * severeExcess);
    }
  }
  denaturationFactor = Math.max(0, Math.min(1, denaturationFactor));
  const denaturationDegreePct = (1 - denaturationFactor) * 100;

  // Combined thermal modulation f(T): peaks at T_opt (1.0) and decays exponentially upon denaturation
  const thermalFactor =
    tempC <= tOptC
      ? arrheniusFactor
      : Math.min(1.0, arrheniusFactor * denaturationFactor);

  // Bell-shaped pH curve f(pH)
  const phFactor = Math.exp(-Math.pow((ph - phOpt) / phSigma, 2));

  const saturationFraction = S / (km + S);
  const effectiveVmax = vMax * thermalFactor * phFactor;
  const reactionVelocityV = effectiveVmax * saturationFraction;

  const safeEffVmax = Math.max(1e-6, effectiveVmax);
  const lineweaverSlope = km / safeEffVmax;
  const lineweaverIntercept = 1 / safeEffVmax;

  return {
    reactionVelocityV: Number(reactionVelocityV.toFixed(4)),
    effectiveVmax: Number(effectiveVmax.toFixed(4)),
    saturationFraction: Number(saturationFraction.toFixed(4)),
    arrheniusFactor: Number(arrheniusFactor.toFixed(4)),
    denaturationFactor: Number(denaturationFactor.toFixed(4)),
    denaturationDegreePct: Number(denaturationDegreePct.toFixed(2)),
    thermalFactor: Number(thermalFactor.toFixed(4)),
    phFactor: Number(phFactor.toFixed(4)),
    lineweaverSlope: Number(lineweaverSlope.toFixed(5)),
    lineweaverIntercept: Number(lineweaverIntercept.toFixed(5)),
  };
}

/**
 * 2. Dinamika Populasi Ekosistem Lotka-Volterra:
 * dx/dt = alpha * x - beta * x * y
 * dy/dt = delta * x * y - gamma * y
 */
export function calculateLotkaVolterraMetrics(params: LotkaVolterraParams): LotkaVolterraMetrics {
  const x = Math.max(0, params.preyPopulationX);
  const y = Math.max(0, params.predatorPopulationY);
  const alpha = Math.max(0.001, params.preyGrowthRateAlpha);
  const beta = Math.max(0.0001, params.predationRateBeta);
  const delta = Math.max(0.0001, params.predatorReproductionDelta);
  const gamma = Math.max(0.001, params.predatorMortalityGamma);

  const dPreyDt = alpha * x - beta * x * y;
  const dPredatorDt = delta * x * y - gamma * y;

  const equilibriumPreyX = gamma / delta;
  const equilibriumPredatorY = alpha / beta;

  const preyNetGrowthRatePct = (alpha - beta * y) * 100;
  const predatorNetGrowthRatePct = (delta * x - gamma) * 100;

  const safeX = Math.max(1e-4, x);
  const safeY = Math.max(1e-4, y);
  const phaseInvariantH =
    delta * safeX - gamma * Math.log(safeX) + beta * safeY - alpha * Math.log(safeY);

  const oscillationPeriodApprox = (2 * Math.PI) / Math.sqrt(alpha * gamma);

  return {
    dPreyDt: Number(dPreyDt.toFixed(4)),
    dPredatorDt: Number(dPredatorDt.toFixed(4)),
    equilibriumPreyX: Number(equilibriumPreyX.toFixed(2)),
    equilibriumPredatorY: Number(equilibriumPredatorY.toFixed(2)),
    preyNetGrowthRatePct: Number(preyNetGrowthRatePct.toFixed(2)),
    predatorNetGrowthRatePct: Number(predatorNetGrowthRatePct.toFixed(2)),
    phaseInvariantH: Number(phaseInvariantH.toFixed(4)),
    oscillationPeriodApprox: Number(oscillationPeriodApprox.toFixed(3)),
  };
}

/**
 * 3. Osmosis & Tekanan Turgor Sel (Van 't Hoff):
 * Pi = i * M * R * T
 * Computes transmembrane water flux dV/dt and cell volume / turgor state across
 * hypotonic (turgid/lysis), isotonic, and hypertonic (plasmolysis) regimes.
 */
export function calculateCellOsmosisTonicity(params: CellOsmosisParams): CellOsmosisMetrics {
  const R_ATM = 0.082057366; // L·atm/(mol·K)
  const ATM_TO_MPA = 0.101325;

  const tempK = Math.max(250, params.temperatureC + 273.15);
  const iInt = Math.max(1.0, params.vantHoffFactorInt ?? 1.0);
  const iExt = Math.max(1.0, params.vantHoffFactorExt ?? 1.0);
  const mInt0 = Math.max(0.001, params.intracellularMolarityM);
  const mExt = Math.max(0, params.extracellularMolarityM);

  const v0 = Math.max(10, params.initialCellVolumeUm3 ?? 1000);
  const vCurrent = Math.max(0.25 * v0, params.currentCellVolumeUm3 ?? v0);
  const lp = Math.max(0.001, params.membranePermeabilityLp ?? 0.18);
  const area = Math.max(10, params.cellSurfaceAreaUm2 ?? 484);
  const hasWall = params.hasCellWall ?? true;
  const wallModulus = hasWall ? Math.max(0.5, params.cellWallElasticModulusAtm ?? 12.0) : 1.5;

  // Intracellular solute conservation scales M_int with V_0 / V
  const mIntEffective = mInt0 * (v0 / vCurrent);

  const osmoticPressureIntAtm = iInt * mIntEffective * R_ATM * tempK;
  const osmoticPressureExtAtm = iExt * mExt * R_ATM * tempK;

  const osmoticPressureIntMpa = osmoticPressureIntAtm * ATM_TO_MPA;
  const osmoticPressureExtMpa = osmoticPressureExtAtm * ATM_TO_MPA;

  // Elastic turgor pressure develops when cell swells above isotonic reference volume V_0
  const volumetricStrain = (vCurrent - v0) / v0;
  const turgorPressureAtm = volumetricStrain > 0 ? wallModulus * volumetricStrain : 0;

  // Net driving water potential difference across semipermeable membrane
  const netWaterPotentialAtm = osmoticPressureIntAtm - osmoticPressureExtAtm - turgorPressureAtm;
  const netWaterFluxUm3PerSec = lp * area * netWaterPotentialAtm;

  // Analytical steady-state equilibrium volume ratio (where Pi_int(V_eq) - Pi_ext = P_turgor(V_eq))
  const piInt0 = iInt * mInt0 * R_ATM * tempK;
  const deltaPi0 = piInt0 - osmoticPressureExtAtm;
  let equilibriumRatio = 1.0;
  if (Math.abs(deltaPi0) <= 0.08) {
    equilibriumRatio = 1.0;
  } else if (deltaPi0 > 0) {
    // Swelling in hypotonic medium balanced by turgor/membrane tension
    equilibriumRatio = 1.0 + deltaPi0 / (wallModulus + piInt0);
  } else {
    // Shrinking in hypertonic medium (Boyle-Van 't Hoff relation bounded by non-osmotic volume fraction 0.45)
    equilibriumRatio = Math.max(0.45, piInt0 / Math.max(0.1, osmoticPressureExtAtm));
  }

  const volumeChangePct = ((vCurrent - v0) / v0) * 100;
  const equilibriumVolumeRatioPct = equilibriumRatio * 100;

  const isPlasmolyzed = osmoticPressureExtAtm > piInt0 + 0.15 || vCurrent < 0.92 * v0;
  const isLysed = !hasWall && (equilibriumRatio >= 1.45 || vCurrent >= 1.45 * v0);

  let tonicityState: CellOsmosisMetrics['tonicityState'] = 'Isotonik (Setimbang)';
  if (Math.abs(piInt0 - osmoticPressureExtAtm) <= 0.15) {
    tonicityState = 'Isotonik (Setimbang)';
  } else if (osmoticPressureExtAtm < piInt0 - 0.15) {
    tonicityState = isLysed ? 'Hipotonik (Lisis)' : 'Hipotonik (Turgid)';
  } else {
    tonicityState = 'Hipertonik (Plasmolisis)';
  }

  return {
    osmoticPressureIntAtm: Number(osmoticPressureIntAtm.toFixed(4)),
    osmoticPressureExtAtm: Number(osmoticPressureExtAtm.toFixed(4)),
    osmoticPressureIntMpa: Number(osmoticPressureIntMpa.toFixed(4)),
    osmoticPressureExtMpa: Number(osmoticPressureExtMpa.toFixed(4)),
    turgorPressureAtm: Number(turgorPressureAtm.toFixed(4)),
    netWaterPotentialAtm: Number(netWaterPotentialAtm.toFixed(4)),
    netWaterFluxUm3PerSec: Number(netWaterFluxUm3PerSec.toFixed(3)),
    equilibriumVolumeRatioPct: Number(equilibriumVolumeRatioPct.toFixed(2)),
    volumeChangePct: Number(volumeChangePct.toFixed(2)),
    tonicityState,
    isPlasmolyzed,
    isLysed,
  };
}

export function calculateBiologyMetrics(params: BiologyParams): BiologyMetrics {
  const enzymeKinetics = calculateEnzymeKinetics({
    substrateConcMm: params.substrateConcMm ?? 10,
    vMaxBase: params.vMaxBase ?? 120,
    kmConstantMm: params.kmConstantMm ?? 4.5,
    temperatureC: params.temperatureC ?? 37,
    optimalTempC: params.optimalTempC ?? 37,
    denaturationThresholdC: params.denaturationThresholdC ?? 45,
    solutionPh: params.solutionPh ?? 7.0,
    optimalPh: params.optimalPh ?? 7.0,
  });

  const predatorPrey = calculateLotkaVolterraMetrics({
    preyPopulationX: params.preyPopulationX ?? 40,
    predatorPopulationY: params.predatorPopulationY ?? 9,
    preyGrowthRateAlpha: params.preyGrowthRateAlpha ?? 1.1,
    predationRateBeta: params.predationRateBeta ?? 0.04,
    predatorReproductionDelta: params.predatorReproductionDelta ?? 0.01,
    predatorMortalityGamma: params.predatorMortalityGamma ?? 0.4,
  });

  const cellOsmosis = calculateCellOsmosisTonicity({
    intracellularMolarityM: params.intracellularMolarityM ?? 0.28,
    extracellularMolarityM: params.extracellularMolarityM ?? 0.30,
    vantHoffFactorInt: params.vantHoffFactorInt ?? 1.0,
    vantHoffFactorExt: params.vantHoffFactorExt ?? 1.0,
    temperatureC: params.temperatureC ?? 25,
    initialCellVolumeUm3: params.initialCellVolumeUm3 ?? 1000,
    currentCellVolumeUm3: params.currentCellVolumeUm3 ?? 1000,
    hasCellWall: params.hasCellWall ?? true,
  });

  return {
    enzymeKinetics,
    predatorPrey,
    cellOsmosis,
  };
}

export function calculateLinearRegression(
  points: { x: number; y: number }[]
): LinearRegressionResult {
  if (points.length === 0) {
    return {
      slopeM: 0,
      interceptC: 0,
      rSquared: 0,
      equationString: 'y = 0.00x + 0.00',
      meanX: 0,
      meanY: 0,
      stdDevY: 0,
      predictedPoints: [],
    };
  }

  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  if (n === 1) {
    return {
      slopeM: 0,
      interceptC: Number(meanY.toFixed(3)),
      rSquared: 1,
      equationString: `y = ${meanY.toFixed(2)}`,
      meanX: Number(meanX.toFixed(3)),
      meanY: Number(meanY.toFixed(3)),
      stdDevY: 0,
      predictedPoints: [{ x: points[0].x, yPred: points[0].y }],
    };
  }

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;

  for (const pt of points) {
    const dx = pt.x - meanX;
    const dy = pt.y - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slopeM = ssXX > 1e-9 ? ssXY / ssXX : 0;
  const interceptC = meanY - slopeM * meanX;
  const rSquared =
    ssXX > 1e-9 && ssYY > 1e-9
      ? Math.max(0, Math.min(1, (ssXY * ssXY) / (ssXX * ssYY)))
      : 1;
  const stdDevY = Math.sqrt(ssYY / n);

  const sign = interceptC >= 0 ? '+' : '-';
  const equationString = `y = ${slopeM.toFixed(3)}x ${sign} ${Math.abs(
    interceptC
  ).toFixed(3)}`;

  const sortedByX = [...points].sort((a, b) => a.x - b.x);
  const predictedPoints = sortedByX.map((p) => ({
    x: p.x,
    yPred: Number((slopeM * p.x + interceptC).toFixed(3)),
  }));

  return {
    slopeM: Number(slopeM.toFixed(4)),
    interceptC: Number(interceptC.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
    equationString,
    meanX: Number(meanX.toFixed(3)),
    meanY: Number(meanY.toFixed(3)),
    stdDevY: Number(stdDevY.toFixed(3)),
    predictedPoints,
  };
}

export type CurveModelType = 'linear' | 'quadratic' | 'exponential';

export interface CurveFitResult {
  modelType: CurveModelType;
  modelLabel: string;
  equationString: string;
  rSquared: number;
  slopeM: number;
  interceptC: number;
  quadA?: number;
  quadB?: number;
  quadC?: number;
  expA?: number;
  expB?: number;
  meanX: number;
  meanY: number;
  stdDevY: number;
  predictedPoints: { x: number; yPred: number }[];
  evaluateAt: (x: number) => number;
}

export function calculateCurveFitting(
  points: { x: number; y: number }[],
  modelType: CurveModelType = 'linear'
): CurveFitResult {
  const lin = calculateLinearRegression(points);
  if (points.length < 3 || modelType === 'linear') {
    return {
      modelType: 'linear',
      modelLabel: 'Regresi Linier (OLS)',
      equationString: lin.equationString,
      rSquared: lin.rSquared,
      slopeM: lin.slopeM,
      interceptC: lin.interceptC,
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints: lin.predictedPoints,
      evaluateAt: (x: number) => lin.slopeM * x + lin.interceptC,
    };
  }

  const n = points.length;
  const meanY = lin.meanY;
  const ssTot = points.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0);

  if (modelType === 'exponential') {
    // Fit y = A * exp(B * x) via ln(|y|) = ln(A) + B*x for positive y; fallback to shifted positive if needed
    const minY = Math.min(...points.map((p) => p.y));
    const shift = minY <= 0.01 ? Math.abs(minY) + 1.0 : 0;
    const logPoints = points.map((p) => ({
      x: p.x,
      y: Math.log(Math.max(1e-4, p.y + shift)),
    }));
    const logFit = calculateLinearRegression(logPoints);
    const expB = logFit.slopeM;
    const expA = Math.exp(logFit.interceptC);
    const evaluateAt = (x: number) => expA * Math.exp(expB * x) - shift;

    const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - evaluateAt(p.x), 2), 0);
    const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
    const sortedByX = [...points].sort((a, b) => a.x - b.x);
    const predictedPoints = sortedByX.map((p) => ({
      x: p.x,
      yPred: Number(evaluateAt(p.x).toFixed(3)),
    }));
    const shiftStr = shift > 0 ? ` - ${shift.toFixed(2)}` : '';
    return {
      modelType: 'exponential',
      modelLabel: 'Model Eksponensial',
      equationString: `y = ${expA.toFixed(3)}·e^(${expB.toFixed(3)}x)${shiftStr}`,
      rSquared: Number(rSquared.toFixed(4)),
      slopeM: Number(expB.toFixed(4)),
      interceptC: Number((expA - shift).toFixed(4)),
      expA: Number(expA.toFixed(4)),
      expB: Number(expB.toFixed(4)),
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints,
      evaluateAt,
    };
  }

  // Quadratic polynomial fit: y = a*x^2 + b*x + c using normal equations (3x3 Cramer/Gaussian)
  let s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0,
    sy = 0,
    sxy = 0,
    sx2y = 0;
  for (const p of points) {
    const x = p.x;
    const x2 = x * x;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    sy += p.y;
    sxy += x * p.y;
    sx2y += x2 * p.y;
  }

  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const A = [
    [s4, s3, s2],
    [s3, s2, s1],
    [s2, s1, n],
  ];
  const D = det3(A);
  if (Math.abs(D) < 1e-9) {
    return {
      modelType: 'quadratic',
      modelLabel: 'Polinomial Kuadratik (Orde-2)',
      equationString: lin.equationString,
      rSquared: lin.rSquared,
      slopeM: lin.slopeM,
      interceptC: lin.interceptC,
      quadA: 0,
      quadB: lin.slopeM,
      quadC: lin.interceptC,
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints: lin.predictedPoints,
      evaluateAt: (x: number) => lin.slopeM * x + lin.interceptC,
    };
  }

  const quadA =
    det3([
      [sx2y, s3, s2],
      [sxy, s2, s1],
      [sy, s1, n],
    ]) / D;
  const quadB =
    det3([
      [s4, sx2y, s2],
      [s3, sxy, s1],
      [s2, sy, n],
    ]) / D;
  const quadC =
    det3([
      [s4, s3, sx2y],
      [s3, s2, sxy],
      [s2, s1, sy],
    ]) / D;

  const evaluateAt = (x: number) => quadA * x * x + quadB * x + quadC;
  const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - evaluateAt(p.x), 2), 0);
  const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;

  const sortedByX = [...points].sort((a, b) => a.x - b.x);
  const predictedPoints = sortedByX.map((p) => ({
    x: p.x,
    yPred: Number(evaluateAt(p.x).toFixed(3)),
  }));

  const bSign = quadB >= 0 ? '+' : '-';
  const cSign = quadC >= 0 ? '+' : '-';
  const equationString = `y = ${quadA.toFixed(3)}x² ${bSign} ${Math.abs(quadB).toFixed(3)}x ${cSign} ${Math.abs(quadC).toFixed(3)}`;

  return {
    modelType: 'quadratic',
    modelLabel: 'Polinomial Kuadratik (Orde-2)',
    equationString,
    rSquared: Number(rSquared.toFixed(4)),
    slopeM: Number(quadB.toFixed(4)),
    interceptC: Number(quadC.toFixed(4)),
    quadA: Number(quadA.toFixed(4)),
    quadB: Number(quadB.toFixed(4)),
    quadC: Number(quadC.toFixed(4)),
    meanX: lin.meanX,
    meanY: lin.meanY,
    stdDevY: lin.stdDevY,
    predictedPoints,
    evaluateAt,
  };
}

export interface OutlierPointInfo {
  index: number;
  id?: string;
  label?: string;
  x: number;
  y: number;
  yPred: number;
  residual: number;
  zScore: number;
  isOutlier: boolean;
}

export interface OutlierDetectionResult {
  pointsWithResiduals: OutlierPointInfo[];
  outliers: OutlierPointInfo[];
  rSquaredRaw: number;
  rSquaredClean: number;
  rmseResiduals: number;
}

export function detectRegressionOutliers(
  points: { x: number; y: number; id?: string; label?: string }[]
): OutlierDetectionResult {
  const rawFit = calculateLinearRegression(points);
  if (points.length < 3) {
    return {
      pointsWithResiduals: points.map((p, idx) => ({
        index: idx,
        id: p.id,
        label: p.label,
        x: p.x,
        y: p.y,
        yPred: p.y,
        residual: 0,
        zScore: 0,
        isOutlier: false,
      })),
      outliers: [],
      rSquaredRaw: rawFit.rSquared,
      rSquaredClean: rawFit.rSquared,
      rmseResiduals: 0,
    };
  }

  // Compute leave-one-out predicted value so a single extreme point cannot mask itself
  const rawResiduals = points.map((p, idx) => {
    const others = points.filter((_, j) => j !== idx);
    const looFit = calculateLinearRegression(others);
    const yPredLoo = looFit.slopeM * p.x + looFit.interceptC;
    const residual = p.y - yPredLoo;
    return {
      index: idx,
      id: p.id,
      label: p.label,
      x: p.x,
      y: p.y,
      yPred: Number((rawFit.slopeM * p.x + rawFit.interceptC).toFixed(3)),
      residual: Number(residual.toFixed(3)),
      absLooResidual: Math.abs(residual),
    };
  });

  const sortedAbs = [...rawResiduals].map((r) => r.absLooResidual).sort((a, b) => a - b);
  const medianAbs = sortedAbs[Math.floor(sortedAbs.length / 2)] || 0.05;
  const scaleSigma = Math.max(0.15, medianAbs * 1.4826);

  const pointsWithResiduals: OutlierPointInfo[] = rawResiduals.map((r) => {
    const zScore = Number((r.absLooResidual / scaleSigma).toFixed(2));
    const isOutlier = zScore >= 2.2 && r.absLooResidual >= 0.45;
    return {
      index: r.index,
      id: r.id,
      label: r.label,
      x: r.x,
      y: r.y,
      yPred: r.yPred,
      residual: r.residual,
      zScore,
      isOutlier,
    };
  });

  const outliers = pointsWithResiduals.filter((p) => p.isOutlier);
  const cleanPoints = pointsWithResiduals
    .filter((p) => !p.isOutlier)
    .map((p) => ({ x: p.x, y: p.y }));
  const cleanFit =
    cleanPoints.length >= 2 ? calculateLinearRegression(cleanPoints) : rawFit;
  const rmseResiduals = Math.sqrt(
    pointsWithResiduals.reduce((acc, p) => acc + p.residual * p.residual, 0) /
      pointsWithResiduals.length
  );

  return {
    pointsWithResiduals,
    outliers,
    rSquaredRaw: rawFit.rSquared,
    rSquaredClean: cleanFit.rSquared,
    rmseResiduals: Number(rmseResiduals.toFixed(3)),
  };
}

export type WorksheetDiagnosticStatus =
  | 'exact'
  | 'close-rounding'
  | 'sign-error'
  | 'unit-conversion-error'
  | 'conceptual-error'
  | 'unanswered';

export interface WorksheetQuestionGradeDetail {
  isCorrect: boolean;
  expected: number;
  explanation: string;
  userNumericValue?: number;
  errorPct?: number;
  diagnosticStatus: WorksheetDiagnosticStatus;
  diagnosticBadge: string;
  diagnosticFeedback: string;
}

export function gradeWorksheetAnswers(
  userAnswers: Record<string, number | string>
): {
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  results: Record<string, WorksheetQuestionGradeDetail>;
} {
  let correctCount = 0;
  const results: Record<string, WorksheetQuestionGradeDetail> = {};

  for (const q of WORKSHEET_QUESTIONS) {
    const raw = userAnswers[q.id];
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));

    if (Number.isNaN(parsed)) {
      results[q.id] = {
        isCorrect: false,
        expected: q.correctValue,
        explanation: q.explanation,
        diagnosticStatus: 'unanswered',
        diagnosticBadge: 'Belum Diisi',
        diagnosticFeedback:
          'Masukkan hasil perhitungan numerik Anda terlebih dahulu untuk mendapatkan analisis diagnostik.',
      };
      continue;
    }

    const absDiff = Math.abs(parsed - q.correctValue);
    const errorPct =
      Math.abs(q.correctValue) > 1e-6
        ? Number(((absDiff / Math.abs(q.correctValue)) * 100).toFixed(2))
        : Number((absDiff * 100).toFixed(2));
    const isCorrect = absDiff <= q.tolerance;

    let diagnosticStatus: WorksheetDiagnosticStatus = 'conceptual-error';
    let diagnosticBadge = 'Periksa Konsep & Rumus';
    let diagnosticFeedback =
      'Periksa kembali substitusi variabel ke dalam persamaan dasar serta urutan operasi aljabarnya.';

    if (isCorrect) {
      correctCount += 1;
      if (absDiff <= q.tolerance * 0.25) {
        diagnosticStatus = 'exact';
        diagnosticBadge = 'Presisi Eksak';
        diagnosticFeedback =
          'Sangat presisi! Nilai perhitungan Anda tepat berada pada pusat acuan teoretis.';
      } else {
        diagnosticStatus = 'close-rounding';
        diagnosticBadge = 'Tepat (Toleransi Pembulatan)';
        diagnosticFeedback = `Benar (selisih pembulatan kecil ${errorPct}% masih dalam batas toleransi ±${q.tolerance} ${q.unit}).`;
      }
    } else if (
      Math.abs(parsed + q.correctValue) <= Math.max(q.tolerance * 2, 1.5) &&
      Math.abs(q.correctValue) > 0.1
    ) {
      diagnosticStatus = 'sign-error';
      diagnosticBadge = 'Kekeliruan Tanda (+/-)';
      diagnosticFeedback = `Nilai besaran Anda (${parsed} ${q.unit}) sudah tepat secara magnitudo, tetapi tandanya terbalik dari ${q.correctValue} ${q.unit}. Perhatikan konvensi tanda eksotermik/endotermik atau arah vektor.`;
    } else if (
      Math.abs(parsed / q.correctValue - 1000) < 50 ||
      Math.abs(q.correctValue / (parsed || 1e-9) - 1000) < 50 ||
      Math.abs(parsed / q.correctValue - 100) < 5 ||
      Math.abs(q.correctValue / (parsed || 1e-9) - 100) < 5
    ) {
      diagnosticStatus = 'unit-conversion-error';
      diagnosticBadge = 'Kekeliruan Konversi Satuan';
      diagnosticFeedback = `Terdeteksi faktor skala sekitar 100× atau 1000× terhadap nilai acuan (${q.correctValue} ${q.unit}). Pastikan konversi satuan (misal J ke kJ, mL ke L, atau cm ke m) sudah seragam.`;
    } else if (absDiff <= q.tolerance * 2.5) {
      diagnosticStatus = 'close-rounding';
      diagnosticBadge = 'Hampir Tepat (Galat Pembulatan)';
      diagnosticFeedback = `Jawaban Anda (${parsed} ${q.unit}) mendekati nilai acuan (${q.correctValue} ${q.unit}, galat ${errorPct}%). Hindari pembulatan terlalu dini pada langkah antara.`;
    } else {
      // Specific per-question hints
      if (q.id === 'q1-newton') {
        diagnosticFeedback = `Ingat untuk mengurangkan komponen berat sejajar bidang miring (m·g·sin 30° = 19.62 N) dan gaya gesek kinetis (f_k = 6.79 N) dari gaya dorong F = 40 N sebelum dibagi massa m = 4 kg.`;
      } else if (q.id === 'q2-projectile') {
        diagnosticFeedback = `Gunakan v₀² = 20² = 400 m²/s² dan sin(2 × 45°) = sin(90°) = 1, lalu bagi dengan gravitasi g = 9.81 m/s².`;
      } else if (q.id === 'q3-gibbs') {
        diagnosticFeedback = `Konversikan ΔS = 160 J/(mol·K) menjadi 0.160 kJ/(mol·K) terlebih dahulu sebelum dikalikan T = 300 K pada rumus ΔG = ΔH - T·ΔS.`;
      } else if (q.id === 'q4-titration') {
        diagnosticFeedback = `Gunakan syarat titik ekuivalen monoprotik: M_asam × V_asam = M_basa × V_basa → 0.20 × 25 = 0.25 × V_basa.`;
      } else if (q.id === 'q5-kepler') {
        diagnosticFeedback = `Hitung a³ = 4.0³ = 64 terlebih dahulu, lalu tarik akar kuadratnya: T = √64 = 8.0 tahun Bumi.`;
      }
    }

    results[q.id] = {
      isCorrect,
      expected: q.correctValue,
      explanation: q.explanation,
      userNumericValue: parsed,
      errorPct,
      diagnosticStatus,
      diagnosticBadge,
      diagnosticFeedback,
    };
  }

  const totalScore = Math.round(
    (correctCount / WORKSHEET_QUESTIONS.length) * 100
  );
  return {
    totalScore,
    correctCount,
    totalQuestions: WORKSHEET_QUESTIONS.length,
    results,
  };
}

export function calculateStudentRubric(
  student: {
    id: string;
    name: string;
    groupId: string;
    trialsRecorded: number;
    tasksCompleted: number;
    totalTasks: number;
    completionPct: number;
    quizScore?: number;
  },
  rSquaredQuality = 0.96
): RubricScoreBreakdown {
  const experimentScore = Math.min(100, Math.round(40 + student.trialsRecorded * 15));
  const regressionAnalysisScore = Math.min(
    100,
    Math.round(rSquaredQuality * 85 + (student.trialsRecorded >= 2 ? 15 : 5))
  );
  const collaborationScore =
    student.totalTasks > 0
      ? Math.min(100, Math.round((student.tasksCompleted / student.totalTasks) * 100))
      : 75;
  const worksheetQuizScore =
    student.quizScore !== undefined
      ? student.quizScore
      : Math.min(100, Math.round(student.completionPct * 0.9));

  const finalTotalScore = Math.round(
    experimentScore * 0.25 +
      regressionAnalysisScore * 0.25 +
      collaborationScore * 0.25 +
      worksheetQuizScore * 0.25
  );

  const letterGrade: 'A' | 'B' | 'C' | 'D' =
    finalTotalScore >= 85
      ? 'A'
      : finalTotalScore >= 72
      ? 'B'
      : finalTotalScore >= 60
      ? 'C'
      : 'D';

  const predicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan' =
    letterGrade === 'A'
      ? 'Sangat Baik'
      : letterGrade === 'B'
      ? 'Baik'
      : letterGrade === 'C'
      ? 'Cukup'
      : 'Perlu Bimbingan';

  return {
    studentId: student.id,
    studentName: student.name,
    groupId: student.groupId,
    experimentScore,
    regressionAnalysisScore,
    collaborationScore,
    worksheetQuizScore,
    finalTotalScore,
    letterGrade,
    predicate,
  };
}

export function exportRubricGradesToCSV(rubrics: RubricScoreBreakdown[]): string {
  const headers = [
    'ID Siswa',
    'Nama Siswa',
    'Kelompok Praktikum',
    'Skor Eksperimen (25%)',
    'Skor Analisis Regresi (25%)',
    'Skor Kolaborasi Tugas (25%)',
    'Skor Kuis & LKS (25%)',
    'Nilai Akhir (0-100)',
    'Grade Huruf',
    'Predikat Evaluasi',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = rubrics.map((r) =>
    [
      r.studentId,
      r.studentName,
      r.groupId,
      r.experimentScore,
      r.regressionAnalysisScore,
      r.collaborationScore,
      r.worksheetQuizScore,
      r.finalTotalScore,
      r.letterGrade,
      r.predicate,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function generateAutomaticFeedback(
  domain: ScienceDomain,
  physicsParams?: PhysicsParams,
  chemistryParams?: ChemistryParams,
  astronomyParams?: AstronomyParams
): LabNotification {
  const now = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (domain === 'Astronomi' && astronomyParams) {
    const a = calculateAstronomyMetrics(astronomyParams);

    if (astronomyParams.mode === 'milkyway-galaxy') {
      return {
        id,
        timestamp: now,
        severity: a.velocityAnomalyKms > 45 ? 'elevated' : 'nominal',
        domain: 'Astronomi',
        title: `Kurva Rotasi Galaksi Bima Sakti (R = ${astronomyParams.galactocentricRadiusKpc} kpc)`,
        message: `Kecepatan rotasi observasi v_obs = ${a.observedDarkMatterVelocityKms} km/s (Keplerian tanpa Materi Gelap = ${a.keplerianVelocityKms} km/s). Periode galaktik = ${a.galacticOrbitalPeriodMyr} juta tahun.`,
        formulaHint: 'v(R) = √(G · M(<R) / R)',
      };
    }

    if (astronomyParams.mode === 'stellar-exoplanet') {
      return {
        id,
        timestamp: now,
        severity: a.isInHabitableZone ? 'nominal' : 'elevated',
        domain: 'Astronomi',
        title: `Bintang Kelas Spektral ${a.spectralClass} & Transit Eksoplanet`,
        message: `Luminositas bintang L = ${a.stellarLuminositySolar} L☉. Kedalaman transit ΔF/F = ${a.transitDepthPct}% (${a.transitDepthPpm} ppm). Status orbit: ${
          a.isInHabitableZone ? 'Di Dalam Zona Laik Huni' : 'Di Luar Zona Laik Huni'
        }.`,
        formulaHint: 'L/L☉ = (R/R☉)²(T/T☉)⁴  |  ΔF/F = (Rp/R*)²',
      };
    }

    return {
      id,
      timestamp: now,
      severity: 'nominal',
      domain: 'Astronomi',
      title: `Hukum Orbit Kepler (T = ${a.orbitalPeriodYears} Tahun Bumi)`,
      message: `Pada a = ${astronomyParams.customSemiMajorAxisAu} AU dan e = ${astronomyParams.customEccentricity}, kecepatan perihelion v_p = ${a.perihelionVelocityKms} km/s dan aphelion v_a = ${a.aphelionVelocityKms} km/s.`,
      formulaHint: 'T² / a³ = 1 / M_*  |  dA/dt = konstan',
    };
  }

  if (domain === 'Fisika' && physicsParams) {
    const m = calculatePhysicsMetrics(physicsParams);

    if (physicsParams.mode === 'collision-momentum') {
      return {
        id,
        timestamp: now,
        severity: m.energyLossPct > 50 ? 'elevated' : 'nominal',
        domain: 'Fisika',
        title: `Hukum Kekekalan Momentum (p = ${m.initialTotalMomentum} kg·m/s)`,
        message: `Pasca tumbukan (e = ${physicsParams.restitutionCoeff}): v₁' = ${m.v1Final} m/s, v₂' = ${m.v2Final} m/s. Disipasi energi kinetik sebesar ${m.energyLossPct}%.`,
        formulaHint: "m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'",
      };
    }

    if (physicsParams.mode === 'spring-hooke') {
      return {
        id,
        timestamp: now,
        severity: 'nominal',
        domain: 'Fisika',
        title: `Osilasi Harmonik Hukum Hooke (T = ${m.oscillationPeriod} s)`,
        message: `Gaya pemulih pegas Fp = ${m.springRestoringForce} N dengan energi potensial elastis Ep = ${m.springPotentialEnergy} J pada k = ${physicsParams.springConstantK} N/m.`,
        formulaHint: 'F = -k·x  |  T = 2π√(m/k)',
      };
    }

    if (physicsParams.mode === 'projectile-gravity') {
      if (physicsParams.launchAngle >= 43 && physicsParams.launchAngle <= 47) {
        return {
          id,
          timestamp: now,
          severity: 'nominal',
          domain: 'Fisika',
          title: 'Sudut Elevasi Optimal Tercapai (≈45°)',
          message: `Jarak jangkauan horizontal maksimum R = ${m.projectileRange} m dicapai pada g = ${physicsParams.gravity} m/s² dengan tinggi puncak ${m.maxProjectileHeight} m.`,
          formulaHint: 'R = (v₀² · sin(2θ)) / g',
        };
      }
      return {
        id,
        timestamp: now,
        severity: 'nominal',
        domain: 'Fisika',
        title: 'Lintasan Parabolik & Gravitasi Terhitung',
        message: `Waktu tempuh t = ${m.timeOfFlight} s, tinggi maksimum H = ${m.maxProjectileHeight} m, dan gaya gravitasi antar-massa Fg = ${m.universalGravityForce} µN.`,
        formulaHint: 'y(t) = y₀ + v₀y·t - ½g·t²',
      };
    }

    if (!m.isMoving) {
      return {
        id,
        timestamp: now,
        severity: 'elevated',
        domain: 'Fisika',
        title: 'Hukum I Newton — Kesetimbangan Statis (ΣF = 0 N)',
        message: `Gaya penggerak belum melampaui batas gesek statis maksimum (fs,maks = ${m.maxStaticFriction} N). Tambahkan gaya dorong F atau perkecil koefisien gesek μs agar benda bergerak.`,
        formulaHint: 'ΣF = 0 ⇔ |F - m·g·sin(θ)| ≤ μs·N',
      };
    }

    return {
      id,
      timestamp: now,
      severity: Math.abs(m.acceleration) > 12 ? 'critical' : 'nominal',
      domain: 'Fisika',
      title: 'Hukum II Newton — Gerak Lurus Berubah Beraturan',
      message: `Benda bergerak dengan percepatan konstan a = ${m.acceleration} m/s² (ΣF = ${m.netForce} N, gaya gesek kinetis fk = ${Math.abs(m.frictionForce)} N).`,
      formulaHint: 'ΣF = F - m·g·sin(θ) - fk = m·a',
    };
  }

  if (domain === 'Kimia' && chemistryParams) {
    const c = calculateChemistryMetrics(chemistryParams);

    if (chemistryParams.mode === 'acid-base-titration') {
      return {
        id,
        timestamp: now,
        severity:
          c.titrationRegion === 'Titik Ekuivalen' ? 'nominal' : 'elevated',
        domain: 'Kimia',
        title: `Titrasi Asam-Basa: ${c.titrationRegion} (pH = ${c.currentPh})`,
        message: `Volume titran NaOH = ${chemistryParams.titrantAddedMl} mL (Titik ekuivalen teoretis = ${c.equivalenceVolumeMl} mL). Warna indikator: ${c.indicatorColorName}.`,
        formulaHint: 'M_a · V_a = M_b · V_b',
      };
    }

    if (chemistryParams.mode === 'electrochemistry-cell') {
      return {
        id,
        timestamp: now,
        severity: c.nernstCellPotentialE > 0 ? 'nominal' : 'critical',
        domain: 'Kimia',
        title: `Potensial Sel Galvani Nernst (E_sel = +${c.nernstCellPotentialE} V)`,
        message: `Reaksi redoks spontan menghasilkan ΔG = ${c.electroFreeEnergyDeltaG} kJ/mol dengan kuosien reaksi Q = ${c.reactionQuotientQ}.`,
        formulaHint: 'E_sel = E°_sel - (RT / nF) · ln(Q)',
      };
    }

    if (c.finalTempC > 95) {
      return {
        id,
        timestamp: now,
        severity: 'critical',
        domain: 'Kimia',
        title: 'Peringatan Termal Kalorimeter (T > 95°C)',
        message: `Pelepasan kalor eksotermik menaikkan suhu larutan hingga ${c.finalTempC}°C (ΔT = +${c.deltaTempC}°C). Kurangi konsentrasi reaktan atau tingkatkan volume pelarut.`,
        formulaHint: 'q = m·c·ΔT = -n·ΔH',
      };
    }
    if (!c.isSpontaneous) {
      return {
        id,
        timestamp: now,
        severity: 'elevated',
        domain: 'Kimia',
        title: 'Reaksi Non-Spontan pada Suhu Saat Ini (ΔG > 0)',
        message: `Energi bebas Gibbs ΔG = +${c.deltaG} kJ/mol. Untuk reaksi endotermik dengan ΔS > 0, naikkan suhu T agar suku T·ΔS melampaui ΔH.`,
        formulaHint: 'ΔG = ΔH - T·ΔS',
      };
    }
    return {
      id,
      timestamp: now,
      severity: 'nominal',
      domain: 'Kimia',
      title: `Reaksi ${c.thermalClassification} Spontan (ΔG = ${c.deltaG} kJ/mol)`,
      message: `Perubahan suhu kalorimeter ΔT = ${c.deltaTempC >= 0 ? '+' : ''}${c.deltaTempC}°C menuju ${c.finalTempC}°C. Laju reaksi awal r = ${c.reactionRate} M/s.`,
      formulaHint: 'ΔG = ΔH - T·ΔS < 0',
    };
  }

  return {
    id,
    timestamp: now,
    severity: 'nominal',
    domain: 'Kolaborasi',
    title: 'Sinkronisasi Sesi Laboratorium Aktif',
    message: 'Parameter eksperimen dan catatan kelompok telah diperbarui secara real-time.',
  };
}

export function exportRecordsToCSV(records: ExperimentRecord[]): string {
  const headers = [
    'ID Eksperimen',
    'Waktu',
    'Nama Siswa',
    'Kelompok',
    'Domain Praktikum',
    'Judul Eksperimen',
    'Parameter Input',
    'Hasil Pengukuran Utama',
    'Catatan Analisis',
  ];

  const escapeCsvCell = (value: string | number): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((rec) => {
    const metricsFormatted = Object.entries(rec.keyMetrics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    return [
      rec.id,
      rec.timestamp,
      rec.studentName,
      rec.groupId,
      rec.domain,
      rec.experimentTitle,
      rec.parametersSummary,
      metricsFormatted,
      rec.notes,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export type AcademicLevel = 'smp' | 'sma' | 'mahasiswa';

export type DrLabMuEducationLevel = 'SMP' | 'SMA' | 'Perguruan Tinggi';

export function mapAcademicLevelToTelemetry(
  level: AcademicLevel
): DrLabMuEducationLevel {
  if (level === 'smp') return 'SMP';
  if (level === 'mahasiswa') return 'Perguruan Tinggi';
  return 'SMA';
}

export interface GuidedScenarioPreset {
  id: string;
  domain: ScienceDomain;
  title: string;
  badgeText: string;
  objective: string;
  physicsPatch?: Partial<PhysicsParams>;
  chemistryPatch?: Partial<ChemistryParams>;
  astronomyPatch?: Partial<AstronomyParams>;
}

export const GUIDED_LAB_SCENARIOS: GuidedScenarioPreset[] = [
  {
    id: 'phys-static-threshold',
    domain: 'Fisika',
    title: 'Uji Ambang Gesek Statis',
    badgeText: 'Hukum I Newton · θ = 15°',
    objective:
      'Amati kondisi tepat sebelum benda bergerak ketika gaya dorong F diimbangi oleh gaya berat sejajar bidang dan gesek statis.',
    physicsPatch: {
      mode: 'newton-incline',
      mass: 5.0,
      appliedForce: 18,
      inclineAngle: 15,
      frictionCoeffKinetic: 0.2,
      frictionCoeffStatic: 0.27,
      gravity: 9.81,
      initialVelocity: 0,
    },
  },
  {
    id: 'phys-mars-projectile',
    domain: 'Fisika',
    title: 'Parabola Sudut Optimal di Mars',
    badgeText: 'Kinematika · ∠ = 45°',
    objective:
      'Bandingkan jangkauan horizontal maksimum pada sudut elevasi 45° di medan gravitasi Mars (g = 3.72 m/s²).',
    physicsPatch: {
      mode: 'projectile-gravity',
      mass: 3.0,
      initialVelocity: 24,
      launchAngle: 45,
      initialHeight: 0,
      gravity: 3.72,
    },
  },
  {
    id: 'phys-elastic-collision',
    domain: 'Fisika',
    title: 'Pertukaran Kecepatan Tumbukan Elastis',
    badgeText: 'Momentum · e = 1.00',
    objective:
      'Dua benda bermassa identik (m₁ = m₂ = 4 kg) bertumbukan lenting sempurna dan saling bertukar kecepatan.',
    physicsPatch: {
      mode: 'collision-momentum',
      mass: 4.0,
      collisionMass2: 4.0,
      initialVelocity: 8,
      velocity2Initial: -2,
      restitutionCoeff: 1.0,
    },
  },
  {
    id: 'phys-underdamped-spring',
    domain: 'Fisika',
    title: 'Resonansi Pegas Teredam Ringan',
    badgeText: 'Hukum Hooke · k = 160 N/m',
    objective:
      'Amati pertukaran periodik antara energi potensial elastis dan energi kinetik pada osilator harmonik.',
    physicsPatch: {
      mode: 'spring-hooke',
      mass: 4.0,
      springConstantK: 160,
      springDisplacement: 1.0,
      dampingCoeff: 0.1,
    },
  },
  {
    id: 'chem-exo-catalysed',
    domain: 'Kimia',
    title: 'Efek Katalis pada Energi Aktivasi',
    badgeText: 'Kalorimetri · Katalis Aktif',
    objective:
      'Aktifkan katalis pada netralisasi eksotermik untuk memangkas puncak Ea tanpa mengubah ΔH maupun ΔG.',
    chemistryPatch: {
      mode: 'thermo-calorimetry',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      reactantConcentration: 2.0,
      solutionVolumeMl: 250,
      useCatalyst: true,
    },
  },
  {
    id: 'chem-equivalence-point',
    domain: 'Kimia',
    title: 'Tepat Titik Ekuivalen Titrasi (pH 7.00)',
    badgeText: 'Titrasi · V_NaOH = 20.0 mL',
    objective:
      'Capai kondisi stoikiometri mol H⁺ = mol OH⁻ pada penambahan 20.0 mL NaOH 0.25 M ke 25 mL HCl 0.20 M.',
    chemistryPatch: {
      mode: 'acid-base-titration',
      analyteAcidConc: 0.2,
      analyteVolumeMl: 25,
      titrantBaseConc: 0.25,
      titrantAddedMl: 20.0,
      acidPka: 1.0,
      indicatorType: 'bromtimol-biru',
    },
  },
  {
    id: 'chem-daniell-standard',
    domain: 'Kimia',
    title: 'Potensial Standar Sel Daniell (+1.10 V)',
    badgeText: 'Elektrokimia · Q = 1.00',
    objective:
      'Uji jembatan garam dan aliran elektron dari anoda Zn ke katoda Cu pada konsentrasi standar 1.00 M.',
    chemistryPatch: {
      mode: 'electrochemistry-cell',
      redoxPairId: 'zn-cu-daniell',
      anodeConcM: 1.0,
      cathodeConcM: 1.0,
      initialTempC: 25,
    },
  },
  {
    id: 'astro-halley-ellipse',
    domain: 'Astronomi',
    title: 'Orbit Elips Ekstrem Komet Halley',
    badgeText: 'Hukum II Kepler · e = 0.82',
    objective:
      'Amati lonjakan kecepatan orbit saat perihelion dan pelambatan drastis saat aphelion sesuai kekekalan momentum sudut.',
    astronomyPatch: {
      mode: 'solar-kepler',
      selectedPlanetId: 'halley-comet',
      customSemiMajorAxisAu: 17.8,
      customEccentricity: 0.82,
      centralStarMassSolar: 1.0,
      showKeplerAreaSweep: true,
    },
  },
  {
    id: 'astro-dark-matter-flat',
    domain: 'Astronomi',
    title: 'Anomali Kurva Rotasi Bima Sakti',
    badgeText: 'Materi Gelap · R = 16.0 kpc',
    objective:
      'Bandingkan kurva rotasi datar observasi (dengan halo materi gelap) terhadap kurva turun Keplerian di tepi galaksi.',
    astronomyPatch: {
      mode: 'milkyway-galaxy',
      galactocentricRadiusKpc: 16.0,
      darkMatterHaloFraction: 1.15,
      sgrAStarMassMillionSolar: 4.15,
    },
  },
  {
    id: 'astro-habitable-transit',
    domain: 'Astronomi',
    title: 'Eksoplanet di Zona Laik Huni',
    badgeText: 'Fotometri Transit · Kelas G',
    objective:
      'Simulasikan transit planet seukuran Jupiter di depan bintang serupa Matahari (5778 K) pada jarak 1.00 AU.',
    astronomyPatch: {
      mode: 'stellar-exoplanet',
      starEffectiveTempK: 5778,
      starRadiusSolar: 1.0,
      exoplanetRadiusEarth: 10.91,
      exoplanetOrbitAu: 1.0,
    },
  },
];

export interface ConceptCompanionCard {
  heading: string;
  levelLabel: string;
  summaryText: string;
  keyEquation: string;
  practicalTip: string;
}

export function getConceptCardContent(
  domain: ScienceDomain,
  subMode: string,
  level: AcademicLevel
): ConceptCompanionCard {
  if (level === 'smp') {
    if (domain === 'Fisika') {
      return {
        heading: 'Analogi Konkret SMP: Gaya, Lemparan Bola & Getaran Pegas',
        levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
        summaryText:
          'Bayangkan saat kamu mendorong meja di lantai kasar atau melempar bola basket ke ring: makin besar dorongan awalmu, makin cepat dan jauh bolanya melambung sebelum ditarik gravitasi ke bawah.',
        keyEquation: 'Gaya Bersih = Dorongan - Gesekan   |   Percepatan = Gaya / Massa',
        practicalTip:
          'Eksperimen Seru: Geser slider Gaya Dorong atau Sudut Lempar, lalu klik Rekam Data untuk melihat polanya bersama Dr. LabMu!',
      };
    }
    if (domain === 'Kimia') {
      return {
        heading: 'Analogi Konkret SMP: Suhu Reaksi & Keseimbangan Asam-Basa',
        levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
        summaryText:
          'Seperti melarutkan gula di teh hangat atau mencampur perasan jeruk nipis (asam) dengan air sabun (basa): saat takarannya pas seimbang, sifat asam dan basanya saling menetralkan di pH 7.',
        keyEquation: 'Asam + Basa → Garam + Air + Panas (pH Netral = 7)',
        practicalTip:
          'Eksperimen Seru: Teteskan larutan sedikit demi sedikit dengan tombol [+] sampai warna cairan di gelas kimia berubah!',
      };
    }
    return {
      heading: 'Analogi Konkret SMP: Putaran Planet & Cahaya Bintang',
      levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
      summaryText:
        'Seperti melihat Bulan mengelilingi Bumi atau komidi putar: planet yang berada lebih dekat dengan Matahari harus berlari jauh lebih cepat agar tidak tertarik jatuh ke Matahari.',
      keyEquation: 'Makin Jauh Planet dari Matahari → Makin Lama 1 Tahun Orbitnya',
      practicalTip:
        'Eksperimen Seru: Pilih planet Merkurius lalu bandingkan dengan Jupiter, dan tanyakan ke Dr. LabMu mengapa kecepatannya berbeda!',
    };
  }

  if (domain === 'Fisika') {
    if (subMode === 'projectile-gravity') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Gerak Parabola (Projektil)',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Gerak parabola adalah gabungan gerak lurus beraturan (GLB) pada sumbu mendatar X dan gerak lurus berubah beraturan (GLBB) dipercepat gravitasi pada sumbu vertikal Y.',
            keyEquation: 'R = (v₀² · sin 2θ) / g   |   H_maks = (v₀² · sin²θ) / (2g)',
            practicalTip:
              'Tips Praktikum: Atur sudut tembak tepat 45° untuk membuktikan jarak jangkauan mendatar paling jauh pada ketinggian awal h₀ = 0 m.',
          }
        : {
            heading: 'Analisis Vektor & Balistik Gravitasi',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Integrasi persamaan gerak r̈(t) = -g ĵ menghasilkan lintasan kuadratik y(x) = h₀ + x tan θ - (g x²) / (2 v₀² cos²θ) dengan konservasi energi mekanik E = ½mv² + mgy.',
            keyEquation: 'r(t) = (v₀ cos θ)t î + [h₀ + (v₀ sin θ)t - ½gt²] ĵ',
            practicalTip:
              'Analisis Kuantitatif: Variasikan medan gravitasi planet g dan plot regresi linier antara v₀² terhadap R untuk memverifikasi gradien 1/g.',
          };
    }
    if (subMode === 'collision-momentum') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Hukum Kekekalan Momentum',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Total momentum sebelum dan sesudah tumbukan selalu tetap selama tidak ada gaya luar. Koefisien restitusi (e) menentukan seberapa lenting tumbukan tersebut.',
            keyEquation: "m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'   |   e = -(v₂' - v₁') / (v₂ - v₁)",
            practicalTip:
              'Tips Praktikum: Bandingkan e = 1.0 (lenting sempurna, energi kinetik utuh) dengan e = 0.0 (tidak lenting, kedua benda menempel pasca tumbukan).',
          }
        : {
            heading: 'Dinamika Impuls & Disipasi Energi Tumbukan 1D',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Dalam kerangka pusat massa (center-of-mass frame), momentum total sistem terisolasi kekal (dp_tot/dt = 0), sedangkan fraksi energi kinetik yang terdisipasi menjadi panas adalah (1 - e²) pada kerangka reduksi.',
            keyEquation: 'ΔEK = -½ μ_red (1 - e²)(v₁ - v₂)²   dengan   μ_red = (m₁m₂)/(m₁+m₂)',
            practicalTip:
              'Analisis Kuantitatif: Catat persentase kehilangan energi kinetik (Hilang EK %) pada berbagai rasio massa m₁/m₂.',
          };
    }
    if (subMode === 'spring-hooke') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Gaya Pegas Hooke & Getaran Harmonik',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Pegas selalu menarik atau mendorong beban kembali ke titik setimbang (x = 0) dengan gaya yang sebanding dengan simpangannya. Makin kaku pegas (k besar), makin cepat getarannya.',
            keyEquation: 'Fp = -k · Δx   |   T = 2π √(m / k)   |   Ep = ½ k Δx²',
            practicalTip:
              'Tips Praktikum: Geser simpangan Δx lalu rekam 4 titik data untuk melihat garis lurus Hukum Hooke di grafik regresi!',
          }
        : {
            heading: 'Osilator Harmonik Teredam (Damped Harmonic Oscillator)',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Persamaan diferensial orde dua m ẍ + b ẋ + kx = 0 memiliki solusi teredam kurang (underdamped) dengan peluruhan amplitudo eksponensial e^(-γt) dan pergeseran frekuensi sudut ω_d.',
            keyEquation: 'x(t) = A e^(-γt) cos(ω_d t)   |   ω_d = √(k/m - (b/2m)²)',
            practicalTip:
              'Analisis Kuantitatif: Amati pengaruh faktor redaman viskos b terhadap peluruhan energi mekanik total E(t) sepanjang waktu.',
          };
    }
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Hukum I & II Newton pada Bidang Miring',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Benda mulai bergerak jika gaya penggerak melampaui batas gesek statis maksimum (fs,maks). Setelah bergerak, percepatan benda berbanding lurus dengan resultan gaya (ΣF) dan berbanding terbalik dengan massa (m).',
          keyEquation: 'ΣF = F - m·g·sin θ - fk = m · a   |   fk = μk · m·g·cos θ',
          practicalTip:
            'Tips Praktikum: Coba tambah gaya dorong F secara bertahap dengan tombol [+] lalu rekam minimal 3 data untuk melihat grafik lurus F terhadap a.',
        }
      : {
          heading: 'Mekanika Newton & Dekomposisi Vektor Bidang Miring',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Transformasi koordinat ke sumbu sejajar (x̂) dan tegak lurus bidang miring (ŷ) memisahkan kendala normal N = mg cos θ dari persamaan dinamika translasi m ẍ = F_ext - mg sin θ - f(ẋ).',
          keyEquation: 'm (d²x/dt²) = F - mg sin θ - sgn(v) μk mg cos θ',
          practicalTip:
            'Analisis Kuantitatif: Tentukan sudut kritis kemiringan θ_c = arctan(μs) di mana balok tepat mulai meluncur tanpa gaya luar (F = 0 N).',
        };
  }

  if (domain === 'Kimia') {
    if (subMode === 'acid-base-titration') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Titrasi Asam-Basa & Titik Ekuivalen',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Titrasi digunakan untuk mencari konsentrasi larutan asam dengan meneteskan basa standar hingga jumlah mol ion H⁺ tepat sama dengan mol ion OH⁻ (titik ekuivalen).',
            keyEquation: 'M_asam × V_asam = M_basa × V_basa   |   pH = -log[H⁺]',
            practicalTip:
              'Tips Praktikum: Gunakan tombol [+] pada Volume NaOH di sekitar 19.5 – 20.5 mL untuk mengamati lonjakan tajam pH dan perubahan warna indikator!',
          }
        : {
            heading: 'Kesetimbangan Ionik & Kurva Sigmoidal Henderson-Hasselbalch',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Sepanjang zona penyangga pra-ekuivalen, pH dikendalikan oleh rasio pasangan asam-basa konjugasi, sedangkan di titik infleksi (d²pH/dV² = 0) kapasitas penyangga mencapai minimum.',
            keyEquation: 'pH = pKa + log([A⁻]/[HA])   |   [H⁺]³ + Ka[H⁺]² - (Kw + Ka C_a)[H⁺] = 0',
            practicalTip:
              'Analisis Kuantitatif: Bandingkan pemilihan indikator Bromtimol Biru (pKa ≈ 7.1) terhadap Fenolftalein (pKa ≈ 9.3) di sekitar volume ekuivalen.',
          };
    }
    if (subMode === 'electrochemistry-cell') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Sel Volta (Galvani) & Reaksi Redoks',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Pada sel Volta, reaksi redoks spontan menghasilkan arus listrik. Elektron mengalir dari Anoda (tempat oksidasi, kutub negatif) menuju Katoda (tempat reduksi, kutub positif).',
            keyEquation: 'E°_sel = E°_katoda - E°_anoda   (Ingat: Katoda Reduksi, Anoda Oksidasi)',
            practicalTip:
              'Tips Praktikum: Perhatikan nilai voltmeter digital saat Anda mengubah pasangan elektrode dari Zn-Cu ke Mg-Ag!',
          }
        : {
            heading: 'Termodinamika Elektrokimia & Persamaan Nernst',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Potensial gaya gerak listrik sel bergantung pada aktivitas ionik kuosien reaksi Q = [Anoda]/[Katoda] dan berhubungan langsung dengan kerja listrik maksimum ΔG = -nFE_sel.',
            keyEquation: 'E_sel = E°_sel - (RT / nF) ln Q   |   ΔG = -n F E_sel',
            practicalTip:
              'Analisis Kuantitatif: Variasikan rasio konsentrasi [Anoda]/[Katoda] untuk memverifikasi kemiringan Nernst sebesar -0.0592/n Volt per dekade log Q.',
          };
    }
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Termokimia, Kalorimetri & Energi Gibbs',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Reaksi eksotermik (ΔH < 0) melepaskan panas sehingga suhu kalorimeter naik, sedangkan endotermik (ΔH > 0) menyerap panas. Suatu reaksi berjalan spontan jika energi bebas Gibbs bernilai negatif (ΔG < 0).',
          keyEquation: 'q = m · c · ΔT   |   ΔG = ΔH - T · ΔS',
          practicalTip:
            'Tips Praktikum: Klik tombol "Gunakan Katalis" dan perhatikan bagaimana bukit energi aktivasi (Ea) turun sehingga reaksi jauh lebih cepat!',
        }
      : {
          heading: 'Kinetika Arrhenius & Termodinamika Kesetimbangan Kimia',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Konstanta laju reaksi mengikuti distribusi Boltzmann k = A exp(-Ea/RT), sedangkan arah spontanitas dan konstanta kesetimbangan termodinamika ditentukan oleh ΔG° = -RT ln K_eq.',
          keyEquation: 'k(T) = A e^(-Ea / RT)   |   ΔG = ΔH - TΔS = -RT ln K_eq',
          practicalTip:
            'Analisis Kuantitatif: Uji reaksi endotermik CaCO₃ dan cari suhu balik (crossover temperature T = ΔH/ΔS) di mana ΔG beralih menjadi negatif.',
        };
  }

  // Astronomi
  if (subMode === 'milkyway-galaxy') {
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Galaksi Bima Sakti & Misteri Materi Gelap',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Tata Surya kita mengorbit pusat Galaksi Bima Sakti (lubang hitam Sagittarius A*) pada jarak ~8.2 kpc. Bintang-bintang di tepi luar galaksi bergerak jauh lebih cepat dari perkiraan karena adanya Halo Materi Gelap.',
          keyEquation: 'v_rotasi = √(G · M_total / R)   |   R_TataSurya ≈ 8.2 kpc',
          practicalTip:
            'Tips Praktikum: Geser Fraksi Materi Gelap ke 0.0x untuk melihat kurva biru berimpit dengan kurva kuning Keplerian!',
        }
      : {
          heading: 'Dinamika Galaktik, Profil Halo Materi Gelap & Metrik Sgr A*',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Kurva rotasi datar (v(R) ≈ konstan pada R > 8 kpc) membuktikan keberadaan profil kerapatan halo isotermal ρ_DM(r) ∝ r⁻² sehingga massa terlingkupi M(<R) tumbuh linier terhadap radius galaktosentrik R.',
          keyEquation: 'v²(R) = v²_bulge(R) + v²_disk(R) + (G M_halo(<R)) / R   |   R_s = 2GM_BH / c²',
          practicalTip:
            'Analisis Kuantitatif: Hitung massa total terlingkupi M(<R) pada R = 20 kpc dan bandingkan kontribusi materi tampak terhadap halo materi gelap.',
        };
  }
  if (subMode === 'stellar-exoplanet') {
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Spektrum Bintang (O–M) & Transit Eksoplanet',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Warna bintang menunjukkan suhunya: bintang biru (Kelas O/B) sangat panas, kuning (Kelas G seperti Matahari) sedang, dan merah (Kelas M) lebih dingin. Saat planet melintas di depan bintang, cahaya bintang meredup sedikit.',
          keyEquation: 'L ∝ R*² · T⁴   |   Peredupan Transit (%) = (R_planet / R_bintang)² × 100%',
          practicalTip:
            'Tips Praktikum: Atur jarak orbit eksoplanet agar masuk ke rentang Zona Laik Huni (Habitable Zone) di mana air cair dapat bertahan.',
        }
      : {
          heading: 'Hukum Radiasi Stefan-Boltzmann & Fotometri Transit Kepler',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Posisi bintang pada Diagram Hertzsprung-Russell ditentukan oleh fluks bolometrik L = 4πR*²σT_eff⁴, sedangkan kedalaman kurva cahaya transit ΔF/F memberikan rasio penampang geometris (Rp/R*)².',
          keyEquation: 'L/L☉ = (R*/R☉)² (T_eff/5778 K)⁴   |   d_HZ ≈ √(L / L☉) AU',
          practicalTip:
            'Analisis Kuantitatif: Rekam variasi jari-jari planet Rp terhadap kedalaman transit ΔF/F (ppm) untuk menguji batas deteksi fotometrik.',
        };
  }
  return level === 'sma'
    ? {
        heading: 'Intisari Konsep: Tata Surya & Tiga Hukum Orbit Kepler',
        levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
        summaryText:
          'Planet bergerak mengelilingi Matahari dalam lintasan elips (Hukum I), bergerak lebih cepat saat dekat Matahari/perihelion (Hukum II), dan kuadrat periode orbitnya sebanding dengan pangkat tiga jarak rata-ratanya (Hukum III).',
        keyEquation: 'T² / a³ = Konstan (1.00 untuk M* = 1 M☉)   |   r_perihelion = a(1 - e)',
        practicalTip:
          'Tips Praktikum: Klik tombol objek planet (Merkurius, Bumi, Jupiter, Komet Halley) dan perhatikan bahwa rasio T²/a³ selalu bernilai 1.000!',
      }
    : {
        heading: 'Mekanika Orbit Elips Keplerian & Persamaan Vis-Viva',
        levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
        summaryText:
          'Dari solusi masalah dua-benda gravitasi Newton, kecepatan orbit sesaat pada jarak r memenuhi persamaan Vis-Viva v² = GM*(2/r - 1/a), dengan konservasi momentum sudut spesifik h = r × v yang menghasilkan dA/dt = h/2.',
        keyEquation: 'T² = (4π² / GM*) a³   |   v_p / v_a = (1 + e) / (1 - e)',
        practicalTip:
          'Analisis Kuantitatif: Variasikan massa bintang induk M* dan amati perubahan skala konstanta Kepler T²/a³ = 1/M*.',
      };
}

export function stepParameterValue(
  current: number,
  delta: number,
  min: number,
  max: number,
  decimals = 2
): number {
  const raw = current + delta;
  const clamped = Math.min(max, Math.max(min, raw));
  return Number(clamped.toFixed(decimals));
}

export interface DrLabMuOutlierPoint {
  trialNumber: number;
  id: string;
  title: string;
  x: number;
  yObserved: number;
  yPredicted: number;
  residual: number;
  parametersSummary: string;
}

export interface DrLabMuTelemetryPayload {
  domain: ScienceDomain;
  topic: string;
  educationLevel: DrLabMuEducationLevel;
  currentParameters: Record<string, number | string | boolean>;
  recordedData: Array<{
    trialNumber: number;
    id: string;
    title: string;
    parametersSummary: string;
    x?: number;
    y1?: number;
    y2?: number;
    keyMetrics: Record<string, number | string>;
  }>;
  analytics: {
    rSquared: number;
    slope: number;
    intercept: number;
    stdDev: number;
    equation: string;
    hasExtremeOutlier: boolean;
    outlierTrial?: DrLabMuOutlierPoint;
  };
  studentQuery: string;
}

export interface DrLabMuStructuredResponse {
  observation: string;
  dataHighlight: string;
  socraticQuestion: string;
  detectedTrigger:
    | 'anomaly-outlier'
    | 'direct-answer-refusal'
    | 'off-topic-refusal'
    | 'concept-analogy';
  formattedText: string;
}

export interface BiologyTelemetryContext {
  moduleId: string;
  params: Record<string, number>;
  parameters?: Record<string, number>;
  liveMetrics?: Record<string, number>;
}

const HUMAN_MODULE_LABELS: Record<string, string> = {
  'newton-incline': 'Hukum II Newton & Bidang Miring',
  'projectile-gravity': 'Kinematika Gerak Parabola',
  'collision-momentum': 'Tumbukan & Kekekalan Momentum',
  'spring-hooke': 'Osilasi Pegas Hukum Hooke',
  'orbital-gravity': 'Gravitasi Universal Dua Massa',
  'pendulum-harmonic': 'Bandul Sederhana Harmonis',
  'hukum-pendulum': 'Hukum Bandul Sederhana Harmonis',
  'stokes-viscosity': 'Viskositas Fluida & Hukum Stokes',
  'ohm-wheatstone': 'Hukum Ohm & Jembatan Wheatstone',
  'optics-young-slit': 'Interferensi Celah Ganda Young',
  'photoelectric-planck': 'Efek Fotolistrik & Konstanta Planck',
  'thermo-calorimetry': 'Termokimia & Kalorimetri',
  'acid-base-titration': 'Titrasi Asam-Basa',
  'titrasi-asam-basa': 'Titrasi Asam-Basa',
  'electrochemistry-cell': 'Sel Elektrokimia Galvani',
  'ideal-gas-boyle': 'Hukum Gas Ideal & Kompresi Boyle',
  'reaction-kinetics-arrhenius': 'Kinetika Laju Reaksi & Arrhenius',
  'spectrophotometry-beer': 'Spektrofotometri UV-Vis & Hukum Beer',
  'photosynthesis-ingenhousz': 'Fotosintesis Ingenhousz (Hydrilla)',
  'enzyme-catalase': 'Kinetika Enzim Katalase Michaelis-Menten',
  'enzyme-kinetics': 'Kinetika Enzim Michaelis-Menten',
  'predator-prey-dynamics': 'Dinamika Populasi Lotka-Volterra',
  'cell-osmosis-tonicity': 'Osmosis & Tekanan Turgor Sel',
  'osmosis-plasmolysis': 'Osmosis & Plasmolisis Sel Tumbuhan',
  'mikroskop-sel': 'Mikroskop & Struktur Organel Sel',
  'solar-kepler': 'Dinamika Orbit Hukum Kepler',
  'hukum-kepler': 'Hukum-Hukum Orbit Kepler',
  'milkyway-galaxy': 'Kurva Rotasi Galaksi Bima Sakti',
  'stellar-exoplanet': 'Spektrum Bintang & Transit Eksoplanet',
  'stellar-wien-spectrum': 'Hukum Pergeseran Wien & Spektroskopi',
  'hubble-expansion': 'Hukum Hubble & Ekspansi Kosmik',
};

export function buildDrLabMuTelemetry(
  domain: ScienceDomain,
  academicLevel: AcademicLevel,
  physicsParams: PhysicsParams,
  chemistryParams: ChemistryParams,
  astronomyParams: AstronomyParams,
  records: ExperimentRecord[],
  studentQuery: string,
  biologyContext?: BiologyTelemetryContext
): DrLabMuTelemetryPayload {
  const educationLevel = mapAcademicLevelToTelemetry(academicLevel);
  let topic = 'newton-incline';
  let currentParameters: Record<string, number | string | boolean> = {};

  if (domain === 'Fisika') {
    topic = physicsParams.mode;
    if (physicsParams.mode === 'projectile-gravity') {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        initialVelocityMs: physicsParams.initialVelocity,
        launchAngleDeg: physicsParams.launchAngle,
        initialHeightM: physicsParams.initialHeight,
        gravityMs2: physicsParams.gravity,
      };
    } else if (physicsParams.mode === 'spring-hooke') {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        springConstantK: physicsParams.springConstantK,
        springDisplacementM: physicsParams.springDisplacement,
        dampingCoeff: physicsParams.dampingCoeff,
      };
    } else if (physicsParams.mode === 'collision-momentum') {
      currentParameters = {
        mode: physicsParams.mode,
        mass1Kg: physicsParams.mass,
        velocity1InitialMs: physicsParams.initialVelocity,
        mass2Kg: physicsParams.collisionMass2,
        velocity2InitialMs: physicsParams.velocity2Initial,
        restitutionCoeff: physicsParams.restitutionCoeff,
      };
    } else {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        appliedForceN: physicsParams.appliedForce,
        inclineAngleDeg: physicsParams.inclineAngle,
        frictionCoeffStatic: physicsParams.frictionCoeffStatic,
        frictionCoeffKinetic: physicsParams.frictionCoeffKinetic,
        gravityMs2: physicsParams.gravity,
      };
    }
  } else if (domain === 'Kimia') {
    topic = chemistryParams.mode;
    if (chemistryParams.mode === 'acid-base-titration') {
      currentParameters = {
        mode: chemistryParams.mode,
        analyteAcidConcM: chemistryParams.analyteAcidConc,
        analyteVolumeMl: chemistryParams.analyteVolumeMl,
        titrantBaseConcM: chemistryParams.titrantBaseConc,
        titrantAddedMl: chemistryParams.titrantAddedMl,
        acidPka: chemistryParams.acidPka,
        indicatorType: chemistryParams.indicatorType,
      };
    } else if (chemistryParams.mode === 'electrochemistry-cell') {
      currentParameters = {
        mode: chemistryParams.mode,
        redoxPairId: chemistryParams.redoxPairId,
        anodeConcM: chemistryParams.anodeConcM,
        cathodeConcM: chemistryParams.cathodeConcM,
        tempC: chemistryParams.initialTempC,
      };
    } else {
      currentParameters = {
        mode: chemistryParams.mode,
        reactionId: chemistryParams.reactionId,
        initialTempC: chemistryParams.initialTempC,
        reactantConcentrationM: chemistryParams.reactantConcentration,
        solutionVolumeMl: chemistryParams.solutionVolumeMl,
        useCatalyst: chemistryParams.useCatalyst,
      };
    }
  } else if (domain === 'Biologi') {
    topic = biologyContext?.moduleId || 'photosynthesis-ingenhousz';
    currentParameters = {
      mode: topic,
      ...(biologyContext?.params || {
        lightIntensityLux: 5000,
        nahco3ConcPct: 0.5,
        waterTempC: 28,
      }),
    };
  } else {
    topic = astronomyParams.mode;
    if (astronomyParams.mode === 'solar-kepler') {
      currentParameters = {
        mode: 'solar-kepler',
        selectedPlanetId: astronomyParams.selectedPlanetId,
        semiMajorAxisAu: astronomyParams.customSemiMajorAxisAu,
        eccentricity: astronomyParams.customEccentricity,
        centralStarMassSolar: astronomyParams.centralStarMassSolar,
      };
    } else if (astronomyParams.mode === 'milkyway-galaxy') {
      currentParameters = {
        mode: astronomyParams.mode,
        galactocentricRadiusKpc: astronomyParams.galactocentricRadiusKpc,
        darkMatterHaloFraction: astronomyParams.darkMatterHaloFraction,
        sgrAStarMassMillionSolar: astronomyParams.sgrAStarMassMillionSolar,
      };
    } else {
      currentParameters = {
        mode: astronomyParams.mode,
        starEffectiveTempK: astronomyParams.starEffectiveTempK,
        starRadiusSolar: astronomyParams.starRadiusSolar,
        exoplanetRadiusEarth: astronomyParams.exoplanetRadiusEarth,
        exoplanetOrbitAu: astronomyParams.exoplanetOrbitAu,
      };
    }
  }

  const domainRecords = [...records]
    .filter((r) => r.domain === domain)
    .reverse();

  const recordedData = domainRecords.map((rec, index) => ({
    trialNumber: index + 1,
    id: rec.id,
    title: rec.experimentTitle,
    parametersSummary: rec.parametersSummary,
    x: rec.numericX,
    y1: rec.numericY1,
    y2: rec.numericY2,
    keyMetrics: rec.keyMetrics,
  }));

  const validPoints = recordedData.filter(
    (d) => typeof d.x === 'number' && typeof d.y1 === 'number'
  ) as Array<
    (typeof recordedData)[number] & { x: number; y1: number }
  >;

  const reg = calculateLinearRegression(
    validPoints.map((p) => ({ x: p.x, y: p.y1 }))
  );

  let outlierTrial: DrLabMuOutlierPoint | undefined;
  let maxAbsResidual = 0;

  if (validPoints.length >= 3) {
    for (const pt of validPoints) {
      const yPred = reg.slopeM * pt.x + reg.interceptC;
      const residual = Math.abs(pt.y1 - yPred);
      if (residual > maxAbsResidual) {
        maxAbsResidual = residual;
        outlierTrial = {
          trialNumber: pt.trialNumber,
          id: pt.id,
          title: pt.title,
          x: pt.x,
          yObserved: pt.y1,
          yPredicted: Number(yPred.toFixed(2)),
          residual: Number(residual.toFixed(2)),
          parametersSummary: pt.parametersSummary,
        };
      }
    }
  }

  const hasExtremeOutlier =
    validPoints.length >= 3 &&
    (reg.rSquared < 0.85 ||
      (reg.stdDevY > 0 && maxAbsResidual > 1.35 * reg.stdDevY));

  return {
    domain,
    topic,
    educationLevel,
    currentParameters,
    recordedData,
    analytics: {
      rSquared: reg.rSquared,
      slope: reg.slopeM,
      intercept: reg.interceptC,
      stdDev: reg.stdDevY,
      equation: reg.equationString,
      hasExtremeOutlier,
      outlierTrial,
    },
    studentQuery: studentQuery.trim(),
  };
}

export function generateSocraticDrLabMuResponse(
  telemetry: DrLabMuTelemetryPayload
): DrLabMuStructuredResponse {
  const {
    domain,
    topic,
    educationLevel,
    recordedData,
    analytics,
    studentQuery,
  } = telemetry;

  const qLower = studentQuery.toLowerCase().trim();
  const readableTopic = HUMAN_MODULE_LABELS[topic] || topic;

  // 1. PANTANGAN MUTLAK: Deteksi Permintaan Jawaban Mentah / Curang
  const isAskingDirectAnswer =
    /berapa\s+(nilai|besar|angka|hasil|jawaban|rumus|titik|konstanta)|kasih\s+tahu\s+jawaban|jawabannya\s+apa|hitungin|bocorin|kesimpulan\s+laporan|nilai\s+g[- ]?nya|langsung\s+jawab|minta\s+jawaban|angka\s+akhir/i.test(
      qLower
    );

  // Deteksi Pertanyaan di Luar Topik / Sains
  const isOffTopic =
    /resep\s+masakan|game\s+online|sepak\s+bola|kripto|bitcoin|politik|presiden|pacar|lagu|film|gosip|harga\s+emas|siapa\s+kamu|di\s+luar\s+praktikum/i.test(
      qLower
    );

  // 2. ATURAN PENANGANAN ANOMALI: R² < 0.85 atau Outlier Ekstrem
  const isAnomalyOrLowR2 =
    analytics.rSquared < 0.85 && recordedData.length >= 3
      ? true
      : analytics.hasExtremeOutlier ||
        /outlier|melenceng|menyimpang|aneh|r2|r²|tidak\s+lurus|merosot|turun\s+drastis/i.test(
          qLower
        );

  const observation = `Eksplorasi yang sangat baik di laboratorium virtual ${domain} pada modul ${readableTopic} (${educationLevel}). Sejauh ini Anda telah mengumpulkan ${recordedData.length} baris data observasi riil di meja praktikum.`;

  // Tangani Pertanyaan di Luar Topik
  if (isOffTopic) {
    const dataHighlight = `Ilmuwan hebat selalu memusatkan perhatian pada fenomena alam yang sedang diselidiki di hadapannya. Di laboratorium virtual RuangLABmu, kita sedang mengeksplorasi modul ${readableTopic} (${educationLevel}) dengan data observasi nyata.`;
    const socraticQuestion = `Bagaimana kalau kita kembali berfokus pada instrumen lab 3D dan mengamati apa yang terjadi pada grafik saat salah satu variabel bebas Anda geser?`;
    return {
      observation: `Senang bisa menyapa Anda di RuangLABmu! Namun sebagai mentor laboratorium sains, mari kita tetap berfokus pada eksperimen aktif kita.`,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'off-topic-refusal',
      formattedText: `Senang bisa menyapa Anda di RuangLABmu! Namun sebagai mentor laboratorium sains, mari kita tetap berfokus pada eksperimen aktif kita.\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // Tangani Permintaan Jawaban Mentah / Menyontek
  if (isAskingDirectAnswer) {
    const slopeInfo =
      recordedData.length >= 2
        ? `(${analytics.equation} dengan nilai R² = ${analytics.rSquared.toFixed(3)})`
        : `dari data observasi yang sedang kamu kumpulkan`;
    const dataHighlight = `Ilmuwan hebat tidak menyalin jawaban, tapi membaca polanya! Mari kita periksa slope grafik yang baru saja kamu dapatkan ${slopeInfo}. Saya punya catatannya, tapi ilmuwan sejati menemukan rahasianya dari grafik sendiri! Memahami korelasi variabel bebas dan terikat jauh lebih bermakna daripada sekadar menghafal angka akhir.`;

    const socraticQuestion =
      domain === 'Fisika'
        ? `Jika sumbu mendatar mewakili variabel bebas yang Anda atur di slider dan sumbu tegak adalah responsnya, bagaimana kemiringan garis regresi pada grafik Anda berhubungan dengan konstanta fisis atau hukum kekekalan yang sedang diuji?`
        : domain === 'Kimia'
        ? `Coba perhatikan indikator visual perubahan warna larutan dan kurva pH: di sekitar volume berapakah perbandingan stoikiometri reaktan mencapai titik kesetimbangan atau titik ekuivalen?`
        : domain === 'Biologi'
        ? `Perhatikan laju pembentukan gelembung oksigen atau perubahan massa sel pada tabel pengamatan: variabel lingkungan manakah yang kini menjadi faktor pembatas utama dalam proses biologis tersebut?`
        : `Bagaimana perbandingan antara kuadrat periode orbit (T²) terhadap pangkat tiga jarak rata-rata (a³) saat Anda menggeser massa bintang induk atau jari-jari edar sesuai Hukum III Kepler?`;

    return {
      observation,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'direct-answer-refusal',
      formattedText: `${observation}\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // Tangani Anomali & Deviasi Data (R² < 0.85 atau Outlier Ekstrem)
  if (isAnomalyOrLowR2) {
    const outlier = analytics.outlierTrial;
    let dataHighlight = '';
    let socraticQuestion = '';

    if (domain === 'Biologi' && (topic.includes('enzyme') || topic.includes('katalase') || qLower.includes('suhu') || (outlier && outlier.parametersSummary.includes('°C')))) {
      dataHighlight = `Coba amati baris data ke-${outlier ? outlier.trialNumber : 4} saat suhu dinaikkan ke 80°C. Mengapa laju reaksi justru menurun drastis? Faktor apa pada enzim yang kira-kira terpengaruh?`;
      socraticQuestion = `Apakah struktur tiga dimensi protein enzim mengalami denaturasi termal pada suhu ekstrem tersebut sehingga sisi aktifnya tidak lagi dapat mengikat molekul substrat?`;
    } else if (outlier) {
      dataHighlight = `Nilai korelasi grafik saat ini adalah R² = ${analytics.rSquared.toFixed(3)}. Coba amati baris data ke-${outlier.trialNumber} (${outlier.title}) di mana nilai respons terukur (${outlier.yObserved}) menyimpang dari tren garis prediksi (${outlier.yPredicted}). Dalam sains empiris, anomali bukanlah kesalahan, melainkan petunjuk adanya efek non-linier atau batas fisis baru.`;
      socraticQuestion = `Menurut hipotesis Anda, faktor atau kondisi variabel manakah pada percobaan ke-${outlier.trialNumber} yang menyebabkan nilai respons tersebut berbelok dari garis tren umum?`;
    } else {
      dataHighlight = `Nilai korelasi grafik saat ini adalah R² = ${analytics.rSquared.toFixed(3)}, menandakan terdapat titik percobaan yang menjauh dari garis regresi akibat fluktuasi pengukuran atau perubahan lebih dari satu parameter sekaligus.`;
      socraticQuestion = `Jika Anda menjaga semua variabel kontrol tetap konstan dan hanya menggeser satu variabel bebas secara bertahap, apakah titik pengamatan berikutnya akan menaikkan nilai R² mendekati 1,00?`;
    }

    return {
      observation,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'anomaly-outlier',
      formattedText: `${observation}\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // 3. BIMBINGAN BERTAHAP: Domain-Specific Insights & Analogi Jenjang (SMP / SMA / Perguruan Tinggi)
  let analogyHighlight = '';
  let socraticQuestion = '';

  if (educationLevel === 'SMP') {
    if (domain === 'Fisika') {
      analogyHighlight = `Bayangkan kamu sedang melempar bola basket ke arah ring atau mendorong kotak kardus di lantai: makin kuat dorongan awalmu dan makin pas sudut lemparanmu, makin jauh bola melambung sebelum ditarik gravitasi bumi ke bawah.`;
      socraticQuestion = `Jika kamu melempar bola terlalu mendatar dibandingkan terlalu tegak ke atas, pada sudut berapa derajat menurut perkiraanmu jarak lemparannya mencapai paling jauh?`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Bayangkan kamu sedang melarutkan sesendok gula ke dalam teh hangat atau menetesi air perasan jeruk yang asam dengan air soda kue: sifat dan suhu larutan akan berubah bertahap mengikuti takaran yang kamu campurkan sampai keduanya seimbang netral.`;
      socraticQuestion = `Coba geser slider penambahan tetesan di simulasi: pada saat warna cairan di gelas kimia 3D berubah, apa yang terjadi pada angka derajat keasaman (pH) larutan?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Bayangkan tanaman air Hydrilla yang berjemur di bawah sinar matahari hangat: klorofil di daun hijau bertindak seperti panel surya kecil yang menangkap cahaya untuk memproduksi energi dan melepaskan gelembung oksigen segar.`;
      socraticQuestion = `Coba geser slider intensitas cahaya atau kadar karbon dioksida di panel kiri: pada kondisi lingkungan seperti apa gelembung udara oksigen muncul paling melimpah?`;
    } else {
      analogyHighlight = `Bayangkan pelari di lintasan lari stadion: pelari di lajur paling dalam dekat pusat harus berlari lebih cepat menyelesaikan putaran dibandingkan pelari di lajur paling luar. Planet di dekat Matahari pun berperilaku sama!`;
      socraticQuestion = `Coba pilih planet Merkurius lalu bandingkan dengan Jupiter di simulasi: mengapa planet yang lebih dekat dengan Matahari membutuhkan waktu orbit yang jauh lebih singkat?`;
    }
  } else if (educationLevel === 'SMA') {
    if (domain === 'Fisika') {
      analogyHighlight = `Mari kita teliti korelasi antara variabel bebas dan variabel terikat pada modul ${readableTopic}. Menurut hukum kekekalan energi dan momentum, perubahan gaya atau kecepatan awal akan langsung tercermin pada gradien garis regresi grafikmu.`;
      socraticQuestion = `Jika Anda menggandakan kecepatan awal sambil menjaga sudut elevasi dan massa tetap konstan, apakah jarak jangkauan horizontal meningkat dua kali lipat atau empat kali lipat? Yuk buktikan di tabel!`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Perhatikan indikator visual stoikiometri pada modul ${readableTopic}: perubahan warna indikator dan lonjakan kurva pH menandakan titik ekuivalen saat mol ion asam tepat dinetralkan oleh ion basa. Pada sel elektrokimia, aliran elektron mencerminkan selisih potensial reduksi standar.`;
      socraticQuestion = `Jika konsentrasi reaktan asam Anda naikkan dua kali lipat pada slider, berapa mL volume titran basa yang kini dibutuhkan agar larutan tepat mencapai titik infleksi pH?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Pada sistem biologis ${readableTopic}, struktur organel dan membran selulosa sangat menentukan permeabilitas osmosis, sementara aktivitas enzimatik sangat bergantung pada suhu dan pH optimum sebelum laju reaksi jenuh.`;
      socraticQuestion = `Jika suhu dinaikkan melampaui batas optimum 40°C pada slider, mengapa laju pembentukan gelembung oksigen atau aktivitas enzim justru merosot tajam meskipun konsentrasi substrat melimpah?`;
    } else {
      analogyHighlight = `Perhatikan pergerakan benda langit pada modul ${readableTopic}: gaya gravitasi universal Newton yang berbanding terbalik dengan kuadrat jarak menjadi penentu lintasan elips dan rasio konstan kuadrat periode terhadap pangkat tiga jarak rata-rata sesuai Hukum Kepler.`;
      socraticQuestion = `Bagaimana perubahan massa bintang induk atau penambahan fraksi materi gelap pada galaksi memengaruhi kecepatan rotasi bintang-bintang di tepi luar lintasan?`;
    }
  } else {
    // Perguruan Tinggi
    if (domain === 'Fisika') {
      analogyHighlight = `Dalam tinjauan mekanika analitik tingkat Perguruan Tinggi (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), dekomposisi gaya non-konservatif, disipasi viskositas fluida, dan persamaan diferensial gerak memisahkan respon transien dari kondisi tunak sistem.`;
      socraticQuestion = `Bagaimana pengaruh koefisien gesek atau redaman viskos terhadap pergeseran kemiringan garis regresi saat Anda mendekati batas kestabilan sistem pada slider?`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Secara termodinamika kesetimbangan kimia dan elektrokimia (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), profil potensial sel dikendalikan oleh persamaan Nernst logaritmik, sementara kapasitas penyangga larutan mengikuti persamaan Henderson-Hasselbalch di sekitar titik infleksi.`;
      socraticQuestion = `Bagaimana perubahan rasio aktivitas ionik atau penambahan katalisator menggeser penghalang energi aktivasi (Ea) tanpa mengubah nilai perubahan energi bebas Gibbs (ΔG)?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Dalam perspektif biofisika sel dan kinetika Michaelis-Menten (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), potensial kimia air (Ψw = Ψs + Ψp) mengendalikan fluks osmosis melintasi membran semipermeabel, sedangkan saturasi sisi aktif enzim menentukan laju reaksi maksimum V_max.`;
      socraticQuestion = `Bagaimana variasi konsentrasi solut hipertonik terhadap tekanan turgor sel atau penentuan nilai Km pada plot Lineweaver-Burk membuktikan afinitas enzim terhadap substratnya?`;
    } else {
      analogyHighlight = `Dalam astrofisika sistemik (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), kurva rotasi datar galaksi mengonfirmasi keberadaan distribusi halo materi gelap isotermal, sementara kedalaman transit fotometrik eksoplanet memberikan rasio penampang geometris (Rp/R*)².`;
      socraticQuestion = `Bagaimana deviasi kecepatan observasi terhadap kurva Keplerian di radius galaktosentrik luar membuktikan keberadaan massa halo materi gelap yang tidak tampak?`;
    }
  }

  return {
    observation,
    dataHighlight: analogyHighlight,
    socraticQuestion,
    detectedTrigger: 'concept-analogy',
    formattedText: `${observation}\n\n${analogyHighlight}\n\n${socraticQuestion}`,
  };
}

// ============================================================================
// FITUR 5: SIMULASI BAHAYA KESELAMATAN (SAFETY HAZARD SIMULATOR)
// ============================================================================

export interface SafetyHazardAlert {
  isHazardous: boolean;
  hazardCode: string | null;
  domain: 'Fisika' | 'Kimia';
  title: string;
  headlineAlert: string;
  scientificExplanation: string;
  mitigationInstruction: string;
  triggerParamSummary: string;
}

export function evaluateSafetyHazard(
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi',
  physicsParams?: PhysicsParams,
  chemistryParams?: ChemistryParams
): SafetyHazardAlert {
  if (domain === 'Kimia' && chemistryParams) {
    const temp =
      chemistryParams.mode === 'reaction-kinetics-arrhenius'
        ? chemistryParams.kineticsTempC ?? chemistryParams.initialTempC
        : chemistryParams.initialTempC;
    const conc = Math.max(
      chemistryParams.reactantConcentration || 0,
      chemistryParams.analyteAcidConc || 0,
      chemistryParams.titrantBaseConc || 0,
      chemistryParams.kineticsConcA || 0
    );
    const hasCatalyst = Boolean(chemistryParams.useCatalyst);

    if (temp > 85 && conc >= 1.8 && !hasCatalyst) {
      return {
        isHazardous: true,
        hazardCode: 'CHEM_THERMAL_RUNAWAY',
        domain: 'Kimia',
        title: 'Peringatan Keselamatan: Reaksi Eksotermik di Luar Kendali!',
        headlineAlert:
          'Peringatan Keselamatan: Reaksi eksotermik di luar kendali! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Anda mencampurkan reaktan berkonsentrasi tinggi ([M] = ${conc.toFixed(2)} mol/L) pada suhu awal ekstrem (${temp}°C > 85°C) tanpa katalis pengendali/pendingin. Menurut persamaan Arrhenius k = A·exp(-Ea/RT), laju pelepasan kalor meningkat secara eksponensial melampaui kapasitas disipasi kalorimeter, yang di laboratorium nyata dapat memicu pendidihan eksplosif (thermal runaway), percikan asam korosif, dan pecahnya wadah kaca borosilikat.`,
        mitigationInstruction:
          'Turunkan suhu awal larutan di bawah 80°C, kurangi konsentrasi molar reaktan (< 1.8 M), atau aktifkan Katalis Pengendali pada panel variabel.',
        triggerParamSummary: `T₀ = ${temp}°C (> 85°C), [M] = ${conc.toFixed(2)} M, Katalis = Nonaktif`,
      };
    }

    if (
      chemistryParams.mode === 'ideal-gas-boyle' &&
      (chemistryParams.gasTemperatureK ?? 300) > 650 &&
      (chemistryParams.gasVolumeL ?? 10) < 3.5
    ) {
      return {
        isHazardous: true,
        hazardCode: 'CHEM_OVERPRESSURE_VESSEL',
        domain: 'Kimia',
        title: 'Peringatan Keselamatan: Tekanan Bejana Gas Melampaui Batas Kritis!',
        headlineAlert:
          'Peringatan Keselamatan: Reaksi eksotermik & tekanan gas di luar kendali! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Pemanasan gas pada suhu ${chemistryParams.gasTemperatureK} K dalam volume sempit (${chemistryParams.gasVolumeL} L) menghasilkan lonjakan tekanan ekstrem sesuai P = nRT/V yang melampaui batas ketahanan katup pengaman silinder kaca.`,
        mitigationInstruction:
          'Perbesar volume ruang gas (V > 4.0 L) atau turunkan temperatur absolut gas.',
        triggerParamSummary: `T = ${chemistryParams.gasTemperatureK} K, V = ${chemistryParams.gasVolumeL} L`,
      };
    }
  }

  if (domain === 'Fisika' && physicsParams) {
    const pendAngle = Math.abs(physicsParams.pendulumAngle ?? 0);
    if (physicsParams.mode === 'pendulum-harmonic' && pendAngle > 80) {
      return {
        isHazardous: true,
        hazardCode: 'PHYS_PENDULUM_EXTREME_ANGLE',
        domain: 'Fisika',
        title: 'Peringatan Keselamatan: Sudut Ayunan Pendulum Melampaui Batas Aman (> 80°)!',
        headlineAlert:
          'Peringatan Keselamatan: Beban & sudut simpangan melampaui batas statif! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Simpangan sudut awal θ = ${pendAngle}° (> 80°) menyebabkan tegangan tali maksimum T_max = m·g·(3 - 2·cos θ₀) di titik terendah melonjak hampir 3 kali lipat berat beban, ditambah hentakan kejut (slack-snap) yang di laboratorium nyata dapat menggulingkan statif penyangga atau memutuskan kawat penggantung.`,
        mitigationInstruction:
          'Turunkan sudut simpangan pendulum ke rentang aman (θ ≤ 75°) agar statif tetap stabil dan aproksimasi harmonik berlaku.',
        triggerParamSummary: `Sudut Ayunan θ = ${pendAngle}° (> 80°), L = ${physicsParams.pendulumLength ?? 1.2} m`,
      };
    }

    const isWireOverload =
      (physicsParams.mass >= 24 && Math.abs(physicsParams.appliedForce) >= 180) ||
      (physicsParams.mode === 'spring-hooke' &&
        Math.abs(physicsParams.springDisplacement) >= 1.8 &&
        physicsParams.springConstantK >= 180);

    if (isWireOverload) {
      return {
        isHazardous: true,
        hazardCode: 'PHYS_WIRE_BREAKING_STRESS',
        domain: 'Fisika',
        title: 'Peringatan Keselamatan: Beban Melampaui Batas Regangan Putus Kawat/Pegas!',
        headlineAlert:
          'Peringatan Keselamatan: Tegangan mekanik melampaui batas elastisitas (Ultimate Tensile Strength)! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Kombinasi beban massa tinggi (${physicsParams.mass} kg) dan gaya tarik/pegas ekstrem menghasilkan tegangan mekanik σ = F/A yang melampaui batas regangan putus (breaking stress) kawat baja laboratorium. Di laboratorium riil, putusnya kawat bertegangan tinggi dapat melontarkan beban logam secara tiba-tiba (whiplash hazard).`,
        mitigationInstruction:
          'Kurangi massa beban (< 22 kg), kecilkan gaya tarik, atau kurangi simpangan pegas di bawah batas elastis Hooke.',
        triggerParamSummary: `m = ${physicsParams.mass} kg, F = ${physicsParams.appliedForce} N, Δx = ${physicsParams.springDisplacement} m`,
      };
    }
  }

  return {
    isHazardous: false,
    hazardCode: null,
    domain: domain === 'Kimia' ? 'Kimia' : 'Fisika',
    title: '',
    headlineAlert: '',
    scientificExplanation: '',
    mitigationInstruction: '',
    triggerParamSummary: '',
  };
}
