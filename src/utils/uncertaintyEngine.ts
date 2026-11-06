/**
 * Realistic Instrument Uncertainty & Noise Engine
 * Implements Gaussian measurement noise via Box-Muller transform
 * and instrument uncertainty propagation for authentic lab education.
 */

export interface InstrumentSpecs {
  type: 'stopwatch' | 'ruler' | 'burette' | 'thermometer' | 'voltmeter' | 'dynamometer';
  smallestScaleDivision: number; // NST (Nilai Skala Terkecil), e.g., 0.01s, 0.05mL
  systematicBias?: number;       // Calibration offset, default 0
  humanReactionSigma?: number;   // Optional human reflex jitter (e.g., 0.12s for manual stopwatch)
  unit: string;
}

export const DEFAULT_INSTRUMENTS: Record<InstrumentSpecs['type'], InstrumentSpecs> = {
  stopwatch: {
    type: 'stopwatch',
    smallestScaleDivision: 0.01, // 0.01 s
    systematicBias: 0,
    humanReactionSigma: 0.12, // 0.12 s human reflex jitter
    unit: 's',
  },
  ruler: {
    type: 'ruler',
    smallestScaleDivision: 0.001, // 1 mm = 0.001 m
    systematicBias: 0,
    unit: 'm',
  },
  burette: {
    type: 'burette',
    smallestScaleDivision: 0.05, // 0.05 mL
    systematicBias: 0,
    unit: 'mL',
  },
  thermometer: {
    type: 'thermometer',
    smallestScaleDivision: 0.1, // 0.1 °C
    systematicBias: 0,
    unit: '°C',
  },
  voltmeter: {
    type: 'voltmeter',
    smallestScaleDivision: 0.01, // 0.01 V
    systematicBias: 0,
    unit: 'V',
  },
  dynamometer: {
    type: 'dynamometer',
    smallestScaleDivision: 0.1, // 0.1 N
    systematicBias: 0,
    unit: 'N',
  },
};

export interface MeasurementResult {
  measuredValue: number;
  uncertainty: number;
  relativeErrorPct: number;
  noiseAdded: number;
}

/**
 * Computes standard normal Gaussian variate using Box-Muller transform.
 * Accepts optional uniform [0, 1) random numbers (u1, u2) for deterministic unit testing.
 */
export function boxMullerGaussian(u1?: number, u2?: number): number {
  const randU1 = Math.max(1e-15, u1 !== undefined ? u1 : Math.random());
  const randU2 = u2 !== undefined ? u2 : Math.random();
  return Math.sqrt(-2.0 * Math.log(randU1)) * Math.cos(2.0 * Math.PI * randU2);
}

/**
 * Applies realistic measurement uncertainty and random Gaussian noise to a true value.
 * When enabled is false, returns zero noise and exact true value.
 */
export function applyInstrumentNoise(
  trueValue: number,
  spec: InstrumentSpecs,
  enabled: boolean,
  u1?: number,
  u2?: number
): MeasurementResult {
  const halfScale = spec.smallestScaleDivision / 2;

  if (!enabled) {
    return {
      measuredValue: trueValue,
      uncertainty: 0,
      relativeErrorPct: 0,
      noiseAdded: 0,
    };
  }

  const z0 = boxMullerGaussian(u1, u2);
  const sigma = halfScale + (spec.humanReactionSigma ?? 0);
  const bias = spec.systematicBias ?? 0;
  const noiseAdded = z0 * sigma + bias;
  const measuredValue = Number((trueValue + noiseAdded).toFixed(4));
  const relativeErrorPct =
    trueValue !== 0
      ? Number((Math.abs(measuredValue - trueValue) / Math.abs(trueValue) * 100).toFixed(3))
      : 0;

  return {
    measuredValue,
    uncertainty: Number(halfScale.toFixed(4)),
    relativeErrorPct,
    noiseAdded: Number(noiseAdded.toFixed(4)),
  };
}

/**
 * Formats a measurement result in standard scientific notation with uncertainty (x ± Δx) unit.
 */
export function formatMeasurementWithUncertainty(
  measuredValue: number,
  uncertainty: number,
  unit = '',
  relativeErrorPct?: number
): string {
  const unitSuffix = unit ? ` ${unit}` : '';
  const errorSuffix = relativeErrorPct !== undefined ? ` (${relativeErrorPct}%)` : '';
  if (uncertainty <= 0) {
    return `${measuredValue}${unitSuffix}`;
  }
  return `(${measuredValue} ± ${uncertainty})${unitSuffix}${errorSuffix}`;
}

