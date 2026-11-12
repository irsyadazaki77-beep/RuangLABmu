/**
 * Sistem Gamifikasi & Pencapaian Siswa (FITUR 1)
 * Mengelola skor XP, Level, dan Koleksi Lencana Saintifik (Badges)
 * dengan penyimpanan persisten ke localStorage ('ruanglab:gamification_profile').
 */

export type BadgeName =
  | 'K3 Guardian'
  | 'Precision Analyst'
  | 'Master Titrator'
  | 'Kepler Navigator'
  | 'Bio Explorer';

export interface ScientificBadge {
  id: BadgeName;
  title: BadgeName;
  description: string;
  category: 'K3' | 'Analitik' | 'Kimia' | 'Astronomi' | 'Biologi';
  xpBonus: number;
  unlockedAt?: string;
}

export interface GamificationActionLog {
  id: string;
  action: string;
  xpEarned: number;
  timestamp: string;
}

export interface GamificationProfile {
  xp: number;
  level: number;
  unlockedBadges: BadgeName[];
  badgeUnlockTimestamps: Partial<Record<BadgeName, string>>;
  completedActionKeys: string[];
  history: GamificationActionLog[];
}

export interface GamificationUpdateResult {
  profile: GamificationProfile;
  xpDelta: number;
  leveledUp: boolean;
  newlyUnlockedBadges: ScientificBadge[];
}

export const GAMIFICATION_STORAGE_KEY = 'ruanglab:gamification_profile';
export const LAST_OPENED_MODULE_STORAGE_KEY = 'ruanglab:last_experiment_module_id';

export const XP_REWARDS = {
  K3_COMPLIANCE: 100,
  PRECISION_R2_95: 150,
  PRECISION_R2_99: 300,
  PERFECT_LKS_QUIZ: 200,
  DAILY_CHALLENGE_BONUS: 250,
} as const;

export const XP_PER_LEVEL = 300;

export const SCIENTIFIC_BADGES_CATALOG: ScientificBadge[] = [
  {
    id: 'K3 Guardian',
    title: 'K3 Guardian',
    description: 'Membaca dengan saksama dan mematuhi seluruh aturan Keselamatan & Kesehatan Kerja (K3) laboratorium sebelum praktikum.',
    category: 'K3',
    xpBonus: 100,
  },
  {
    id: 'Precision Analyst',
    title: 'Precision Analyst',
    description: 'Mencatat titik data pengamatan dengan presisi regresi linier tinggi (R² ≥ 0.95).',
    category: 'Analitik',
    xpBonus: 150,
  },
  {
    id: 'Master Titrator',
    title: 'Master Titrator',
    description: 'Menuntaskan eksperimen Kimia & menentukan titik ekuivalen titrasi dengan akurasi tinggi.',
    category: 'Kimia',
    xpBonus: 150,
  },
  {
    id: 'Kepler Navigator',
    title: 'Kepler Navigator',
    description: 'Menavigasi mekanika orbit benda langit & membuktikan Hukum III Kepler secara kuantitatif.',
    category: 'Astronomi',
    xpBonus: 150,
  },
  {
    id: 'Bio Explorer',
    title: 'Bio Explorer',
    description: 'Menuntaskan observasi proses fisiologi & sistem biologis secara sistematis.',
    category: 'Biologi',
    xpBonus: 150,
  },
];

export function calculateLevelFromXP(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  return Math.floor(safeXp / XP_PER_LEVEL) + 1;
}

export function getLevelProgress(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  rankTitle: string;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = calculateLevelFromXP(safeXp);
  const currentLevelXp = safeXp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL;
  const progressPct = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));

  const rankTitles = [
    'Praktikan Pemula',
    'Analis Muda',
    'Peneliti Sains',
    'Ilmuwan Eksperimental',
    'Master Laboratorium',
  ];
  const rankTitle = rankTitles[Math.min(rankTitles.length - 1, level - 1)];

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressPct,
    rankTitle,
  };
}

export function createInitialGamificationProfile(): GamificationProfile {
  return {
    xp: 0,
    level: 1,
    unlockedBadges: [],
    badgeUnlockTimestamps: {},
    completedActionKeys: [],
    history: [],
  };
}

// In-memory fallback for Node unit tests where window/localStorage may not exist
let memoryProfileFallback: GamificationProfile = createInitialGamificationProfile();

type GamificationListener = (
  profile: GamificationProfile,
  latestBadge: ScientificBadge | null,
  xpDelta: number
) => void;

const listeners = new Set<GamificationListener>();

export function subscribeGamification(listener: GamificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(
  profile: GamificationProfile,
  latestBadge: ScientificBadge | null = null,
  xpDelta = 0
) {
  listeners.forEach((fn) => {
    try {
      fn(profile, latestBadge, xpDelta);
    } catch {
      // ignore listener errors
    }
  });
}

export function loadGamificationProfile(): GamificationProfile {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(GAMIFICATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GamificationProfile>;
        const xp = typeof parsed.xp === 'number' ? parsed.xp : 0;
        return {
          xp,
          level: calculateLevelFromXP(xp),
          unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : [],
          badgeUnlockTimestamps: parsed.badgeUnlockTimestamps || {},
          completedActionKeys: Array.isArray(parsed.completedActionKeys)
            ? parsed.completedActionKeys
            : [],
          history: Array.isArray(parsed.history) ? parsed.history : [],
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { ...memoryProfileFallback };
}

export function saveGamificationProfile(profile: GamificationProfile): void {
  const normalized: GamificationProfile = {
    ...profile,
    level: calculateLevelFromXP(profile.xp),
  };
  memoryProfileFallback = normalized;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // ignore storage errors
  }
}

export function resetGamificationProfile(): GamificationProfile {
  const fresh = createInitialGamificationProfile();
  saveGamificationProfile(fresh);
  notifyListeners(fresh, null, 0);
  return fresh;
}

export function awardStudentXP(
  amount: number,
  reason: string,
  actionKey?: string,
  badgesToUnlock: BadgeName[] = []
): GamificationUpdateResult {
  const current = loadGamificationProfile();
  const prevLevel = current.level;

  // Prevent duplicate XP for one-time actionKey if provided, though still check badges
  const alreadyCompleted = actionKey ? current.completedActionKeys.includes(actionKey) : false;
  const effectiveXpDelta = alreadyCompleted ? 0 : Math.max(0, Math.floor(amount));

  const nextXp = current.xp + effectiveXpDelta;
  const nextLevel = calculateLevelFromXP(nextXp);

  const newlyUnlockedBadges: ScientificBadge[] = [];
  const nextUnlockedBadges = [...current.unlockedBadges];
  const nextTimestamps = { ...current.badgeUnlockTimestamps };
  const nowIso = new Date().toISOString();

  for (const badgeName of badgesToUnlock) {
    if (!nextUnlockedBadges.includes(badgeName)) {
      nextUnlockedBadges.push(badgeName);
      nextTimestamps[badgeName] = nowIso;
      const badgeDef = SCIENTIFIC_BADGES_CATALOG.find((b) => b.id === badgeName);
      if (badgeDef) {
        newlyUnlockedBadges.push({ ...badgeDef, unlockedAt: nowIso });
      }
    }
  }

  const nextCompletedKeys =
    actionKey && !alreadyCompleted
      ? [...current.completedActionKeys, actionKey]
      : current.completedActionKeys;

  const nextHistory =
    effectiveXpDelta > 0 || newlyUnlockedBadges.length > 0
      ? [
          {
            id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            action: reason,
            xpEarned: effectiveXpDelta,
            timestamp: nowIso,
          },
          ...current.history,
        ].slice(0, 30)
      : current.history;

  const updatedProfile: GamificationProfile = {
    xp: nextXp,
    level: nextLevel,
    unlockedBadges: nextUnlockedBadges,
    badgeUnlockTimestamps: nextTimestamps,
    completedActionKeys: nextCompletedKeys,
    history: nextHistory,
  };

  saveGamificationProfile(updatedProfile);

  if (effectiveXpDelta > 0 || newlyUnlockedBadges.length > 0) {
    notifyListeners(
      updatedProfile,
      newlyUnlockedBadges[0] || null,
      effectiveXpDelta
    );
  }

  return {
    profile: updatedProfile,
    xpDelta: effectiveXpDelta,
    leveledUp: nextLevel > prevLevel,
    newlyUnlockedBadges,
  };
}

/**
 * 1. Membaca dan mematuhi aturan K3: +100 XP & Lencana "K3 Guardian"
 */
export function recordK3Compliance(moduleId = 'general'): GamificationUpdateResult {
  return awardStudentXP(
    XP_REWARDS.K3_COMPLIANCE,
    `Mematuhi aturan K3 Laboratorium (${moduleId})`,
    `k3:${moduleId}`,
    ['K3 Guardian']
  );
}

/**
 * 2. Mencatat titik data dengan presisi R² >= 0.95: +150 XP (R² >= 0.99: +300 XP)
 *    Sekaligus membuka lencana "Precision Analyst" & lencana domain terkait.
 */
export function evaluateDataPrecisionXP(
  rSquared: number,
  domain?: string,
  moduleId = 'experiment'
): GamificationUpdateResult {
  if (rSquared < 0.95) {
    return {
      profile: loadGamificationProfile(),
      xpDelta: 0,
      leveledUp: false,
      newlyUnlockedBadges: [],
    };
  }

  const isUltraPrecision = rSquared >= 0.99;
  const xpAmount = isUltraPrecision ? XP_REWARDS.PRECISION_R2_99 : XP_REWARDS.PRECISION_R2_95;
  const tierKey = isUltraPrecision ? `r2_99:${moduleId}` : `r2_95:${moduleId}`;

  const badges: BadgeName[] = ['Precision Analyst'];
  const normDomain = (domain || '').toLowerCase();
  if (normDomain.includes('kimia') || normDomain.includes('chem') || moduleId.includes('titration')) {
    badges.push('Master Titrator');
  } else if (normDomain.includes('astro') || moduleId.includes('kepler')) {
    badges.push('Kepler Navigator');
  } else if (normDomain.includes('bio')) {
    badges.push('Bio Explorer');
  }

  return awardStudentXP(
    xpAmount,
    `Presisi Regresi Data R² = ${rSquared.toFixed(3)} (${isUltraPrecision ? '+300 XP' : '+150 XP'})`,
    tierKey,
    badges
  );
}

/**
 * 3. Menyelesaikan LKS dan kuis dengan nilai sempurna: +200 XP
 */
export function recordPerfectLksQuiz(
  score: number,
  domain?: string,
  moduleId = 'lks'
): GamificationUpdateResult {
  const badges: BadgeName[] = [];
  const normDomain = (domain || '').toLowerCase();
  if (normDomain.includes('kimia') || normDomain.includes('chem')) {
    badges.push('Master Titrator');
  } else if (normDomain.includes('astro')) {
    badges.push('Kepler Navigator');
  } else if (normDomain.includes('bio')) {
    badges.push('Bio Explorer');
  }

  if (score >= 100) {
    return awardStudentXP(
      XP_REWARDS.PERFECT_LKS_QUIZ,
      `Menyelesaikan LKS & Kuis dengan Nilai Sempurna (100/100)`,
      `lks_perfect:${moduleId}`,
      badges
    );
  }

  // Even if < 100, unlock domain explorer badge if score >= 80
  if (score >= 80 && badges.length > 0) {
    return awardStudentXP(0, `Menyelesaikan LKS (${score}/100)`, undefined, badges);
  }

  return {
    profile: loadGamificationProfile(),
    xpDelta: 0,
    leveledUp: false,
    newlyUnlockedBadges: [],
  };
}

let memoryLastOpenedModuleId: string | null = null;

/**
 * Simpan ID modul eksperimen terakhir yang dibuka siswa ke localStorage
 * untuk fitur Quick Start / Lanjutkan Eksperimen Terakhir di LabLobbyHub.
 */
export function saveLastOpenedModuleId(moduleId: string): void {
  const clean = (moduleId || '').trim();
  if (!clean) return;
  memoryLastOpenedModuleId = clean;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LAST_OPENED_MODULE_STORAGE_KEY, clean);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Muat ID modul eksperimen terakhir yang dibuka siswa dari localStorage.
 */
export function loadLastOpenedModuleId(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LAST_OPENED_MODULE_STORAGE_KEY);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    }
  } catch {
    // ignore storage errors
  }
  return memoryLastOpenedModuleId;
}

/**
 * 4. Tantangan Sains Hari Ini (Daily Lab Challenge): Bonus +250 XP
 */
export function claimDailyLabChallengeXP(
  moduleId: string,
  moduleTitle: string,
  customActionSeed?: string
): GamificationUpdateResult {
  const dayKey =
    customActionSeed ||
    new Date().toISOString().slice(0, 10) + ':' + (moduleId || 'daily');
  return awardStudentXP(
    XP_REWARDS.DAILY_CHALLENGE_BONUS,
    `Tantangan Sains Hari Ini: ${moduleTitle} (+250 XP)`,
    `daily_challenge:${dayKey}`
  );
}

