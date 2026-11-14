import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
  Sparkles,
  CheckCircle2,
  Eye,
  BrainCircuit,
  Users,
  KeyRound,
  Plus,
  Lock,
  Unlock,
  LogOut,
  X,
  Wifi,
  QrCode as QrCodeIcon,
  BookOpen,
  Layers,
  GraduationCap,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  EXPERIMENT_CATALOG,
  getExperimentById,
} from '../registry/experimentRegistry';
import {
  CURRICULUM_CHAPTERS,
  CurriculumChapter,
  CompetencyTier,
} from '../registry/curriculumChapters';
import { labSound } from '../utils/soundEngine';
import { ComfortThemeMode } from './ui/VisualComfortToolbar';
import {
  ScientificBadge,
  AchievementBadgesStrip,
} from './ui/ScientificEnhancementSuite';
import { useShallow } from 'zustand/react/shallow';
import { useCollabStore } from '../stores/useCollabStore';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import { generateRandomRoomId, generateRandomRoomPin } from '../utils/collabProtocol';
import { ModuleSchematicIllustration } from './ui/ModuleSchematicIllustration';
import { SciFormula } from './ui/ScientificNotation';
import {
  loadLastOpenedModuleId,
  saveLastOpenedModuleId,
  claimDailyLabChallengeXP,
} from '../services/gamificationEngine';

interface LabLobbyHubProps {
  activeTier: EducationTier;
  studentName: string;
  studentGroup: string;
  completedModuleIds: string[];
  recordsCount: number;
  onTierChange: (tier: EducationTier) => void;
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenMysteryExam?: () => void;
  comfortTheme?: ComfortThemeMode;
  onChangeComfortTheme?: (theme: ComfortThemeMode) => void;
  badges?: ScientificBadge[];
  onCreateRoom?: (
    pin: string,
    domain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
    moduleId: string,
    customRoomId?: string
  ) => void;
  onJoinRoom?: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
  onLeaveRoom?: () => void;
  onToggleTeacherFreeze?: (isFrozen: boolean) => void;
}

const DOMAIN_ICONS: Record<
  ScienceDomain,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  fisika: Atom,
  kimia: FlaskConical,
  biologi: Leaf,
  astronomi: Orbit,
};

const DOMAIN_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0ea5e9',
  kimia: '#14b8a6',
  biologi: '#10b981',
  astronomi: '#6366f1',
};

type CognitiveLoadTier = 'all' | 'ringan' | 'terstruktur' | 'analitik';

function getCognitiveLoadProfile(mod: ExperimentModule): {
  tier: 'ringan' | 'terstruktur' | 'analitik';
  label: string;
  symbol: string;
  toneClass: string;
} {
  const varCount = mod.parameters.length;
  if (varCount <= 3 && mod.estimatedMinutes <= 20) {
    return {
      tier: 'ringan',
      label: 'Beban Kognitif Ringan · Eksplorasi Intuitif',
      symbol: '● RINGAN',
      toneClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  if (varCount <= 4) {
    return {
      tier: 'terstruktur',
      label: 'Beban Kognitif Terstruktur · Multi-Variabel',
      symbol: '◆ TERSTRUKTUR',
      toneClass: 'text-sky-700 dark:text-sky-400',
    };
  }
  return {
    tier: 'analitik',
    label: 'Beban Kognitif Analitik · Presisi Tinggi',
    symbol: '▲ ANALITIK',
    toneClass: 'text-amber-700 dark:text-amber-400',
  };
}

/**
 * Cleans raw LaTeX equation strings into crisp, readable mathematical notation
 * without redundant nested parentheses like `√((L) / (g))`.
 */
function formatCleanCardEquation(rawEquation: string): string {
  if (!rawEquation) return '';

  // Remove parenthetical annotations at the end like \quad (\text{dalam satuan...})
  let eq = rawEquation.replace(/\\quad\s*\(\\text\{[^}]+\}\)/g, '');
  // Keep only the first two equality segments if overly long
  const eqSegments = eq.split('=');
  if (eqSegments.length > 3) {
    eq = `${eqSegments[0]}=${eqSegments[1]}=${eqSegments[2]}`;
  }

  return eq
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\sqrt\{\\frac\{([^}]+)\}\{([^}]+)\}\}/g, '√($1 / $2)')
    .replace(/\\left\(\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\\right\)/g, '($1 / $2)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_match, num: string, den: string) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      const fmtNum = /[+-]/.test(cleanNum) ? `(${cleanNum})` : cleanNum;
      const fmtDen = /[+-]/.test(cleanDen) ? `(${cleanDen})` : cleanDen;
      return `${fmtNum} / ${fmtDen}`;
    })
    .replace(/\\xrightarrow\{[^}]*\}/g, ' → ')
    .replace(/\\rightarrow/g, ' → ')
    .replace(/\\uparrow/g, '↑')
    .replace(/\_\{([^}]+)\}/g, '_$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\Sigma/g, '∑')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Psi/g, 'Ψ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\eta/g, 'η')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\phi/g, 'φ')
    .replace(/\\varepsilon/g, 'ε')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\^\\circ/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\propto/g, '∝')
    .replace(/\\quad/g, ' ')
    .replace(/\\max/g, 'max')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/_\*/g, '_*')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const LabLobbyHub: React.FC<LabLobbyHubProps> = ({
  activeTier,
  studentName,
  studentGroup,
  completedModuleIds,
  recordsCount,
  onTierChange,
  onSelectExperiment,
  onOpenMysteryExam,
  badges = [],
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleTeacherFreeze,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<ScienceDomain | 'all'>('all');
  const [cognitiveFilter, setCognitiveFilter] = useState<CognitiveLoadTier>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lobbyViewMode, setLobbyViewMode] = useState<'chapters' | 'all'>('chapters');
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | 'all'>('all');
  const [competencyTierFilter, setCompetencyTierFilter] = useState<CompetencyTier | 'Semua'>('Semua');

  const { userRole, setUserRole } = useLabStore(
    useShallow((s) => ({
      userRole: s.userRole,
      setUserRole: s.setUserRole,
    }))
  );
  const openModal = useUIStore((s) => s.openModal);
  const {
    activeRoomId,
    roomPin,
    roomMembers,
    activeCustomMission,
    isFrozenByTeacher,
    isRoomModalOpen,
    roomModalMode,
    roomError,
    openRoomModal,
    closeRoomModal,
    setRoomError,
  } = useCollabStore(
    useShallow((s) => ({
      activeRoomId: s.activeRoomId,
      roomPin: s.roomPin,
      roomMembers: s.roomMembers,
      activeCustomMission: s.activeCustomMission,
      isFrozenByTeacher: s.isFrozenByTeacher,
      isRoomModalOpen: s.isRoomModalOpen,
      roomModalMode: s.roomModalMode,
      roomError: s.roomError,
      openRoomModal: s.openRoomModal,
      closeRoomModal: s.closeRoomModal,
      setRoomError: s.setRoomError,
    }))
  );

  const [lastModuleId, setLastModuleId] = useState<string | null>(() =>
    loadLastOpenedModuleId()
  );
  const [dailyChallengeToast, setDailyChallengeToast] = useState<string | null>(null);
  const [lanInfo, setLanInfo] = useState<{
    ip: string;
    port: number;
    localUrl: string;
    allLanIps: string[];
  } | null>(null);
  const [selectedLanIp, setSelectedLanIp] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    setLastModuleId(loadLastOpenedModuleId());
    fetch('/api/lan-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.primaryLanIp || data.primaryIp || data.ip)) {
          const primary = data.primaryLanIp || data.primaryIp || data.ip;
          const port = data.port || 3000;
          const allIps = Array.isArray(data.allLanIps) && data.allLanIps.length > 0
            ? data.allLanIps
            : [primary];
          setLanInfo({
            ip: primary,
            port,
            localUrl: `http://${primary}:${port}`,
            allLanIps: allIps,
          });
          setSelectedLanIp(primary);
        }
      })
      .catch(() => {
        // Silently handle if offline
      });
  }, []);

  useEffect(() => {
    const ip = selectedLanIp || lanInfo?.ip;
    if (!ip) return;
    const port = lanInfo?.port || 3000;
    const url = `http://${ip}:${port}`;
    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch(() => {});
  }, [selectedLanIp, lanInfo?.port]);

  const lastOpenedModule = useMemo(() => {
    if (!lastModuleId) return null;
    return getExperimentById(lastModuleId) || null;
  }, [lastModuleId]);

  const handleSelectAndTrackExperiment = (exp: ExperimentModule) => {
    saveLastOpenedModuleId(exp.id);
    setLastModuleId(exp.id);
    onSelectExperiment(exp);
  };

  const handleStartDailyLabChallenge = () => {
    labSound.playSuccessChime();
    const candidates =
      EXPERIMENT_CATALOG.filter((m) => m.supportedTiers.includes(activeTier)) ||
      EXPERIMENT_CATALOG;
    const pool = candidates.length > 0 ? candidates : EXPERIMENT_CATALOG;
    const randomIdx = Math.floor(Math.random() * pool.length);
    const chosenModule = pool[randomIdx] || EXPERIMENT_CATALOG[0];

    claimDailyLabChallengeXP(
      chosenModule.id,
      chosenModule.title,
      `${new Date().toISOString().slice(0, 10)}:${chosenModule.id}`
    );
    saveLastOpenedModuleId(chosenModule.id);
    setLastModuleId(chosenModule.id);
    setDailyChallengeToast(
      `🎉 Bonus +250 XP Diklaim! Membuka Tantangan Sains Hari Ini: ${chosenModule.title}`
    );
    onSelectExperiment(chosenModule);
  };

  const [formRoomId, setFormRoomId] = useState<string>('');
  const [formPin, setFormPin] = useState<string>('');
  const [formDomain, setFormDomain] = useState<'physics' | 'chemistry' | 'biology' | 'astronomy'>('physics');
  const [formRole, setFormRole] = useState<'teacher' | 'student'>(
    userRole === 'pengajar' ? 'teacher' : 'student'
  );
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ roomId: string; domain: string; teacherName?: string; clientCount: number }>
  >([]);

  useEffect(() => {
    if (!isRoomModalOpen) return;
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rooms)) {
          setAvailableRooms(data.rooms);
        }
      })
      .catch(() => {});
  }, [isRoomModalOpen]);

  const filteredChapters = useMemo(() => {
    return CURRICULUM_CHAPTERS.filter((ch) => {
      if (selectedDomain !== 'all' && ch.domain !== selectedDomain) return false;
      if (competencyTierFilter !== 'Semua' && ch.competencyTier !== competencyTierFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ch.title.toLowerCase().includes(q);
        const matchDesc = ch.overviewDescription.toLowerCase().includes(q);
        const matchTheme = ch.realWorldTheme.toLowerCase().includes(q);
        const matchCompetencies = ch.coreCompetencies.some((c) => c.toLowerCase().includes(q));
        const matchModules = ch.moduleIds.some((id) => {
          const m = EXPERIMENT_CATALOG.find((exp) => exp.id === id);
          return m && (m.title.toLowerCase().includes(q) || m.theorySummary.toLowerCase().includes(q));
        });
        if (!matchTitle && !matchDesc && !matchTheme && !matchCompetencies && !matchModules) return false;
      }

      return true;
    });
  }, [selectedDomain, competencyTierFilter, searchQuery]);

  const currentActiveChapter = useMemo(() => {
    if (selectedChapterNum === 'all') return null;
    return CURRICULUM_CHAPTERS.find((ch) => ch.chapterNumber === selectedChapterNum) || null;
  }, [selectedChapterNum]);

  const filteredModules = useMemo(() => {
    return EXPERIMENT_CATALOG.filter((mod) => {
      // If a specific chapter is selected, show its modules
      if (selectedChapterNum !== 'all') {
        if (mod.chapterNumber !== selectedChapterNum) return false;
      } else {
        if (competencyTierFilter !== 'Semua') {
          const ch = CURRICULUM_CHAPTERS.find((c) => c.chapterNumber === mod.chapterNumber);
          if (ch && ch.competencyTier !== competencyTierFilter) return false;
        } else if (lobbyViewMode === 'all') {
          if (!mod.supportedTiers.includes(activeTier)) return false;
        }
      }

      if (selectedDomain !== 'all' && mod.domain !== selectedDomain) return false;

      if (cognitiveFilter !== 'all') {
        const cog = getCognitiveLoadProfile(mod);
        if (cog.tier !== cognitiveFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = mod.title.toLowerCase().includes(q);
        const matchesSub = mod.subCategory.toLowerCase().includes(q);
        const matchesTheory = mod.theorySummary.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSub && !matchesTheory) return false;
      }

      return true;
    });
  }, [
    activeTier,
    selectedDomain,
    cognitiveFilter,
    searchQuery,
    selectedChapterNum,
    competencyTierFilter,
    lobbyViewMode,
  ]);

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playClick(680);
    setRoomError(null);
    if (roomModalMode === 'create') {
      const code = (formRoomId || generateRandomRoomId()).toUpperCase().trim();
      const pinCode = (formPin || generateRandomRoomPin()).trim();
      setUserRole('pengajar');
      if (onCreateRoom) {
        onCreateRoom(pinCode, formDomain, 'newton-incline', code);
      }
    } else {
      const code = formRoomId.toUpperCase().trim();
      const pinCode = formPin.trim();
      if (!code || !pinCode) {
        setRoomError('Masukkan Kode Ruangan (Room ID) dan Kode PIN terlebih dahulu.');
        return;
      }
      setUserRole(formRole === 'teacher' ? 'pengajar' : 'siswa');
      if (onJoinRoom) {
        onJoinRoom(code, pinCode, formRole);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5 select-text">
      {/* ROOM PIN COLLABORATION MODAL */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {roomModalMode === 'create'
                    ? 'Buat Meja Praktikum Baru'
                    : 'Masuk Meja Praktikum dengan PIN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRoomModal}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-slate-950 rounded-xl border border-stone-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  openRoomModal('join');
                  setFormRoomId('');
                  setFormPin('');
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  roomModalMode === 'join'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Masuk dengan PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  openRoomModal('create');
                  setFormRoomId(generateRandomRoomId());
                  setFormPin(generateRandomRoomPin());
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  roomModalMode === 'create'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                + Buat Room
              </button>
            </div>

            {roomError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/50 text-xs font-semibold text-rose-700 dark:text-rose-200">
                {roomError}
              </div>
            )}

            <form onSubmit={handleRoomSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kode Meja Praktikum (4–6 Karakter Unik)
                </label>
                <input
                  type="text"
                  value={formRoomId}
                  onChange={(e) => setFormRoomId(e.target.value.toUpperCase())}
                  placeholder="Contoh: LAB-ALPHA"
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-700 font-mono text-sm font-bold text-sky-700 dark:text-sky-300 uppercase focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kode PIN Keamanan Meja
                </label>
                <input
                  type="text"
                  data-testid="room-pin-input"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="Masukkan PIN 4–6 digit"
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-emerald-300 focus:outline-none focus:border-sky-500"
                />
              </div>

              {roomModalMode === 'create' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Domain Sains Praktikum
                  </label>
                  <select
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="physics">Fisika (Mekanika, Gelombang, Optik)</option>
                    <option value="chemistry">Kimia (Termokimia, Titrasi, Elektrokimia)</option>
                    <option value="biology">Biologi (Fotosintesis, Enzim, Osmosis)</option>
                    <option value="astronomy">Astronomi (Hukum Kepler & Astrofisika)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Peran Peserta di Meja Praktikum
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormRole('student')}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        formRole === 'student'
                          ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300'
                          : 'bg-stone-50 dark:bg-slate-950 border-stone-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      Siswa Praktikan
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRole('teacher')}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        formRole === 'teacher'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'bg-stone-50 dark:bg-slate-950 border-stone-200 dark:border-slate-800 text-slate-500'
                      }`}
                    >
                      Guru Pengampu
                    </button>
                  </div>
                </div>
              )}

              {roomModalMode === 'join' && availableRooms.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Meja Aktif Tersedia (Klik untuk memilih kode meja):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => {
                          setFormRoomId(r.roomId);
                          setFormPin('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 border border-stone-300 dark:border-slate-700 text-[11px] font-mono text-sky-700 dark:text-sky-300 cursor-pointer"
                      >
                        {r.roomId} ({r.clientCount} peserta)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips Daerah 3T: Hotspot Wi-Fi LAN Tanpa Kuota & QR Room */}
              <div
                data-testid="lan-hotspot-info-card"
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5 text-slate-800 dark:text-amber-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                    <Wifi className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Mode LAN Kelas 3T (Tanpa Kuota Internet)</span>
                  </div>
                  {lanInfo?.allLanIps && lanInfo.allLanIps.length > 1 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200">
                      {lanInfo.allLanIps.length} Adaptor IP
                    </span>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  <strong className="text-amber-700 dark:text-amber-300">Tips Daerah 3T:</strong> Nyalakan Hotspot Wi-Fi di laptop Guru (tanpa perlu paket data internet), lalu minta siswa membuka alamat IP lokal ini atau memindai kode QR untuk praktikum bersama tanpa kuota:
                </p>

                {/* IP Adapter Selector if multiple interfaces detected */}
                {lanInfo?.allLanIps && lanInfo.allLanIps.length > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-stone-100 dark:bg-slate-950 p-2 rounded-lg border border-stone-200 dark:border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                      Ganti Antarmuka IP Guru:
                    </label>
                    <select
                      value={selectedLanIp}
                      onChange={(e) => {
                        setSelectedLanIp(e.target.value);
                        labSound.playClick();
                      }}
                      className="flex-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-md px-2 py-1 text-sky-700 dark:text-sky-300 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {lanInfo.allLanIps.map((ip) => (
                        <option key={ip} value={ip}>
                          {ip} {ip.startsWith('192.168.') || ip.startsWith('10.') ? '★ (Hotspot Disarankan)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 bg-stone-100 dark:bg-slate-950 px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-800 font-mono text-xs">
                  <span className="text-slate-500 dark:text-slate-400">URL Hotspot LAN:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 select-all">
                    {`http://${selectedLanIp || lanInfo?.ip || '192.168.43.1'}:${lanInfo?.port || 3000}`}
                  </span>
                </div>

                {/* QR Code Quick Scan for Students */}
                {qrCodeDataUrl && (
                  <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-950/80 rounded-xl border border-stone-200 dark:border-slate-800">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code Meja Praktikum LAN"
                      data-testid="lan-room-qr-code"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white p-1 border border-stone-200 shadow-xs shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <QrCodeIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Pindai Kode QR Meja Praktikum</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        Siswa cukup mengarahkan kamera HP ke QR Code ini untuk langsung membuka meja lab tanpa perlu mengetik alamat IP secara manual.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRoomModal}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  {roomModalMode === 'create' ? 'Buka Meja Praktikum' : 'Gabung Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. CONSOLIDATED ACTION STRIP: Room Collaboration + Quick-Start + Daily Challenge + AI Mission */}
      <div
        data-testid="quick-start-hero-bar"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 shadow-2xs text-xs"
      >
        {/* Left Section: Room Collaboration status & PIN buttons */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 truncate min-w-0">
            <span className="font-bold text-slate-900 dark:text-white shrink-0">Meja Bersama</span>
            {activeRoomId ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
                Room: {activeRoomId} {roomPin ? `(PIN: ${roomPin})` : ''} · {Object.keys(roomMembers).length} Peserta
              </span>
            ) : (
              <span className="hidden xl:inline text-slate-500 dark:text-slate-400 text-[11px] truncate">
                — Kolaborasi kelompok real-time
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setFormRoomId('');
                setFormPin('');
                openRoomModal('join');
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <KeyRound className="w-3 h-3 text-slate-500" />
              <span>Masuk dengan PIN</span>
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setFormRoomId(generateRandomRoomId());
                setFormPin(generateRandomRoomPin());
                openRoomModal('create');
              }}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>+ Buat Room</span>
            </button>

            {activeRoomId && userRole === 'pengajar' && onToggleTeacherFreeze && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick(540);
                  onToggleTeacherFreeze(!isFrozenByTeacher);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer ${
                  isFrozenByTeacher
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {isFrozenByTeacher ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>{isFrozenByTeacher ? 'Buka' : 'Kunci'}</span>
              </button>
            )}

            {activeRoomId && onLeaveRoom && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onLeaveRoom();
                }}
                className="px-2 py-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                title="Keluar dari Meja Praktikum"
              >
                <LogOut className="w-3 h-3" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Resume Last Module + Daily Challenge + AI Mission Builder */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {dailyChallengeToast && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {dailyChallengeToast}
            </span>
          )}

          {lastOpenedModule && (
            <button
              type="button"
              data-testid="quick-start-resume-btn"
              onClick={() => {
                labSound.playClick();
                handleSelectAndTrackExperiment(lastOpenedModule);
              }}
              title={`Lanjutkan eksperimen terakhir: ${lastOpenedModule.title}`}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors max-w-[220px] truncate"
            >
              <span>▶️ Lanjut:</span>
              <span className="truncate font-medium">{lastOpenedModule.title}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="daily-lab-challenge-btn"
            onClick={handleStartDailyLabChallenge}
            title="Tantangan Sains Hari Ini (Dapatkan +250 XP)"
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <span>🎲 Tantangan Sains</span>
            <span className="px-1 py-0.2 rounded bg-slate-950/20 font-mono text-[10px] font-black">
              +250 XP
            </span>
          </button>

          <button
            type="button"
            data-testid="lobby-open-ai-mission-builder-btn"
            onClick={() => {
              labSound.playClick(620);
              if (userRole !== 'pengajar') {
                setUserRole('pengajar');
              }
              openModal('ai-mission-builder');
            }}
            title="Buat Skenario Misi Studi Kasus Praktikum AI untuk Room PIN Kelas"
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ Misi AI Guru</span>
          </button>
        </div>
      </div>

      {/* FITUR 2: ACTIVE ROOM CUSTOM AI MISSION BANNER FOR STUDENTS & TEACHERS */}
      {activeCustomMission && (
        <div
          data-testid="active-room-custom-mission-card"
          className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-sky-950 border-2 border-indigo-400/50 p-5 shadow-xl text-white space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-400/40 font-mono text-[10px] font-bold uppercase text-indigo-200">
                  ✨ MISI STUDI KASUS AI AKTIF · ROOM {activeCustomMission.roomId}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 font-mono text-[10px] font-bold text-emerald-300">
                  Target {activeCustomMission.targetVariable.variableLabel}:{' '}
                  {activeCustomMission.targetVariable.minSuccessValue} –{' '}
                  {activeCustomMission.targetVariable.maxSuccessValue}{' '}
                  {activeCustomMission.targetVariable.unit}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {activeCustomMission.title}
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed">
                {activeCustomMission.narrative}
              </p>
            </div>

            <button
              type="button"
              data-testid="start-room-custom-mission-btn"
              onClick={() => {
                labSound.playClick(640);
                const targetMod =
                  getExperimentById(activeCustomMission.moduleId) || EXPERIMENT_CATALOG[0];
                handleSelectAndTrackExperiment(targetMod);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer shrink-0 transition-all"
            >
              🚀 Kerjakan Misi Studi Kasus Ini →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
            {activeCustomMission.contextualQuestions.slice(0, 3).map((q, idx) => (
              <div
                key={q.id || idx}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1"
              >
                <span className="font-mono text-[10px] font-bold text-amber-300">
                  Pertanyaan LKS #{idx + 1}
                </span>
                <p className="text-slate-200 font-medium leading-snug">{q.questionText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. COMPACT CATALOG HEADER & KPI SUMMARY */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-stone-200/80 dark:border-slate-800/80">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-600 dark:text-sky-400">{studentName}</span>
            <span aria-hidden="true">·</span>
            <span>{studentGroup}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Jenjang {activeTier}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>Ergonomi Visual</span>
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Katalog Laboratorium Sains Interaktif 3D
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 sm:line-clamp-none">
            Dilengkapi Panduan Mikro 3D, Catatan Hipotesis, Komparator, dan Lembar Kerja Siswa (LKS).
          </p>
        </div>

        {/* Right KPI Strip & Mystery Exam CTA */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs shadow-2xs">
          <div className="text-center px-1.5">
            <div className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {completedModuleIds.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Selesai
            </div>
          </div>
          <div className="w-px h-6 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-1.5">
            <div className="text-base font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
              {recordsCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Data Tercatat
            </div>
          </div>
          <div className="w-px h-6 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-1.5">
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {filteredModules.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Modul
            </div>
          </div>

          {onOpenMysteryExam && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onOpenMysteryExam();
              }}
              className="ml-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ujian Sampel →</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. CURRICULUM CHAPTER & COMPETENCY CONTROLS */}
      <div className="space-y-2.5">
        {/* Row A: View Mode Toggle & Competency Tier Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-stone-200/90 dark:border-slate-800 shadow-2xs">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-slate-950 rounded-xl border border-stone-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setLobbyViewMode('chapters');
                setSelectedChapterNum('all');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                lobbyViewMode === 'chapters'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Bab Kurikulum (8 Bab)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setLobbyViewMode('all');
                setSelectedChapterNum('all');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                lobbyViewMode === 'all'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua 28 Modul Sains</span>
            </button>
          </div>

          {/* Competency Tier Selector (Kemampuan Siswa) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1 flex items-center gap-1 text-[11px]">
              <GraduationCap className="w-3.5 h-3.5 text-sky-500" />
              <span>Pilih Kemampuan:</span>
            </span>
            {(['Semua', 'Dasar (SMP)', 'Menengah (SMA)', 'Lanjut (Mahasiswa / OSN)'] as const).map((tier) => {
              const active = competencyTierFilter === tier;
              let badgeColor =
                'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
              if (active) {
                if (tier === 'Dasar (SMP)') badgeColor = 'bg-emerald-600 text-white font-bold';
                else if (tier === 'Menengah (SMA)') badgeColor = 'bg-sky-600 text-white font-bold';
                else if (tier === 'Lanjut (Mahasiswa / OSN)')
                  badgeColor = 'bg-indigo-600 text-white font-bold';
                else badgeColor = 'bg-slate-900 dark:bg-slate-700 text-white font-bold';
              }
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setCompetencyTierFilter(tier);
                    if (tier === 'Dasar (SMP)') onTierChange('SMP');
                    else if (tier === 'Menengah (SMA)') onTierChange('SMA');
                    else if (tier === 'Lanjut (Mahasiswa / OSN)') onTierChange('Mahasiswa');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer shrink-0 ${badgeColor}`}
                >
                  {tier === 'Semua' ? 'Semua Kemampuan' : tier}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row B: Quick Chapter Selector Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSelectedChapterNum('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedChapterNum === 'all'
                ? 'bg-slate-900 dark:bg-slate-700 text-white'
                : 'bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua Bab (1–8)
          </button>
          {CURRICULUM_CHAPTERS.map((ch) => {
            const isSelected = selectedChapterNum === ch.chapterNumber;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedChapterNum(ch.chapterNumber);
                  setLobbyViewMode('chapters');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white font-bold shadow-2xs'
                    : 'bg-stone-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                }`}
              >
                {ch.shortTitle}
              </button>
            );
          })}
        </div>

        {/* Row C: Domain Filter & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Domain Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-200/60 dark:bg-slate-900 rounded-xl border border-stone-200/80 dark:border-slate-800 overflow-x-auto">
            {[
              { id: 'all', label: 'Semua Domain' },
              { id: 'fisika', label: 'Fisika' },
              { id: 'kimia', label: 'Kimia' },
              { id: 'biologi', label: 'Biologi' },
              { id: 'astronomi', label: 'Astronomi' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDomain(tab.id as ScienceDomain | 'all');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedDomain === tab.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Academic Tier Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-stone-200/60 dark:bg-slate-900 rounded-xl border border-stone-200/80 dark:border-slate-800 shrink-0">
              {(['SMP', 'SMA', 'Mahasiswa'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onTierChange(tier);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTier === tier
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Compact Cognitive Load Select */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-stone-200/90 dark:border-slate-800 text-xs">
              <BrainCircuit className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <select
                aria-label="Filter Beban Kognitif"
                value={cognitiveFilter}
                onChange={(e) => {
                  labSound.playClick();
                  setCognitiveFilter(e.target.value as CognitiveLoadTier);
                }}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">
                  Semua Tingkat Kesulitan
                </option>
                <option value="ringan" className="bg-white dark:bg-slate-900">
                  ● Beban Ringan
                </option>
                <option value="terstruktur" className="bg-white dark:bg-slate-900">
                  ◆ Beban Terstruktur
                </option>
                <option value="analitik" className="bg-white dark:bg-slate-900">
                  ▲ Beban Analitik
                </option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari modul atau rumus..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. STUDENT SCIENTIFIC ACHIEVEMENT BADGES STRIP */}
      {badges.length > 0 && <AchievementBadgesStrip badges={badges} />}

      {/* 5. ACTIVE CHAPTER BANNER (If a specific chapter is chosen) */}
      {currentActiveChapter && (
        <div className="rounded-2xl border border-sky-300 dark:border-sky-800/80 bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 p-5 space-y-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/60 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold font-mono text-xs shadow-2xs">
                Bab {currentActiveChapter.chapterNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-800 font-bold text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-700">
                {currentActiveChapter.competencyTier}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sasaran: {currentActiveChapter.targetGrades}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setSelectedChapterNum('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-700 border border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              ← Kembali ke Daftar 8 Bab
            </button>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {currentActiveChapter.title}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {currentActiveChapter.overviewDescription}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-950/70 border border-stone-200/80 dark:border-slate-800/80 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Capaian Pembelajaran Inti Bab:</span>
              </div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                {currentActiveChapter.coreCompetencies.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                    <span className="text-sky-500 font-bold">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-950/70 border border-stone-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-2.5">
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Prasyarat Konsep:
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                  {currentActiveChapter.prerequisites.join(' · ')}
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Konteks Industri &amp; Penerapan Nyata di Indonesia:
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                  {currentActiveChapter.realWorldTheme}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MAIN CONTENT AREA: CHAPTERS GRID OR EXPERIMENT MODULES GRID */}
      {lobbyViewMode === 'chapters' &&
      selectedChapterNum === 'all' &&
      !searchQuery.trim() &&
      cognitiveFilter === 'all' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-500" />
                <span>Pilih Berdasarkan Bab Kurikulum &amp; Tingkat Kemampuan</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                8 Bab berjenjang dari Tingkat Dasar (SMP), Menengah (SMA), hingga Lanjut (Mahasiswa / OSN).
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {filteredChapters.length} Bab Tersedia
            </span>
          </div>

          {filteredChapters.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-stone-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada bab yang sesuai dengan filter domain atau kemampuan Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedDomain('all');
                  setCompetencyTierFilter('Semua');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
              {filteredChapters.map((ch) => {
                let tierBadge =
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                if (ch.competencyTier.startsWith('Menengah')) {
                  tierBadge = 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
                } else if (ch.competencyTier.startsWith('Lanjut')) {
                  tierBadge =
                    'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
                }

                const DomainIcon = DOMAIN_ICONS[ch.domain as ScienceDomain] || Atom;
                const domainColor = DOMAIN_COLORS[ch.domain as ScienceDomain] || '#0ea5e9';

                return (
                  <div
                    key={ch.id}
                    className="rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 flex flex-col justify-between hover:border-sky-500/60 dark:hover:border-sky-500/60 transition-all shadow-xs hover:shadow-lg space-y-4 cursor-pointer group"
                    onClick={() => {
                      labSound.playClick();
                      setSelectedChapterNum(ch.chapterNumber);
                    }}
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800 shadow-2xs">
                            Bab {ch.chapterNumber}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <DomainIcon className="w-3.5 h-3.5" style={{ color: domainColor }} />
                            <span className="capitalize font-semibold">{ch.domain}</span>
                          </div>
                        </div>

                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${tierBadge}`}>
                          {ch.competencyTier}
                        </span>
                      </div>

                      {/* Chapter Title */}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {ch.title}
                        </h3>
                        <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5">
                          Sasaran: {ch.targetGrades}
                        </div>
                      </div>

                      {/* Overview */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {ch.overviewDescription}
                      </p>

                      {/* Core Competencies Preview */}
                      <div className="space-y-1 pt-1">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Capaian Pembelajaran Inti:
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {ch.coreCompetencies.slice(0, 2).map((comp, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{comp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Theme */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                          Konteks Industri:
                        </span>
                        <span className="truncate">{ch.realWorldTheme}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-2 flex items-center justify-between border-t border-stone-100 dark:border-slate-800">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {ch.moduleIds.length} Modul Praktikum 3D
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          labSound.playClick();
                          setSelectedChapterNum(ch.chapterNumber);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs group-hover:translate-x-0.5"
                      >
                        <span>Buka Modul Bab Ini</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-stone-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tidak ada modul eksperimen yang sesuai dengan pencarian atau filter beban kognitif Anda.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedDomain('all');
              setCognitiveFilter('all');
              setSelectedChapterNum('all');
              setCompetencyTierFilter('Semua');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
          >
            Tampilkan Semua Modul
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {filteredModules.map((exp) => {
            const isCompleted = completedModuleIds.includes(exp.id);
            const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
            const accentColor = DOMAIN_COLORS[exp.domain] || '#0ea5e9';
            const conciseDesc =
              exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;
            const primaryEquation = formatCleanCardEquation(exp.keyEquations[0] || '');
            const cogLoad = getCognitiveLoadProfile(exp);

            return (
              <article
                key={exp.id}
                onClick={() => {
                  labSound.playClick();
                  handleSelectAndTrackExperiment(exp);
                }}
                className="bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 hover:border-sky-500/60 dark:hover:border-sky-500/60 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xs hover:shadow-xl cursor-pointer"
              >
                <div>
                  {/* 110px Blueprint Schematic Header with Subtle Grid & Top-Right Badges */}
                  <div className="relative h-[110px] w-full overflow-hidden border-b border-stone-200/70 dark:border-slate-800/90 bg-stone-50/90 dark:bg-slate-950/90 lab-grid-bg flex items-center justify-center px-3">
                    <ModuleSchematicIllustration
                      moduleId={exp.id}
                      domain={exp.domain}
                      title={exp.title}
                      subCategory={exp.subCategory}
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />

                    {/* Top-Left Domain Kicker */}
                    <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-stone-200/80 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      <DomainIcon
                        className="w-3 h-3 shrink-0"
                        style={{ color: accentColor }}
                      />
                      <span className="capitalize">{exp.domain}</span>
                    </div>

                    {/* Top-Right Grouped Badges: Academic Tier & Cognitive Load */}
                    <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-stone-200/80 dark:border-slate-800 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {activeTier}
                      </span>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Selesai</span>
                        </span>
                      ) : (
                        <span
                          className={`px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-stone-200/80 dark:border-slate-800 font-mono text-[10px] font-bold ${cogLoad.toneClass}`}
                          title={cogLoad.label}
                        >
                          {cogLoad.symbol}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 pb-3.5 space-y-2.5">
                    {/* Chapter & SubCategory Metadata */}
                    <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        {exp.chapterNumber && (
                          <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800/80 px-1.5 py-0.2 rounded text-[10px]">
                            Bab {exp.chapterNumber}
                          </span>
                        )}
                        {exp.competencyLevel && (
                          <span className="font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            {exp.competencyLevel}
                          </span>
                        )}
                        <span className="truncate">{exp.subCategory}</span>
                      </div>
                      <span className="font-mono text-[10px] shrink-0 text-slate-400 dark:text-slate-500">
                        {exp.estimatedMinutes}m · {exp.parameters.length} var
                      </span>
                    </div>

                    {/* Card Title */}
                    <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {exp.title}
                    </h2>

                    {/* 2-Line Clamped Summary */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed comfort-prose">
                      {conciseDesc}
                    </p>

                    {/* In-depth materials tag */}
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 px-2 py-1 rounded-lg">
                      <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">Materi Mendalam: Miskonsepsi &amp; Industri Indonesia</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Clean Scientific Equation Box on Left + "Mulai Praktikum →" Action Button on Right */}
                <div className="px-5 pb-4 pt-3 border-t border-stone-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5">
                  {primaryEquation ? (
                    <div
                      className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 text-xs font-mono text-sky-700 dark:text-sky-300 truncate select-text"
                      title={primaryEquation}
                    >
                      <SciFormula text={primaryEquation} />
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      labSound.playClick();
                      handleSelectAndTrackExperiment(exp);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 group-hover:translate-x-0.5"
                  >
                    Mulai Praktikum →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
