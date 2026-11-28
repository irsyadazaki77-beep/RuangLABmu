import React from 'react';
import { Atom, FlaskConical, Globe2, Leaf, Orbit } from 'lucide-react';
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
  kebumian: Globe2,
};

export const DOMAIN_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0284c7',
  kimia: '#0d9488',
  biologi: '#059669',
  astronomi: '#4f46e5',
  kebumian: '#047857',
};

export const DOMAIN_PREVIEW_IMAGES: Record<ScienceDomain, string> = {
  fisika: new URL(
    '../../assets/images/physics_lab_preview_1794016081177.webp',
    import.meta.url
  ).href,
  kimia: new URL(
    '../../assets/images/chemistry_lab_preview_1794016082025.webp',
    import.meta.url
  ).href,
  biologi: new URL(
    '../../assets/images/biology_lab_preview_1794016082721.webp',
    import.meta.url
  ).href,
  astronomi: new URL(
    '../../assets/images/astronomy_lab_preview_1794016082169.webp',
    import.meta.url
  ).href,
  kebumian: new URL(
    '../../assets/images/earth_lab_preview.svg',
    import.meta.url
  ).href,
};

export const DOMAIN_SHOWCASE_META: Record<
  ScienceDomain,
  {
    title: string;
    tagline: string;
    accentHex: string;
    softBgClass: string;
    textClass: string;
    barClass: string;
  }
> = {
  fisika: {
    title: 'Fisika & Mekanika',
    tagline: 'Gerak, optik laser, gelombang, & rangkaian listrik',
    accentHex: '#0284c7',
    softBgClass: 'bg-sky-500/10 border-sky-500/25',
    textClass: 'text-sky-700 dark:text-sky-300',
    barClass: 'bg-sky-600 dark:bg-sky-400',
  },
  kimia: {
    title: 'Kimia & Molekuler',
    tagline: 'Titrasi asam-basa, termokimia, & elektrokimia',
    accentHex: '#0d9488',
    softBgClass: 'bg-teal-500/10 border-teal-500/25',
    textClass: 'text-teal-700 dark:text-teal-300',
    barClass: 'bg-teal-600 dark:bg-teal-400',
  },
  biologi: {
    title: 'Biologi & Fisiologi',
    tagline: 'Mikroskopi sel, fotosintesis, & anatomi organ 3D',
    accentHex: '#059669',
    softBgClass: 'bg-emerald-500/10 border-emerald-500/25',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    barClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  astronomi: {
    title: 'Astronomi & Astrofisika',
    tagline: 'Mekanika orbit Kepler, spektrum bintang, & eksoplanet',
    accentHex: '#4f46e5',
    softBgClass: 'bg-indigo-500/10 border-indigo-500/25',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    barClass: 'bg-indigo-600 dark:bg-indigo-400',
  },
  kebumian: {
    title: 'Ilmu Bumi & Kebumian',
    tagline: 'Seismologi gempa, efek rumah kaca, hidrologi Darcy, & C-14',
    accentHex: '#047857',
    softBgClass: 'bg-emerald-500/10 border-emerald-500/25',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    barClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
};

export function getShortJenjangLabel(ch: CurriculumChapter): string {
  if (ch.competencyTier.includes('SMP')) return 'SMP';
  if (ch.competencyTier.includes('SMA')) return 'SMA';
  if (ch.competencyTier.includes('Mahasiswa')) return 'Mahasiswa';
  return ch.competencyTier;
}

/**
 * Resolves the Indonesian Kurikulum Merdeka learning phase label for a chapter.
 */
export function resolveMerdekaPhaseLabel(ch: CurriculumChapter): string {
  if (ch.competencyTier.includes('SMP')) return 'Fase D';
  if (ch.competencyTier.includes('SMA')) return 'Fase E–F';
  return 'PT / OSN';
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
