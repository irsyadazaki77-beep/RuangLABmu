import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  Printer,
} from 'lucide-react';
import {
  DataPointMultiAxis,
  ExperimentRecord,
  CurveModelType,
  calculateCurveFitting,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import {
  AcademicReportData,
  openPrintableAcademicReport,
} from '../utils/academicReportExporter';
import { computeMeasurementErrorSummary } from '../utils/uncertaintyEngine';
import { getLabSafetyLicenseForModule } from '../services/labLicenseEngine';
import { EducationTier, getExperimentById } from '../registry/experimentRegistry';
import {
  buildModulePresetDataset,
  resolveModuleAxisMeta,
} from '../utils/dynamicWorksheetEngine';
import { AcademicReportPreviewModal } from './ui/AcademicReportPreviewModal';
import { filterRecordsForModule } from '../utils/spatialHudHelpers';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
  ExperimentTrialComparePanel,
} from './ui/HypothesisAndCompareDock';
import type { Lab3DSnapshot } from './ui/ScientificEnhancementSuite';

import { RegressionChartSection } from './analytics/RegressionChartSection';
import { UncertaintyAnalysisCard } from './analytics/UncertaintyAnalysisCard';
import { DataObservationTable } from './analytics/DataObservationTable';
import { StudentWorksheetForm } from './analytics/StudentWorksheetForm';
import { PostLabMasteryQuiz } from './analytics/PostLabMasteryQuiz';
import { DetailAccordion } from './ui/ProgressiveDisclosure';

type Stage3Tab = 'chart-data' | 'lks-quiz' | 'summary-export';

export interface AnalyticsAndWorksheetPanelProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  activeGroupId: string;
  activeTier?: EducationTier;
  onSubmitQuizScore: (score: number, correctCount: number) => void;
  onExportChartNotification: (format: 'PNG' | 'PDF') => void;
  onProceedToReport?: () => void;
  onBackToLab?: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  onAskDrLabMu?: (prompt: string) => void;
  snapshots3D?: Lab3DSnapshot[];
  onAddManualRecord?: (record: ExperimentRecord) => void;
  onUpdateRecord?: (id: string, patch: Partial<ExperimentRecord>) => void;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onRotateGroup?: (nextStudentName: string, nextGroupId: string) => void;
  lksAnswers?: Record<string, string>;
  onChangeLksAnswers?: (next: Record<string, string>) => void;
  moduleId?: string;
  domain?: string;
}

const PRESET_DATASETS: Record<
  string,
  {
    title: string;
    xAxisLabel: string;
    y1AxisLabel: string;
    y2AxisLabel: string;
    points: DataPointMultiAxis[];
  }
> = {
  'newton-force-acc': {
    title: 'Hukum II Newton: Gaya Dorong (F) terhadap Percepatan (a)',
    xAxisLabel: 'Gaya Resultan ΣF (N)',
    y1AxisLabel: 'Percepatan a (m/s²)',
    y2AxisLabel: 'Energi Kinetik (J)',
    points: [
      { label: 'Uji 1', x: 10, y1: 2.48, y2: 12.3 },
      { label: 'Uji 2', x: 20, y1: 5.02, y2: 36.1 },
      { label: 'Uji 3', x: 30, y1: 7.45, y2: 79.8 },
      { label: 'Uji 4', x: 40, y1: 10.04, y2: 144.5 },
      { label: 'Uji 5', x: 50, y1: 12.52, y2: 225.8 },
    ],
  },
  'hooke-spring': {
    title: 'Hukum Hooke: Simpangan Pegas (Δx) terhadap Gaya Pemulih (|Fp|)',
    xAxisLabel: 'Simpangan Δx (m)',
    y1AxisLabel: 'Gaya Pemulih |Fp| (N)',
    y2AxisLabel: 'Energi Potensial Ep (J)',
    points: [
      { label: 'x=0.2m', x: 0.2, y1: 24.0, y2: 2.4 },
      { label: 'x=0.4m', x: 0.4, y1: 48.2, y2: 9.6 },
      { label: 'x=0.6m', x: 0.6, y1: 71.8, y2: 21.6 },
      { label: 'x=0.8m', x: 0.8, y1: 96.1, y2: 38.4 },
      { label: 'x=1.0m', x: 1.0, y1: 120.0, y2: 60.0 },
    ],
  },
  'thermo-gibbs': {
    title: 'Termodinamika: Suhu (T) terhadap Energi Bebas Gibbs (-ΔG)',
    xAxisLabel: 'Suhu Larutan (°C)',
    y1AxisLabel: 'Spontanitas -ΔG (kJ/mol)',
    y2AxisLabel: 'Laju Reaksi r (M/s)',
    points: [
      { label: '25°C', x: 25, y1: 81.27, y2: 6.8 },
      { label: '45°C', x: 45, y1: 82.88, y2: 11.4 },
      { label: '65°C', x: 65, y1: 84.49, y2: 18.2 },
      { label: '85°C', x: 85, y1: 86.1, y2: 27.9 },
      { label: '105°C', x: 105, y1: 87.71, y2: 41.5 },
    ],
  },
  'kepler-third-law': {
    title: 'Hukum III Kepler: Pangkat Tiga Jarak (a³) terhadap Kuadrat Periode (T²)',
    xAxisLabel: 'Pangkat Tiga Sumbu Semi-Mayor a³ (AU³)',
    y1AxisLabel: 'Kuadrat Periode Orbit T² (thn²)',
    y2AxisLabel: 'Kecepatan Orbit v (km/s)',
    points: [
      { label: 'Merkurius', x: 0.06, y1: 0.06, y2: 47.87 },
      { label: 'Venus', x: 0.37, y1: 0.38, y2: 35.02 },
      { label: 'Bumi', x: 1.0, y1: 1.0, y2: 29.78 },
      { label: 'Mars', x: 3.51, y1: 3.53, y2: 24.07 },
      { label: 'Jupiter', x: 140.61, y1: 140.66, y2: 13.07 },
    ],
  },
  'bio-enzyme-kinetics': {
    title: 'Biologi: Pengaruh Suhu terhadap Laju Reaksi Enzim Katalase',
    xAxisLabel: 'Suhu Inkubasi (°C)',
    y1AxisLabel: 'Laju Pelepasan O₂ (mL/mnt)',
    y2AxisLabel: 'Stabilitas Protein (%)',
    points: [
      { label: '20°C', x: 20, y1: 12.4, y2: 99 },
      { label: '30°C', x: 30, y1: 24.8, y2: 96 },
      { label: '37°C', x: 37, y1: 35.6, y2: 92 },
      { label: '45°C', x: 45, y1: 27.1, y2: 71 },
      { label: '55°C', x: 55, y1: 9.2, y2: 34 },
    ],
  },
};

function resolveDefaultPresetForModule(domain?: string, moduleId?: string): string {
  if (moduleId) return 'active-module-preset';
  const domainLower = (domain || '').toLowerCase();
  if (domainLower === 'biologi' || domainLower === 'biology') return 'bio-enzyme-kinetics';
  if (domainLower === 'kimia' || domainLower === 'chemistry') return 'thermo-gibbs';
  if (domainLower === 'astronomi' || domainLower === 'astronomy') return 'kepler-third-law';
  return 'newton-force-acc';
}

export const AnalyticsAndWorksheetPanel: React.FC<AnalyticsAndWorksheetPanelProps> = ({
  records,
  activeStudentName,
  activeGroupId,
  activeTier = 'SMA',
  onSubmitQuizScore,
  onExportChartNotification,
  onProceedToReport,
  onBackToLab,
  hypothesisNote,
  onChangeHypothesisNote,
  onAskDrLabMu,
  onAddManualRecord,
  onUpdateRecord,
  onDeleteRecord,
  onExportCSV,
  onRotateGroup,
  lksAnswers,
  onChangeLksAnswers,
  moduleId,
  domain,
}) => {
  const activeMod = useMemo(() => (moduleId ? getExperimentById(moduleId) : undefined), [moduleId]);
  const axisMeta = useMemo(() => resolveModuleAxisMeta(activeMod), [activeMod]);
  const activeModulePreset = useMemo(
    () => (activeMod ? buildModulePresetDataset(activeMod, 5) : null),
    [activeMod]
  );
  const effectiveDomain = domain ?? activeMod?.domain;
  const moduleRecords = useMemo(
    () => (effectiveDomain && moduleId ? filterRecordsForModule(records, effectiveDomain, moduleId) : records),
    [records, effectiveDomain, moduleId]
  );

  const customRecordPoints: DataPointMultiAxis[] = records
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, i) => ({
      label: r.id,
      x: r.numericX ?? i + 1,
      y1: r.numericY1 ?? 0,
      y2: r.numericY2 ?? 0,
    }));

  const moduleRecordPoints: DataPointMultiAxis[] = moduleRecords
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, i) => ({
      label: r.id,
      x: r.numericX ?? i + 1,
      y1: r.numericY1 ?? 0,
      y2: r.numericY2 ?? 0,
    }));

  const defaultPresetKey = resolveDefaultPresetForModule(effectiveDomain, moduleId);
  const hasDistinctModuleX = useMemo(
    () => new Set(moduleRecordPoints.map((p) => p.x)).size >= 2,
    [moduleRecordPoints]
  );

  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>(() =>
    hasDistinctModuleX ? 'module-records' : defaultPresetKey
  );
  const [hasManualDatasetChoice, setHasManualDatasetChoice] = useState<boolean>(false);

  useEffect(() => {
    setHasManualDatasetChoice(false);
  }, [moduleId]);

  useEffect(() => {
    if (!hasManualDatasetChoice) {
      if (hasDistinctModuleX) {
        setSelectedDatasetKey('module-records');
      } else {
        setSelectedDatasetKey(defaultPresetKey);
      }
    }
  }, [hasDistinctModuleX, defaultPresetKey, hasManualDatasetChoice]);

  const [activeTab, setActiveTab] = useState<Stage3Tab>('chart-data');
  const [curveModel, setCurveModel] = useState<CurveModelType>('linear');
  const [reportModalData, setReportModalData] = useState<AcademicReportData | null>(null);
  const [uncertaintyTheoryInput, setUncertaintyTheoryInput] = useState<string>('');
  const [uncertaintyNstInput, setUncertaintyNstInput] = useState<string>('');

  const poePrediction = useMemo(() => {
    if (!hypothesisNote) return null;
    const rawX = hypothesisNote.predictedX?.trim() ?? '';
    const rawY = hypothesisNote.predictedY?.trim() ?? '';
    if (!rawX || !rawY) return null;
    const xVal = Number(rawX);
    const yVal = Number(rawY);
    if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) return null;
    return {
      x: xVal,
      y: yVal,
      trend: hypothesisNote.predictedTrend,
    };
  }, [hypothesisNote]);

  const activeDataset =
    selectedDatasetKey === 'module-records' && moduleRecordPoints.length >= 2
      ? {
          title: `Dataset Modul Aktif: ${activeMod?.title || moduleId || 'Eksperimen'}`,
          xAxisLabel: axisMeta.xAxisLabel,
          y1AxisLabel: axisMeta.y1AxisLabel,
          y2AxisLabel: axisMeta.y2AxisLabel,
          points: moduleRecordPoints,
        }
      : selectedDatasetKey === 'custom-records' && customRecordPoints.length >= 2
      ? {
          title: 'Dataset Rekaman Observasi Semua Sesi Siswa',
          xAxisLabel: axisMeta.xAxisLabel,
          y1AxisLabel: axisMeta.y1AxisLabel,
          y2AxisLabel: axisMeta.y2AxisLabel,
          points: customRecordPoints,
        }
      : selectedDatasetKey === 'active-module-preset' && activeModulePreset
      ? activeModulePreset
      : PRESET_DATASETS[selectedDatasetKey] ||
        activeModulePreset ||
        PRESET_DATASETS['newton-force-acc'];

  const handlePrintPDFReport = (conclusionText: string) => {
    labSound.playClick();
    onExportChartNotification('PDF');

    const now = new Date();
    const resolvedModule = moduleId ? getExperimentById(moduleId) : undefined;
    const simLicense = moduleId
      ? getLabSafetyLicenseForModule(moduleId)
      : null;

    const fit =
      activeDataset.points.length >= 2
        ? calculateCurveFitting(
            activeDataset.points.map((p) => ({ x: p.x, y: p.y1 })),
            curveModel
          )
        : undefined;

    const theoryNum = uncertaintyTheoryInput.trim()
      ? Number(uncertaintyTheoryInput.trim())
      : undefined;
    const nstNum = uncertaintyNstInput.trim()
      ? Number(uncertaintyNstInput.trim())
      : undefined;
    const errorStats = computeMeasurementErrorSummary(
      activeDataset.points.map((p) => p.y1),
      theoryNum !== undefined && Number.isFinite(theoryNum) ? theoryNum : undefined,
      nstNum !== undefined && Number.isFinite(nstNum) && nstNum > 0 ? nstNum : undefined
    );

    const poeActualY =
      poePrediction && fit ? fit.evaluateAt(poePrediction.x) : undefined;
    const poeDeviationPct =
      poePrediction && poeActualY !== undefined && Math.abs(poeActualY) > 1e-9
        ? (Math.abs(poePrediction.y - poeActualY) / Math.abs(poeActualY)) * 100
        : undefined;

    const reportPayload: AcademicReportData = {
      experimentTitle: resolvedModule?.title || activeDataset.title,
      studentName: activeStudentName,
      groupId: activeGroupId,
      tier: activeTier,
      dateStr: now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      timeStr: now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      domain: domain || records[0]?.domain || 'Fisika & Sains',
      module: resolvedModule,
      records,
      regressionSummary: fit
        ? {
            slope: fit.slopeM,
            intercept: fit.interceptC,
            rSquared: fit.rSquared,
            formula: fit.equationString,
            modelLabel: fit.modelLabel,
            equationString: fit.equationString,
            expectedSlopeMeaning: resolvedModule?.defaultRegressionAxes?.expectedSlopeMeaning,
          }
        : undefined,
      hypothesisSummary: hypothesisNote
        ? {
            independentVar: hypothesisNote.independentVar,
            dependentVar: hypothesisNote.dependentVar,
            hypothesisText: hypothesisNote.hypothesisText,
            reflectionText: hypothesisNote.reflectionText,
          }
        : undefined,
      simLabLicense: simLicense
        ? {
            licenseCode: simLicense.licenseId,
            status: simLicense.status,
            quizScore: simLicense.preLabQuizScorePct,
            issuedDateStr: simLicense.issuedAtFormatted,
          }
        : undefined,
      poeEvaluationSummary:
        poePrediction || hypothesisNote?.predictedTrend
          ? {
              predictedTrend: hypothesisNote?.predictedTrend,
              predictedX: poePrediction?.x,
              predictedY: poePrediction?.y,
              actualYAtPredictedX: poeActualY,
              deviationPct: poeDeviationPct,
            }
          : undefined,
      uncertaintySummary:
        errorStats.n > 0
          ? {
              metricLabel: activeDataset.y1AxisLabel,
              n: errorStats.n,
              mean: errorStats.mean,
              sampleStdDev: errorStats.sampleStdDev,
              standardErrorMean: errorStats.standardErrorMean,
              instrumentUncertainty: errorStats.instrumentUncertainty,
              combinedUncertainty: errorStats.combinedUncertainty,
              relativeUncertaintyPct: errorStats.relativeUncertaintyPct,
              percentErrorVsTheory: errorStats.percentErrorVsTheory ?? null,
              precisionGrade: errorStats.precisionGrade,
              recommendedSignificantFigures: errorStats.recommendedSignificantFigures,
            }
          : undefined,
      discussionNotes: `Grafik data analitik menunjukkan kesesuaian kurva model regresi ${curveModel}${
        fit ? ` (R² = ${fit.rSquared.toFixed(4)})` : ''
      } dengan ketidakpastian gabungan ±${errorStats.combinedUncertainty.toFixed(3)} (${errorStats.precisionGrade}).`,
      conclusionNotes: conclusionText,
    };

    setReportModalData(reportPayload);
    openPrintableAcademicReport(reportPayload);
  };

  return (
    <div className="space-y-5 select-text">
      {/* Top Navigation & Subheader */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-[var(--comfort-accent)]">
            Tahap 3 · Analisis Data &amp; Lembar Kerja
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--comfort-text)] tracking-tight">
            Analisis Regresi, LKS &amp; Laporan Praktikum
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onBackToLab && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToLab();
              }}
              className="comfort-btn-secondary px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Kokpit 3D</span>
            </button>
          )}

          {onProceedToReport && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onProceedToReport();
              }}
              className="comfort-btn-primary px-4 py-2 min-h-[38px] text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Tahap 4: Kolaborasi &amp; Ekspor</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Focused 3-Tab Stage 3 Workspace Navigation */}
      <div
        role="tablist"
        aria-label="Navigasi Ruang Kerja Analisis Tahap 3"
        className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] overflow-x-auto no-scrollbar"
      >
        {(
          [
            {
              id: 'chart-data',
              label: '1. Grafik & Data',
              badge: `${activeDataset.points.length} titik`,
              Icon: BarChart3,
            },
            {
              id: 'lks-quiz',
              label: '2. LKS & Kuis',
              badge: `${Object.keys(lksAnswers || {}).length} terisi`,
              Icon: ClipboardCheck,
            },
            {
              id: 'summary-export',
              label: '3. Ringkasan & Cetak',
              badge: 'A4',
              Icon: FileText,
            },
          ] as const
        ).map(({ id, label, badge, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`stage3-tab-${id}`}
              onClick={() => {
                labSound.playClick();
                setActiveTab(id);
              }}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors duration-150 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'comfort-tab-active'
                  : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
              <span
                className={`font-mono text-2xs tabular-nums ${
                  isActive ? 'text-white/80' : 'text-[var(--comfort-text-muted)]'
                }`}
              >
                · {badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GRAFIK & DATA */}
      {activeTab === 'chart-data' && (
        <div className="space-y-4">
          {/* Dataset Picker Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
              <label
                htmlFor="analytics-dataset-select"
                className="font-semibold text-[var(--comfort-text)] shrink-0"
              >
                Sumber Dataset:
              </label>
              <select
                id="analytics-dataset-select"
                value={selectedDatasetKey}
                onChange={(e) => {
                  labSound.playClick();
                  setHasManualDatasetChoice(true);
                  setSelectedDatasetKey(e.target.value);
                }}
                className="min-w-0 max-w-full w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)] cursor-pointer"
              >
                {moduleRecordPoints.length >= 2 && (
                  <option value="module-records">
                    Data Modul Aktif: {activeMod?.title || moduleId} ({moduleRecordPoints.length} titik)
                  </option>
                )}
                {customRecordPoints.length >= 2 && (
                  <option value="custom-records">
                    Semua Data Sesi Praktikum ({customRecordPoints.length} titik)
                  </option>
                )}
                {activeModulePreset && (
                  <option value="active-module-preset">
                    Preset Modul Aktif: {activeMod?.title} (5 titik kurasi)
                  </option>
                )}
                <option value="newton-force-acc">Preset Fisika: Hukum II Newton (Gaya vs Percepatan)</option>
                <option value="hooke-spring">Preset Fisika: Hukum Hooke (Simpangan vs Gaya Pemulih)</option>
                <option value="thermo-gibbs">Preset Kimia: Termodinamika (Suhu vs Energi Gibbs)</option>
                <option value="bio-enzyme-kinetics">Preset Biologi: Kinetika Enzim Katalase (Suhu vs Laju O₂)</option>
                <option value="kepler-third-law">Preset Astronomi: Hukum III Kepler (a³ vs T²)</option>
              </select>
            </div>
            <div className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              {activeDataset.points.length} titik aktif
            </div>
          </div>

          <RegressionChartSection
            datasetTitle={activeDataset.title}
            xAxisLabel={activeDataset.xAxisLabel}
            y1AxisLabel={activeDataset.y1AxisLabel}
            y2AxisLabel={activeDataset.y2AxisLabel}
            points={activeDataset.points}
            curveModel={curveModel}
            onChangeCurveModel={setCurveModel}
            poePrediction={poePrediction}
            instrumentNst={
              uncertaintyNstInput.trim() && Number.isFinite(Number(uncertaintyNstInput.trim()))
                ? Number(uncertaintyNstInput.trim())
                : undefined
            }
            onExportChart={(fmt) => onExportChartNotification(fmt === 'SVG' ? 'PNG' : fmt)}
            onAskDrLabMuAboutPoe={(deviationPct, predictedY, actualY) =>
              onAskDrLabMu?.(
                `Prediksi POE saya bernilai Y = ${predictedY.toFixed(2)}, sedangkan hasil kurva observasi bernilai ${actualY.toFixed(2)} (deviasi ${deviationPct.toFixed(1)}%). Apa penyebab fisis perbedaan antara dugaan awal dan data eksperimen ini?`
              )
            }
            onAskDrLabMuAboutOutlier={() =>
              onAskDrLabMu?.('Bagaimana pengaruh titik outlier pada kurva regresi data praktikum saya?')
            }
          />

          <UncertaintyAnalysisCard
            metricLabel={activeDataset.y1AxisLabel}
            values={activeDataset.points.map((p) => p.y1)}
            theoreticalInput={uncertaintyTheoryInput}
            onChangeTheoreticalInput={setUncertaintyTheoryInput}
            nstInput={uncertaintyNstInput}
            onChangeNstInput={setUncertaintyNstInput}
            defaultOpen={false}
          />

          <DataObservationTable
            records={records}
            onAddRecord={onAddManualRecord}
            onUpdateRecord={onUpdateRecord}
            onDeleteRecord={onDeleteRecord || (() => {})}
            onExportCSV={onExportCSV || (() => onExportChartNotification('PDF'))}
            moduleTitle={activeMod?.title}
            moduleId={moduleId}
            domain={effectiveDomain}
            activeStudentName={activeStudentName}
            activeGroupId={activeGroupId}
            xAxisLabel={axisMeta.xAxisLabel}
            y1AxisLabel={axisMeta.y1AxisLabel}
          />
        </div>
      )}

      {/* TAB 2: LKS & KUIS */}
      {activeTab === 'lks-quiz' && (
        <div className="space-y-4">
          <StudentWorksheetForm
            activeStudentName={activeStudentName}
            activeGroupId={activeGroupId}
            activeTier={activeTier}
            hypothesisNote={hypothesisNote}
            onChangeHypothesisNote={onChangeHypothesisNote}
            onSubmitQuizScore={onSubmitQuizScore}
            onPrintPDFReport={handlePrintPDFReport}
            onRotateGroup={onRotateGroup}
            onAskDrLabMu={onAskDrLabMu}
            lksAnswers={lksAnswers}
            onChangeLksAnswers={onChangeLksAnswers}
            observationRecords={moduleRecords}
            moduleId={moduleId}
            domain={effectiveDomain}
          />

          <DetailAccordion
            title="Kuis Penguasaan Konsep Pasca-Praktikum"
            meta="Evaluasi Mandiri"
            icon={<ClipboardCheck className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
            defaultOpen={false}
            testId="stage3-postlab-quiz-accordion"
            contentClassName="p-4 border-t border-[var(--comfort-border)]"
          >
            <PostLabMasteryQuiz
              records={moduleRecords}
              activeStudentName={activeStudentName}
              moduleId={moduleId}
              domain={effectiveDomain}
              onQuizCompleted={onSubmitQuizScore}
            />
          </DetailAccordion>
        </div>
      )}

      {/* TAB 3: RINGKASAN & CETAK */}
      {activeTab === 'summary-export' && (
        <div className="space-y-4">
          <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-[var(--comfort-text)]">
                Pratinjau &amp; Cetak Laporan Akademik A4
              </h2>
              <p className="text-xs text-[var(--comfort-text-muted)] comfort-report-prose">
                Tinjau keselarasan hipotesis dan perbandingan percobaan, lalu cetak laporan lengkap berformat A4.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handlePrintPDFReport(
                  hypothesisNote?.reflectionText?.trim() ||
                    `Analisis regresi ${activeMod?.title || activeDataset.title} selesai dengan ${activeDataset.points.length} titik pengamatan.`
                )
              }
              className="comfort-btn-primary px-4 py-2.5 min-h-[40px] rounded-lg font-bold text-xs inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Cetak Laporan Akademik A4</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {hypothesisNote && (
              <div className={records.length >= 2 ? 'lg:col-span-6' : 'lg:col-span-12'}>
                <HypothesisScratchpadCard
                  moduleTitle={activeMod?.title || activeDataset.title}
                  note={hypothesisNote}
                  onChangeNote={(next) => onChangeHypothesisNote?.(next)}
                  records={records}
                />
              </div>
            )}

            {records.length >= 2 && (
              <div className={hypothesisNote ? 'lg:col-span-6' : 'lg:col-span-12'}>
                <ExperimentTrialComparePanel records={records} />
              </div>
            )}
          </div>
        </div>
      )}

      {reportModalData && (
        <AcademicReportPreviewModal
          isOpen={true}
          onClose={() => setReportModalData(null)}
          reportData={reportModalData}
        />
      )}
    </div>
  );
};
