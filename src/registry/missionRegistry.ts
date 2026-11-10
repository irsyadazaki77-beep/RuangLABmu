import {
  PhysicsParams,
  PhysicsMetrics,
  ChemistryParams,
  ChemistryMetrics,
  AstronomyParams,
  AstronomyMetrics,
  BiologyTelemetryContext,
} from '../utils/scienceEngine';

export interface LabMission {
  id: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  title: string;
  storyline: string;
  targetCondition: {
    metricKey: string;
    metricLabel: string;
    unit: string;
    targetVal: number;
    minVal: number;
    maxVal: number;
    maxErrorPct: number;
  };
  recommendedMode?: string;
  rewardBadge: string;
  hint: string;
}

export const LAB_MISSIONS_CATALOG: LabMission[] = [
  {
    id: 'mission-phys-moon-gravity',
    domain: 'physics',
    title: 'Ekspedisi Gravitasi Bulan',
    storyline:
      'Wahana pendarat Artemis membutuhkan kalibrasi gravimeter pendulum dan bidang miring di permukaan Bulan. Atur gravitasi dan parameter osilasi hingga terukur percepatan gravitasi g = 1.62 ± 0.05 m/s².',
    targetCondition: {
      metricKey: 'gravity',
      metricLabel: 'Gravitasi (g)',
      unit: 'm/s²',
      targetVal: 1.62,
      minVal: 1.57,
      maxVal: 1.67,
      maxErrorPct: 3.1,
    },
    recommendedMode: 'pendulum-harmonic',
    rewardBadge: '🏅 Astronot Kalibrasi Lunar',
    hint: 'Pilih preset gravitasi Bulan (1.62 m/s²) atau atur slider percepatan gravitasi g ke 1.62 m/s² pada modul Bandul / Bidang Miring.',
  },
  {
    id: 'mission-phys-mars-range',
    domain: 'physics',
    title: 'Suplai Logistik Kawah Jezero',
    storyline:
      'Luncurkan kapsul suplai menggunakan pelontar balistik agar mendarat tepat di titik pendaratan berjarak R = 42.0 ± 1.5 meter.',
    targetCondition: {
      metricKey: 'projectileRange',
      metricLabel: 'Jarak Jangkauan (R)',
      unit: 'm',
      targetVal: 42.0,
      minVal: 40.5,
      maxVal: 43.5,
      maxErrorPct: 3.6,
    },
    recommendedMode: 'projectile-gravity',
    rewardBadge: '🚀 Insinyur Balistik Antarplanet',
    hint: 'Buka mode Gerak Parabola (Projektil) dan sesuaikan kecepatan awal v₀ serta sudut elevasi θ hingga jarak jangkauan R berada di 40.5–43.5 m.',
  },
  {
    id: 'mission-chem-waste-acid',
    domain: 'chemistry',
    title: 'Detektif Asam Limbah',
    storyline:
      'Titrasi larutan sampel limbah pabrik menggunakan buret NaOH hingga tepat mencapai pH netral (7.0 ± 0.15) tanpa melewati titik ekuivalen berlebih.',
    targetCondition: {
      metricKey: 'currentPh',
      metricLabel: 'pH Larutan',
      unit: 'pH',
      targetVal: 7.0,
      minVal: 6.85,
      maxVal: 7.15,
      maxErrorPct: 2.2,
    },
    recommendedMode: 'acid-base-titration',
    rewardBadge: '🧪 Detektif Lingkungan Hijau',
    hint: 'Pilih mode Titrasi Asam-Basa dan teteskan volume titran NaOH perlahan mendekati titik ekuivalen hingga pH tepat 7.0 ± 0.15.',
  },
  {
    id: 'mission-chem-volta-battery',
    domain: 'chemistry',
    title: 'Arsitek Baterai Darurat Medis',
    storyline:
      'Rakit sel elektrokimia Galvani dan sesuaikan rasio konsentrasi anoda/katoda hingga menghasilkan potensial sel E_sel = 1.10 ± 0.03 V.',
    targetCondition: {
      metricKey: 'nernstCellPotentialE',
      metricLabel: 'Potensial Sel (E_sel)',
      unit: 'V',
      targetVal: 1.1,
      minVal: 1.07,
      maxVal: 1.13,
      maxErrorPct: 2.8,
    },
    recommendedMode: 'electrochemistry-cell',
    rewardBadge: '⚡ Inovator Elektrokimia Nernst',
    hint: 'Gunakan pasangan redoks Zn/Cu dan atur konsentrasi ion anoda serta katoda hingga tegangan sel mencapai 1.10 V.',
  },
  {
    id: 'mission-bio-photosynthesis',
    domain: 'biology',
    title: 'Optimalisasi Bioreaktor Oksigen Stasiun Luar Angkasa',
    storyline:
      'Atur intensitas cahaya dan kadar CO₂ pada kultur tanaman air Hydrilla hingga laju pelepasan gelembung oksigen mencapai 45 ± 4 gelembung/menit.',
    targetCondition: {
      metricKey: 'bubbleRate',
      metricLabel: 'Laju Gelembung O₂',
      unit: 'gel/mnt',
      targetVal: 45,
      minVal: 41,
      maxVal: 49,
      maxErrorPct: 8.8,
    },
    recommendedMode: 'photosynthesis-ingenhousz',
    rewardBadge: '🌿 Bio-Ekolog Koloni Antariksa',
    hint: 'Sesuaikan slider intensitas cahaya dan konsentrasi CO₂ pada eksperimen Fotosintesis Ingenhousz.',
  },
  {
    id: 'mission-astro-kepler-earth',
    domain: 'astronomy',
    title: 'Sinkronisasi Satelit Lagrange Bumi',
    storyline:
      'Kalibrasikan sumbu semi-mayor orbit dan massa bintang induk hingga periode orbit tepat 1.00 ± 0.04 Tahun Bumi sesuai Hukum III Kepler.',
    targetCondition: {
      metricKey: 'orbitalPeriodYears',
      metricLabel: 'Periode Orbit (T)',
      unit: 'Tahun',
      targetVal: 1.0,
      minVal: 0.96,
      maxVal: 1.04,
      maxErrorPct: 4.0,
    },
    recommendedMode: 'kepler-solar-system',
    rewardBadge: '🪐 Navigator Astrodinamika Kepler',
    hint: 'Atur sumbu semi-mayor a = 1.00 AU dan massa bintang M = 1.00 M☉ pada mode Tata Surya & Hukum Kepler.',
  },
];

export interface MissionProgressEvaluation {
  mission: LabMission;
  currentValue: number;
  errorPct: number;
  progressPct: number;
  isCompleted: boolean;
}

export function evaluateLabMissionProgress(
  mission: LabMission,
  physicsParams: PhysicsParams,
  physicsMetrics: PhysicsMetrics,
  chemistryParams: ChemistryParams,
  chemistryMetrics: ChemistryMetrics,
  biologyContext: BiologyTelemetryContext,
  astronomyParams: AstronomyParams,
  astronomyMetrics: AstronomyMetrics
): MissionProgressEvaluation {
  let currentValue = 0;
  const key = mission.targetCondition.metricKey;

  if (mission.domain === 'physics') {
    if (key in physicsParams) {
      currentValue = Number((physicsParams as unknown as Record<string, number>)[key] ?? 0);
    } else if (key in physicsMetrics) {
      currentValue = Number((physicsMetrics as unknown as Record<string, number>)[key] ?? 0);
    }
  } else if (mission.domain === 'chemistry') {
    if (key in chemistryMetrics) {
      currentValue = Number((chemistryMetrics as unknown as Record<string, number>)[key] ?? 0);
    } else if (key in chemistryParams) {
      currentValue = Number((chemistryParams as unknown as Record<string, number>)[key] ?? 0);
    }
  } else if (mission.domain === 'biology') {
    const rawVal =
      biologyContext.liveMetrics?.[key] ??
      biologyContext.parameters?.[key] ??
      biologyContext.liveMetrics?.['Laju Gelembung O₂'] ??
      45;
    currentValue = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
  } else if (mission.domain === 'astronomy') {
    if (key in astronomyMetrics) {
      currentValue = Number((astronomyMetrics as unknown as Record<string, number>)[key] ?? 0);
    } else if (key in astronomyParams) {
      currentValue = Number((astronomyParams as unknown as Record<string, number>)[key] ?? 0);
    }
  }

  const target = mission.targetCondition.targetVal;
  const absDiff = Math.abs(currentValue - target);
  const errorPct = target !== 0 ? Number(((absDiff / Math.abs(target)) * 100).toFixed(2)) : 0;

  const isCompleted =
    currentValue >= mission.targetCondition.minVal &&
    currentValue <= mission.targetCondition.maxVal &&
    errorPct <= mission.targetCondition.maxErrorPct;

  const progressPct = isCompleted
    ? 100
    : Math.max(8, Math.min(96, Math.round(100 - Math.min(92, errorPct * 2.2))));

  return {
    mission,
    currentValue: Number(currentValue.toFixed(2)),
    errorPct,
    progressPct,
    isCompleted,
  };
}
