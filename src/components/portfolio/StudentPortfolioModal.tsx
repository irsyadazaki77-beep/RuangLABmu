import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trophy,
  Award,
  ShieldCheck,
  Camera,
  Printer,
  Lock,
  CheckCircle2,
  TrendingUp,
  Compass,
  FlaskConical,
  Dna,
  FileText,
  RefreshCw,
} from 'lucide-react';
import {
  GamificationProfile,
  SCIENTIFIC_BADGES_CATALOG,
  getLevelProgress,
  BadgeName,
} from '../../services/gamificationEngine';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { apiFetch } from '../../utils/apiClient';
import { StemRadarChartSection } from './StemRadarChartSection';
import { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import { resolveStudentStep } from '../../utils/telemetryRadar';
import { labSound } from '../../utils/soundEngine';
import type { LabSubmission } from '../../types/submissionTypes';

export interface StemRadarAxisScore {
  id: 'regression' | 'k3' | 'exploration' | 'lks' | 'speed';
  label: string;
  shortLabel: string;
  score: number; // 0..100
  detail: string;
}

export interface StemRadarInput {
  profile: GamificationProfile;
  recordsCount: number;
  bestRSquared: number;
  lksGraded: boolean;
  latestLksScore: number;
  completedModulesCount: number;
  snapshotsCount: number;
}

/**
 * Pure helper to compute the 5 STEM Competency Radar axes (0 - 100 scale)
 * combining telemetry metrics & gamification achievements.
 */
export function computeStemRadarScores(input: StemRadarInput): StemRadarAxisScore[] {
  const {
    profile,
    recordsCount,
    bestRSquared,
    lksGraded,
    latestLksScore,
    completedModulesCount,
    snapshotsCount,
  } = input;

  // 1. Akurasi Regresi (R²) — jujur berdasarkan data riil (tanpa lantai inflasi)
  const hasPrecisionBadge = profile.unlockedBadges.includes('Precision Analyst');
  const rawR2Score =
    bestRSquared > 0
      ? Math.round(Math.min(1, bestRSquared) * 100)
      : hasPrecisionBadge
      ? 96
      : recordsCount > 0
      ? Math.min(70, recordsCount * 15)
      : 0;
  const regressionScore = Math.max(0, Math.min(100, rawR2Score));

  // 2. Kepatuhan K3 — berdasarkan verifikasi K3 aktual
  const hasK3Badge = profile.unlockedBadges.includes('K3 Guardian');
  const k3ActionsCount = profile.completedActionKeys.filter((k) => k.startsWith('k3:')).length;
  const k3Score = hasK3Badge
    ? Math.min(100, 88 + k3ActionsCount * 4)
    : Math.min(85, k3ActionsCount * 25 + (recordsCount > 0 ? 20 : 0));

  // 3. Eksplorasi Variabel — jujur dari jumlah observasi, snapshot, dan modul
  const explorationRaw =
    Math.min(55, recordsCount * 11) +
    Math.min(20, snapshotsCount * 10) +
    Math.min(25, completedModulesCount * 8);
  const explorationScore = Math.max(0, Math.min(100, explorationRaw));

  // 4. Ketuntasan LKS — skor kuis/LKS aktual
  const lksPerfectCount = profile.completedActionKeys.filter((k) =>
    k.startsWith('lks_perfect:')
  ).length;
  const lksScore =
    latestLksScore > 0
      ? Math.max(0, Math.min(100, latestLksScore))
      : lksGraded || lksPerfectCount > 0
      ? 90
      : Math.min(50, recordsCount * 10);

  // 5. Kecepatan Analisis — progres tahap & level aktual
  const inferredStep =
    recordsCount === 0 && !lksGraded && completedModulesCount === 0
      ? 0
      : resolveStudentStep({
          id: 'self',
          name: 'Praktikan',
          groupId: 'Kelompok A',
          activeDomain: 'Fisika',
          currentActivity: 'Praktikum',
          completionPct: lksGraded ? 95 : Math.min(90, recordsCount * 25),
          trialsRecorded: recordsCount,
          tasksCompleted: completedModulesCount,
          totalTasks: 4,
          quizScore: latestLksScore || undefined,
          lastActive: 'Baru saja',
          status: lksGraded ? 'Selesai' : 'Nominal',
        });
  const speedScore =
    inferredStep === 0 && profile.xp === 0
      ? 0
      : Math.max(0, Math.min(100, inferredStep * 20 + Math.min(20, Math.floor(profile.xp / 150) * 5)));

  return [
    {
      id: 'regression',
      label: 'Akurasi Regresi (R²)',
      shortLabel: 'Akurasi R²',
      score: regressionScore,
      detail:
        bestRSquared > 0
          ? `R² = ${bestRSquared.toFixed(3)}`
          : recordsCount === 0
          ? 'Belum ada data'
          : `${regressionScore}/100`,
    },
    {
      id: 'k3',
      label: 'Kepatuhan K3',
      shortLabel: 'Kepatuhan K3',
      score: k3Score,
      detail: hasK3Badge ? 'K3 Terverifikasi' : k3ActionsCount > 0 ? `${k3ActionsCount} Cek K3` : 'Belum dicek',
    },
    {
      id: 'exploration',
      label: 'Eksplorasi Variabel',
      shortLabel: 'Eksplorasi',
      score: explorationScore,
      detail: `${recordsCount} Data · ${snapshotsCount} Foto`,
    },
    {
      id: 'lks',
      label: 'Ketuntasan LKS',
      shortLabel: 'Ketuntasan LKS',
      score: lksScore,
      detail: lksScore > 0 ? `${lksScore}/100 Poin` : 'Belum dikumpulkan',
    },
    {
      id: 'speed',
      label: 'Kecepatan Analisis',
      shortLabel: 'Kecepatan',
      score: speedScore,
      detail: inferredStep > 0 ? `Tahap ${inferredStep}/4` : 'Belum mulai',
    },
  ];
}

function getBadgeIcon(badgeId: BadgeName) {
  switch (badgeId) {
    case 'K3 Guardian':
      return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    case 'Precision Analyst':
      return <TrendingUp className="w-5 h-5 text-sky-500" />;
    case 'Master Titrator':
      return <FlaskConical className="w-5 h-5 text-teal-500" />;
    case 'Kepler Navigator':
      return <Compass className="w-5 h-5 text-amber-500" />;
    case 'Bio Explorer':
      return <Dna className="w-5 h-5 text-rose-500" />;
    default:
      return <Award className="w-5 h-5 text-amber-500" />;
  }
}

export interface StudentPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentGroup: string;
  profile: GamificationProfile;
  records: ExperimentRecord[];
  snapshots: Lab3DSnapshot[];
  bestRSquared: number;
  lksGraded: boolean;
  latestLksScore: number;
  activeModuleTitle: string;
  onOpenBadgeCelebration?: () => void;
}

export const StudentPortfolioModal: React.FC<StudentPortfolioModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentGroup,
  profile,
  records,
  snapshots,
  bestRSquared,
  lksGraded,
  latestLksScore,
  activeModuleTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'history' | 'certificate'>('overview');
  const [gradeHistory, setGradeHistory] = useState<LabSubmission[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showAllClassSubmissions, setShowAllClassSubmissions] = useState(false);

  const fetchGradeHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await apiFetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.submissions)) {
          setGradeHistory(data.submissions);
        }
      }
    } catch {
      // Offline fallback: leave existing list
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      fetchGradeHistory();
    }
  }, [isOpen, activeTab]);

  const personalSubmissions = useMemo(() => {
    const query = studentName.trim().toLowerCase();
    if (!query) return gradeHistory;
    return gradeHistory.filter((s) => s.studentName.toLowerCase().includes(query));
  }, [gradeHistory, studentName]);

  const displayedSubmissions = showAllClassSubmissions ? gradeHistory : personalSubmissions;

  const levelInfo = useMemo(() => getLevelProgress(profile.xp), [profile.xp]);

  const completedModulesCount = useMemo(() => {
    const uniqueMods = new Set<string>();
    profile.completedActionKeys.forEach((key) => {
      const parts = key.split(':');
      if (parts[1]) uniqueMods.add(parts[1]);
    });
    records.forEach((r) => uniqueMods.add(r.experimentTitle));
    return uniqueMods.size;
  }, [profile.completedActionKeys, records]);

  const radarAxes = useMemo(
    () =>
      computeStemRadarScores({
        profile,
        recordsCount: records.length,
        bestRSquared,
        lksGraded,
        latestLksScore,
        completedModulesCount,
        snapshotsCount: snapshots.length,
      }),
    [
      profile,
      records.length,
      bestRSquared,
      lksGraded,
      latestLksScore,
      completedModulesCount,
      snapshots.length,
    ]
  );

  const overallStemIndex = useMemo(() => {
    const sum = radarAxes.reduce((acc, a) => acc + a.score, 0);
    return Math.round(sum / radarAxes.length);
  }, [radarAxes]);

  // Compute 5-axis SVG Radar geometry
  const radarGeometry = useMemo(() => {
    const cx = 140;
    const cy = 135;
    const maxRadius = 86;
    const levels = [0.25, 0.5, 0.75, 1.0];

    const pointAt = (idx: number, ratio: number) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / 5;
      return {
        x: Number((cx + Math.cos(angle) * maxRadius * ratio).toFixed(1)),
        y: Number((cy + Math.sin(angle) * maxRadius * ratio).toFixed(1)),
      };
    };

    const gridPolygons = levels.map((lvl) =>
      [0, 1, 2, 3, 4]
        .map((i) => {
          const p = pointAt(i, lvl);
          return `${p.x},${p.y}`;
        })
        .join(' ')
    );

    const dataVertices = radarAxes.map((axis, i) => {
      const ratio = Math.max(0.06, Math.min(1, axis.score / 100));
      const p = pointAt(i, ratio);
      const labelPos = pointAt(i, 1.24);
      const axisEnd = pointAt(i, 1.0);
      return {
        ...axis,
        x: p.x,
        y: p.y,
        labelX: labelPos.x,
        labelY: labelPos.y,
        axisEndX: axisEnd.x,
        axisEndY: axisEnd.y,
      };
    });

    const dataPolygonPoints = dataVertices.map((v) => `${v.x},${v.y}`).join(' ');

    return {
      cx,
      cy,
      gridPolygons,
      dataVertices,
      dataPolygonPoints,
    };
  }, [radarAxes]);

  const handlePrintCertificate = () => {
    labSound.playClick(720);
    setActiveTab('certificate');
    setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    }, 180);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-portfolio-modal-title"
          data-testid="student-portfolio-modal"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden"
          >
            {/* Modal Top Header */}
            <div className="px-5 py-4 border-b border-[var(--comfort-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--comfort-bg)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="student-portfolio-modal-title"
                    className="text-base sm:text-lg font-bold tracking-tight truncate"
                  >
                    Portofolio Sains & Radar Kompetensi STEM
                  </h2>
                  <p className="text-xs text-[var(--comfort-text-muted)] truncate">
                    Rekam jejak kemampuan eksperimental, kurva telemetri, dan sertifikasi praktikan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  data-testid="print-certificate-btn"
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Sertifikat Praktikum</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onClose();
                  }}
                  aria-label="Tutup Portofolio Siswa"
                  className="p-1.5 rounded-xl border border-[var(--comfort-border)] hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 pt-3 border-b border-[var(--comfort-border)] flex items-center gap-2 shrink-0 bg-[var(--comfort-surface)] overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'overview', label: 'Identitas & Radar STEM' },
                  { id: 'badges', label: `Lencana & Snapshot (${profile.unlockedBadges.length}/${SCIENTIFIC_BADGES_CATALOG.length})` },
                  { id: 'history', label: 'Riwayat Nilai & Umpan Balik Guru' },
                  { id: 'certificate', label: 'Sertifikat Praktikum' },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`portfolio-tab-${tab.id}`}
                    onClick={() => {
                      labSound.playClick();
                      setActiveTab(tab.id);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                        : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {activeTab === 'overview' && (
                <>
                  {/* 1. Kartu Identitas Praktikan */}
                  <div
                    data-testid="student-identity-card"
                    className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                  >
                    <div className="lg:col-span-7 flex items-start sm:items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white font-mono font-bold text-xl flex items-center justify-center shrink-0 shadow-sm">
                        {studentName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold tracking-tight">{studentName}</h3>
                          <span className="px-2 py-0.5 rounded-md text-2xs font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            {levelInfo.rankTitle}
                          </span>
                          <span className="text-xs text-[var(--comfort-text-muted)]">
                            · {studentGroup}
                          </span>
                        </div>

                        {/* XP Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Level {levelInfo.level} · {profile.xp} Total XP
                            </span>
                            <span className="text-[var(--comfort-text-muted)]">
                              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP ke Level{' '}
                              {levelInfo.level + 1}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-600 transition-all duration-300"
                              style={{ width: `${Math.max(8, levelInfo.progressPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary KPIs */}
                    <div className="lg:col-span-5 grid grid-cols-3 gap-2.5 text-center">
                      <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5">
                        <div className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                          {completedModulesCount}
                        </div>
                        <div className="text-2xs text-[var(--comfort-text-muted)]">
                          Modul Tuntas
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5">
                        <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {overallStemIndex}
                        </div>
                        <div className="text-2xs text-[var(--comfort-text-muted)]">
                          Indeks STEM
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5">
                        <div className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {profile.unlockedBadges.length}/{SCIENTIFIC_BADGES_CATALOG.length}
                        </div>
                        <div className="text-2xs text-[var(--comfort-text-muted)]">
                          Lencana Sains
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. 5-Axis SVG STEM Competency Radar Chart + Breakdown */}
                  <StemRadarChartSection radarGeometry={radarGeometry} radarAxes={radarAxes} />
                </>
              )}

              {activeTab === 'badges' && (
                <div className="space-y-5">
                  {/* Badges Grid (Unlocked vs Locked) */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] mb-3">
                      Koleksi Lencana Saintifik (Unlocked vs Terkunci)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {SCIENTIFIC_BADGES_CATALOG.map((badge) => {
                        const isUnlocked = profile.unlockedBadges.includes(badge.id);
                        const unlockedDate = profile.badgeUnlockTimestamps[badge.id];
                        return (
                          <div
                            key={badge.id}
                            data-testid={`portfolio-badge-${badge.id}`}
                            className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2 transition-all ${
                              isUnlocked
                                ? 'border-amber-500/40 bg-amber-500/5'
                                : 'border-[var(--comfort-border)] bg-[var(--comfort-bg)] opacity-65'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[var(--comfort-surface-subtle)] flex items-center justify-center shrink-0">
                                  {isUnlocked ? (
                                    getBadgeIcon(badge.id)
                                  ) : (
                                    <Lock className="w-4 h-4 text-[var(--comfort-text-muted)]" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-bold">{badge.title}</div>
                                  <div className="text-2xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                                    +{badge.xpBonus} XP · {badge.category}
                                  </div>
                                </div>
                              </div>
                              {isUnlocked && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            <p className="comfort-report-prose text-xs text-[var(--comfort-text-muted)]">
                              {badge.description}
                            </p>
                            <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
                              {isUnlocked
                                ? `Terbuka ${
                                    unlockedDate
                                      ? new Date(unlockedDate).toLocaleDateString('id-ID')
                                      : 'Sesi aktif'
                                  }`
                                : 'Belum terbuka — selesaikan misi terkait'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3D Snapshots Gallery */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] mb-3 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-sky-500" />
                      <span>Galeri Tangkapan Kanvas 3D ({snapshots.length})</span>
                    </h3>
                    {snapshots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--comfort-border)] p-6 text-center text-xs text-[var(--comfort-text-muted)]">
                        Belum ada tangkapan 3D. Tekan tombol <strong>Snapshot [S]</strong> pada meja
                        simulasi 3D untuk mendokumentasikan bukti eksperimen Anda.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {snapshots.map((snap) => (
                          <div
                            key={snap.id}
                            className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] overflow-hidden"
                          >
                            <img
                              src={snap.dataUrl}
                              alt={snap.moduleTitle}
                              className="w-full h-32 object-cover bg-[var(--comfort-surface-subtle)]"
                            />
                            <div className="p-2.5 space-y-0.5">
                              <div className="text-xs font-bold truncate">{snap.moduleTitle}</div>
                              <div className="text-2xs font-mono text-sky-600 dark:text-sky-400 truncate">
                                {snap.primaryMetric}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div data-testid="portfolio-grade-history-panel" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                        <span>Riwayat Nilai Laporan &amp; Umpan Balik Guru</span>
                      </h3>
                      <p className="text-xs text-[var(--comfort-text-muted)]">
                        Menampilkan laporan milik <strong className="text-[var(--comfort-text)]">{studentName}</strong>
                        {showAllClassSubmissions ? ' (dan seluruh laporan kelas)' : ''}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setShowAllClassSubmissions((prev) => !prev);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          showAllClassSubmissions
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-[var(--comfort-bg)] text-[var(--comfort-text)] border-[var(--comfort-border)] hover:border-sky-500/50'
                        }`}
                      >
                        {showAllClassSubmissions ? 'Hanya Milik Saya' : `Lihat Semua Kelas (${gradeHistory.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={fetchGradeHistory}
                        disabled={isLoadingHistory}
                        aria-label="Muat ulang riwayat nilai"
                        className="p-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {isLoadingHistory ? (
                    <div className="py-10 text-center text-xs text-[var(--comfort-text-muted)]">
                      Memuat riwayat laporan dan umpan balik guru...
                    </div>
                  ) : displayedSubmissions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-6 text-center space-y-2.5">
                      <p className="text-xs font-semibold text-[var(--comfort-text)]">
                        Belum ada laporan yang terkumpul atas nama &ldquo;{studentName}&rdquo;.
                      </p>
                      <p className="text-xs text-[var(--comfort-text-muted)]">
                        Selesaikan praktikum di Tahap 3 &amp; kirim laporan ke guru untuk melihat nilai rubrik dan komentar resmi di sini.
                      </p>
                      {gradeHistory.length > 0 && !showAllClassSubmissions && (
                        <button
                          type="button"
                          onClick={() => setShowAllClassSubmissions(true)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Lihat {gradeHistory.length} Laporan Kelas Lainnya
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedSubmissions.map((sub) => {
                        const finalScore = sub.teacherGrade?.score ?? sub.autoRubric?.score ?? sub.quizScore;
                        const isGraded = Boolean(sub.teacherGrade);
                        return (
                          <div
                            key={sub.id}
                            className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-4 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-bold text-[var(--comfort-text)]">
                                    {sub.moduleId}
                                  </span>
                                  <span className="text-[var(--comfort-text-muted)]">·</span>
                                  <span className="text-[var(--comfort-text-muted)]">{sub.domain}</span>
                                  <span className="text-[var(--comfort-text-muted)]">·</span>
                                  <span className="font-mono text-2xs text-[var(--comfort-text-muted)]">
                                    {sub.studentName}
                                  </span>
                                </div>
                                <div className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                                  Tiket {sub.id} ·{' '}
                                  {Number.isFinite(Date.parse(sub.submittedAt))
                                    ? new Date(sub.submittedAt).toLocaleString('id-ID')
                                    : sub.submittedAt}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold tabular-nums border ${
                                    finalScore >= 75
                                      ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-amber-500/12 border-amber-500/35 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  Skor {finalScore}/100
                                </span>
                                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                                  {isGraded ? 'Dinilai Guru' : 'Rubrik Otomatis'}
                                </span>
                              </div>
                            </div>

                            {sub.teacherGrade?.feedback ? (
                              <div className="p-3 rounded-lg bg-sky-500/8 border border-sky-500/25 text-[var(--comfort-text)] space-y-1">
                                <div className="text-2xs font-mono uppercase tracking-wider font-bold text-sky-700 dark:text-sky-300">
                                  Umpan Balik Guru
                                </div>
                                <p className="comfort-report-prose">{sub.teacherGrade.feedback}</p>
                              </div>
                            ) : sub.autoRubric?.summaryFeedback ? (
                              <div className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)]">
                                <p className="comfort-report-prose">{sub.autoRubric.summaryFeedback}</p>
                              </div>
                            ) : null}

                            {sub.regressionMetrics && (
                              <div className="flex flex-wrap items-center gap-3 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums pt-1 border-t border-[var(--comfort-border)]">
                                <span>R² = {Number(sub.regressionMetrics.rSquared ?? 0).toFixed(3)}</span>
                                <span>·</span>
                                <span>Persamaan: {sub.regressionMetrics.equation || '-'}</span>
                                <span>·</span>
                                <span>Kuis LKS: {sub.quizScore}/100</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'certificate' && (
                <div
                  data-testid="printable-certificate-card"
                  className="rounded-2xl border-2 border-amber-500/50 bg-[var(--comfort-bg)] p-6 sm:p-8 text-center space-y-4"
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold">
                    <Award className="w-3.5 h-3.5" />
                    <span>SERTIFIKAT KOMPETENSI LABORATORIUM VIRTUAL RUANGLABMU</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-[var(--comfort-text-muted)]">
                      Diberikan Kepada Praktikan:
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--comfort-text)]">
                      {studentName}
                    </h3>
                    <p className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold">
                      Pangkat: {levelInfo.rankTitle} (Level {levelInfo.level} · {profile.xp} XP)
                    </p>
                  </div>

                  <p className="comfort-report-prose text-sm text-[var(--comfort-text-muted)] max-w-xl mx-auto">
                    Telah menyelesaikan rangkaian eksperimen metode ilmiah, analisis regresi linier
                    kuadrat terkecil (OLS), dan evaluasi K3 pada modul{' '}
                    <strong className="text-[var(--comfort-text)]">{activeModuleTitle}</strong> dengan Indeks Kompetensi STEM{' '}
                    <strong className="font-mono text-[var(--comfort-text)]">{overallStemIndex}/100</strong>.
                  </p>

                  <div className="pt-4 grid grid-cols-3 gap-4 max-w-lg mx-auto border-t border-[var(--comfort-border)] text-xs">
                    <div>
                      <div className="text-[var(--comfort-text-muted)] text-2xs uppercase">Presisi Regresi</div>
                      <div className="font-mono font-bold">
                        {bestRSquared > 0 ? `R² = ${bestRSquared.toFixed(3)}` : 'Terverifikasi'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--comfort-text-muted)] text-2xs uppercase">Lencana Saintifik</div>
                      <div className="font-mono font-bold tabular-nums">
                        {profile.unlockedBadges.length} Lencana
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--comfort-text-muted)] text-2xs uppercase">Tanggal Terbit</div>
                      <div className="font-mono font-bold tabular-nums">
                        {new Date().toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StudentPortfolioModal;
