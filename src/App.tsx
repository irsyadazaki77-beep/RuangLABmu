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
  BookOpen,
  Maximize2,
  Minimize2,
  Compass,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Leaf,
} from 'lucide-react';
import {
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  ScienceDomain,
  AcademicLevel,
  ExperimentRecord,
  LabNotification,
  exportRecordsToCSV,
  generateAutomaticFeedback,
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
import { useSpatialCollab } from './hooks/useSpatialCollab';
import { EducationTier } from './registry/experimentRegistry';

type ActiveTab = 'fisika' | 'kimia' | 'biologi' | 'astronomi' | 'kolaborasi' | 'pengajar';

const STUDENT_PROFILES = [
  { name: 'Alya Pratama', group: 'Kelompok 1 — Mekanika' },
  { name: 'Bima Wijaya', group: 'Kelompok 1 — Mekanika' },
  { name: 'Citra Lestari', group: 'Kelompok 2 — Termokimia' },
  { name: 'Dimas Nugroho', group: 'Kelompok 2 — Termokimia' },
  { name: 'Elena Putri', group: 'Kelompok 3 — Astrofisika' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('fisika');
  const [selectedProfileIdx, setSelectedProfileIdx] = useState<number>(0);
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>('sma');
  const [focusSimulationMode, setFocusSimulationMode] =
    useState<boolean>(false);
  const [showFormulaGuide, setShowFormulaGuide] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState<boolean>(false);

  // Adaptive Theme (Light / Dark Glassmorphism) & Lab Audio Engine State
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('simulab-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage error
    }
    return 'light';
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
      title: 'Modul Astronomi: Galaksi Bima Sakti, Tata Surya & Diagram H-R Aktif',
      message:
        'Eksplorasi 8 planet Tata Surya, kurva rotasi Materi Gelap Bima Sakti (Sgr A*), serta kurva transit eksoplanet kini terintegrasi dengan Regresi & LKS.',
      formulaHint: 'T²/a³ = 1/M*  |  v_rot = √(GM(<R)/R)',
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

  // Phase 3: Real-Time 3D Laser Pointer Cursors & Collaborative Parameter Mutex Hook
  const currentUserId = currentProfile.name.toLowerCase().replace(/\s+/g, '-');
  const activeCollabDomain: 'fisika' | 'kimia' | 'biologi' | 'astronomi' =
    activeTab === 'kimia' || activeTab === 'biologi' || activeTab === 'astronomi'
      ? activeTab
      : 'fisika';

  const {
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
    syncParamValue,
  } = useSpatialCollab({
    ws: activeSocket,
    userId: currentUserId,
    userName: currentProfile.name,
    role: activeTab === 'pengajar' ? 'Pengajar' : 'Siswa',
    groupId: currentProfile.group,
    domain: activeCollabDomain,
    onRemoteParamSync: (paramKey, value) => {
      if (activeCollabDomain === 'fisika') {
        setPhysicsParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeCollabDomain === 'kimia') {
        setChemistryParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeCollabDomain === 'astronomi') {
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
      message: `${records.length} baris data eksperimen Fisika, Kimia & Astronomi telah diekspor dalam format CSV.`,
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

  const activeScienceDomain: ScienceDomain =
    activeTab === 'kimia'
      ? 'Kimia'
      : activeTab === 'biologi'
      ? 'Biologi'
      : activeTab === 'astronomi'
      ? 'Astronomi'
      : 'Fisika';

  const latestNotification = notifications[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#07090E] lab-grid-bg text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white/95 dark:bg-slate-950/90 lab-glass-panel border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            labSound.playClick();
            setActiveTab('fisika');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          RuangLABmu · SimuLab Sains
        </a>

        <nav
          aria-label="Navigasi Utama Laboratorium"
          className="flex items-center gap-2 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400 overflow-x-auto"
        >
          {[
            { id: 'fisika' as const, label: 'Lab Fisika' },
            { id: 'kimia' as const, label: 'Lab Kimia' },
            { id: 'biologi' as const, label: 'Lab Biologi', isBio: true },
            { id: 'astronomi' as const, label: 'Lab Astronomi' },
            { id: 'kolaborasi' as const, label: `Grafik & LKS (${records.length})` },
            { id: 'pengajar' as const, label: 'Dashboard Pengajar' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setActiveTab(item.id);
                }}
                className={`relative px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'text-slate-950 dark:text-white font-bold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-domain-tab"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-sky-600/90 shadow-xs border border-slate-200/80 dark:border-sky-400/40"
                  />
                )}
                {item.isBio && (
                  <Leaf
                    className={`w-3.5 h-3.5 relative z-10 ${
                      isActive ? 'text-emerald-500 dark:text-emerald-300' : 'text-emerald-500'
                    }`}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportAllCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV ({records.length})
          </button>
        </div>
      </header>

      {/* Secondary Workspace Calibration, Adaptive Theme/Sound & Real-Time Automatic Notification Ribbon */}
      <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-6 py-2.5">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono text-slate-400">
              {wsConnected ? '● SINKRONISASI REAL-TIME AKTIF' : '▲ MODE LOKAL'}
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <label
                htmlFor="student-profile-select"
                className="text-slate-300"
              >
                Identitas Sesi:
              </label>
              <select
                id="student-profile-select"
                value={selectedProfileIdx}
                onChange={(e) => {
                  labSound.playClick();
                  setSelectedProfileIdx(Number(e.target.value));
                }}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2.5 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-sky-400"
              >
                {STUDENT_PROFILES.map((p, idx) => (
                  <option key={p.name} value={idx}>
                    {p.name} ({p.group})
                  </option>
                ))}
              </select>
            </div>
            {Object.keys(remoteCursors).length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-700">
                  ·
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-950/80 border border-sky-500/50 text-sky-300 font-mono text-[11px] animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-400"></span>
                  {Object.keys(remoteCursors).length} Laser 3D ({Object.values(remoteCursors).map((c) => c.userName).join(', ')})
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            {/* Academic Level Switch: SMP vs SMA/SMK vs Perguruan Tinggi */}
            <div
              role="group"
              aria-label="Mode Tingkat Akademik"
              className="flex items-center gap-1 bg-slate-800 border border-slate-700 p-0.5 rounded-md"
            >
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setAcademicLevel('smp');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  academicLevel === 'smp'
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                SMP
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setAcademicLevel('sma');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  academicLevel === 'sma'
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                SMA/SMK
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setAcademicLevel('mahasiswa');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  academicLevel === 'mahasiswa'
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Perguruan Tinggi
              </button>
            </div>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            {/* Adaptive Theme Toggle (Light vs Dark Glassmorphism) & Web Audio Synthesizer Toggle */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
                }}
                aria-label="Ganti Tema Tampilan Laboratorium"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {themeMode === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Tema Terang
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-sky-400" />
                    Tema Gelap
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  labSound.setEnabled(next);
                  if (next) labSound.playClick();
                }}
                aria-label="Aktifkan atau Bisukan Efek Suara Laboratorium"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  soundEnabled
                    ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    Audio Lab
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    Bisu
                  </>
                )}
              </button>
            </div>
          </div>

          {latestNotification && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2.5 text-xs bg-slate-800/90 border border-slate-700 rounded-md px-3 py-1 max-w-md xl:max-w-lg"
            >
              <span
                className={`font-mono font-semibold whitespace-nowrap ${
                  latestNotification.severity === 'critical'
                    ? 'text-rose-400'
                    : latestNotification.severity === 'elevated'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {latestNotification.severity === 'critical'
                  ? '✖ PERINGATAN'
                  : latestNotification.severity === 'elevated'
                  ? '▲ PERHATIAN'
                  : '● UMPAN BALIK'}
              </span>
              <span className="text-slate-200 truncate">
                <strong>{latestNotification.title}:</strong>{' '}
                {latestNotification.message}
              </span>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setShowNotifDrawer((v) => !v);
                }}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap shrink-0 ml-1"
              >
                <Bell className="w-3.5 h-3.5" />
                Riwayat ({notifications.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Automatic Feedback Notification Log Drawer */}
      {showNotifDrawer && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 shadow-xs">
          <div className="max-w-[1380px] mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Log Notifikasi & Umpan Balik Otomatis Eksperimen
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evaluasi cerdas instan berdasarkan hukum gerak Newton, tumbukan, pegas Hooke, termodinamika, titrasi, sel Galvani, serta astrofisika
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                aria-label="Tutup panel notifikasi"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span
                      className={`font-semibold ${
                        n.severity === 'critical'
                          ? 'text-rose-700 dark:text-rose-400'
                          : n.severity === 'elevated'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {n.severity === 'critical'
                        ? '✖ KRITIS'
                        : n.severity === 'elevated'
                        ? '▲ PERHATIAN'
                        : '● NOMINAL'}{' '}
                      · {n.domain}
                    </span>
                    <span className="text-slate-400">{n.timestamp}</span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {n.title}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {n.message}
                  </p>
                  {n.formulaHint && (
                    <div className="font-mono text-sky-700 dark:text-sky-400 pt-0.5">
                      Rumus: {n.formulaHint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeTab === 'fisika' &&
                'Laboratorium Fisika: Hukum Newton, Kinematika, Tumbukan & Pegas Hooke'}
              {activeTab === 'kimia' &&
                'Laboratorium Kimia: Termodinamika, Titrasi Asam-Basa & Sel Elektrokimia'}
              {activeTab === 'biologi' &&
                'Laboratorium Biologi: Fotosintesis Ingenhousz, Kinetika Katalase & Osmosis Sel'}
              {activeTab === 'astronomi' &&
                'Laboratorium Astronomi: Tata Surya Kepler, Galaksi Bima Sakti & Eksoplanet'}
              {activeTab === 'kolaborasi' &&
                'Analitik Regresi Multi-Sumbu, LKS Otomatis & Kolaborasi Kelompok'}
              {activeTab === 'pengajar' &&
                'Dashboard Pemantauan Progres Siswa & Matriks Rubrik Penilaian'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {activeTab === 'fisika' &&
                'Simulasikan dinamika bidang miring, gerak parabola lintas planet, gravitasi universal, tumbukan momentum 1D, dan osilasi harmonik pegas.'}
              {activeTab === 'kimia' &&
                'Visualisasikan kalorimetri entalpi & Gibbs, kurva pH titrasi asam-basa, serta potensial sel Galvani (Persamaan Nernst).'}
              {activeTab === 'biologi' &&
                'Uji laju fotosintesis Hydrilla dengan variasi spektrum cahaya & NaHCO₃, kinetika Michaelis-Menten katalase, serta plasmolisis sel.'}
              {activeTab === 'astronomi' &&
                'Eksplorasi orbit elips 8 planet Tata Surya, kurva rotasi Materi Gelap Galaksi Bima Sakti (Sgr A*), serta Diagram H-R dan transit eksoplanet.'}
              {activeTab === 'kolaborasi' &&
                'Plot grafik multi-sumbu dengan regresi linier otomatis (R²), unduh laporan PNG/PDF, kerjakan LKS terukur, dan ekspor CSV.'}
              {activeTab === 'pengajar' &&
                'Pantau aktivitas eksperimen siswa secara langsung, kelola matriks rubrik 4-kriteria otomatis, dan ekspor daftar nilai kelas ke CSV.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'fisika' ||
              activeTab === 'kimia' ||
              activeTab === 'biologi' ||
              activeTab === 'astronomi') && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setFocusSimulationMode((f) => !f);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  focusSimulationMode
                    ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {focusSimulationMode ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-sky-400 dark:text-white" />
                    Tampilkan Grafik & LKS
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Mode Fokus Simulasi
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setShowFormulaGuide((g) => !g);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                showFormulaGuide
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen
                className={`w-3.5 h-3.5 ${
                  showFormulaGuide
                    ? 'text-white'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              Buku Saku Rumus & Panduan
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                if (activeTab === 'kimia') {
                  handlePushNotification(
                    generateAutomaticFeedback('Kimia', undefined, chemistryParams)
                  );
                } else if (activeTab === 'astronomi') {
                  handlePushNotification(
                    generateAutomaticFeedback(
                      'Astronomi',
                      undefined,
                      undefined,
                      astronomyParams
                    )
                  );
                } else {
                  handlePushNotification(
                    generateAutomaticFeedback('Fisika', physicsParams)
                  );
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Analisis & Umpan Balik Instan
            </button>
          </div>
        </div>

        {/* Collapsible Pocket Formula Guide & 3-Step Lab Workflow Banner */}
        {showFormulaGuide && (
          <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Buku Saku Rumus Cepat & Alur Praktikum Nyaman (Mode{' '}
                  {academicLevel === 'sma'
                    ? 'Siswa SMA/SMK'
                    : 'Mahasiswa S1 Sains & Teknik'}
                  )
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ikuti 3 langkah praktis di bawah ini untuk menyelesaikan eksperimen, regresi data, dan LKS tanpa bingung
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                aria-label="Tutup Buku Saku"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-mono font-bold text-sky-700 dark:text-sky-400">
                  LANGKAH 01 · PILIH SKENARIO & SERET KANVAS
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Klik salah satu <strong>Misi Eksperimen Terbimbing</strong>, seret langsung objek di kanvas 2D, atau gunakan <strong>Komparasi A/B</strong> untuk membandingkan dua eksperimen.
                </p>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Fisika: ΣF = m·a | Ep = ½k·Δx² | p₁+p₂ = konstan
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  LANGKAH 02 · REKAM DATA & CEK REGRESI OLS
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Klik <strong>Rekam Data Eksperimen ke Tabel Log</strong> minimal 2–3 kali dengan variasi parameter, lalu amati garis regresi linier R² otomatis.
                </p>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Kimia: ΔG = ΔH - T·ΔS | M₁·V₁ = M₂·V₂ | E_sel = E° - (RT/nF)ln Q
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  LANGKAH 03 · KERJAKAN LKS & EKSPOR LAPORAN
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Gunakan filter bidang pada <strong>Lembar Kerja Siswa (LKS)</strong>, periksa jawaban otomatis ke Rubrik Pengajar, dan unduh grafik PNG/CSV.
                </p>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  Astronomi: T²/a³ = 1/M* | v_rot = √(GM/R) | ΔF/F = (Rp/R*)²
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick-Jump Section Bar on Lab Tabs so Students Navigate Effortlessly */}
        {(activeTab === 'fisika' ||
          activeTab === 'kimia' ||
          activeTab === 'astronomi') &&
          !focusSimulationMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Navigasi Cepat RuangLABmu:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="#section-simulasi"
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  1. Kanvas Simulasi 3D/2D & Dock Interaktif
                </a>
                <a
                  href="#section-dr-labmu"
                  className="px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold transition-colors"
                >
                  2. Asisten Sokratik Dr. LabMu
                </a>
                <a
                  href="#section-grafik-lks"
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  3. Grafik Regresi & LKS (6 Soal)
                </a>
                <a
                  href="#section-kolaborasi-log"
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  4. Tabel Log ({records.length}) & Diskusi Kelompok
                </a>
              </div>
            </div>
          )}

        {/* Dr. LabMu Socratic Virtual Lab Instructor Panel */}
        {activeTab !== 'pengajar' && !focusSimulationMode && (
          <div id="section-dr-labmu">
            <DrLabMuAssistantPanel
              domain={activeScienceDomain}
              academicLevel={academicLevel}
              physicsParams={physicsParams}
              chemistryParams={chemistryParams}
              astronomyParams={astronomyParams}
              records={records}
              onInjectOutlierDemo={() =>
                handleInjectOutlierDemo(activeScienceDomain)
              }
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.22 }}
          >
        {activeTab === 'fisika' && (
          <div className="space-y-8">
            <div id="section-simulasi">
              <PhysicsLabView
                params={physicsParams}
                onChangeParams={setPhysicsParams}
                academicLevel={academicLevel}
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
                currentUserId={currentUserId}
                remoteCursors={remoteCursors}
                paramLocks={paramLocks}
                onEmitCursor={emitCursor3D}
                onAcquireLock={acquireParamLock}
                onReleaseLock={releaseParamLock}
                onSyncParamValue={syncParamValue}
              />
            </div>

            {!focusSimulationMode && (
              <>
                <div id="section-grafik-lks">
                  <AnalyticsAndWorksheetPanel
                    records={records}
                    activeStudentName={currentProfile.name}
                    activeGroupId={currentProfile.group}
                    onSubmitQuizScore={handleSubmitQuizScore}
                    onExportChartNotification={(fmt) =>
                      handlePushNotification({
                        id: `notif-chart-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Fisika',
                        title: `Laporan Grafik Regresi (${fmt}) Berhasil Dibuat`,
                        message: `Visualisasi multi-sumbu dan persamaan regresi linier telah diekspor dalam format ${fmt}.`,
                      })
                    }
                  />
                </div>

                <div id="section-kolaborasi-log">
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
                    onCSVExported={(count) =>
                      handlePushNotification({
                        id: `notif-csv-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Fisika',
                        title: 'Data Eksperimen Berhasil Diekspor ke CSV',
                        message: `${count} rekaman eksperimen telah diunduh dalam format CSV.`,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'kimia' && (
          <div className="space-y-8">
            <div id="section-simulasi">
              <ChemistryLabView
                params={chemistryParams}
                onChangeParams={setChemistryParams}
                academicLevel={academicLevel}
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
            </div>

            {!focusSimulationMode && (
              <>
                <div id="section-grafik-lks">
                  <AnalyticsAndWorksheetPanel
                    records={records}
                    activeStudentName={currentProfile.name}
                    activeGroupId={currentProfile.group}
                    onSubmitQuizScore={handleSubmitQuizScore}
                    onExportChartNotification={(fmt) =>
                      handlePushNotification({
                        id: `notif-chart-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Kimia',
                        title: `Laporan Grafik Regresi (${fmt}) Berhasil Dibuat`,
                        message: `Visualisasi multi-sumbu dan persamaan regresi linier telah diekspor dalam format ${fmt}.`,
                      })
                    }
                  />
                </div>

                <div id="section-kolaborasi-log">
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
                    onCSVExported={(count) =>
                      handlePushNotification({
                        id: `notif-csv-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Kimia',
                        title: 'Data Kimia Berhasil Diekspor ke CSV',
                        message: `${count} rekaman eksperimen telah diunduh dalam format CSV.`,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'biologi' && (
          <div className="space-y-8">
            <div id="section-simulasi">
              <BiologyLabView
                activeStudentName={currentProfile.name}
                activeGroupId={currentProfile.group}
                activeTier={
                  academicLevel === 'smp'
                    ? 'SMP'
                    : academicLevel === 'mahasiswa'
                    ? 'Mahasiswa'
                    : 'SMA'
                }
                onRecordExperiment={(
                  domain,
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
            </div>

            {!focusSimulationMode && (
              <>
                <div id="section-grafik-lks">
                  <AnalyticsAndWorksheetPanel
                    records={records}
                    activeStudentName={currentProfile.name}
                    activeGroupId={currentProfile.group}
                    onSubmitQuizScore={handleSubmitQuizScore}
                    onExportChartNotification={(fmt) =>
                      handlePushNotification({
                        id: `notif-chart-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Biologi',
                        title: `Laporan Grafik Biologi (${fmt}) Dibuat`,
                        message: `Grafik fotosintesis dan kinetika enzim berhasil diekspor ke ${fmt}.`,
                      })
                    }
                  />
                </div>

                <div id="section-kolaborasi-log">
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
                    onCSVExported={(count) =>
                      handlePushNotification({
                        id: `notif-csv-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Biologi',
                        title: 'Data Biologi Berhasil Diekspor ke CSV',
                        message: `${count} rekaman eksperimen telah diunduh dalam format CSV.`,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'astronomi' && (
          <div className="space-y-8">
            <div id="section-simulasi">
              <AstronomyLabView
                params={astronomyParams}
                onChangeParams={setAstronomyParams}
                academicLevel={academicLevel}
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
            </div>

            {!focusSimulationMode && (
              <>
                <div id="section-grafik-lks">
                  <AnalyticsAndWorksheetPanel
                    records={records}
                    activeStudentName={currentProfile.name}
                    activeGroupId={currentProfile.group}
                    onSubmitQuizScore={handleSubmitQuizScore}
                    onExportChartNotification={(fmt) =>
                      handlePushNotification({
                        id: `notif-chart-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Astronomi',
                        title: `Laporan Grafik Regresi Astronomi (${fmt}) Selesai`,
                        message: `Grafik Hukum III Kepler dan regresi linier berhasil diekspor ke ${fmt}.`,
                      })
                    }
                  />
                </div>

                <div id="section-kolaborasi-log">
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
                    onCSVExported={(count) =>
                      handlePushNotification({
                        id: `notif-csv-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        severity: 'nominal',
                        domain: 'Astronomi',
                        title: 'Data Astronomi Berhasil Diekspor ke CSV',
                        message: `${count} rekaman eksperimen telah diunduh dalam format CSV.`,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'kolaborasi' && (
          <div className="space-y-8">
            <AnalyticsAndWorksheetPanel
              records={records}
              activeStudentName={currentProfile.name}
              activeGroupId={currentProfile.group}
              onSubmitQuizScore={handleSubmitQuizScore}
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

        {activeTab === 'pengajar' && (
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
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-white/95 dark:bg-slate-950/90 lab-glass-panel border-t border-slate-200 dark:border-slate-800 px-6 py-4 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              SimuLab Sains
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Laboratorium Praktikum Fisika, Kimia & Astronomi Interaktif
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setActiveTab('fisika');
              }}
              className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <Atom className="w-3.5 h-3.5" />
              Modul Fisika
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setActiveTab('kimia');
              }}
              className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Modul Kimia
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setActiveTab('astronomi');
              }}
              className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <Orbit className="w-3.5 h-3.5" />
              Modul Astronomi
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setActiveTab('pengajar');
              }}
              className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Panel Pengajar
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
