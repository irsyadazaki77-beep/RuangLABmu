import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_CATALOG } from '../experimentRegistry';
import { FORMULA_PRIMER_MODELS } from './formulaPrimerModels';
import {
  getAdaptiveCameraPose,
  resolveApparatusInspection,
  type StudioDomain,
} from '../../utils/studio3DCatalog';

const RAW_LATEX_PATTERN = /\\frac|\\sqrt|\\sum|\\in\b|10\^[0-9-]/;
const ASCII_UNDERSCORE_VAR_PATTERN = /\b[A-Za-z]+_[A-Za-z0-9]+\b/;

function assertCleanNotation(text: string, context: string) {
  assert.equal(
    RAW_LATEX_PATTERN.test(text),
    false,
    `Raw LaTeX leaked in ${context}: "${text}"`
  );
  assert.equal(
    ASCII_UNDERSCORE_VAR_PATTERN.test(text),
    false,
    `ASCII underscore variable leaked in ${context}: "${text}"`
  );
}

describe('28-Module Structured Pedagogy & Interactive Formula Primers', () => {
  it('covers all 28 modules with complete structured pedagogy fields', () => {
    assert.equal(EXPERIMENT_CATALOG.length, 28);

    for (const mod of EXPERIMENT_CATALOG) {
      assert.ok(
        Array.isArray(mod.keyTakeaways) && mod.keyTakeaways.length >= 3,
        `${mod.id} missing >= 3 keyTakeaways`
      );
      assert.ok(mod.everydayAnalogy, `${mod.id} missing everydayAnalogy`);
      assert.ok(mod.everydayAnalogy.title.length > 4, `${mod.id} analogy title too short`);
      assert.ok(mod.everydayAnalogy.scenario.length > 15, `${mod.id} analogy scenario too short`);
      assert.ok(mod.everydayAnalogy.connection.length > 15, `${mod.id} analogy connection too short`);

      assert.ok(
        Array.isArray(mod.formulaBreakdown) && mod.formulaBreakdown.length >= 3,
        `${mod.id} missing >= 3 formulaBreakdown items`
      );

      assert.ok(mod.workedExample, `${mod.id} missing workedExample`);
      assert.ok(mod.workedExample.question.length > 10, `${mod.id} workedExample missing question`);
      assert.ok(mod.workedExample.steps.length >= 2, `${mod.id} workedExample needs >= 2 steps`);
      assert.ok(mod.workedExample.answer.length > 2, `${mod.id} workedExample missing answer`);

      assert.ok(
        Array.isArray(mod.glossary) && mod.glossary.length >= 3,
        `${mod.id} missing >= 3 glossary terms`
      );

      assert.ok(mod.deepDiveContent, `${mod.id} missing deepDiveContent`);
      assert.ok(
        Boolean(mod.deepDiveContent.historicalContext || mod.deepDiveContent.advancedConcept),
        `${mod.id} deepDiveContent has no narrative content`
      );

      assert.ok(
        Array.isArray(mod.preLabQuiz) && mod.preLabQuiz.length >= 2,
        `${mod.id} must have at least 2 pre-lab quiz questions`
      );
    }
  });

  it('contains zero raw LaTeX or ASCII underscore notation leaks across all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      mod.keyTakeaways?.forEach((item, idx) =>
        assertCleanNotation(item, `${mod.id}.keyTakeaways[${idx}]`)
      );
      if (mod.everydayAnalogy) {
        assertCleanNotation(mod.everydayAnalogy.title, `${mod.id}.everydayAnalogy.title`);
        assertCleanNotation(mod.everydayAnalogy.scenario, `${mod.id}.everydayAnalogy.scenario`);
        assertCleanNotation(mod.everydayAnalogy.connection, `${mod.id}.everydayAnalogy.connection`);
      }
      mod.formulaBreakdown?.forEach((v, idx) => {
        assertCleanNotation(v.symbol, `${mod.id}.formulaBreakdown[${idx}].symbol`);
        assertCleanNotation(v.name, `${mod.id}.formulaBreakdown[${idx}].name`);
        assertCleanNotation(v.unit, `${mod.id}.formulaBreakdown[${idx}].unit`);
        assertCleanNotation(v.explanation, `${mod.id}.formulaBreakdown[${idx}].explanation`);
      });
      if (mod.workedExample) {
        assertCleanNotation(mod.workedExample.question, `${mod.id}.workedExample.question`);
        mod.workedExample.given.forEach((g, idx) =>
          assertCleanNotation(g, `${mod.id}.workedExample.given[${idx}]`)
        );
        mod.workedExample.steps.forEach((s, idx) =>
          assertCleanNotation(s, `${mod.id}.workedExample.steps[${idx}]`)
        );
        assertCleanNotation(mod.workedExample.answer, `${mod.id}.workedExample.answer`);
        assertCleanNotation(
          mod.workedExample.physicalMeaning,
          `${mod.id}.workedExample.physicalMeaning`
        );
      }
      mod.glossary?.forEach((g, idx) => {
        assertCleanNotation(g.term, `${mod.id}.glossary[${idx}].term`);
        assertCleanNotation(g.definition, `${mod.id}.glossary[${idx}].definition`);
      });
      mod.preLabQuiz.forEach((q, idx) => {
        assertCleanNotation(q.question, `${mod.id}.preLabQuiz[${idx}].question`);
        q.options.forEach((opt, oi) =>
          assertCleanNotation(opt, `${mod.id}.preLabQuiz[${idx}].options[${oi}]`)
        );
        assertCleanNotation(q.explanation, `${mod.id}.preLabQuiz[${idx}].explanation`);
      });
    }
  });

  it('provides a dedicated clean InteractiveFormulaPrimer model for all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      const model = FORMULA_PRIMER_MODELS[mod.id];
      assert.ok(model, `Missing FORMULA_PRIMER_MODELS entry for ${mod.id}`);
      assert.ok(model.variables.length >= 1, `${mod.id} primer needs >= 1 variable`);
      assertCleanNotation(model.title, `primer.${mod.id}.title`);
      assertCleanNotation(model.outcomeSymbol, `primer.${mod.id}.outcomeSymbol`);
      assertCleanNotation(model.outcomeLabel, `primer.${mod.id}.outcomeLabel`);

      const defaultVals: Record<string, number> = {};
      for (const v of model.variables) {
        assertCleanNotation(v.symbol, `primer.${mod.id}.var.${v.key}.symbol`);
        assertCleanNotation(v.label, `primer.${mod.id}.var.${v.key}.label`);
        defaultVals[v.key] = v.defaultValue;
      }

      const outcome = model.computeOutcome(defaultVals);
      assert.ok(Number.isFinite(outcome), `primer.${mod.id} returned non-finite outcome`);

      const sentence = model.buildIntuitiveSentence(model.variables[0], defaultVals, outcome);
      assert.ok(sentence.length > 15, `primer.${mod.id} returned short intuitive sentence`);
      assertCleanNotation(sentence, `primer.${mod.id}.sentence`);
    }
  });
});

describe('3D Studio Adaptive Camera Catalog & Apparatus Inspector', () => {
  const DOMAIN_MAP: Record<string, StudioDomain> = {
    fisika: 'physics',
    kimia: 'chemistry',
    biologi: 'biology',
    astronomi: 'astronomy',
  };

  it('returns finite camera poses for all presets across all 28 modules', () => {
    const presets = ['isometric', 'front', 'top', 'focus', 'ecliptic'] as const;
    for (const mod of EXPERIMENT_CATALOG) {
      const domain = DOMAIN_MAP[mod.domain];
      for (const preset of presets) {
        const pose = getAdaptiveCameraPose(domain, mod.id, preset);
        assert.equal(pose.pos.length, 3);
        assert.equal(pose.target.length, 3);
        pose.pos.forEach((n) => assert.ok(Number.isFinite(n), `Non-finite pos for ${mod.id}:${preset}`));
        pose.target.forEach((n) =>
          assert.ok(Number.isFinite(n), `Non-finite target for ${mod.id}:${preset}`)
        );
      }
    }
  });

  it('resolves clean Indonesian apparatus inspection metadata for all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      const domain = DOMAIN_MAP[mod.domain];
      const info = resolveApparatusInspection(domain, mod.id);
      assert.ok(info.title.length > 3, `Missing title for ${mod.id}`);
      assert.ok(info.roleSummary.length > 10, `Missing roleSummary for ${mod.id}`);
      assert.ok(info.scientificConcept.length > 10, `Missing scientificConcept for ${mod.id}`);
      assert.ok(info.relatedFormula.length > 2, `Missing relatedFormula for ${mod.id}`);
      assertCleanNotation(info.title, `inspector.${mod.id}.title`);
      assertCleanNotation(info.roleSummary, `inspector.${mod.id}.roleSummary`);
      assertCleanNotation(info.scientificConcept, `inspector.${mod.id}.scientificConcept`);
      assertCleanNotation(info.relatedFormula, `inspector.${mod.id}.relatedFormula`);
    }
  });
});
