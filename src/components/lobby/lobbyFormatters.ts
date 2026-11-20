import React from 'react';
import { Atom, FlaskConical, Leaf, Orbit } from 'lucide-react';
import { EducationTier, ScienceDomain } from '../../registry/experimentRegistry';
import { CurriculumChapter } from '../../registry/curriculumChapters';

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
  if (!rawEquation) return '';

  let eq = rawEquation.replace(/\\quad\s*\(\\text\{[^}]+\}\)/g, '');
  const eqSegments = eq.split('=');
  if (eqSegments.length > 3) {
    eq = `${eqSegments[0]}=${eqSegments[1]}=${eqSegments[2]}`;
  }

  return eq
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\sqrt\{\\frac\{([^}]+)\}\{([^}]+)\}\}/g, '√($1 / $2)')
    .replace(/\\left\(\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\\right\)/g, '($1 / $2)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_match, num: string, den: string) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      const fmtNum = /[+-]/.test(cleanNum) ? `(${cleanNum})` : cleanNum;
      const fmtDen = /[+-]/.test(cleanDen) ? `(${cleanDen})` : cleanDen;
      return `${fmtNum} / ${fmtDen}`;
    })
    .replace(/\\xrightarrow\{[^}]*\}/g, ' → ')
    .replace(/\\rightarrow/g, ' → ')
    .replace(/\\uparrow/g, '↑')
    .replace(/\_\{([^}]+)\}/g, '_$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\Sigma/g, '∑')
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
    .replace(/\^\\circ/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\propto/g, '∝')
    .replace(/\\quad/g, ' ')
    .replace(/\\max/g, 'max')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/_\*/g, '_*')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
