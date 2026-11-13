import { EXPERIMENT_CATALOG } from '../src/registry/experimentRegistry';
import { PRESET_MYSTERY_CHALLENGES } from '../src/utils/mysteryChallengeEngine';
import { LAB_MISSIONS_CATALOG } from '../src/registry/missionRegistry';
import { WORKSHEET_QUESTIONS, gradeWorksheetAnswers } from '../src/utils/engines/statisticsAndRegression';

console.log('=== AUDIT RUANGLABMU LEARNING MATERIALS ===');

let totalErrors = 0;
let totalWarnings = 0;

// 1. Audit EXPERIMENT_CATALOG (28 modules)
console.log(`\n1. Auditing Experiment Modules (${EXPERIMENT_CATALOG.length} modules)...`);
for (const mod of EXPERIMENT_CATALOG) {
  if (!mod.id || !mod.title || !mod.domain || !mod.theorySummary) {
    console.error(`[ERROR] Module ${mod.id} is missing basic info.`);
    totalErrors++;
  }

  // Objectives check
  for (const tier of ['SMP', 'SMA', 'Mahasiswa'] as const) {
    if (!mod.objectives[tier] || mod.objectives[tier].length === 0) {
      console.warn(`[WARN] Module ${mod.id} has no objectives for tier ${tier}.`);
      totalWarnings++;
    }
  }

  // Pre-lab Quiz check
  if (!mod.preLabQuiz || mod.preLabQuiz.length === 0) {
    console.error(`[ERROR] Module ${mod.id} has no preLabQuiz!`);
    totalErrors++;
  } else {
    for (const q of mod.preLabQuiz) {
      if (!q.question || !q.options || q.options.length < 2) {
        console.error(`[ERROR] Module ${mod.id} question ${q.id} has invalid structure.`);
        totalErrors++;
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        console.error(`[ERROR] Module ${mod.id} question ${q.id} correctIndex (${q.correctIndex}) out of bounds (options: ${q.options.length}).`);
        totalErrors++;
      }
      if (!q.explanation) {
        console.warn(`[WARN] Module ${mod.id} question ${q.id} missing explanation.`);
        totalWarnings++;
      }
    }
  }

  // Parameters & ComputeStep validation
  const defaultParams: Record<string, number> = {};
  for (const p of mod.parameters) {
    defaultParams[p.key] = p.defaultValue;
    if (p.defaultValue < p.min || p.defaultValue > p.max) {
      console.error(`[ERROR] Module ${mod.id} param ${p.key} defaultValue (${p.defaultValue}) out of range [${p.min}, ${p.max}].`);
      totalErrors++;
    }
  }

  try {
    const outputs = mod.computeStep(defaultParams, 1.0);
    for (const outDef of mod.outputs) {
      const val = outputs[outDef.key];
      if (val === undefined || val === null || Number.isNaN(val) || !Number.isFinite(val)) {
        console.error(`[ERROR] Module ${mod.id} computeStep output '${outDef.key}' is invalid (${val}).`);
        totalErrors++;
      }
    }
  } catch (err: any) {
    console.error(`[ERROR] Module ${mod.id} computeStep threw an exception:`, err?.message);
    totalErrors++;
  }
}

// 2. Audit PRESET_MYSTERY_CHALLENGES
console.log(`\n2. Auditing Mystery Challenges (${PRESET_MYSTERY_CHALLENGES.length} challenges)...`);
for (const ch of PRESET_MYSTERY_CHALLENGES) {
  if (!ch.id || !ch.title || !ch.storyDescription || !ch.formulaHint || !ch.explanationSolution) {
    console.error(`[ERROR] Mystery Challenge ${ch.id} missing description/solution.`);
    totalErrors++;
  }
  if (!Number.isFinite(ch.actualHiddenValue)) {
    console.error(`[ERROR] Mystery Challenge ${ch.id} actualHiddenValue is not finite.`);
    totalErrors++;
  }
}

// 3. Audit LAB_MISSIONS_CATALOG
console.log(`\n3. Auditing Lab Missions (${LAB_MISSIONS_CATALOG.length} missions)...`);
for (const mis of LAB_MISSIONS_CATALOG) {
  if (!mis.id || !mis.title || !mis.storyline || !mis.hint) {
    console.error(`[ERROR] Mission ${mis.id} missing info.`);
    totalErrors++;
  }
  const tc = mis.targetCondition;
  if (!tc || !Number.isFinite(tc.targetVal) || tc.minVal > tc.targetVal || tc.maxVal < tc.targetVal) {
    console.error(`[ERROR] Mission ${mis.id} targetCondition range invalid.`);
    totalErrors++;
  }
}

// 4. Audit WORKSHEET_QUESTIONS
console.log(`\n4. Auditing Worksheet Questions (${WORKSHEET_QUESTIONS.length} questions)...`);
const domainsCovered = new Set(WORKSHEET_QUESTIONS.map(q => q.domain));
console.log('Domains covered in WORKSHEET_QUESTIONS:', Array.from(domainsCovered));

for (const q of WORKSHEET_QUESTIONS) {
  if (!q.id || !q.questionText || !q.unit || !q.explanation) {
    console.error(`[ERROR] Worksheet question ${q.id} missing fields.`);
    totalErrors++;
  }
  if (!Number.isFinite(q.correctValue) || q.tolerance <= 0) {
    console.error(`[ERROR] Worksheet question ${q.id} correctValue/tolerance invalid.`);
    totalErrors++;
  }
}

console.log(`\n=== AUDIT SUMMARY ===`);
console.log(`Total Errors: ${totalErrors}`);
console.log(`Total Warnings: ${totalWarnings}`);
