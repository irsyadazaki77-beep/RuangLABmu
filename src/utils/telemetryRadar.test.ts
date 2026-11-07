import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStudentStep,
  checkStudentNeedsHelp,
  buildRadarLanes,
} from './telemetryRadar';
import { StudentProgressItem } from '../components/TeacherDashboardView';

const mockStudents: StudentProgressItem[] = [
  {
    id: 's1',
    name: 'Siswa A',
    groupId: 'Kelompok 1',
    activeDomain: 'Fisika',
    currentActivity: 'Kuis K3',
    trialsRecorded: 0,
    tasksCompleted: 0,
    totalTasks: 4,
    completionPct: 10,
    lastActive: 'Baru saja',
    status: 'Nominal',
    currentStep: 1,
    timeInStepMinutes: 2,
  },
  {
    id: 's2',
    name: 'Siswa B',
    groupId: 'Kelompok 1',
    activeDomain: 'Fisika',
    currentActivity: 'Simulasi Hooke',
    trialsRecorded: 2,
    tasksCompleted: 1,
    totalTasks: 4,
    completionPct: 45,
    lastActive: 'Baru saja',
    status: 'Nominal',
    currentStep: 2,
    timeInStepMinutes: 5,
  },
  {
    id: 's3',
    name: 'Siswa C',
    groupId: 'Kelompok 2',
    activeDomain: 'Kimia',
    currentActivity: 'Regresi Titrasi',
    trialsRecorded: 3,
    tasksCompleted: 2,
    totalTasks: 4,
    completionPct: 70,
    lastActive: '1 mnt lalu',
    status: 'Nominal',
    currentStep: 3,
    timeInStepMinutes: 10, // > 8 mins stuck!
    rSquared: 0.72, // R² < 0.80!
  },
  {
    id: 's4',
    name: 'Siswa D',
    groupId: 'Kelompok 2',
    activeDomain: 'Astronomi',
    currentActivity: 'Laporan Final',
    trialsRecorded: 4,
    tasksCompleted: 4,
    totalTasks: 4,
    completionPct: 100,
    lastActive: 'Baru saja',
    status: 'Selesai',
    currentStep: 4,
    timeInStepMinutes: 1,
  },
];

test('TelemetryRadar: resolveStudentStep maps explicit and implicit stages accurately', () => {
  assert.equal(resolveStudentStep(mockStudents[0]), 1);
  assert.equal(resolveStudentStep(mockStudents[1]), 2);
  assert.equal(resolveStudentStep(mockStudents[2]), 3);
  assert.equal(resolveStudentStep(mockStudents[3]), 4);
});

test('TelemetryRadar: checkStudentNeedsHelp flags low R2 and prolonged duration', () => {
  const normalCheck = checkStudentNeedsHelp(mockStudents[1]);
  assert.equal(normalCheck.needsHelp, false);

  const stuckCheck = checkStudentNeedsHelp(mockStudents[2]);
  assert.equal(stuckCheck.needsHelp, true);
  assert.ok(stuckCheck.reason?.includes('R²') || stuckCheck.reason?.includes('>8 menit'));
});

test('TelemetryRadar: buildRadarLanes creates 4 lanes and distributes students correctly', () => {
  const lanes = buildRadarLanes(mockStudents, 'Semua');
  assert.equal(lanes.length, 4);
  assert.equal(lanes[0].step, 1);
  assert.equal(lanes[0].students.length, 1);
  assert.equal(lanes[1].step, 2);
  assert.equal(lanes[1].students.length, 1);
  assert.equal(lanes[2].step, 3);
  assert.equal(lanes[2].students.length, 1);
  assert.equal(lanes[2].needsHelpCount, 1);
  assert.equal(lanes[3].step, 4);
  assert.equal(lanes[3].students.length, 1);
});
