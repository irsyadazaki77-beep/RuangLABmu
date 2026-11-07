import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Download,
  Users,
  X,
  Atom,
  FlaskConical,
  Orbit,
  GraduationCap,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Leaf,
  BarChart3,
  BookOpen,
  FileCheck2,
  CheckCircle2,
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
import { PhysicsLabView } from './components/PhysicsLabView';
import { ChemistryLabView } from './components/ChemistryLabView';
import { AstronomyLabView } from './components/AstronomyLabView';
import { BiologyLabView } from './components/BiologyLabView';
import {
  CollaborationAndDataSection,
  GroupTaskItem,
  CollabNoteItem,
} from './components/CollaborationAndDataSection';
import { AnalyticsAndWorksheetPanel } from './components/AnalyticsAndWorksheetPanel';
import {
  TeacherDashboardView,
  StudentProgressItem,
} from './components/TeacherDashboardView';
import { DrLabMuAssistantPanel } from './components/DrLabMuAssistantPanel';
import { ExperimentCatalogPicker } from './components/ExperimentCatalogPicker';
import { PreLabSafetyModal } from './components/PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain as RegistryDomain,
  getExperimentsByDomain,
} from './registry/experimentRegistry';
import { useSpatialCollab } from './hooks/useSpatialCollab';

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
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [activeDomain, setActiveDomain] = useState<LabDomainId>('fisika');
  const [selectedProfileIdx, setSelectedProfileIdx] = useState<number>(0);
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>('sma');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState<boolean>(false);

  // Step Completion Tracking
  const [completedSafetyIds, setCompletedSafetyIds] = useState<string[]>([
    'newton-incline',
  ]);
  const [lksGraded, setLksGraded] = useState<boolean>(false);
  const [catalogModalExp, setCatalogModalExp] =
    useState<ExperimentModule | null>(null);
  const [selectedBioModuleId, setSelectedBioModuleId] = useState<string>(
    'photosynthesis-ingenhousz'
  );

  // Adaptive Theme & Lab Audio Engine State
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('simulab-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage error
    }
    return 'dark';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('simulab-theme', themeMode);
    } catch {
      // ignore storage error
    }
  }, [themeMode]);

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
      trialsRecorded: 4,
      tasksCompleted: 3,
      totalTasks: 3,
      completionPct: 92,
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
      trialsRecorded: 3,
      tasksCompleted: 2,
      totalTasks: 3,
      completionPct: 86,
      quizScore: 100,
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
      return 'gravity-orbital';
    }
    if (activeDomain === 'kimia') {
      if (chemistryParams.mode === 'thermo-calorimetry') return 'thermo-calorimetry';
      if (chemistryParams.mode === 'acid-base-titration') return 'acid-base-titration';
      return 'redox-electrochemistry';
    }
    if (activeDomain === 'biologi') {
      return selectedBioModuleId;
    }
    if (astronomyParams.mode === 'solar-kepler') return 'solar-kepler';
    if (astronomyParams.mode === 'milkyway-galaxy') return 'milky-way-rotation';
    return 'exoplanet-transit';
  })();

  const handleSelectCatalogExperiment = (exp: ExperimentModule) => {
    const dom = exp.domain as LabDomainId;
    setActiveDomain(dom);

    if (dom === 'fisika') {
      const modeMap: Record<string, PhysicsParams['mode']> = {
        'newton-incline': 'newton-incline',
        'projectile-motion': 'projectile-gravity',
        'collision-momentum': 'collision-momentum',
        'spring-hooke': 'spring-hooke',
        'gravity-orbital': 'orbital-gravity',
      };
      setPhysicsParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || 'newton-incline',
      }));
    } else if (dom === 'kimia') {
      const modeMap: Record<string, ChemistryParams['mode']> = {
        'thermo-calorimetry': 'thermo-calorimetry',
        'acid-base-titration': 'acid-base-titration',
        'redox-electrochemistry': 'electrochemistry-cell',
      };
      setChemistryParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || 'thermo-calorimetry',
      }));
    } else if (dom === 'biologi') {
      setSelectedBioModuleId(exp.id);
    } else if (dom === 'astronomi') {
      const modeMap: Record<string, AstronomyParams['mode']> = {
        'solar-kepler': 'solar-kepler',
        'milky-way-rotation': 'milkyway-galaxy',
        'exoplanet-transit': 'stellar-exoplanet',
      };
      setAstronomyParams((prev) => ({
        ...prev,
        mode: modeMap[exp.id] || 'solar-kepler',
      }));
    }

    setCompletedSafetyIds((prev) =>
      prev.includes(exp.id) ? prev : [...prev, exp.id]
    );
    setWorkflowStep(2);
  };

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

  const is3DStageActive = userRole === 'siswa' && workflowStep === 2;

  const WORKFLOW_STEPS = [
    {
      step: 1 as const,
      label: '1. Katalog & K3',
      icon: BookOpen,
      done: completedSafetyIds.length > 0,
    },
    {
      step: 2 as const,
      label: '2. Simulasi 3D',
      icon: Atom,
      done: records.length > 0,
    },
    {
      step: 3 as const,
      label: `3. Grafik & LKS (${records.length})`,
      icon: BarChart3,
      done: lksGraded,
    },
    {
      step: 4 as const,
      label: '4. Laporan & Diskusi',
      icon: FileCheck2,
      done: lksGraded && records.length >= 2,
    },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
      {/* Structured Top Header Bar: Zone 1 (Brand & Domain) — Zone 2 (4-Step Workflow / Teacher Mode) — Zone 3 (Role Switcher & Utilities) */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-4 bg-slate-950 border-b border-slate-800 text-white z-50">
        {/* Zone 1: Brand Identity + Quick Science Domain Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setUserRole('siswa');
              setWorkflowStep(1);
            }}
            className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center">
              <Atom className="w-4 h-4 text-white" />
            </span>
            <span>RuangLABmu</span>
          </button>

          {userRole === 'siswa' && (
            <div
              className="hidden xl:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs"
              role="group"
              aria-label="Bidang Sains Aktif"
            >
              {(
                [
                  { id: 'fisika', label: 'Fisika', icon: Atom },
                  { id: 'kimia', label: 'Kimia', icon: FlaskConical },
                  { id: 'biologi', label: 'Biologi', icon: Leaf },
                  { id: 'astronomi', label: 'Astronomi', icon: Orbit },
                ] as const
              ).map((dom) => {
                const Icon = dom.icon;
                const isSelected = activeDomain === dom.id;
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setActiveDomain(dom.id);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-sky-400 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{dom.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Zone 2: Guided 4-Step Student Stepper OR Teacher Mode Banner */}
        {userRole === 'siswa' ? (
          <nav
            aria-label="Tahapan Praktikum Siswa"
            className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium overflow-x-auto no-scrollbar"
          >
            {WORKFLOW_STEPS.map((item, idx) => {
              const isCurrent = workflowStep === item.step;
              const Icon = item.icon;
              return (
                <React.Fragment key={item.step}>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setWorkflowStep(item.step);
                    }}
                    className={`relative px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {item.done && !isCurrent ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </button>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="text-slate-600 text-xs px-0.5 select-none hidden sm:inline"
                    >
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200">
            <GraduationCap className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold whitespace-nowrap">
              Ruang Evaluasi & Rubrik Pengajar ({students.length} Siswa Aktif)
            </span>
          </div>
        )}

        {/* Zone 3: Explicit Role Switcher (Mode Siswa | Mode Pengajar), Tier, Profile & Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Role Switcher: Mode Siswa vs Mode Pengajar */}
          <div
            className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5"
            role="group"
            aria-label="Mode Peran Pengguna"
          >
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setUserRole('siswa');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                userRole === 'pengajar'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Pengajar</span>
            </button>
          </div>

          {/* SMP / SMA / PT Selector */}
          {userRole === 'siswa' && (
            <div
              className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5"
              role="group"
              aria-label="Tingkat Kurikulum"
            >
              {(
                [
                  { id: 'smp', label: 'SMP' },
                  { id: 'sma', label: 'SMA' },
                  { id: 'mahasiswa', label: 'PT' },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setAcademicLevel(lvl.id);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    academicLevel === lvl.id
                      ? 'bg-slate-800 text-sky-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          )}

          {/* Active Student Profile Selector */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
            <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <select
              aria-label="Pilih Profil Siswa Aktif"
              value={selectedProfileIdx}
              onChange={(e) => {
                labSound.playClick();
                setSelectedProfileIdx(Number(e.target.value));
              }}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              {STUDENT_PROFILES.map((p, idx) => (
                <option
                  key={p.name}
                  value={idx}
                  className="bg-slate-900 text-white"
                >
                  {p.name} ({p.group.split('—')[0].trim()})
                </option>
              ))}
            </select>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) labSound.playClick();
            }}
            title={
              soundEnabled
                ? 'Matikan Efek Suara Lab'
                : 'Aktifkan Efek Suara Lab'
            }
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-slate-900 border-slate-800 text-sky-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
            }}
            title="Ubah Tema Terang / Gelap"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4 text-slate-300" />
            )}
          </button>

          {/* CSV Quick Export */}
          <button
            type="button"
            onClick={handleExportAllCSV}
            title="Unduh CSV Data Eksperimen"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setShowNotifDrawer((prev) => !prev);
              }}
              className="relative p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={`Notifikasi & Umpan Balik (${
                wsConnected ? 'Sinkronisasi Aktif' : 'Mode Lokal'
              })`}
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-slate-950 text-[9px] font-black flex items-center justify-center tabular-nums">
                  {notifications.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifDrawer && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 text-white"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-200">
                      Umpan Balik & Log Sesi ({notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotifDrawer(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                          <span className="font-bold text-sky-400">
                            {n.domain}
                          </span>
                          <span className="font-mono">{n.timestamp}</span>
                        </div>
                        <p className="font-semibold text-white">{n.title}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main
        className={`relative w-full h-[calc(100vh-3.5rem)] ${
          is3DStageActive
            ? 'overflow-hidden bg-slate-950'
            : 'overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 select-text'
        }`}
      >
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
            />
          </div>
        )}

        {/* MODE SISWA — TAHAP 1: Katalog Modul & Persiapan K3 */}
        {userRole === 'siswa' && workflowStep === 1 && (
          <div className="max-w-[1380px] mx-auto pb-12">
            <ExperimentCatalogPicker
              domain={activeDomain as RegistryDomain}
              currentExperimentId={currentExperimentId}
              activeTier={activeTierLabel}
              completedSafetyIds={completedSafetyIds}
              onDomainChange={(dom) => setActiveDomain(dom as LabDomainId)}
              onSelectExperiment={handleSelectCatalogExperiment}
              onOpenPreLabModal={(exp) => setCatalogModalExp(exp)}
              onTierChange={(tier) => {
                setAcademicLevel(tier.toLowerCase() as AcademicLevel);
              }}
            />

            {catalogModalExp && (
              <PreLabSafetyModal
                experiment={catalogModalExp}
                activeTier={activeTierLabel}
                isOpen={!!catalogModalExp}
                onClose={() => setCatalogModalExp(null)}
                onProceedToLab={() => {
                  handleSelectCatalogExperiment(catalogModalExp);
                  setCatalogModalExp(null);
                }}
              />
            )}
          </div>
        )}

        {/* MODE SISWA — TAHAP 2: Kokpit Simulasi 3D & Pengambilan Data */}
        {userRole === 'siswa' && workflowStep === 2 && (
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
                onBackToCatalog={() => setWorkflowStep(1)}
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
                onBackToCatalog={() => setWorkflowStep(1)}
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
                onBackToCatalog={() => setWorkflowStep(1)}
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
                onBackToCatalog={() => setWorkflowStep(1)}
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
              />
            )}
          </>
        )}

        {/* MODE SISWA — TAHAP 3: Analisis Grafik Regresi & Lembar Kerja Siswa (LKS) */}
        {userRole === 'siswa' && workflowStep === 3 && (
          <div className="max-w-[1380px] mx-auto pb-12">
            <AnalyticsAndWorksheetPanel
              records={records}
              activeStudentName={currentProfile.name}
              activeGroupId={currentProfile.group}
              onSubmitQuizScore={handleSubmitQuizScore}
              onBackToLab={() => setWorkflowStep(2)}
              onProceedToReport={() => setWorkflowStep(4)}
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
        {userRole === 'siswa' && workflowStep === 4 && (
          <div className="max-w-[1380px] mx-auto pb-12">
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
              onBackToCatalog={() => setWorkflowStep(1)}
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

        {/* Streamlined Floating AI Mentor Pill & Chat Popover */}
        <DrLabMuAssistantPanel
          domain={activeScienceDomain}
          academicLevel={academicLevel}
          physicsParams={physicsParams}
          chemistryParams={chemistryParams}
          astronomyParams={astronomyParams}
          biologyContext={biologyContext}
          records={records}
          onInjectOutlierDemo={() => handleInjectOutlierDemo(activeScienceDomain)}
        />
      </main>
    </div>
  );
}
