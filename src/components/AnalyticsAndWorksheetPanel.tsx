import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GitCompareArrows,
} from 'lucide-react';
import {
  DataPointMultiAxis,
  ExperimentRecord,
  CurveModelType,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import {
  AcademicReportData,
  openPrintableAcademicReport,
} from '../utils/academicReportExporter';
import { AcademicReportPreviewModal } from './ui/AcademicReportPreviewModal';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
  ExperimentTrialComparePanel,
} from './ui/HypothesisAndCompareDock';
import type { Lab3DSnapshot } from './ui/ScientificEnhancementSuite';

import { RegressionChartSection } from './analytics/RegressionChartSection';
import { DataObservationTable } from './analytics/DataObservationTable';
import { StudentWorksheetForm } from './analytics/StudentWorksheetForm';
import { PostLabMasteryQuiz } from './analytics/PostLabMasteryQuiz';

export interface AnalyticsAndWorksheetPanelProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  activeGroupId: string;
  onSubmitQuizScore: (score: number, correctCount: number) => void;
  onExportChartNotification: (format: 'PNG' | 'PDF') => void;
  onProceedToReport?: () => void;
  onBackToLab?: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  onAskDrLabMu?: (prompt: string) => void;
  snapshots3D?: Lab3DSnapshot[];
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onRotateGroup?: (nextStudentName: string, nextGroupId: string) => void;
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
};

export const AnalyticsAndWorksheetPanel: React.FC<AnalyticsAndWorksheetPanelProps> = ({
  records,
  activeStudentName,
  activeGroupId,
  onSubmitQuizScore,
  onExportChartNotification,
  onProceedToReport,
  onBackToLab,
  hypothesisNote,
  onChangeHypothesisNote,
  onAskDrLabMu,
  snapshots3D = [],
  onDeleteRecord,
  onExportCSV,
  onRotateGroup,
  moduleId,
  domain,
}) => {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>(
    records.length >= 2 ? 'custom-records' : 'newton-force-acc'
  );
  const [hasManualDatasetChoice, setHasManualDatasetChoice] = useState<boolean>(false);

  useEffect(() => {
    if (!hasManualDatasetChoice && records.length >= 2) {
      setSelectedDatasetKey('custom-records');
    }
  }, [records.length, hasManualDatasetChoice]);
  const [curveModel, setCurveModel] = useState<CurveModelType>('linear');
  const [showCompareDock, setShowCompareDock] = useState<boolean>(false);
  const [showHypothesisDock, setShowHypothesisDock] = useState<boolean>(false);
  const [reportModalData, setReportModalData] = useState<AcademicReportData | null>(null);

  // Custom data points from actual recorded trials
  const customRecordPoints: DataPointMultiAxis[] = records
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, i) => ({
      label: r.id,
      x: r.numericX ?? i + 1,
      y1: r.numericY1 ?? 0,
      y2: r.numericY2 ?? 0,
    }));

  const activeDataset =
    selectedDatasetKey === 'custom-records' && customRecordPoints.length >= 2
      ? {
          title: 'Dataset Rekaman Observasi Meja Praktikum Siswa',
          xAxisLabel: 'Variabel Bebas (X)',
          y1AxisLabel: 'Respons Terikat (Y1)',
          y2AxisLabel: 'Respons Sekunder (Y2)',
          points: customRecordPoints,
        }
      : PRESET_DATASETS[selectedDatasetKey] || PRESET_DATASETS['newton-force-acc'];

  const handlePrintPDFReport = (conclusionText: string) => {
    labSound.playClick();
    onExportChartNotification('PDF');

    const now = new Date();
    const reportPayload: AcademicReportData = {
      experimentTitle: activeDataset.title,
      studentName: activeStudentName,
      groupId: activeGroupId,
      tier: 'SMA',
      dateStr: now.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      timeStr: now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      domain: records[0]?.domain || 'Fisika & Sains',
      records,
      discussionNotes: `Grafik data analitik menunjukkan korelasi kuat antar variabel dengan kurva model regresi ${curveModel}.`,
      conclusionNotes: conclusionText,
    };

    setReportModalData(reportPayload);
    openPrintableAcademicReport(reportPayload);
  };

  return (
    <div className="space-y-6 select-text">
      {/* Top Navigation & Subheader */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
            Tahap 3 · Analisis Data Kuantitatif, Regresi &amp; LKS
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            Grafik Regresi Ilmiah, Tabel Data &amp; Lembar Kerja Praktikan
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBackToLab && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToLab();
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Kokpit 3D</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowHypothesisDock(!showHypothesisDock);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showHypothesisDock
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span>Hipotesis Awal</span>
          </button>

          {records.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setShowCompareDock(!showCompareDock);
              }}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showCompareDock
                  ? 'bg-sky-600 text-white border-sky-500'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              <span>Bandingkan Uji Coba</span>
            </button>
          )}

          {onProceedToReport && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onProceedToReport();
              }}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>Laporan &amp; Tugas Kelompok →</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dataset Picker Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
          <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">Pilih Sumber Dataset:</span>
          <select
            value={selectedDatasetKey}
            onChange={(e) => {
              labSound.playClick();
              setHasManualDatasetChoice(true);
              setSelectedDatasetKey(e.target.value);
            }}
            className="min-w-0 max-w-full w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {customRecordPoints.length >= 2 && (
              <option value="custom-records">
                ★ Data Langsung Hasil Eksperimen Siswa ({customRecordPoints.length} titik)
              </option>
            )}
            <option value="newton-force-acc">Preset: Hukum II Newton (Gaya vs Percepatan)</option>
            <option value="hooke-spring">Preset: Hukum Hooke (Simpangan vs Gaya Pemulih)</option>
            <option value="thermo-gibbs">Preset: Termodinamika (Suhu vs Energi Gibbs)</option>
            <option value="kepler-third-law">Preset: Astronomi Hukum III Kepler (a³ vs T²)</option>
          </select>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          Titik Data Aktif: <strong className="font-mono text-slate-900 dark:text-white">{activeDataset.points.length}</strong>
        </div>
      </div>

      {/* Optional Compare & Hypothesis Docks */}
      {showHypothesisDock && hypothesisNote && (
        <HypothesisScratchpadCard
          note={hypothesisNote}
          onChange={(next) => onChangeHypothesisNote?.(next)}
        />
      )}

      {showCompareDock && records.length >= 2 && (
        <ExperimentTrialComparePanel records={records} />
      )}

      {/* 1. Interactive SVG Regression Curve with Outlier Toggle & Tooltip */}
      <RegressionChartSection
        datasetTitle={activeDataset.title}
        xAxisLabel={activeDataset.xAxisLabel}
        y1AxisLabel={activeDataset.y1AxisLabel}
        y2AxisLabel={activeDataset.y2AxisLabel}
        points={activeDataset.points}
        curveModel={curveModel}
        onChangeCurveModel={setCurveModel}
        onAskDrLabMuAboutOutlier={() =>
          onAskDrLabMu?.('Bagaimana pengaruh titik outlier pada kurva regresi data praktikum saya?')
        }
      />

      {/* 2. Observation Records Table */}
      <DataObservationTable
        records={records}
        onDeleteRecord={onDeleteRecord || (() => {})}
        onExportCSV={onExportCSV || (() => onExportChartNotification('PDF'))}
      />

      {/* 3. Post-Lab Contextual Mastery Quiz (3 Questions) */}
      <PostLabMasteryQuiz
        records={records}
        activeStudentName={activeStudentName}
        onQuizCompleted={onSubmitQuizScore}
      />

      {/* 4. Student Worksheet Form & PDF Exporter */}
      <StudentWorksheetForm
        activeStudentName={activeStudentName}
        activeGroupId={activeGroupId}
        hypothesisNote={hypothesisNote}
        onChangeHypothesisNote={onChangeHypothesisNote}
        onSubmitQuizScore={onSubmitQuizScore}
        onPrintPDFReport={handlePrintPDFReport}
        onRotateGroup={onRotateGroup}
        observationRecords={records}
        moduleId={moduleId}
        domain={domain}
      />

      {/* Printable Report Modal */}
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
