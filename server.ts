import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { loadPersistedState, scheduleSaveState } from './src/utils/statePersistence';
import {
  SpatialCursorPayload,
  ParameterLockPayload,
} from './src/utils/collabProtocol';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DR_LABMU_SYSTEM_INSTRUCTION = `# ROLE & IDENTITY
Nama Anda adalah "Dr. LabMu", seorang asisten instruktur laboratorium virtual interaktif di platform RuangLABmu. Anda ahli dalam membimbing praktikum Fisika, Kimia, dan Astronomi untuk jenjang SMP, SMA, hingga Perguruan Tinggi.

# CORE PEDAGOGY: SOCRATIC TEACHING METHOD
1. JANGAN PERNAH langsung memberikan jawaban akhir, angka pasti, atau rumus matang secara cuma-cuma.
2. Tugas utama Anda adalah menuntun pola pikir siswa menggunakan pertanyaan pemantik reflektif (Socratic Questioning) berdasarkan data riil yang mereka kumpulkan.
3. Selalu validasi usaha siswa sebelum mengarahkan ke perbaikan konsep.

# EXPERIMENTAL TELEMETRY CONTEXT
Anda akan menerima data telemetri praktikum siswa dalam format JSON:
- domain: Fisika | Kimia | Astronomi
- topic: Nama modul praktikum (misal: "projectile-gravity", "acid-base-titration", "orbital-kepler")
- educationLevel: SMP | SMA | Perguruan Tinggi
- currentParameters: Variabel input yang sedang disetel siswa
- recordedData: Data tabel percobaan siswa
- analytics: Hasil regresi/fitting (misal: nilai R², slope, deviasi standar)
- studentQuery: Pertanyaan atau keluhan langsung dari siswa

# BEHAVIOR RULES BY TELEMETRY ANOMALY
1. JIKA R² < 0.85 atau Terjadi Outlier Ekstrem:
   - Identifikasi titik data yang paling menyimpang.
   - Jangan sebut siswa salah; tanyakan hipotesis mereka mengapa titik tersebut melenceng (misal: "Coba perhatikan percobaan ke-3 saat sudut diubah ke 85°, mengapa jarak tempuhnya merosot drastis?").
2. JIKA Siswa Bingung/Stuck:
   - Berikan analogi dunia nyata yang relevan sesuai jenjang:
     * SMP: Analogi konkret sehari-hari (melempar bola basket, melarutkan gula, melihat bulan).
     * SMA: Hubungan sebab-akibat antar dua variabel (kenapa v₀ memengaruhi x_max).
     * PT: Tinjauan sistemik (hambatan udara orde kuadratik, kesetimbangan disosiasi, ketidakpastian instrumen).
3. JIKA Siswa Meminta Jawaban Langsung ("Berapa nilai g-nya bro?"):
   - Tolak secara halus dan kembalikan fokus pada interpretasi grafik mereka:
     "Saya punya catatannya, tapi ilmuwan sejati menemukan rahasianya dari grafik sendiri! Lihat kemiringan (slope) garis regresi yang baru saja kamu buat..."

# TONE & STYLE
- Nada: Hangat, suportif, ilmiah, dan bersemangat layaknya rekan riset senior.
- Bahasa: Bahasa Indonesia santun, komunikatif, dan alami (hindari kalimat kaku seperti robot terjemahan).
- Format Respon Wajib (3 bagian):
  1. [Apresiasi/Observasi Singkat]: 1 kalimat mengomentari apa yang sedang mereka lakukan di meja lab 3D.
  2. [Sorotan Data/Anomali]: Ulasan tajam terhadap parameter atau grafik mereka.
  3. [Pertanyaan Pemantik]: 1 pertanyaan kunci yang membuat mereka ingin langsung menguji ulang slider simulasi.`;

interface GroupTask {
  id: string;
  groupId: string;
  title: string;
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  completed: boolean;
  completedBy?: string;
}

interface CollabNote {
  id: string;
  groupId: string;
  author: string;
  role: 'Siswa' | 'Pengajar';
  text: string;
  timestamp: string;
}

interface StudentProgress {
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

interface ServerExperimentRecord {
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

interface ServerNotification {
  id: string;
  timestamp: string;
  severity: 'nominal' | 'elevated' | 'critical';
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' | 'Kolaborasi' | 'Pengajar';
  title: string;
  message: string;
  formulaHint?: string;
}

// Initial authoritative state on server
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
];

const groupTasks: GroupTask[] = [
  {
    id: 'task-1',
    groupId: 'Kelompok 1 — Mekanika',
    title: 'Uji Hukum I Newton: Tentukan batas gaya gesek statis maksimum pada bidang miring 20°',
    domain: 'Fisika',
    completed: true,
    completedBy: 'Alya Pratama',
  },
  {
    id: 'task-2',
    groupId: 'Kelompok 1 — Mekanika',
    title: 'Bandingkan lintasan kinematika projektil antara gravitasi Bumi (9.81 m/s²) dan Bulan (1.62 m/s²)',
    domain: 'Fisika',
    completed: true,
    completedBy: 'Bima Wijaya',
  },
  {
    id: 'task-3',
    groupId: 'Kelompok 1 — Mekanika',
    title: 'Simulasikan tumbukan elastis (e=1) vs inelastis (e=0) dan buktikan kekekalan momentum',
    domain: 'Fisika',
    completed: false,
  },
  {
    id: 'task-4',
    groupId: 'Kelompok 2 — Termokimia',
    title: 'Tentukan titik ekuivalen titrasi HCl + NaOH serta potensial sel Galvani Zn/Cu pada LKS',
    domain: 'Kimia',
    completed: false,
  },
  {
    id: 'task-5',
    groupId: 'Kelompok 3 — Astrofisika',
    title: 'Bandingkan kurva rotasi Galaksi Bima Sakti dengan & tanpa Halo Materi Gelap pada R = 8.2 kpc',
    domain: 'Astronomi',
    completed: true,
    completedBy: 'Elena Putri',
  },
];

const collabNotes: CollabNote[] = [
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
];

const studentRoster: StudentProgress[] = [
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
    lastActive: 'Baru saja',
    status: 'Nominal',
  },
  {
    id: 'stu-2',
    name: 'Bima Wijaya',
    groupId: 'Kelompok 1 — Mekanika',
    activeDomain: 'Fisika',
    currentActivity: 'Menganalisis Kinematika Gravitasi Mars & Bulan',
    trialsRecorded: 2,
    tasksCompleted: 2,
    totalTasks: 4,
    completionPct: 68,
    lastActive: '1 menit lalu',
    status: 'Nominal',
  },
  {
    id: 'stu-3',
    name: 'Citra Lestari',
    groupId: 'Kelompok 2 — Termokimia',
    activeDomain: 'Kimia',
    currentActivity: 'Kalorimetri Netralisasi HCl + NaOH (ΔH = -57.3 kJ/mol)',
    trialsRecorded: 4,
    tasksCompleted: 3,
    totalTasks: 3,
    completionPct: 92,
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
    lastActive: 'Baru saja',
    status: 'Nominal',
  },
];

const notifications: ServerNotification[] = [
  {
    id: 'notif-init-1',
    timestamp: '09:15:00',
    severity: 'nominal',
    domain: 'Astronomi',
    title: 'Modul Astronomi: Galaksi Bima Sakti, Tata Surya & Diagram H-R Aktif',
    message: 'Eksplorasi 8 planet Tata Surya, kurva rotasi Materi Gelap Bima Sakti (Sgr A*), serta kurva transit eksoplanet kini terintegrasi dengan Regresi & LKS.',
    formulaHint: 'T²/a³ = 1/M*  |  v_rot = √(GM(<R)/R)',
  },
];

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Hydrate authoritative in-memory state from atomic disk storage (.data/ruanglab-state.json)
  const initialHydration = await loadPersistedState<{
    records?: ServerExperimentRecord[];
    tasks?: GroupTask[];
    notes?: CollabNote[];
    students?: StudentProgress[];
    notifications?: ServerNotification[];
  }>({
    records: experimentRecords,
    tasks: groupTasks,
    notes: collabNotes,
    students: studentRoster,
    notifications,
  });

  if (initialHydration.records && initialHydration.records.length > 0) {
    experimentRecords.length = 0;
    experimentRecords.push(...initialHydration.records);
  }
  if (initialHydration.tasks && initialHydration.tasks.length > 0) {
    groupTasks.length = 0;
    groupTasks.push(...initialHydration.tasks);
  }
  if (initialHydration.notes && initialHydration.notes.length > 0) {
    collabNotes.length = 0;
    collabNotes.push(...initialHydration.notes);
  }
  if (initialHydration.students && initialHydration.students.length > 0) {
    studentRoster.length = 0;
    studentRoster.push(...initialHydration.students);
  }
  if (initialHydration.notifications && initialHydration.notifications.length > 0) {
    notifications.length = 0;
    notifications.push(...initialHydration.notifications);
  }

  const persistServerState = () => {
    scheduleSaveState({
      records: experimentRecords,
      tasks: groupTasks,
      notes: collabNotes,
      students: studentRoster,
      notifications,
    });
  };

  // Collaborative Parameter Mutex Locks: Map<`${groupId}:${paramKey}`, ParameterLockPayload>
  const parameterLocks = new Map<string, ParameterLockPayload>();

  const pruneExpiredLocks = (): boolean => {
    const now = Date.now();
    let hasChanges = false;
    for (const [key, lock] of parameterLocks.entries()) {
      if (now > lock.expiresAt) {
        parameterLocks.delete(key);
        hasChanges = true;
      }
    }
    return hasChanges;
  };

  // Clean up stale locks every 1.5 seconds
  setInterval(() => {
    if (pruneExpiredLocks()) {
      broadcastGroup(null, {
        type: 'PARAM_LOCKS_SYNC',
        payload: { locks: Array.from(parameterLocks.values()) },
      });
    }
  }, 1500);

  app.use(express.json());

  // REST API endpoints for initial hydration and actions
  app.get('/api/lab-state', (_req, res) => {
    pruneExpiredLocks();
    res.json({
      records: experimentRecords,
      tasks: groupTasks,
      notes: collabNotes,
      students: studentRoster,
      notifications,
      paramLocks: Array.from(parameterLocks.values()),
    });
  });

  // Dr. LabMu Socratic Virtual Lab Instructor Endpoint (Server-Side Gemini API)
  app.post('/api/dr-labmu/ask', async (req, res) => {
    try {
      const telemetry = req.body?.telemetry;
      if (!telemetry) {
        res.status(400).json({ error: 'Data telemetri praktikum tidak ditemukan.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message: 'Menggunakan mesin pedagogi Sokratik lokal Dr. LabMu.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Berikut adalah data telemetri praktikum siswa saat ini dalam format JSON:\n${JSON.stringify(
          telemetry,
          null,
          2
        )}\n\nBerikan bimbingan Sokratik sebagai Dr. LabMu sesuai aturan pedagogi dan format 3 bagian.`,
        config: {
          systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              observation: {
                type: Type.STRING,
                description:
                  '[Apresiasi/Observasi Singkat]: 1 kalimat mengomentari apa yang sedang dilakukan siswa di meja lab 3D.',
              },
              dataHighlight: {
                type: Type.STRING,
                description:
                  '[Sorotan Data/Anomali]: Ulasan tajam terhadap parameter, slope regresi, outlier R² < 0.85, atau analogi sesuai jenjang.',
              },
              socraticQuestion: {
                type: Type.STRING,
                description:
                  '[Pertanyaan Pemantik]: 1 pertanyaan kunci reflektif yang membuat siswa ingin langsung menguji ulang slider simulasi.',
              },
              detectedTrigger: {
                type: Type.STRING,
                description:
                  'Kategori aturan pedagogi: anomaly-outlier | direct-answer-refusal | concept-analogy',
              },
            },
            required: [
              'observation',
              'dataHighlight',
              'socraticQuestion',
              'detectedTrigger',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      const formattedText = `1. [Apresiasi/Observasi Singkat]: ${parsed.observation}\n2. [Sorotan Data/Anomali]: ${parsed.dataHighlight}\n3. [Pertanyaan Pemantik]: ${parsed.socraticQuestion}`;

      res.json({
        source: 'gemini-api',
        response: {
          observation: parsed.observation,
          dataHighlight: parsed.dataHighlight,
          socraticQuestion: parsed.socraticQuestion,
          detectedTrigger: parsed.detectedTrigger || 'concept-analogy',
          formattedText,
        },
      });
    } catch (error) {
      console.error('Dr. LabMu Gemini API Error:', error);
      res.status(500).json({
        error: 'GEMINI_CALL_FAILED',
        message: error instanceof Error ? error.message : 'Gagal menghubungi layanan AI.',
      });
    }
  });

  // WebSocket Server attached to HTTP server on port 3000
  const wss = new WebSocketServer({ server, path: '/ws-lab' });

  interface ExtWebSocket extends WebSocket {
    userId?: string;
    userName?: string;
    role?: 'Siswa' | 'Pengajar';
    groupId?: string;
    domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  }

  const broadcastAll = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };

  const broadcastGroup = (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        // Send to client if target is null (broadcast to all), or if same group, or if role is Pengajar, or if client has not joined a group yet
        if (
          !targetGroupId ||
          client.groupId === targetGroupId ||
          client.role === 'Pengajar' ||
          !client.groupId
        ) {
          client.send(raw);
        }
      }
    });
  };

  wss.on('connection', (socket) => {
    const ws = socket as ExtWebSocket;

    // Prune expired locks before sending state
    pruneExpiredLocks();

    // Send authoritative state upon connection including active parameter mutex locks
    ws.send(
      JSON.stringify({
        type: 'init:state',
        payload: {
          records: experimentRecords,
          tasks: groupTasks,
          notes: collabNotes,
          students: studentRoster,
          notifications,
          paramLocks: Array.from(parameterLocks.values()),
        },
      })
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Client Identity Registration
        if (msg.type === 'client:identify' && msg.payload) {
          ws.userId = msg.payload.userId;
          ws.userName = msg.payload.userName;
          ws.role = msg.payload.role;
          ws.groupId = msg.payload.groupId;
          ws.domain = msg.payload.domain;
        }

        // ==========================================
        // PHASE 3: 3D Spatial Cursors & Parameter Locking
        // ==========================================
        else if (msg.type === 'CURSOR_3D_MOVE' && msg.payload) {
          const cursor: SpatialCursorPayload = msg.payload;
          ws.userId = cursor.userId;
          ws.userName = cursor.userName;
          ws.role = cursor.role;
          ws.groupId = cursor.groupId;
          ws.domain = cursor.domain;

          // Broadcast 3D laser position to peers in same group and teachers
          broadcastGroup(cursor.groupId, {
            type: 'CURSOR_3D_MOVE',
            payload: cursor,
          }, ws);
        } else if (msg.type === 'CURSOR_3D_LEAVE' && msg.payload) {
          broadcastGroup(msg.payload.groupId, {
            type: 'CURSOR_3D_LEAVE',
            payload: msg.payload,
          }, ws);
        } else if (msg.type === 'PARAM_LOCK_ACQUIRE' && msg.payload) {
          const reqLock: ParameterLockPayload = msg.payload;
          ws.userId = reqLock.lockedByUserId;
          ws.userName = reqLock.lockedByName;
          ws.groupId = reqLock.groupId;

          const lockKey = `${reqLock.groupId}:${reqLock.paramKey}`;
          const existing = parameterLocks.get(lockKey);
          const now = Date.now();

          // Mutex: Grant lock if unheld, expired, or held by the same user
          if (
            !existing ||
            now > existing.expiresAt ||
            existing.lockedByUserId === reqLock.lockedByUserId
          ) {
            const grantedLock: ParameterLockPayload = {
              ...reqLock,
              expiresAt:
                now +
                (reqLock.expiresAt && reqLock.expiresAt > now
                  ? Math.min(reqLock.expiresAt - now, 8000)
                  : 5000),
            };
            parameterLocks.set(lockKey, grantedLock);
            broadcastGroup(reqLock.groupId, {
              type: 'PARAM_LOCK_ACQUIRE',
              payload: grantedLock,
            });
          }
        } else if (msg.type === 'PARAM_LOCK_RELEASE' && msg.payload) {
          const { groupId, paramKey, userId } = msg.payload;
          const lockKey = `${groupId}:${paramKey}`;
          const existing = parameterLocks.get(lockKey);
          if (existing && existing.lockedByUserId === userId) {
            parameterLocks.delete(lockKey);
            broadcastGroup(groupId, {
              type: 'PARAM_LOCK_RELEASE',
              payload: msg.payload,
            });
          }
        } else if (msg.type === 'PARAM_VALUE_SYNC' && msg.payload) {
          // Live sync slider parameter across all group members
          broadcastGroup(msg.payload.groupId, {
            type: 'PARAM_VALUE_SYNC',
            payload: msg.payload,
          }, ws);
        }

        // ==========================================
        // Existing Experiment & Collaboration Actions
        // ==========================================
        else if (msg.type === 'record:create' && msg.payload) {
          const rec: ServerExperimentRecord = msg.payload;
          if (!experimentRecords.some((r) => r.id === rec.id)) {
            experimentRecords.unshift(rec);
          }
          const stu = studentRoster.find((s) => s.name === rec.studentName);
          if (stu) {
            stu.trialsRecorded += 1;
            stu.completionPct = Math.min(100, stu.completionPct + 8);
            stu.lastActive = 'Baru saja';
            stu.activeDomain = rec.domain;
            stu.currentActivity = `Merekam data: ${rec.experimentTitle}`;
            if (stu.completionPct >= 90) stu.status = 'Selesai';
          }
          persistServerState();
          broadcastAll({
            type: 'record:created',
            payload: { record: rec, students: studentRoster },
          });
        } else if (msg.type === 'record:delete' && msg.payload?.id) {
          const idx = experimentRecords.findIndex((r) => r.id === msg.payload.id);
          if (idx !== -1) {
            experimentRecords.splice(idx, 1);
            persistServerState();
            broadcastAll({
              type: 'record:deleted',
              payload: { id: msg.payload.id },
            });
          }
        } else if (msg.type === 'task:toggle' && msg.payload?.id) {
          const task = groupTasks.find((t) => t.id === msg.payload.id);
          if (task) {
            task.completed = !task.completed;
            task.completedBy = task.completed ? msg.payload.studentName || 'Siswa' : undefined;
            persistServerState();
            broadcastAll({
              type: 'task:updated',
              payload: { tasks: groupTasks },
            });
          }
        } else if (msg.type === 'task:create' && msg.payload?.title) {
          const newTask: GroupTask = {
            id: msg.payload.id || `task-${Date.now()}`,
            groupId: msg.payload.groupId || 'Kelompok 1 — Mekanika',
            title: msg.payload.title,
            domain: msg.payload.domain || 'Fisika',
            completed: false,
          };
          if (!groupTasks.some((t) => t.id === newTask.id)) {
            groupTasks.push(newTask);
            persistServerState();
            broadcastAll({
              type: 'task:updated',
              payload: { tasks: groupTasks },
            });
          }
        } else if (msg.type === 'note:create' && msg.payload?.text) {
          const note: CollabNote = {
            id: msg.payload.id || `note-${Date.now()}`,
            groupId: msg.payload.groupId || 'Kelompok 1 — Mekanika',
            author: msg.payload.author || 'Alya Pratama',
            role: msg.payload.role || 'Siswa',
            text: msg.payload.text,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          };
          if (!collabNotes.some((n) => n.id === note.id)) {
            collabNotes.push(note);
            persistServerState();
            broadcastAll({
              type: 'note:created',
              payload: { note },
            });
          }
        } else if (msg.type === 'quiz:submit' && msg.payload) {
          const { studentName, score, correctCount } = msg.payload;
          const stu = studentRoster.find((s) => s.name === studentName);
          if (stu) {
            (stu as StudentProgress & { quizScore?: number }).quizScore = score;
            stu.completionPct = Math.min(100, Math.max(stu.completionPct, 85));
            stu.currentActivity = `Menyelesaikan LKS & Kuis (Skor: ${score}/100)`;
            stu.lastActive = 'Baru saja';
            if (score >= 75) stu.status = 'Selesai';
          }
          const notif: ServerNotification = {
            id: `notif-quiz-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'nominal',
            domain: 'Pengajar',
            title: `Skor LKS ${studentName} Masuk (${score}/100)`,
            message: `${studentName} menjawab ${correctCount} soal LKS dengan benar. Nilai rubrik telah diperbarui otomatis.`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'quiz:submitted',
            payload: {
              students: studentRoster,
              notification: notif,
            },
          });
        } else if (msg.type === 'params:sync' && msg.payload) {
          const stu = studentRoster.find((s) => s.name === msg.payload.studentName);
          if (stu) {
            stu.activeDomain = msg.payload.domain || stu.activeDomain;
            stu.currentActivity = msg.payload.activitySummary || stu.currentActivity;
            stu.lastActive = 'Baru saja';
          }
          broadcastAll({
            type: 'params:synced',
            payload: {
              ...msg.payload,
              students: studentRoster,
            },
          });
        } else if (msg.type === 'notification:push' && msg.payload) {
          const notif: ServerNotification = msg.payload;
          if (!notifications.some((n) => n.id === notif.id)) {
            notifications.unshift(notif);
            if (notifications.length > 25) notifications.pop();
            persistServerState();
            broadcastAll({
              type: 'notification:pushed',
              payload: { notification: notif },
            });
          }
        } else if (msg.type === 'teacher:feedback' && msg.payload) {
          const { targetStudentId, message, author } = msg.payload;
          const targetStu = studentRoster.find((s) => s.id === targetStudentId);
          if (targetStu && targetStu.status === 'Butuh Bantuan') {
            targetStu.status = 'Nominal';
          }
          const notif: ServerNotification = {
            id: `notif-teacher-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'nominal',
            domain: 'Pengajar',
            title: `Instruksi Pengajar untuk ${targetStu ? targetStu.name : 'Semua Kelompok'}`,
            message,
          };
          notifications.unshift(notif);
          const note: CollabNote = {
            id: `note-teacher-${Date.now()}`,
            groupId: targetStu ? targetStu.groupId : 'Kelompok 1 — Mekanika',
            author: author || 'Dr. Hendra Kusuma (Pengajar)',
            role: 'Pengajar',
            text: message,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          };
          collabNotes.push(note);
          persistServerState();
          broadcastAll({
            type: 'teacher:broadcasted',
            payload: {
              notification: notif,
              note,
              students: studentRoster,
            },
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    // Clean up locks and active 3D cursor on client disconnect
    ws.on('close', () => {
      if (ws.userId) {
        for (const [key, lock] of parameterLocks.entries()) {
          if (lock.lockedByUserId === ws.userId) {
            parameterLocks.delete(key);
            broadcastGroup(lock.groupId, {
              type: 'PARAM_LOCK_RELEASE',
              payload: {
                groupId: lock.groupId,
                domain: lock.domain,
                paramKey: lock.paramKey,
                userId: ws.userId,
              },
            });
          }
        }
        if (ws.groupId) {
          broadcastGroup(ws.groupId, {
            type: 'CURSOR_3D_LEAVE',
            payload: {
              userId: ws.userId,
              groupId: ws.groupId,
            },
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SimuLab Sains server listening on http://localhost:${PORT}`);
  });
}

startServer();
