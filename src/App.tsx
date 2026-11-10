import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Download,
  Users,
  Atom,
  GraduationCap,
  Volume2,
  VolumeX,
  CheckCircle2,
  RotateCcw,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import {
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  ScienceDomain,
  AcademicLevel,
  ExperimentRecord,
  LabNotification,
  BiologyTelemetryContext,
  exportRecordsToCSV,
} from './utils/scienceEngine';
import { labSound } from './utils/soundEngine';
import { useLabSessionAutoSave } from './hooks/useLabSessionAutoSave';
import {
  CollaborationAndDataSection,
  GroupTaskItem,
  CollabNoteItem,
} from './components/CollaborationAndDataSection';
import { AnalyticsAndWorksheetPanel } from './components/AnalyticsAndWorksheetPanel';
import { StudentProgressItem } from './components/TeacherDashboardView';
import { DrLabMuAssistantPanel, DrawerTabMode } from './components/DrLabMuAssistantPanel';
import { LabLobbyHub } from './components/LabLobbyHub';
import { PreLabBriefingView } from './components/PreLabBriefingView';
import {
  VisualComfortToolbar,
  VisualComfortPreferences,
  EyeComfortTheme,
} from './components/ui/VisualComfortToolbar';
import { HypothesisNote } from './components/ui/HypothesisAndCompareDock';
import {
  Lab3DSnapshot,
  TargetChallengeMission,
  computeStudentBadges,
} from './components/ui/ScientificEnhancementSuite';

// Code Splitting via React.lazy for performance optimization
const PhysicsLabView = lazy(() =>
  import('./components/PhysicsLabView').then((m) => ({ default: m.PhysicsLabView }))
);
const ChemistryLabView = lazy(() =>
  import('./components/ChemistryLabView').then((m) => ({ default: m.ChemistryLabView }))
);
const BiologyLabView = lazy(() =>
  import('./components/BiologyLabView').then((m) => ({ default: m.BiologyLabView }))
);
const AstronomyLabView = lazy(() =>
  import('./components/AstronomyLabView').then((m) => ({ default: m.AstronomyLabView }))
);
const TeacherDashboardView = lazy(() =>
  import('./components/TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView }))
);

function LabLoadingSkeleton() {
  return (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-spin">
        <Loader2 className="w-6 h-6" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-bold text-white">Memuat Lingkungan Laboratorium 3D...</div>
        <div className="text-xs text-slate-400">Menyiapkan mesin fisika & shader WebGL</div>
      </div>
    </div>
  );
}
import {
  ExperimentModule,
  EducationTier,
  getExperimentById,
  EXPERIMENT_CATALOG,
} from './registry/experimentRegistry';
import { useSpatialCollab } from './hooks/useSpatialCollab';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  PRESET_MYSTERY_CHALLENGES,
} from './utils/mysteryChallengeEngine';

type LabDomainId = 'fisika' | 'kimia' | 'biologi' | 'astronomi';
type WorkflowStep = 1 | 2 | 3 | 4;
type UserRoleMode = 'siswa' | 'pengajar';

const STUDENT_PROFILES = [
  { name: 'Alya Pratama', group: 'Kelompok 1 — Mekanika' },
  { name: 'Bima Wijaya', group: 'Kelompok 1 — Mekanika' },
  { name: 'Citra Lestari', group: 'Kelompok 2 — Termokimia' },
  { name: 'Dimas Nugroho', group: 'Kelompok 2 — Termokimia' },
  { name: 'Elena Putri', group: 'Kelompok 3 — Astrofisika' },
];

export default function App() {
  // Structured Role & 4-Step Guided Workflow State
  const [userRole, setUserRole] = useState<UserRoleMode>('siswa');
  const [isLobbyMode, setIsLobbyMode] = useState<boolean>(true);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [activeDomain, setActiveDomain] = useState<LabDomainId>('fisika');
  const [selectedProfileIdx, setSelectedProfileIdx] = useState<number>(0);
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>('sma');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTabMode>('dr-labmu');

  // Step Completion Tracking
  const [completedSafetyIds, setCompletedSafetyIds] = useState<string[]>([
    'newton-incline',
  ]);
  const [lksGraded, setLksGraded] = useState<boolean>(false);
  const [selectedBioModuleId, setSelectedBioModuleId] = useState<string>(
    'photosynthesis-ingenhousz'
  );

  // Mystery Sample Exam State
  const [activeMysteryChallenge, setActiveMysteryChallenge] =
    useState<MysterySampleChallenge | null>(null);
  const [mysterySubmissions, setMysterySubmissions] = useState<
    MysterySubmissionResult[]
  >([]);

  // 3D WebGL Snapshot Gallery & Target Challenge Mission State
  const [capturedSnapshots, setCapturedSnapshots] = useState<Lab3DSnapshot[]>([]);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<string[]>([]);

  // Adaptive Eye-Comfort Preferences & Lab Audio Engine State
  const [comfortPrefs, setComfortPrefs] = useState<VisualComfortPreferences>(() => {
    try {
      const savedPrefs = window.localStorage.getItem('simulab-comfort-prefs');
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        if (parsed && parsed.theme) return parsed;
      }
      const legacyTheme = window.localStorage.getItem('simulab-theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') {
        return {
          theme: legacyTheme,
          fontScale: 'normal',
          lineSpacing: 'standard',
          colorBlindSafe: false,
          eyeRestTimerEnabled: true,
        };
      }
    } catch {
      // ignore storage error
    }
    return {
      theme: 'dark',
      fontScale: 'normal',
      lineSpacing: 'standard',
      colorBlindSafe: false,
      eyeRestTimerEnabled: true,
    };
  });

  const [zenMode, setZenMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState<boolean>(false);
  const [externalDrLabMuPrompt, setExternalDrLabMuPrompt] = useState<{
    id: number;
    prompt: string;
  } | null>(null);

  // Per-Module Student Hypothesis & Quick Reflection Scratchpad State
  const [hypothesisNotesByModule, setHypothesisNotesByModule] = useState<
    Record<string, HypothesisNote>
  >(() => {
    try {
      const saved = window.localStorage.getItem('simulab-hypothesis-notes');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage error
    }
    return {
      'newton-incline': {
        independentVar: 'Gaya Dorong (F) dan Sudut Kemiringan (θ)',
        dependentVar: 'Percepatan Balok (a)',
        hypothesisText:
          'Semakin besar gaya dorong F pada massa tetap, maka percepatan balok a akan meningkat secara linier sesuai Hukum II Newton (a = ΣF/m).',
        reflectionText:
          'Data eksperimen menunjukkan hubungan linier kuat (R² > 0.98) antara ΣF dan percepatan.',
        updatedAt: '08:45',
      },
    };
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', comfortPrefs.theme);
    root.setAttribute('data-font-scale', comfortPrefs.fontScale);
    root.setAttribute('data-line-spacing', comfortPrefs.lineSpacing);
    root.setAttribute(
      'data-colorblind',
      comfortPrefs.colorBlindSafe ? 'true' : 'false'
    );

    if (comfortPrefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      window.localStorage.setItem(
        'simulab-comfort-prefs',
        JSON.stringify(comfortPrefs)
      );
      window.localStorage.setItem(
        'simulab-theme',
        comfortPrefs.theme === 'dark' ? 'dark' : 'light'
      );
    } catch {
      // ignore storage error
    }
  }, [comfortPrefs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'simulab-hypothesis-notes',
        JSON.stringify(hypothesisNotesByModule)
      );
    } catch {
      // ignore storage error
    }
  }, [hypothesisNotesByModule]);

  useEffect(() => {
    labSound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const currentProfile = STUDENT_PROFILES[selectedProfileIdx];

  // Physics State
  const [physicsParams, setPhysicsParams] = useState<PhysicsParams>({
    mass: 4.0,
    appliedForce: 45,
    inclineAngle: 15,
    frictionCoeffStatic: 0.2,
    frictionCoeffKinetic: 0.15,
    gravity: 9.81,
    initialVelocity: 0,
    launchAngle: 45,
    initialHeight: 0,
    secondaryMass: 1500,
    separationDistance: 5,
    collisionMass2: 2.0,
    velocity2Initial: -2.0,
    restitutionCoeff: 1.0,
    springConstantK: 120,
    springDisplacement: 0.8,
    dampingCoeff: 0.15,
    mode: 'newton-incline',
  });

  // Chemistry State
  const [chemistryParams, setChemistryParams] = useState<ChemistryParams>({
    mode: 'thermo-calorimetry',
    reactionId: 'neutralization-hcl-naoh',
    initialTempC: 25,
    reactantConcentration: 1.5,
    solutionVolumeMl: 250,
    pressureAtm: 1.0,
    useCatalyst: false,
    stirringRpm: 240,
    analyteAcidConc: 0.2,
    analyteVolumeMl: 25,
    titrantBaseConc: 0.25,
    titrantAddedMl: 18.0,
    acidPka: 1.0,
    indicatorType: 'fenolftalein',
    redoxPairId: 'zn-cu-daniell',
    anodeConcM: 1.0,
    cathodeConcM: 1.0,
  });

  // Biology Telemetry Context (kept in sync with BiologyLabView)
  const [biologyContext, setBiologyContext] = useState<BiologyTelemetryContext>({
    moduleId: 'photosynthesis-ingenhousz',
    params: {
      lightDistanceCm: 25,
      nahco3ConcPct: 0.5,
      waterTempC: 28,
      wavelengthNm: 660,
    },
  });

  // Astronomy State
  const [astronomyParams, setAstronomyParams] = useState<AstronomyParams>({
    mode: 'solar-kepler',
    selectedPlanetId: 'earth',
    customSemiMajorAxisAu: 1.0,
    customEccentricity: 0.017,
    centralStarMassSolar: 1.0,
    showKeplerAreaSweep: true,
    timeScaleSpeed: 1.0,
    galactocentricRadiusKpc: 8.2,
    bulgeDiskMassFactor: 1.0,
    darkMatterHaloFraction: 1.0,
    sgrAStarMassMillionSolar: 4.15,
    starEffectiveTempK: 5778,
    starRadiusSolar: 1.0,
    exoplanetRadiusEarth: 10.91,
    exoplanetOrbitAu: 1.0,
  });

  // Shared Multi-User State
  const [records, setRecords] = useState<ExperimentRecord[]>([
    {
      id: 'EXP-2401',
      timestamp: '08:42:15',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1 — Mekanika',
      domain: 'Fisika',
      experimentTitle: 'Hukum II Newton & Bidang Miring (θ = 15°)',
      parametersSummary: 'm=4.0 kg, F=45 N, θ=15°, μk=0.15, g=9.81 m/s²',
      keyMetrics: {
        'ΣF': '29.18 N',
        Percepatan: '7.30 m/s²',
        'Gaya Normal': '37.90 N',
        'Fg Universal': '0.1068 µN',
      },
      numericX: 45,
      numericY1: 7.3,
      numericY2: 29.18,
      notes: 'Percepatan meningkat linier terhadap resultan gaya sesuai F = m·a.',
    },
    {
      id: 'EXP-2402',
      timestamp: '08:49:30',
      studentName: 'Bima Wijaya',
      groupId: 'Kelompok 1 — Mekanika',
      domain: 'Fisika',
      experimentTitle: 'Kinematika Projektil & Gravitasi Mars (g = 3.72 m/s²)',
      parametersSummary: 'm=2.5 kg, v₀=20 m/s, ∠=45°, h₀=0 m, g=3.72 m/s²',
      keyMetrics: {
        'Jarak Maks (R)': '107.53 m',
        'Tinggi Puncak (H)': '26.88 m',
        'Waktu Tempuh': '7.61 s',
      },
      numericX: 20,
      numericY1: 107.53,
      numericY2: 26.88,
      notes:
        'Pada gravitasi Mars (3.72 m/s²), jangkauan horizontal hampir 2.6x lebih jauh dibanding Bumi.',
    },
    {
      id: 'EXP-2403',
      timestamp: '09:04:12',
      studentName: 'Citra Lestari',
      groupId: 'Kelompok 2 — Termokimia',
      domain: 'Kimia',
      experimentTitle: 'Kalorimetri Netralisasi HCl + NaOH',
      parametersSummary: 'T₀=25°C, [M]=1.5 mol/L, V=250 mL, Katalis=Aktif',
      keyMetrics: {
        'ΔH': '-57.30 kJ/mol',
        'ΔG': '-81.27 kJ/mol',
        'Suhu Akhir': '45.54 °C',
        Spontanitas: 'Spontan (ΔG < 0)',
      },
      numericX: 25,
      numericY1: -81.27,
      numericY2: 45.54,
      notes: 'Pelepasan kalor eksotermik menaikkan suhu larutan sebesar +20.54°C.',
    },
    {
      id: 'EXP-2404',
      timestamp: '09:14:40',
      studentName: 'Elena Putri',
      groupId: 'Kelompok 3 — Astrofisika',
      domain: 'Astronomi',
      experimentTitle: 'Orbit Hukum Kepler — Jupiter (a = 5.2 AU)',
      parametersSummary: 'Planet=Jupiter, a=5.2 AU, e=0.049, M*=1.0 M☉',
      keyMetrics: {
        'Periode T': '11.858 tahun',
        'v Orbit Rata-rata': '13.06 km/s',
        'Rasio T²/a³': '1.000',
      },
      numericX: 140.61,
      numericY1: 140.61,
      numericY2: 13.06,
      notes: 'Terbukti rasio T²/a³ = 1.000 sesuai Hukum III Kepler.',
    },
  ]);

  const [tasks, setTasks] = useState<GroupTaskItem[]>([
    {
      id: 'task-1',
      groupId: 'Kelompok 1 — Mekanika',
      title:
        'Uji Hukum I Newton: Tentukan batas gaya gesek statis maksimum pada bidang miring 20°',
      domain: 'Fisika',
      completed: true,
      completedBy: 'Alya Pratama',
    },
    {
      id: 'task-2',
      groupId: 'Kelompok 1 — Mekanika',
      title:
        'Bandingkan lintasan kinematika projektil antara gravitasi Bumi (9.81 m/s²) dan Bulan (1.62 m/s²)',
      domain: 'Fisika',
      completed: true,
      completedBy: 'Bima Wijaya',
    },
    {
      id: 'task-3',
      groupId: 'Kelompok 1 — Mekanika',
      title:
        'Simulasikan tumbukan elastis (e=1) vs inelastis (e=0) dan buktikan kekekalan momentum',
      domain: 'Fisika',
      completed: false,
    },
    {
      id: 'task-4',
      groupId: 'Kelompok 2 — Termokimia',
      title:
        'Tentukan titik ekuivalen titrasi HCl + NaOH serta potensial sel Galvani Zn/Cu pada LKS',
      domain: 'Kimia',
      completed: false,
    },
    {
      id: 'task-5',
      groupId: 'Kelompok 3 — Astrofisika',
      title:
        'Bandingkan kurva rotasi Galaksi Bima Sakti dengan & tanpa Halo Materi Gelap pada R = 8.2 kpc',
      domain: 'Astronomi',
      completed: true,
      completedBy: 'Elena Putri',
    },
  ]);

  const [notes, setNotes] = useState<CollabNoteItem[]>([
    {
      id: 'note-1',
      groupId: 'Kelompok 1 — Mekanika',
      author: 'Alya Pratama',
      role: 'Siswa',
      text: 'Saat sudut miring dinaikkan ke 20°, komponen gaya berat sejajar bidang (m·g·sin θ) langsung membantu melampaui gesekan statis.',
      timestamp: '08:45',
    },
    {
      id: 'note-2',
      groupId: 'Kelompok 1 — Mekanika',
      author: 'Dr. Hendra Kusuma (Pengajar)',
      role: 'Pengajar',
      text: 'Bagus Kelompok 1 & 3! Jangan lupa cek kurva regresi linier R² Hukum III Kepler dan kerjakan 6 soal LKS.',
      timestamp: '08:52',
    },
  ]);

  const [students, setStudents] = useState<StudentProgressItem[]>([
    {
      id: 'stu-1',
      name: 'Alya Pratama',
      groupId: 'Kelompok 1 — Mekanika',
      activeDomain: 'Fisika',
      currentActivity: 'Menjalankan Simulasi Hukum II Newton (m = 4.0 kg)',
      activeModuleTitle: 'Hukum II Newton & Bidang Miring',
      currentStep: 2,
      timeInStepMinutes: 4,
      rSquared: 0.985,
      trialsRecorded: 3,
      tasksCompleted: 2,
      totalTasks: 4,
      completionPct: 75,
      quizScore: 100,
      lastActive: 'Baru saja',
      status: 'Nominal',
    },
    {
      id: 'stu-2',
      name: 'Bima Wijaya',
      groupId: 'Kelompok 1 — Mekanika',
      activeDomain: 'Fisika',
      currentActivity: 'Menganalisis Tumbukan & Kinematika Gravitasi Mars',
      activeModuleTitle: 'Tumbukan 1D & Momentum',
      currentStep: 2,
      timeInStepMinutes: 6,
      rSquared: 0.92,
      trialsRecorded: 2,
      tasksCompleted: 2,
      totalTasks: 4,
      completionPct: 68,
      quizScore: 83,
      lastActive: '1 menit lalu',
      status: 'Nominal',
    },
    {
      id: 'stu-3',
      name: 'Citra Lestari',
      groupId: 'Kelompok 2 — Termokimia',
      activeDomain: 'Kimia',
      currentActivity: 'Titrasi Asam-Basa & Kalorimetri HCl + NaOH',
      activeModuleTitle: 'Titrasi Asam Basa',
      currentStep: 4,
      timeInStepMinutes: 2,
      rSquared: 0.995,
      trialsRecorded: 4,
      tasksCompleted: 3,
      totalTasks: 3,
      completionPct: 100,
      quizScore: 100,
      lastActive: 'Baru saja',
      status: 'Selesai',
    },
    {
      id: 'stu-4',
      name: 'Dimas Nugroho',
      groupId: 'Kelompok 2 — Termokimia',
      activeDomain: 'Kimia',
      currentActivity: 'Menguji Dekomposisi Endotermik CaCO₃ pada 50°C (ΔG > 0)',
      activeModuleTitle: 'Kalorimeter & Termokimia',
      currentStep: 3,
      timeInStepMinutes: 10,
      rSquared: 0.72,
      trialsRecorded: 1,
      tasksCompleted: 1,
      totalTasks: 3,
      completionPct: 40,
      quizScore: 50,
      lastActive: '2 menit lalu',
      status: 'Butuh Bantuan',
    },
    {
      id: 'stu-5',
      name: 'Elena Putri',
      groupId: 'Kelompok 3 — Astrofisika',
      activeDomain: 'Astronomi',
      currentActivity: 'Eksplorasi Galaksi Bima Sakti (Sgr A*) & Orbit Kepler',
      activeModuleTitle: 'Hukum III Kepler & Tata Surya',
      currentStep: 1,
      timeInStepMinutes: 3,
      trialsRecorded: 0,
      tasksCompleted: 0,
      totalTasks: 3,
      completionPct: 15,
      quizScore: 100,
      lastActive: 'Baru saja',
      status: 'Nominal',
    },
    {
      id: 'stu-6',
      name: 'Fajar Ramadhan',
      groupId: 'Kelompok 3 — Astrofisika',
      activeDomain: 'Biologi',
      currentActivity: 'Menghitung Laju Gelembung O₂ pada Intensitas 80W',
      activeModuleTitle: 'Fotosintesis Ingenhousz',
      currentStep: 2,
      timeInStepMinutes: 5,
      rSquared: 0.94,
      trialsRecorded: 2,
      tasksCompleted: 1,
      totalTasks: 3,
      completionPct: 60,
      quizScore: 90,
      lastActive: 'Baru saja',
      status: 'Nominal',
    },
  ]);

  const [notifications, setNotifications] = useState<LabNotification[]>([
    {
      id: 'notif-init-1',
      timestamp: '09:15:00',
      severity: 'nominal',
      domain: 'Astronomi',
      title: 'Alur Praktikum RuangLABmu Siap Digunakan',
      message:
        'Ikuti 4 tahap praktikum: (1) Pilih Modul & K3, (2) Simulasi 3D & Rekam Data, (3) Analisis Grafik & LKS, lalu (4) Laporan & Kolaborasi.',
      formulaHint: 'F = m·a | pH = -log[H⁺] | T²/a³ = 1/M*',
    },
  ]);

  const [activeSocket, setActiveSocket] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-lab`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isMounted) {
          setWsConnected(true);
          setActiveSocket(socket);
        }
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init:state' && msg.payload) {
            if (msg.payload.records) setRecords(msg.payload.records);
            if (msg.payload.tasks) setTasks(msg.payload.tasks);
            if (msg.payload.notes) setNotes(msg.payload.notes);
            if (msg.payload.students) setStudents(msg.payload.students);
            if (msg.payload.notifications) {
              setNotifications(msg.payload.notifications);
            }
          } else if (msg.type === 'record:created' && msg.payload) {
            const incoming: ExperimentRecord = msg.payload.record;
            setRecords((prev) =>
              prev.some((r) => r.id === incoming.id) ? prev : [incoming, ...prev]
            );
            if (msg.payload.students) setStudents(msg.payload.students);
          } else if (msg.type === 'record:deleted' && msg.payload?.id) {
            setRecords((prev) => prev.filter((r) => r.id !== msg.payload.id));
          } else if (msg.type === 'task:updated' && msg.payload?.tasks) {
            setTasks(msg.payload.tasks);
          } else if (msg.type === 'note:created' && msg.payload?.note) {
            const incomingNote: CollabNoteItem = msg.payload.note;
            setNotes((prev) =>
              prev.some((n) => n.id === incomingNote.id)
                ? prev
                : [...prev, incomingNote]
            );
          } else if (msg.type === 'params:synced' && msg.payload) {
            if (msg.payload.physicsParams) {
              setPhysicsParams(msg.payload.physicsParams);
            }
            if (msg.payload.chemistryParams) {
              setChemistryParams(msg.payload.chemistryParams);
            }
            if (msg.payload.astronomyParams) {
              setAstronomyParams(msg.payload.astronomyParams);
            }
            if (msg.payload.students) {
              setStudents(msg.payload.students);
            }
          } else if (msg.type === 'quiz:submitted' && msg.payload) {
            if (msg.payload.students) setStudents(msg.payload.students);
            if (msg.payload.notification) {
              setNotifications((prev) => [
                msg.payload.notification,
                ...prev.slice(0, 24),
              ]);
            }
          } else if (
            msg.type === 'notification:pushed' &&
            msg.payload?.notification
          ) {
            const incomingNotif: LabNotification = msg.payload.notification;
            setNotifications((prev) =>
              prev.some((n) => n.id === incomingNotif.id)
                ? prev
                : [incomingNotif, ...prev.slice(0, 24)]
            );
          } else if (msg.type === 'teacher:broadcasted' && msg.payload) {
            if (msg.payload.notification) {
              setNotifications((prev) => [
                msg.payload.notification,
                ...prev.slice(0, 24),
              ]);
            }
            if (msg.payload.note) {
              setNotes((prev) => [...prev, msg.payload.note]);
            }
            if (msg.payload.students) {
              setStudents(msg.payload.students);
            }
          } else if (msg.type === 'mystery:broadcasted' && msg.payload) {
            if (msg.payload.challenge) {
              setActiveMysteryChallenge(msg.payload.challenge);
            }
            if (msg.payload.notification) {
              setNotifications((prev) => [
                msg.payload.notification,
                ...prev.slice(0, 24),
              ]);
            }
          } else if (msg.type === 'mystery:submitted' && msg.payload) {
            if (msg.payload.result) {
              setMysterySubmissions((prev) => [msg.payload.result, ...prev]);
            }
            if (msg.payload.students) {
              setStudents(msg.payload.students);
            }
            if (msg.payload.notification) {
              setNotifications((prev) => [
                msg.payload.notification,
                ...prev.slice(0, 24),
              ]);
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        setActiveSocket(null);
        reconnectTimer = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const currentUserId = currentProfile.name.toLowerCase().replace(/\s+/g, '-');

  const {
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
  } = useSpatialCollab({
    ws: activeSocket,
    userId: currentUserId,
    userName: currentProfile.name,
    role: userRole === 'pengajar' ? 'Pengajar' : 'Siswa',
    groupId: currentProfile.group,
    domain: activeDomain,
    onRemoteParamSync: (paramKey, value) => {
      if (activeDomain === 'fisika') {
        setPhysicsParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'kimia') {
        setChemistryParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'astronomi') {
        setAstronomyParams((prev) => ({ ...prev, [paramKey]: value }));
      }
    },
  });

  const sendWsMessage = (type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  };

  const handlePushNotification = (notif: LabNotification) => {
    setNotifications((prev) =>
      prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev.slice(0, 24)]
    );
    sendWsMessage('notification:push', notif);
  };

  const handleRecordExperiment = (
    domain: ScienceDomain,
    title: string,
    paramsSummary: string,
    keyMetrics: Record<string, number | string>,
    noteText: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => {
    const newRecord: ExperimentRecord = {
      id: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      studentName: currentProfile.name,
      groupId: currentProfile.group,
      domain,
      experimentTitle: title,
      parametersSummary: paramsSummary,
      keyMetrics,
      numericX: numericCoords?.x,
      numericY1: numericCoords?.y1,
      numericY2: numericCoords?.y2,
      notes: noteText,
    };

    setRecords((prev) => [newRecord, ...prev]);
    setStudents((prev) =>
      prev.map((s) =>
        s.name === currentProfile.name
          ? {
              ...s,
              trialsRecorded: s.trialsRecorded + 1,
              completionPct: Math.min(100, s.completionPct + 8),
              activeDomain: domain,
              currentActivity: `Merekam data: ${title}`,
              lastActive: 'Baru saja',
            }
          : s
      )
    );
    sendWsMessage('record:create', newRecord);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    sendWsMessage('record:delete', { id });
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completedBy: !t.completed ? currentProfile.name : undefined,
            }
          : t
      )
    );
    sendWsMessage('task:toggle', { id, studentName: currentProfile.name });
  };

  const handleCreateTask = (title: string, domain: ScienceDomain) => {
    const newTask: GroupTaskItem = {
      id: `task-${Date.now()}`,
      groupId: currentProfile.group,
      title,
      domain,
      completed: false,
    };
    setTasks((prev) => [...prev, newTask]);
    sendWsMessage('task:create', newTask);
  };

  const handleCreateNote = (text: string) => {
    const newNote: CollabNoteItem = {
      id: `note-${Date.now()}`,
      groupId: currentProfile.group,
      author: currentProfile.name,
      role: 'Siswa',
      text,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setNotes((prev) => [...prev, newNote]);
    sendWsMessage('note:create', newNote);
  };

  const handleSubmitQuizScore = (score: number, correctCount: number) => {
    setLksGraded(true);
    setStudents((prev) =>
      prev.map((s) =>
        s.name === currentProfile.name
          ? {
              ...s,
              quizScore: score,
              completionPct: Math.min(100, Math.max(s.completionPct, 85)),
              currentActivity: `Menyelesaikan LKS & Kuis (Skor: ${score}/100)`,
              lastActive: 'Baru saja',
              status: score >= 75 ? 'Selesai' : s.status,
            }
          : s
      )
    );
    sendWsMessage('quiz:submit', {
      studentName: currentProfile.name,
      score,
      correctCount,
    });
    handlePushNotification({
      id: `notif-lks-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: score >= 75 ? 'nominal' : 'elevated',
      domain: 'Pengajar',
      title: `LKS & Kuis Dinilai Otomatis: ${score}/100`,
      message: `${currentProfile.name} menjawab ${correctCount}/6 soal dengan tepat. Nilai telah disinkronkan ke Matriks Rubrik Pengajar.`,
    });
  };

  const handleSyncWithGroup = (
    domain: ScienceDomain,
    activitySummary: string
  ) => {
    sendWsMessage('params:sync', {
      studentName: currentProfile.name,
      groupId: currentProfile.group,
      domain,
      activitySummary,
      physicsParams: domain === 'Fisika' ? physicsParams : undefined,
      chemistryParams: domain === 'Kimia' ? chemistryParams : undefined,
      astronomyParams: domain === 'Astronomi' ? astronomyParams : undefined,
    });

    handlePushNotification({
      id: `notif-sync-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'nominal',
      domain: 'Kolaborasi',
      title: `Parameter ${domain} Disinkronkan ke ${currentProfile.group}`,
      message: `${currentProfile.name} membagikan konfigurasi: ${activitySummary}`,
    });
  };

  const handleSendTeacherFeedback = (
    targetStudentId: string,
    message: string
  ) => {
    const targetStu = students.find((s) => s.id === targetStudentId);
    const notif: LabNotification = {
      id: `notif-teacher-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'nominal',
      domain: 'Pengajar',
      title: `Umpan Balik Pengajar untuk ${
        targetStu ? targetStu.name : 'Semua Kelompok'
      }`,
      message,
    };
    setNotifications((prev) => [notif, ...prev]);
    setNotes((prev) => [
      ...prev,
      {
        id: `note-t-${Date.now()}`,
        groupId: targetStu ? targetStu.groupId : currentProfile.group,
        author: 'Dr. Hendra Kusuma (Pengajar)',
        role: 'Pengajar',
        text: message,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    sendWsMessage('teacher:feedback', {
      targetStudentId,
      message,
      author: 'Dr. Hendra Kusuma (Pengajar)',
    });
  };

  const handleBroadcastMysteryChallenge = (challenge: MysterySampleChallenge) => {
    setActiveMysteryChallenge(challenge);
    sendWsMessage('mystery:broadcast', {
      challenge,
      author: 'Dr. Hendra Kusuma (Pengajar)',
    });
    handlePushNotification({
      id: `notif-myst-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'elevated',
      domain: 'Pengajar',
      title: `Ujian Sampel Misterius Disiarkan: ${challenge.codename}`,
      message: `${challenge.title} (${challenge.domain}) telah aktif. Nilai parameter disamarkan untuk diuji oleh siswa!`,
    });
  };

  const handleSubmitMysteryExam = (
    studentName: string,
    result: MysterySubmissionResult,
    title: string
  ) => {
    setMysterySubmissions((prev) => [result, ...prev]);
    sendWsMessage('mystery:submit', {
      studentName,
      result,
      challengeTitle: title,
    });
    handlePushNotification({
      id: `notif-myst-sub-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: result.passed ? 'nominal' : 'elevated',
      domain: 'Pengajar',
      title: `Ujian Misterius ${result.codename} Dinilai: Skor ${result.score}/100`,
      message: `${studentName} mengirimkan hasil: ${result.studentGuess} (Galat: ${result.errorPercentage}%). Predikat: ${result.verdict}.`,
    });
  };

  const handleExportAllCSV = () => {
    labSound.playClick();
    const csv = exportRecordsToCSV(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'simulab-sains-seluruh-eksperimen.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    handlePushNotification({
      id: `notif-csv-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'nominal',
      domain: 'Kolaborasi',
      title: 'Ekspor CSV Berhasil Diunduh',
      message: `${records.length} baris data eksperimen telah diekspor dalam format CSV.`,
    });
  };

  const handleInjectOutlierDemo = (domain: ScienceDomain) => {
    if (domain === 'Fisika') {
      setPhysicsParams((prev) => ({
        ...prev,
        mode: 'projectile-gravity',
        launchAngle: 85,
        initialVelocity: 20,
      }));
      handleRecordExperiment(
        'Fisika',
        'Kinematika Projektil — Sudut Ekstrem (∠ = 85°)',
        'm=2.5 kg, v₀=20 m/s, ∠=85°, h₀=0 m, g=9.81 m/s²',
        {
          'Jarak Maks (R)': '7.08 m',
          'Tinggi Puncak (H)': '20.23 m',
          'Waktu Tempuh': '4.06 s',
        },
        'Sudut elevasi terlalu curam (85°) menyebabkan jangkauan horizontal merosot tajam (Outlier Non-Linier).',
        { x: 85, y1: 7.08, y2: 20.23 }
      );
    } else if (domain === 'Kimia') {
      handleRecordExperiment(
        'Kimia',
        'Lonjakan Titik Ekuivalen Titrasi (V = 20.5 mL)',
        'M_asam=0.2 M, V_asam=25 mL, V_NaOH=20.5 mL',
        {
          pH: '11.45',
          Status: 'Pasca-Ekuivalen (Lonjakan Sigmoidal)',
        },
        'Lonjakan pH tajam melewati titik ekuivalen menyebabkan deviasi dari garis linier pra-ekuivalen.',
        { x: 20.5, y1: 11.45, y2: 20.0 }
      );
    } else if (domain === 'Biologi') {
      handleRecordExperiment(
        'Biologi',
        'Fotosintesis Ingenhousz — Denaturasi Termal (T = 48°C)',
        'd=20 cm, NaHCO₃=0.5%, T=48°C, λ=660 nm',
        {
          'Laju O₂': '2 gelembung/menit',
          Status: 'Denaturasi Enzim Rubisco (>40°C)',
        },
        'Suhu air di atas 40°C mendenaturasi enzim fotosintesis sehingga produksi O₂ anjlok drastis.',
        { x: 48, y1: 2, y2: 0.4 }
      );
    } else {
      handleRecordExperiment(
        'Astronomi',
        'Anomali Orbit Eksentrik Komet Halley (e = 0.82)',
        'Planet=Komet Halley, a=17.8 AU, e=0.82',
        {
          'Periode T': '75.10 tahun',
          'v Perihelion': '54.55 km/s',
        },
        'Eksentrisitas tinggi menyebabkan lonjakan kecepatan perihelion ekstrem.',
        { x: 17.8, y1: 54.55, y2: 75.1 }
      );
    }
  };

  // Resolve current experiment module ID for Catalog highlight
  const currentExperimentId = (() => {
    if (activeDomain === 'fisika') {
      if (physicsParams.mode === 'newton-incline') return 'newton-incline';
      if (physicsParams.mode === 'projectile-gravity') return 'projectile-motion';
      if (physicsParams.mode === 'collision-momentum') return 'collision-momentum';
      if (physicsParams.mode === 'spring-hooke') return 'spring-hooke';
      if (physicsParams.mode === 'pendulum-harmonic') return 'pendulum-harmonic';
      if (physicsParams.mode === 'stokes-viscosity') return 'stokes-viscosity';
      if (physicsParams.mode === 'ohm-wheatstone') return 'ohm-wheatstone';
      if (physicsParams.mode === 'optics-young-slit') return 'optics-young-slit';
      if (physicsParams.mode === 'photoelectric-planck') return 'photoelectric-planck';
      return 'gravity-orbital';
    }
    if (activeDomain === 'kimia') {
      if (chemistryParams.mode === 'thermo-calorimetry') return 'thermo-calorimetry';
      if (chemistryParams.mode === 'acid-base-titration') return 'acid-base-titration';
      if (chemistryParams.mode === 'electrochemistry-cell') return 'redox-electrochemistry';
      if (chemistryParams.mode === 'ideal-gas-boyle') return 'ideal-gas-boyle';
      if (chemistryParams.mode === 'reaction-kinetics-arrhenius') return 'reaction-kinetics-arrhenius';
      if (chemistryParams.mode === 'spectrophotometry-beer') return 'spectrophotometry-beer';
      return 'thermo-calorimetry';
    }
    if (activeDomain === 'biologi') {
      return selectedBioModuleId;
    }
    if (astronomyParams.mode === 'solar-kepler') return 'solar-kepler';
    if (astronomyParams.mode === 'milkyway-galaxy') return 'milky-way-rotation';
    if (astronomyParams.mode === 'stellar-exoplanet') return 'exoplanet-transit';
    if (astronomyParams.mode === 'stellar-wien-spectrum') return 'stellar-wien-spectrum';
    if (astronomyParams.mode === 'hubble-expansion') return 'hubble-expansion';
    return 'solar-kepler';
  })();

  const handleSelectCatalogExperiment = (
    exp: ExperimentModule,
    targetStep: WorkflowStep = 1
  ) => {
    const dom = exp.domain as LabDomainId;
    setActiveDomain(dom);

    if (dom === 'fisika') {
      const modeMap: Record<string, PhysicsParams['mode']> = {
        'newton-incline': 'newton-incline',
        'projectile-motion': 'projectile-gravity',
        'collision-momentum': 'collision-momentum',
        'spring-hooke': 'spring-hooke',
        'gravity-orbital': 'orbital-gravity',
        'pendulum-harmonic': 'pendulum-harmonic',
        'stokes-viscosity': 'stokes-viscosity',
        'ohm-wheatstone': 'ohm-wheatstone',
        'optics-young-slit': 'optics-young-slit',
        'photoelectric-planck': 'photoelectric-planck',
      };
      setPhysicsParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || (exp.id as PhysicsParams['mode']) || 'newton-incline',
      }));
    } else if (dom === 'kimia') {
      const modeMap: Record<string, ChemistryParams['mode']> = {
        'thermo-calorimetry': 'thermo-calorimetry',
        'acid-base-titration': 'acid-base-titration',
        'redox-electrochemistry': 'electrochemistry-cell',
        'ideal-gas-boyle': 'ideal-gas-boyle',
        'reaction-kinetics-arrhenius': 'reaction-kinetics-arrhenius',
        'spectrophotometry-beer': 'spectrophotometry-beer',
      };
      setChemistryParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || (exp.id as ChemistryParams['mode']) || 'thermo-calorimetry',
      }));
    } else if (dom === 'biologi') {
      setSelectedBioModuleId(exp.id);
    } else if (dom === 'astronomi') {
      const modeMap: Record<string, AstronomyParams['mode']> = {
        'solar-kepler': 'solar-kepler',
        'milky-way-rotation': 'milkyway-galaxy',
        'exoplanet-transit': 'stellar-exoplanet',
        'stellar-wien-spectrum': 'stellar-wien-spectrum',
        'hubble-expansion': 'hubble-expansion',
      };
      setAstronomyParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || (exp.id as AstronomyParams['mode']) || 'solar-kepler',
      }));
    }

    setCompletedSafetyIds((prev) =>
      prev.includes(exp.id) ? prev : [...prev, exp.id]
    );
    setIsLobbyMode(false);
    setWorkflowStep(targetStep);
  };

  const currentExperimentModule = useMemo(() => {
    return getExperimentById(currentExperimentId) || EXPERIMENT_CATALOG[0];
  }, [currentExperimentId]);

  const currentModuleHypothesis: HypothesisNote = useMemo(() => {
    return (
      hypothesisNotesByModule[currentExperimentId] || {
        independentVar:
          currentExperimentModule.parameters[0]?.label || 'Variabel Bebas (X)',
        dependentVar:
          currentExperimentModule.outputs[0]?.label || 'Variabel Terikat (Y)',
        hypothesisText: '',
        reflectionText: '',
        updatedAt: '',
      }
    );
  }, [hypothesisNotesByModule, currentExperimentId, currentExperimentModule]);

  const handleUpdateCurrentHypothesis = (next: HypothesisNote) => {
    setHypothesisNotesByModule((prev) => ({
      ...prev,
      [currentExperimentId]: next,
    }));
  };

  const handleChangeComfortTheme = (theme: EyeComfortTheme) => {
    setComfortPrefs((prev) => ({ ...prev, theme }));
  };

  const handleOpenMysteryExamFromLobby = () => {
    labSound.playRecordSuccess();
    const preset = PRESET_MYSTERY_CHALLENGES[0];
    setActiveMysteryChallenge(preset);
    const exp = EXPERIMENT_CATALOG.find((e) => e.id === preset.moduleId) || EXPERIMENT_CATALOG[0];
    handleSelectCatalogExperiment(exp, 2);
    handlePushNotification({
      id: `notif-mystery-start-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      severity: 'nominal',
      domain: 'Pengajar',
      title: `Ujian Sampel Misterius Dimulai: ${preset.codename}`,
      message: `Parameter ${preset.hiddenParamKey} disembunyikan. Ukur respon telemetri dan kirimkan estimasi Anda!`,
    });
  };

  const [lksAnswers, setLksAnswers] = useState<Record<string, string>>({});

  // Handler to capture 3D WebGL snapshots and store them for Step 4 Gallery & A4 Report
  const handleCapture3DSnapshot = (
    domain: ScienceDomain,
    dataUrl: string,
    moduleTitle: string,
    paramsSummary: string,
    primaryMetric: string
  ) => {
    const newSnap: Lab3DSnapshot = {
      id: `SNAP-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      domain,
      moduleTitle,
      parametersSummary: paramsSummary,
      primaryMetric,
      dataUrl,
    };
    setCapturedSnapshots((prev) => [newSnap, ...prev.slice(0, 7)]);
    handlePushNotification({
      id: `notif-snap-${Date.now()}`,
      timestamp: newSnap.timestamp,
      severity: 'nominal',
      domain,
      title: `Tangkapan Layar 3D Tersimpan (${newSnap.id})`,
      message: `Visualisasi 3D "${moduleTitle}" (${primaryMetric}) telah ditambahkan ke Galeri & Lampiran Laporan A4.`,
    });
  };

  // Handler when a student completes an Automatic Target Challenge Mission in the 3D cockpit
  const handleCompleteChallenge = (challenge: TargetChallengeMission) => {
    setCompletedChallengeIds((prev) =>
      prev.includes(challenge.id) ? prev : [...prev, challenge.id]
    );
    setStudents((prev) =>
      prev.map((s) =>
        s.name === currentProfile.name
          ? {
              ...s,
              completionPct: Math.min(100, s.completionPct + 10),
              currentActivity: `Menyelesaikan ${challenge.title} (+${challenge.points} XP)`,
              lastActive: 'Baru saja',
            }
          : s
      )
    );
    handlePushNotification({
      id: `notif-chal-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'nominal',
      domain: challenge.domain,
      title: `Misi Tantangan Tercapai: ${challenge.title} (+${challenge.points} Poin)`,
      message: `${currentProfile.name} berhasil mencapai target ${challenge.targetValue} ${challenge.unit}! Lencana & skor kelas diperbarui.`,
    });
  };

  // Handler to replay any recorded trial back into the 3D Simulation Cockpit
  const handleReplayRecord = (rec: ExperimentRecord) => {
    labSound.playRecordSuccess();
    const domMap: Record<ScienceDomain, LabDomainId> = {
      Fisika: 'fisika',
      Kimia: 'kimia',
      Biologi: 'biologi',
      Astronomi: 'astronomi',
    };
    const targetDom = domMap[rec.domain] || 'fisika';
    setActiveDomain(targetDom);

    // Parse key=number pairs from parametersSummary if available
    const summary = rec.parametersSummary;
    const extractNum = (pattern: RegExp): number | null => {
      const m = summary.match(pattern);
      return m && m[1] ? parseFloat(m[1]) : null;
    };

    if (rec.domain === 'Fisika') {
      const mVal = extractNum(/m=([\d.]+)/);
      const fVal = extractNum(/F=([-\d.]+)/);
      const thVal = extractNum(/θ=([\d.]+)/);
      const gVal = extractNum(/g=([\d.]+)/);
      const v0Val = extractNum(/v₀=([\d.]+)/);
      const kVal = extractNum(/k=([\d.]+)/);
      setPhysicsParams((prev) => ({
        ...prev,
        ...(mVal !== null ? { mass: mVal } : {}),
        ...(fVal !== null ? { appliedForce: fVal } : {}),
        ...(thVal !== null ? { inclineAngle: thVal } : {}),
        ...(gVal !== null ? { gravity: gVal } : {}),
        ...(v0Val !== null ? { initialVelocity: v0Val } : {}),
        ...(kVal !== null ? { springConstantK: kVal } : {}),
      }));
    } else if (rec.domain === 'Kimia') {
      const t0Val = extractNum(/T₀=([\d.]+)/);
      const vbVal = extractNum(/V_b=([\d.]+)/);
      const maVal = extractNum(/\[Asam\]=([\d.]+)/);
      setChemistryParams((prev) => ({
        ...prev,
        ...(t0Val !== null ? { initialTempC: t0Val } : {}),
        ...(vbVal !== null ? { titrantAddedMl: vbVal } : {}),
        ...(maVal !== null ? { analyteAcidConc: maVal } : {}),
      }));
    } else if (rec.domain === 'Astronomi') {
      const aVal = extractNum(/a=([\d.]+)/);
      const eVal = extractNum(/e=([\d.]+)/);
      const rVal = extractNum(/R=([\d.]+)/);
      setAstronomyParams((prev) => ({
        ...prev,
        ...(aVal !== null ? { customSemiMajorAxisAu: aVal } : {}),
        ...(eVal !== null ? { customEccentricity: eVal } : {}),
        ...(rVal !== null ? { galactocentricRadiusKpc: rVal } : {}),
      }));
    }

    setIsLobbyMode(false);
    setWorkflowStep(2);
    handlePushNotification({
      id: `notif-replay-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      severity: 'nominal',
      domain: rec.domain,
      title: `Memutar Ulang Rekaman ${rec.id}`,
      message: `Parameter "${rec.parametersSummary}" telah dimuat ulang ke Kokpit Simulasi 3D.`,
    });
  };

  const studentBadges = useMemo(
    () =>
      computeStudentBadges({
        completedSafetyCount: completedSafetyIds.length,
        recordsCount: records.length,
        lksGraded,
        snapshotsCount: capturedSnapshots.length,
        challengesSolvedCount: completedChallengeIds.length,
      }),
    [
      completedSafetyIds.length,
      records.length,
      lksGraded,
      capturedSnapshots.length,
      completedChallengeIds.length,
    ]
  );

  const {
    recoverableSession,
    showRecoveryBanner,
    formattedRecoveryTime,
    restoreSession,
    discardAndRestart,
  } = useLabSessionAutoSave({
    studentId: currentProfile.name,
    activeModuleId: currentExperimentId,
    activeWorkflowStep: workflowStep,
    recordedTrials: records,
    lksAnswers,
    safetyPledgeAgreed: completedSafetyIds.includes(currentExperimentId),
    physicsParams,
    chemistryParams,
    astronomyParams,
    isLobbyMode,
    onRestoreSession: (session) => {
      labSound.playRecordSuccess();
      setIsLobbyMode(false);
      setWorkflowStep(session.activeWorkflowStep);
      if (session.recordedTrials && session.recordedTrials.length > 0) {
        setRecords(session.recordedTrials);
      }
      if (session.lksAnswers) {
        setLksAnswers(session.lksAnswers);
      }
      if (session.physicsParams) setPhysicsParams(session.physicsParams);
      if (session.chemistryParams) setChemistryParams(session.chemistryParams);
      if (session.astronomyParams) setAstronomyParams(session.astronomyParams);
      if (session.safetyPledgeAgreed) {
        setCompletedSafetyIds((prev) =>
          prev.includes(session.moduleId) ? prev : [...prev, session.moduleId]
        );
      }
      handlePushNotification({
        id: `notif-restore-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        severity: 'nominal',
        domain: 'Fisika',
        title: 'Sesi Praktikum Berhasil Dipulihkan',
        message: `Melanjutkan dari Tahap ${session.activeWorkflowStep} dengan ${session.recordedTrials.length} data percobaan tersimpan.`,
      });
    },
  });

  const activeScienceDomain: ScienceDomain =
    activeDomain === 'kimia'
      ? 'Kimia'
      : activeDomain === 'biologi'
      ? 'Biologi'
      : activeDomain === 'astronomi'
      ? 'Astronomi'
      : 'Fisika';

  const activeTierLabel: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  const is3DStageActive = !isLobbyMode && userRole === 'siswa' && workflowStep === 2;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
      {/* Unified Single-Row Top Navigation Bar (h-14) */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 bg-slate-950 border-b border-slate-800 text-white z-50 select-none">
        {/* Zone 1: Brand Identity, Back to Catalog & Active Module Title */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setIsLobbyMode(true);
            }}
            className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center shadow-xs">
              <Atom className="w-4 h-4 text-white" />
            </span>
            <span>RuangLABmu</span>
          </button>

          {!isLobbyMode && userRole === 'siswa' && (
            <>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setIsLobbyMode(true);
                }}
                className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>← Katalog Lab</span>
              </button>
              <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-slate-400 truncate max-w-[180px] pl-1 border-l border-slate-800">
                <span className="font-mono text-[10px] font-bold uppercase text-sky-400 shrink-0">
                  {currentExperimentModule.domain}
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className="font-semibold text-slate-200 truncate"
                  title={currentExperimentModule.title}
                >
                  {currentExperimentModule.title}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Zone 2: Integrated 4-Step Workflow Stepper or Context Status (Center) */}
        <div className="flex items-center justify-center shrink-0">
          {userRole === 'siswa' ? (
            !isLobbyMode ? (
              <nav
                aria-label="Tahapan Praktikum"
                className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shrink-0"
              >
                {(
                  [
                    { step: 1 as WorkflowStep, label: '1. K3 & Hipotesis', done: workflowStep > 1 },
                    {
                      step: 2 as WorkflowStep,
                      label: '2. Simulasi 3D',
                      done: records.length >= 3 || workflowStep > 2,
                      badge: `${records.length}/3`,
                    },
                    {
                      step: 3 as WorkflowStep,
                      label: '3. Grafik & LKS',
                      done: lksGraded || workflowStep > 3,
                    },
                    {
                      step: 4 as WorkflowStep,
                      label: '4. Laporan',
                      done: workflowStep === 4 && records.length >= 3 && lksGraded,
                    },
                  ] as const
                ).map((item) => {
                  const isActive = workflowStep === item.step;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setWorkflowStep(item.step);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-xs'
                          : item.done
                          ? 'text-emerald-400 hover:bg-slate-800/80'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {item.done && !isActive && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span>{item.label}</span>
                      {'badge' in item && item.badge && (
                        <span
                          className={`font-mono text-[10px] px-1 rounded tabular-nums ${
                            isActive
                              ? 'bg-sky-800/90 text-sky-100'
                              : records.length >= 3
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span className="font-semibold text-slate-200">Pusat Praktikum Sains Virtual</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="font-mono text-amber-400 text-[11px] font-semibold">
                  Jenjang {activeTierLabel}
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <GraduationCap className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold whitespace-nowrap">
                Ruang Evaluasi Pengajar · {students.length} Siswa Aktif
              </span>
            </div>
          )}
        </div>

        {/* Zone 3: Role Switcher, Student Selector, Utilities & Slide-Over Drawer Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Role Switcher */}
          <div
            className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs"
            role="group"
            aria-label="Mode Peran Pengguna"
          >
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setUserRole('siswa');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                userRole === 'siswa'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode Siswa
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setUserRole('pengajar');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                userRole === 'pengajar'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Pengajar</span>
            </button>
          </div>

          {/* Ergonomic Visual Comfort & Focus/Zen Toolbar */}
          <VisualComfortToolbar
            prefs={comfortPrefs}
            onChangePrefs={setComfortPrefs}
            zenMode={zenMode}
            onToggleZenMode={() => setZenMode((prev) => !prev)}
            showZenToggle={!isLobbyMode && userRole === 'siswa'}
          />

          {/* Dr. LabMu Mentor Slide-Over Trigger */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              if (drawerOpen && drawerTab === 'dr-labmu') {
                setDrawerOpen(false);
              } else {
                setDrawerTab('dr-labmu');
                setDrawerOpen(true);
              }
            }}
            title="Buka Laci Asisten Sokratik Dr. LabMu"
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              drawerOpen && drawerTab === 'dr-labmu'
                ? 'bg-sky-600 border-sky-500 text-white'
                : 'bg-slate-900 border-slate-800 text-sky-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dr. LabMu</span>
          </button>

          {/* Consolidated Profile, Sound, CSV & Notifications Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setUtilityMenuOpen((v) => !v);
              }}
              className={`relative px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                utilityMenuOpen
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Profil Siswa, Efek Suara, Unduh CSV & Notifikasi"
            >
              <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="hidden xl:inline max-w-[110px] truncate">
                {currentProfile.name.split(' ')[0]}
              </span>
              <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {notifications.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 text-[9px] font-black flex items-center justify-center tabular-nums">
                  {notifications.length}
                </span>
              )}
            </button>

            {utilityMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3.5 space-y-3 z-50 text-xs text-slate-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white">Profil &amp; Utilitas Lab</span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {wsConnected ? '● Kolaborasi Aktif' : '● Sesi Lokal'}
                  </span>
                </div>

                {userRole === 'siswa' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400">
                      Profil Siswa &amp; Kelompok Aktif
                    </label>
                    <select
                      aria-label="Pilih Profil Siswa Aktif"
                      value={selectedProfileIdx}
                      onChange={(e) => {
                        labSound.playClick();
                        setSelectedProfileIdx(Number(e.target.value));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {STUDENT_PROFILES.map((p, idx) => (
                        <option key={p.name} value={idx}>
                          {p.name} ({p.group.split('—')[0].trim()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) labSound.playClick();
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-sky-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-500" />
                      )}
                      <span>Efek Suara Instrumen</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        soundEnabled ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {soundEnabled ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUtilityMenuOpen(false);
                      handleExportAllCSV();
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Unduh CSV Data ({records.length})</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">.CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setUtilityMenuOpen(false);
                      setDrawerTab('notifications');
                      setDrawerOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span>Buka Log Notifikasi &amp; Arahan</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-sky-400 tabular-nums">
                      {notifications.length} Pesan
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SESSION AUTO-SAVE RECOVERY PROMPT BANNER */}
      <AnimatePresence>
        {showRecoveryBanner && recoverableSession && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-[1380px] mx-auto my-2 px-4 py-2.5 bg-gradient-to-r from-sky-950 via-slate-900 to-emerald-950 border border-sky-500/40 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white z-40 shrink-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                <RotateCcw className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <div className="font-bold text-sky-300">
                  Sesi Praktikum Sebelumnya Terdeteksi ({formattedRecoveryTime})
                </div>
                <div className="text-slate-300 text-[11px]">
                  Lanjutkan dari Tahap {recoverableSession.activeWorkflowStep} ({recoverableSession.recordedTrials.length} data tersimpan)?
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={discardAndRestart}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
              >
                Mulai Ulang
              </button>
              <button
                type="button"
                onClick={restoreSession}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Lanjutkan Sesi →</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Container */}
      <main
        className={`relative w-full flex-1 ${
          is3DStageActive
            ? 'h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-950'
            : 'h-[calc(100vh-3.5rem)] overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 select-text'
        }`}
      >
        <Suspense fallback={<LabLoadingSkeleton />}>
          {/* MODE PENGAJAR: Dedicated Teacher Evaluation & Rubric Workspace */}
        {userRole === 'pengajar' && (
          <div className="max-w-[1380px] mx-auto pb-12 space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-semibold">
                  Mode Evaluasi Pengajar
                </div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Dashboard Pemantauan Kelas, Rubrik Otomatis & Umpan Balik
                </h1>
              </div>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setUserRole('siswa');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                ← Kembali ke Mode Praktikum Siswa
              </button>
            </div>

            <TeacherDashboardView
              students={students}
              records={records}
              onSendTeacherFeedback={handleSendTeacherFeedback}
              onExportGradesNotification={(count) =>
                handlePushNotification({
                  id: `notif-grades-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Rekap Nilai Rubrik Kelas (CSV) Diunduh',
                  message: `Daftar nilai rubrik otomatis untuk ${count} siswa berhasil diekspor ke CSV.`,
                })
              }
              activeMysteryChallenge={activeMysteryChallenge}
              onBroadcastMysteryChallenge={handleBroadcastMysteryChallenge}
              mysterySubmissions={mysterySubmissions}
            />
          </div>
        )}

        {/* MODE SISWA — Lab Lobby & Module Selection Hub */}
        {userRole === 'siswa' && isLobbyMode && (
          <LabLobbyHub
            activeTier={activeTierLabel}
            studentName={currentProfile.name}
            studentGroup={currentProfile.group}
            completedModuleIds={completedSafetyIds}
            recordsCount={records.length}
            onTierChange={(tier) => {
              setAcademicLevel(tier.toLowerCase() as AcademicLevel);
            }}
            onSelectExperiment={(exp) => {
              handleSelectCatalogExperiment(exp, 1);
            }}
            onOpenMysteryExam={handleOpenMysteryExamFromLobby}
            comfortTheme={comfortPrefs.theme}
            onChangeComfortTheme={handleChangeComfortTheme}
            badges={studentBadges}
          />
        )}

        {/* MODE SISWA — TAHAP 1: Pengenalan & K3 */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 1 && (
          <PreLabBriefingView
            experiment={currentExperimentModule}
            activeTier={activeTierLabel}
            onProceedToSimulation={() => setWorkflowStep(2)}
            onBackToLobby={() => setIsLobbyMode(true)}
            hypothesisNote={currentModuleHypothesis}
            onChangeHypothesisNote={handleUpdateCurrentHypothesis}
          />
        )}

        {/* MODE SISWA — TAHAP 2: Kokpit Simulasi 3D & Pengambilan Data */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 2 && (
          <>
            {activeDomain === 'fisika' && (
              <PhysicsLabView
                params={physicsParams}
                onChangeParams={setPhysicsParams}
                academicLevel={academicLevel}
                records={records}
                activeStudentName={currentProfile.name}
                activeGroupId={currentProfile.group}
                onDeleteRecord={handleDeleteRecord}
                onExportCSV={handleExportAllCSV}
                onSubmitQuizScore={handleSubmitQuizScore}
                onProceedToAnalysis={() => setWorkflowStep(3)}
                onBackToCatalog={() => setIsLobbyMode(true)}
                onRecordExperiment={(
                  title,
                  summary,
                  keyMetrics,
                  noteText,
                  numericCoords
                ) =>
                  handleRecordExperiment(
                    'Fisika',
                    title,
                    summary,
                    keyMetrics,
                    noteText,
                    numericCoords
                  )
                }
                onPushNotification={handlePushNotification}
                onSyncWithGroup={(summary) =>
                  handleSyncWithGroup('Fisika', summary)
                }
                remoteCursors={remoteCursors}
                onEmitCursor={emitCursor3D}
                paramLocks={paramLocks}
                onAcquireLock={acquireParamLock}
                onReleaseLock={releaseParamLock}
                activeMysteryChallenge={activeMysteryChallenge}
                onSubmitMysteryExam={handleSubmitMysteryExam}
                hypothesisNote={currentModuleHypothesis}
                onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                zenMode={zenMode}
                snapshotCount={capturedSnapshots.length}
                onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                  handleCapture3DSnapshot('Fisika', dataUrl, modTitle, pSum, pMetric)
                }
                completedChallengeIds={completedChallengeIds}
                onCompleteChallenge={handleCompleteChallenge}
              />
            )}

            {activeDomain === 'kimia' && (
              <ChemistryLabView
                params={chemistryParams}
                onChangeParams={setChemistryParams}
                academicLevel={academicLevel}
                records={records}
                activeStudentName={currentProfile.name}
                activeGroupId={currentProfile.group}
                onDeleteRecord={handleDeleteRecord}
                onExportCSV={handleExportAllCSV}
                onSubmitQuizScore={handleSubmitQuizScore}
                onProceedToAnalysis={() => setWorkflowStep(3)}
                onBackToCatalog={() => setIsLobbyMode(true)}
                onRecordExperiment={(
                  title,
                  summary,
                  keyMetrics,
                  noteText,
                  numericCoords
                ) =>
                  handleRecordExperiment(
                    'Kimia',
                    title,
                    summary,
                    keyMetrics,
                    noteText,
                    numericCoords
                  )
                }
                onPushNotification={handlePushNotification}
                onSyncWithGroup={(summary) =>
                  handleSyncWithGroup('Kimia', summary)
                }
                remoteCursors={remoteCursors}
                onEmitCursor={emitCursor3D}
                activeMysteryChallenge={activeMysteryChallenge}
                onSubmitMysteryExam={handleSubmitMysteryExam}
                hypothesisNote={currentModuleHypothesis}
                onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                zenMode={zenMode}
                snapshotCount={capturedSnapshots.length}
                onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                  handleCapture3DSnapshot('Kimia', dataUrl, modTitle, pSum, pMetric)
                }
                completedChallengeIds={completedChallengeIds}
                onCompleteChallenge={handleCompleteChallenge}
              />
            )}

            {activeDomain === 'biologi' && (
              <BiologyLabView
                activeStudentName={currentProfile.name}
                activeGroupId={currentProfile.group}
                activeTier={activeTierLabel}
                selectedModuleId={selectedBioModuleId}
                onSelectModuleId={setSelectedBioModuleId}
                records={records}
                onDeleteRecord={handleDeleteRecord}
                onExportCSV={handleExportAllCSV}
                onSubmitQuizScore={handleSubmitQuizScore}
                onProceedToAnalysis={() => setWorkflowStep(3)}
                onBackToCatalog={() => setIsLobbyMode(true)}
                onBiologyContextChange={setBiologyContext}
                onRecordExperiment={(
                  _domain,
                  title,
                  paramsSummary,
                  keyMetrics,
                  noteText,
                  numericCoords
                ) =>
                  handleRecordExperiment(
                    'Biologi',
                    title,
                    paramsSummary,
                    keyMetrics,
                    noteText,
                    numericCoords
                  )
                }
                remoteCursors={remoteCursors}
                onEmitCursor={emitCursor3D}
                paramLocks={paramLocks}
                onAcquireLock={acquireParamLock}
                onReleaseLock={releaseParamLock}
                onTierChange={(newTier) => {
                  setAcademicLevel(newTier.toLowerCase() as AcademicLevel);
                }}
                hypothesisNote={currentModuleHypothesis}
                onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                zenMode={zenMode}
                snapshotCount={capturedSnapshots.length}
                onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                  handleCapture3DSnapshot('Biologi', dataUrl, modTitle, pSum, pMetric)
                }
                completedChallengeIds={completedChallengeIds}
                onCompleteChallenge={handleCompleteChallenge}
              />
            )}

            {activeDomain === 'astronomi' && (
              <AstronomyLabView
                params={astronomyParams}
                onChangeParams={setAstronomyParams}
                academicLevel={academicLevel}
                records={records}
                activeStudentName={currentProfile.name}
                activeGroupId={currentProfile.group}
                onDeleteRecord={handleDeleteRecord}
                onExportCSV={handleExportAllCSV}
                onSubmitQuizScore={handleSubmitQuizScore}
                onProceedToAnalysis={() => setWorkflowStep(3)}
                onBackToCatalog={() => setIsLobbyMode(true)}
                onRecordExperiment={(
                  title,
                  summary,
                  keyMetrics,
                  noteText,
                  numericCoords
                ) =>
                  handleRecordExperiment(
                    'Astronomi',
                    title,
                    summary,
                    keyMetrics,
                    noteText,
                    numericCoords
                  )
                }
                onPushNotification={handlePushNotification}
                onSyncWithGroup={(summary) =>
                  handleSyncWithGroup('Astronomi', summary)
                }
                remoteCursors={remoteCursors}
                onEmitCursor={emitCursor3D}
                activeMysteryChallenge={activeMysteryChallenge}
                onSubmitMysteryExam={handleSubmitMysteryExam}
                hypothesisNote={currentModuleHypothesis}
                onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                zenMode={zenMode}
                snapshotCount={capturedSnapshots.length}
                onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                  handleCapture3DSnapshot('Astronomi', dataUrl, modTitle, pSum, pMetric)
                }
                completedChallengeIds={completedChallengeIds}
                onCompleteChallenge={handleCompleteChallenge}
              />
            )}
          </>
        )}

        {/* MODE SISWA — TAHAP 3: Analisis Grafik Regresi & Lembar Kerja Siswa (LKS) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 3 && (
          <div className="max-w-[1380px] mx-auto pb-10">
            <AnalyticsAndWorksheetPanel
              records={records}
              activeStudentName={currentProfile.name}
              activeGroupId={currentProfile.group}
              onSubmitQuizScore={handleSubmitQuizScore}
              onBackToLab={() => setWorkflowStep(2)}
              onProceedToReport={() => setWorkflowStep(4)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={handleUpdateCurrentHypothesis}
              snapshots3D={capturedSnapshots}
              onAskDrLabMu={(promptText) => {
                setDrawerTab('dr-labmu');
                setDrawerOpen(true);
                setExternalDrLabMuPrompt({
                  id: Date.now(),
                  prompt: promptText,
                });
              }}
              onExportChartNotification={(fmt) =>
                handlePushNotification({
                  id: `notif-chart-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Kolaborasi',
                  title: `Ekspor Grafik & Laporan (${fmt}) Selesai`,
                  message: `Grafik regresi multi-sumbu dan hasil analisis telah diekspor ke ${fmt}.`,
                })
              }
            />
          </div>
        )}

        {/* MODE SISWA — TAHAP 4: Laporan Praktikum & Kolaborasi Kelompok */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 4 && (
          <div className="max-w-[1380px] mx-auto pb-10">
            <CollaborationAndDataSection
              records={records}
              tasks={tasks}
              notes={notes}
              activeGroupId={currentProfile.group}
              activeStudentName={currentProfile.name}
              onDeleteRecord={handleDeleteRecord}
              onToggleTask={handleToggleTask}
              onCreateTask={handleCreateTask}
              onCreateNote={handleCreateNote}
              onBackToAnalysis={() => setWorkflowStep(3)}
              onBackToCatalog={() => setIsLobbyMode(true)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={handleUpdateCurrentHypothesis}
              snapshots3D={capturedSnapshots}
              onDeleteSnapshot={(id) =>
                setCapturedSnapshots((prev) => prev.filter((s) => s.id !== id))
              }
              onReplayRecord={handleReplayRecord}
              students={students}
              onCSVExported={(count) =>
                handlePushNotification({
                  id: `notif-csv-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Kolaborasi',
                  title: 'Berkas CSV Kelompok Diunduh',
                  message: `${count} baris data eksperimen siap diolah di spreadsheet.`,
                })
              }
            />
          </div>
        )}
        </Suspense>

        {/* Slide-Over Right Drawer: Dr. LabMu Mentor & Session Notifications */}
        <DrLabMuAssistantPanel
          domain={activeScienceDomain}
          academicLevel={academicLevel}
          physicsParams={physicsParams}
          chemistryParams={chemistryParams}
          astronomyParams={astronomyParams}
          biologyContext={biologyContext}
          records={records}
          notifications={notifications}
          isOpen={drawerOpen}
          activeTab={drawerTab}
          onOpenChange={setDrawerOpen}
          onTabChange={setDrawerTab}
          onInjectOutlierDemo={() => handleInjectOutlierDemo(activeScienceDomain)}
          externalPromptRequest={externalDrLabMuPrompt}
        />
      </main>
    </div>
  );
}
