import crypto from 'crypto';
import { loadPersistedState, scheduleSaveState } from '../../src/utils/statePersistence';
import {
  LabRoom,
  ParameterLockPayload,
} from '../../src/utils/collabProtocol';

export const SERVER_STATE_LIMITS = {
  MAX_ACTIVE_ROOMS: 200,
  ROOM_IDLE_TTL_MS: 12 * 60 * 60 * 1000,
  MAX_SESSION_SNAPSHOTS: 500,
  SNAPSHOT_TTL_MS: 24 * 60 * 60 * 1000,
  MAX_PARAMETER_LOCKS: 500,
  MAX_EXPERIMENT_RECORDS: 500,
  MAX_GROUP_TASKS: 300,
  MAX_COLLAB_NOTES: 300,
  MAX_STUDENT_ROSTER: 300,
  MAX_NOTIFICATIONS: 100,
} as const;

export function generateSecureRoomPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export interface GroupTask {
  id: string;
  groupId: string;
  title: string;
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  completed: boolean;
  completedBy?: string;
}

export interface CollabNote {
  id: string;
  groupId: string;
  author: string;
  role: 'Siswa' | 'Pengajar';
  text: string;
  timestamp: string;
}

export interface StudentProgress {
  id: string;
  name: string;
  groupId: string;
  activeDomain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  currentActivity: string;
  trialsRecorded: number;
  tasksCompleted: number;
  totalTasks: number;
  completionPct: number;
  lastActive: string;
  status: 'Nominal' | 'Butuh Bantuan' | 'Selesai';
}

export interface ServerExperimentRecord {
  id: string;
  timestamp: string;
  studentName: string;
  groupId: string;
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  experimentTitle: string;
  parametersSummary: string;
  keyMetrics: Record<string, number | string>;
  numericX?: number;
  numericY1?: number;
  numericY2?: number;
  notes: string;
}

export interface ServerNotification {
  id: string;
  timestamp: string;
  severity: 'nominal' | 'elevated' | 'critical';
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' | 'Kolaborasi' | 'Pengajar';
  title: string;
  message: string;
  formulaHint?: string;
}

export interface LabServerState {
  experimentRecords: ServerExperimentRecord[];
  groupTasks: GroupTask[];
  collabNotes: CollabNote[];
  studentRoster: StudentProgress[];
  notifications: ServerNotification[];
  parameterLocks: Map<string, ParameterLockPayload>;
  activeLabRooms: Map<string, LabRoom>;
  sessionSnapshots: Map<string, { version: number; session: unknown; updatedAt: number }>;
  touchLabRoom: (roomId: string, now?: number) => void;
  pruneExpiredLocks: (now?: number) => void;
  pruneIdleRooms: (now?: number) => void;
  pruneSessionSnapshots: (now?: number) => void;
  enforceCollectionBounds: () => void;
  persistServerState: () => void;
  hydrateServerState: () => Promise<void>;
  dispose: () => void;
}

export function createLabServerState(options?: {
  maxActiveRooms?: number;
  roomIdleTtlMs?: number;
  maxSessionSnapshots?: number;
  snapshotTtlMs?: number;
  maxRecords?: number;
  maxTasks?: number;
  maxNotes?: number;
  maxStudents?: number;
  maxNotifications?: number;
  maxParameterLocks?: number;
}): LabServerState {
  const limits = {
    MAX_ACTIVE_ROOMS: options?.maxActiveRooms ?? SERVER_STATE_LIMITS.MAX_ACTIVE_ROOMS,
    ROOM_IDLE_TTL_MS: options?.roomIdleTtlMs ?? SERVER_STATE_LIMITS.ROOM_IDLE_TTL_MS,
    MAX_SESSION_SNAPSHOTS:
      options?.maxSessionSnapshots ?? SERVER_STATE_LIMITS.MAX_SESSION_SNAPSHOTS,
    SNAPSHOT_TTL_MS: options?.snapshotTtlMs ?? SERVER_STATE_LIMITS.SNAPSHOT_TTL_MS,
    MAX_PARAMETER_LOCKS:
      options?.maxParameterLocks ?? SERVER_STATE_LIMITS.MAX_PARAMETER_LOCKS,
    MAX_EXPERIMENT_RECORDS:
      options?.maxRecords ?? SERVER_STATE_LIMITS.MAX_EXPERIMENT_RECORDS,
    MAX_GROUP_TASKS: options?.maxTasks ?? SERVER_STATE_LIMITS.MAX_GROUP_TASKS,
    MAX_COLLAB_NOTES: options?.maxNotes ?? SERVER_STATE_LIMITS.MAX_COLLAB_NOTES,
    MAX_STUDENT_ROSTER: options?.maxStudents ?? SERVER_STATE_LIMITS.MAX_STUDENT_ROSTER,
    MAX_NOTIFICATIONS:
      options?.maxNotifications ?? SERVER_STATE_LIMITS.MAX_NOTIFICATIONS,
  };

  const experimentRecords: ServerExperimentRecord[] = [
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
      },
      numericX: 20,
      numericY1: 107.53,
      numericY2: 26.88,
      notes: 'Pada gravitasi Mars (3.72 m/s²), jangkauan horizontal hampir 2.6x lebih jauh dibanding Bumi.',
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
        'Suhu Akhir': '45.54 °C',
      },
      numericX: 25,
      numericY1: -81.27,
      numericY2: 45.54,
      notes: 'Pelepasan kalor eksotermik menaikkan suhu larutan sebesar +20.54°C.',
    },
  ];

  const groupTasks: GroupTask[] = [
    {
      id: 'task-1',
      groupId: 'Kelompok 1 — Mekanika',
      title: 'Uji variasi sudut bidang miring θ = 10°, 20°, 30° dengan massa konstan 4 kg',
      domain: 'Fisika',
      completed: true,
      completedBy: 'Alya Pratama',
    },
    {
      id: 'task-2',
      groupId: 'Kelompok 1 — Mekanika',
      title: 'Catat titik puncak gerak projektil pada kecepatan awal v₀ = 15, 20, 25 m/s',
      domain: 'Fisika',
      completed: true,
      completedBy: 'Bima Wijaya',
    },
    {
      id: 'task-3',
      groupId: 'Kelompok 1 — Mekanika',
      title: 'Bandingkan gradien garis regresi OLS eksperimen dengan nilai teoretis percepatan',
      domain: 'Fisika',
      completed: false,
    },
  ];

  const collabNotes: CollabNote[] = [
    {
      id: 'note-1',
      groupId: 'Kelompok 1 — Mekanika',
      author: 'Dr. Hendra Kusuma',
      role: 'Pengajar',
      text: 'Kelompok 1: Pastikan gaya dorong F tidak melebihi batas elastisitas pegas. Lanjutkan pengumpulan data ke-4!',
      timestamp: '08:40',
    },
    {
      id: 'note-2',
      groupId: 'Kelompok 1 — Mekanika',
      author: 'Alya Pratama',
      role: 'Siswa',
      text: 'Data sudut 15 derajat sudah dicatat. Hasil percepatan 7.30 m/s2 sangat mendekati model teoritis.',
      timestamp: '08:43',
    },
  ];

  const studentRoster: StudentProgress[] = [
    {
      id: 'stu-1',
      name: 'Alya Pratama',
      groupId: 'Kelompok 1 — Mekanika',
      activeDomain: 'Fisika',
      currentActivity: 'Menganalisis Regresi OLS Bidang Miring',
      trialsRecorded: 4,
      tasksCompleted: 3,
      totalTasks: 3,
      completionPct: 100,
      lastActive: 'Baru saja',
      status: 'Selesai',
    },
    {
      id: 'stu-2',
      name: 'Bima Wijaya',
      groupId: 'Kelompok 1 — Mekanika',
      activeDomain: 'Fisika',
      currentActivity: 'Eksperimen Projektil Gravitasi Mars',
      trialsRecorded: 2,
      tasksCompleted: 1,
      totalTasks: 3,
      completionPct: 65,
      lastActive: '2 menit lalu',
      status: 'Nominal',
    },
    {
      id: 'stu-3',
      name: 'Citra Lestari',
      groupId: 'Kelompok 2 — Termokimia',
      activeDomain: 'Kimia',
      currentActivity: 'Kalorimetri Netralisasi Asam-Basa',
      trialsRecorded: 1,
      tasksCompleted: 1,
      totalTasks: 3,
      completionPct: 45,
      lastActive: '5 menit lalu',
      status: 'Nominal',
    },
    {
      id: 'stu-4',
      name: 'Dimas Nugroho',
      groupId: 'Kelompok 2 — Termokimia',
      activeDomain: 'Kimia',
      currentActivity: 'Pengamatan Kurva Titrasi Sigmoidal',
      trialsRecorded: 0,
      tasksCompleted: 0,
      totalTasks: 3,
      completionPct: 20,
      lastActive: '12 menit lalu',
      status: 'Butuh Bantuan',
    },
    {
      id: 'stu-5',
      name: 'Elena Putri',
      groupId: 'Kelompok 3 — Astrofisika',
      activeDomain: 'Astronomi',
      currentActivity: 'Simulasi Orbit Hukum III Kepler',
      trialsRecorded: 3,
      tasksCompleted: 2,
      totalTasks: 3,
      completionPct: 85,
      lastActive: '1 menit lalu',
      status: 'Nominal',
    },
  ];

  const notifications: ServerNotification[] = [
    {
      id: 'notif-1',
      timestamp: '08:42:15',
      severity: 'nominal',
      domain: 'Fisika',
      title: 'Data Berhasil Dicatat — Hukum II Newton',
      message: 'Alya Pratama mencatat data titik (45 N, 7.30 m/s²). Nilai R² saat ini = 0.998.',
    },
  ];

  const parameterLocks = new Map<string, ParameterLockPayload>();
  const activeLabRooms = new Map<string, LabRoom>();
  const sessionSnapshots = new Map<
    string,
    { version: number; session: unknown; updatedAt: number }
  >();

  const demoRoomPin =
    process.env.NODE_ENV !== 'production' && process.env.DEMO_ROOM_PIN?.trim()
      ? process.env.DEMO_ROOM_PIN.trim()
      : generateSecureRoomPin();

  const initialNow = Date.now();
  activeLabRooms.set('LAB-ALPHA', {
    roomId: 'LAB-ALPHA',
    pin: demoRoomPin,
    domain: 'physics',
    moduleId: 'newton-incline',
    teacherSocketId: undefined,
    teacherName: 'Dr. Hendra Kusuma',
    isFrozenByTeacher: false,
    createdAt: initialNow,
    lastActivityAt: initialNow,
    clients: {},
  });

  const touchLabRoom = (roomId: string, now = Date.now()) => {
    const existing = activeLabRooms.get(roomId);
    if (!existing) return;
    existing.lastActivityAt = now;
    // Re-insert so Map iteration order tracks LRU recency
    activeLabRooms.delete(roomId);
    activeLabRooms.set(roomId, existing);
  };

  const pruneExpiredLocks = (now = Date.now()) => {
    for (const [key, lock] of parameterLocks.entries()) {
      if (now > lock.expiresAt) {
        parameterLocks.delete(key);
      }
    }
    while (parameterLocks.size > limits.MAX_PARAMETER_LOCKS) {
      const oldestKey = parameterLocks.keys().next().value;
      if (!oldestKey) break;
      parameterLocks.delete(oldestKey);
    }
  };

  const pruneIdleRooms = (now = Date.now()) => {
    for (const [roomId, room] of activeLabRooms.entries()) {
      if (roomId === 'LAB-ALPHA') continue;
      const clientCount = Object.keys(room.clients || {}).length;
      const lastActive = room.lastActivityAt ?? room.createdAt;
      if (clientCount === 0 && now - lastActive > limits.ROOM_IDLE_TTL_MS) {
        activeLabRooms.delete(roomId);
      }
    }

    if (activeLabRooms.size > limits.MAX_ACTIVE_ROOMS) {
      // First evict least-recently-active empty rooms (excluding LAB-ALPHA)
      const sortedEntries = Array.from(activeLabRooms.entries()).sort((a, b) => {
        const aClients = Object.keys(a[1].clients || {}).length;
        const bClients = Object.keys(b[1].clients || {}).length;
        if ((aClients === 0) !== (bClients === 0)) {
          return aClients === 0 ? -1 : 1;
        }
        return (a[1].lastActivityAt ?? a[1].createdAt) - (b[1].lastActivityAt ?? b[1].createdAt);
      });
      for (const [roomId] of sortedEntries) {
        if (activeLabRooms.size <= limits.MAX_ACTIVE_ROOMS) break;
        if (roomId === 'LAB-ALPHA' && activeLabRooms.size <= limits.MAX_ACTIVE_ROOMS + 1) continue;
        activeLabRooms.delete(roomId);
      }
    }
  };

  const pruneSessionSnapshots = (now = Date.now()) => {
    const cutoff = now - limits.SNAPSHOT_TTL_MS;
    for (const [key, entry] of sessionSnapshots.entries()) {
      if (entry.updatedAt < cutoff) {
        sessionSnapshots.delete(key);
      }
    }
    if (sessionSnapshots.size > limits.MAX_SESSION_SNAPSHOTS) {
      const sorted = Array.from(sessionSnapshots.entries()).sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt
      );
      for (const [key] of sorted) {
        if (sessionSnapshots.size <= limits.MAX_SESSION_SNAPSHOTS) break;
        sessionSnapshots.delete(key);
      }
    }
  };

  const enforceCollectionBounds = () => {
    if (experimentRecords.length > limits.MAX_EXPERIMENT_RECORDS) {
      experimentRecords.length = limits.MAX_EXPERIMENT_RECORDS;
    }
    if (groupTasks.length > limits.MAX_GROUP_TASKS) {
      groupTasks.splice(0, groupTasks.length - limits.MAX_GROUP_TASKS);
    }
    if (collabNotes.length > limits.MAX_COLLAB_NOTES) {
      collabNotes.splice(0, collabNotes.length - limits.MAX_COLLAB_NOTES);
    }
    if (studentRoster.length > limits.MAX_STUDENT_ROSTER) {
      studentRoster.splice(0, studentRoster.length - limits.MAX_STUDENT_ROSTER);
    }
    if (notifications.length > limits.MAX_NOTIFICATIONS) {
      notifications.length = limits.MAX_NOTIFICATIONS;
    }
    pruneExpiredLocks();
    pruneIdleRooms();
    pruneSessionSnapshots();
  };

  const persistServerState = () => {
    enforceCollectionBounds();
    scheduleSaveState({
      records: experimentRecords,
      tasks: groupTasks,
      notes: collabNotes,
      students: studentRoster,
      notifications,
    });
  };

  const hydrateServerState = async () => {
    const loadedState = await loadPersistedState({
      records: experimentRecords,
      tasks: groupTasks,
      notes: collabNotes,
      students: studentRoster,
      notifications,
    });
    if (!loadedState) return;

    if (Array.isArray(loadedState.records) && loadedState.records.length > 0) {
      experimentRecords.splice(
        0,
        experimentRecords.length,
        ...(loadedState.records as ServerExperimentRecord[])
      );
    }
    if (Array.isArray(loadedState.tasks) && loadedState.tasks.length > 0) {
      groupTasks.splice(
        0,
        groupTasks.length,
        ...(loadedState.tasks as GroupTask[])
      );
    }
    if (Array.isArray(loadedState.notes) && loadedState.notes.length > 0) {
      collabNotes.splice(
        0,
        collabNotes.length,
        ...(loadedState.notes as CollabNote[])
      );
    }
    if (Array.isArray(loadedState.students) && loadedState.students.length > 0) {
      studentRoster.splice(
        0,
        studentRoster.length,
        ...(loadedState.students as StudentProgress[])
      );
    }
    if (
      Array.isArray(loadedState.notifications) &&
      loadedState.notifications.length > 0
    ) {
      notifications.splice(
        0,
        notifications.length,
        ...(loadedState.notifications as ServerNotification[])
      );
    }
    enforceCollectionBounds();
  };

  const maintenanceTimer = setInterval(() => {
    const now = Date.now();
    pruneExpiredLocks(now);
    pruneIdleRooms(now);
    pruneSessionSnapshots(now);
  }, 5 * 60 * 1000);
  maintenanceTimer.unref?.();

  const dispose = () => {
    clearInterval(maintenanceTimer);
  };

  return {
    experimentRecords,
    groupTasks,
    collabNotes,
    studentRoster,
    notifications,
    parameterLocks,
    activeLabRooms,
    sessionSnapshots,
    touchLabRoom,
    pruneExpiredLocks,
    pruneIdleRooms,
    pruneSessionSnapshots,
    enforceCollectionBounds,
    persistServerState,
    hydrateServerState,
    dispose,
  };
}
