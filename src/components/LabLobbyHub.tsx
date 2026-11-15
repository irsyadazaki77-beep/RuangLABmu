import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import {
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
  Sparkles,
  CheckCircle2,
  KeyRound,
  X,
  Wifi,
  QrCode as QrCodeIcon,
  BookOpen,
  Layers,
  Play,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  MODAL_POPOVER_VARIANTS,
  SPRING_LAYOUT_PILL,
  SPRING_TACTILE,
} from '../styles/motionPresets';
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
import {
  filterCurriculumChapters,
  filterExperimentModules,
} from '../utils/spatialHudHelpers';

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

function getTierBadgeClasses(competencyTier: string): string {
  if (competencyTier.startsWith('Menengah')) {
    return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
  }
  if (competencyTier.startsWith('Lanjut')) {
    return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
  }
  return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
}

function getShortJenjangLabel(ch: CurriculumChapter): string {
  if (ch.competencyTier.includes('SMP')) return 'SMP';
  if (ch.competencyTier.includes('SMA')) return 'SMA';
  if (ch.competencyTier.includes('Mahasiswa')) return 'Mahasiswa';
  return ch.competencyTier;
}

function chapterMatchesJenjang(
  ch: CurriculumChapter,
  jenjang: 'all' | EducationTier
): boolean {
  if (jenjang === 'all') return true;
  if (jenjang === 'SMP') return ch.competencyTier.includes('SMP');
  if (jenjang === 'SMA') return ch.competencyTier.includes('SMA');
  if (jenjang === 'Mahasiswa') return ch.competencyTier.includes('Mahasiswa');
  return true;
}

/**
 * Cleans raw LaTeX equation strings into crisp, readable mathematical notation.
 */
function formatCleanCardEquation(rawEquation: string): string {
  if (!rawEquation) return '';

  let eq = rawEquation.replace(/\\quad\s*\(\\text\{[^}]+\}\)/g, '');
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
  completedModuleIds,
  recordsCount,
  onTierChange,
  onSelectExperiment,
  onOpenMysteryExam,
  badges = [],
  onCreateRoom,
  onJoinRoom,
}) => {
  const [jenjangFilter, setJenjangFilter] = useState<'all' | EducationTier>('all');
  const [detailChapter, setDetailChapter] = useState<CurriculumChapter | null>(null);

  const { userRole, setUserRole } = useLabStore(
    useShallow((s) => ({
      userRole: s.userRole,
      setUserRole: s.setUserRole,
    }))
  );

  const {
    openModal,
    lobbySearchQuery,
    setLobbySearchQuery,
    lobbyViewMode,
    setLobbyViewMode,
    lobbySelectedDomain,
    setLobbySelectedDomain,
  } = useUIStore(
    useShallow((s) => ({
      openModal: s.openModal,
      lobbySearchQuery: s.lobbySearchQuery,
      setLobbySearchQuery: s.setLobbySearchQuery,
      lobbyViewMode: s.lobbyViewMode,
      setLobbyViewMode: s.setLobbyViewMode,
      lobbySelectedDomain: s.lobbySelectedDomain,
      setLobbySelectedDomain: s.setLobbySelectedDomain,
    }))
  );

  const {
    activeCustomMission,
    isRoomModalOpen,
    roomModalMode,
    roomError,
    openRoomModal,
    closeRoomModal,
    setRoomError,
  } = useCollabStore(
    useShallow((s) => ({
      activeCustomMission: s.activeCustomMission,
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
          const allIps =
            Array.isArray(data.allLanIps) && data.allLanIps.length > 0
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
        // Silently ignore when offline
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
  }, [selectedLanIp, lanInfo?.ip, lanInfo?.port]);

  useEffect(() => {
    if (!detailChapter) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailChapter(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailChapter]);

  const lastOpenedModule = useMemo(() => {
    if (!lastModuleId) return null;
    return getExperimentById(lastModuleId) || null;
  }, [lastModuleId]);

  const handleSelectAndTrackExperiment = (exp: ExperimentModule) => {
    saveLastOpenedModuleId(exp.id);
    setLastModuleId(exp.id);
    setDetailChapter(null);
    onSelectExperiment(exp);
  };

  const handleStartDailyLabChallenge = () => {
    labSound.playSuccessChime();
    const candidates = EXPERIMENT_CATALOG.filter((m) =>
      m.supportedTiers.includes(activeTier)
    );
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
      `Bonus +250 XP diklaim! Membuka: ${chosenModule.title}`
    );
    onSelectExperiment(chosenModule);
  };

  const [formRoomId, setFormRoomId] = useState<string>('');
  const [formPin, setFormPin] = useState<string>('');
  const [formDomain, setFormDomain] = useState<
    'physics' | 'chemistry' | 'biology' | 'astronomy'
  >('physics');
  const [formRole, setFormRole] = useState<'teacher' | 'student'>(
    userRole === 'pengajar' ? 'teacher' : 'student'
  );
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ roomId: string; domain: string; teacherName?: string; clientCount: number }>
  >([]);

  useEffect(() => {
    if (!isRoomModalOpen) return;
    if (roomModalMode === 'create') {
      setFormRoomId((prev) => prev || generateRandomRoomId());
      setFormPin((prev) => prev || generateRandomRoomPin());
    } else {
      setFormRoomId('');
      setFormPin('');
    }
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rooms)) {
          setAvailableRooms(data.rooms);
        }
      })
      .catch(() => {});
  }, [isRoomModalOpen, roomModalMode]);

  const filteredChapters = useMemo(() => {
    const byDomainAndQuery = filterCurriculumChapters(CURRICULUM_CHAPTERS, {
      domain: lobbySelectedDomain,
      searchQuery: lobbySearchQuery,
      modules: EXPERIMENT_CATALOG,
    });
    return byDomainAndQuery.filter((ch) => chapterMatchesJenjang(ch, jenjangFilter));
  }, [lobbySelectedDomain, lobbySearchQuery, jenjangFilter]);

  const filteredModules = useMemo(() => {
    return filterExperimentModules(EXPERIMENT_CATALOG, {
      domain: lobbySelectedDomain,
      activeTier: jenjangFilter === 'all' ? activeTier : jenjangFilter,
      searchQuery: lobbySearchQuery,
      respectTierFilter: jenjangFilter !== 'all',
    });
  }, [lobbySelectedDomain, activeTier, lobbySearchQuery, jenjangFilter]);

  const detailChapterModules = useMemo(() => {
    if (!detailChapter) return [];
    return detailChapter.moduleIds
      .map((id) => getExperimentById(id))
      .filter((m): m is ExperimentModule => Boolean(m));
  }, [detailChapter]);

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

  const renderModuleCard = (exp: ExperimentModule) => {
    const isCompleted = completedModuleIds.includes(exp.id);
    const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
    const accentColor = DOMAIN_COLORS[exp.domain] || '#0ea5e9';
    const conciseDesc =
      exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;
    const primaryEquation = formatCleanCardEquation(exp.keyEquations[0] || '');

    return (
      <article
        key={exp.id}
        onClick={() => {
          labSound.playClick();
          handleSelectAndTrackExperiment(exp);
        }}
        className="bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 hover:border-sky-500/60 dark:hover:border-sky-500/60 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between group shadow-xs hover:shadow-lg cursor-pointer"
      >
        <div>
          <div className="relative h-[104px] w-full overflow-hidden border-b border-stone-200/70 dark:border-slate-800/90 bg-stone-50/90 dark:bg-slate-950/90 lab-grid-bg flex items-center justify-center px-3">
            <ModuleSchematicIllustration
              moduleId={exp.id}
              domain={exp.domain}
              title={exp.title}
              subCategory={exp.subCategory}
              className="transition-transform duration-300 group-hover:scale-[1.03]"
            />

            <div className="absolute top-2.5 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 border border-stone-200/80 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              <DomainIcon className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
              <span className="capitalize">{exp.domain}</span>
            </div>

            <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 border border-stone-200/80 dark:border-slate-800 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {jenjangFilter === 'all' ? activeTier : jenjangFilter}
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Selesai</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-4 pb-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 truncate">
                {exp.chapterNumber && (
                  <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800/80 px-1.5 py-0.2 rounded text-[10px]">
                    Bab {exp.chapterNumber}
                  </span>
                )}
                <span className="truncate">{exp.subCategory}</span>
              </div>
              <span className="font-mono text-[10px] shrink-0 text-slate-400 dark:text-slate-500">
                {exp.estimatedMinutes}m · {exp.parameters.length} var
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {exp.title}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed comfort-prose">
              {conciseDesc}
            </p>
          </div>
        </div>

        <div className="px-4 pb-3.5 pt-2.5 border-t border-stone-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5">
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
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Mulai Praktikum →
          </button>
        </div>
      </article>
    );
  };

  const continueTargetModule = lastOpenedModule || EXPERIMENT_CATALOG[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 select-text">
      {/* ROOM PIN COLLABORATION MODAL */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
            <motion.div
              variants={MODAL_POPOVER_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto"
            >
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
                  aria-label="Tutup Modal Meja Praktikum"
                  className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                      onChange={(e) =>
                        setFormDomain(
                          e.target.value as 'physics' | 'chemistry' | 'biology' | 'astronomy'
                        )
                      }
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
                      Meja Aktif Tersedia:
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
                        {lanInfo.allLanIps.length} IP
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Nyalakan Hotspot Wi-Fi di laptop Guru, lalu siswa membuka alamat IP lokal atau memindai QR Code berikut untuk praktikum bersama tanpa kuota:
                  </p>

                  {lanInfo?.allLanIps && lanInfo.allLanIps.length > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-stone-100 dark:bg-slate-950 p-2 rounded-lg border border-stone-200 dark:border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                        IP Guru:
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
                            {ip} {ip.startsWith('192.168.') || ip.startsWith('10.') ? '★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 bg-stone-100 dark:bg-slate-950 px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-800 font-mono text-xs">
                    <span className="text-slate-500 dark:text-slate-400">URL LAN:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 select-all">
                      {`http://${selectedLanIp || lanInfo?.ip || '192.168.43.1'}:${lanInfo?.port || 3000}`}
                    </span>
                  </div>

                  {qrCodeDataUrl && (
                    <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-950/80 rounded-xl border border-stone-200 dark:border-slate-800">
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code Meja Praktikum LAN"
                        data-testid="lan-room-qr-code"
                        className="w-20 h-20 rounded-lg bg-white p-1 border border-stone-200 shadow-xs shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <QrCodeIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>Pindai Kode QR Meja Praktikum</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          Arahkan kamera HP siswa ke QR ini untuk bergabung ke meja praktikum LAN tanpa kuota.
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHAPTER DETAIL MODAL (Contains Core Competencies, Prerequisites, Industry Theme & Modules) */}
      <AnimatePresence>
        {detailChapter && (
          <div
            data-testid="chapter-detail-modal"
            className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
            onClick={() => setDetailChapter(null)}
          >
            <motion.div
              variants={MODAL_POPOVER_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900 dark:text-slate-100 max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 dark:border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 dark:bg-sky-600 text-white font-mono text-xs font-bold">
                      Bab {detailChapter.chapterNumber}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getTierBadgeClasses(
                        detailChapter.competencyTier
                      )}`}
                    >
                      {detailChapter.competencyTier}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Sasaran: {detailChapter.targetGrades}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {detailChapter.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailChapter(null)}
                  aria-label="Tutup Detail Bab"
                  className="p-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {detailChapter.overviewDescription}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-950/70 border border-stone-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Capaian Pembelajaran Inti</span>
                  </div>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    {detailChapter.coreCompetencies.map((comp, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-sky-500 font-bold">·</span>
                        <span>{comp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-950/70 border border-stone-200/80 dark:border-slate-800 flex flex-col justify-between space-y-2.5">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Prasyarat Konsep
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {detailChapter.prerequisites.join(' · ')}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-stone-200/70 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Konteks Industri &amp; Penerapan Nyata
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {detailChapter.realWorldTheme}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pilih Modul Praktikum 3D ({detailChapterModules.length} Modul):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detailChapterModules.map((mod) => {
                    const isDone = completedModuleIds.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          handleSelectAndTrackExperiment(mod);
                        }}
                        className="text-left p-3 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-sky-500 transition-colors flex items-center justify-between gap-2.5 cursor-pointer group"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">
                              {mod.title}
                            </span>
                            {isDone && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>{mod.subCategory}</span>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10px]">
                              <Clock className="w-3 h-3" />
                              {mod.estimatedMinutes}m
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-bold shrink-0">
                          Mulai →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTIVE ROOM CUSTOM AI MISSION BANNER */}
      {activeCustomMission && (
        <div
          data-testid="active-room-custom-mission-card"
          className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-sky-950 border-2 border-indigo-400/50 p-4 sm:p-5 shadow-xl text-white space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-400/40 font-mono text-[10px] font-bold uppercase text-indigo-200">
                  MISI STUDI KASUS AI AKTIF · ROOM {activeCustomMission.roomId}
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
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg cursor-pointer shrink-0 transition-colors"
            >
              Kerjakan Misi Ini →
            </button>
          </div>
        </div>
      )}

      {/* CONSOLIDATED "LANJUTKAN PRAKTIKUM" + QUICK ACTIONS & KPI BANNER */}
      <div
        data-testid="quick-start-hero-bar"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 shadow-2xs text-xs"
      >
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            transition={SPRING_TACTILE}
            data-testid="quick-start-resume-btn"
            onClick={() => {
              labSound.playClick();
              handleSelectAndTrackExperiment(continueTargetModule);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>
              {lastOpenedModule
                ? `Lanjutkan Praktikum: ${lastOpenedModule.title}`
                : `Mulai Praktikum: ${continueTargetModule.title}`}
            </span>
          </motion.button>

          <button
            type="button"
            data-testid="daily-lab-challenge-btn"
            onClick={handleStartDailyLabChallenge}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap"
          >
            <span>Tantangan Sains</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-950/15 font-mono text-[10px] font-black">
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
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Misi AI Guru</span>
          </button>

          {onOpenMysteryExam && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onOpenMysteryExam();
              }}
              className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 border border-stone-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Ujian Sampel →</span>
            </button>
          )}
        </div>

        {/* Compact KPI Readouts */}
        <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
          {dailyChallengeToast && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {dailyChallengeToast}
            </span>
          )}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 tabular-nums">
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {completedModuleIds.length}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Selesai</span>
            </div>
            <div className="w-px h-4 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                {recordsCount}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Data</span>
            </div>
            <div className="w-px h-4 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {lobbyViewMode === 'chapters' ? filteredChapters.length : filteredModules.length}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {lobbyViewMode === 'chapters' ? 'Bab' : 'Modul'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2 — SINGLE COMPACT FILTER BAR: [Bab Kurikulum | Semua Modul] + Domain Pills + Single Jenjang Selector */}
      <div
        data-testid="lobby-compact-filter-bar"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-stone-200/90 dark:border-slate-800 shadow-2xs"
      >
        {/* Segmented Toggle: Bab Kurikulum | Semua Modul */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-950 rounded-xl border border-stone-200/80 dark:border-slate-800 shrink-0">
          {(
            [
              { id: 'chapters', label: 'Bab Kurikulum', Icon: BookOpen },
              { id: 'all', label: 'Semua Modul', Icon: Layers },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = lobbyViewMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setLobbyViewMode(id);
                }}
                className={`relative px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="lobby-view-mode-pill"
                    transition={SPRING_LAYOUT_PILL}
                    className="absolute inset-0 rounded-lg bg-sky-600 shadow-2xs"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Domain Filter Pills with Framer Motion layoutId */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-950 rounded-xl border border-stone-200/80 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'fisika', label: 'Fisika' },
            { id: 'kimia', label: 'Kimia' },
            { id: 'biologi', label: 'Biologi' },
            { id: 'astronomi', label: 'Astronomi' },
          ].map((tab) => {
            const isSelected = lobbySelectedDomain === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setLobbySelectedDomain(tab.id as ScienceDomain | 'all');
                }}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="lobby-domain-active-pill"
                    transition={SPRING_LAYOUT_PILL}
                    className="absolute inset-0 rounded-lg bg-sky-600 shadow-2xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Single Jenjang Selector */}
        <div
          role="group"
          aria-label="Filter Jenjang Pendidikan"
          className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-950 rounded-xl border border-stone-200/80 dark:border-slate-800 shrink-0"
        >
          {(['Semua', 'SMP', 'SMA', 'Mahasiswa'] as const).map((tierLabel) => {
            const targetValue: 'all' | EducationTier =
              tierLabel === 'Semua' ? 'all' : tierLabel;
            const active = jenjangFilter === targetValue;
            return (
              <button
                key={tierLabel}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setJenjangFilter(targetValue);
                  if (targetValue !== 'all') {
                    onTierChange(targetValue);
                  }
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tierLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACHIEVEMENT BADGES (IF UNLOCKED) */}
      {badges.length > 0 && <AchievementBadgesStrip badges={badges} />}

      {/* MAIN CATALOG GRID: DIET CHAPTER CARDS OR EXPERIMENT MODULES */}
      {lobbyViewMode === 'chapters' ? (
        <div className="space-y-4">
          {filteredChapters.length === 0 && filteredModules.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-stone-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada bab atau modul yang sesuai dengan filter saat ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLobbySelectedDomain('all');
                  setJenjangFilter('all');
                  setLobbySearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <>
              {filteredChapters.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredChapters.map((ch) => {
                    const DomainIcon = DOMAIN_ICONS[ch.domain as ScienceDomain] || Atom;
                    const domainColor = DOMAIN_COLORS[ch.domain as ScienceDomain] || '#0ea5e9';
                    const tierBadge = getTierBadgeClasses(ch.competencyTier);

                    return (
                      <div
                        key={ch.id}
                        data-testid={`diet-chapter-card-${ch.chapterNumber}`}
                        onClick={() => {
                          labSound.playClick();
                          setDetailChapter(ch);
                        }}
                        className="rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 flex flex-col justify-between hover:border-sky-500/60 transition-all shadow-xs hover:shadow-md space-y-3 cursor-pointer group"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800 shrink-0">
                                Bab {ch.chapterNumber}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                                <DomainIcon
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: domainColor }}
                                />
                                <span className="capitalize font-semibold">{ch.domain}</span>
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${tierBadge}`}
                            >
                              {getShortJenjangLabel(ch)}
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {ch.title}
                          </h3>

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                            {ch.overviewDescription}
                          </p>
                        </div>

                        <div className="pt-2.5 flex items-center justify-between border-t border-stone-100 dark:border-slate-800">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {ch.moduleIds.length} Modul 3D
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              labSound.playClick();
                              setDetailChapter(ch);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          >
                            <span>Buka Bab</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {lobbySearchQuery.trim() && filteredModules.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Hasil Modul untuk &ldquo;{lobbySearchQuery.trim()}&rdquo; ({filteredModules.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                    {filteredModules.map(renderModuleCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-stone-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tidak ada modul eksperimen yang sesuai dengan pencarian atau filter Anda.
          </p>
          <button
            type="button"
            onClick={() => {
              setLobbySearchQuery('');
              setLobbySelectedDomain('all');
              setJenjangFilter('all');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
          >
            Tampilkan Semua Modul
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {filteredModules.map(renderModuleCard)}
        </div>
      )}
    </div>
  );
};
