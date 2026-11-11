import {
  calculateLinearRegression,
  type AstronomyMode,
  type AstronomyParams,
  type BiologyMode,
  type BiologyParams,
  type ChemistryMode,
  type ChemistryParams,
  type DrLabMuEducationLevel,
  type DrLabMuStructuredResponse,
  type DrLabMuTelemetryPayload,
  type ExperimentRecord,
  type PhysicsMode,
  type PhysicsParams,
  type ScienceDomain,
} from './scienceEngine';

export interface RecordsRegressionSummary {
  hasRegression: boolean;
  pointsCount: number;
  rSquared: number;
  slope: number;
  intercept: number;
  equation: string;
  isLowR2Alert: boolean;
}

export interface ReplayParameterRestore {
  domain: ScienceDomain;
  physicsPatch?: Partial<PhysicsParams>;
  chemistryPatch?: Partial<ChemistryParams>;
  biologyPatch?: Partial<BiologyParams>;
  astronomyPatch?: Partial<AstronomyParams>;
  matchedKeysCount: number;
}

export interface GeminiSocraticJsonPayload {
  observasiSingkat: string;
  insightKonseptual: string;
  pertanyaanPemantik: string;
  hasAnomaly?: boolean;
}

/**
 * Compute consistent OLS linear regression summary and low-R² anomaly flag
 * across telemetry headers, LKS worksheets, and exam auto-submissions.
 */
export function computeRecordsRegressionSummary(
  records: ExperimentRecord[],
  rSquaredAlertThreshold = 0.85
): RecordsRegressionSummary {
  const points = records
    .filter(
      (r) =>
        typeof r.numericX === 'number' &&
        typeof r.numericY1 === 'number' &&
        Number.isFinite(r.numericX) &&
        Number.isFinite(r.numericY1)
    )
    .map((r) => ({ x: r.numericX as number, y: r.numericY1 as number }));

  if (points.length < 2) {
    return {
      hasRegression: false,
      pointsCount: points.length,
      rSquared: points.length === 1 ? 1 : 0,
      slope: 0,
      intercept: points.length === 1 ? Number(points[0].y.toFixed(3)) : 0,
      equation: points.length === 1 ? `y = ${points[0].y.toFixed(2)}` : 'N/A',
      isLowR2Alert: false,
    };
  }

  const reg = calculateLinearRegression(points);
  return {
    hasRegression: true,
    pointsCount: points.length,
    rSquared: Number(reg.rSquared.toFixed(4)),
    slope: Number(reg.slopeM.toFixed(4)),
    intercept: Number(reg.interceptC.toFixed(4)),
    equation: reg.equationString,
    isLowR2Alert: points.length >= 3 && reg.rSquared < rSquaredAlertThreshold,
  };
}

function extractNumericToken(summary: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1].replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function inferPhysicsMode(rec: ExperimentRecord): PhysicsMode | undefined {
  const hint = `${rec.experimentTitle} ${rec.parametersSummary}`.toLowerCase();
  if (hint.includes('pegas') || hint.includes('hooke') || hint.includes('k=')) return 'spring-hooke';
  if (hint.includes('bandul') || hint.includes('pendulum')) return 'pendulum-harmonic';
  if (hint.includes('parabola') || hint.includes('proyektil') || hint.includes('v₀') || hint.includes('v0=')) {
    return 'projectile-gravity';
  }
  if (hint.includes('tumbukan') || hint.includes('momentum')) return 'collision-momentum';
  if (hint.includes('stokes') || hint.includes('viskositas')) return 'stokes-viscosity';
  if (hint.includes('wheatstone') || hint.includes('ohm')) return 'ohm-wheatstone';
  if (hint.includes('young') || hint.includes('interferensi') || hint.includes('celah')) return 'optics-young-slit';
  if (hint.includes('fotolistrik') || hint.includes('planck')) return 'photoelectric-planck';
  if (hint.includes('gravitasi universal') || hint.includes('orbital')) return 'orbital-gravity';
  if (hint.includes('newton') || hint.includes('bidang miring') || hint.includes('f=')) return 'newton-incline';
  return undefined;
}

function inferChemistryMode(rec: ExperimentRecord): ChemistryMode | undefined {
  const hint = `${rec.experimentTitle} ${rec.parametersSummary}`.toLowerCase();
  if (hint.includes('titrasi') || hint.includes('asam') || hint.includes('vb=') || hint.includes('v_b=')) {
    return 'acid-base-titration';
  }
  if (hint.includes('galvani') || hint.includes('elektrokimia') || hint.includes('redoks') || hint.includes('anoda')) {
    return 'electrochemistry-cell';
  }
  if (hint.includes('boyle') || hint.includes('gas ideal')) return 'ideal-gas-boyle';
  if (hint.includes('arrhenius') || hint.includes('kinetika') || hint.includes('ea=')) {
    return 'reaction-kinetics-arrhenius';
  }
  if (hint.includes('spektro') || hint.includes('beer')) return 'spectrophotometry-beer';
  if (hint.includes('kalorimetri') || hint.includes('termo') || hint.includes('reaksi')) return 'thermo-calorimetry';
  return undefined;
}

function inferBiologyMode(rec: ExperimentRecord): BiologyMode | undefined {
  const hint = `${rec.experimentTitle} ${rec.parametersSummary}`.toLowerCase();
  if (hint.includes('fotosintesis') || hint.includes('ingenhousz')) return 'photosynthesis-ingenhousz';
  if (hint.includes('katalase')) return 'enzyme-catalase';
  if (hint.includes('enzim') || hint.includes('[s]=') || hint.includes('michaelis')) return 'enzyme-kinetics';
  if (hint.includes('lotka') || hint.includes('predator') || hint.includes('mangsa')) {
    return 'predator-prey-dynamics';
  }
  if (hint.includes('plasmolisis')) return 'osmosis-plasmolysis';
  if (hint.includes('osmosis') || hint.includes('sel') || hint.includes('tonisitas')) {
    return 'cell-osmosis-tonicity';
  }
  if (hint.includes('jantung') || hint.includes('kardio') || hint.includes('bpm')) {
    return 'anatomy-cardiovascular-heart';
  }
  if (hint.includes('paru') || hint.includes('respirasi') || hint.includes('spirometri')) {
    return 'anatomy-respiratory-lungs';
  }
  if (hint.includes('sinaps') || hint.includes('saraf') || hint.includes('potensial aksi')) {
    return 'anatomy-neural-synapse';
  }
  return undefined;
}

function inferAstronomyMode(rec: ExperimentRecord): AstronomyMode | undefined {
  const hint = `${rec.experimentTitle} ${rec.parametersSummary}`.toLowerCase();
  if (hint.includes('galaksi') || hint.includes('bima sakti') || hint.includes('dm=')) return 'milkyway-galaxy';
  if (hint.includes('eksoplanet') || hint.includes('transit') || hint.includes('rp=')) return 'stellar-exoplanet';
  if (hint.includes('wien') || hint.includes('benda hitam') || hint.includes('t*=')) return 'stellar-wien-spectrum';
  if (hint.includes('hubble') || hint.includes('ekspansi') || hint.includes('h₀=') || hint.includes('h0=')) {
    return 'hubble-expansion';
  }
  if (hint.includes('kepler') || hint.includes('orbit') || hint.includes('a=')) return 'solar-kepler';
  return undefined;
}

/**
 * Parse a recorded observation's parameter summary into partial domain simulator patches
 * so clicking "Replay ke Ruang 3D" restores the experimental setup.
 */
export function parseReplayParameters(rec: ExperimentRecord): ReplayParameterRestore {
  const summary = rec.parametersSummary || '';

  if (rec.domain === 'Fisika') {
    const patch: Partial<PhysicsParams> = {};
    const mode = inferPhysicsMode(rec);
    if (mode) patch.mode = mode;

    const mass = extractNumericToken(summary, [/\bm\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const force = extractNumericToken(summary, [/\bF\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const angle = extractNumericToken(summary, [/[θ∠]\s*=\s*(-?\d+(?:[.,]\d+)?)/i, /\bsudut\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const v0 = extractNumericToken(summary, [/\bv[₀0]\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const k = extractNumericToken(summary, [/\bk\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const xDisp = extractNumericToken(summary, [/\bx\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const pendLen = extractNumericToken(summary, [/\bL\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const wavelength = extractNumericToken(summary, [/[λ]\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const voltage = extractNumericToken(summary, [/\bV\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const visc = extractNumericToken(summary, [/[η]\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);

    if (mass !== undefined) patch.mass = mass;
    if (force !== undefined) patch.appliedForce = force;
    if (angle !== undefined) {
      if (mode === 'projectile-gravity') patch.launchAngle = angle;
      else if (mode === 'pendulum-harmonic') patch.pendulumAngle = angle;
      else patch.inclineAngle = angle;
    }
    if (v0 !== undefined) patch.initialVelocity = v0;
    if (k !== undefined) patch.springConstantK = k;
    if (xDisp !== undefined) patch.springDisplacement = xDisp;
    if (pendLen !== undefined) patch.pendulumLength = pendLen;
    if (wavelength !== undefined) patch.lightWavelength = wavelength;
    if (voltage !== undefined) patch.circuitVoltage = voltage;
    if (visc !== undefined) patch.fluidViscosity = visc;

    return {
      domain: 'Fisika',
      physicsPatch: patch,
      matchedKeysCount: Object.keys(patch).length,
    };
  }

  if (rec.domain === 'Kimia') {
    const patch: Partial<ChemistryParams> = {};
    const mode = inferChemistryMode(rec);
    if (mode) patch.mode = mode;

    const temp = extractNumericToken(summary, [/\bT\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const vol = extractNumericToken(summary, [/\bV\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const va = extractNumericToken(summary, [/\bVa\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const vb = extractNumericToken(summary, [/\bV_?b\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const ma = extractNumericToken(summary, [/\bMa\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const mb = extractNumericToken(summary, [/\bMb\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const conc = extractNumericToken(summary, [/\[C\]\s*=\s*(-?\d+(?:[.,]\d+)?)/i, /\bC\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const ea = extractNumericToken(summary, [/\bEa\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const nMol = extractNumericToken(summary, [/\bn\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);

    if (temp !== undefined) {
      if (mode === 'ideal-gas-boyle') patch.gasTemperatureK = temp;
      else if (mode === 'reaction-kinetics-arrhenius') patch.kineticsTempC = temp;
      else patch.initialTempC = temp;
    }
    if (vol !== undefined) {
      if (mode === 'ideal-gas-boyle') patch.gasVolumeL = vol;
      else patch.solutionVolumeMl = vol;
    }
    if (va !== undefined) patch.analyteVolumeMl = va;
    if (vb !== undefined) patch.titrantAddedMl = vb;
    if (ma !== undefined) patch.analyteAcidConc = ma;
    if (mb !== undefined) patch.titrantBaseConc = mb;
    if (conc !== undefined) {
      if (mode === 'spectrophotometry-beer') patch.spectroConcMm = conc;
      else patch.reactantConcentration = conc;
    }
    if (ea !== undefined) patch.kineticsEaKj = ea;
    if (nMol !== undefined) patch.gasMoles = nMol;

    return {
      domain: 'Kimia',
      chemistryPatch: patch,
      matchedKeysCount: Object.keys(patch).length,
    };
  }

  if (rec.domain === 'Biologi') {
    const patch: Partial<BiologyParams> = {};
    const mode = inferBiologyMode(rec);
    if (mode) patch.mode = mode;

    const sub = extractNumericToken(summary, [/\[S\]\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const temp = extractNumericToken(summary, [/\bT\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const ph = extractNumericToken(summary, [/\bpH\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const prey = extractNumericToken(summary, [/\bX\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const pred = extractNumericToken(summary, [/\bY\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const extMol = extractNumericToken(summary, [/\bMe\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
    const hr = extractNumericToken(summary, [/\bHR\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);

    if (sub !== undefined) patch.substrateConcMm = sub;
    if (temp !== undefined) patch.temperatureC = temp;
    if (ph !== undefined) patch.solutionPh = ph;
    if (prey !== undefined) patch.preyPopulationX = prey;
    if (pred !== undefined) patch.predatorPopulationY = pred;
    if (extMol !== undefined) patch.extracellularMolarityM = extMol;
    if (hr !== undefined) patch.heartRateBpm = hr;

    return {
      domain: 'Biologi',
      biologyPatch: patch,
      matchedKeysCount: Object.keys(patch).length,
    };
  }

  const patch: Partial<AstronomyParams> = {};
  const mode = inferAstronomyMode(rec);
  if (mode) patch.mode = mode;

  const semiMajor = extractNumericToken(summary, [/\ba\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const ecc = extractNumericToken(summary, [/\be\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const radiusKpc = extractNumericToken(summary, [/\bR\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const dm = extractNumericToken(summary, [/\bDM\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const rp = extractNumericToken(summary, [/\bRp\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const rStar = extractNumericToken(summary, [/\bR\*\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const tStar = extractNumericToken(summary, [/\bT\*\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const distMpc = extractNumericToken(summary, [/\bd\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);
  const h0 = extractNumericToken(summary, [/\bH[₀0]\s*=\s*(-?\d+(?:[.,]\d+)?)/i]);

  if (semiMajor !== undefined) patch.customSemiMajorAxisAu = semiMajor;
  if (ecc !== undefined) patch.customEccentricity = ecc;
  if (radiusKpc !== undefined) patch.galactocentricRadiusKpc = radiusKpc;
  if (dm !== undefined) patch.darkMatterHaloFraction = dm;
  if (rp !== undefined) patch.exoplanetRadiusEarth = rp;
  if (rStar !== undefined) patch.starRadiusSolar = rStar;
  if (tStar !== undefined) patch.starEffectiveTempK = tStar;
  if (distMpc !== undefined) patch.galaxyDistanceMpc = distMpc;
  if (h0 !== undefined) patch.hubbleConstantH0 = h0;

  return {
    domain: 'Astronomi',
    astronomyPatch: patch,
    matchedKeysCount: Object.keys(patch).length,
  };
}

function normalizeEducationLevel(rawLevel: unknown): DrLabMuEducationLevel {
  if (typeof rawLevel !== 'string') return 'SMA';
  const lower = rawLevel.toLowerCase().trim();
  if (lower === 'smp') return 'SMP';
  if (lower === 'perguruan tinggi' || lower === 'mahasiswa' || lower === 'university') {
    return 'Perguruan Tinggi';
  }
  return 'SMA';
}

/**
 * Accepts both nested `{ telemetry: DrLabMuTelemetryPayload }` (used by `useDrLabMuChat`)
 * and flat `DrLabMuTelemetryPayload` request payloads.
 */
export function normalizeDrLabMuRequest(body: unknown): DrLabMuTelemetryPayload | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const raw =
    record.telemetry && typeof record.telemetry === 'object'
      ? (record.telemetry as Record<string, unknown>)
      : record;

  if (typeof raw.domain !== 'string' || !raw.domain.trim()) {
    return null;
  }

  const rawAnalytics =
    raw.analytics && typeof raw.analytics === 'object'
      ? (raw.analytics as Record<string, unknown>)
      : {};

  return {
    domain: raw.domain as ScienceDomain,
    topic:
      typeof raw.topic === 'string'
        ? raw.topic
        : typeof raw.moduleId === 'string'
        ? raw.moduleId
        : 'umum',
    educationLevel: normalizeEducationLevel(raw.educationLevel ?? raw.educationTier),
    currentParameters:
      raw.currentParameters && typeof raw.currentParameters === 'object'
        ? (raw.currentParameters as DrLabMuTelemetryPayload['currentParameters'])
        : raw.currentParams && typeof raw.currentParams === 'object'
        ? (raw.currentParams as DrLabMuTelemetryPayload['currentParameters'])
        : {},
    recordedData: Array.isArray(raw.recordedData)
      ? (raw.recordedData as DrLabMuTelemetryPayload['recordedData'])
      : [],
    analytics: {
      rSquared: typeof rawAnalytics.rSquared === 'number' ? rawAnalytics.rSquared : 0,
      slope: typeof rawAnalytics.slope === 'number' ? rawAnalytics.slope : 0,
      intercept: typeof rawAnalytics.intercept === 'number' ? rawAnalytics.intercept : 0,
      stdDev: typeof rawAnalytics.stdDev === 'number' ? rawAnalytics.stdDev : 0,
      equation: typeof rawAnalytics.equation === 'string' ? rawAnalytics.equation : 'N/A',
      hasExtremeOutlier: Boolean(rawAnalytics.hasExtremeOutlier),
      outlierTrial:
        rawAnalytics.outlierTrial && typeof rawAnalytics.outlierTrial === 'object'
          ? (rawAnalytics.outlierTrial as DrLabMuTelemetryPayload['analytics']['outlierTrial'])
          : undefined,
    },
    studentQuery: typeof raw.studentQuery === 'string' ? raw.studentQuery : '',
  };
}

/**
 * Formats either a Gemini JSON response or deterministic `DrLabMuStructuredResponse`
 * into the contract expected by `useDrLabMuChat` (`{ source, response, ... }`).
 */
export function formatDrLabMuAskPayload(
  input: DrLabMuStructuredResponse | GeminiSocraticJsonPayload,
  source: 'gemini-api' | 'socratic-engine'
): {
  source: 'gemini-api' | 'socratic-engine';
  response: DrLabMuStructuredResponse;
} & DrLabMuStructuredResponse {
  if ('observation' in input && 'socraticQuestion' in input) {
    return {
      source,
      response: input,
      ...input,
    };
  }

  const structured: DrLabMuStructuredResponse = {
    observation: input.observasiSingkat,
    dataHighlight: input.insightKonseptual,
    socraticQuestion: input.pertanyaanPemantik,
    detectedTrigger: input.hasAnomaly ? 'anomaly-outlier' : 'concept-analogy',
    formattedText: `1. Observasi Singkat:\n${input.observasiSingkat}\n\n2. Insight / Analogi Konseptual:\n${input.insightKonseptual}\n\n3. Pertanyaan Pemantik:\n💡 ${input.pertanyaanPemantik}`,
  };

  return {
    source,
    response: structured,
    ...structured,
  };
}
