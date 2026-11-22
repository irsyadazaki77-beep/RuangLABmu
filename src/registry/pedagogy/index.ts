import type {
  DeepDiveContent,
  EverydayAnalogy,
  FormulaVariableItem,
  GlossaryTerm,
  PreLabQuestion,
  WorkedExample,
} from '../experimentRegistry';
import { PHYSICS_PEDAGOGY } from './physicsPedagogy';
import { CHEMISTRY_PEDAGOGY } from './chemistryPedagogy';
import { BIOLOGY_PEDAGOGY } from './biologyPedagogy';
import { ASTRONOMY_PEDAGOGY } from './astronomyPedagogy';

export interface ModulePedagogyBundle {
  keyTakeaways: string[];
  everydayAnalogy: EverydayAnalogy;
  formulaBreakdown: FormulaVariableItem[];
  workedExample: WorkedExample;
  glossary: GlossaryTerm[];
  deepDiveContent?: DeepDiveContent;
  extraPreLabQuestions?: PreLabQuestion[];
}

export const MODULE_PEDAGOGY_MAP: Record<string, ModulePedagogyBundle> = {
  ...PHYSICS_PEDAGOGY,
  ...CHEMISTRY_PEDAGOGY,
  ...BIOLOGY_PEDAGOGY,
  ...ASTRONOMY_PEDAGOGY,
};
