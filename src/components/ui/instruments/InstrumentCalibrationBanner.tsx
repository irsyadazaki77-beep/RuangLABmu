import React from 'react';
import { Sliders, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';
import { InstrumentCalibrationConfig } from '../../../utils/uncertaintyEngine';

export interface InstrumentCalibrationCardProps {
  instrumentName: string;
  unit: string;
  rawValue: number;
  baseUncertaintyDelta: number;
  config: InstrumentCalibrationConfig;
  onChangeConfig: (next: InstrumentCalibrationConfig) => void;
}

export const InstrumentCalibrationCard: React.FC<
  InstrumentCalibrationCardProps
> = ({
  instrumentName,
  unit,
  rawValue,
  baseUncertaintyDelta,
  config,
  onChangeConfig,
}) => {
  const effectiveDelta =
    config.precisionTier === 'high-precision'
      ? Number((baseUncertaintyDelta * 0.35).toFixed(4))
      : baseUncertaintyDelta;

  const activeZeroOffset = config.isZeroCalibrated ? 0 : config.zeroOffsetBias;
  const calibratedValue = Number((rawValue + activeZeroOffset).toFixed(3));

  return (
    <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="text-xs font-bold text-[var(--comfort-text)]">
            Kalibrasi Alat Ukur &amp; Ketidakpastian ({instrumentName})
          </span>
        </div>
        <span
          className={`text-[11px] font-mono font-semibold ${
            config.isZeroCalibrated
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {config.isZeroCalibrated
            ? '● Terkalibrasi (Zero-Tare Aktif)'
            : `▲ Bias Nol: ${config.zeroOffsetBias >= 0 ? '+' : ''}${config.zeroOffsetBias.toFixed(2)} ${unit}`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-1 bg-[var(--comfort-surface)] p-1 rounded-lg border border-[var(--comfort-border)]">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({ ...config, precisionTier: 'standard' });
            }}
            className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              config.precisionTier === 'standard'
                ? 'bg-sky-600 text-white'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            Standar (±{baseUncertaintyDelta} {unit})
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({ ...config, precisionTier: 'high-precision' });
            }}
            className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              config.precisionTier === 'high-precision'
                ? 'bg-emerald-600 text-white'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            Presisi Tinggi (±{Number((baseUncertaintyDelta * 0.35).toFixed(3))} {unit})
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              labSound.playSuccessChime();
              onChangeConfig({
                ...config,
                isZeroCalibrated: true,
                zeroOffsetBias: 0,
              });
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer min-h-[36px]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Kalibrasi Nol (Tare)
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({
                ...config,
                isZeroCalibrated: false,
                zeroOffsetBias: Number(
                  ((Math.random() > 0.5 ? 1 : -1) * baseUncertaintyDelta * 3).toFixed(2)
                ),
              });
            }}
            title="Simulasikan pergeseran titik nol (Zero Drift) sebelum kalibrasi"
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-[var(--comfort-surface)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-[var(--comfort-border)] transition-colors cursor-pointer min-h-[36px]"
          >
            <RotateCcw className="w-3 h-3 text-amber-500" />
            Uji Drift
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--comfort-border)] text-[11px] font-mono tabular-nums">
        <span className="text-[var(--comfort-text-muted)]">
          Nilai Teoretis:{' '}
          <strong className="text-[var(--comfort-text)]">
            {rawValue.toFixed(2)} {unit}
          </strong>
        </span>
        <span className="text-sky-700 dark:text-sky-300 font-bold">
          Bacaan Alat: {calibratedValue.toFixed(2)} ± {effectiveDelta} {unit}
        </span>
      </div>
    </div>
  );
};

export interface CockpitStepGuideBannerProps {
  recordsCount: number;
  targetCount?: number;
  onProceedToAnalysis?: () => void;
  domainLabel: string;
}

export const CockpitStepGuideBanner: React.FC<CockpitStepGuideBannerProps> = ({
  recordsCount,
  targetCount = 3,
  onProceedToAnalysis,
  domainLabel,
}) => {
  const isReady = recordsCount >= targetCount;

  return (
    <div
      className={`rounded-2xl border p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
        isReady
          ? 'bg-emerald-500/10 border-emerald-500/40 text-[var(--comfort-text)]'
          : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span
            className={
              isReady
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-sky-700 dark:text-sky-400 font-semibold'
            }
          >
            {isReady ? '✓ TARGET DATA TERCAPAI' : `PANDUAN TAHAP 2 · ${domainLabel.toUpperCase()}`}
          </span>
          <span className="text-[var(--comfort-text-muted)]">·</span>
          <span className="tabular-nums text-[var(--comfort-text)] font-semibold">
            {recordsCount}/{targetCount} Data
          </span>
        </div>
        <p className="text-xs text-[var(--comfort-text-muted)] leading-snug mt-0.5">
          {isReady
            ? 'Data pengamatan sudah cukup! Klik tombol Lanjut untuk menganalisis kurva regresi & menjawab LKS.'
            : `Atur slider variabel di bawah, jalankan simulasi, lalu klik "+ Catat Data" minimal ${targetCount} kali.`}
        </p>
      </div>

      {onProceedToAnalysis && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onProceedToAnalysis();
          }}
          className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer whitespace-nowrap ${
            isReady
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              : 'bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-[var(--comfort-border)]'
          }`}
        >
          <span>{isReady ? 'Lanjut ke Grafik & LKS' : 'Grafik & LKS'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
