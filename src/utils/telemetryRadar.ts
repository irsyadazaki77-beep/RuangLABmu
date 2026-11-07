/**
 * Teacher Live Classroom Telemetry Radar Logic
 * Evaluates student progression across the 4-step guided laboratory workflow
 * and flags learning anomalies (e.g. low R², prolonged time-in-step).
 */

import { StudentProgressItem } from '../components/TeacherDashboardView';

export interface StudentRadarCard extends StudentProgressItem {
  resolvedStep: 1 | 2 | 3 | 4;
  needsHelp: boolean;
  helpReason?: string;
  formattedTimeInStep: string;
}

export interface RadarLaneSummary {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  students: StudentRadarCard[];
  needsHelpCount: number;
}

export function resolveStudentStep(student: StudentProgressItem): 1 | 2 | 3 | 4 {
  if (student.currentStep && student.currentStep >= 1 && student.currentStep <= 4) {
    return student.currentStep;
  }
  if (student.status === 'Selesai' || student.completionPct >= 95) {
    return 4;
  }
  if (student.completionPct >= 65 || student.trialsRecorded >= 3) {
    return 3;
  }
  if (student.trialsRecorded > 0 || student.tasksCompleted > 0 || student.completionPct >= 25) {
    return 2;
  }
  return 1;
}

export function checkStudentNeedsHelp(student: StudentProgressItem): { needsHelp: boolean; reason?: string } {
  if (student.status === 'Butuh Bantuan') {
    return {
      needsHelp: true,
      reason: 'Percobaan belum konvergen atau galat tinggi',
    };
  }

  if (student.rSquared !== undefined && student.rSquared < 0.80 && (student.trialsRecorded || 0) >= 2) {
    return {
      needsHelp: true,
      reason: `Regresi linier menyimpang (R² = ${student.rSquared.toFixed(2)} < 0.80)`,
    };
  }

  if (student.timeInStepMinutes !== undefined && student.timeInStepMinutes > 8) {
    return {
      needsHelp: true,
      reason: `Tertahan >8 menit di tahap ini (${student.timeInStepMinutes} mnt)`,
    };
  }

  return { needsHelp: false };
}

export function buildRadarLanes(
  students: StudentProgressItem[],
  groupFilter: string = 'Semua'
): RadarLaneSummary[] {
  const filtered =
    groupFilter === 'Semua'
      ? students
      : students.filter((s) => s.groupId === groupFilter);

  const laneDefinitions: { step: 1 | 2 | 3 | 4; title: string; subtitle: string }[] = [
    {
      step: 1,
      title: 'Pre-Lab & K3',
      subtitle: 'Membaca SOP & Kuis K3',
    },
    {
      step: 2,
      title: 'Meja Praktikum 3D',
      subtitle: 'Simulasi & Rekam Data',
    },
    {
      step: 3,
      title: 'Analisis & Grafik',
      subtitle: 'Regresi Linier & LKS',
    },
    {
      step: 4,
      title: 'Laporan Siap Dinilai',
      subtitle: 'Rubrik & Kolaborasi',
    },
  ];

  return laneDefinitions.map((def) => {
    const laneStudents: StudentRadarCard[] = filtered
      .filter((stu) => resolveStudentStep(stu) === def.step)
      .map((stu) => {
        const { needsHelp, reason } = checkStudentNeedsHelp(stu);
        const minutes = stu.timeInStepMinutes ?? 3;
        return {
          ...stu,
          resolvedStep: def.step,
          needsHelp,
          helpReason: reason,
          formattedTimeInStep: `${minutes} mnt di tahap ini`,
        };
      });

    const needsHelpCount = laneStudents.filter((s) => s.needsHelp).length;

    return {
      step: def.step,
      title: def.title,
      subtitle: def.subtitle,
      students: laneStudents,
      needsHelpCount,
    };
  });
}
