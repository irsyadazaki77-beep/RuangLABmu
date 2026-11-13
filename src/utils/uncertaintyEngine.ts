/**
 * Realistic Instrument Uncertainty & Noise Engine
 * Implements Gaussian measurement noise via Box-Muller transform
 * and instrument uncertainty propagation for authentic lab education.
 */

export interface InstrumentSpecs {
  type?: 'stopwatch' | 'ruler' | 'burette' | 'thermometer' | 'voltmeter' | 'dynamometer' | 'phMeter' | 'opticalSensor';
  name: string;
  smallestScaleDivision: number; // NST (Nilai Skala Terkecil), e.g., 0.01s, 0.05mL
  uncertaintyDelta: number;      // ½ NST default uncertainty
  precisionDecimals?: number;
  systematicBias?: number;       // Calibration offset, default 0
  humanReactionSigma?: number;   // Optional human reflex jitter (e.g., 0.12s for manual stopwatch)
  unit: string;
}

export const DEFAULT_INSTRUMENTS: Record<
  'stopwatch' | 'ruler' | 'burette' | 'thermometer' | 'voltmeter' | 'dynamometer' | 'phMeter' | 'opticalSensor',
  InstrumentSpecs
> = {
  stopwatch: {
    type: 'stopwatch',
    name: 'Stopwatch Digital Kuarsa',
    smallestScaleDivision: 0.01, // 0.01 s
    uncertaintyDelta: 0.005,
    precisionDecimals: 2,
    systematicBias: 0,
    humanReactionSigma: 0.12, // 0.12 s human reflex jitter
    unit: 's',
  },
  ruler: {
    type: 'ruler',
    name: 'Mistar & Mikrometer Sekrup',
    smallestScaleDivision: 0.001, // 1 mm = 0.001 m
    uncertaintyDelta: 0.0005,
    precisionDecimals: 3,
    systematicBias: 0,
    unit: 'm',
  },
  burette: {
    type: 'burette',
    name: 'Buret Volumetrik Kelas A',
    smallestScaleDivision: 0.05, // 0.05 mL
    uncertaintyDelta: 0.025,
    precisionDecimals: 2,
    systematicBias: 0,
    unit: 'mL',
  },
  thermometer: {
    type: 'thermometer',
    name: 'Termometer Digital Kalorimeter',
    smallestScaleDivision: 0.1, // 0.1 °C
    uncertaintyDelta: 0.05,
    precisionDecimals: 2,
    systematicBias: 0,
    unit: '°C',
  },
  voltmeter: {
    type: 'voltmeter',
    name: 'Multimeter Potensiostat Digital',
    smallestScaleDivision: 0.01, // 0.01 V
    uncertaintyDelta: 0.005,
    precisionDecimals: 3,
    systematicBias: 0,
    unit: 'V',
  },
  dynamometer: {
    type: 'dynamometer',
    name: 'Neraca Pegas (Dinamometer)',
    smallestScaleDivision: 0.1, // 0.1 N
    uncertaintyDelta: 0.05,
    precisionDecimals: 2,
    systematicBias: 0,
    unit: 'N',
  },
  phMeter: {
    type: 'phMeter',
    name: 'Elektroda pH Meter Digital & Buret',
    smallestScaleDivision: 0.02, // 0.02 pH
    uncertaintyDelta: 0.01,
    precisionDecimals: 2,
    systematicBias: 0,
    unit: 'pH',
  },
  opticalSensor: {
    type: 'opticalSensor',
    name: 'Sensor Bioreaktor & Fotometer Optik',
    smallestScaleDivision: 0.1,
    uncertaintyDelta: 0.05,
    precisionDecimals: 2,
    systematicBias: 0,
    unit: '',
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

export interface InstrumentCalibrationConfig {
  enabled: boolean;
  zeroOffsetBias: number; // Systematic offset before tare (e.g. +0.15 or -0.08)
  isZeroCalibrated: boolean; // True once student clicks "Kalibrasi Nol (Tare)"
  precisionTier: 'standard' | 'high-precision';
}

export const DEFAULT_CALIBRATION_CONFIG: InstrumentCalibrationConfig = {
  enabled: false,
  zeroOffsetBias: 0.12,
  isZeroCalibrated: false,
  precisionTier: 'standard',
};

/**
 * Applies realistic measurement uncertainty, systematic zero-offset bias (if uncalibrated),
 * and random Gaussian noise to a true value.
 */
export function applyInstrumentNoise(
  trueValue: number,
  spec: InstrumentSpecs,
  enabled: boolean,
  u1OrCalibration?: number | InstrumentCalibrationConfig,
  u2?: number,
  calibrationArg?: InstrumentCalibrationConfig
): MeasurementResult {
  const calibration: InstrumentCalibrationConfig | undefined =
    typeof u1OrCalibration === 'object' && u1OrCalibration !== null
      ? u1OrCalibration
      : calibrationArg;
  const u1: number | undefined =
    typeof u1OrCalibration === 'number' ? u1OrCalibration : undefined;

  const precisionFactor = calibration?.precisionTier === 'high-precision' ? 0.25 : 1.0;
  const baseNst = spec.smallestScaleDivision ?? spec.uncertaintyDelta * 2;
  const effectiveNst = baseNst * precisionFactor;
  const halfScale = effectiveNst / 2;

  if (!enabled) {
    return {
      measuredValue: trueValue,
      uncertainty: 0,
      relativeErrorPct: 0,
      noiseAdded: 0,
    };
  }

  const z0 = boxMullerGaussian(u1, u2);
  const sigma = halfScale + (spec.humanReactionSigma ?? 0) * precisionFactor;
  const activeBias = calibration
    ? calibration.isZeroCalibrated
      ? 0
      : calibration.zeroOffsetBias
    : spec.systematicBias ?? 0;

  const noiseAdded = z0 * sigma + activeBias;
  const measuredValue = Number((trueValue + noiseAdded).toFixed(4));
  const relativeErrorPct =
    trueValue !== 0
      ? Number(((Math.abs(measuredValue - trueValue) / Math.abs(trueValue)) * 100).toFixed(3))
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

export interface MeasurementErrorSummary {
  n: number;
  mean: number;
  min: number;
  max: number;
  sampleStdDev: number;
  standardErrorMean: number; // Type A uncertainty u_A = s / sqrt(n)
  instrumentUncertainty: number; // Type B uncertainty u_B = NST / 2
  combinedUncertainty: number; // sqrt(u_A^2 + u_B^2)
  relativeUncertaintyPct: number; // (combinedUncertainty / |mean|) * 100
  percentErrorVsTheory?: number; // |mean - theory| / |theory| * 100
  precisionGrade:
    | 'Sangat Presisi'
    | 'Presisi Baik'
    | 'Cukup Presisi'
    | 'Perlu Pengulangan'
    | 'Data Belum Mencukupi';
  recommendedSignificantFigures: number;
}

/**
 * Computes Type A (statistical std dev / standard error) and Type B (1/2 NST)
 * uncertainties plus relative uncertainty & percent error against theory.
 */
export function computeMeasurementErrorSummary(
  rawValues: number[],
  theoreticalValue?: number,
  nst = 0.01
): MeasurementErrorSummary {
  const values = rawValues.filter((v) => Number.isFinite(v));
  const n = values.length;
  const safeNst = Math.max(0, Number.isFinite(nst) ? nst : 0.01);
  const instrumentUncertainty = Number((safeNst / 2).toFixed(5));

  if (n === 0) {
    return {
      n: 0,
      mean: 0,
      min: 0,
      max: 0,
      sampleStdDev: 0,
      standardErrorMean: 0,
      instrumentUncertainty,
      combinedUncertainty: instrumentUncertainty,
      relativeUncertaintyPct: 0,
      percentErrorVsTheory: undefined,
      precisionGrade: 'Data Belum Mencukupi',
      recommendedSignificantFigures: 2,
    };
  }

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const min = Math.min(...values);
  const max = Math.max(...values);

  let sampleStdDev = 0;
  let standardErrorMean = 0;
  if (n >= 2) {
    const sqDiffSum = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
    sampleStdDev = Math.sqrt(sqDiffSum / (n - 1));
    standardErrorMean = sampleStdDev / Math.sqrt(n);
  }

  const combinedUncertainty = Math.sqrt(
    standardErrorMean ** 2 + instrumentUncertainty ** 2
  );
  const denom = Math.max(1e-9, Math.abs(mean));
  const relativeUncertaintyPct =
    mean !== 0 ? (combinedUncertainty / denom) * 100 : 0;

  let percentErrorVsTheory: number | undefined = undefined;
  if (
    theoreticalValue !== undefined &&
    Number.isFinite(theoreticalValue) &&
    theoreticalValue !== 0
  ) {
    percentErrorVsTheory =
      (Math.abs(mean - theoreticalValue) / Math.abs(theoreticalValue)) * 100;
  } else if (theoreticalValue === 0) {
    percentErrorVsTheory = Math.abs(mean) * 100;
  }

  let precisionGrade: MeasurementErrorSummary['precisionGrade'] = 'Sangat Presisi';
  if (n < 2) {
    precisionGrade = 'Data Belum Mencukupi';
  } else if (relativeUncertaintyPct <= 1.0) {
    precisionGrade = 'Sangat Presisi';
  } else if (relativeUncertaintyPct <= 5.0) {
    precisionGrade = 'Presisi Baik';
  } else if (relativeUncertaintyPct <= 10.0) {
    precisionGrade = 'Cukup Presisi';
  } else {
    precisionGrade = 'Perlu Pengulangan';
  }

  // Standard rule of significant figures based on relative uncertainty
  let recommendedSignificantFigures = 4;
  if (relativeUncertaintyPct >= 10) {
    recommendedSignificantFigures = 2;
  } else if (relativeUncertaintyPct >= 1) {
    recommendedSignificantFigures = 3;
  }

  return {
    n,
    mean: Number(mean.toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    sampleStdDev: Number(sampleStdDev.toFixed(4)),
    standardErrorMean: Number(standardErrorMean.toFixed(4)),
    instrumentUncertainty,
    combinedUncertainty: Number(combinedUncertainty.toFixed(4)),
    relativeUncertaintyPct: Number(relativeUncertaintyPct.toFixed(2)),
    percentErrorVsTheory:
      percentErrorVsTheory !== undefined
        ? Number(percentErrorVsTheory.toFixed(2))
        : undefined,
    precisionGrade,
    recommendedSignificantFigures,
  };
}


