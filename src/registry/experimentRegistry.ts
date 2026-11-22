import { PHYSICS_MODULES } from './modules/physicsModules';
import { CHEMISTRY_MODULES } from './modules/chemistryModules';
import { BIOLOGY_MODULES } from './modules/biologyModules';
import { ASTRONOMY_MODULES } from './modules/astronomyModules';
import { MODULE_DEEP_DIVE_MAP } from './moduleDeepDiveData';
import { MODULE_PEDAGOGY_MAP } from './pedagogy';
import { CURRICULUM_CHAPTERS, CurriculumChapter, CompetencyTier } from './curriculumChapters';

export type ScienceDomain = 'fisika' | 'kimia' | 'biologi' | 'astronomi';
export type EducationTier = 'SMP' | 'SMA' | 'Mahasiswa';

export { CURRICULUM_CHAPTERS };
export type { CurriculumChapter, CompetencyTier };

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

export interface DeepDiveContent {
  derivationLatex?: string[];
  historicalContext?: string;
  advancedConcept?: string;
}

export interface FormulaVariableItem {
  symbol: string;
  name: string;
  unit: string;
  role: 'bebas' | 'terikat' | 'konstanta';
  explanation: string;
}

export interface EverydayAnalogy {
  title: string;
  scenario: string;
  connection: string;
}

export interface WorkedExample {
  question: string;
  given: string[];
  steps: string[];
  answer: string;
  physicalMeaning: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface ExperimentModule {
  id: string;
  title: string;
  domain: ScienceDomain;
  subCategory: string; // e.g., "Mekanika", "Listrik & Magnet", "Optika", "Fisika Modern", "Kimia Analitik", "Fisiologi"
  chapterNumber?: number;
  chapterTitle?: string;
  competencyLevel?: 'Dasar' | 'Menengah' | 'Lanjut' | 'Olimpiade';
  supportedTiers: EducationTier[];
  difficulty: 1 | 2 | 3;
  estimatedMinutes: number;
  objectives: Record<EducationTier, string[]>; // Capaian Pembelajaran per jenjang
  theorySummary: string;
  keyEquations: string[];
  keyTakeaways?: string[];
  everydayAnalogy?: EverydayAnalogy;
  formulaBreakdown?: FormulaVariableItem[];
  workedExample?: WorkedExample;
  glossary?: GlossaryTerm[];
  apparatusList: string[]; // Alat & Bahan
  safetyNotes: string[];   // K3 Laboratorium
  commonMisconceptions?: string[];
  realWorldApplications?: string[];
  stepByStepGuide?: string[];
  deepDiveContent?: DeepDiveContent;
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
].map((mod) => {
  const deepDive = MODULE_DEEP_DIVE_MAP[mod.id] || {};
  const pedagogy = MODULE_PEDAGOGY_MAP[mod.id];
  const mergedDeepDiveContent = deepDive.deepDiveContent ?? pedagogy?.deepDiveContent;
  const mergedQuiz = pedagogy?.extraPreLabQuestions?.length
    ? [...mod.preLabQuiz, ...pedagogy.extraPreLabQuestions]
    : mod.preLabQuiz;

  return {
    ...mod,
    ...deepDive,
    ...(pedagogy
      ? {
          keyTakeaways: pedagogy.keyTakeaways,
          everydayAnalogy: pedagogy.everydayAnalogy,
          formulaBreakdown: pedagogy.formulaBreakdown,
          workedExample: pedagogy.workedExample,
          glossary: pedagogy.glossary,
        }
      : {}),
    ...(mergedDeepDiveContent ? { deepDiveContent: mergedDeepDiveContent } : {}),
    preLabQuiz: mergedQuiz,
  };
});

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

export function getExperimentsByChapterNumber(chapterNum: number): ExperimentModule[] {
  return EXPERIMENT_CATALOG.filter((mod) => mod.chapterNumber === chapterNum);
}

