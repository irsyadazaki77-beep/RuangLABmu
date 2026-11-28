/**
 * Pure visual-to-formula synchronization helpers for Chemistry 3D apparatus rendering & realism.
 * Guarantees 1:1 agreement between canonical chemistryEngine formulas and 3D visual phenomena.
 */
import { ELECTROLYSIS_PRESETS } from './engines/chemistryEngine';

export interface GasPistonVisualState {
  /** World Y position of the piston head */
  pistonY: number;
  /** World Y position of the piston rod */
  rodY: number;
  /** Thermal color hex of gas molecules */
  gasColorHex: number;
  /** Particle speed multiplier (v_rms ∝ sqrt(T)) */
  particleSpeed: number;
  /** Active molecule count scaled by moles n */
  activeMoleculeCount: number;
  /** Auto-ranged manometer pressure max (atm) & needle angle (rad) */
  manometerMaxAtm: number;
  manometerNeedleAngleRad: number;
}

/**
 * Computes piston height, rod height, gas molecule color, v_rms thermal speed,
 * mole-proportional molecule count, and calibrated manometer angle for Boyle/Ideal Gas 3D apparatus.
 */
export function computeGasPistonVisualState(
  volumeL: number,
  temperatureK: number,
  gasMoles = 1.0,
  pressureAtm = 2.46,
  maxPool = 40
): GasPistonVisualState {
  const safeV = Math.max(2.0, Math.min(25.0, Number.isFinite(volumeL) ? volumeL : 10.0));
  const safeT = Math.max(100, Math.min(1000, Number.isFinite(temperatureK) ? temperatureK : 300));
  const safeN = Math.max(0.2, Math.min(5.0, Number.isFinite(gasMoles) ? gasMoles : 1.0));
  const safeP = Math.max(0, Number.isFinite(pressureAtm) ? pressureAtm : 2.46);

  const pistonY = 0.8 + (safeV / 25.0) * 3.2;
  const rodY = pistonY + 1.2;
  const gasColorHex = safeT >= 480 ? 0xef4444 : safeT >= 360 ? 0xf97316 : 0x38bdf8;
  const particleSpeed = Math.sqrt(safeT / 300) * 0.04;

  // Scale molecule count with moles n (1.0 mol -> ~50% pool, 2.0 mol -> 100% pool)
  const activeMoleculeCount = Math.max(
    6,
    Math.min(maxPool, Math.round((safeN / 2.0) * maxPool))
  );

  // Calibrated Bourdon gauge range: 6 atm normally, auto-scales to 25 or 50 atm under extreme compression
  const manometerMaxAtm = safeP > 24 ? 50 : safeP > 6 ? 25 : 6;
  const frac = Math.min(1, safeP / manometerMaxAtm);
  const manometerNeedleAngleRad = Number((Math.PI * 0.72 - frac * Math.PI * 1.44).toFixed(4));

  return {
    pistonY,
    rodY,
    gasColorHex,
    particleSpeed,
    activeMoleculeCount,
    manometerMaxAtm,
    manometerNeedleAngleRad,
  };
}

export interface ArrheniusKineticsVisualState {
  /** Point light intensity under the beaker */
  heaterIntensity: number;
  /** Stirrer bar angular step per frame (rad) */
  stirAngularStep: number;
  /** Thermal convection vortex ring opacity */
  vortexOpacity: number;
  /** First-order fractional conversion 1 - exp(-k * t) in [0..1] */
  reactionConversion: number;
  /** Remaining reactant concentration [A](t) = [A]0 * exp(-k*t) */
  remainingConcM: number;
  /** Precipitate/turbidity visual opacity driven by conversion & [A]0 */
  turbidityOpacity: number;
  /** Solution tint shifting from clear cyan -> golden sulfur colloid as product forms */
  solutionColorHex: number;
}

/**
 * Computes hotplate glow, magnetic stirrer rotation speed, convection shimmer,
 * and true first-order Arrhenius reaction conversion [A](t) = [A]0 * exp(-k*t).
 */
export function computeArrheniusKineticsState(
  tempC: number,
  stirringRpm: number,
  reacting: boolean,
  arrheniusK = 0.08,
  initialConcM = 0.5,
  simTimeSec = 0
): ArrheniusKineticsVisualState {
  const safeTemp = Math.max(0, Math.min(120, Number.isFinite(tempC) ? tempC : 25));
  const safeRpm = Math.max(0, Math.min(1200, Number.isFinite(stirringRpm) ? stirringRpm : 300));
  const safeK = Math.max(0, Number.isFinite(arrheniusK) ? arrheniusK : 0.08);
  const safeC0 = Math.max(0.05, Number.isFinite(initialConcM) ? initialConcM : 0.5);
  const safeT = Math.max(0, Number.isFinite(simTimeSec) ? simTimeSec : 0);

  const heaterIntensity = Math.max(0, ((safeTemp - 25) / 65) * 1.4);
  const stirAngularStep = (safeRpm / 60) * 0.25 * (reacting ? 1.4 : 0.8);
  const vortexOpacity = Math.min(
    0.65,
    0.12 + (safeRpm / 1000) * 0.35 + Math.max(0, safeTemp - 25) * 0.004
  );

  // First-order kinetics: [A](t) = [A]_0 * exp(-k * t), loops gracefully every 3 half-lives for visual study
  const cycleT = safeK > 1e-5 ? safeT % Math.max(4, Math.min(30, 4.5 / safeK)) : 0;
  const decay = Math.exp(-safeK * cycleT);
  const reactionConversion = Math.max(0, Math.min(1, 1 - decay));
  const remainingConcM = safeC0 * decay;
  const concIntensity = Math.min(1, safeC0 / 1.5);
  const turbidityOpacity = Number(
    Math.min(0.88, 0.24 + reactionConversion * (0.42 + 0.22 * concIntensity)).toFixed(3)
  );
  // Transition from translucent reagent blue -> colloidal pale yellow-amber as sulfur/product precipitates
  const solutionColorHex =
    reactionConversion > 0.65 ? 0xf59e0b : reactionConversion > 0.25 ? 0xfbbf24 : 0x38bdf8;

  return {
    heaterIntensity,
    stirAngularStep,
    vortexOpacity,
    reactionConversion: Number(reactionConversion.toFixed(4)),
    remainingConcM: Number(remainingConcM.toFixed(4)),
    turbidityOpacity,
    solutionColorHex,
  };
}

export interface BeerLambertBeamState {
  /** Monochromatic beam RGB hex */
  beamColorHex: number;
  /** Complementary solution color hex (absorbs beam wavelength) */
  solutionComplementaryHex: number;
  /** Incident beam opacity before cuvette (0..1) */
  incidentOpacity: number;
  /** Transmitted beam opacity after cuvette (attenuated by Beer-Lambert T = 10^-A) */
  transmittedOpacity: number;
  /** Transmittance fraction T = 10^(-A) */
  transmittance: number;
  /** Cuvette physical optical path width scale relative to 1.0 cm */
  cuvettePathScale: number;
  /** Solution optical density opacity scaling with absorbance */
  solutionOpacity: number;
}

/**
 * Maps wavelength (400-700 nm) to visible RGB hex, computes complementary solution color,
 * exact cuvette path width (b), and Beer-Lambert beam attenuation T = 10^(-A).
 */
export function computeBeerLambertBeamState(
  wavelengthNm: number,
  absorbance: number,
  pathLengthCm = 1.0
): BeerLambertBeamState {
  const wl = Math.max(380, Math.min(720, Number.isFinite(wavelengthNm) ? wavelengthNm : 520));
  const safeA = Math.max(0, Math.min(3.5, Number.isFinite(absorbance) ? absorbance : 0.45));
  const safeB = Math.max(0.5, Math.min(5.0, Number.isFinite(pathLengthCm) ? pathLengthCm : 1.0));

  let beamColorHex = 0xef4444;
  let solutionComplementaryHex = 0x06b6d4; // Cyan-blue solution absorbs red (~650nm)
  if (wl < 450) {
    beamColorHex = 0x8b5cf6; // Violet absorbed -> yellow-green solution
    solutionComplementaryHex = 0xeab308;
  } else if (wl < 495) {
    beamColorHex = 0x3b82f6; // Blue absorbed -> orange solution
    solutionComplementaryHex = 0xf97316;
  } else if (wl < 570) {
    beamColorHex = 0x10b981; // Green absorbed -> magenta/purple KMnO4 solution
    solutionComplementaryHex = 0xd946ef;
  } else if (wl < 590) {
    beamColorHex = 0xeab308; // Yellow absorbed -> indigo-violet solution
    solutionComplementaryHex = 0x6366f1;
  } else if (wl < 620) {
    beamColorHex = 0xf97316; // Orange absorbed -> deep blue CuSO4 solution
    solutionComplementaryHex = 0x0284c7;
  }

  const transmittance = Math.pow(10, -safeA);
  const incidentOpacity = 0.85;
  const transmittedOpacity = Math.max(0.04, Math.min(0.85, 0.05 + transmittance * 0.8));
  const cuvettePathScale = Number(Math.max(0.65, Math.min(2.3, 0.72 + (safeB - 0.5) * 0.35)).toFixed(3));
  const solutionOpacity = Number(Math.min(0.92, Math.max(0.18, 0.22 + (1 - transmittance) * 0.68)).toFixed(3));

  return {
    beamColorHex,
    solutionComplementaryHex,
    incidentOpacity,
    transmittedOpacity,
    transmittance,
    cuvettePathScale,
    solutionOpacity,
  };
}

export interface CalorimeterVisualState {
  liveTempC: number;
  deltaTempLiveC: number;
  isExothermic: boolean;
  isEndothermic: boolean;
  liquidHeightScale: number;
  liquidColorHex: number;
  thermalVaporIntensity: number;
  frostCondensationIntensity: number;
  mercuryFillScale: number;
  stirAngularStep: number;
}

/**
 * Synchronizes 3D Calorimeter live temperature T(t), volume height (mL), stirrer RPM,
 * and exothermic (heat shimmer) vs endothermic (cold frost condensation) phenomena.
 */
export function computeCalorimeterVisualState(
  initialTempC: number,
  finalTempC: number,
  solutionVolumeMl: number,
  stirringRpm: number,
  reactionProgress: number,
  isReacting: boolean
): CalorimeterVisualState {
  const tInit = Number.isFinite(initialTempC) ? initialTempC : 25;
  const tFinal = Number.isFinite(finalTempC) ? finalTempC : tInit;
  const volMl = Math.max(50, Math.min(500, Number.isFinite(solutionVolumeMl) ? solutionVolumeMl : 200));
  const rpm = Math.max(0, Math.min(1200, Number.isFinite(stirringRpm) ? stirringRpm : 400));
  const prog = isReacting ? Math.max(0, Math.min(1, reactionProgress)) : 1;

  const liveTempC = tInit + (tFinal - tInit) * prog;
  const deltaTempLiveC = liveTempC - tInit;
  const isExothermic = deltaTempLiveC > 0.3;
  const isEndothermic = deltaTempLiveC < -0.3;

  const liquidHeightScale = Number(Math.max(0.45, Math.min(1.25, 0.45 + (volMl / 500) * 0.8)).toFixed(3));
  const liquidColorHex = isExothermic
    ? liveTempC > 48
      ? 0xf97316
      : 0xfb923c
    : isEndothermic
    ? liveTempC < 15
      ? 0x67e8f9
      : 0x38bdf8
    : 0x38bdf8;

  const thermalVaporIntensity = isExothermic ? Math.min(1, Math.abs(deltaTempLiveC) / 18) : 0;
  const frostCondensationIntensity = isEndothermic ? Math.min(1, Math.abs(deltaTempLiveC) / 10) : 0;
  const mercuryFillScale = Number(Math.max(0.08, Math.min(1.0, (liveTempC - 0) / 100)).toFixed(3));
  const stirAngularStep = Number(((rpm / 60) * 0.22 * (isReacting ? 1.35 : 0.75)).toFixed(4));

  return {
    liveTempC: Number(liveTempC.toFixed(2)),
    deltaTempLiveC: Number(deltaTempLiveC.toFixed(2)),
    isExothermic,
    isEndothermic,
    liquidHeightScale,
    liquidColorHex,
    thermalVaporIntensity: Number(thermalVaporIntensity.toFixed(3)),
    frostCondensationIntensity: Number(frostCondensationIntensity.toFixed(3)),
    mercuryFillScale,
    stirAngularStep,
  };
}

export interface TitrationVisualState {
  buretteFillFrac: number;
  flaskVolumeScale: number;
  stirAngularStep: number;
}

/**
 * Synchronizes burette liquid depletion (0..100 mL) and Erlenmeyer flask liquid level rise
 * (V_analyte + V_titrant) with actual stoichiometry parameters.
 */
export function computeTitrationVisualState(
  analyteVolumeMl: number,
  titrantAddedMl: number,
  stirringRpm: number
): TitrationVisualState {
  const va = Math.max(10, Math.min(100, Number.isFinite(analyteVolumeMl) ? analyteVolumeMl : 50));
  const vb = Math.max(0, Math.min(100, Number.isFinite(titrantAddedMl) ? titrantAddedMl : 0));
  const rpm = Math.max(0, Math.min(1200, Number.isFinite(stirringRpm) ? stirringRpm : 420));

  // Burette capacity 100 mL matching ChemistryParams titrantAddedMl slider (0..100 mL)
  const buretteFillFrac = Number(Math.max(0.04, Math.min(1.0, 1 - vb / 100)).toFixed(3));
  const totalMl = va + vb;
  const flaskVolumeScale = Number(Math.max(0.55, Math.min(1.55, 0.55 + (totalMl / 160) * 1.0)).toFixed(3));
  const stirAngularStep = Number(((rpm / 60) * 0.22).toFixed(4));

  return {
    buretteFillFrac,
    flaskVolumeScale,
    stirAngularStep,
  };
}

export interface GalvanicCellVisualState {
  anodeMetalHex: number;
  cathodeMetalHex: number;
  anodeSolutionHex: number;
  cathodeSolutionHex: number;
  anodeSolutionOpacity: number;
  cathodeSolutionOpacity: number;
  /** +1 means spontaneous e- flow left->right (anode to cathode); -1 means reversed */
  electronFlowSign: number;
  /** Normalized drift speed proportional to |E_cell| */
  electronSpeed: number;
  /** Relative thickness multiplier (<1 as anode oxidizes/dissolves) */
  anodeWidthScale: number;
  /** Relative thickness multiplier (>1 as cathode plates solid metal) */
  cathodeWidthScale: number;
}

/**
 * Synchronizes Galvanic/Voltaic cell electrode metals, electrolyte concentrations,
 * Nernst voltage-driven electron flow direction/speed, and electrode plating/dissolution.
 */
export function computeGalvanicCellVisualState(
  redoxPairId: string,
  cellPotentialV: number,
  anodeConcM: number,
  cathodeConcM: number,
  simTimeSec: number
): GalvanicCellVisualState {
  let anodeMetalHex = 0x94a3b8; // Zn silvery-gray
  let cathodeMetalHex = 0xd97706; // Cu reddish-copper
  let anodeSolutionHex = 0xe0f2fe; // ZnSO4 clear pale blue-white
  let cathodeSolutionHex = 0x0284c7; // CuSO4 rich azure blue

  if (redoxPairId === 'mg-ag-high') {
    anodeMetalHex = 0xe2e8f0; // Mg bright silver-white
    cathodeMetalHex = 0xf1f5f9; // Ag gleaming silver
    anodeSolutionHex = 0xf1f5f9; // Mg(NO3)2 clear
    cathodeSolutionHex = 0xcbd5e1; // AgNO3 clear silvery
  } else if (redoxPairId === 'fe-cu-volta') {
    anodeMetalHex = 0x64748b; // Fe dark steel gray
    cathodeMetalHex = 0xd97706; // Cu copper
    anodeSolutionHex = 0x86efac; // FeSO4 pale green
    cathodeSolutionHex = 0x0284c7; // CuSO4 azure blue
  } else if (redoxPairId === 'ni-ag-volta') {
    anodeMetalHex = 0xa8a29e; // Ni warm nickel silver
    cathodeMetalHex = 0xf1f5f9; // Ag silver
    anodeSolutionHex = 0x34d399; // NiSO4 emerald green
    cathodeSolutionHex = 0xcbd5e1; // AgNO3 clear
  }

  const cA = Math.max(0.01, Math.min(2.5, Number.isFinite(anodeConcM) ? anodeConcM : 1.0));
  const cC = Math.max(0.01, Math.min(2.5, Number.isFinite(cathodeConcM) ? cathodeConcM : 1.0));
  const eCell = Number.isFinite(cellPotentialV) ? cellPotentialV : 1.1;

  const anodeSolutionOpacity = Number(Math.min(0.82, Math.max(0.22, 0.24 + (cA / 2.0) * 0.45)).toFixed(3));
  const cathodeSolutionOpacity = Number(Math.min(0.88, Math.max(0.26, 0.28 + (cC / 2.0) * 0.52)).toFixed(3));

  const electronFlowSign = Math.abs(eCell) < 0.01 ? 0 : Math.sign(eCell);
  const electronSpeed = Number(Math.min(2.4, Math.abs(eCell) * 0.85).toFixed(3));

  // Progressive visible oxidation (thinning) & reduction plating (thickening) capped cleanly
  const platingProgress = Math.min(1, (Math.max(0, simTimeSec) * Math.abs(eCell)) / 35);
  const sign = electronFlowSign || 1;
  const anodeWidthScale = Number((1 - sign * 0.22 * platingProgress).toFixed(3));
  const cathodeWidthScale = Number((1 + sign * 0.26 * platingProgress).toFixed(3));

  return {
    anodeMetalHex,
    cathodeMetalHex,
    anodeSolutionHex,
    cathodeSolutionHex,
    anodeSolutionOpacity,
    cathodeSolutionOpacity,
    electronFlowSign,
    electronSpeed,
    anodeWidthScale,
    cathodeWidthScale,
  };
}

export interface ElectrolysisVisualState {
  electrolyteId: 'cuso4' | 'agno3' | 'znso4' | 'niso4';
  metalSymbol: string;
  solutionHex: number;
  depositMetalHex: number;
  cathodePlatingThicknessScale: number;
  anodeBubbleSpeed: number;
  electronDriftSpeed: number;
  ammeterNeedleAngleRad: number;
  massDepositedG: number;
  anodeGasO2Ml: number;
  chargeC: number;
}

/**
 * Synchronizes 3D Electrolysis Tank solution color, cathode metallic electroplating thickness
 * (∝ m = Ar·I·t / n·F), inert anode O₂ bubble rate (∝ I), and DC ammeter dial angle.
 */
export function computeElectrolysisVisualState(
  params: {
    electrolysisElectrolyteId?: 'cuso4' | 'agno3' | 'znso4' | 'niso4';
    electrolysisCurrentA?: number;
    electrolysisTimeMin?: number;
    electrolysisMolarMass?: number;
    electrolysisValenceN?: number;
  },
  metrics: {
    electrolysisChargeC?: number;
    electrolysisMassDepositedG?: number;
    electrolysisAnodeGasMl?: number;
  },
  simTimeSec: number
): ElectrolysisVisualState {
  const preset =
    ELECTROLYSIS_PRESETS.find((e) => e.id === params.electrolysisElectrolyteId) ??
    ELECTROLYSIS_PRESETS[0];

  const currentA = Math.max(0.1, Math.min(10, params.electrolysisCurrentA ?? 2.5));
  const timeMin = Math.max(1, params.electrolysisTimeMin ?? 30);
  const ar = Math.max(1, params.electrolysisMolarMass ?? preset.molarMassAr);
  const n = Math.max(1, params.electrolysisValenceN ?? preset.valenceN);

  const chargeC = metrics.electrolysisChargeC ?? currentA * timeMin * 60;
  const massDepositedG = metrics.electrolysisMassDepositedG ?? (ar * chargeC) / (n * 96485);
  const anodeGasO2Ml = metrics.electrolysisAnodeGasMl ?? ((chargeC / 96485) / 4) * 22414;

  const solutionHex = parseInt(preset.solutionColorHex.replace('#', ''), 16);
  const depositMetalHex = parseInt(preset.plateColorHex.replace('#', ''), 16);

  // Visually smooth plating thickness: grows with simTimeSec and scales with deposited mass m
  const timeRamp = Math.min(1, 0.25 + Math.max(0, simTimeSec) / 10);
  const massFactor = Math.min(1.8, massDepositedG / 5.5);
  const cathodePlatingThicknessScale = Number((1 + massFactor * timeRamp * 0.85).toFixed(3));

  const anodeBubbleSpeed = Number((0.45 + (currentA / 8) * 1.9).toFixed(3));
  const electronDriftSpeed = Number((0.35 + (currentA / 8) * 1.65).toFixed(3));
  const ammeterFrac = Math.max(0, Math.min(1, currentA / 8.0));
  const ammeterNeedleAngleRad = Number((Math.PI * 0.36 - ammeterFrac * Math.PI * 0.72).toFixed(4));

  return {
    electrolyteId: preset.id,
    metalSymbol: preset.metalSymbol,
    solutionHex,
    depositMetalHex,
    cathodePlatingThicknessScale,
    anodeBubbleSpeed,
    electronDriftSpeed,
    ammeterNeedleAngleRad,
    massDepositedG: Number(massDepositedG.toFixed(3)),
    anodeGasO2Ml: Number(anodeGasO2Ml.toFixed(1)),
    chargeC: Number(chargeC.toFixed(0)),
  };
}

