import React from 'react';
import { Atom, FlaskConical, Leaf, Orbit } from 'lucide-react';
import { EducationTier, ScienceDomain } from '../../registry/experimentRegistry';
import { CurriculumChapter } from '../../registry/curriculumChapters';
import { formatCleanEquation } from '../../utils/spatialHudHelpers';

export const DOMAIN_ICONS: Record<
  ScienceDomain,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  fisika: Atom,
  kimia: FlaskConical,
  biologi: Leaf,
  astronomi: Orbit,
};

export const DOMAIN_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0284c7',
  kimia: '#0d9488',
  biologi: '#059669',
  astronomi: '#4f46e5',
};

export function getShortJenjangLabel(ch: CurriculumChapter): string {
  if (ch.competencyTier.includes('SMP')) return 'SMP';
  if (ch.competencyTier.includes('SMA')) return 'SMA';
  if (ch.competencyTier.includes('Mahasiswa')) return 'Mahasiswa';
  return ch.competencyTier;
}

export function chapterMatchesJenjang(
  ch: CurriculumChapter,
  jenjang: 'all' | EducationTier
): boolean {
  if (jenjang === 'all') return true;
  if (jenjang === 'SMP') return ch.competencyTier.includes('SMP');
  if (jenjang === 'SMA') return ch.competencyTier.includes('SMA');
  if (jenjang === 'Mahasiswa') return ch.competencyTier.includes('Mahasiswa');
  return true;
}

/**
 * Cleans raw LaTeX equation strings into crisp, readable mathematical notation.
 */
export function formatCleanCardEquation(rawEquation: string): string {
  return formatCleanEquation(rawEquation);
}
