import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { loadPersistedState, scheduleSaveState } from './src/utils/statePersistence';
import { generateSocraticDrLabMuResponse } from './src/utils/scienceEngine';
import {
  SpatialCursorPayload,
  ParameterLockPayload,
  LabRoom,
  LabRoomClient,
  StudentLiveTelemetry,
  generateRandomRoomId,
} from './src/utils/collabProtocol';

const ROOT_DIR = process.cwd();

const DR_LABMU_SYSTEM_INSTRUCTION = `# ROLE & IDENTITAS
Nama Anda adalah "Dr. LabMu", asisten mentor laboratorium sains virtual cerdas di platform RuangLABmu. Anda menguasai bidang Fisika, Kimia, Biologi, dan Astronomi untuk jenjang SMP, SMA, hingga Perguruan Tinggi.

# PRINSIP PEDAGOGIK UTAMA (METODE SOKRATIK)
1. Pantangan Mutlak: Jangan pernah memberikan angka hasil akhir, jawaban langsung, atau menyalin kesimpulan laporan praktikum secara instan.
2. Bimbingan Bertahap: Tuntun pemahaman siswa menggunakan observasi data nyata, analogi intuitif, dan 1 pertanyaan pemantik reflektif di akhir jawaban.
3. Apresiasi Eksplorasi: Selalu validasi inisiatif siswa sebelum mengoreksi anomali data eksperimen.

# KONTEKS TELEMETRI SIMULASI
Setiap percakapan akan menyertakan data telemetri lab dalam format JSON:
- domain: "Fisika" | "Kimia" | "Biologi" | "Astronomi"
- topic: Judul modul aktif
- educationLevel: "SMP" | "SMA" | "Perguruan Tinggi"
- currentParameters: Parameter aktif yang diatur siswa
- recordedData: Tabel observasi riil dari simulasi
- analytics: Indikator statistik (R², kemiringan/slope, deviasi, persentase error)
- studentQuery: Pertanyaan siswa

# ATURAN PENANGANAN DATA & ANOMALI
1. Anomali & Deviasi Data (R² < 0.85 atau Outlier Ekstrem):
   - Arahkan perhatian siswa ke baris percobaan yang menyimpang tanpa menyalahkan.
2. Format Output:
  1. Observasi Singkat (1-2 kalimat)
  2. Insight / Analogi Konseptual (1-2 paragraf)
  3. Pertanyaan Pemantik (1 kalimat tanya)`;

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

// In-Memory Parameter Mutex Locks
const parameterLocks = new Map<string, ParameterLockPayload>();

function pruneExpiredLocks() {
  const now = Date.now();
  for (const [key, lock] of parameterLocks.entries()) {
    if (now > lock.expiresAt) {
      parameterLocks.delete(key);
    }
  }
}

// Active Lab Rooms Store for Multiplayer Isolation (Fitur 1)
const activeLabRooms = new Map<string, LabRoom>();

activeLabRooms.set('LAB-ALPHA', {
  roomId: 'LAB-ALPHA',
  pin: '1234',
  domain: 'physics',
  moduleId: 'newton-incline',
  teacherSocketId: undefined,
  teacherName: 'Dr. Hendra Kusuma',
  isFrozenByTeacher: false,
  createdAt: Date.now(),
  clients: {},
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Cross-Origin Isolation headers required for SharedArrayBuffer in SimulationRingBuffer
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Hydrate initial state
  const loadedState = await loadPersistedState({
    records: experimentRecords,
    tasks: groupTasks,
    notes: collabNotes,
    students: studentRoster,
    notifications,
  });
  if (loadedState) {
    if (Array.isArray(loadedState.records) && loadedState.records.length > 0) {
      experimentRecords.splice(0, experimentRecords.length, ...(loadedState.records as ServerExperimentRecord[]));
    }
    if (Array.isArray(loadedState.tasks) && loadedState.tasks.length > 0) {
      groupTasks.splice(0, groupTasks.length, ...(loadedState.tasks as GroupTask[]));
    }
    if (Array.isArray(loadedState.notes) && loadedState.notes.length > 0) {
      collabNotes.splice(0, collabNotes.length, ...(loadedState.notes as CollabNote[]));
    }
    if (Array.isArray(loadedState.students) && loadedState.students.length > 0) {
      studentRoster.splice(0, studentRoster.length, ...(loadedState.students as StudentProgress[]));
    }
    if (Array.isArray(loadedState.notifications) && loadedState.notifications.length > 0) {
      notifications.splice(0, notifications.length, ...(loadedState.notifications as ServerNotification[]));
    }
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

  const server = http.createServer(app);

  // REST API Endpoints
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

  // Skema & Penyimpanan Persisten Laporan Praktikum (Tahap 1: data/submissions.json)
  const DATA_DIR = path.join(ROOT_DIR, 'data');
  const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  interface LabSubmissionRecord {
    id: string;
    studentName: string;
    studentId?: string;
    roomId?: string;
    domain: string;
    moduleId: string;
    submittedAt: string;
    hypothesisText: string;
    observationData: Array<Record<string, number | string>>;
    regressionMetrics: { rSquared: number; slope: number; equation: string };
    quizAnswers: Array<{ questionId: string; selectedAnswer: number | string; isCorrect: boolean }>;
    quizScore: number;
    conclusionText: string;
    teacherGrade?: { score: number; feedback: string; gradedAt: string };
  }

  const loadSubmissions = (): LabSubmissionRecord[] => {
    try {
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read submissions.json, using fallback:', e);
    }
    // Seed initial demo submission so teacher gradebook has realistic pedagogical data immediately
    const initialSeed: LabSubmissionRecord[] = [
      {
        id: 'SUB-2026-001',
        studentName: 'Alya Pratama',
        studentId: 'stu-1',
        roomId: 'LAB-ALPHA',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        submittedAt: new Date(Date.now() - 3600000).toISOString(),
        hypothesisText: 'Percepatan benda berbanding lurus dengan resultan gaya dan berbanding terbalik dengan massa total.',
        observationData: [
          { 'No / ID': '1', 'F (N)': 15, 'a (m/s²)': 2.45, 'Status': 'Valid' },
          { 'No / ID': '2', 'F (N)': 30, 'a (m/s²)': 4.90, 'Status': 'Valid' },
          { 'No / ID': '3', 'F (N)': 45, 'a (m/s²)': 7.30, 'Status': 'Valid' },
        ],
        regressionMetrics: {
          rSquared: 0.998,
          slope: 0.162,
          equation: 'y = 0.162x + 0.015',
        },
        quizAnswers: [
          { questionId: 'q-newton-1', selectedAnswer: '9.0', isCorrect: true },
          { questionId: 'q-collision-2', selectedAnswer: '4.0', isCorrect: true },
        ],
        quizScore: 95,
        conclusionText: 'Data hasil percobaan membuktikan keabsahan Hukum II Newton secara empiris dengan korelasi R² = 0.998.',
        teacherGrade: {
          score: 96,
          feedback: 'Analisis regresi luar biasa teliti, penarikan kesimpulan ilmiah sangat komprehensif!',
          gradedAt: new Date(Date.now() - 1800000).toISOString(),
        },
      },
    ];
    try {
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(initialSeed, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    return initialSeed;
  };

  const submissionsList: LabSubmissionRecord[] = loadSubmissions();

  const persistSubmissions = () => {
    try {
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissionsList, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write submissions.json:', err);
    }
  };

  // REST API Endpoints: Submissions Pipeline (Tahap 1)
  app.post('/api/submissions', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || !payload.studentName || !payload.moduleId) {
        res.status(400).json({ error: 'Data laporan praktikum tidak lengkap (studentName & moduleId required)' });
        return;
      }

      const id = payload.id || `SUB-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const newSubmission: LabSubmissionRecord = {
        id,
        studentName: payload.studentName,
        studentId: payload.studentId,
        roomId: payload.roomId || 'LAB-ALPHA',
        domain: payload.domain || 'Fisika',
        moduleId: payload.moduleId,
        submittedAt: payload.submittedAt || new Date().toISOString(),
        hypothesisText: payload.hypothesisText || '',
        observationData: Array.isArray(payload.observationData) ? payload.observationData : [],
        regressionMetrics: payload.regressionMetrics || { rSquared: 0.98, slope: 1.0, equation: 'y = mx + c' },
        quizAnswers: Array.isArray(payload.quizAnswers) ? payload.quizAnswers : [],
        quizScore: Number(payload.quizScore ?? 100),
        conclusionText: payload.conclusionText || '',
        teacherGrade: payload.teacherGrade,
      };

      submissionsList.unshift(newSubmission);
      persistSubmissions();

      // Buat notifikasi guru di sistem
      const notif: ServerNotification = {
        id: `notif-sub-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        severity: 'nominal',
        domain: 'Pengajar',
        title: `Laporan Dikumpulkan: ${newSubmission.studentName}`,
        message: `${newSubmission.studentName} mengumpulkan laporan [${newSubmission.moduleId}] (Tiket: ${newSubmission.id}).`,
      };
      notifications.unshift(notif);
      persistServerState();
      broadcastAll({ type: 'submission:created', payload: { submission: newSubmission, notification: notif } });

      res.status(201).json({
        success: true,
        ticketCode: newSubmission.id,
        submission: newSubmission,
      });
    } catch (err) {
      console.error('Error saving submission:', err);
      res.status(500).json({ error: 'Gagal menyimpan laporan praktikum' });
    }
  });

  app.get('/api/submissions', (_req, res) => {
    res.json({ submissions: submissionsList });
  });

  app.patch('/api/submissions/:id/grade', (req, res) => {
    try {
      const { id } = req.params;
      const { score, feedback } = req.body || {};
      const numScore = Number(score);

      if (Number.isNaN(numScore) || numScore < 0 || numScore > 100) {
        res.status(400).json({ error: 'Nilai harus berupa angka antara 0 dan 100' });
        return;
      }

      const item = submissionsList.find((s) => s.id === id);
      if (!item) {
        res.status(404).json({ error: 'Laporan tidak ditemukan' });
        return;
      }

      item.teacherGrade = {
        score: numScore,
        feedback: String(feedback || '').trim(),
        gradedAt: new Date().toISOString(),
      };
      persistSubmissions();

      broadcastAll({
        type: 'submission:graded',
        payload: { submission: item },
      });

      res.json({ success: true, submission: item });
    } catch (err) {
      console.error('Error grading submission:', err);
      res.status(500).json({ error: 'Gagal memperbarui nilai laporan' });
    }
  });

  // Structured Socratic AI endpoint for Dr. LabMu
  app.post('/api/dr-labmu/ask', async (req, res) => {
    try {
      const telemetry = req.body;
      if (!telemetry || !telemetry.domain) {
        res.status(400).json({ error: 'Invalid telemetry payload' });
        return;
      }

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const prompt = `Data Telemetri Eksperimen Siswa (JSON):\n${JSON.stringify(telemetry, null, 2)}\n\nBerikan respons Dr. LabMu dalam 3 bagian: observasiSingkat, insightKonseptual, dan pertanyaanPemantik.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  observasiSingkat: { type: Type.STRING },
                  insightKonseptual: { type: Type.STRING },
                  pertanyaanPemantik: { type: Type.STRING },
                  hasAnomaly: { type: Type.BOOLEAN },
                },
                required: ['observasiSingkat', 'insightKonseptual', 'pertanyaanPemantik', 'hasAnomaly'],
              },
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          if (parsed.observasiSingkat && parsed.insightKonseptual && parsed.pertanyaanPemantik) {
            res.json({
              ...parsed,
              formattedText: `1. Observasi Singkat:\n${parsed.observasiSingkat}\n\n2. Insight / Analogi Konseptual:\n${parsed.insightKonseptual}\n\n3. Pertanyaan Pemantik:\n💡 ${parsed.pertanyaanPemantik}`,
              source: 'gemini-api',
            });
            return;
          }
        } catch {
          // fallback to deterministic Socratic engine
        }
      }

      const fallbackResponse = generateSocraticDrLabMuResponse(telemetry);
      res.json({
        ...fallbackResponse,
        source: 'socratic-engine',
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Free-form conversational endpoint for Dr. LabMu Live Chat
  app.post('/api/ai/dr-labmu', async (req, res) => {
    try {
      const { message, telemetry } = req.body || {};
      const activeQuery = (message || telemetry?.studentQuery || '').trim();

      if (process.env.GEMINI_API_KEY && activeQuery) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const promptContext = `[KONTEKS TELEMETRI SAAT INI]:
${telemetry ? JSON.stringify(telemetry, null, 2) : `Domain: Sains\nTopik: Praktikum Virtual`}

<student_input>
${activeQuery.slice(0, 600)}
</student_input>`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: promptContext,
            config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
          });

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({ reply: replyText, source: 'gemini-3.8-flash' });
            return;
          }
        } catch {
          // fallback
        }
      }

      if (telemetry) {
        const localStructured = generateSocraticDrLabMuResponse({
          ...telemetry,
          studentQuery: activeQuery,
        });
        res.json({
          reply: localStructured.formattedText,
          structured: localStructured,
          source: 'local-socratic',
        });
        return;
      }

      res.json({
        reply: 'Eksplorasi yang sangat baik di meja praktikum! Bagaimana korelasi variabel bebas dan terikat Anda teramati pada grafik?',
        source: 'local-socratic',
      });
    } catch {
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Gagal memproses pesan AI.' });
    }
  });

  // Multimodal Vision Diagnostic for Dr. LabMu Visual Inspection (Fitur 2)
  app.post('/api/ai/vision-diagnose', async (req, res) => {
    try {
      const { image, telemetry, studentQuery } = req.body || {};
      if (!image) {
        res.status(400).json({ error: 'Data gambar tangkapan layar 3D tidak ditemukan.' });
        return;
      }

      const activeQuery = (studentQuery || '').trim() || 'Periksa penataan alat laboratorium 3D saya dan berikan analisis saintifik.';
      const domain = telemetry?.domain || 'Fisika';
      const topic = telemetry?.topic || 'Laboratorium Sains 3D';

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
          const imagePart = {
            inlineData: { mimeType: 'image/jpeg', data: base64Data },
          };

          const visionPrompt = `Anda adalah Dr. LabMu, mentor laboratorium sains cerdas di RuangLABmu.
Siswa melampirkan foto tangkapan layar meja simulasi 3D eksperimen mereka.
Domain: ${domain} | Topik Modul: ${topic}
Data Telemetri: ${JSON.stringify(telemetry || {}, null, 2)}
Pertanyaan Siswa: "${activeQuery}"
Berikan bimbingan Sokratik cerdas:
1. Observasi Visual (1-2 kalimat): Konfigurasi alat yang tampak.
2. Diagnostik & Analisis Fisis (1-2 paragraf): Hubungan antara posisi visual alat dan hukum sains.
3. Pertanyaan Pemantik Reflektif (1 kalimat): Menuntun langkah penyetelan instrumen berikutnya.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: { parts: [imagePart, { text: visionPrompt }] },
            config: { systemInstruction: DR_LABMU_SYSTEM_INSTRUCTION },
          });

          const replyText = (response.text || '').trim();
          if (replyText) {
            res.json({ reply: replyText, source: 'gemini-vision' });
            return;
          }
        } catch {
          // fallback
        }
      }

      const fallbackReply = `1. Observasi Visual:\nSaya telah memeriksa tangkapan layar 3D meja praktikum ${topic} Anda. Aparatus laboratorium terpasang stabil dengan instrumen pengukuran terkalibrasi.\n\n2. Diagnostik & Analisis Fisis:\nPenataan instrumen Anda sudah menunjukkan kesiapan eksperimen yang baik. Data pengamatan Anda tampak konsisten dengan prediksi hukum dasar sains.\n\n3. Pertanyaan Pemantik:\n💡 Bagaimana jika Anda sedikit menggeser parameter variabel bebas untuk mengamati perubahan seketika pada indikator visual di kanvas 3D?`;

      res.json({ reply: fallbackReply, source: 'local-vision-diagnostic' });
    } catch {
      res.status(500).json({ error: 'Gagal memproses visual diagnostik 3D.' });
    }
  });

  // WebSocket Server on port 3000
  const wss = new WebSocketServer({ server, path: '/ws-lab' });

  interface ExtWebSocket extends WebSocket {
    socketId: string;
    userId?: string;
    userName?: string;
    role?: 'Siswa' | 'Pengajar';
    groupId?: string;
    domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
    roomId?: string;
  }

  const broadcastAll = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };

  const broadcastRoom = (roomId: string, payload: unknown, excludeWs?: WebSocket) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client !== excludeWs) {
        client.send(raw);
      }
    });
  };

  const broadcastGroup = (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string
  ) => {
    if (roomIdScope) {
      broadcastRoom(roomIdScope, payload, excludeWs);
      return;
    }
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
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
    ws.socketId = 'sock-' + Math.random().toString(36).slice(2, 9);

    pruneExpiredLocks();

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

        if (msg.type === 'client:identify' && msg.payload) {
          ws.userId = msg.payload.userId;
          ws.userName = msg.payload.userName;
          ws.role = msg.payload.role;
          ws.groupId = msg.payload.groupId;
          ws.domain = msg.payload.domain;
          if (msg.payload.roomId) {
            ws.roomId = msg.payload.roomId.toUpperCase().trim();
          }
        } else if (msg.type === 'ROOM_CREATE' && msg.payload) {
          const { pin, domain, moduleId, teacherName, teacherUserId, roomId: customId } = msg.payload;
          const roomId = (customId || generateRandomRoomId()).toUpperCase().trim();
          const newRoom: LabRoom = {
            roomId,
            pin: String(pin || '1234').trim(),
            domain: domain || 'physics',
            moduleId: moduleId || 'newton-incline',
            teacherSocketId: ws.socketId,
            teacherName: teacherName || ws.userName || 'Guru',
            isFrozenByTeacher: false,
            createdAt: Date.now(),
            clients: {
              [ws.socketId]: {
                socketId: ws.socketId,
                userId: teacherUserId || ws.userId || 'teacher-1',
                name: teacherName || ws.userName || 'Guru',
                role: 'teacher',
                joinedAt: Date.now(),
              },
            },
          };
          activeLabRooms.set(roomId, newRoom);
          ws.roomId = roomId;
          ws.role = 'Pengajar';

          ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { room: newRoom } }));
          broadcastRoom(roomId, { type: 'ROOM_STATE_SYNC', payload: { room: newRoom } });
        } else if (msg.type === 'ROOM_JOIN' && msg.payload) {
          const { roomId: rawRoomId, pin: inputPin, name, role, userId, groupId } = msg.payload;
          const roomId = (rawRoomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(roomId);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: {
                  message: `Meja praktikum [${roomId}] tidak ditemukan. Periksa kembali kode ruangan.`,
                  code: 'ROOM_NOT_FOUND',
                },
              })
            );
            return;
          }

          if (room.pin && String(room.pin).trim() !== String(inputPin || '').trim()) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_ERROR',
                payload: {
                  message: `Kode PIN untuk meja [${roomId}] salah. Hubungi guru atau pembuat meja.`,
                  code: 'INVALID_PIN',
                },
              })
            );
            return;
          }

          if (ws.roomId && activeLabRooms.has(ws.roomId)) {
            const prev = activeLabRooms.get(ws.roomId)!;
            delete prev.clients[ws.socketId];
            broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room: prev } });
          }

          const clientRole = role === 'teacher' || role === 'Pengajar' ? 'teacher' : 'student';
          const roomClient: LabRoomClient = {
            socketId: ws.socketId,
            userId: userId || ws.userId || `user-${Date.now()}`,
            name: name || ws.userName || 'Siswa',
            role: clientRole,
            groupId: groupId || ws.groupId,
            joinedAt: Date.now(),
          };

          room.clients[ws.socketId] = roomClient;
          ws.roomId = roomId;
          ws.userName = roomClient.name;
          ws.role = clientRole === 'teacher' ? 'Pengajar' : 'Siswa';
          if (clientRole === 'teacher') {
            room.teacherSocketId = ws.socketId;
            room.teacherName = roomClient.name;
          }

          ws.send(JSON.stringify({ type: 'ROOM_JOINED', payload: { room, client: roomClient } }));
          broadcastRoom(roomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
        } else if (msg.type === 'ROOM_LEAVE') {
          if (ws.roomId && activeLabRooms.has(ws.roomId)) {
            const room = activeLabRooms.get(ws.roomId)!;
            delete room.clients[ws.socketId];
            if (room.teacherSocketId === ws.socketId) {
              room.teacherSocketId = undefined;
            }
            const oldId = ws.roomId;
            ws.roomId = undefined;
            broadcastRoom(oldId, { type: 'ROOM_STATE_SYNC', payload: { room } });
          }
        } else if (msg.type === 'TEACHER_FREEZE_TOGGLE' && msg.payload) {
          const { roomId, isFrozen, teacherName } = msg.payload;
          const targetRoomId = (roomId || ws.roomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(targetRoomId);
          if (room) {
            room.isFrozenByTeacher = Boolean(isFrozen);
            broadcastRoom(targetRoomId, {
              type: 'TEACHER_FREEZE_TOGGLE',
              payload: {
                roomId: targetRoomId,
                isFrozen: room.isFrozenByTeacher,
                teacherName: teacherName || ws.userName || room.teacherName || 'Guru',
              },
            });
            broadcastRoom(targetRoomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
          }
        } else if (msg.type === 'STUDENT_TELEMETRY_SYNC' && msg.payload) {
          const { roomId, studentName, telemetry } = msg.payload;
          const targetRoomId = (roomId || ws.roomId || '').toUpperCase().trim();
          const room = activeLabRooms.get(targetRoomId);
          if (room) {
            const client = room.clients[ws.socketId];
            if (client) {
              client.telemetry = {
                ...telemetry,
                studentName: studentName || client.name,
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              };
            }
            broadcastRoom(targetRoomId, {
              type: 'STUDENT_TELEMETRY_SYNC',
              payload: {
                roomId: targetRoomId,
                studentName: studentName || ws.userName,
                telemetry: client?.telemetry || telemetry,
              },
            });
          }
        } else if (msg.type === 'CURSOR_3D_MOVE' && msg.payload) {
          const cursor: SpatialCursorPayload = msg.payload;
          ws.userId = cursor.userId;
          ws.userName = cursor.userName;
          ws.role = cursor.role;
          ws.groupId = cursor.groupId;
          ws.domain = cursor.domain;

          broadcastGroup(cursor.groupId, { type: 'CURSOR_3D_MOVE', payload: cursor }, ws, ws.roomId);
        } else if (msg.type === 'CURSOR_3D_LEAVE' && msg.payload) {
          broadcastGroup(msg.payload.groupId, { type: 'CURSOR_3D_LEAVE', payload: msg.payload }, ws, ws.roomId);
        } else if (msg.type === 'PARAM_LOCK_ACQUIRE' && msg.payload) {
          const reqLock: ParameterLockPayload = msg.payload;
          ws.userId = reqLock.lockedByUserId;
          ws.userName = reqLock.lockedByName;
          ws.groupId = reqLock.groupId;

          const lockKey = `${ws.roomId || reqLock.groupId}:${reqLock.paramKey}`;
          const existing = parameterLocks.get(lockKey);
          const now = Date.now();

          if (!existing || now > existing.expiresAt || existing.lockedByUserId === reqLock.lockedByUserId) {
            const grantedLock: ParameterLockPayload = {
              ...reqLock,
              expiresAt: now + (reqLock.expiresAt && reqLock.expiresAt > now ? Math.min(reqLock.expiresAt - now, 8000) : 5000),
            };
            parameterLocks.set(lockKey, grantedLock);
            broadcastGroup(reqLock.groupId, { type: 'PARAM_LOCK_ACQUIRE', payload: grantedLock }, undefined, ws.roomId);
          }
        } else if (msg.type === 'PARAM_LOCK_RELEASE' && msg.payload) {
          const { groupId, paramKey, userId } = msg.payload;
          const lockKey = `${ws.roomId || groupId}:${paramKey}`;
          const existing = parameterLocks.get(lockKey);
          if (existing && existing.lockedByUserId === userId) {
            parameterLocks.delete(lockKey);
            broadcastGroup(groupId, { type: 'PARAM_LOCK_RELEASE', payload: msg.payload }, undefined, ws.roomId);
          }
        } else if (msg.type === 'PARAM_VALUE_SYNC' && msg.payload) {
          broadcastGroup(msg.payload.groupId, { type: 'PARAM_VALUE_SYNC', payload: msg.payload }, ws, ws.roomId);
        } else if (msg.type === 'record:create' && msg.payload) {
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
          broadcastAll({ type: 'record:created', payload: { record: rec, students: studentRoster } });
        } else if (msg.type === 'record:delete' && msg.payload?.id) {
          const idx = experimentRecords.findIndex((r) => r.id === msg.payload.id);
          if (idx !== -1) {
            experimentRecords.splice(idx, 1);
            persistServerState();
            broadcastAll({ type: 'record:deleted', payload: { id: msg.payload.id } });
          }
        } else if (msg.type === 'task:toggle' && msg.payload?.id) {
          const task = groupTasks.find((t) => t.id === msg.payload.id);
          if (task) {
            task.completed = !task.completed;
            task.completedBy = task.completed ? msg.payload.studentName || 'Siswa' : undefined;
            persistServerState();
            broadcastAll({ type: 'task:updated', payload: { tasks: groupTasks } });
          }
        } else if (msg.type === 'task:create' && msg.payload?.title) {
          const newTask: GroupTask = {
            id: msg.payload.id || `task-${Date.now()}`,
            groupId: msg.payload.groupId || 'Kelompok 1 — Mekanika',
            title: msg.payload.title,
            domain: msg.payload.domain || 'Fisika',
            completed: false,
          };
          groupTasks.push(newTask);
          persistServerState();
          broadcastAll({ type: 'task:updated', payload: { tasks: groupTasks } });
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
            broadcastAll({ type: 'note:created', payload: { note } });
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
          broadcastAll({ type: 'quiz:submitted', payload: { students: studentRoster, notification: notif } });
        } else if (msg.type === 'notification:push' && msg.payload) {
          const notif: ServerNotification = msg.payload;
          if (!notifications.some((n) => n.id === notif.id)) {
            notifications.unshift(notif);
            if (notifications.length > 25) notifications.pop();
            persistServerState();
            broadcastAll({ type: 'notification:pushed', payload: { notification: notif } });
          }
        } else if (msg.type === 'teacher:feedback' && msg.payload) {
          const { targetStudentId, message, author } = msg.payload;
          const targetStu = studentRoster.find((s) => s.id === targetStudentId);
          const notif: ServerNotification = {
            id: `notif-tf-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            severity: 'elevated',
            domain: 'Pengajar',
            title: targetStu ? `Pesan Guru untuk ${targetStu.name}` : 'Pengumuman Kelas dari Pengajar',
            message: `${author || 'Dr. Hendra Kusuma'}: "${message}"`,
          };
          notifications.unshift(notif);
          const note: CollabNote = {
            id: `note-tf-${Date.now()}`,
            groupId: targetStu ? targetStu.groupId : 'Semua Kelompok',
            author: author || 'Dr. Hendra Kusuma',
            role: 'Pengajar',
            text: targetStu ? `@${targetStu.name}: ${message}` : `[PENGUMUMAN KELAS] ${message}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          };
          collabNotes.push(note);
          if (targetStu && targetStu.status === 'Butuh Bantuan') {
            targetStu.status = 'Nominal';
          }
          persistServerState();
          broadcastAll({
            type: 'teacher:broadcasted',
            payload: { notification: notif, note, students: studentRoster },
          });
        } else if (msg.type === 'mystery:broadcast' && msg.payload) {
          const { challenge, author } = msg.payload;
          const notif: ServerNotification = {
            id: `notif-mys-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            severity: 'critical',
            domain: 'Pengajar',
            title: `UJIAN PRAKTIKUM MISTERI: ${challenge.title}`,
            message: `${author || 'Dr. Hendra Kusuma'} mengirim sampel misteri [${challenge.codeName}] ke meja kerja Anda.`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'mystery:broadcasted',
            payload: { challenge, notification: notif },
          });
        } else if (msg.type === 'mystery:submit' && msg.payload) {
          const { studentName, result, challengeTitle } = msg.payload;
          const stu = studentRoster.find((s) => s.name === studentName);
          if (stu) {
            stu.completionPct = Math.min(100, Math.max(stu.completionPct, result.score));
            stu.currentActivity = `Ujian Sampel Misteri: ${result.score}/100 (${result.passed ? 'LULUS' : 'REMEDIAL'})`;
            stu.lastActive = 'Baru saja';
            if (result.passed) stu.status = 'Selesai';
          }
          const notif: ServerNotification = {
            id: `notif-mys-sub-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            severity: result.passed ? 'nominal' : 'elevated',
            domain: 'Pengajar',
            title: `Hasil Ujian Misteri ${studentName}: ${result.score}/100`,
            message: `${studentName} menebak ${result.submittedValue} ${result.unit} pada "${challengeTitle}" (Galat: ${result.errorPercent}%).`,
          };
          notifications.unshift(notif);
          persistServerState();
          broadcastAll({
            type: 'mystery:submitted',
            payload: { studentName, result, students: studentRoster, notification: notif },
          });
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

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
            }, undefined, ws.roomId);
          }
        }
        if (ws.groupId) {
          broadcastGroup(ws.groupId, {
            type: 'CURSOR_3D_LEAVE',
            payload: { userId: ws.userId, groupId: ws.groupId },
          }, undefined, ws.roomId);
        }
      }

      if (ws.roomId && activeLabRooms.has(ws.roomId)) {
        const room = activeLabRooms.get(ws.roomId)!;
        delete room.clients[ws.socketId];
        if (room.teacherSocketId === ws.socketId) {
          room.teacherSocketId = undefined;
        }
        broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
      }
    });
  });

  // Session Auto-Save Sync Endpoint (supports monotonic version & AbortController cancellation)
  const sessionSnapshots = new Map<string, { version: number; session: unknown; updatedAt: number }>();
  app.post('/api/session/autosave', (req, res) => {
    const { storageKey, version, session } = req.body || {};
    if (!storageKey || typeof storageKey !== 'string' || typeof version !== 'number') {
      res.status(400).json({ error: 'Invalid session autosave payload' });
      return;
    }
    const existing = sessionSnapshots.get(storageKey);
    if (existing && existing.version > version) {
      res.status(409).json({
        status: 'stale_rejected',
        latestVersion: existing.version,
      });
      return;
    }
    sessionSnapshots.set(storageKey, {
      version,
      session,
      updatedAt: Date.now(),
    });
    res.json({
      status: 'ok',
      version,
      savedAt: Date.now(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = await import(viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = fs.existsSync(path.join(ROOT_DIR, 'dist'))
      ? path.join(ROOT_DIR, 'dist')
      : path.resolve(ROOT_DIR, '..', 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`RuangLABmu server listening on http://localhost:${PORT}`);
  });
}

startServer();
