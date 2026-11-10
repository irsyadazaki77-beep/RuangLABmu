import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  EXPERIMENT_CATALOG,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import { ComfortThemeMode } from './ui/VisualComfortToolbar';
import {
  ScientificBadge,
  AchievementBadgesStrip,
} from './ui/ScientificEnhancementSuite';
import { useCollabStore } from '../stores/useCollabStore';
import { useLabStore } from '../stores/useLabStore';
import { generateRandomRoomId } from '../utils/collabProtocol';
import { ModuleSchematicIllustration } from './ui/ModuleSchematicIllustration';
import { SciFormula } from './ui/ScientificNotation';

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

  const { userRole, setUserRole } = useLabStore();
  const {
    activeRoomId,
    roomPin,
    roomMembers,
    isFrozenByTeacher,
    isRoomModalOpen,
    roomModalMode,
    roomError,
    openRoomModal,
    closeRoomModal,
    setRoomError,
  } = useCollabStore();

  const [formRoomId, setFormRoomId] = useState<string>('LAB-ALPHA');
  const [formPin, setFormPin] = useState<string>('1234');
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

  const filteredModules = useMemo(() => {
    return EXPERIMENT_CATALOG.filter((mod) => {
      if (!mod.supportedTiers.includes(activeTier)) return false;
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
  }, [activeTier, selectedDomain, cognitiveFilter, searchQuery]);

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playClick(680);
    setRoomError(null);
    if (roomModalMode === 'create') {
      const code = (formRoomId || generateRandomRoomId()).toUpperCase().trim();
      const pinCode = (formPin || '1234').trim();
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
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 select-text">
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
                  setFormRoomId('LAB-ALPHA');
                  setFormPin('1234');
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
                  setFormPin('1234');
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
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value)}
                  placeholder="Contoh: 1234"
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
                    Meja Aktif Tersedia (Klik untuk isi otomatis — PIN Default: 1234):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => {
                          setFormRoomId(r.roomId);
                          setFormPin('1234');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 border border-stone-300 dark:border-slate-700 text-[11px] font-mono text-sky-700 dark:text-sky-300 cursor-pointer"
                      >
                        {r.roomId} ({r.clientCount} peserta)
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

      {/* 1. COMPACT SINGLE-ROW COLLABORATION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Meja Praktikum Bersama
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              — Kerjakan eksperimen bareng satu kelompok secara real-time.
            </span>
            {activeRoomId && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Room: {activeRoomId} {roomPin ? `(PIN: ${roomPin})` : ''} · {Object.keys(roomMembers).length} Peserta
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setFormRoomId('LAB-ALPHA');
              setFormPin('1234');
              openRoomModal('join');
            }}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Masuk dengan PIN</span>
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setFormRoomId(generateRandomRoomId());
              setFormPin('1234');
              openRoomModal('create');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Buat Room</span>
          </button>

          {activeRoomId && userRole === 'pengajar' && onToggleTeacherFreeze && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick(540);
                onToggleTeacherFreeze(!isFrozenByTeacher);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                isFrozenByTeacher
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isFrozenByTeacher ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isFrozenByTeacher ? 'Buka Kunci' : 'Kunci Layar'}</span>
            </button>
          )}

          {activeRoomId && onLeaveRoom && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onLeaveRoom();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Keluar dari Meja Praktikum"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FULL-BLEED CATALOG HEADER & KPI SUMMARY */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-2 border-b border-stone-200/80 dark:border-slate-800/80">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-600 dark:text-sky-400">{studentName}</span>
            <span aria-hidden="true">·</span>
            <span>{studentGroup}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Jenjang {activeTier}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>Ergonomi Visual Aktif</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Katalog Laboratorium Sains Interaktif 3D
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed comfort-prose">
            Pilih modul eksperimen sesuai tingkat kenyamanan belajar Anda: dilengkapi Panduan Langkah Mikro 3D, Buku Catatan Hipotesis, Komparator Percobaan, dan Lembar Kerja Siswa (LKS).
          </p>
        </div>

        {/* Right KPI Strip & Mystery Exam CTA */}
        <div className="flex flex-wrap items-center gap-4 shrink-0 bg-white dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 px-4 py-3 rounded-xl text-xs shadow-2xs">
          <div className="text-center px-2">
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {completedModuleIds.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Modul Selesai
            </div>
          </div>
          <div className="w-px h-7 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-2">
            <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
              {recordsCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Data Tercatat
            </div>
          </div>
          <div className="w-px h-7 bg-stone-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-2">
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {filteredModules.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Modul Tersedia
            </div>
          </div>

          {onOpenMysteryExam && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onOpenMysteryExam();
              }}
              className="ml-1 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ujian Sampel Misterius →</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. SINGLE-ROW FILTER & SEARCH BAR */}
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
              <option value="all" className="bg-white dark:bg-slate-900">Semua Tingkat Kesulitan</option>
              <option value="ringan" className="bg-white dark:bg-slate-900">● Beban Ringan</option>
              <option value="terstruktur" className="bg-white dark:bg-slate-900">◆ Beban Terstruktur</option>
              <option value="analitik" className="bg-white dark:bg-slate-900">▲ Beban Analitik</option>
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

      {/* 4. STUDENT SCIENTIFIC ACHIEVEMENT BADGES STRIP */}
      {badges.length > 0 && <AchievementBadgesStrip badges={badges} />}

      {/* 5. 3-COLUMN PROPORTIONAL EXPERIMENT MODULE GRID */}
      {filteredModules.length === 0 ? (
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
                  onSelectExperiment(exp);
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
                  <div className="p-5 pb-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {exp.subCategory} · {exp.apparatusList[0] || 'Aparatus 3D'}
                      </span>
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
                  </div>
                </div>

                {/* Card Footer: Clean Scientific Equation Box on Left + "Mulai Praktikum →" Action Button on Right */}
                <div className="px-5 pb-4 pt-3 border-t border-stone-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5">
                  {primaryEquation ? (
                    <div
                      className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 text-xs font-mono text-sky-700 dark:text-sky-300 truncate"
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
                      onSelectExperiment(exp);
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
