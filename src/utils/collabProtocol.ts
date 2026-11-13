/**
 * RuangLABmu Real-Time Collaboration Protocol
 * Phase 3 & 4: 3D Spatial Cursors, Parameter Locking Mutex, Room Isolation & Teacher Controls
 */

export interface SpatialCursorPayload {
  userId: string;
  userName: string;
  role: 'Siswa' | 'Pengajar';
  groupId: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  color: string;
  position: [number, number, number]; // 3D world coordinates [x, y, z]
  normal?: [number, number, number];  // Surface normal vector
  hoveredObject?: string;             // e.g., "Buret Asam", "Beban M1", "Planet Bumi"
  updatedAt: number;
}

export interface ParameterLockPayload {
  groupId: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  paramKey: string;      // e.g., "gravity", "mass", "inclineAngle"
  lockedByUserId: string;
  lockedByName: string;
  expiresAt: number;     // Auto-expire after 5000ms to prevent deadlocks on disconnect
}

export interface StudentLiveTelemetry {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' | string;
  topic?: string;
  moduleId: string;
  moduleTitle?: string;
  trialsCount?: number;
  recordsCount?: number;
  currentParameters?: Record<string, number | string | boolean | undefined>;
  rSquared: number;
  currentActivity?: string;
  status?: string;
  lastUpdated: string;
  parametersSummary?: string;
  studentName?: string;
}

export interface LabRoomClient {
  socketId: string;
  userId: string;
  name: string;
  role: 'teacher' | 'student';
  groupId?: string;
  joinedAt: number;
  telemetry?: StudentLiveTelemetry;
}

export interface CustomAIMissionQuestion {
  id: string;
  questionText: string;
  expectedConceptOrValue: string;
  hint: string;
}

export interface CustomAIMissionTarget {
  variableKey: string;
  variableLabel: string;
  unit: string;
  targetValue: number;
  minSuccessValue: number;
  maxSuccessValue: number;
}

export interface CustomAIMissionPayload {
  id: string;
  moduleId: string;
  moduleTitle: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  caseStudyPrompt: string;
  title: string;
  narrative: string;
  targetVariable: CustomAIMissionTarget;
  contextualQuestions: CustomAIMissionQuestion[];
  createdByTeacher: string;
  roomId: string;
  createdAt: number;
  source?: 'gemini-api' | 'deterministic-engine';
}

export interface LabRoom {
  roomId: string;
  pin: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  moduleId: string;
  teacherSocketId?: string;
  teacherName?: string;
  isFrozenByTeacher: boolean;
  createdAt: number;
  clients: Record<string, LabRoomClient>;
  customMission?: CustomAIMissionPayload | null;
}

export interface TeacherLaserRayPayload {
  roomId: string;
  teacherName: string;
  point: [number, number, number];
  normal?: [number, number, number];
  hoveredObject?: string;
  active: boolean;
  updatedAt: number;
}

export interface TeacherCameraSyncPayload {
  roomId: string;
  teacherName: string;
  enabled: boolean;
  position: [number, number, number];
  target: [number, number, number];
  seq: number;
  updatedAt: number;
}

export function isFiniteVec3(vec: unknown): vec is [number, number, number] {
  return (
    Array.isArray(vec) &&
    vec.length === 3 &&
    typeof vec[0] === 'number' &&
    Number.isFinite(vec[0]) &&
    typeof vec[1] === 'number' &&
    Number.isFinite(vec[1]) &&
    typeof vec[2] === 'number' &&
    Number.isFinite(vec[2])
  );
}

export function validateTeacherLaserRayPayload(raw: unknown): TeacherLaserRayPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.active !== 'boolean') return null;
  if (!isFiniteVec3(obj.point)) return null;
  if (obj.normal !== undefined && !isFiniteVec3(obj.normal)) return null;
  const roomId = typeof obj.roomId === 'string' && obj.roomId.trim() ? obj.roomId.trim().toUpperCase().slice(0, 32) : 'LAB-ALPHA';
  const teacherName = typeof obj.teacherName === 'string' && obj.teacherName.trim() ? obj.teacherName.trim().slice(0, 64) : 'Pengajar';
  return {
    roomId,
    teacherName,
    point: [
      Math.max(-500, Math.min(500, obj.point[0])),
      Math.max(-500, Math.min(500, obj.point[1])),
      Math.max(-500, Math.min(500, obj.point[2])),
    ],
    normal: obj.normal ? [obj.normal[0], obj.normal[1], obj.normal[2]] : undefined,
    hoveredObject: typeof obj.hoveredObject === 'string' ? obj.hoveredObject.slice(0, 80) : undefined,
    active: obj.active,
    updatedAt: typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now(),
  };
}

export function validateTeacherCameraSyncPayload(raw: unknown): TeacherCameraSyncPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.enabled !== 'boolean') return null;
  if (!isFiniteVec3(obj.position) || !isFiniteVec3(obj.target)) return null;
  const roomId = typeof obj.roomId === 'string' && obj.roomId.trim() ? obj.roomId.trim().toUpperCase().slice(0, 32) : 'LAB-ALPHA';
  const teacherName = typeof obj.teacherName === 'string' && obj.teacherName.trim() ? obj.teacherName.trim().slice(0, 64) : 'Pengajar';
  return {
    roomId,
    teacherName,
    enabled: obj.enabled,
    position: [
      Math.max(-500, Math.min(500, obj.position[0])),
      Math.max(-500, Math.min(500, obj.position[1])),
      Math.max(-500, Math.min(500, obj.position[2])),
    ],
    target: [
      Math.max(-500, Math.min(500, obj.target[0])),
      Math.max(-500, Math.min(500, obj.target[1])),
      Math.max(-500, Math.min(500, obj.target[2])),
    ],
    seq: typeof obj.seq === 'number' && Number.isFinite(obj.seq) ? obj.seq : Date.now(),
    updatedAt: typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now(),
  };
}

export type CollabWSMessage =
  | { type: 'CURSOR_3D_MOVE'; payload: SpatialCursorPayload }
  | { type: 'CURSOR_3D_LEAVE'; payload: { userId: string; groupId: string } }
  | { type: 'PARAM_LOCK_ACQUIRE'; payload: ParameterLockPayload }
  | { type: 'PARAM_LOCK_RELEASE'; payload: { groupId: string; domain: string; paramKey: string; userId: string } }
  | { type: 'PARAM_VALUE_SYNC'; payload: { groupId: string; domain: string; paramKey: string; value: number; updatedBy: string } }
  | { type: 'PARAM_LOCKS_SYNC'; payload: { locks: ParameterLockPayload[] } }
  | { type: 'ROOM_CREATE'; payload: { roomId?: string; pin: string; domain: 'physics' | 'chemistry' | 'biology' | 'astronomy'; moduleId: string; teacherName: string; teacherUserId: string } }
  | { type: 'ROOM_CREATED'; payload: { room: LabRoom } }
  | { type: 'ROOM_JOIN'; payload: { roomId: string; pin: string; name: string; role: 'teacher' | 'student'; userId: string; groupId?: string } }
  | { type: 'ROOM_JOINED'; payload: { room: LabRoom; client: LabRoomClient } }
  | { type: 'ROOM_ERROR'; payload: { message: string; code: string } }
  | { type: 'ROOM_LEAVE'; payload: { roomId: string; userId: string } }
  | { type: 'TEACHER_FREEZE_TOGGLE'; payload: { roomId: string; isFrozen: boolean; teacherName: string } }
  | { type: 'TEACHER_LASER_RAY'; payload: TeacherLaserRayPayload }
  | { type: 'TEACHER_CAMERA_SYNC'; payload: TeacherCameraSyncPayload }
  | { type: 'STUDENT_TELEMETRY_SYNC'; payload: { roomId: string; studentName: string; userId: string; telemetry: StudentLiveTelemetry } }
  | { type: 'ROOM_STATE_SYNC'; payload: { room: LabRoom } }
  | { type: 'ROOM_SET_CUSTOM_MISSION'; payload: { roomId: string; customMission: CustomAIMissionPayload | null; teacherName?: string; teacherPin?: string } }
  | { type: 'ROOM_MISSION_UPDATED'; payload: { roomId: string; customMission: CustomAIMissionPayload | null; room?: LabRoom } };

/**
 * Deterministic color palette for student avatars, laser pointers, and cursor badges
 */
export const USER_COLOR_PALETTE: Record<string, string> = {
  'Alya Pratama': '#38bdf8',       // Sky Blue
  'Bima Wijaya': '#34d399',        // Emerald Green
  'Citra Lestari': '#f472b6',      // Coral Pink
  'Dimas Nugroho': '#fbbf24',      // Amber Gold
  'Elena Putri': '#a78bfa',        // Lavender Purple
  'Dr. Hendra Kusuma': '#f87171',  // Red Rose (Pengajar)
};

export function getUserColor(userName: string, role?: string): string {
  if (role === 'Pengajar' || role === 'teacher' || userName.toLowerCase().includes('pengajar') || userName.toLowerCase().includes('dr.')) {
    return '#f87171';
  }
  return USER_COLOR_PALETTE[userName] || '#60a5fa';
}

/**
 * Helper to generate random 5-character uppercase Room ID (e.g., LAB-42)
 */
export function generateRandomRoomId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const num = Math.floor(10 + Math.random() * 89);
  const code = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
  return `LAB-${code}${num}`;
}

interface ModuleBlueprintMeta {
  moduleId: string;
  moduleTitle: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  targetVariable: CustomAIMissionTarget;
  defaultQuestions: [
    CustomAIMissionQuestion,
    CustomAIMissionQuestion,
    CustomAIMissionQuestion
  ];
}

const MODULE_MISSION_BLUEPRINTS: Record<string, ModuleBlueprintMeta> = {
  'acid-base-titration': {
    moduleId: 'acid-base-titration',
    moduleTitle: 'Titrasi Asam-Basa & Kurva Sigmoidal pH',
    domain: 'chemistry',
    targetVariable: {
      variableKey: 'currentPh',
      variableLabel: 'pH Titik Ekuivalen Sampel',
      unit: 'pH',
      targetValue: 7.0,
      minSuccessValue: 6.8,
      maxSuccessValue: 7.2,
    },
    defaultQuestions: [
      {
        id: 'q-custom-1',
        questionText:
          'Berdasarkan kurva titrasi sampel pada studi kasus ini, berapa volume titran NaOH (mL) yang dibutuhkan tepat saat mencapai titik ekuivalen (pH ≈ 7.0)?',
        expectedConceptOrValue: 'Volume ekuivalen V_b saat mol H+ = mol OH- (sekitar 20.0 - 25.0 mL pada lonjakan curam kurva sigmoidal).',
        hint: 'Amati titik belok paling tajam pada grafik pH vs Volume Titran NaOH.',
      },
      {
        id: 'q-custom-2',
        questionText:
          'Mengapa kemiringan (d(pH)/dV) berubah sangat drastis di sekitar titik ekuivalen dibandingkan pada daerah penyangga awal?',
        expectedConceptOrValue: 'Karena skala pH bersifat logaritmik (-log[H+]), sehingga perubahan kecil konsentrasi ion H+ di dekat netralitas memicu lonjakan pH yang besar.',
        hint: 'Ingat definisi matematis pH = -log10[H+] saat selisih mol asam dan basa mendekati nol.',
      },
      {
        id: 'q-custom-3',
        questionText:
          'Jika konsentrasi asam pada sampel lapangan meningkat dua kali lipat karena kontaminasi lingkungan, bagaimana dampaknya terhadap volume NaOH yang diperlukan?',
        expectedConceptOrValue: 'Sesuai stoikiometri M1·V1 = M2·V2, volume titran NaOH yang diperlukan akan ikut meningkat dua kali lipat.',
        hint: 'Gunakan persamaan netralisasi M_asam · V_asam · a = M_basa · V_basa · b.',
      },
    ],
  },
  'pendulum-harmonic': {
    moduleId: 'pendulum-harmonic',
    moduleTitle: 'Bandul Sederhana & Getaran Harmonis (GHS)',
    domain: 'physics',
    targetVariable: {
      variableKey: 'pendulumPeriod',
      variableLabel: 'Periode Ayunan Bandul (T)',
      unit: 'detik',
      targetValue: 2.01,
      minSuccessValue: 1.9,
      maxSuccessValue: 2.12,
    },
    defaultQuestions: [
      {
        id: 'q-custom-1',
        questionText:
          'Bagaimana hubungan antara panjang tali bandul (L) terhadap kuadrat periode osilasi (T²) yang Anda amati pada studi kasus ini?',
        expectedConceptOrValue: 'Berbanding lurus (linier) sesuai rumus T² = (4π²/g) · L dengan koefisien determinasi R² mendekati 1.',
        hint: 'Perhatikan persamaan periode bandul T = 2π√(L/g) jika kedua ruas dikuadratkan.',
      },
      {
        id: 'q-custom-2',
        questionText:
          'Berdasarkan gradien garis regresi T² terhadap L dari data pengamatan Anda, berapakah estimasi percepatan gravitasi lokal (g) di lokasi studi kasus?',
        expectedConceptOrValue: 'Nilai g dihitung dari g = 4π² / slope (sekitar 9.81 m/s² di permukaan Bumi atau sesuai anomali gravitasi lokal).',
        hint: 'Jika y = T² dan x = L, maka gradien m = 4π² / g.',
      },
      {
        id: 'q-custom-3',
        questionText:
          'Apakah perubahan massa beban bandul mempengaruhi periode ayunan dalam batas sudut simpangan kecil (θ < 15°)? Jelaskan secara fisis!',
        expectedConceptOrValue: 'Tidak mempengaruhi, karena massa inersia dan massa gravitasi saling meniadakan dalam persamaan gerak harmonis sederhana.',
        hint: 'Bandingkan gaya pemulih F = -mg sin(θ) dengan Hukum II Newton m·a.',
      },
    ],
  },
  'photosynthesis-ingenhousz': {
    moduleId: 'photosynthesis-ingenhousz',
    moduleTitle: 'Fisiologi Biologi & Anatomi (Respirasi / Kardiovaskular / Ingenhousz)',
    domain: 'biology',
    targetVariable: {
      variableKey: 'bubbleRate',
      variableLabel: 'Laju Respons Fisiologis / O₂',
      unit: 'unit/mnt',
      targetValue: 48,
      minSuccessValue: 42,
      maxSuccessValue: 54,
    },
    defaultQuestions: [
      {
        id: 'q-custom-1',
        questionText:
          'Pada rentang parameter berapakah laju aktivitas fisiologis/metabolisme pada studi kasus ini mencapai efisiensi optimum?',
        expectedConceptOrValue: 'Mencapai laju optimum pada rentang target 42–54 unit/mnt sebelum mengalami saturasi atau denaturasi termal.',
        hint: 'Amati puncak kurva laju respons biologis saat parameter suhu dan intensitas divariasikan.',
      },
      {
        id: 'q-custom-2',
        questionText:
          'Mengapa peningkatan suhu melewati batas fisiologis (>40°C) justru menurunkan kinerja enzim dan transpor oksigen secara drastis?',
        expectedConceptOrValue: 'Suhu ekstrem merusak ikatan hidrogen struktur tersier protein/enzim (denaturasi), sehingga sisi aktif tidak lagi mengikat substrat secara efektif.',
        hint: 'Tinjau kestabilan struktur protein dan enzim pada suhu tinggi.',
      },
      {
        id: 'q-custom-3',
        questionText:
          'Bagaimana mekanisme kompensasi homeostatis sistem biologis dalam menjaga suplai oksigen saat kondisi lingkungan berubah seperti pada skenario di atas?',
        expectedConceptOrValue: 'Sistem biologis menyesuaikan laju sirkulasi/pertukaran gas secara proporsional terhadap kebutuhan metabolik jaringan.',
        hint: 'Hubungkan ketersediaan faktor pembatas (O₂/CO₂) dengan kurva saturasi fisiologis.',
      },
    ],
  },
  'solar-kepler': {
    moduleId: 'solar-kepler',
    moduleTitle: 'Mekanika Orbit & Hukum III Kepler',
    domain: 'astronomy',
    targetVariable: {
      variableKey: 'orbitalPeriodYears',
      variableLabel: 'Periode Orbit (T)',
      unit: 'Tahun',
      targetValue: 1.88,
      minSuccessValue: 1.75,
      maxSuccessValue: 2.01,
    },
    defaultQuestions: [
      {
        id: 'q-custom-1',
        questionText:
          'Berapakah rasio T² / a³ yang Anda peroleh dari pencatatan orbit pada studi kasus ini, dan bagaimana kesesuaiannya dengan Hukum III Kepler?',
        expectedConceptOrValue: 'Rasio T² / (a³ / M_star) bernilai konstan ≈ 1.00 (dalam satuan Tahun, AU, dan Massa Matahari).',
        hint: 'Hitung kuadrat periode orbit dibagi pangkat tiga sumbu semi-mayor.',
      },
      {
        id: 'q-custom-2',
        questionText:
          'Berdasarkan Hukum II Kepler (Hukum Luas), di titik manakah wahana/planet bergerak dengan kecepatan orbital paling tinggi?',
        expectedConceptOrValue: 'Pada titik perihelion (jarak terdekat ke bintang induk) karena kekekalan momentum sudut L = m·v·r.',
        hint: 'Ingat kekekalan momentum sudut saat jari-jari orbit r mengecil.',
      },
      {
        id: 'q-custom-3',
        questionText:
          'Jika massa bintang induk meningkat menjadi 4 kali lipat pada jarak orbit yang sama, bagaimana perubahan periode revolusi objek tersebut?',
        expectedConceptOrValue: 'Periode orbit menjadi setengah kali semula (T berbanding terbalik dengan akar kuadrat massa bintang induk, T ∝ 1/√M).',
        hint: 'Gunakan persamaan T² = a³ / M_star.',
      },
    ],
  },
  'newton-incline': {
    moduleId: 'newton-incline',
    moduleTitle: 'Hukum II Newton & Dinamika Bidang Miring',
    domain: 'physics',
    targetVariable: {
      variableKey: 'acceleration',
      variableLabel: 'Percepatan Sistem (a)',
      unit: 'm/s²',
      targetValue: 5.5,
      minSuccessValue: 4.8,
      maxSuccessValue: 6.2,
    },
    defaultQuestions: [
      {
        id: 'q-custom-1',
        questionText:
          'Tuliskan persamaan gaya resultan (ΣF) sepanjang bidang miring yang bekerja pada objek dalam studi kasus ini!',
        expectedConceptOrValue: 'ΣF = F_dorong - m·g·sin(θ) - μ_k·m·g·cos(θ) = m·a.',
        hint: 'Uraikan vektor berat w = m·g menjadi komponen sejajar (mg sin θ) dan tegak lurus (mg cos θ).',
      },
      {
        id: 'q-custom-2',
        questionText:
          'Berdasarkan kemiringan grafik Percepatan (a) terhadap Resultan Gaya (ΣF), berapakah massa efektif benda yang terukur secara eksperimental?',
        expectedConceptOrValue: 'Massa m = 1 / slope dari grafik a terhadap ΣF.',
        hint: 'Dari a = (1/m)·ΣF, gradien garis regresi adalah 1/m.',
      },
      {
        id: 'q-custom-3',
        questionText:
          'Bagaimana pengaruh peningkatan koefisien gesek kinetis (μ_k) terhadap sudut kritis kemiringan saat benda tepat mulai meluncur?',
        expectedConceptOrValue: 'Sudut kritis meningkat sesuai hubungan tan(θ_kritis) = μ, sehingga dibutuhkan sudut lebih curam atau gaya dorong lebih besar.',
        hint: 'Tinjau kondisi kesetimbangan sesaat ketika komponen gaya berat sejajar sama dengan gaya gesek.',
      },
    ],
  },
};

export function resolveModuleBlueprint(moduleId: string): ModuleBlueprintMeta {
  const normalized = (moduleId || '').trim().toLowerCase();
  if (MODULE_MISSION_BLUEPRINTS[normalized]) {
    return MODULE_MISSION_BLUEPRINTS[normalized];
  }
  if (normalized.includes('titra') || normalized.includes('chem') || normalized.includes('thermo') || normalized.includes('redox') || normalized.includes('gas') || normalized.includes('kinetics') || normalized.includes('spectro')) {
    return {
      ...MODULE_MISSION_BLUEPRINTS['acid-base-titration'],
      moduleId: normalized || 'acid-base-titration',
    };
  }
  if (normalized.includes('pendulum') || normalized.includes('bandul') || normalized.includes('spring') || normalized.includes('hooke')) {
    return {
      ...MODULE_MISSION_BLUEPRINTS['pendulum-harmonic'],
      moduleId: normalized || 'pendulum-harmonic',
    };
  }
  if (normalized.includes('bio') || normalized.includes('heart') || normalized.includes('jantung') || normalized.includes('photo') || normalized.includes('enzyme') || normalized.includes('osmosis') || normalized.includes('predator')) {
    return {
      ...MODULE_MISSION_BLUEPRINTS['photosynthesis-ingenhousz'],
      moduleId: normalized === 'jantung' || normalized === 'human-heart' ? 'photosynthesis-ingenhousz' : (normalized || 'photosynthesis-ingenhousz'),
    };
  }
  if (normalized.includes('kepler') || normalized.includes('solar') || normalized.includes('astro') || normalized.includes('exoplanet') || normalized.includes('hubble') || normalized.includes('wien') || normalized.includes('milky')) {
    return {
      ...MODULE_MISSION_BLUEPRINTS['solar-kepler'],
      moduleId: normalized || 'solar-kepler',
    };
  }
  return {
    ...MODULE_MISSION_BLUEPRINTS['newton-incline'],
    moduleId: normalized || 'newton-incline',
  };
}

/**
 * Pure deterministic generator for AI Custom Mission Builder fallback & unit testing.
 */
export function generateDeterministicCustomMission(params: {
  moduleId: string;
  caseStudyPrompt: string;
  teacherName?: string;
  roomId?: string;
}): CustomAIMissionPayload {
  const blueprint = resolveModuleBlueprint(params.moduleId);
  const cleanPrompt =
    (params.caseStudyPrompt || '').trim() ||
    `Investigasi ilmiah terapan pada modul ${blueprint.moduleTitle}`;
  const teacher = (params.teacherName || 'Guru Pengampu').trim();
  const room = (params.roomId || 'LAB-ALPHA').trim().toUpperCase();

  const shortPromptHeadline =
    cleanPrompt.length > 64 ? `${cleanPrompt.slice(0, 61).trim()}...` : cleanPrompt;

  const title = `Misi Studi Kasus: ${shortPromptHeadline}`;
  const narrative = `Studi Kasus Praktikum oleh ${teacher}: "${cleanPrompt}". Gunakan aparatus 3D pada modul ${blueprint.moduleTitle} untuk mengumpulkan minimal 3 titik data pengamatan yang presisi, capai target variabel keberhasilan (${blueprint.targetVariable.minSuccessValue} – ${blueprint.targetVariable.maxSuccessValue} ${blueprint.targetVariable.unit}), dan jawab 3 pertanyaan analisis LKS kontekstual di bawah ini.`;

  const contextualQuestions: CustomAIMissionQuestion[] = blueprint.defaultQuestions.map(
    (q, idx) => ({
      id: `custom-q-${idx + 1}`,
      questionText:
        idx === 0
          ? `[Konteks Studi Kasus: "${shortPromptHeadline}"] ${q.questionText}`
          : q.questionText,
      expectedConceptOrValue: q.expectedConceptOrValue,
      hint: q.hint,
    })
  );

  return {
    id: `AIMISSION-${Date.now().toString(36).toUpperCase()}`,
    moduleId: blueprint.moduleId,
    moduleTitle: blueprint.moduleTitle,
    domain: blueprint.domain,
    caseStudyPrompt: cleanPrompt,
    title,
    narrative,
    targetVariable: { ...blueprint.targetVariable },
    contextualQuestions,
    createdByTeacher: teacher,
    roomId: room,
    createdAt: Date.now(),
    source: 'deterministic-engine',
  };
}

/**
 * Validates and normalizes a raw JSON response from Gemini (or client input)
 * into a strict `CustomAIMissionPayload`.
 */
export function normalizeCustomMissionPayload(
  raw: unknown,
  fallbackInput: {
    moduleId: string;
    caseStudyPrompt: string;
    teacherName?: string;
    roomId?: string;
  },
  source: 'gemini-api' | 'deterministic-engine' = 'gemini-api'
): CustomAIMissionPayload {
  const fallback = generateDeterministicCustomMission(fallbackInput);
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const title =
    typeof candidate.title === 'string' && candidate.title.trim().length > 3
      ? candidate.title.trim()
      : fallback.title;
  const narrative =
    typeof candidate.narrative === 'string' && candidate.narrative.trim().length > 10
      ? candidate.narrative.trim()
      : fallback.narrative;

  const rawTarget =
    candidate.targetVariable && typeof candidate.targetVariable === 'object'
      ? (candidate.targetVariable as Record<string, unknown>)
      : null;

  const minVal =
    rawTarget && typeof rawTarget.minSuccessValue === 'number' && Number.isFinite(rawTarget.minSuccessValue)
      ? rawTarget.minSuccessValue
      : fallback.targetVariable.minSuccessValue;
  const maxVal =
    rawTarget && typeof rawTarget.maxSuccessValue === 'number' && Number.isFinite(rawTarget.maxSuccessValue)
      ? Math.max(minVal, rawTarget.maxSuccessValue)
      : Math.max(minVal, fallback.targetVariable.maxSuccessValue);
  const targetVal =
    rawTarget && typeof rawTarget.targetValue === 'number' && Number.isFinite(rawTarget.targetValue)
      ? rawTarget.targetValue
      : Number(((minVal + maxVal) / 2).toFixed(2));

  const targetVariable: CustomAIMissionTarget = {
    variableKey:
      rawTarget && typeof rawTarget.variableKey === 'string' && rawTarget.variableKey.trim()
        ? rawTarget.variableKey.trim()
        : fallback.targetVariable.variableKey,
    variableLabel:
      rawTarget && typeof rawTarget.variableLabel === 'string' && rawTarget.variableLabel.trim()
        ? rawTarget.variableLabel.trim()
        : fallback.targetVariable.variableLabel,
    unit:
      rawTarget && typeof rawTarget.unit === 'string' && rawTarget.unit.trim()
        ? rawTarget.unit.trim()
        : fallback.targetVariable.unit,
    targetValue: targetVal,
    minSuccessValue: minVal,
    maxSuccessValue: maxVal,
  };

  let contextualQuestions = fallback.contextualQuestions;
  if (Array.isArray(candidate.contextualQuestions) && candidate.contextualQuestions.length >= 3) {
    const parsedQuestions: CustomAIMissionQuestion[] = [];
    for (let i = 0; i < 3; i++) {
      const item = candidate.contextualQuestions[i] as Record<string, unknown> | undefined;
      const fbQ = fallback.contextualQuestions[i];
      if (item && typeof item === 'object' && typeof item.questionText === 'string' && item.questionText.trim()) {
        parsedQuestions.push({
          id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `custom-q-${i + 1}`,
          questionText: item.questionText.trim(),
          expectedConceptOrValue:
            typeof item.expectedConceptOrValue === 'string' && item.expectedConceptOrValue.trim()
              ? item.expectedConceptOrValue.trim()
              : fbQ.expectedConceptOrValue,
          hint:
            typeof item.hint === 'string' && item.hint.trim()
              ? item.hint.trim()
              : fbQ.hint,
        });
      } else {
        parsedQuestions.push(fbQ);
      }
    }
    contextualQuestions = parsedQuestions;
  }

  return {
    ...fallback,
    title,
    narrative,
    targetVariable,
    contextualQuestions,
    source,
  };
}

