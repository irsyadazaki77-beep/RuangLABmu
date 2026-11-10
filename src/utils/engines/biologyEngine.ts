export type BiologyMode =
  | 'photosynthesis-ingenhousz'
  | 'enzyme-kinetics'
  | 'enzyme-catalase'
  | 'predator-prey-dynamics'
  | 'cell-osmosis-tonicity'
  | 'osmosis-plasmolysis';

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
