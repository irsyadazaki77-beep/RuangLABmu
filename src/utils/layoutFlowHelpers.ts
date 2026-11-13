import { ExperimentRecord, ScienceDomain } from './scienceEngine';

export interface DataReadinessStatus {
  count: number;
  minRequired: number;
  remaining: number;
  isReady: boolean;
  progressPct: number;
  badgeLabel: string;
  guidanceText: string;
}

export interface DomainAccentTokens {
  dotClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  borderClass: string;
  primaryButtonClass: string;
  progressBarClass: string;
}

/**
 * Normalizes and filters experiment records matching a given ScienceDomain.
 */
export function filterDomainRecords(
  records: ExperimentRecord[],
  domain: ScienceDomain | string
): ExperimentRecord[] {
  const target = String(domain || '').trim().toLowerCase();
  return records.filter((r) => String(r.domain || '').trim().toLowerCase() === target);
}

/**
 * Computes pedagogical readiness for moving from Stage 2 (Data Collection)
 * to Stage 3 (OLS Linear Regression & Worksheet Analysis).
 */
export function computeDataReadinessStatus(
  recordsCount: number,
  minRequired = 3
): DataReadinessStatus {
  const safeMin = Math.max(1, Math.floor(minRequired));
  const safeCount = Math.max(0, Math.floor(Number.isFinite(recordsCount) ? recordsCount : 0));
  const remaining = Math.max(0, safeMin - safeCount);
  const isReady = safeCount >= safeMin;
  const progressPct = Math.min(100, Math.round((safeCount / safeMin) * 100));

  const badgeLabel = `${safeCount}/${safeMin}`;
  const guidanceText = isReady
    ? 'Data memadai untuk uji regresi linier OLS dan pembuktian hipotesis.'
    : safeCount === 0
      ? `Belum ada data tercatat. Ubah variabel bebas lalu rekam minimal ${safeMin} titik pengamatan.`
      : `Butuh ${remaining} titik data lagi dengan variasi variabel berbeda agar regresi akurat.`;

  return {
    count: safeCount,
    minRequired: safeMin,
    remaining,
    isReady,
    progressPct,
    badgeLabel,
    guidanceText,
  };
}

/**
 * Formats the primary measured metric from an ExperimentRecord for compact preview.
 */
export function formatDomainPrimaryMetric(record: ExperimentRecord): string {
  if (!record.keyMetrics) return record.parametersSummary || '—';
  const entries = Object.entries(record.keyMetrics);
  if (entries.length === 0) return record.parametersSummary || '—';
  const [key, val] = entries[0];
  return `${key}: ${val}`;
}

/**
 * Provides consistent semantic Tailwind accent tokens across domains.
 */
export function getDomainAccentTokens(domain: ScienceDomain | string): DomainAccentTokens {
  const norm = String(domain || '').toLowerCase();
  if (norm.includes('kimia') || norm === 'chemistry') {
    return {
      dotClass: 'bg-teal-500',
      badgeBgClass: 'bg-teal-500/10 border-teal-500/30',
      badgeTextClass: 'text-teal-700 dark:text-teal-300',
      borderClass: 'border-teal-500/30',
      primaryButtonClass: 'bg-teal-600 hover:bg-teal-500 text-white',
      progressBarClass: 'bg-teal-500',
    };
  }
  if (norm.includes('biologi') || norm === 'biology') {
    return {
      dotClass: 'bg-emerald-500',
      badgeBgClass: 'bg-emerald-500/10 border-emerald-500/30',
      badgeTextClass: 'text-emerald-700 dark:text-emerald-300',
      borderClass: 'border-emerald-500/30',
      primaryButtonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      progressBarClass: 'bg-emerald-500',
    };
  }
  if (norm.includes('astronomi') || norm === 'astronomy') {
    return {
      dotClass: 'bg-indigo-500',
      badgeBgClass: 'bg-indigo-500/10 border-indigo-500/30',
      badgeTextClass: 'text-indigo-700 dark:text-indigo-300',
      borderClass: 'border-indigo-500/30',
      primaryButtonClass: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      progressBarClass: 'bg-indigo-500',
    };
  }
  return {
    dotClass: 'bg-sky-500',
    badgeBgClass: 'bg-sky-500/10 border-sky-500/30',
    badgeTextClass: 'text-sky-700 dark:text-sky-300',
    borderClass: 'border-sky-500/30',
    primaryButtonClass: 'bg-sky-600 hover:bg-sky-500 text-white',
    progressBarClass: 'bg-sky-500',
  };
}
