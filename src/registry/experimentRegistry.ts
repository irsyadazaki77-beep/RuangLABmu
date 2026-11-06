import { PHYSICS_MODULES } from './modules/physicsModules';
import { CHEMISTRY_MODULES } from './modules/chemistryModules';
import { BIOLOGY_MODULES } from './modules/biologyModules';
import { ASTRONOMY_MODULES } from './modules/astronomyModules';

export type ScienceDomain = 'fisika' | 'kimia' | 'biologi' | 'astronomi';
export type EducationTier = 'SMP' | 'SMA' | 'Mahasiswa';

export interface ParameterDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  variableRole: 'bebas' | 'kontrol'; // Independent vs Control variable
  instrumentType?: 'stopwatch' | 'ruler' | 'burette' | 'thermometer' | 'voltmeter' | 'dynamometer';
}

export interface OutputMetricDef {
  key: string;
  label: string;
  unit: string;
  formulaLatex: string;
  precision: number;
}

export interface PreLabQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ExperimentModule {
  id: string;
  title: string;
  domain: ScienceDomain;
  subCategory: string; // e.g., "Mekanika", "Listrik & Magnet", "Optika", "Fisika Modern", "Kimia Analitik", "Fisiologi"
  supportedTiers: EducationTier[];
  difficulty: 1 | 2 | 3;
  estimatedMinutes: number;
  objectives: Record<EducationTier, string[]>; // Capaian Pembelajaran per jenjang
  theorySummary: string;
  keyEquations: string[];
  apparatusList: string[]; // Alat & Bahan
  safetyNotes: string[];   // K3 Laboratorium
  parameters: ParameterDef[];
  outputs: OutputMetricDef[];
  defaultRegressionAxes: { xKey: string; yKey: string; expectedSlopeMeaning: string };
  preLabQuiz: PreLabQuestion[];
  computeStep: (params: Record<string, number>, timeSec: number) => Record<string, number>;
}

export const EXPERIMENT_CATALOG: ExperimentModule[] = [
  ...PHYSICS_MODULES,
  ...CHEMISTRY_MODULES,
  ...BIOLOGY_MODULES,
  ...ASTRONOMY_MODULES,
];

export function getExperimentsByDomain(
  domain: ScienceDomain,
  tier?: EducationTier
): ExperimentModule[] {
  return EXPERIMENT_CATALOG.filter((mod) => {
    if (mod.domain !== domain) return false;
    if (tier && !mod.supportedTiers.includes(tier)) return false;
    return true;
  });
}

export function getExperimentById(id: string): ExperimentModule | undefined {
  return EXPERIMENT_CATALOG.find((mod) => mod.id === id);
}

export function getAllExperiments(tier?: EducationTier): ExperimentModule[] {
  if (!tier) return EXPERIMENT_CATALOG;
  return EXPERIMENT_CATALOG.filter((mod) => mod.supportedTiers.includes(tier));
}

export function getSubCategories(domain: ScienceDomain): string[] {
  const mods = EXPERIMENT_CATALOG.filter((m) => m.domain === domain);
  return Array.from(new Set(mods.map((m) => m.subCategory)));
}
