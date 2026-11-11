export type BiologyMode =
  | 'photosynthesis-ingenhousz'
  | 'enzyme-kinetics'
  | 'enzyme-catalase'
  | 'predator-prey-dynamics'
  | 'cell-osmosis-tonicity'
  | 'osmosis-plasmolysis'
  | 'anatomy-cardiovascular-heart'
  | 'anatomy-respiratory-lungs'
  | 'anatomy-neural-synapse';

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

export interface CardiovascularHeartParams {
  heartRateBpm: number; // 40 - 200 bpm
  vesselRadiusRatio: number; // 0.4 - 1.2 (vasokonstriksi / plak aterosklerosis)
  bloodViscosity: number; // 1.0 - 5.0 cP (normal ~3.5 cP)
  exerciseIntensity: number; // 0 - 100 %
  timeSec?: number; // t in seconds for real-time ECG P-Q-R-S-T
}

export interface CardiovascularHeartMetrics {
  strokeVolumeMl: number; // SV (mL/detak)
  cardiacOutputLMin: number; // CO = (HR * SV) / 1000 (L/menit)
  vascularResistance: number; // Hukum Poiseuille R ~ eta / r^4 (PRU relatif)
  systolicMmHg: number; // Tekanan darah sistolik (mmHg)
  diastolicMmHg: number; // Tekanan darah diastolik (mmHg)
  meanArterialPressure: number; // MAP = DBP + 1/3 (SBP - DBP) (mmHg)
  pulsePressureMmHg: number; // SBP - DBP (mmHg)
  ecgVoltageMv: number; // Gelombang P-Q-R-S-T real-time pada waktu t (mV)
}

export interface RespiratoryLungsParams {
  respirationRate: number; // 6 - 40 napas/menit
  diaphragmEffort: number; // 20 - 100 %
  airwayResistance: number; // 1.0 - 4.0 (bronkokonstriksi / asma)
  altitudeMeters: number; // 0 - 8000 mdpl
  timeSec?: number; // t in seconds for breathing cycle
}

export interface RespiratoryLungsMetrics {
  tidalVolumeMl: number; // TV (mL)
  minuteVentilationLMin: number; // V_E = (RR * TV) / 1000 (L/menit)
  barometricPressureMmHg: number; // P_B sesuai ketinggian mdpl (mmHg)
  alveolarPo2MmHg: number; // P_AO2 tekanan parsial oksigen alveolus (mmHg)
  spo2Percent: number; // Saturasi O2 kurva disosiasi Hill (%)
  instantLungVolumeMl: number; // Volume paru sesaat V(t) (mL)
}

export interface NeuralSynapseParams {
  stimulusVoltageMv: number; // -70 s.d. +50 mV
  myelinThickness: number; // 0 - 100 %
  extracellularNaMm: number; // 50 - 200 mM (normal ~145 mM)
  extracellularKMm: number; // 2 - 15 mM (normal ~4.5 mM)
  timeSec?: number; // t in seconds for membrane potential trace V_m(t)
}

export interface NeuralSynapseMetrics {
  nernstNaMv: number; // E_Na (mV)
  nernstKMv: number; // E_K (mV)
  restingPotentialMv: number; // V_rest Goldman-Hodgkin-Katz (mV)
  thresholdMv: number; // Ambang batas All-or-None (-55 mV)
  actionPotentialTriggered: boolean; // true jika stimulus >= -55 mV
  allOrNoneStatus: 'Potensial Aksi Terpicu (All-or-None)' | 'Gagal Mencapai Ambang (Sub-Threshold)';
  conductionVelocityMs: number; // Kecepatan rambat impuls akson (m/s)
  membranePotentialMv: number; // Kurva V_m(t) Depolarisasi -> Repolarisasi -> Refrakter (mV)
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
  // Anatomy 1: Cardiovascular & Heart Hemodynamics
  heartRateBpm?: number;
  vesselRadiusRatio?: number;
  bloodViscosity?: number;
  exerciseIntensity?: number;
  // Anatomy 2: Respiratory & Lungs Spirometry
  respirationRate?: number;
  diaphragmEffort?: number;
  airwayResistance?: number;
  altitudeMeters?: number;
  // Anatomy 3: Neural Action Potential & Synapse
  stimulusVoltageMv?: number;
  myelinThickness?: number;
  extracellularNaMm?: number;
  extracellularKMm?: number;
  timeSec?: number;
}

export interface BiologyMetrics {
  enzymeKinetics: EnzymeKineticsMetrics;
  predatorPrey: LotkaVolterraMetrics;
  cellOsmosis: CellOsmosisMetrics;
  cardiovascularHeart: CardiovascularHeartMetrics;
  respiratoryLungs: RespiratoryLungsMetrics;
  neuralSynapse: NeuralSynapseMetrics;
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

/**
 * 4. Kardiovaskular & Hemodinamika Jantung (anatomy-cardiovascular-heart):
 * Menghitung gelombang P-Q-R-S-T periodik real-time pada waktu t (detik)
 */
export function evaluateEcgWaveformMv(timeSec: number, heartRateBpm: number): number {
  const hr = Math.max(40, Math.min(200, heartRateBpm));
  const cyclePeriod = 60.0 / hr;
  const phase = (((timeSec % cyclePeriod) + cyclePeriod) % cyclePeriod) / cyclePeriod;

  // Komponen Gaussian untuk gelombang P, Q, R, S, T
  const gauss = (center: number, width: number, amp: number) =>
    amp * Math.exp(-Math.pow((phase - center) / width, 2));

  const pWave = gauss(0.16, 0.035, 0.18);
  const qWave = gauss(0.27, 0.012, -0.15);
  const rWave = gauss(0.30, 0.015, 1.20);
  const sWave = gauss(0.33, 0.014, -0.28);
  const tWave = gauss(0.52, 0.055, 0.30);

  return Number((pWave + qWave + rWave + sWave + tWave).toFixed(4));
}

export function calculateCardiovascularHeart(
  params: CardiovascularHeartParams
): CardiovascularHeartMetrics {
  const hr = Math.max(40, Math.min(200, params.heartRateBpm));
  const rRatio = Math.max(0.4, Math.min(1.2, params.vesselRadiusRatio));
  const viscosity = Math.max(1.0, Math.min(5.0, params.bloodViscosity));
  const exercise = Math.max(0, Math.min(100, params.exerciseIntensity));
  const t = params.timeSec ?? 0;

  // Hukum Poiseuille: R sebanding dengan eta / r^4 (dinormalisasi pada eta_0 = 3.5 cP, r_0 = 1.0)
  const vascularResistance = (viscosity / 3.5) / Math.pow(rRatio, 4);

  // Stroke Volume (SV) dari kontraktilitas simpatis & waktu pengisian diastolik Frank-Starling
  const contractilityFactor = 1.0 + 0.45 * (exercise / 100.0);
  const fillingFactor = hr <= 130 ? 1.0 : Math.max(0.55, 1.0 - (hr - 130) * 0.006);
  const afterloadPenalty = 1.0 / (1.0 + 0.045 * Math.max(0, vascularResistance - 1.0));
  const strokeVolumeMl = Math.max(
    25.0,
    Math.min(135.0, 70.0 * contractilityFactor * fillingFactor * afterloadPenalty)
  );

  // Curah Jantung (Cardiac Output): CO = (HR * SV) / 1000 (L/menit)
  const cardiacOutputLMin = (hr * strokeVolumeMl) / 1000.0;

  // Tekanan Arteri Rata-Rata (MAP) & Tekanan Sistolik / Diastolik
  const effectiveResistance = Math.pow(vascularResistance, 0.55);
  const meanArterialPressure = 40.0 + cardiacOutputLMin * 10.5 * effectiveResistance;
  const pulsePressureMmHg = 40.0 * (strokeVolumeMl / 70.0) * Math.pow(1.0 / rRatio, 0.45);
  const diastolicMmHg = Math.max(40.0, meanArterialPressure - pulsePressureMmHg / 3.0);
  const systolicMmHg = diastolicMmHg + pulsePressureMmHg;

  const ecgVoltageMv = evaluateEcgWaveformMv(t, hr);

  return {
    strokeVolumeMl: Number(strokeVolumeMl.toFixed(2)),
    cardiacOutputLMin: Number(cardiacOutputLMin.toFixed(2)),
    vascularResistance: Number(vascularResistance.toFixed(3)),
    systolicMmHg: Number(systolicMmHg.toFixed(1)),
    diastolicMmHg: Number(diastolicMmHg.toFixed(1)),
    meanArterialPressure: Number(meanArterialPressure.toFixed(1)),
    pulsePressureMmHg: Number(pulsePressureMmHg.toFixed(1)),
    ecgVoltageMv,
  };
}

/**
 * 5. Mekanika Respirasi & Spirometri Paru-Paru (anatomy-respiratory-lungs):
 * Menghitung Volume Tidal (TV), Ventilasi Semenit (V_E), P_AO2 Barometrik,
 * dan Saturasi Oksigen Darah (SpO2) menggunakan persamaan disosiasi Hill.
 */
export function calculateRespiratoryLungs(
  params: RespiratoryLungsParams
): RespiratoryLungsMetrics {
  const rr = Math.max(6, Math.min(40, params.respirationRate));
  const effort = Math.max(20, Math.min(100, params.diaphragmEffort));
  const rAirway = Math.max(1.0, Math.min(4.0, params.airwayResistance));
  const alt = Math.max(0, Math.min(8000, params.altitudeMeters));
  const t = params.timeSec ?? 0;

  // Volume Tidal (TV): usaha diafragma 50% & resistensi normal 1.0 menghasilkan 500 mL
  const tidalVolumeMl = Math.max(
    120.0,
    Math.min(1200.0, (1000.0 * (effort / 100.0)) / Math.pow(rAirway, 0.7))
  );

  // Ventilasi Semenit: V_E = RR * TV / 1000 (L/menit)
  const minuteVentilationLMin = (rr * tidalVolumeMl) / 1000.0;

  // Tekanan Barometrik sesuai ketinggian (mdpl): P_B = 760 * exp(-h / 7990)
  const barometricPressureMmHg = 760.0 * Math.exp(-alt / 7990.0);

  // Persamaan Gas Alveolus: P_IO2 = F_IO2 * (P_B - P_H2O), F_IO2 = 0.2093, P_H2O = 47 mmHg
  const pio2 = Math.max(25.0, 0.2093 * (barometricPressureMmHg - 47.0));
  const deadSpaceMl = 150.0;
  const alveolarVentilationLMin = Math.max(
    1.2,
    (rr * Math.max(40.0, tidalVolumeMl - deadSpaceMl)) / 1000.0
  );
  const paco2 = Math.max(
    20.0,
    Math.min(75.0, 40.0 * (4.2 / alveolarVentilationLMin) * Math.pow(rAirway, 0.3))
  );
  const respiratoryQuotientR = 0.8;
  const alveolarPo2MmHg = Math.max(15.0, pio2 - paco2 / respiratoryQuotientR);

  // Kurva Disosiasi Oksihemoglobin Hill: S_O2 = P_O2^n / (P_50^n + P_O2^n) * 100%
  const hillN = 2.7;
  const p50 = 26.6; // mmHg
  const po2Pow = Math.pow(alveolarPo2MmHg, hillN);
  const p50Pow = Math.pow(p50, hillN);
  const spo2Percent = Math.min(100.0, Math.max(0.0, (po2Pow / (p50Pow + po2Pow)) * 100.0));

  // Volume paru sesaat V(t) di atas FRC (2400 mL)
  const frcMl = 2400.0;
  const omega = (2.0 * Math.PI * rr) / 60.0;
  const instantLungVolumeMl = frcMl + 0.5 * tidalVolumeMl * (1.0 - Math.cos(omega * t));

  return {
    tidalVolumeMl: Number(tidalVolumeMl.toFixed(1)),
    minuteVentilationLMin: Number(minuteVentilationLMin.toFixed(2)),
    barometricPressureMmHg: Number(barometricPressureMmHg.toFixed(1)),
    alveolarPo2MmHg: Number(alveolarPo2MmHg.toFixed(1)),
    spo2Percent: Number(spo2Percent.toFixed(2)),
    instantLungVolumeMl: Number(instantLungVolumeMl.toFixed(1)),
  };
}

/**
 * 6. Neurofisiologi & Potensial Aksi Neuron (anatomy-neural-synapse):
 * Menghitung Potensial Kesetimbangan Nernst (E_Na, E_K), Hukum All-or-None (ambang -55 mV),
 * Kecepatan Konduksi Saltatorik Mielin, dan Kurva Potensial Membran V_m(t).
 */
export function evaluateActionPotentialMv(
  timeSec: number,
  params: {
    stimulusVoltageMv: number;
    restingPotentialMv: number;
    nernstNaMv: number;
    nernstKMv: number;
  }
): number {
  const thresholdMv = -55.0;
  const vRest = params.restingPotentialMv;
  const vStim = params.stimulusVoltageMv;
  const cyclePeriod = 1.0; // siklus 1 detik
  const phase = (((timeSec % cyclePeriod) + cyclePeriod) % cyclePeriod) / cyclePeriod;

  // Sub-threshold: tidak melampaui -55 mV -> hanya depolarisasi lokal pasif yang meluruh
  if (vStim < thresholdMv) {
    if (phase < 0.15 || phase > 0.65) return Number(vRest.toFixed(2));
    const localProgress = (phase - 0.15) / 0.5;
    const subPeak = vRest + (vStim - vRest) * Math.sin(localProgress * Math.PI) * Math.exp(-localProgress * 2.2);
    return Number(subPeak.toFixed(2));
  }

  // All-or-None Terpicu (vStim >= -55 mV): Depolarisasi -> Puncak (+35..+40 mV) -> Repolarisasi -> Hiperpolarisasi Refrakter
  const vPeak = Math.min(50.0, params.nernstNaMv - 22.0);
  const vUndershoot = Math.max(-95.0, params.nernstKMv + 6.0);

  if (phase < 0.15) {
    return Number(vRest.toFixed(2));
  } else if (phase < 0.25) {
    // Fase Depolarisasi Cepat (kanal Na+ terbuka)
    const u = (phase - 0.15) / 0.10;
    const smooth = u * u * (3 - 2 * u);
    return Number((vRest + (vPeak - vRest) * smooth).toFixed(2));
  } else if (phase < 0.45) {
    // Fase Repolarisasi (inaktivasi Na+, pembukaan kanal K+)
    const u = (phase - 0.25) / 0.20;
    const smooth = u * u * (3 - 2 * u);
    return Number((vPeak + (vUndershoot - vPeak) * smooth).toFixed(2));
  } else if (phase < 0.72) {
    // Periode Refrakter / Hiperpolarisasi kembali ke potensial istirahat oleh pompa Na+/K+-ATPase
    const u = (phase - 0.45) / 0.27;
    const smooth = u * u * (3 - 2 * u);
    return Number((vUndershoot + (vRest - vUndershoot) * smooth).toFixed(2));
  }
  return Number(vRest.toFixed(2));
}

export function calculateNeuralSynapse(params: NeuralSynapseParams): NeuralSynapseMetrics {
  const stimMv = Math.max(-70, Math.min(50, params.stimulusVoltageMv));
  const myelin = Math.max(0, Math.min(100, params.myelinThickness));
  const naOut = Math.max(50, Math.min(200, params.extracellularNaMm));
  const kOut = Math.max(2, Math.min(15, params.extracellularKMm));
  const t = params.timeSec ?? 0.25; // default near peak for static snapshot evaluation

  // Konsentrasi intraseluler fisiologis mamalia
  const naIn = 15.0; // mM
  const kIn = 140.0; // mM
  const nernstFactor37C = 61.54; // (RT/zF)*ln(10) dalam mV pada 37°C

  const nernstNaMv = nernstFactor37C * Math.log10(naOut / naIn);
  const nernstKMv = nernstFactor37C * Math.log10(kOut / kIn);

  // Potensial Istirahat Goldman-Hodgkin-Katz (P_K : P_Na = 1.0 : 0.04)
  const restingPotentialMv =
    nernstFactor37C * Math.log10((1.0 * kOut + 0.04 * naOut) / (1.0 * kIn + 0.04 * naIn));

  const thresholdMv = -55.0;
  const actionPotentialTriggered = stimMv >= thresholdMv;
  const allOrNoneStatus: NeuralSynapseMetrics['allOrNoneStatus'] = actionPotentialTriggered
    ? 'Potensial Aksi Terpicu (All-or-None)'
    : 'Gagal Mencapai Ambang (Sub-Threshold)';

  // Kecepatan Konduksi Saltatorik: akson tanpa mielin ~2 m/s, mielin penuh ~110 m/s
  const baseVelocity = 2.0 + 1.08 * myelin;
  const naDrivingFactor = Math.max(0.5, Math.min(1.25, nernstNaMv / 60.7));
  const conductionVelocityMs = actionPotentialTriggered
    ? baseVelocity * naDrivingFactor
    : 0.0;

  const membranePotentialMv = evaluateActionPotentialMv(t, {
    stimulusVoltageMv: stimMv,
    restingPotentialMv,
    nernstNaMv,
    nernstKMv,
  });

  return {
    nernstNaMv: Number(nernstNaMv.toFixed(2)),
    nernstKMv: Number(nernstKMv.toFixed(2)),
    restingPotentialMv: Number(restingPotentialMv.toFixed(2)),
    thresholdMv,
    actionPotentialTriggered,
    allOrNoneStatus,
    conductionVelocityMs: Number(conductionVelocityMs.toFixed(2)),
    membranePotentialMv,
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

  const cardiovascularHeart = calculateCardiovascularHeart({
    heartRateBpm: params.heartRateBpm ?? 72,
    vesselRadiusRatio: params.vesselRadiusRatio ?? 1.0,
    bloodViscosity: params.bloodViscosity ?? 3.5,
    exerciseIntensity: params.exerciseIntensity ?? 20,
    timeSec: params.timeSec ?? 0,
  });

  const respiratoryLungs = calculateRespiratoryLungs({
    respirationRate: params.respirationRate ?? 15,
    diaphragmEffort: params.diaphragmEffort ?? 50,
    airwayResistance: params.airwayResistance ?? 1.0,
    altitudeMeters: params.altitudeMeters ?? 0,
    timeSec: params.timeSec ?? 0,
  });

  const neuralSynapse = calculateNeuralSynapse({
    stimulusVoltageMv: params.stimulusVoltageMv ?? -40,
    myelinThickness: params.myelinThickness ?? 75,
    extracellularNaMm: params.extracellularNaMm ?? 145,
    extracellularKMm: params.extracellularKMm ?? 4.5,
    timeSec: params.timeSec ?? 0.25,
  });

  return {
    enzymeKinetics,
    predatorPrey,
    cellOsmosis,
    cardiovascularHeart,
    respiratoryLungs,
    neuralSynapse,
  };
}
