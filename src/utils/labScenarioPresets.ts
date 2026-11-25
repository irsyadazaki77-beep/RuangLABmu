import type { PhysicsParams } from './engines/physicsEngine';
import type { ChemistryParams } from './engines/chemistryEngine';
import type { AstronomyParams } from './engines/astronomyEngine';
import type { ExperimentModule } from '../registry/experimentRegistry';
import { getExperimentById } from '../registry/experimentRegistry';

export interface DomainScenarioPreset<TParams = Record<string, unknown>> {
  id: string;
  label: string;
  summary: string;
  patch: Partial<TParams>;
}

export interface AutoSweepPoint<TParams = Record<string, unknown>> {
  stepIndex: number;
  label: string;
  paramKey: string;
  paramLabel: string;
  paramUnit: string;
  xValue: number;
  patch: Partial<TParams>;
}

export function getPhysicsPresetsForMode(
  mode: PhysicsParams['mode']
): DomainScenarioPreset<PhysicsParams>[] {
  switch (mode) {
    case 'newton-incline':
      return [
        {
          id: 'newton-earth-smooth',
          label: 'Bidang Licin Bumi',
          summary: 'θ=20°, μk=0.05, F=40N',
          patch: { inclineAngle: 20, frictionCoeffKinetic: 0.05, frictionCoeffStatic: 0.08, appliedForce: 40, mass: 5, gravity: 9.81 },
        },
        {
          id: 'newton-static-edge',
          label: 'Ambang Gesek Statis',
          summary: 'θ=15°, μs=0.35, F=18N',
          patch: { inclineAngle: 15, frictionCoeffKinetic: 0.25, frictionCoeffStatic: 0.35, appliedForce: 18, mass: 6, gravity: 9.81 },
        },
        {
          id: 'newton-moon-gravity',
          label: 'Gravitasi Bulan',
          summary: 'g=1.62 m/s², θ=25°, F=25N',
          patch: { inclineAngle: 25, frictionCoeffKinetic: 0.12, appliedForce: 25, mass: 5, gravity: 1.62 },
        },
      ];
    case 'projectile-gravity':
      return [
        {
          id: 'proj-optimal-45',
          label: 'Sudut Optimal 45°',
          summary: 'v₀=25 m/s, θ=45°, Bumi',
          patch: { initialVelocity: 25, launchAngle: 45, initialHeight: 0, gravity: 9.81 },
        },
        {
          id: 'proj-mars',
          label: 'Peluncuran di Mars',
          summary: 'g=3.72 m/s², θ=45°, v₀=20 m/s',
          patch: { initialVelocity: 20, launchAngle: 45, initialHeight: 0, gravity: 3.72 },
        },
        {
          id: 'proj-cliff',
          label: 'Tembakan dari Tebing',
          summary: 'y₀=12 m, θ=30°, v₀=18 m/s',
          patch: { initialVelocity: 18, launchAngle: 30, initialHeight: 12, gravity: 9.81 },
        },
      ];
    case 'spring-hooke':
      return [
        {
          id: 'spring-soft',
          label: 'Pegas Lunak',
          summary: 'k=60 N/m, Δx=0.6 m',
          patch: { springConstantK: 60, springDisplacement: 0.6, mass: 2, dampingCoeff: 0.05 },
        },
        {
          id: 'spring-resonance',
          label: 'Resonansi Maksimum',
          summary: 'k=180 N/m, Δx=1.0 m, redaman minim',
          patch: { springConstantK: 180, springDisplacement: 1.0, mass: 3, dampingCoeff: 0.02 },
        },
        {
          id: 'spring-damped',
          label: 'Osilasi Teredam',
          summary: 'k=120 N/m, c=0.65',
          patch: { springConstantK: 120, springDisplacement: 0.9, mass: 4, dampingCoeff: 0.65 },
        },
      ];
    case 'pendulum-harmonic':
      return [
        {
          id: 'pend-short',
          label: 'Ayunan Cepat (0.6 m)',
          summary: 'L=0.6 m, θ₀=15°, g=9.81',
          patch: { pendulumLength: 0.6, pendulumAngle: 15, gravity: 9.81 },
        },
        {
          id: 'pend-standard',
          label: 'Bandul Detik (1.0 m)',
          summary: 'L=1.0 m, θ₀=12°, T≈2.0 s',
          patch: { pendulumLength: 1.0, pendulumAngle: 12, gravity: 9.81 },
        },
        {
          id: 'pend-moon',
          label: 'Bandul di Bulan',
          summary: 'L=1.5 m, g=1.62 m/s²',
          patch: { pendulumLength: 1.5, pendulumAngle: 20, gravity: 1.62 },
        },
      ];
    case 'collision-momentum':
      return [
        {
          id: 'coll-elastic',
          label: 'Lenting Sempurna (e=1)',
          summary: 'm₁=m₂=4 kg, tukar kecepatan',
          patch: { mass: 4, collisionMass2: 4, initialVelocity: 8, velocity2Initial: -2, restitutionCoeff: 1.0 },
        },
        {
          id: 'coll-inelastic',
          label: 'Tidak Lenting (e=0)',
          summary: 'm₁=5 kg menempel ke m₂=3 kg',
          patch: { mass: 5, collisionMass2: 3, initialVelocity: 10, velocity2Initial: 0, restitutionCoeff: 0.0 },
        },
        {
          id: 'coll-heavy',
          label: 'Tumbukan Massa Berat',
          summary: 'm₁=10 kg → m₂=2 kg, e=0.8',
          patch: { mass: 10, collisionMass2: 2, initialVelocity: 6, velocity2Initial: 0, restitutionCoeff: 0.8 },
        },
      ];
    case 'optics-young-slit':
      return [
        {
          id: 'optics-blue',
          label: 'Laser Biru (450 nm)',
          summary: 'Pita interferensi rapat',
          patch: { lightWavelength: 450, slitDistance: 0.25, screenDistance: 1.5 },
        },
        {
          id: 'optics-green',
          label: 'Laser Hijau (532 nm)',
          summary: 'Standar laboratorium optik',
          patch: { lightWavelength: 532, slitDistance: 0.25, screenDistance: 1.5 },
        },
        {
          id: 'optics-red',
          label: 'Laser Merah (650 nm)',
          summary: 'Pita terang lebar',
          patch: { lightWavelength: 650, slitDistance: 0.2, screenDistance: 2.0 },
        },
      ];
    case 'photoelectric-planck':
      return [
        {
          id: 'photo-uv',
          label: 'UV Energi Tinggi (250 nm)',
          summary: 'Logam Natrium (W=2.28 eV)',
          patch: { lightWavelength: 250, targetMetalWorkFunction: 2.28 },
        },
        {
          id: 'photo-threshold',
          label: 'Dekat Ambang (520 nm)',
          summary: 'Uji batas frekuensi ambang',
          patch: { lightWavelength: 520, targetMetalWorkFunction: 2.28 },
        },
        {
          id: 'photo-platinum',
          label: 'Katoda Platina (W=5.1 eV)',
          summary: 'Memerlukan UV dalam (200 nm)',
          patch: { lightWavelength: 200, targetMetalWorkFunction: 5.1 },
        },
      ];
    case 'standing-wave-melde':
      return [
        {
          id: 'melde-h2',
          label: 'Resonansi Harmonik n=2',
          summary: 'm=1.84 kg, L=1.2 m, f=50 Hz',
          patch: { mass: 1.84, stringLength: 1.2, linearMassDensity: 0.005, waveFrequency: 50 },
        },
        {
          id: 'melde-h3',
          label: 'Resonansi Harmonik n=3',
          summary: 'm=0.82 kg, L=1.2 m, f=50 Hz',
          patch: { mass: 0.82, stringLength: 1.2, linearMassDensity: 0.005, waveFrequency: 50 },
        },
        {
          id: 'melde-high-tension',
          label: 'Tegangan Tinggi (Cepat)',
          summary: 'm=6.0 kg, v ≈ 108.5 m/s',
          patch: { mass: 6.0, stringLength: 1.2, linearMassDensity: 0.005, waveFrequency: 45 },
        },
      ];
    default:
      return [
        {
          id: 'phys-low',
          label: 'Konfigurasi Rendah',
          summary: 'Nilai uji awal stabil',
          patch: { mass: 3, appliedForce: 20, fluidViscosity: 0.4, resistorRx: 60, separationDistance: 4 },
        },
        {
          id: 'phys-mid',
          label: 'Standar Laboratorium',
          summary: 'Parameter kalibrasi tengah',
          patch: { mass: 6, appliedForce: 45, fluidViscosity: 0.8, resistorRx: 120, separationDistance: 7 },
        },
        {
          id: 'phys-high',
          label: 'Beban Tinggi',
          summary: 'Uji respons ekstrem aman',
          patch: { mass: 12, appliedForce: 80, fluidViscosity: 1.5, resistorRx: 250, separationDistance: 12 },
        },
      ];
  }
}

export function getChemistryPresetsForMode(
  mode: ChemistryParams['mode']
): DomainScenarioPreset<ChemistryParams>[] {
  switch (mode) {
    case 'acid-base-titration':
      return [
        {
          id: 'chem-titr-acid',
          label: 'Zona Asam Awal',
          summary: 'Vb=5 mL NaOH, pH asam kuat',
          patch: { analyteAcidConc: 0.2, analyteVolumeMl: 25, titrantBaseConc: 0.25, titrantAddedMl: 5, acidPka: 1.0 },
        },
        {
          id: 'chem-titr-eq',
          label: 'Tepat Titik Ekuivalen',
          summary: 'Vb=20.0 mL NaOH, pH ≈ 7.00',
          patch: { analyteAcidConc: 0.2, analyteVolumeMl: 25, titrantBaseConc: 0.25, titrantAddedMl: 20, acidPka: 1.0 },
        },
        {
          id: 'chem-titr-excess',
          label: 'Kelebihan Basa',
          summary: 'Vb=32 mL NaOH, indikator berubah',
          patch: { analyteAcidConc: 0.2, analyteVolumeMl: 25, titrantBaseConc: 0.25, titrantAddedMl: 32, acidPka: 1.0 },
        },
      ];
    case 'electrochemistry-cell':
      return [
        {
          id: 'chem-elec-std',
          label: 'Sel Daniell Standar',
          summary: '[Anoda]=1M, [Katoda]=1M, E°=+1.10V',
          patch: { anodeConcM: 1.0, cathodeConcM: 1.0, initialTempC: 25 },
        },
        {
          id: 'chem-elec-boost',
          label: 'Boost Potensial Nernst',
          summary: '[Katoda]=2.0M, [Anoda]=0.05M',
          patch: { anodeConcM: 0.05, cathodeConcM: 2.0, initialTempC: 25 },
        },
        {
          id: 'chem-elec-depleted',
          label: 'Sel Hampir Habis',
          summary: '[Katoda]=0.02M, [Anoda]=1.8M',
          patch: { anodeConcM: 1.8, cathodeConcM: 0.02, initialTempC: 45 },
        },
      ];
    case 'ideal-gas-boyle':
      return [
        {
          id: 'chem-gas-compressed',
          label: 'Kompresi Tekanan Tinggi',
          summary: 'V=4 L, T=300 K',
          patch: { gasVolumeL: 4, initialTempC: 27, gasMoles: 1.0 },
        },
        {
          id: 'chem-gas-stp',
          label: 'Kondisi Standar (10 L)',
          summary: 'V=10 L, T=298 K',
          patch: { gasVolumeL: 10, initialTempC: 25, gasMoles: 1.0 },
        },
        {
          id: 'chem-gas-expanded',
          label: 'Ekspansi Termal',
          summary: 'V=20 L, T=350 K',
          patch: { gasVolumeL: 20, initialTempC: 77, gasMoles: 1.0 },
        },
      ];
    case 'chemical-equilibrium-lechatelier':
      return [
        {
          id: 'lech-cold-ice',
          label: 'Penangas Es (5°C)',
          summary: 'Bergeser ke N₂O₄ tak berwarna',
          patch: { equilibriumTempC: 5, initialTempC: 5, equilibriumPressureAtm: 1.0, pressureAtm: 1.0 },
        },
        {
          id: 'lech-room-std',
          label: 'Suhu Kamar (25°C, 1 atm)',
          summary: 'Campuran setimbang N₂O₄ ⇌ 2 NO₂',
          patch: { equilibriumTempC: 25, initialTempC: 25, equilibriumPressureAtm: 1.0, pressureAtm: 1.0 },
        },
        {
          id: 'lech-hot-no2',
          label: 'Penangas Panas (80°C)',
          summary: 'Dominan gas NO₂ cokelat pekat',
          patch: { equilibriumTempC: 80, initialTempC: 80, equilibriumPressureAtm: 0.8, pressureAtm: 0.8 },
        },
      ];
    default:
      return [
        {
          id: 'chem-thermo-room',
          label: 'Suhu Ruang (25°C)',
          summary: 'Tanpa katalis, 1.0 M',
          patch: { initialTempC: 25, kineticsTempC: 25, reactantConcentration: 1.0, useCatalyst: false },
        },
        {
          id: 'chem-thermo-cat',
          label: 'Katalis Aktif (45°C)',
          summary: 'Energi aktivasi turun drastis',
          patch: { initialTempC: 45, kineticsTempC: 45, reactantConcentration: 1.5, useCatalyst: true },
        },
        {
          id: 'chem-thermo-fast',
          label: 'Reaksi Cepat (70°C)',
          summary: 'Konsentrasi tinggi 2.0 M',
          patch: { initialTempC: 70, kineticsTempC: 70, reactantConcentration: 2.0, useCatalyst: true },
        },
      ];
  }
}

export function getAstronomyPresetsForMode(
  mode: AstronomyParams['mode']
): DomainScenarioPreset<AstronomyParams>[] {
  switch (mode) {
    case 'solar-kepler':
      return [
        {
          id: 'astro-earth-orbit',
          label: 'Orbit Bumi (1.0 AU)',
          summary: 'a=1.0 AU, e=0.02, T=1.0 thn',
          patch: { customSemiMajorAxisAu: 1.0, customEccentricity: 0.02, centralStarMassSolar: 1.0 },
        },
        {
          id: 'astro-mars-ecc',
          label: 'Orbit Elips Mars',
          summary: 'a=1.52 AU, e=0.09',
          patch: { customSemiMajorAxisAu: 1.52, customEccentricity: 0.09, centralStarMassSolar: 1.0 },
        },
        {
          id: 'astro-comet',
          label: 'Komet Eksentrik',
          summary: 'a=4.0 AU, e=0.65 (Hukum II Kepler)',
          patch: { customSemiMajorAxisAu: 4.0, customEccentricity: 0.65, centralStarMassSolar: 1.0 },
        },
      ];
    case 'milkyway-galaxy':
      return [
        {
          id: 'astro-mw-kepler',
          label: 'Tanpa Materi Gelap',
          summary: 'DM=0×, rotasi Keplerian turun',
          patch: { darkMatterHaloFraction: 0.0, galactocentricRadiusKpc: 15 },
        },
        {
          id: 'astro-mw-solar',
          label: 'Radius Matahari (8.2 kpc)',
          summary: 'DM=1.0×, v ≈ 220 km/s',
          patch: { darkMatterHaloFraction: 1.0, galactocentricRadiusKpc: 8.2 },
        },
        {
          id: 'astro-mw-outer',
          label: 'Halo Luar Galaksi (22 kpc)',
          summary: 'DM=1.2×, kurva rotasi datar',
          patch: { darkMatterHaloFraction: 1.2, galactocentricRadiusKpc: 22 },
        },
      ];
    case 'stellar-exoplanet':
      return [
        {
          id: 'astro-exo-earth',
          label: 'Kembaran Bumi (1 R⊕)',
          summary: 'Transit dangkal, zona laik huni',
          patch: { exoplanetRadiusEarth: 1.0, starRadiusSolar: 1.0, exoplanetOrbitAu: 1.0 },
        },
        {
          id: 'astro-exo-superearth',
          label: 'Bumi Super (3 R⊕)',
          summary: 'Sinyal transit jelas di bintang K',
          patch: { exoplanetRadiusEarth: 3.0, starRadiusSolar: 0.8, exoplanetOrbitAu: 0.6 },
        },
        {
          id: 'astro-exo-hotjupiter',
          label: 'Hot Jupiter (11 R⊕)',
          summary: 'Kedalaman transit > 1%',
          patch: { exoplanetRadiusEarth: 11.0, starRadiusSolar: 1.0, exoplanetOrbitAu: 0.15 },
        },
      ];
    case 'stellar-wien-spectrum':
      return [
        {
          id: 'astro-wien-red',
          label: 'Katai Merah (3.500 K)',
          summary: 'Puncak inframerah-merah',
          patch: { starEffectiveTempK: 3500 },
        },
        {
          id: 'astro-wien-sun',
          label: 'Bintang Matahari (5.778 K)',
          summary: 'Kelas G2V, λmax ≈ 502 nm',
          patch: { starEffectiveTempK: 5778 },
        },
        {
          id: 'astro-wien-blue',
          label: 'Raksasa Biru (14.000 K)',
          summary: 'Puncak ultraviolet-biru',
          patch: { starEffectiveTempK: 14000 },
        },
      ];
    case 'hubble-expansion':
      return [
        {
          id: 'astro-hub-virgo',
          label: 'Gugus Virgo (20 Mpc)',
          summary: 'Pergeseran merah lokal',
          patch: { galaxyDistanceMpc: 20, hubbleConstantH0: 70 },
        },
        {
          id: 'astro-hub-coma',
          label: 'Gugus Coma (100 Mpc)',
          summary: 'v ≈ 7.000 km/s',
          patch: { galaxyDistanceMpc: 100, hubbleConstantH0: 70 },
        },
        {
          id: 'astro-hub-deep',
          label: 'Galaksi Jauh (450 Mpc)',
          summary: 'Redshift kosmologis kuat',
          patch: { galaxyDistanceMpc: 450, hubbleConstantH0: 70 },
        },
      ];
    case 'planetary-atmosphere-greenhouse':
      return [
        {
          id: 'astro-ghg-iceage',
          label: 'Bumi Zaman Es (180 ppm)',
          summary: 'A=0.45, CO₂=180 ppm, dingin',
          patch: { planetaryAlbedo: 0.45, greenhouseGasPpm: 180, stellarFluxFactor: 1.0 },
        },
        {
          id: 'astro-ghg-earth',
          label: 'Bumi Modern (420 ppm)',
          summary: 'A=0.30, CO₂=420 ppm, Ts ≈ 15°C',
          patch: { planetaryAlbedo: 0.30, greenhouseGasPpm: 420, stellarFluxFactor: 1.0 },
        },
        {
          id: 'astro-ghg-extreme',
          label: 'Rumah Kaca Ekstrem (2000 ppm)',
          summary: 'A=0.20, CO₂=2000 ppm, es mencair',
          patch: { planetaryAlbedo: 0.20, greenhouseGasPpm: 2000, stellarFluxFactor: 1.1 },
        },
      ];
  }
}

export function getBiologyPresetsForModule(
  mod: ExperimentModule
): DomainScenarioPreset<Record<string, number>>[] {
  const p0 = mod.parameters[0];
  if (!p0) return [];
  const defaults: Record<string, number> = {};
  for (const p of mod.parameters) {
    defaults[p.key] = p.defaultValue;
  }

  const span = p0.max - p0.min;
  const dec = p0.step < 1 ? 2 : 0;
  const round = (v: number) => Number(v.toFixed(dec));
  const lowVal = round(p0.min + span * 0.2);
  const optVal = round(p0.defaultValue);
  const highVal = round(p0.min + span * 0.85);

  return [
    {
      id: `${mod.id}-bio-low`,
      label: `${p0.label.split(' ')[0]} Rendah`,
      summary: `${p0.label} = ${lowVal} ${p0.unit}`,
      patch: { ...defaults, [p0.key]: lowVal },
    },
    {
      id: `${mod.id}-bio-opt`,
      label: 'Kondisi Optimum',
      summary: `${p0.label} = ${optVal} ${p0.unit}`,
      patch: { ...defaults, [p0.key]: optVal },
    },
    {
      id: `${mod.id}-bio-high`,
      label: `${p0.label.split(' ')[0]} Tinggi`,
      summary: `${p0.label} = ${highVal} ${p0.unit}`,
      patch: { ...defaults, [p0.key]: highVal },
    },
  ];
}

/**
 * Generates 5 evenly spaced Auto-Sweep steps for any domain/mode so students can
 * acquire a clean 5-point regression dataset with one click in Stage 2.
 */
export function generateAutoSweepSeries(
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi',
  modeOrModuleId: string,
  count: number = 5
): AutoSweepPoint<Record<string, number>>[] {
  const n = Math.max(3, Math.min(8, Math.floor(count)));

  // Domain-specific exact parameter keys matching the live React state objects
  const physicsMap: Record<string, { key: string; label: string; unit: string; min: number; max: number; dec: number }> = {
    'newton-incline': { key: 'appliedForce', label: 'Gaya Dorong F', unit: 'N', min: 20, max: 100, dec: 0 },
    'projectile-gravity': { key: 'initialVelocity', label: 'Kecepatan Awal v₀', unit: 'm/s', min: 10, max: 38, dec: 0 },
    'spring-hooke': { key: 'springDisplacement', label: 'Simpangan Δx', unit: 'm', min: 0.2, max: 1.0, dec: 2 },
    'pendulum-harmonic': { key: 'pendulumLength', label: 'Panjang Tali L', unit: 'm', min: 0.4, max: 2.0, dec: 2 },
    'collision-momentum': { key: 'initialVelocity', label: 'Kecepatan v₁', unit: 'm/s', min: 4, max: 20, dec: 1 },
    'stokes-viscosity': { key: 'sphereRadius', label: 'Jari-jari Bola r', unit: 'mm', min: 2, max: 10, dec: 1 },
    'ohm-wheatstone': { key: 'resistorRx', label: 'Hambatan Rx', unit: 'Ω', min: 40, max: 280, dec: 0 },
    'optics-young-slit': { key: 'lightWavelength', label: 'Panjang Gelombang λ', unit: 'nm', min: 420, max: 660, dec: 0 },
    'photoelectric-planck': { key: 'lightWavelength', label: 'Panjang Gelombang λ', unit: 'nm', min: 200, max: 440, dec: 0 },
    'orbital-gravity': { key: 'separationDistance', label: 'Jarak Pisah r', unit: 'm', min: 3, max: 15, dec: 1 },
    'standing-wave-melde': { key: 'mass', label: 'Massa Beban m', unit: 'kg', min: 1.0, max: 7.0, dec: 1 },
  };

  const chemistryMap: Record<string, { key: string; label: string; unit: string; min: number; max: number; dec: number }> = {
    'acid-base-titration': { key: 'titrantAddedMl', label: 'Volume Titran NaOH', unit: 'mL', min: 5, max: 35, dec: 1 },
    'thermo-calorimetry': { key: 'initialTempC', label: 'Suhu Awal T', unit: '°C', min: 20, max: 80, dec: 0 },
    'reaction-kinetics-arrhenius': { key: 'kineticsTempC', label: 'Suhu Reaksi T', unit: '°C', min: 25, max: 85, dec: 0 },
    'ideal-gas-boyle': { key: 'gasVolumeL', label: 'Volume Gas V', unit: 'L', min: 4, max: 20, dec: 1 },
    'electrochemistry-cell': { key: 'cathodeConcM', label: 'Konsentrasi Katoda', unit: 'M', min: 0.1, max: 2.0, dec: 2 },
    'spectrophotometry-beer': { key: 'spectroConcMm', label: 'Konsentrasi Sampel', unit: 'mM', min: 0.04, max: 0.24, dec: 2 },
    'chemical-equilibrium-lechatelier': { key: 'equilibriumTempC', label: 'Suhu Reaktor T', unit: '°C', min: 10, max: 90, dec: 0 },
  };

  const astronomyMap: Record<string, { key: string; label: string; unit: string; min: number; max: number; dec: number }> = {
    'solar-kepler': { key: 'customSemiMajorAxisAu', label: 'Sumbu Semi-Mayor a', unit: 'AU', min: 0.5, max: 4.5, dec: 2 },
    'milkyway-galaxy': { key: 'galactocentricRadiusKpc', label: 'Radius Galaktik R', unit: 'kpc', min: 4, max: 24, dec: 1 },
    'stellar-exoplanet': { key: 'exoplanetRadiusEarth', label: 'Radius Eksoplanet Rp', unit: 'R⊕', min: 1, max: 11, dec: 1 },
    'stellar-wien-spectrum': { key: 'starEffectiveTempK', label: 'Suhu Efektif T*', unit: 'K', min: 3500, max: 13500, dec: 0 },
    'hubble-expansion': { key: 'galaxyDistanceMpc', label: 'Jarak Galaksi d', unit: 'Mpc', min: 50, max: 450, dec: 0 },
    'planetary-atmosphere-greenhouse': { key: 'greenhouseGasPpm', label: 'Konsentrasi CO₂', unit: 'ppm', min: 200, max: 1800, dec: 0 },
  };

  let spec: { key: string; label: string; unit: string; min: number; max: number; dec: number } | undefined;

  if (domain === 'Fisika') spec = physicsMap[modeOrModuleId];
  else if (domain === 'Kimia') spec = chemistryMap[modeOrModuleId];
  else if (domain === 'Astronomi') spec = astronomyMap[modeOrModuleId];
  else {
    const bioMod = getExperimentById(modeOrModuleId);
    const p0 = bioMod?.parameters[0];
    if (p0) {
      const span = p0.max - p0.min;
      spec = {
        key: p0.key,
        label: p0.label,
        unit: p0.unit,
        min: p0.min + span * 0.15,
        max: p0.min + span * 0.85,
        dec: p0.step < 1 ? 2 : 0,
      };
    }
  }

  if (!spec) {
    spec = { key: 'appliedForce', label: 'Parameter Uji', unit: '', min: 10, max: 50, dec: 0 };
  }

  const series: AutoSweepPoint<Record<string, number>>[] = [];
  for (let i = 0; i < n; i++) {
    const ratio = n === 1 ? 0.5 : i / (n - 1);
    const val = Number((spec.min + ratio * (spec.max - spec.min)).toFixed(spec.dec));
    const patch: Record<string, number> = { [spec.key]: val };
    // Sync paired temperature field for chemistry kinetics/thermo
    if (spec.key === 'kineticsTempC') patch.initialTempC = val;
    if (spec.key === 'initialTempC') patch.kineticsTempC = val;

    series.push({
      stepIndex: i + 1,
      label: `Sweep ${i + 1}/${n} (${spec.label} = ${val}${spec.unit ? ` ${spec.unit}` : ''})`,
      paramKey: spec.key,
      paramLabel: spec.label,
      paramUnit: spec.unit,
      xValue: val,
      patch,
    });
  }

  return series;
}
