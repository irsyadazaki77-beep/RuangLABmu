import type { ExperimentModule, EducationTier, ScienceDomain } from '../registry/experimentRegistry';
import type { CurriculumChapter } from '../registry/curriculumChapters';
import type { ExperimentRecord } from './engines/statisticsAndRegression';

export interface TelemetrySeriesPoint {
  cursorIndex: number;
  t: number;
  primary: number;
  secondary?: number;
}

export interface ChapterFilterOptions {
  domain: ScienceDomain | 'all';
  searchQuery: string;
  modules: readonly ExperimentModule[];
}

export function filterCurriculumChapters(
  chapters: readonly CurriculumChapter[],
  options: ChapterFilterOptions
): CurriculumChapter[] {
  const q = options.searchQuery.trim().toLowerCase();
  return chapters.filter((ch) => {
    if (options.domain !== 'all' && ch.domain !== options.domain) return false;
    if (!q) return true;

    if (
      ch.title.toLowerCase().includes(q) ||
      ch.overviewDescription.toLowerCase().includes(q) ||
      ch.realWorldTheme.toLowerCase().includes(q) ||
      ch.coreCompetencies.some((c) => c.toLowerCase().includes(q))
    ) {
      return true;
    }

    return ch.moduleIds.some((id) => {
      const m = options.modules.find((exp) => exp.id === id);
      if (!m) return false;
      return (
        m.title.toLowerCase().includes(q) ||
        m.theorySummary.toLowerCase().includes(q) ||
        m.keyEquations.some((eq) => eq.toLowerCase().includes(q))
      );
    });
  });
}

export interface ModuleFilterOptions {
  domain: ScienceDomain | 'all';
  activeTier: EducationTier;
  searchQuery: string;
  chapterNumber?: number | 'all';
  respectTierFilter?: boolean;
}

export function filterExperimentModules(
  modules: readonly ExperimentModule[],
  options: ModuleFilterOptions
): ExperimentModule[] {
  const q = options.searchQuery.trim().toLowerCase();
  const chapterNum = options.chapterNumber ?? 'all';
  const respectTier = options.respectTierFilter ?? true;

  return modules.filter((mod) => {
    if (chapterNum !== 'all') {
      if (mod.chapterNumber !== chapterNum) return false;
    } else if (respectTier && !mod.supportedTiers.includes(options.activeTier)) {
      return false;
    }

    if (options.domain !== 'all' && mod.domain !== options.domain) return false;

    if (q) {
      const matchesTitle = mod.title.toLowerCase().includes(q);
      const matchesSub = mod.subCategory.toLowerCase().includes(q);
      const matchesTheory = mod.theorySummary.toLowerCase().includes(q);
      const matchesEq = mod.keyEquations.some((eq) => eq.toLowerCase().includes(q));
      if (!matchesTitle && !matchesSub && !matchesTheory && !matchesEq) return false;
    }

    return true;
  });
}

export function shouldConfirmLabExit(state: {
  recordsCount: number;
  timelineCount: number;
}): boolean {
  return state.recordsCount > 0 || state.timelineCount > 5;
}

export function extractNumericPair(snapshot: unknown): {
  primary: number;
  secondary?: number;
} | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const nums: number[] = [];
  for (const val of Object.values(snapshot as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      nums.push(val);
      if (nums.length >= 2) break;
    }
  }
  if (nums.length === 0) return null;
  return nums.length >= 2
    ? { primary: nums[0], secondary: nums[1] }
    : { primary: nums[0] };
}

export function decimateTelemetryFrames<TState>(
  frames: ReadonlyArray<{ simTime: number; stateSnapshot: TState }>,
  maxPoints = 96
): TelemetrySeriesPoint[] {
  const total = frames.length;
  if (total === 0 || maxPoints < 2) return [];

  const result: TelemetrySeriesPoint[] = [];
  if (total <= maxPoints) {
    for (let i = 0; i < total; i++) {
      const f = frames[i];
      const pair = extractNumericPair(f.stateSnapshot);
      if (!pair || !Number.isFinite(f.simTime)) continue;
      result.push({
        cursorIndex: i,
        t: Number(f.simTime.toFixed(3)),
        primary: pair.primary,
        secondary: pair.secondary,
      });
    }
    return result;
  }

  const stride = (total - 1) / (maxPoints - 1);
  let lastIdx = -1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? total - 1 : Math.round(i * stride);
    if (idx === lastIdx) continue;
    lastIdx = idx;
    const f = frames[idx];
    const pair = extractNumericPair(f.stateSnapshot);
    if (!pair || !Number.isFinite(f.simTime)) continue;
    result.push({
      cursorIndex: idx,
      t: Number(f.simTime.toFixed(3)),
      primary: pair.primary,
      secondary: pair.secondary,
    });
  }
  return result;
}

export function computeCursorChartPosition(
  currentTime: number,
  minTime: number,
  maxTime: number,
  plotLeft: number,
  plotWidth: number
): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
    return plotLeft;
  }
  const span = maxTime - minTime;
  if (span <= 1e-6) return plotLeft + plotWidth;
  const ratio = Math.min(1, Math.max(0, (currentTime - minTime) / span));
  return plotLeft + ratio * plotWidth;
}

export function computeExpDampingAlpha(dtSec: number, lambda = 10): number {
  const safeDt = Number.isFinite(dtSec) ? Math.min(0.1, Math.max(0.001, dtSec)) : 0.016;
  const safeLambda = Number.isFinite(lambda) && lambda > 0 ? lambda : 10;
  return Math.min(1, Math.max(0, 1 - Math.exp(-safeLambda * safeDt)));
}

export function formatCleanEquation(rawEquation: string): string {
  if (!rawEquation) return '';

  let eq = rawEquation.replace(/\\quad\s*\(\\text\{[^}]+\}\)/g, '');
  const eqSegments = eq.split('=');
  if (eqSegments.length > 3) {
    eq = `${eqSegments[0]}=${eqSegments[1]}=${eqSegments[2]}`;
  }

  // Unwrap \text{...}, \mathrm{...}, _{...}, ^{...} before fraction matching so nested braces resolve cleanly
  eq = eq
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1');

  for (let pass = 0; pass < 3; pass += 1) {
    const next = eq
      .replace(/_\{([^{}]+)\}/g, '_$1')
      .replace(/\^\{([^{}]+)\}/g, '^$1');
    if (next === eq) break;
    eq = next;
  }

  eq = eq
    .replace(/\\dot\{([A-Za-z])\}/g, '$1\u0307')
    .replace(/\\bar\{([A-Za-z])\}/g, '$1\u0304')
    .replace(/\\vec\{([A-Za-z])\}/g, '$1\u20D7')
    .replace(/\\sqrt\{\\frac\{([^{}]+)\}\{([^{}]+)\}\}/g, '√($1 / $2)')
    .replace(/\\left\(\s*\\frac\{([^{}]+)\}\{([^{}]+)\}\s*\\right\)/g, '($1 / $2)');

  // Iteratively resolve \frac{num}{den} (handles nested braces up to 4 levels)
  for (let pass = 0; pass < 4; pass += 1) {
    const next = eq.replace(
      /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
      (_match, num: string, den: string) => {
        const cleanNum = num.trim();
        const cleanDen = den.trim();
        const fmtNum = /[+-]/.test(cleanNum) ? `(${cleanNum})` : cleanNum;
        const fmtDen = /[+-]/.test(cleanDen) ? `(${cleanDen})` : cleanDen;
        return `${fmtNum} / ${fmtDen}`;
      }
    );
    if (next === eq) break;
    eq = next;
  }

  return eq
    .replace(/\\xrightarrow\{[^}]*\}/g, ' → ')
    .replace(/\\rightarrow/g, ' → ')
    .replace(/\\implies/g, ' ⟹ ')
    .replace(/\\uparrow/g, '↑')
    .replace(/\\downarrow/g, '↓')
    .replace(/\\%/g, '%')
    .replace(/\\sum(?![A-Za-z])/g, '∑')
    .replace(/\\in(?![A-Za-z])/g, ' ∈ ')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\^\{([^}]+)\}/g, '^$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Psi/g, 'Ψ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\eta/g, 'η')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\phi/g, 'φ')
    .replace(/\\varepsilon/g, 'ε')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\odot/g, '☉')
    .replace(/\\oplus/g, '⊕')
    .replace(/\^\\circ/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\times/g, ' × ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\propto/g, ' ∝ ')
    .replace(/\\le(?![A-Za-z])/g, ' ≤ ')
    .replace(/\\ge(?![A-Za-z])/g, ' ≥ ')
    .replace(/\\infty/g, '∞')
    .replace(/\\quad/g, ' ')
    .replace(/\\(arcsin|arccos|arctan|sin|cos|tan|log|ln|max|min|exp)\b/g, ' $1')
    .replace(/_\*/g, '_*')
    .replace(/\\/g, '')
    // Normalize binary operator spacing while keeping charges/exponents like H^+, OH^-, 10^-14 intact
    .replace(/([^\s=<>!≤≥≈])=/g, '$1 =')
    .replace(/=([^\s=])/g, '= $1')
    .replace(/([^\s^([{\/])\+([^\s=])/g, '$1 + $2')
    .replace(/([^\s^([{\/])\+ /g, '$1 + ')
    .replace(/([^\s])∝/g, '$1 ∝')
    .replace(/∝([^\s])/g, '∝ $1')
    .replace(/([^\s])≈/g, '$1 ≈')
    .replace(/≈([^\s])/g, '≈ $1')
    .replace(/([^\s])→/g, '$1 →')
    .replace(/→([^\s])/g, '→ $1')
    .replace(/([^\s])\/ /g, '$1 / ')
    .replace(/ \/([^\s])/g, ' / $1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferRecordModuleId(rec: ExperimentRecord): string | undefined {
  if (rec.moduleId) return rec.moduleId;
  const hint = `${rec.experimentTitle} ${rec.parametersSummary}`.toLowerCase();

  if (rec.domain === 'Fisika') {
    if (hint.includes('pegas') || hint.includes('hooke') || hint.includes('k=')) return 'spring-hooke';
    if (hint.includes('bandul') || hint.includes('pendulum')) return 'pendulum-harmonic';
    if (hint.includes('parabola') || hint.includes('proyektil') || hint.includes('projektil') || hint.includes('v₀') || hint.includes('v0=')) {
      return 'projectile-motion';
    }
    if (hint.includes('tumbukan') || hint.includes('momentum')) return 'collision-momentum';
    if (hint.includes('stokes') || hint.includes('viskositas')) return 'stokes-viscosity';
    if (hint.includes('wheatstone') || hint.includes('ohm')) return 'ohm-wheatstone';
    if (hint.includes('young') || hint.includes('interferensi') || hint.includes('celah')) return 'optics-young-slit';
    if (hint.includes('fotolistrik') || hint.includes('planck')) return 'photoelectric-planck';
    if (hint.includes('gravitasi universal') || hint.includes('orbital')) return 'gravity-orbital';
    if (hint.includes('newton') || hint.includes('bidang miring') || hint.includes('f=')) return 'newton-incline';
    return undefined;
  }

  if (rec.domain === 'Kimia') {
    if (hint.includes('titrasi') || hint.includes('asam') || hint.includes('vb=') || hint.includes('v_b=')) {
      return 'acid-base-titration';
    }
    if (hint.includes('galvani') || hint.includes('elektrokimia') || hint.includes('redoks') || hint.includes('anoda')) {
      return 'redox-electrochemistry';
    }
    if (hint.includes('boyle') || hint.includes('gas ideal')) return 'ideal-gas-boyle';
    if (hint.includes('arrhenius') || hint.includes('kinetika') || hint.includes('ea=')) {
      return 'reaction-kinetics-arrhenius';
    }
    if (hint.includes('spektro') || hint.includes('beer')) return 'spectrophotometry-beer';
    if (hint.includes('kalorimetri') || hint.includes('termo') || hint.includes('reaksi')) return 'thermo-calorimetry';
    return undefined;
  }

  if (rec.domain === 'Biologi') {
    if (hint.includes('fotosintesis') || hint.includes('ingenhousz')) return 'photosynthesis-ingenhousz';
    if (hint.includes('katalase') || hint.includes('enzim') || hint.includes('[s]=') || hint.includes('michaelis')) {
      return 'enzyme-catalase';
    }
    if (hint.includes('lotka') || hint.includes('predator') || hint.includes('mangsa')) return 'predator-prey-dynamics';
    if (hint.includes('plasmolisis') || hint.includes('osmosis') || hint.includes('sel') || hint.includes('tonisitas')) {
      return 'osmosis-plasmolysis';
    }
    if (hint.includes('jantung') || hint.includes('kardio') || hint.includes('bpm')) return 'anatomy-cardiovascular-heart';
    if (hint.includes('paru') || hint.includes('respirasi') || hint.includes('spirometri')) {
      return 'anatomy-respiratory-lungs';
    }
    if (hint.includes('sinaps') || hint.includes('saraf') || hint.includes('potensial aksi')) {
      return 'anatomy-neural-synapse';
    }
    return undefined;
  }

  if (rec.domain === 'Astronomi') {
    if (hint.includes('galaksi') || hint.includes('bima sakti') || hint.includes('dm=')) return 'milky-way-rotation';
    if (hint.includes('eksoplanet') || hint.includes('transit') || hint.includes('rp=')) return 'exoplanet-transit';
    if (hint.includes('wien') || hint.includes('benda hitam') || hint.includes('t*=')) return 'stellar-wien-spectrum';
    if (hint.includes('hubble') || hint.includes('ekspansi') || hint.includes('h₀=') || hint.includes('h0=')) {
      return 'hubble-expansion';
    }
    if (hint.includes('kepler') || hint.includes('orbit') || hint.includes('a=')) return 'solar-kepler';
    return undefined;
  }

  return undefined;
}

export function filterRecordsForModule(
  records: readonly ExperimentRecord[],
  domain: string,
  moduleId?: string
): ExperimentRecord[] {
  const targetDomain = domain.toLowerCase();
  const domainRecords = records.filter((r) => r.domain.toLowerCase() === targetDomain);
  if (!moduleId) return domainRecords;

  return domainRecords.filter((rec) => {
    const inferred = inferRecordModuleId(rec);
    return !inferred || inferred === moduleId;
  });
}
