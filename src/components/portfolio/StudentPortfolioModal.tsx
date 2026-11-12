import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trophy,
  Award,
  ShieldCheck,
  Sparkles,
  Camera,
  Printer,
  Lock,
  CheckCircle2,
  TrendingUp,
  Compass,
  FlaskConical,
  Dna,
} from 'lucide-react';
import {
  GamificationProfile,
  SCIENTIFIC_BADGES_CATALOG,
  getLevelProgress,
  BadgeName,
} from '../../services/gamificationEngine';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import { resolveStudentStep } from '../../utils/telemetryRadar';
import { labSound } from '../../utils/soundEngine';

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

  // 1. Akurasi Regresi (R²)
  const hasPrecisionBadge = profile.unlockedBadges.includes('Precision Analyst');
  const rawR2Score =
    bestRSquared > 0
      ? Math.round(Math.min(1, bestRSquared) * 100)
      : hasPrecisionBadge
      ? 96
      : Math.min(85, 50 + recordsCount * 10);
  const regressionScore = Math.max(35, Math.min(100, rawR2Score));

  // 2. Kepatuhan K3
  const hasK3Badge = profile.unlockedBadges.includes('K3 Guardian');
  const k3ActionsCount = profile.completedActionKeys.filter((k) => k.startsWith('k3:')).length;
  const k3Score = hasK3Badge
    ? Math.min(100, 88 + k3ActionsCount * 4)
    : Math.max(45, 55 + k3ActionsCount * 15);

  // 3. Eksplorasi Variabel
  const explorationRaw =
    40 +
    Math.min(35, recordsCount * 9) +
    Math.min(15, snapshotsCount * 5) +
    Math.min(10, completedModulesCount * 5);
  const explorationScore = Math.max(35, Math.min(100, explorationRaw));

  // 4. Ketuntasan LKS
  const lksPerfectCount = profile.completedActionKeys.filter((k) =>
    k.startsWith('lks_perfect:')
  ).length;
  const lksScore =
    latestLksScore > 0
      ? Math.max(50, Math.min(100, latestLksScore))
      : lksGraded || lksPerfectCount > 0
      ? 95
      : Math.max(40, Math.min(85, 45 + recordsCount * 12));

  // 5. Kecepatan Analisis (derived via telemetryRadar step progression & XP history)
  const inferredStep = resolveStudentStep({
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
  const speedScore = Math.max(
    45,
    Math.min(100, 45 + inferredStep * 12 + Math.min(15, profile.level * 3))
  );

  return [
    {
      id: 'regression',
      label: 'Akurasi Regresi (R²)',
      shortLabel: 'Akurasi R²',
      score: regressionScore,
      detail: bestRSquared > 0 ? `R² = ${bestRSquared.toFixed(3)}` : `${regressionScore}/100`,
    },
    {
      id: 'k3',
      label: 'Kepatuhan K3',
      shortLabel: 'Kepatuhan K3',
      score: k3Score,
      detail: hasK3Badge ? 'K3 Terverifikasi' : 'Standar Lab',
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
      detail: `${lksScore}/100 Poin`,
    },
    {
      id: 'speed',
      label: 'Kecepatan Analisis',
      shortLabel: 'Kecepatan',
      score: speedScore,
      detail: `Tahap ${inferredStep}/4`,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'certificate'>('overview');

  const levelInfo = useMemo(() => getLevelProgress(profile.xp), [profile.xp]);

  const completedModulesCount = useMemo(() => {
    const uniqueMods = new Set<string>();
    profile.completedActionKeys.forEach((key) => {
      const parts = key.split(':');
      if (parts[1]) uniqueMods.add(parts[1]);
    });
    records.forEach((r) => uniqueMods.add(r.experimentTitle));
    return Math.max(1, uniqueMods.size);
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
      const ratio = Math.max(0.15, Math.min(1, axis.score / 100));
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
                  <span>🎓 Cetak Sertifikat Praktikum</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onClose();
                  }}
                  aria-label="Tutup Portofolio Siswa"
                  className="p-1.5 rounded-xl border border-[var(--comfort-border)] hover:bg-stone-200/60 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 pt-3 border-b border-[var(--comfort-border)] flex items-center gap-2 shrink-0 bg-[var(--comfort-surface)]">
              {(
                [
                  { id: 'overview', label: 'Identitas & Radar STEM (5 Sumbu)' },
                  { id: 'badges', label: `Koleksi Lencana & Snapshot (${profile.unlockedBadges.length}/${SCIENTIFIC_BADGES_CATALOG.length})` },
                  { id: 'certificate', label: 'Pratinjau Sertifikat Praktikum' },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setActiveTab(tab.id);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
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
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            {levelInfo.rankTitle}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · {studentGroup}
                          </span>
                        </div>

                        {/* XP Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Level {levelInfo.level} · {profile.xp} Total XP
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP ke Level{' '}
                              {levelInfo.level + 1}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-sky-500 transition-all duration-300"
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
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Modul Tuntas
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5">
                        <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {overallStemIndex}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Indeks STEM
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5">
                        <div className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {profile.unlockedBadges.length}/{SCIENTIFIC_BADGES_CATALOG.length}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Lencana Sains
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. 5-Axis SVG STEM Competency Radar Chart + Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    {/* Left: SVG Polygon Radar */}
                    <div className="lg:col-span-6 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-4 flex flex-col items-center justify-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Peta Kompetensi Praktikum (5 Dimensi)
                      </div>
                      <svg
                        viewBox="0 0 280 265"
                        className="w-full max-w-[300px] h-auto overflow-visible"
                        data-testid="stem-competency-radar-svg"
                        role="img"
                        aria-label="Grafik Radar 5 Kompetensi STEM"
                      >
                        {/* Concentric Web Polygons */}
                        {radarGeometry.gridPolygons.map((pts, idx) => (
                          <polygon
                            key={idx}
                            points={pts}
                            fill="none"
                            stroke="currentColor"
                            className="text-slate-300 dark:text-slate-700"
                            strokeWidth={idx === 3 ? 1.2 : 0.75}
                            strokeDasharray={idx < 3 ? '2 2' : undefined}
                          />
                        ))}

                        {/* Axis Spokes */}
                        {radarGeometry.dataVertices.map((v) => (
                          <line
                            key={v.id}
                            x1={radarGeometry.cx}
                            y1={radarGeometry.cy}
                            x2={v.axisEndX}
                            y2={v.axisEndY}
                            stroke="currentColor"
                            className="text-slate-300 dark:text-slate-700"
                            strokeWidth={0.9}
                          />
                        ))}

                        {/* Student Score Polygon */}
                        <polygon
                          points={radarGeometry.dataPolygonPoints}
                          fill="rgba(14, 165, 233, 0.24)"
                          stroke="#0284c7"
                          strokeWidth={2.2}
                        />

                        {/* Vertex Dots & Axis Labels */}
                        {radarGeometry.dataVertices.map((v) => (
                          <g key={v.id}>
                            <circle
                              cx={v.x}
                              cy={v.y}
                              r={4}
                              className="fill-sky-500 stroke-white dark:stroke-slate-900"
                              strokeWidth={1.5}
                            />
                            <text
                              x={v.labelX}
                              y={v.labelY}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="fill-slate-700 dark:fill-slate-200 text-[9.5px] font-bold"
                            >
                              {v.shortLabel} ({v.score})
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    {/* Right: 5-Axis Detailed Metric Bars */}
                    <div className="lg:col-span-6 space-y-3">
                      {radarAxes.map((axis) => (
                        <div
                          key={axis.id}
                          className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold">{axis.label}</span>
                            <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                              {axis.score}/100 · <span className="text-slate-500 font-normal">{axis.detail}</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-600 transition-all duration-300"
                              style={{ width: `${axis.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'badges' && (
                <div className="space-y-5">
                  {/* Badges Grid (Unlocked vs Locked) */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
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
                                <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  {isUnlocked ? (
                                    getBadgeIcon(badge.id)
                                  ) : (
                                    <Lock className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-bold">{badge.title}</div>
                                  <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                                    +{badge.xpBonus} XP · {badge.category}
                                  </div>
                                </div>
                              </div>
                              {isUnlocked && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {badge.description}
                            </p>
                            <div className="text-[10px] font-mono text-slate-400">
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-sky-500" />
                      <span>Galeri Tangkapan Kanvas 3D ({snapshots.length})</span>
                    </h3>
                    {snapshots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--comfort-border)] p-6 text-center text-xs text-slate-500">
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
                              className="w-full h-32 object-cover bg-slate-950"
                            />
                            <div className="p-2.5 space-y-0.5">
                              <div className="text-xs font-bold truncate">{snap.moduleTitle}</div>
                              <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 truncate">
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

              {activeTab === 'certificate' && (
                <div
                  data-testid="printable-certificate-card"
                  className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/5 via-transparent to-sky-500/5 p-6 sm:p-8 text-center space-y-4"
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs font-mono font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>SERTIFIKAT KOMPETENSI LABORATORIUM VIRTUAL RUANGLABMU</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      Diberikan Kepada Praktikan:
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {studentName}
                    </h3>
                    <p className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold">
                      Pangkat: {levelInfo.rankTitle} (Level {levelInfo.level} · {profile.xp} XP)
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
                    Telah menyelesaikan rangkaian eksperimen metode ilmiah, analisis regresi linier
                    kuadrat terkecil (OLS), dan evaluasi K3 pada modul{' '}
                    <strong>{activeModuleTitle}</strong> dengan Indeks Kompetensi STEM{' '}
                    <strong className="font-mono">{overallStemIndex}/100</strong>.
                  </p>

                  <div className="pt-4 grid grid-cols-3 gap-4 max-w-lg mx-auto border-t border-[var(--comfort-border)] text-xs">
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">Presisi Regresi</div>
                      <div className="font-mono font-bold">
                        {bestRSquared > 0 ? `R² = ${bestRSquared.toFixed(3)}` : 'Terverifikasi'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">Lencana Saintifik</div>
                      <div className="font-mono font-bold">
                        {profile.unlockedBadges.length} Lencana
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase">Tanggal Terbit</div>
                      <div className="font-mono font-bold">
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
