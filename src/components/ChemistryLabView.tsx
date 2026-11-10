import React, { useEffect, useState } from 'react';
import {
  Camera,
  Sliders,
  FlaskConical,
} from 'lucide-react';
import {
  ChemistryParams,
  AcademicLevel,
  calculateChemistryMetrics,
  THERMO_PRESETS,
  REDOX_PRESETS,
  evaluateSafetyHazard,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { ChemistryScene3D } from './ChemistryScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import {
  TactileParameterControl,
  CollapsibleLabSection,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
} from './ui/InteractiveFormulaCard';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../utils/mysteryChallengeEngine';
import {
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import { StandardLabViewShell } from './layout/StandardLabViewShell';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';

export interface ChemistryLabViewProps {
  params: ChemistryParams;
  onChangeParams: (next: ChemistryParams) => void;
  onRecordExperiment: (
    title: string,
    paramsSummary: string,
    metrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup?: (summary: string) => void;
  academicLevel?: AcademicLevel;
  records?: ExperimentRecord[];
  activeStudentName?: string;
  activeGroupId?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onSubmitMysteryExam?: (
    studentName: string,
    result: MysterySubmissionResult,
    title: string
  ) => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  zenMode?: boolean;
  onCapture3DSnapshot?: (
    dataUrl: string,
    moduleTitle: string,
    paramsSummary: string,
    primaryMetric: string
  ) => void;
  snapshotCount?: number;
  completedChallengeIds?: string[];
  onCompleteChallenge?: (challenge: any) => void;
}

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  academicLevel = 'sma',
  records = [],
  onProceedToAnalysis,
  remoteCursors,
  onEmitCursor,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [hazardModalDismissed, setHazardModalDismissed] = useState<boolean>(false);

  const metrics = calculateChemistryMetrics(params);
  const safetyHazard = evaluateSafetyHazard(params as any);

  // Reaction Preset lookup
  const currentPreset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) ||
    THERMO_PRESETS[0];
  const currentRedoxPreset =
    REDOX_PRESETS.find((p) => p.id === params.redoxPairId) ||
    REDOX_PRESETS[0];

  // Subscribe to Global Lab Events
  useEffect(() => {
    const unsubCapture = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, () => {
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 240);
    });
    return () => unsubCapture();
  }, []);

  const handleParamChange = (patch: Partial<ChemistryParams>) => {
    onChangeParams({ ...params, ...patch });
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const title =
      params.mode === 'acid-base-titration'
        ? 'Uji Titrasi Asam-Basa'
        : params.mode === 'electrochemistry-cell'
        ? 'Uji Sel Galvani Volta'
        : params.mode === 'ideal-gas-boyle'
        ? 'Uji Kompresi Gas Boyle'
        : 'Uji Termokimia & Reaksi';

    const pSum =
      params.mode === 'acid-base-titration'
        ? `Vb=${params.titrantAddedMl}mL, Mb=${params.titrantBaseConc}M, Ma=${params.analyteAcidConc}M`
        : `T=${params.initialTempC}°C, Preset=${currentPreset.name}`;

    const numX =
      params.mode === 'acid-base-titration'
        ? params.titrantAddedMl
        : params.mode === 'ideal-gas-boyle'
        ? params.gasVolumeL ?? 10
        : params.initialTempC;

    const numY1 =
      params.mode === 'acid-base-titration'
        ? metrics.currentPh
        : params.mode === 'ideal-gas-boyle'
        ? metrics.gasPressureAtm ?? 1.0
        : metrics.nernstCellPotentialE ?? metrics.deltaTempC;

    onRecordExperiment(
      title,
      pSum,
      {
        'pH Larutan': metrics.currentPh,
        'Volume Titran (mL)': params.titrantAddedMl,
        'E_sel Potensial': `${metrics.nernstCellPotentialE ?? 1.1} V`,
      },
      hypothesisNote?.hypothesisText || '',
      { x: numX ?? 0, y1: numY1 ?? 0, y2: metrics.currentPh }
    );
  };

  const telemetryMetrics = [
    {
      id: 'ph',
      label: 'pH Larutan',
      value: metrics.currentPh,
      min: 0,
      max: 14,
      unit: 'pH',
      color: '#14b8a6',
    },
    {
      id: 'vol',
      label: 'Vol Titran Vb',
      value: params.titrantAddedMl,
      min: 0,
      max: 50,
      unit: 'mL',
      color: '#0ea5e9',
    },
    {
      id: 'veq',
      label: 'Titik Ekuivalen',
      value: metrics.equivalenceVolumeMl,
      min: 0,
      max: 50,
      unit: 'mL',
      color: '#10b981',
    },
  ];

  return (
    <StandardLabViewShell
      domain="Kimia"
      recordsCount={records.length}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: 'pH Indikator',
        primaryValue: metrics.currentPh,
        primaryUnit: 'pH',
        secondaryLabel: 'Vol Titran',
        secondaryValue: params.titrantAddedMl,
        secondaryUnit: 'mL',
        microscopicStateLabel: `Kesetimbangan Ion [H⁺] vs [OH⁻] (Veq = ${metrics.equivalenceVolumeMl} mL)`,
        microscopicDetail: `Warna indikator bereaksi transisi pada trayek pH ekuivalen.`,
        accentColor: '#14b8a6',
      }}
      isHazardous={safetyHazard.isHazardous}
      shutterFlash={shutterFlash}
      zenMode={zenMode}
      activeCameraPreset={activeCameraPreset}
      onSelectCameraPreset={setActiveCameraPreset}
      canvas={
        <ChemistryScene3D
          params={params}
          metrics={metrics}
          preset={currentPreset}
          redoxPreset={currentRedoxPreset}
          reactionProgress={Math.min(1, params.titrantAddedMl / Math.max(1, metrics.equivalenceVolumeMl))}
          isReacting={params.initialTempC > 25}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
          onUpdateParam={(key, val) => handleParamChange({ [key]: val } as any)}
          snapshotCount={snapshotCount}
          onCaptureSnapshot={(dataUrl) => {
            setShutterFlash(true);
            setTimeout(() => setShutterFlash(false), 240);
            onCapture3DSnapshot?.(
              dataUrl,
              'Titrasi & Reaksi Kimia 3D',
              `Vb=${params.titrantAddedMl}mL, T=${params.initialTempC}°C`,
              `pH = ${metrics.currentPh}`
            );
          }}
        />
      }
      safetyModal={
        safetyHazard.isHazardous && !hazardModalDismissed ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-lg w-full rounded-2xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl p-6 space-y-4">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 text-[11px] font-mono font-bold text-rose-300">
                PERINGATAN K3 — KIMIA
              </span>
              <h3 className="text-base font-extrabold text-white">{safetyHazard.title}</h3>
              <p className="text-xs text-slate-300">{safetyHazard.scientificExplanation}</p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHazardModalDismissed(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Saya Paham
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleParamChange({ initialTempC: 25, kineticsTempC: 25 });
                    setHazardModalDismissed(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  Pulihkan ke Parameter Aman
                </button>
              </div>
            </div>
          </div>
        ) : null
      }
      sidebar={
        <>
          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecordTrial}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>+ Catat Data ({records.length}/3)</span>
            </button>

            {onProceedToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onProceedToAnalysis();
                }}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                  records.length >= 3
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                Grafik &amp; LKS →
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Mode Modul Kimia:
            </label>
            <select
              value={params.mode}
              onChange={(e) => {
                labSound.playClick();
                handleParamChange({ mode: e.target.value as any });
              }}
              className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
            >
              <option value="acid-base-titration">Titrasi Asam-Basa (pH &amp; Indikator)</option>
              <option value="thermo-calorimetry">Termokimia &amp; Kalorimetri Entalpi</option>
              <option value="electrochemistry-cell">Sel Elektrokimia Galvani / Volta</option>
              <option value="ideal-gas-boyle">Hukum Gas Ideal Boyle-Gay Lussac</option>
              <option value="reaction-kinetics-arrhenius">Kinetika Reaksi &amp; Arrhenius</option>
              <option value="spectrophotometry-beer">Spektrofotometri UV-Vis Beer-Lambert</option>
            </select>
          </div>

          {/* Direct Burette Dispenser Button */}
          {params.mode === 'acid-base-titration' && (
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
              <span className="font-bold text-xs text-teal-800 dark:text-teal-200 block">
                Aliran Kran Buret 3D:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(680);
                    handleParamChange({
                      titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 1.0).toFixed(1))),
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  +1.0 mL Titran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(720);
                    handleParamChange({
                      titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 5.0).toFixed(1))),
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  +5.0 mL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(440);
                    handleParamChange({ titrantAddedMl: 0 });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Sliders & Parameters */}
          <CollapsibleLabSection title="Variabel & Parameter Larutan" defaultOpen>
            <div className="space-y-3">
              {params.mode === 'acid-base-titration' ? (
                <>
                  <TactileParameterControl
                    label="Volume Titran Buret (Vb)"
                    unit="mL"
                    value={params.titrantAddedMl}
                    min={0}
                    max={50}
                    step={0.5}
                    onChange={(v) => handleParamChange({ titrantAddedMl: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Titran (Mb)"
                    unit="M"
                    value={params.titrantBaseConc}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    onChange={(v) => handleParamChange({ titrantBaseConc: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Analit (Ma)"
                    unit="M"
                    value={params.analyteAcidConc}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    onChange={(v) => handleParamChange({ analyteAcidConc: v })}
                  />
                </>
              ) : (
                <>
                  <TactileParameterControl
                    label="Suhu Pemanas (T)"
                    unit="°C"
                    value={params.initialTempC}
                    min={10}
                    max={90}
                    step={1}
                    onChange={(v) => handleParamChange({ initialTempC: v, kineticsTempC: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Reaktan"
                    unit="M"
                    value={params.reactantConcentration}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    onChange={(v) => handleParamChange({ reactantConcentration: v })}
                  />
                </>
              )}
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title={params.mode === 'acid-base-titration' ? 'Persamaan Titrasi Asam-Basa' : 'Termokimia Gibbs'}
            tokens={[
              { symbol: 'pH', value: metrics.currentPh, unit: '', description: 'Derajat Keasaman' },
              { symbol: 'Vb', value: params.titrantAddedMl, unit: 'mL', description: 'Volume Buret' },
              { symbol: 'Veq', value: metrics.equivalenceVolumeMl, unit: 'mL', description: 'Titik Ekuivalen' },
            ]}
          />
        </>
      }
    />
  );
};
