import React from 'react';
import {
  BookOpen,
  Clock,
  Eye,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Sun,
  Type,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import {
  BlueLightFilterMode,
  ComfortThemeMode,
  FontScaleMode,
  LineSpacingMode,
  VisualComfortPreferences,
  getComfortChartPalette,
} from '../../ui/VisualComfortToolbar';
import { labSound } from '../../../utils/soundEngine';
import { useUIStore } from '../../../stores/useUIStore';

export interface EyeComfortSettingsSectionProps {
  comfortPrefs: VisualComfortPreferences;
  projectorMode: boolean;
  onThemeSwitch: (theme: ComfortThemeMode) => void;
  onClosePopover: () => void;
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const EyeComfortSettingsSection: React.FC<EyeComfortSettingsSectionProps> = ({
  comfortPrefs,
  projectorMode,
  onThemeSwitch,
  onClosePopover,
}) => {
  const { t } = useTranslation();

  const {
    setComfortPrefs,
    eyeRestSecondsLeft,
    eyeRestPaused,
    toggleEyeRestPaused,
    resetEyeRestCycle,
    triggerEyeRestNow,
  } = useUIStore(
    useShallow((s) => ({
      setComfortPrefs: s.setComfortPrefs,
      eyeRestSecondsLeft: s.eyeRestSecondsLeft,
      eyeRestPaused: s.eyeRestPaused,
      toggleEyeRestPaused: s.toggleEyeRestPaused,
      resetEyeRestCycle: s.resetEyeRestCycle,
      triggerEyeRestNow: s.triggerEyeRestNow,
    }))
  );

  const eyeRestEnabled =
    comfortPrefs.eyeRestTimerEnabled ?? comfortPrefs.eyeRestReminderEnabled ?? true;
  const chartPalette = getComfortChartPalette(comfortPrefs.theme, comfortPrefs.colorBlindSafe);

  return (
    <div className="space-y-2.5 pb-2.5 border-b border-[var(--comfort-border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
          <span>Kenyamanan Mata &amp; Ergonomi</span>
        </span>
        <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
          Anti-Silau
        </span>
      </div>

      {/* Embedded Live Preview Card */}
      <div
        data-testid="eye-comfort-live-preview"
        className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-2.5 space-y-2 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 text-2xs font-semibold text-[var(--comfort-text-muted)]">
          <span>Pratinjau Baca &amp; Grafik Langsung</span>
          <span className="font-mono">
            {comfortPrefs.dyslexiaMode ? 'BDA Disleksia' : 'Standar'}
            {comfortPrefs.colorBlindSafe ? ' · Okabe-Ito' : ''}
          </span>
        </div>
        <p className="comfort-report-prose text-[var(--comfort-text)] text-left transition-all">
          Hukum II Newton: percepatan sebanding gaya total (<strong>a = ΣF / m</strong>).
        </p>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--comfort-border)]">
          <svg viewBox="0 0 120 26" className="w-28 h-6 shrink-0" aria-hidden="true">
            <rect x="4" y="12" width="12" height="10" rx="2" fill={chartPalette.primary} />
            <rect x="20" y="7" width="12" height="15" rx="2" fill={chartPalette.secondary} />
            <rect x="36" y="4" width="12" height="18" rx="2" fill={chartPalette.warning} />
            <path
              d="M 56 20 L 76 13 L 96 15 L 114 5"
              fill="none"
              stroke={chartPalette.primary}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="114" cy="5" r="3" fill={chartPalette.secondary} />
          </svg>
          <div className="flex items-center gap-2 text-2xs font-mono font-semibold">
            <span style={{ color: chartPalette.secondary }}>● Aman</span>
            <span style={{ color: chartPalette.warning }}>▲ Waspada</span>
          </div>
        </div>
      </div>

      {/* 1. Theme Selector (Warm Paper / Sepia / Soft Dark) */}
      <div className="space-y-1">
        <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
          Tema Tampilan
        </span>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
          {(
            [
              { id: 'light' as ComfortThemeMode, label: t('nav.themeLight'), Icon: Sun },
              { id: 'sepia' as ComfortThemeMode, label: t('nav.themeSepia'), Icon: BookOpen },
              { id: 'dark' as ComfortThemeMode, label: t('nav.themeDark'), Icon: Moon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = comfortPrefs.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onThemeSwitch(id)}
                className={`py-1.5 px-1 rounded-md font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                <Icon
                  className={`w-3 h-3 shrink-0 ${
                    active ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Blue-Light Warmth Filter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
            Filter Cahaya Biru
          </span>
          {projectorMode && (
            <span className="text-2xs font-mono text-[var(--comfort-warning)]">
              Dijeda saat Proyektor Aktif
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
          {(
            [
              { id: 'off' as BlueLightFilterMode, label: 'Mati' },
              { id: 'dusk' as BlueLightFilterMode, label: 'Sore (Hangat)' },
              { id: 'night' as BlueLightFilterMode, label: 'Malam (Amber)' },
            ] as const
          ).map((item) => {
            const active = (comfortPrefs.blueLightFilter || 'off') === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`blue-light-filter-${item.id}`}
                onClick={() => {
                  labSound.playClick();
                  setComfortPrefs({ blueLightFilter: item.id });
                }}
                className={`py-1.5 px-1 rounded-md text-2xs font-semibold text-center cursor-pointer transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Font Scale & Line Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-2xs font-semibold text-[var(--comfort-text-muted)] flex items-center gap-1">
            <Type className="w-3 h-3" />
            <span>Ukuran Teks</span>
          </span>
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono">
            {(
              [
                { id: 'normal' as FontScaleMode, label: '100%' },
                { id: 'comfortable' as FontScaleMode, label: '106%' },
                { id: 'large' as FontScaleMode, label: '112%' },
              ] as const
            ).map((fs) => {
              const active = comfortPrefs.fontScale === fs.id;
              return (
                <button
                  key={fs.id}
                  type="button"
                  data-testid={`font-scale-${fs.id}`}
                  onClick={() => {
                    labSound.playClick();
                    setComfortPrefs({ fontScale: fs.id });
                  }}
                  className={`flex-1 py-1 rounded-md text-2xs font-bold text-center cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {fs.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
            Spasi Baris LKS
          </span>
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
            {(
              [
                { id: 'standard' as LineSpacingMode, label: 'Standar' },
                { id: 'relaxed' as LineSpacingMode, label: 'Lega 1.8x' },
              ] as const
            ).map((ls) => {
              const active = comfortPrefs.lineSpacing === ls.id;
              return (
                <button
                  key={ls.id}
                  type="button"
                  data-testid={`line-spacing-${ls.id}`}
                  onClick={() => {
                    labSound.playClick();
                    setComfortPrefs({ lineSpacing: ls.id });
                  }}
                  className={`flex-1 py-1 rounded-md text-2xs font-semibold text-center cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {ls.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Accessibility Switches: Dyslexia Mode & Okabe-Ito Colorblind */}
      <div className="space-y-1.5 pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={comfortPrefs.dyslexiaMode}
          data-testid="dyslexia-mode-switch"
          onClick={() => {
            labSound.playClick();
            setComfortPrefs({ dyslexiaMode: !comfortPrefs.dyslexiaMode });
          }}
          className={`w-full px-2.5 py-2 flex items-center justify-between gap-2 rounded-lg border text-left cursor-pointer transition-colors ${
            comfortPrefs.dyslexiaMode
              ? 'comfort-accent-soft text-[var(--comfort-text)]'
              : 'comfort-btn-secondary'
          }`}
        >
          <div className="min-w-0">
            <div className="font-semibold text-2xs flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
              <span>Mode Ramah Disleksia (BDA)</span>
            </div>
            <div className="text-2xs text-[var(--comfort-text-muted)]">
              Spasi huruf &amp; kata lega, rata kiri tanpa miring
            </div>
          </div>
          <span
            className={`font-mono text-2xs font-bold shrink-0 ${
              comfortPrefs.dyslexiaMode
                ? 'text-[var(--comfort-accent)]'
                : 'text-[var(--comfort-text-muted)]'
            }`}
          >
            {comfortPrefs.dyslexiaMode ? 'Aktif' : 'Off'}
          </span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={comfortPrefs.colorBlindSafe}
          data-testid="colorblind-safe-switch"
          onClick={() => {
            labSound.playClick();
            setComfortPrefs({ colorBlindSafe: !comfortPrefs.colorBlindSafe });
          }}
          className={`w-full px-2.5 py-2 flex items-center justify-between gap-2 rounded-lg border text-left cursor-pointer transition-colors ${
            comfortPrefs.colorBlindSafe
              ? 'comfort-accent-soft text-[var(--comfort-text)]'
              : 'comfort-btn-secondary'
          }`}
        >
          <div className="min-w-0">
            <div className="font-semibold text-2xs flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
              <span>Palet Buta Warna (Okabe-Ito)</span>
            </div>
            <div className="text-2xs text-[var(--comfort-text-muted)]">
              Biru/oranye kontras tinggi + simbol status (● ▲ ◆)
            </div>
          </div>
          <span
            className={`font-mono text-2xs font-bold shrink-0 ${
              comfortPrefs.colorBlindSafe
                ? 'text-[var(--comfort-accent)]'
                : 'text-[var(--comfort-text-muted)]'
            }`}
          >
            {comfortPrefs.colorBlindSafe ? 'Aktif' : 'Off'}
          </span>
        </button>
      </div>

      {/* 5. 20-20-20 Eye-Rest Scheduler Row */}
      <div
        data-testid="eye-rest-settings-row"
        className="rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-2.5 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-2xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
              <span>Pengingat Istirahat 20-20-20</span>
            </div>
            <div className="text-2xs text-[var(--comfort-text-muted)]">
              Tiap 20 menit, tatap jarak ≥ 6 m selama 20 detik
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={eyeRestEnabled}
            data-testid="eye-rest-enabled-switch"
            onClick={() => {
              labSound.playClick();
              setComfortPrefs({
                eyeRestTimerEnabled: !eyeRestEnabled,
                eyeRestReminderEnabled: !eyeRestEnabled,
              });
            }}
            className={`px-2 py-1 rounded-md font-mono text-2xs font-bold border cursor-pointer shrink-0 transition-colors ${
              eyeRestEnabled
                ? 'comfort-tab-active border-transparent'
                : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] border-[var(--comfort-border)]'
            }`}
          >
            {eyeRestEnabled ? 'Aktif' : 'Mati'}
          </button>
        </div>

        {eyeRestEnabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--comfort-border)] text-2xs">
            <span className="font-mono tabular-nums text-[var(--comfort-text-muted)]">
              Berikutnya:{' '}
              <strong className="text-[var(--comfort-text)]">
                {formatClock(eyeRestSecondsLeft)}
              </strong>
              {eyeRestPaused ? ' (Dijeda)' : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  toggleEyeRestPaused();
                }}
                className="px-2 py-1 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-2xs font-semibold cursor-pointer hover:opacity-85"
              >
                {eyeRestPaused ? 'Lanjut' : 'Jeda'}
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  resetEyeRestCycle();
                }}
                title="Reset siklus 20 menit"
                className="p-1 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                type="button"
                data-testid="eye-rest-trigger-now-btn"
                onClick={() => {
                  labSound.playStep();
                  triggerEyeRestNow();
                  onClosePopover();
                }}
                className="px-2 py-1 rounded-md comfort-btn-primary font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Mulai 20d</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
