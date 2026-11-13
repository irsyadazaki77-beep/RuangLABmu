import React, { useState } from 'react';
import {
  Camera,
  Trophy,
  Award,
  Target,
  Sparkles,
  GitCompareArrows,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Eye,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import { ScienceDomain, ExperimentRecord } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { StudentProgressItem } from '../TeacherDashboardView';

// ============================================================================
// 1. 3D SNAPSHOT & VISUAL EVIDENCE TYPES
// ============================================================================
export interface Lab3DSnapshot {
  id: string;
  timestamp: string;
  domain: ScienceDomain;
  moduleTitle: string;
  paramsSummary?: string;
  parametersSummary?: string;
  primaryMetric: string;
  dataUrl: string;
}

// ============================================================================
// 2. AUTOMATIC TARGET CHALLENGE GENERATOR
// ============================================================================
export interface TargetChallengeMission {
  id: string;
  domain: ScienceDomain;
  mode: string;
  title: string;
  instruction: string;
  metricKey: string;
  metricLabel: string;
  targetValue: number;
  tolerance: number;
  unit: string;
  hint: string;
  rewardPoints: number;
  points?: number;
}

const CHALLENGE_POOL: TargetChallengeMission[] = [
  // FISIKA
  {
    id: 'chal-phys-newton-1',
    domain: 'Fisika',
    mode: 'newton-incline',
    title: 'Target Percepatan Bidang Miring',
    instruction: 'Atur Gaya Dorong (F), Massa (m), atau Sudut (θ) agar percepatan balok mencapai tepat 5.00 m/s² (±0.35 m/s²).',
    metricKey: 'acceleration',
    metricLabel: 'Percepatan (a)',
    targetValue: 5.0,
    tolerance: 0.35,
    unit: 'm/s²',
    hint: 'Gunakan Hukum II Newton: a = (F - m·g·sin θ - fk) / m.',
    rewardPoints: 150,
  },
  {
    id: 'chal-phys-newton-2',
    domain: 'Fisika',
    mode: 'newton-incline',
    title: 'Keseimbangan Statis Presisi',
    instruction: 'Sesuaikan Gaya Dorong (F) dan Sudut Kemiringan agar balok berada tepat di kondisi seimbang atau percepatan mendekati 2.50 m/s² (±0.30 m/s²).',
    metricKey: 'acceleration',
    metricLabel: 'Percepatan (a)',
    targetValue: 2.5,
    tolerance: 0.3,
    unit: 'm/s²',
    hint: 'Kurangi gaya dorong F atau naikkan massa balok m.',
    rewardPoints: 150,
  },
  {
    id: 'chal-phys-proj-1',
    domain: 'Fisika',
    mode: 'projectile-gravity',
    title: 'Akurasi Pendaratan Projektil 40 Meter',
    instruction: 'Atur Kecepatan Awal (v₀) dan Sudut Elevasi (θ) agar projektil mendarat pada jarak horizontal R = 40.0 m (±2.0 m).',
    metricKey: 'projectileRange',
    metricLabel: 'Jarak Jangkauan (R)',
    targetValue: 40.0,
    tolerance: 2.0,
    unit: 'm',
    hint: 'Ingat rumus jangkauan R = (v₀² · sin 2θ) / g. Sudut 45° menghasilkan jangkauan maksimum.',
    rewardPoints: 175,
  },
  {
    id: 'chal-phys-spring-1',
    domain: 'Fisika',
    mode: 'spring-hooke',
    title: 'Penyimpanan Energi Potensial Pegas',
    instruction: 'Atur Konstanta Pegas (k) dan Simpangan (x) untuk menghasilkan Energi Potensial Elastis sebesar 25.0 J (±2.0 J).',
    metricKey: 'springPotentialEnergy',
    metricLabel: 'Energi Potensial (Ep)',
    targetValue: 25.0,
    tolerance: 2.0,
    unit: 'J',
    hint: 'Gunakan persamaan Ep = ½ · k · x².',
    rewardPoints: 160,
  },
  // KIMIA
  {
    id: 'chal-chem-thermo-1',
    domain: 'Kimia',
    mode: 'thermo-calorimetry',
    title: 'Target Suhu Akhir Kalorimeter 40°C',
    instruction: 'Sesuaikan Suhu Awal (T₀), Konsentrasi Reaktan, dan Volume Larutan agar suhu akhir mencapai 40.0 °C (±1.5 °C).',
    metricKey: 'finalTempC',
    metricLabel: 'Suhu Akhir (T_akhir)',
    targetValue: 40.0,
    tolerance: 1.5,
    unit: '°C',
    hint: 'Kenaikan suhu ΔT bergantung pada mol reaktan dan kapasitas kalor larutan.',
    rewardPoints: 160,
  },
  {
    id: 'chal-chem-titr-1',
    domain: 'Kimia',
    mode: 'acid-base-titration',
    title: 'Titik Ekuivalen Netralisasi pH 7.00',
    instruction: 'Teteskan Volume Titran NaOH (Vb) secara presisi hingga pH larutan berada di sekitar titik netral 7.00 (±0.45).',
    metricKey: 'currentPh',
    metricLabel: 'pH Larutan',
    targetValue: 7.0,
    tolerance: 0.45,
    unit: '',
    hint: 'Titik ekuivalen tercapai saat M_asam · V_asam = M_basa · V_basa.',
    rewardPoints: 200,
  },
  {
    id: 'chal-chem-redox-1',
    domain: 'Kimia',
    mode: 'electrochemistry-cell',
    title: 'Optimasi Tegangan Sel Galvani 1.12 V',
    instruction: 'Atur rasio konsentrasi ion [Anoda] dan [Katoda] sesuai Persamaan Nernst untuk memperoleh E_sel = 1.12 V (±0.02 V).',
    metricKey: 'nernstCellPotentialE',
    metricLabel: 'Potensial Sel (E_sel)',
    targetValue: 1.12,
    tolerance: 0.02,
    unit: 'V',
    hint: 'Perkecil konsentrasi ion di anoda atau perbesar konsentrasi ion di katoda.',
    rewardPoints: 180,
  },
  // BIOLOGI
  {
    id: 'chal-bio-photo-1',
    domain: 'Biologi',
    mode: 'photosynthesis-ingenhousz',
    title: 'Produksi Oksigen Optimal Hydrilla',
    instruction: 'Kombinasikan Intensitas Cahaya, Suhu Air, dan Panjang Gelombang untuk mencapai laju 45 gelembung/menit (±4 gelembung/mnt).',
    metricKey: 'o2BubbleRate',
    metricLabel: 'Laju Gelembung O₂',
    targetValue: 45,
    tolerance: 4,
    unit: 'gelembung/mnt',
    hint: 'Klorofil menyerap optimal pada spektrum biru (~450 nm) atau merah (~660 nm) dengan suhu ~28–32°C.',
    rewardPoints: 160,
  },
  // ASTRONOMI
  {
    id: 'chal-astro-kepler-1',
    domain: 'Astronomi',
    mode: 'solar-kepler',
    title: 'Sinkronisasi Orbit Periode 2.80 Tahun',
    instruction: 'Atur Sumbu Semi-Mayor (a) dan Massa Bintang Pusat (M*) agar periode orbit planet menjadi 2.80 tahun (±0.20 thn).',
    metricKey: 'orbitalPeriodYears',
    metricLabel: 'Periode Orbit (T)',
    targetValue: 2.8,
    tolerance: 0.2,
    unit: 'tahun',
    hint: 'Hukum III Kepler: T = √(a³ / M*). Untuk M* = 1 M☉, coba a ≈ 2.0 AU.',
    rewardPoints: 170,
  },
  {
    id: 'chal-astro-mw-1',
    domain: 'Astronomi',
    mode: 'milkyway-galaxy',
    title: 'Kecepatan Orbit Bima Sakti 225 km/s',
    instruction: 'Sesuaikan Radius Galaktosentris (R) dan Fraksi Halo Materi Gelap agar kecepatan rotasi mencapai 225 km/s (±8 km/s).',
    metricKey: 'observedDarkMatterVelocityKms',
    metricLabel: 'Kecepatan Rotasi (v)',
    targetValue: 225,
    tolerance: 8,
    unit: 'km/s',
    hint: 'Pada sekitar R = 8.2 kpc dengan fraksi materi gelap 1.0x, kecepatan rotasi mendekati orbit Matahari.',
    rewardPoints: 175,
  },
];

export function pickChallengeForContext(
  domain: ScienceDomain,
  mode: string,
  previousId?: string
): TargetChallengeMission {
  const exactMatches = CHALLENGE_POOL.filter(
    (c) => c.domain === domain && (c.mode === mode || mode.includes(c.mode.split('-')[0]))
  );
  const domainMatches = CHALLENGE_POOL.filter((c) => c.domain === domain);
  const pool = exactMatches.length > 0 ? exactMatches : domainMatches.length > 0 ? domainMatches : CHALLENGE_POOL;
  const filtered = pool.filter((c) => c.id !== previousId);
  const candidates = filtered.length > 0 ? filtered : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ============================================================================
// 3. QUICK CHALLENGE MISSION BANNER (IN-COCKPIT)
// ============================================================================
interface QuickChallengeMissionBannerProps {
  domain: ScienceDomain;
  mode: string;
  liveMetrics?: Record<string, number>;
  completedIds?: string[];
  currentMetricValue?: number;
  currentMetricLabel?: string;
  unit?: string;
  completedChallengeIds?: string[];
  onCompleteChallenge: (challenge: TargetChallengeMission) => void;
}

export const QuickChallengeMissionBanner: React.FC<QuickChallengeMissionBannerProps> = ({
  domain,
  mode,
  liveMetrics,
  completedIds,
  currentMetricValue,
  currentMetricLabel,
  unit,
  completedChallengeIds,
  onCompleteChallenge,
}) => {
  const [activeChallenge, setActiveChallenge] = useState<TargetChallengeMission | null>(null);
  const [justSolved, setJustSolved] = useState<boolean>(false);

  const resolvedCompletedIds = completedIds ?? completedChallengeIds ?? [];

  const handleStartNewChallenge = () => {
    labSound.playClick();
    const base = pickChallengeForContext(domain, mode, activeChallenge?.id);
    const adapted: TargetChallengeMission = {
      ...base,
      id: `${base.id}-${Date.now().toString().slice(-3)}`,
      metricLabel: currentMetricLabel || base.metricLabel,
      unit: unit || base.unit,
      points: base.points ?? base.rewardPoints,
    };
    setActiveChallenge(adapted);
    setJustSolved(false);
  };

  if (!activeChallenge) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Tantangan Kilat Laboratorium ({resolvedCompletedIds.length} Selesai)
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
              Uji ketelitian Anda mencapai target metrik tertentu di ruang 3D
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleStartNewChallenge}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Buat Tantangan</span>
        </button>
      </div>
    );
  }

  const resolvedValue =
    liveMetrics?.[activeChallenge.metricKey] ??
    (liveMetrics ? Object.values(liveMetrics)[0] : undefined) ??
    currentMetricValue ??
    0;
  const diff = Math.abs(resolvedValue - activeChallenge.targetValue);
  const isWithinTarget = diff <= activeChallenge.tolerance;
  const proximityPct = Math.max(
    0,
    Math.min(100, Math.round((1 - diff / Math.max(activeChallenge.targetValue * 0.8, 5)) * 100))
  );

  const handleClaimChallenge = () => {
    if (!isWithinTarget || justSolved) return;
    labSound.playRecordSuccess();
    setJustSolved(true);
    onCompleteChallenge({
      ...activeChallenge,
      points: activeChallenge.points ?? activeChallenge.rewardPoints,
    });
  };

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
        isWithinTarget
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : 'border-amber-500/40 bg-amber-500/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span>MISI TANTANGAN KILAT · +{activeChallenge.rewardPoints} POIN</span>
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            {activeChallenge.title}
          </h4>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleStartNewChallenge}
            title="Acak tantangan baru"
            className="p-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveChallenge(null)}
            className="px-2 py-1 rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-300 text-[10px] font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
        {activeChallenge.instruction}
      </p>

      {/* Live Target Meter */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
          <span className="text-slate-400">
            Saat Ini ({activeChallenge.metricLabel}):{' '}
            <strong className="text-white">
              {resolvedValue.toFixed(2)} {activeChallenge.unit}
            </strong>
          </span>
          <span className="text-amber-400 font-bold">
            Target: {activeChallenge.targetValue.toFixed(2)} ± {activeChallenge.tolerance}{' '}
            {activeChallenge.unit}
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              isWithinTarget ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            style={{ width: `${isWithinTarget ? 100 : proximityPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400 italic truncate pr-2">
            Petunjuk: {activeChallenge.hint}
          </span>

          {isWithinTarget ? (
            <button
              type="button"
              disabled={justSolved}
              onClick={handleClaimChallenge}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer ${
                justSolved
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{justSolved ? 'Tantangan Terverifikasi!' : 'Verifikasi Target (+Poin)'}</span>
            </button>
          ) : (
            <span className="text-[10px] font-mono text-amber-400 shrink-0">
              Selisih: {diff.toFixed(2)} {activeChallenge.unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. LIVE A/B RUN BASELINE COMPARISON WIDGET
// ============================================================================
export interface ABMetricItem {
  key?: string;
  label: string;
  value: number;
  unit: string;
}

interface ABLiveComparisonWidgetProps {
  domainLabel: string;
  currentParamsSummary?: string;
  currentSummary?: string;
  currentParams?: Record<string, number>;
  currentMetrics?: ABMetricItem[];
  liveMetrics?: ABMetricItem[];
  onRestoreBaseline?: () => void;
  onRestoreBaselineParams?: (baseParams: Record<string, number>) => void;
  onPinBaselineCustom?: () => void;
}

export const ABLiveComparisonWidget: React.FC<ABLiveComparisonWidgetProps> = ({
  domainLabel,
  currentParamsSummary,
  currentSummary,
  currentParams,
  currentMetrics,
  liveMetrics,
  onRestoreBaseline,
  onRestoreBaselineParams,
  onPinBaselineCustom,
}) => {
  const resolvedSummary = currentSummary ?? currentParamsSummary ?? '';
  const resolvedMetrics = liveMetrics ?? currentMetrics ?? [];

  const [baseline, setBaseline] = useState<{
    timestamp: string;
    paramsSummary: string;
    params?: Record<string, number>;
    metrics: ABMetricItem[];
  } | null>(null);

  const handlePinCurrentAsBaseline = () => {
    labSound.playClick();
    setBaseline({
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      paramsSummary: resolvedSummary,
      params: currentParams ? { ...currentParams } : undefined,
      metrics: resolvedMetrics.map((m) => ({ ...m })),
    });
    if (onPinBaselineCustom) onPinBaselineCustom();
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompareArrows className="w-4 h-4 text-sky-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Simulasi Komparasi A/B ({domainLabel})
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Sematkan Percobaan A (Acuan) untuk melihat delta perubahan Percobaan B secara langsung
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePinCurrentAsBaseline}
          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] transition-colors shrink-0 cursor-pointer"
        >
          {baseline ? 'Perbarui Acuan (Run A)' : 'Sematkan Acuan (Run A)'}
        </button>
      </div>

      {!baseline ? (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg p-3 text-center">
          Belum ada Percobaan A yang dikunci. Klik <strong>Sematkan Acuan (Run A)</strong> lalu ubah slider parameter untuk membandingkan hasilnya secara berdampingan.
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 truncate">
              <div className="font-bold">RUN A (Acuan · {baseline.timestamp})</div>
              <div className="truncate text-[10px] opacity-90">{baseline.paramsSummary}</div>
            </div>
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-300 truncate">
              <div className="font-bold">RUN B (Simulasi Aktif)</div>
              <div className="truncate text-[10px] opacity-90">{resolvedSummary}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-1.5 pr-2">Besaran Ukur</th>
                  <th className="py-1.5 px-2 text-amber-600 dark:text-amber-400">Run A</th>
                  <th className="py-1.5 px-2 text-sky-600 dark:text-sky-400">Run B</th>
                  <th className="py-1.5 pl-2 text-right">Selisih (Δ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/70">
                {resolvedMetrics.map((cur, idx) => {
                  const baseItem = baseline.metrics[idx] || cur;
                  const delta = cur.value - baseItem.value;
                  const pct =
                    Math.abs(baseItem.value) > 1e-6
                      ? ((delta / Math.abs(baseItem.value)) * 100).toFixed(1)
                      : '0.0';
                  const isPositive = delta > 0.001;
                  const isNegative = delta < -0.001;
                  return (
                    <tr key={cur.key || cur.label}>
                      <td className="py-1.5 pr-2 font-sans font-medium text-slate-700 dark:text-slate-200">
                        {cur.label}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600 dark:text-slate-300">
                        {baseItem.value.toFixed(2)} {cur.unit}
                      </td>
                      <td className="py-1.5 px-2 font-bold text-slate-900 dark:text-white">
                        {cur.value.toFixed(2)} {cur.unit}
                      </td>
                      <td
                        className={`py-1.5 pl-2 text-right font-bold ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNegative
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {delta >= 0 ? '+' : ''}
                        {delta.toFixed(2)} ({delta >= 0 ? '+' : ''}
                        {pct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {(onRestoreBaseline || (onRestoreBaselineParams && baseline.params)) && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  if (onRestoreBaseline) onRestoreBaseline();
                  if (onRestoreBaselineParams && baseline.params) {
                    onRestoreBaselineParams(baseline.params);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Pulihkan Parameter Run A</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setBaseline(null)}
              className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-rose-500 text-[11px] font-medium cursor-pointer"
            >
              Reset A/B
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. 3D CANVAS TELEMETRY HUD & SNAPSHOT CAPTURE BAR
// ============================================================================
interface Scene3DTelemetryHUDProps {
  domainTitle: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  energyBarLabel?: string;
  energyBarRatio?: number; // 0 to 100
  isOrbiting?: boolean;
  onToggleOrbit?: () => void;
  onCaptureSnapshot?: () => void;
  snapshotCount?: number;
}

export const Scene3DTelemetryHUD: React.FC<Scene3DTelemetryHUDProps> = ({
  domainTitle,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  energyBarLabel = 'Rasio Energi / Keseimbangan Sistem',
  energyBarRatio = 62,
  isOrbiting = false,
  onToggleOrbit,
  onCaptureSnapshot,
  snapshotCount = 0,
}) => {
  const [flash, setFlash] = useState(false);

  const handleSnap = () => {
    if (!onCaptureSnapshot) return;
    labSound.playRecordSuccess();
    setFlash(true);
    onCaptureSnapshot();
    setTimeout(() => setFlash(false), 450);
  };

  return (
    <>
      {flash && (
        <div className="pointer-events-none absolute inset-0 bg-white/60 z-40 transition-opacity duration-300" />
      )}

      {/* Top-Left Live 3D Telemetry Readout HUD (WebGL-safe solid dark surface) */}
      <div className="pointer-events-auto absolute top-4 left-4 z-20 hidden sm:flex flex-col gap-1.5 rounded-xl bg-slate-950/90 border border-slate-700/80 px-3.5 py-2.5 shadow-xl min-w-[215px]">
        <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-sky-400 font-semibold">
          <span>HUD TELEMETRI 3D · {domainTitle.toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-0.5">
          <div>
            <div className="text-[10px] text-slate-400 truncate">{primaryLabel}</div>
            <div className="text-xs font-mono font-bold text-white tabular-nums">
              {primaryValue}
            </div>
          </div>
          <div className="border-l border-slate-800 pl-2.5">
            <div className="text-[10px] text-slate-400 truncate">{secondaryLabel}</div>
            <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
              {secondaryValue}
            </div>
          </div>
        </div>

        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span>{energyBarLabel}</span>
            <span className="tabular-nums text-sky-300">
              {Math.max(0, Math.min(100, Math.round(energyBarRatio)))}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
            <div
              className="h-full bg-sky-400 transition-all duration-200"
              style={{ width: `${Math.max(5, Math.min(95, energyBarRatio))}%` }}
            />
            <div className="h-full flex-1 bg-amber-500/80" />
          </div>
        </div>
      </div>

      {/* Bottom-Left 3D Snapshot & Cinematic Orbit Controls */}
      <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-2">
        {onCaptureSnapshot && (
          <button
            type="button"
            onClick={handleSnap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-sky-950 border border-sky-500/40 text-xs font-mono font-semibold text-sky-200 hover:text-white shadow-xl transition-colors cursor-pointer"
            title="Tangkap layar kanvas 3D untuk dilampirkan ke Laporan Akademik A4"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span>Ambil Foto 3D</span>
            {snapshotCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] tabular-nums">
                {snapshotCount}
              </span>
            )}
          </button>
        )}

        {onToggleOrbit && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onToggleOrbit();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold shadow-xl transition-colors cursor-pointer ${
              isOrbiting
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-950/90 hover:bg-slate-900 border-slate-700/80 text-slate-200'
            }`}
            title="Putar kamera sinematik mengelilingi aparatus 3D secara mulus"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isOrbiting ? 'Orbit Aktif' : 'Orbit Sinematik'}
            </span>
          </button>
        )}
      </div>
    </>
  );
};

// ============================================================================
// 6. STUDENT ACHIEVEMENT BADGES & CLASS LEADERBOARD
// ============================================================================
export interface ScientificBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  points: number;
  category: 'k3' | 'data' | 'regresi' | 'visual' | 'tantangan';
}

export function computeStudentBadges(params: {
  completedSafetyCount: number;
  recordsCount: number;
  lksGraded: boolean;
  snapshotsCount: number;
  challengesSolvedCount: number;
}): ScientificBadge[] {
  return [
    {
      id: 'badge-k3',
      title: 'Pelopor K3 & Hipotesis',
      description: 'Menyelesaikan verifikasi APD K3 dan merumuskan hipotesis awal.',
      unlocked: params.completedSafetyCount >= 1,
      points: 100,
      category: 'k3',
    },
    {
      id: 'badge-data',
      title: 'Eksperimenter Terkalibrasi',
      description: 'Mencatat minimal 3 titik data pengamatan kuantitatif.',
      unlocked: params.recordsCount >= 3,
      points: 150,
      category: 'data',
    },
    {
      id: 'badge-regresi',
      title: 'Analis Kurva & LKS',
      description: 'Menyelesaikan evaluasi diagnostik LKS dan regresi kurva.',
      unlocked: params.lksGraded,
      points: 200,
      category: 'regresi',
    },
    {
      id: 'badge-visual',
      title: 'Dokumentator Visual 3D',
      description: 'Mengambil bukti tangkapan layar 3D untuk laporan praktikum.',
      unlocked: params.snapshotsCount >= 1,
      points: 125,
      category: 'visual',
    },
    {
      id: 'badge-tantangan',
      title: 'Penakluk Tantangan Kilat',
      description: 'Berhasil mencapai target presisi pada Misi Tantangan Kilat.',
      unlocked: params.challengesSolvedCount >= 1,
      points: 175,
      category: 'tantangan',
    },
  ];
}

export const AchievementBadgesStrip: React.FC<{
  badges: ScientificBadge[];
}> = ({ badges }) => {
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalPoints = badges.reduce((acc, b) => acc + (b.unlocked ? b.points : 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            Lencana Pencapaian Kompetensi Praktikum
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500 dark:text-slate-400">
            Terbuka: <strong className="text-slate-900 dark:text-white">{unlockedCount}/{badges.length}</strong>
          </span>
          <span>·</span>
          <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">
            {totalPoints} Poin Sains
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`p-3 rounded-xl border transition-colors flex flex-col justify-between gap-1.5 ${
              badge.unlocked
                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-900 dark:text-white'
                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/70 dark:border-slate-800/80 text-slate-400 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-bold truncate">{badge.title}</span>
              <span
                className={`font-mono text-[10px] font-bold shrink-0 ${
                  badge.unlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              >
                {badge.unlocked ? '✓ TERBUKA' : `+${badge.points}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {badge.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 7.3D SNAPSHOT GALLERY & TRIAL REPLAY DOCK
// ============================================================================
interface SnapshotAndReplayGalleryProps {
  snapshots: Lab3DSnapshot[];
  onDeleteSnapshot?: (id: string) => void;
  records?: ExperimentRecord[];
  onReplayRecord?: (record: ExperimentRecord) => void;
}

export const SnapshotAndReplayGallery: React.FC<SnapshotAndReplayGalleryProps> = ({
  snapshots,
  onDeleteSnapshot,
  records = [],
  onReplayRecord,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-500" />
            <span>Galeri Bukti Foto 3D &amp; Pemutar Ulang Rekaman (Trial Replay)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seluruh tangkapan layar 3D otomatis dilampirkan ke dalam dokumen Laporan Resmi Praktikum A4.
          </p>
        </div>
        <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold tabular-nums">
          {snapshots.length} Foto 3D · {records.length} Rekaman Data
        </span>
      </div>

      {/* 3D Snapshots Grid */}
      {snapshots.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
          Belum ada tangkapan layar 3D. Klik tombol <strong>&ldquo;Ambil Foto 3D&rdquo;</strong> di pojok kiri bawah kanvas simulasi 3D untuk mendokumentasikan percobaan Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col justify-between"
            >
              <div className="relative h-36 bg-slate-950 overflow-hidden">
                <img
                  src={snap.dataUrl}
                  alt={snap.moduleTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/85 text-[10px] font-mono text-sky-300 border border-white/10">
                  {snap.domain} · {snap.timestamp}
                </div>
                {onDeleteSnapshot && (
                  <button
                    type="button"
                    onClick={() => onDeleteSnapshot(snap.id)}
                    aria-label="Hapus foto 3D"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/85 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3 space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {snap.moduleTitle}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {snap.parametersSummary || snap.paramsSummary}
                </div>
                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                  Hasil: {snap.primaryMetric}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Trial Replay List */}
      {records.length > 0 && onReplayRecord && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
            <span>Putar Ulang Konfigurasi Rekaman ke Ruang 3D:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {records.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {rec.id} · {rec.experimentTitle}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {rec.parametersSummary}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onReplayRecord(rec);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Putar di 3D</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 8. CLASS & GROUP LEADERBOARD CARD
// ============================================================================
export const ClassLeaderboardCard: React.FC<{
  students: StudentProgressItem[];
  highlightStudentName?: string;
}> = ({ students, highlightStudentName }) => {
  const rankedStudents = [...students]
    .map((s) => {
      const r2Score = Math.round((s.rSquared ?? 0.85) * 40);
      const trialScore = Math.min(30, s.trialsRecorded * 8);
      const quizPart = Math.round(((s.quizScore ?? 75) / 100) * 30);
      const compositeScore = Math.min(100, r2Score + trialScore + quizPart);
      return {
        ...s,
        compositeScore,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Papan Peringkat Ketelitian &amp; Kompetensi Kelas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Diurutkan berdasarkan Indeks Presisi Regresi (R²), Jumlah Data Terukur, dan Skor Diagnostik LKS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Terverifikasi Real-Time</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3">Peringkat</th>
              <th className="py-2.5 px-3">Nama Praktikan &amp; Kelompok</th>
              <th className="py-2.5 px-3">Domain &amp; Modul Aktif</th>
              <th className="py-2.5 px-3 text-right">Presisi R²</th>
              <th className="py-2.5 px-3 text-right">Data Uji</th>
              <th className="py-2.5 px-3 text-right">Skor LKS</th>
              <th className="py-2.5 px-3 text-right">Indeks Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {rankedStudents.map((stu, idx) => {
              const isHighlighted = highlightStudentName && stu.name === highlightStudentName;
              return (
              <tr
                key={stu.id}
                className={`transition-colors ${
                  isHighlighted
                    ? 'bg-sky-500/10 dark:bg-sky-500/15'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <td className="py-2.5 px-3 font-mono font-bold tabular-nums">
                  {idx === 0 ? (
                    <span className="text-amber-500 font-extrabold">#1 UTAMA</span>
                  ) : idx === 1 ? (
                    <span className="text-sky-400 font-bold">#2</span>
                  ) : idx === 2 ? (
                    <span className="text-emerald-400 font-bold">#3</span>
                  ) : (
                    <span className="text-slate-400">#{idx + 1}</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-900 dark:text-white">{stu.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {stu.groupId}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {stu.activeDomain}
                  </span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {stu.activeModuleTitle || stu.currentActivity}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  {(stu.rSquared ?? 0.88).toFixed(3)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {stu.trialsRecorded} sampel
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {stu.quizScore ?? 80}/100
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                  {stu.compositeScore} pts
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
