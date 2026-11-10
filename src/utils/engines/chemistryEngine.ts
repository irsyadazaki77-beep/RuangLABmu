export type ChemistryMode =
  | 'thermo-calorimetry'
  | 'acid-base-titration'
  | 'electrochemistry-cell'
  | 'ideal-gas-boyle'
  | 'reaction-kinetics-arrhenius'
  | 'spectrophotometry-beer';

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
    absorbedColorName: params.spectroWavelengthNm
      ? params.spectroWavelengthNm < 450
        ? 'Violet/Biru'
        : params.spectroWavelengthNm < 520
        ? 'Sian/Hijau'
        : params.spectroWavelengthNm < 590
        ? 'Kuning'
        : 'Jingga/Merah'
      : 'Sian/Biru (480-520 nm)',
  };
}
