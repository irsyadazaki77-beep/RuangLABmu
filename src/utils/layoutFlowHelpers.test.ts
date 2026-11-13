import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDataReadinessStatus,
  filterDomainRecords,
  formatDomainPrimaryMetric,
  getDomainAccentTokens,
} from './layoutFlowHelpers';
import { ExperimentRecord } from './scienceEngine';

const sampleRecords: ExperimentRecord[] = [
  {
    id: 'rec-1',
    timestamp: '08:01:00',
    studentName: 'Alya',
    groupId: 'Kelompok 1',
    domain: 'Fisika',
    experimentTitle: 'Hukum II Newton',
    parametersSummary: 'm=4kg, F=20N',
    keyMetrics: { 'Percepatan (a)': '5.00 m/s²' },
    notes: '',
  },
  {
    id: 'rec-2',
    timestamp: '08:02:00',
    studentName: 'Alya',
    groupId: 'Kelompok 1',
    domain: 'Kimia',
    experimentTitle: 'Titrasi Asam Basa',
    parametersSummary: 'Vb=25mL',
    keyMetrics: { 'pH Larutan': '7.00' },
    notes: '',
  },
];

test('filterDomainRecords isolates records belonging to active science domain', () => {
  const phys = filterDomainRecords(sampleRecords, 'Fisika');
  const chem = filterDomainRecords(sampleRecords, 'Kimia');
  assert.equal(phys.length, 1);
  assert.equal(phys[0].id, 'rec-1');
  assert.equal(chem.length, 1);
  assert.equal(chem[0].id, 'rec-2');
});

test('computeDataReadinessStatus calculates remaining trials and readiness cleanly', () => {
  const empty = computeDataReadinessStatus(0);
  assert.equal(empty.isReady, false);
  assert.equal(empty.remaining, 3);
  assert.equal(empty.progressPct, 0);

  const partial = computeDataReadinessStatus(2);
  assert.equal(partial.isReady, false);
  assert.equal(partial.remaining, 1);
  assert.equal(partial.progressPct, 67);

  const ready = computeDataReadinessStatus(4);
  assert.equal(ready.isReady, true);
  assert.equal(ready.remaining, 0);
  assert.equal(ready.progressPct, 100);
});

test('formatDomainPrimaryMetric and getDomainAccentTokens format cleanly per domain', () => {
  assert.equal(formatDomainPrimaryMetric(sampleRecords[0]), 'Percepatan (a): 5.00 m/s²');
  const astroTokens = getDomainAccentTokens('Astronomi');
  assert.ok(astroTokens.dotClass.includes('indigo'));
  const chemTokens = getDomainAccentTokens('Kimia');
  assert.ok(chemTokens.dotClass.includes('teal'));
});
