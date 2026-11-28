/**
 * Pure visual-to-formula synchronization helpers for Biology & Human Anatomy 3D rigs.
 * Guarantees 1:1 agreement between canonical biologyEngine / biologyModules formulas
 * and 3D scene motion, cellular responses, foam heights, and physiological displays.
 */
import {
  calculateCardiovascularHeart,
  calculateCellOsmosisTonicity,
  calculateEnzymeKinetics,
  calculateLotkaVolterraMetrics,
  calculateNeuralSynapse,
  calculateRespiratoryLungs,
  calculateDnaPcrElectrophoresis,
  type DnaPcrElectrophoresisMetrics,
} from './engines/biologyEngine';

export type OsmosisTonicityState = 'hypotonic' | 'isotonic' | 'hypertonic';

export interface OsmosisVisualState {
  state: OsmosisTonicityState;
  protoplastScale: number;
  vacuoleScale: number;
  membraneDetachment: number;
  cyclosisSpeed: number;
  solutePotentialMpa: number;
  turgorPressureAtm: number;
  netWaterPotentialAtm: number;
  fluxArrowScale: number;
}

export type EcosystemBalanceStatus = 'seimbang' | 'ledakan_mangsa' | 'tekanan_predasi';

export interface EcosystemVisualCounts {
  preyInstances: number;
  predatorInstances: number;
  status: EcosystemBalanceStatus;
}

/**
 * Derives plant-cell turgor, central vacuole size, membrane detachment, cytoplasmic streaming speed,
 * and exact van 't Hoff solute potential (Ψs = -iCRT) from external sucrose concentration and temperature.
 */
export function computeOsmosisVisualState(
  sucroseConcMolar: number,
  solutionTempC = 25
): OsmosisVisualState {
  const c = Number.isFinite(sucroseConcMolar) ? Math.max(0, Math.min(1.5, sucroseConcMolar)) : 0.3;
  const tempC = Number.isFinite(solutionTempC) ? Math.max(5, Math.min(50, solutionTempC)) : 25;

  const osm = calculateCellOsmosisTonicity({
    intracellularMolarityM: 0.28,
    extracellularMolarityM: c,
    temperatureC: tempC,
    hasCellWall: true,
  });

  const state: OsmosisTonicityState =
    c > 0.35 ? 'hypertonic' : c < 0.22 ? 'hypotonic' : 'isotonic';

  // Hypotonic swells softly against rigid wall; hypertonic shrinks protoplast inward
  const protoplastScale =
    state === 'hypotonic'
      ? Math.min(1.03, 0.96 + (0.22 - c) * 0.28)
      : Math.max(0.54, 1.0 - (c - 0.22) * 0.54);

  // Vacuole responds more strongly than outer membrane
  const vacuoleScale =
    state === 'hypotonic'
      ? Math.min(1.12, 0.92 + (0.22 - c) * 0.85)
      : Math.max(0.28, 0.88 - (c - 0.22) * 0.72);

  // Detachment gap fraction between rigid cellulose wall and shrinking plasma membrane
  const membraneDetachment = Math.max(0, Math.min(1, (0.98 - protoplastScale) / 0.44));

  // Cyclosis drops sharply when cell is strongly plasmolyzed
  const cyclosisSpeed =
    state === 'hypertonic'
      ? Math.max(0.08, 1.0 - membraneDetachment * 0.92)
      : state === 'hypotonic'
      ? 1.15
      : 0.85;

  const fluxArrowScale = Math.min(1.5, Math.max(0.35, Math.abs(osm.netWaterPotentialAtm) / 8.5));

  return {
    state,
    protoplastScale: Number(protoplastScale.toFixed(3)),
    vacuoleScale: Number(vacuoleScale.toFixed(3)),
    membraneDetachment: Number(membraneDetachment.toFixed(3)),
    cyclosisSpeed: Number(cyclosisSpeed.toFixed(3)),
    solutePotentialMpa: Number((-osm.osmoticPressureExtMpa).toFixed(3)),
    turgorPressureAtm: osm.turgorPressureAtm,
    netWaterPotentialAtm: osm.netWaterPotentialAtm,
    fluxArrowScale: Number(fluxArrowScale.toFixed(3)),
  };
}

/**
 * Scales prey and predator population counts cleanly into InstancedMesh budgets for the 3D terrarium.
 */
export function computeEcosystemVisualCounts(
  preyPopulationX: number,
  predatorPopulationY: number,
  isLite: boolean,
  maxPreyPool = 64,
  maxPredatorPool = 28
): EcosystemVisualCounts {
  const prey = Number.isFinite(preyPopulationX) ? Math.max(0, preyPopulationX) : 40;
  const pred = Number.isFinite(predatorPopulationY) ? Math.max(0, predatorPopulationY) : 9;

  const liteScale = isLite ? 0.6 : 1;
  const preyCap = Math.max(4, Math.floor(maxPreyPool * liteScale));
  const predCap = Math.max(2, Math.floor(maxPredatorPool * liteScale));

  const preyInstances =
    prey <= 0 ? 0 : Math.min(preyCap, Math.max(1, Math.round((prey / 120) * preyCap)));
  const predatorInstances =
    pred <= 0 ? 0 : Math.min(predCap, Math.max(1, Math.round((pred / 50) * predCap)));

  const ratio = pred > 0 ? prey / pred : 99;
  const status: EcosystemBalanceStatus =
    ratio > 7.5 ? 'ledakan_mangsa' : ratio < 2.2 ? 'tekanan_predasi' : 'seimbang';

  return { preyInstances, predatorInstances, status };
}

/**
 * Evaluates Lotka-Volterra derivatives & equilibrium for the 3D ecology terrarium HUD and chase kinematics.
 */
export function computeLotkaVolterraVisualState(params: {
  preyPopulationX?: number;
  predatorPopulationY?: number;
  preyGrowthRateAlpha?: number;
  predationRateBeta?: number;
  predatorReproductionDelta?: number;
  predatorMortalityGamma?: number;
}) {
  const x = params.preyPopulationX ?? 40;
  const y = params.predatorPopulationY ?? 9;
  const alpha = params.preyGrowthRateAlpha ?? 1.1;
  const beta = params.predationRateBeta ?? 0.04;
  const delta = params.predatorReproductionDelta ?? 0.01;
  const gamma = params.predatorMortalityGamma ?? 0.4;
  const lv = calculateLotkaVolterraMetrics({
    preyPopulationX: x,
    predatorPopulationY: y,
    preyGrowthRateAlpha: alpha,
    predationRateBeta: beta,
    predatorReproductionDelta: delta,
    predatorMortalityGamma: gamma,
  });
  const chaseSpeed = Math.min(2.2, Math.max(0.45, 0.55 + beta * 14));
  const grazeSpeed = Math.min(2.0, Math.max(0.4, 0.45 + alpha * 0.55));
  return {
    ...lv,
    chaseSpeed: Number(chaseSpeed.toFixed(3)),
    grazeSpeed: Number(grazeSpeed.toFixed(3)),
  };
}

/**
 * Maps catalase solution pH (2..12) to a universal colorimetric reagent tint hex.
 */
export function computeCatalasePhHex(solutionPH: number): number {
  const ph = Number.isFinite(solutionPH) ? Math.max(2, Math.min(12, solutionPH)) : 7;
  if (ph < 5.5) return 0xf59e0b; // Acidic amber-orange
  if (ph <= 8.2) return 0xef4444; // Neutral catalase heme-crimson
  return 0x8b5cf6; // Alkaline violet
}

export interface CatalaseFormulaVisualState {
  reactionRateV: number;
  foamHeightCm: number;
  foamScaleY: number;
  relativeActivityPct: number;
  denaturationDegreePct: number;
  bubbleRiseSpeed: number;
  liquidPhHex: number;
  isDenatured: boolean;
}

/**
 * Drives the 3D Catalase/Enzyme tube strictly from exact Michaelis-Menten + Arrhenius + Denaturation
 * equations in calculateEnzymeKinetics() and biologyModules.ts!
 */
export function computeCatalaseFormulaVisualState(params: {
  substrateConcMm?: number;
  solutionPH?: number;
  solutionPh?: number;
  temperatureC?: number;
  enzymeVolumeMl?: number;
}): CatalaseFormulaVisualState {
  const S = Math.max(0, Number.isFinite(params.substrateConcMm) ? params.substrateConcMm! : 10);
  const ph = Number.isFinite(params.solutionPH)
    ? params.solutionPH!
    : Number.isFinite(params.solutionPh)
    ? params.solutionPh!
    : 7.0;
  const tempC = Number.isFinite(params.temperatureC) ? params.temperatureC! : 37;
  const enzymeVol = Math.max(0.2, Number.isFinite(params.enzymeVolumeMl) ? params.enzymeVolumeMl! : 1.0);

  const vMaxBase = 120.0 * enzymeVol;
  const kin = calculateEnzymeKinetics({
    substrateConcMm: S,
    vMaxBase,
    kmConstantMm: 4.5,
    temperatureC: tempC,
    solutionPh: ph,
  });

  const reactionRateV = kin.reactionVelocityV;
  const foamHeightCm = Math.min(15.0, (reactionRateV / 10.0) * 1.8);
  // Map 0..15 cm foam column to 3D scale (0.04..1.45)
  const foamScaleY = Math.max(0.04, Math.min(1.48, 0.04 + (foamHeightCm / 15.0) * 1.44));
  const relativeActivityPct = Math.min(100, (reactionRateV / vMaxBase) * 100);
  const bubbleRiseSpeed = reactionRateV < 0.5 ? 0 : Math.min(2.6, 0.25 + (reactionRateV / 120) * 1.9);

  return {
    reactionRateV: Number(reactionRateV.toFixed(2)),
    foamHeightCm: Number(foamHeightCm.toFixed(2)),
    foamScaleY: Number(foamScaleY.toFixed(3)),
    relativeActivityPct: Number(relativeActivityPct.toFixed(1)),
    denaturationDegreePct: kin.denaturationDegreePct,
    bubbleRiseSpeed: Number(bubbleRiseSpeed.toFixed(3)),
    liquidPhHex: computeCatalasePhHex(ph),
    isDenatured: kin.denaturationDegreePct >= 65,
  };
}

export interface PhotosynthesisFormulaVisualState {
  bubbleRatePerMin: number;
  chlorophyllEfficiencyPct: number;
  o2VolumeProducedMl: number;
  gasPocketLevel: number;
  tempFactor: number;
}

/**
 * Exact Ingenhousz photosynthesis model matching biologyModules.ts (including waterTempC thermal curve!).
 */
export function computePhotosynthesisVisualState(
  lightIntensityLux: number,
  wavelengthNm: number,
  bicarbonateConc = 2.5,
  waterTempC = 28
): PhotosynthesisFormulaVisualState {
  const lux = Number.isFinite(lightIntensityLux) ? Math.max(0, lightIntensityLux) : 1200;
  const nm = Number.isFinite(wavelengthNm) ? wavelengthNm : 660;
  const co2 = Number.isFinite(bicarbonateConc) ? Math.max(0, bicarbonateConc) : 2.5;
  const tempC = Number.isFinite(waterTempC) ? waterTempC : 28;

  const bluePeak = Math.exp(-Math.pow((nm - 435) / 35, 2));
  const redPeak = Math.exp(-Math.pow((nm - 660) / 40, 2));
  const chlorophyllEfficiency = Math.min(1.0, 0.12 + 0.88 * Math.max(bluePeak, redPeak));
  const lightFactor = lux / (lux + 600);
  const co2Factor = (co2 + 0.1) / (co2 + 1.2);

  let tempFactor = 1.0;
  if (tempC < 30) {
    tempFactor = Math.max(0.1, (tempC - 10) / 20);
  } else {
    tempFactor = Math.max(0.05, 1.0 - Math.pow((tempC - 30) / 14, 2));
  }

  const maxBubbleRate = 95.0;
  const bubbleRatePerMin = maxBubbleRate * lightFactor * chlorophyllEfficiency * co2Factor * tempFactor;
  const o2VolumeProducedMl = bubbleRatePerMin * 0.045;
  const gasPocketLevel = Math.max(0.16, Math.min(0.95, 0.16 + 0.78 * (bubbleRatePerMin / maxBubbleRate)));

  return {
    bubbleRatePerMin: Number(bubbleRatePerMin.toFixed(1)),
    chlorophyllEfficiencyPct: Number((chlorophyllEfficiency * 100).toFixed(1)),
    o2VolumeProducedMl: Number(o2VolumeProducedMl.toFixed(2)),
    gasPocketLevel: Number(gasPocketLevel.toFixed(3)),
    tempFactor: Number(tempFactor.toFixed(3)),
  };
}

/**
 * Computes accumulated O2 gas pocket height fraction (0.16..0.95) in the Ingenhousz inverted tube.
 */
export function computePhotosynthesisGasLevel(
  lightIntensityLux: number,
  wavelengthNm: number,
  bicarbonateConc = 2.5,
  waterTempC = 28
): number {
  return computePhotosynthesisVisualState(lightIntensityLux, wavelengthNm, bicarbonateConc, waterTempC)
    .gasPocketLevel;
}

/**
 * Computes exact physiological 3D animation parameters for Heart, Lungs, and Neuron anatomy scenes.
 */
export function computeHeartVisualKinematics(params: Record<string, number>, timeSec: number) {
  const hr = params.heartRateBpm ?? 72;
  const radiusRatio = params.vesselRadiusRatio ?? 1.0;
  const viscosity = params.bloodViscosity ?? 3.5;
  const exercise = params.exerciseIntensity ?? 20;
  const m = calculateCardiovascularHeart({
    heartRateBpm: hr,
    vesselRadiusRatio: radiusRatio,
    bloodViscosity: viscosity,
    exerciseIntensity: exercise,
    timeSec,
  });
  const svRatio = Math.max(0.45, Math.min(1.65, m.strokeVolumeMl / 70));
  const rbcFlowSpeed = Math.max(0.25, Math.min(2.4, (m.cardiacOutputLMin / 5.0) * 0.78));
  const plaqueSeverity = Math.max(0, Math.min(1, (1.0 - radiusRatio) / 0.6));
  return {
    metrics: m,
    svRatio: Number(svRatio.toFixed(3)),
    rbcFlowSpeed: Number(rbcFlowSpeed.toFixed(3)),
    plaqueSeverity: Number(plaqueSeverity.toFixed(3)),
  };
}

export function computeLungsVisualKinematics(params: Record<string, number>, timeSec: number) {
  const rr = params.respirationRate ?? 15;
  const effort = params.diaphragmEffort ?? 50;
  const resistance = params.airwayResistance ?? 1.0;
  const altitude = params.altitudeMeters ?? 0;
  const m = calculateRespiratoryLungs({
    respirationRate: rr,
    diaphragmEffort: effort,
    airwayResistance: resistance,
    altitudeMeters: altitude,
    timeSec,
  });
  // Exact Boyle expansion driven by instantLungVolumeMl - FRC (2400 mL)
  const deltaVolFrac = Math.max(0, Math.min(1.2, (m.instantLungVolumeMl - 2400) / 1000));
  // Alveolar oxygenation tint shifts from healthy bright rose-red (>=94% SpO2) to cyanotic blue-violet (<85%)
  const hypoxiaRatio = Math.max(0, Math.min(1, (95 - m.spo2Percent) / 25));
  return {
    metrics: m,
    deltaVolFrac: Number(deltaVolFrac.toFixed(4)),
    hypoxiaRatio: Number(hypoxiaRatio.toFixed(3)),
  };
}

export function computeNeuronVisualKinematics(params: Record<string, number>, timeSec: number) {
  const stim = params.stimulusVoltageMv ?? -40;
  const myelin = params.myelinThickness ?? 75;
  const naOut = params.extracellularNaMm ?? 145;
  const kOut = params.extracellularKMm ?? 4.5;
  const m = calculateNeuralSynapse({
    stimulusVoltageMv: stim,
    myelinThickness: myelin,
    extracellularNaMm: naOut,
    extracellularKMm: kOut,
    timeSec,
  });
  // Direct linear mapping of saltatory conduction velocity (2..135 m/s) into 3D propagation cycles/sec
  const pulseRateHz = m.actionPotentialTriggered
    ? Math.max(0.28, Math.min(3.2, 0.25 + (m.conductionVelocityMs / 110) * 2.2))
    : 0;
  return {
    metrics: m,
    pulseRateHz: Number(pulseRateHz.toFixed(3)),
  };
}

export interface DnaPcrVisualState {
  metrics: DnaPcrElectrophoresisMetrics;
  cyclePhaseName: 'Denaturasi (95 °C)' | 'Annealing (Primer)' | 'Ekstensi (72 °C)';
  liveCyclerTempC: number;
  activeCycleNumber: number;
  bandMigrationFrac: number;
  uvGlowIntensity: number;
  ladderMigrationFracs: number[];
}

/**
 * Computes thermal cycler phase temperature (95°C -> Ta -> 72°C) and agarose gel UV band
 * migration fraction synced 1:1 with calculateDnaPcrElectrophoresis().
 */
export function computeDnaPcrVisualState(
  params: Record<string, number>,
  timeSec: number
): DnaPcrVisualState {
  const c = Math.max(1, Math.min(40, params.pcrCycles ?? 25));
  const ta = Math.max(40, Math.min(80, params.annealingTempC ?? 58));
  const agarose = Math.max(0.5, Math.min(3.0, params.agaroseConcPct ?? 1.2));
  const voltage = Math.max(20, Math.min(220, params.electrophoresisVoltageV ?? 100));
  const bp = Math.max(50, Math.min(10000, params.dnaFragmentBp ?? 750));

  const metrics = calculateDnaPcrElectrophoresis({
    pcrCycles: c,
    annealingTempC: ta,
    agaroseConcPct: agarose,
    electrophoresisVoltageV: voltage,
    dnaFragmentBp: bp,
  });

  // 3-step PCR cycle duration (6 seconds per visual cycle)
  const safeT = Math.max(0, timeSec);
  const subPhase = (safeT % 6.0) / 6.0;
  let cyclePhaseName: DnaPcrVisualState['cyclePhaseName'];
  let liveCyclerTempC: number;
  if (subPhase < 0.33) {
    cyclePhaseName = 'Denaturasi (95 °C)';
    liveCyclerTempC = 95;
  } else if (subPhase < 0.66) {
    cyclePhaseName = 'Annealing (Primer)';
    liveCyclerTempC = ta;
  } else {
    cyclePhaseName = 'Ekstensi (72 °C)';
    liveCyclerTempC = 72;
  }

  const activeCycleNumber = Math.min(Math.round(c), Math.floor(safeT / 6.0) % Math.max(1, Math.round(c)) + 1);
  const bandMigrationFrac = Number(Math.max(0.05, Math.min(0.96, metrics.migrationDistanceMm / 75)).toFixed(4));
  const uvGlowIntensity = Number(Math.max(0.08, Math.min(1.0, metrics.bandFluorescencePct / 100)).toFixed(3));

  // Reference DNA Ladder rungs (3000, 1500, 750, 400, 150 bp) evaluated with identical gel/voltage physics
  const ladderBps = [3000, 1500, 750, 400, 150];
  const ladderMigrationFracs = ladderBps.map((rungBp) => {
    const m = calculateDnaPcrElectrophoresis({
      pcrCycles: c,
      annealingTempC: ta,
      agaroseConcPct: agarose,
      electrophoresisVoltageV: voltage,
      dnaFragmentBp: rungBp,
    });
    return Number(Math.max(0.05, Math.min(0.96, m.migrationDistanceMm / 75)).toFixed(4));
  });

  return {
    metrics,
    cyclePhaseName,
    liveCyclerTempC,
    activeCycleNumber,
    bandMigrationFrac,
    uvGlowIntensity,
    ladderMigrationFracs,
  };
}

