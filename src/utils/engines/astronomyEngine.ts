export type AstronomyMode =
  | 'solar-kepler'
  | 'milkyway-galaxy'
  | 'stellar-exoplanet'
  | 'stellar-wien-spectrum'
  | 'hubble-expansion';

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

function finiteAstroOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeAstroRound(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

export function calculateAstronomyMetrics(
  params: AstronomyParams
): AstronomyMetrics {
  // 1. Solar System & Kepler Orbit Calculations
  const a = Math.max(finiteAstroOr(params.customSemiMajorAxisAu, 1.0), 1e-6);
  const e = Math.max(0, Math.min(0.95, finiteAstroOr(params.customEccentricity, 0.017)));
  const mStar = Math.max(finiteAstroOr(params.centralStarMassSolar, 1.0), 1e-6);

  const aCubed = Math.max(a * a * a, 1e-6);
  const orbitalPeriodYears = Math.sqrt(Math.max(aCubed / mStar, 1e-6));
  const perihelionAu = a * (1 - e);
  const aphelionAu = a * (1 + e);

  // Earth mean orbital velocity is 29.78 km/s at a = 1 AU, M = 1 M_sun
  const meanOrbitalVelocityKms = 29.78 * Math.sqrt(Math.max(mStar / a, 1e-6));
  const oneMinusE = Math.max(1 - e, 1e-6);
  const onePlusE = Math.max(1 + e, 1e-6);
  const perihelionVelocityKms =
    meanOrbitalVelocityKms * Math.sqrt(Math.max(onePlusE / oneMinusE, 1e-6));
  const aphelionVelocityKms =
    meanOrbitalVelocityKms * Math.sqrt(Math.max(oneMinusE / onePlusE, 1e-6));
  const keplerRatioT2OverA3 =
    (orbitalPeriodYears * orbitalPeriodYears) / aCubed;

  // 2. Milky Way Galaxy Rotation Curve & Sgr A* Calculations
  const rKpc = Math.max(finiteAstroOr(params.galactocentricRadiusKpc, 8.2), 1e-6);
  const bulgeDiskFactor = Math.max(finiteAstroOr(params.bulgeDiskMassFactor, 1.0), 1e-6);
  const dmFraction = Math.max(0, finiteAstroOr(params.darkMatterHaloFraction, 1.0));
  const sgrAMassMillion = Math.max(finiteAstroOr(params.sgrAStarMassMillionSolar, 4.15), 1e-6);

  // Luminous bulge + disk mass profile (rises up to ~3.5 kpc then falls as r^-1/2)
  const bulgeRadiusScale = 2.2;
  const bulgeDenom = Math.max(
    Math.pow(rKpc * rKpc + bulgeRadiusScale * bulgeRadiusScale, 0.75),
    1e-6
  );
  const luminousVelocitySq =
    bulgeDiskFactor *
    ((235 * 235 * rKpc) / bulgeDenom) *
    (3.2 / Math.max(2.5, rKpc));
  const keplerianVelocityKms = Math.sqrt(Math.max(400, luminousVelocitySq));

  // Isothermal Dark Matter Halo contribution maintains ~220-238 km/s flat curve at large R
  const haloAsymptoticV = 215 * Math.sqrt(Math.max(0, dmFraction));
  const dmVelocitySq =
    haloAsymptoticV *
    haloAsymptoticV *
    (1 - (2.5 / Math.max(0.5, rKpc)) * Math.atan(rKpc / 2.5));
  const observedDarkMatterVelocityKms = Math.max(
    Math.sqrt(
      Math.max(
        keplerianVelocityKms * keplerianVelocityKms + Math.max(0, dmVelocitySq),
        1e-6
      )
    ),
    1e-6
  );
  const velocityAnomalyKms = Math.max(
    0,
    observedDarkMatterVelocityKms - keplerianVelocityKms
  );

  // T_gal (Myr): 1 kpc = 3.086e16 km, 1 Myr = 3.154e13 s => T(Myr) ≈ 977.8 * (2*pi*R_kpc) / v_kms
  const galacticOrbitalPeriodMyr =
    (977.8 * 2 * Math.PI * rKpc) / Math.max(observedDarkMatterVelocityKms, 1e-6);

  // Enclosed Mass M(<R) = v^2 * R / G (in units of 10^9 M_sun, G ≈ 4.301e-6 kpc (km/s)^2 / M_sun)
  const enclosedMassBillionSolar =
    (observedDarkMatterVelocityKms * observedDarkMatterVelocityKms * rKpc) /
    Math.max(4.301e-6 * 1e9, 1e-6);

  // Schwarzschild radius R_s = 2.95 km * (M / M_sun)
  const sgrASchwarzschildRadiusMillionKm =
    (2.95 * sgrAMassMillion * 1e6) / 1e6;

  // 3. Stellar H-R Diagram & Exoplanet Transit Photometry
  const tEff = Math.max(finiteAstroOr(params.starEffectiveTempK, 5778), 1e-6);
  const rStar = Math.max(finiteAstroOr(params.starRadiusSolar, 1.0), 1e-6);
  const rPlanetEarth = Math.max(finiteAstroOr(params.exoplanetRadiusEarth, 1.0), 1e-6);
  const dPlanetAu = Math.max(finiteAstroOr(params.exoplanetOrbitAu, 1.0), 1e-6);

  // Stefan-Boltzmann L/L_sun = (R/R_sun)^2 * (T/5778)^4
  const stellarLuminositySolar = Math.max(
    rStar * rStar * Math.pow(tEff / 5778, 4),
    1e-6
  );

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
    10 * Math.pow(Math.max(stellarLuminositySolar, 1e-6), -0.65)
  );

  // Transit depth: R_sun = 109.1 R_earth => (Rp / R*) = (rPlanetEarth) / (109.1 * rStar)
  const radiusRatio = rPlanetEarth / Math.max(109.1 * rStar, 1e-6);
  const transitDepthPct = Math.min(25, radiusRatio * radiusRatio * 100);
  const transitDepthPpm = Math.round(transitDepthPct * 10000);

  const habitableZoneInnerAu = Math.sqrt(Math.max(stellarLuminositySolar / 1.1, 1e-6));
  const habitableZoneOuterAu = Math.sqrt(Math.max(stellarLuminositySolar / 0.53, 1e-6));
  const isInHabitableZone =
    dPlanetAu >= habitableZoneInnerAu && dPlanetAu <= habitableZoneOuterAu;

  // Advanced astronomy modules
  const tWienK = Math.max(finiteAstroOr(params.starEffectiveTempK, 5800), 1e-6);
  const wienPeakWavelengthNm = 2.89777e6 / Math.max(tWienK, 1e-6);

  const dHubbleMpc = Math.max(finiteAstroOr(params.galaxyDistanceMpc, 150), 1e-6);
  const h0Hubble = Math.max(finiteAstroOr(params.hubbleConstantH0, 70), 1e-6);
  const hubbleRecessionVelocityKmS = h0Hubble * dHubbleMpc;
  const hubbleRedshiftZ = hubbleRecessionVelocityKmS / 299792;
  const restLambdaNm = Math.max(finiteAstroOr(params.restWavelengthNm, 393.4), 1e-6);
  const hubbleObservedWavelengthNm = restLambdaNm * (1 + hubbleRedshiftZ);
  const rawSurfaceFlux = 5.670374e-8 * Math.pow(tWienK, 4);

  return {
    orbitalPeriodYears: safeAstroRound(orbitalPeriodYears, 3),
    perihelionAu: safeAstroRound(perihelionAu, 3),
    aphelionAu: safeAstroRound(aphelionAu, 3),
    meanOrbitalVelocityKms: safeAstroRound(meanOrbitalVelocityKms, 2),
    perihelionVelocityKms: safeAstroRound(perihelionVelocityKms, 2),
    aphelionVelocityKms: safeAstroRound(aphelionVelocityKms, 2),
    keplerRatioT2OverA3: safeAstroRound(keplerRatioT2OverA3, 3),
    keplerianVelocityKms: safeAstroRound(keplerianVelocityKms, 1),
    observedDarkMatterVelocityKms: safeAstroRound(
      observedDarkMatterVelocityKms,
      1
    ),
    velocityAnomalyKms: safeAstroRound(velocityAnomalyKms, 1),
    galacticOrbitalPeriodMyr: safeAstroRound(galacticOrbitalPeriodMyr, 1),
    enclosedMassBillionSolar: safeAstroRound(enclosedMassBillionSolar, 2),
    sgrASchwarzschildRadiusMillionKm: safeAstroRound(
      sgrASchwarzschildRadiusMillionKm,
      2
    ),
    spectralClass,
    starColorHex,
    stellarLuminositySolar: safeAstroRound(stellarLuminositySolar, 3),
    mainSequenceLifetimeGyr: safeAstroRound(mainSequenceLifetimeGyr, 2),
    transitDepthPct: safeAstroRound(transitDepthPct, 4),
    transitDepthPpm,
    habitableZoneInnerAu: safeAstroRound(habitableZoneInnerAu, 2),
    habitableZoneOuterAu: safeAstroRound(habitableZoneOuterAu, 2),
    isInHabitableZone,
    wienPeakWavelengthNm: safeAstroRound(wienPeakWavelengthNm, 1),
    peakWavelengthNm: safeAstroRound(wienPeakWavelengthNm, 1),
    surfaceFluxWPerM2: Number.isFinite(rawSurfaceFlux)
      ? Number(rawSurfaceFlux.toPrecision(4))
      : 0,
    hubbleRecessionVelocityKmS: safeAstroRound(hubbleRecessionVelocityKmS, 1),
    recessionVelocityKms: safeAstroRound(hubbleRecessionVelocityKmS, 1),
    hubbleRedshiftZ: safeAstroRound(hubbleRedshiftZ, 4),
    redshiftZ: safeAstroRound(hubbleRedshiftZ, 4),
    hubbleObservedWavelengthNm: safeAstroRound(hubbleObservedWavelengthNm, 2),
    hubbleAgeBillionYears: safeAstroRound(977.8 / Math.max(h0Hubble, 1e-6), 1),
  };
}

