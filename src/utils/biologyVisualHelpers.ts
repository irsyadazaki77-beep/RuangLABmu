export type OsmosisTonicityState = 'hypotonic' | 'isotonic' | 'hypertonic';

export interface OsmosisVisualState {
  state: OsmosisTonicityState;
  protoplastScale: number;
  vacuoleScale: number;
  membraneDetachment: number;
  cyclosisSpeed: number;
}

export type EcosystemBalanceStatus = 'seimbang' | 'ledakan_mangsa' | 'tekanan_predasi';

export interface EcosystemVisualCounts {
  preyInstances: number;
  predatorInstances: number;
  status: EcosystemBalanceStatus;
}

/**
 * Derives plant-cell turgor, central vacuole size, membrane detachment, and cytoplasmic streaming speed
 * from external sucrose concentration (isotonic baseline ~0.28 M).
 */
export function computeOsmosisVisualState(sucroseConcMolar: number): OsmosisVisualState {
  const c = Number.isFinite(sucroseConcMolar) ? Math.max(0, Math.min(1.5, sucroseConcMolar)) : 0.3;

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

  return {
    state,
    protoplastScale: Number(protoplastScale.toFixed(3)),
    vacuoleScale: Number(vacuoleScale.toFixed(3)),
    membraneDetachment: Number(membraneDetachment.toFixed(3)),
    cyclosisSpeed: Number(cyclosisSpeed.toFixed(3)),
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
 * Maps catalase solution pH (2..12) to a universal colorimetric reagent tint hex.
 */
export function computeCatalasePhHex(solutionPH: number): number {
  const ph = Number.isFinite(solutionPH) ? Math.max(2, Math.min(12, solutionPH)) : 7;
  if (ph < 5.5) return 0xf59e0b; // Acidic amber-orange
  if (ph <= 8.2) return 0xef4444; // Neutral catalase heme-crimson
  return 0x8b5cf6; // Alkaline violet
}

/**
 * Computes accumulated O2 gas pocket height fraction (0.15..0.95) in the Ingenhousz inverted tube.
 */
export function computePhotosynthesisGasLevel(
  lightIntensityLux: number,
  wavelengthNm: number,
  bicarbonateConc = 2.5
): number {
  const lux = Number.isFinite(lightIntensityLux) ? Math.max(0, lightIntensityLux) : 1200;
  const nm = Number.isFinite(wavelengthNm) ? wavelengthNm : 660;
  const co2 = Number.isFinite(bicarbonateConc) ? Math.max(0, bicarbonateConc) : 2.5;

  const bluePeak = Math.exp(-Math.pow((nm - 435) / 35, 2));
  const redPeak = Math.exp(-Math.pow((nm - 660) / 40, 2));
  const efficiency = Math.min(1.0, 0.12 + 0.88 * Math.max(bluePeak, redPeak));
  const lightFactor = lux / (lux + 600);
  const co2Factor = (co2 + 0.1) / (co2 + 1.2);

  const level = 0.16 + 0.78 * lightFactor * efficiency * co2Factor;
  return Number(Math.max(0.16, Math.min(0.95, level)).toFixed(3));
}
