import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  Sun,
  Moon,
  BookOpen,
  Type,
  Maximize2,
  Minimize2,
  Clock,
  Check,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';

export type ComfortThemeMode = 'light' | 'dark' | 'sepia';
export type EyeComfortTheme = ComfortThemeMode;
export type FontScaleMode = 'normal' | 'comfortable' | 'large';
export type LineSpacingMode = 'standard' | 'relaxed';
export type BlueLightFilterMode = 'off' | 'dusk' | 'night';

export interface SceneThemeColors {
  theme: ComfortThemeMode;
  backgroundHex: number;
  fogHex: number;
  floorHex: number;
  tableHex: number;
  trimHex: number;
  gridPrimaryHex: number;
  gridSecondaryHex: number;
  ambientSkyHex: number;
  ambientGroundHex: number;
  ambientIntensity: number;
  containerBgClass: string;
}

export interface ComfortChartPalette {
  primary: string;
  secondary: string;
  warning: string;
  critical: string;
  canvasBg: string;
  gridStroke: string;
  axisStroke: string;
  labelFill: string;
  pointStroke: string;
}

/**
 * Returns calibrated SVG chart & status palette supporting both standard studio polarity
 * and Okabe-Ito colorblind-safe high-distinction colors across Light, Sepia & Soft Dark modes.
 */
export function getComfortChartPalette(
  theme: ComfortThemeMode = 'light',
  colorBlindSafe = false
): ComfortChartPalette {
  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  if (colorBlindSafe) {
    return {
      primary: isDark ? '#56B4E9' : '#0072B2',
      secondary: '#009E73',
      warning: '#E69F00',
      critical: '#D55E00',
      canvasBg: isDark ? '#111620' : isSepia ? '#F7F1E3' : '#FCFBF7',
      gridStroke: isDark ? '#243044' : isSepia ? '#DDD2BE' : '#E2DDD1',
      axisStroke: isDark ? '#4B5C78' : isSepia ? '#8C7B65' : '#64748B',
      labelFill: isDark ? '#9AA8BD' : isSepia ? '#5C4E3F' : '#475569',
      pointStroke: isDark ? '#182030' : '#FCFBF7',
    };
  }

  return {
    primary: isDark ? '#38BDF8' : '#0284C7',
    secondary: isDark ? '#34D399' : '#059669',
    warning: isDark ? '#FBBF24' : '#D97706',
    critical: isDark ? '#FB7185' : '#E11D48',
    canvasBg: isDark ? '#111620' : isSepia ? '#F7F1E3' : '#FCFBF7',
    gridStroke: isDark ? '#243044' : isSepia ? '#DDD2BE' : '#E2DDD1',
    axisStroke: isDark ? '#4B5C78' : isSepia ? '#8C7B65' : '#64748B',
    labelFill: isDark ? '#9AA8BD' : isSepia ? '#5C4E3F' : '#475569',
    pointStroke: isDark ? '#182030' : '#FCFBF7',
  };
}

/**
 * Synchronizes 3D WebGL canvas background, fog, floor/bench surfaces, and lighting
 * with the user's selected Visual Comfort theme (Warm Paper Studio, Sepia Studio, Observatory Dark).
 * Eliminates pupil shock when transitioning from reading sheets into 3D experiments.
 */
export function getSceneThemeColors(
  comfortTheme: ComfortThemeMode = 'light',
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' = 'Fisika'
): SceneThemeColors {
  if (domain === 'Astronomi') {
    if (comfortTheme === 'light') {
      return {
        theme: 'light',
        backgroundHex: 0x141c2b,
        fogHex: 0x141c2b,
        floorHex: 0x182234,
        tableHex: 0x25324a,
        trimHex: 0x475569,
        gridPrimaryHex: 0x3b4d6b,
        gridSecondaryHex: 0x243044,
        ambientSkyHex: 0xe2e8f0,
        ambientGroundHex: 0x1e293b,
        ambientIntensity: 0.52,
        containerBgClass: 'bg-[#141C2B]',
      };
    }
    if (comfortTheme === 'sepia') {
      return {
        theme: 'sepia',
        backgroundHex: 0x1a1511,
        fogHex: 0x1a1511,
        floorHex: 0x211b16,
        tableHex: 0x2e261f,
        trimHex: 0x574a3c,
        gridPrimaryHex: 0x4d4034,
        gridSecondaryHex: 0x302720,
        ambientSkyHex: 0xfef3c7,
        ambientGroundHex: 0x26201a,
        ambientIntensity: 0.5,
        containerBgClass: 'bg-[#1A1511]',
      };
    }
    return {
      theme: 'dark',
      backgroundHex: 0x0d121d,
      fogHex: 0x0d121d,
      floorHex: 0x121927,
      tableHex: 0x1e293b,
      trimHex: 0x334155,
      gridPrimaryHex: 0x334155,
      gridSecondaryHex: 0x1e293b,
      ambientSkyHex: 0x94a3b8,
      ambientGroundHex: 0x0d131f,
      ambientIntensity: 0.48,
      containerBgClass: 'bg-[#0D121D]',
    };
  }

  if (comfortTheme === 'light') {
    return {
      theme: 'light',
      backgroundHex: 0xe6ecf3,
      fogHex: 0xe6ecf3,
      floorHex: 0xd8e0ea,
      tableHex: 0xc2ccd8,
      trimHex: 0x64748b,
      gridPrimaryHex: 0x9aa8ba,
      gridSecondaryHex: 0xc7d0dc,
      ambientSkyHex: 0xf8fafc,
      ambientGroundHex: 0x94a3b8,
      ambientIntensity: 0.72,
      containerBgClass: 'bg-[#E6ECF3]',
    };
  }

  if (comfortTheme === 'sepia') {
    return {
      theme: 'sepia',
      backgroundHex: 0xe9e0ce,
      fogHex: 0xe9e0ce,
      floorHex: 0xdbd0ba,
      tableHex: 0xc7b699,
      trimHex: 0x786855,
      gridPrimaryHex: 0xa29177,
      gridSecondaryHex: 0xcdc1ab,
      ambientSkyHex: 0xfef6e6,
      ambientGroundHex: 0x8f7e65,
      ambientIntensity: 0.68,
      containerBgClass: 'bg-[#E9E0CE]',
    };
  }

  return {
    theme: 'dark',
    backgroundHex: 0x101622,
    fogHex: 0x101622,
    floorHex: 0x141d2d,
    tableHex: 0x222d42,
    trimHex: 0x334155,
    gridPrimaryHex: 0x384866,
    gridSecondaryHex: 0x212c40,
    ambientSkyHex: 0xdbeafe,
    ambientGroundHex: 0x1e293b,
    ambientIntensity: 0.52,
    containerBgClass: 'bg-[#101622]',
  };
}

export interface VisualComfortPreferences {
  theme: ComfortThemeMode;
  fontScale: FontScaleMode;
  lineSpacing: LineSpacingMode;
  dyslexiaMode: boolean;
  colorBlindSafe: boolean;
  blueLightFilter: BlueLightFilterMode;
  eyeRestReminderEnabled?: boolean;
  eyeRestTimerEnabled?: boolean;
}

interface VisualComfortToolbarProps {
  preferences?: VisualComfortPreferences;
  prefs?: VisualComfortPreferences;
  onChangePreferences?: (next: VisualComfortPreferences) => void;
  onChangePrefs?: (next: VisualComfortPreferences) => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  showZenToggle?: boolean;
  compactTrigger?: boolean;
  popoverPlacement?: 'bottom' | 'top';
}

export const VisualComfortToolbar: React.FC<VisualComfortToolbarProps> = ({
  preferences: propPreferences,
  prefs,
  onChangePreferences,
  onChangePrefs,
  zenMode,
  onToggleZenMode,
  showZenToggle = true,
  compactTrigger = false,
  popoverPlacement = 'bottom',
}) => {
  const preferences: VisualComfortPreferences = propPreferences ||
    prefs || {
      theme: 'light',
      fontScale: 'normal',
      lineSpacing: 'standard',
      dyslexiaMode: false,
      colorBlindSafe: false,
      blueLightFilter: 'off',
      eyeRestReminderEnabled: true,
    };
  const { liteDeviceMode, toggleLiteDeviceMode } = useUIStore(
    useShallow((s) => ({
      liteDeviceMode: s.liteDeviceMode,
      toggleLiteDeviceMode: s.toggleLiteDeviceMode,
    }))
  );
  const eyeRestEnabled =
    preferences.eyeRestReminderEnabled ?? preferences.eyeRestTimerEnabled ?? true;
  const emitChange = (next: VisualComfortPreferences) => {
    if (onChangePreferences) onChangePreferences(next);
    if (onChangePrefs) onChangePrefs(next);
  };

  // Sync HTML root attributes for CSS variables, font scale, line spacing & accessibility modes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', preferences.theme);
    root.setAttribute('data-font-scale', preferences.fontScale);
    root.setAttribute('data-line-spacing', preferences.lineSpacing);
    root.setAttribute('data-dyslexia-mode', preferences.dyslexiaMode ? 'true' : 'false');
    root.setAttribute('data-colorblind', preferences.colorBlindSafe ? 'true' : 'false');
    root.setAttribute('data-blue-light-filter', preferences.blueLightFilter || 'off');
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [
    preferences.theme,
    preferences.fontScale,
    preferences.lineSpacing,
    preferences.dyslexiaMode,
    preferences.colorBlindSafe,
    preferences.blueLightFilter,
  ]);

  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);
  const [secondsUntilRest, setSecondsUntilRest] = useState<number>(20 * 60);
  const [activeRestCountdown, setActiveRestCountdown] = useState<number | null>(null);

  // 20-20-20 Eye-Rest Timer Loop
  useEffect(() => {
    if (!eyeRestEnabled) {
      setActiveRestCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      if (activeRestCountdown !== null) {
        setActiveRestCountdown((prev) => {
          if (prev === null || prev <= 1) {
            labSound.playRecordSuccess();
            setSecondsUntilRest(20 * 60);
            return null;
          }
          return prev - 1;
        });
      } else {
        setSecondsUntilRest((prev) => {
          if (prev <= 1) {
            labSound.playStep();
            setActiveRestCountdown(20);
            return 20 * 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [eyeRestEnabled, activeRestCountdown]);

  const formatMinutes = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const updatePref = (patch: Partial<VisualComfortPreferences>) => {
    labSound.playClick();
    emitChange({ ...preferences, ...patch });
  };

  const themeIcon =
    preferences.theme === 'dark' ? (
      <Moon className="w-3.5 h-3.5 text-sky-400" />
    ) : preferences.theme === 'sepia' ? (
      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
    ) : (
      <Sun className="w-3.5 h-3.5 text-amber-400" />
    );

  const themeLabel =
    preferences.theme === 'dark'
      ? 'Gelap Redup'
      : preferences.theme === 'sepia'
      ? 'Sepia Kertas'
      : 'Terang Hangat';

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Focus / Zen Mode Quick Toggle Button */}
      {showZenToggle && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onToggleZenMode();
          }}
          title={
            zenMode
              ? 'Keluar dari Mode Fokus (Zen Mode)'
              : 'Aktifkan Mode Fokus (Zen Mode) untuk menyembunyikan distraksi'
          }
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            zenMode
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          {zenMode ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="hidden lg:inline">{zenMode ? 'Mode Fokus Aktif' : 'Mode Fokus'}</span>
        </button>
      )}

      {/* Visual Comfort & Ergonomics Popover Trigger */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          setPopoverOpen((v) => !v);
        }}
        title="Pengaturan Kenyamanan Mata, Ukuran Font & Aksesibilitas"
        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
          popoverOpen
            ? 'bg-sky-600 border-sky-500 text-white'
            : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
        }`}
      >
        {themeIcon}
        <span className={compactTrigger ? 'hidden sm:inline' : 'hidden xl:inline'}>
          {themeLabel}
        </span>
        {eyeRestEnabled && !compactTrigger && (
          <>
            <span className="hidden 2xl:inline-block w-px h-3.5 bg-[var(--comfort-border)]" aria-hidden="true" />
            <span className="hidden 2xl:inline font-mono text-[10px] text-[var(--comfort-text-muted)] tabular-nums">
              {formatMinutes(secondsUntilRest)}
            </span>
          </>
        )}
      </button>

      {/* Popover Panel */}
      <AnimatePresence>
        {popoverOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setPopoverOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: popoverPlacement === 'top' ? -6 : 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: popoverPlacement === 'top' ? -6 : 6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className={`absolute z-50 w-80 sm:w-96 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] shadow-2xl p-4 text-xs text-[var(--comfort-text)] space-y-4 select-none ${
                popoverPlacement === 'top'
                  ? 'bottom-12 left-1/2 -translate-x-1/2'
                  : 'right-0 top-11'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <div>
                    <div className="font-bold text-[var(--comfort-text)] text-xs">
                      Kenyamanan Visual &amp; Ergonomi Belajar
                    </div>
                    <div className="text-[11px] text-[var(--comfort-text-muted)]">
                      Kalibrasi luminansi, tipografi &amp; reduksi beban kognitif
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPopoverOpen(false)}
                  aria-label="Tutup Panel Kenyamanan Visual"
                  className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Adaptive Eye-Comfort Theme (3 Modes) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--comfort-text)] flex items-center justify-between">
                  <span>1. Mode Luminansi Layar (Eye-Comfort)</span>
                  <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">Anti-Silau</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      {
                        id: 'light',
                        label: 'Terang Hangat',
                        sub: 'Kertas #F6F3EB',
                        swatch: 'bg-[#F6F3EB] text-slate-900 border-[#DDD6C7]',
                      },
                      {
                        id: 'sepia',
                        label: 'Sepia Kertas',
                        sub: 'Baca LKS #EFE7D6',
                        swatch: 'bg-[#EFE7D6] text-[#2C231A] border-[#D8CCB6]',
                      },
                      {
                        id: 'dark',
                        label: 'Gelap Redup',
                        sub: 'Fokus 3D #111620',
                        swatch: 'bg-[#111620] text-slate-100 border-[#2A374F]',
                      },
                    ] as const
                  ).map((mode) => {
                    const active = preferences.theme === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updatePref({ theme: mode.id })}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          active
                            ? 'border-sky-500 ring-2 ring-sky-500/25 bg-[var(--comfort-surface-subtle)]'
                            : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-sky-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`w-4 h-4 rounded-full border ${mode.swatch}`}
                          />
                          {active && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                        </div>
                        <div className="font-bold text-[var(--comfort-text)] text-[11px] leading-tight">
                          {mode.label}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--comfort-text-muted)]">
                          {mode.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Font Scale & Line Spacing */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--comfort-border)]">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--comfort-text)] flex items-center gap-1">
                    <Type className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Ukuran Teks</span>
                  </div>
                  <div className="flex items-center bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl p-0.5">
                    {(
                      [
                        { id: 'normal', label: '100%' },
                        { id: 'comfortable', label: '106%' },
                        { id: 'large', label: '112%' },
                      ] as const
                    ).map((fs) => (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() => updatePref({ fontScale: fs.id })}
                        className={`flex-1 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                          preferences.fontScale === fs.id
                            ? 'bg-sky-600 text-white'
                            : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                        }`}
                      >
                        {fs.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--comfort-text)]">
                    Spasi Baris Baca
                  </div>
                  <div className="flex items-center bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl p-0.5">
                    {(
                      [
                        { id: 'standard', label: 'Standar' },
                        { id: 'relaxed', label: 'Lega (1.8x)' },
                      ] as const
                    ).map((ls) => (
                      <button
                        key={ls.id}
                        type="button"
                        onClick={() => updatePref({ lineSpacing: ls.id })}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          preferences.lineSpacing === ls.id
                            ? 'bg-sky-600 text-white'
                            : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Color-Blind Safe Palette (Okabe-Ito) */}
              <div className="pt-2 border-t border-[var(--comfort-border)] flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--comfort-text)] text-xs">
                    Mode Ramah Buta Warna (Okabe-Ito)
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)]">
                    Kontras tinggi Biru/Amber + simbol eksplisit (● / ▲ / ✖)
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.colorBlindSafe}
                  onClick={() =>
                    updatePref({ colorBlindSafe: !preferences.colorBlindSafe })
                  }
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                    preferences.colorBlindSafe
                      ? 'bg-sky-600 text-white'
                      : 'bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {preferences.colorBlindSafe ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              {/* 4. 20-20-20 Eye-Rest Timer */}
              <div className="pt-2 border-t border-[var(--comfort-border)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="font-semibold text-[var(--comfort-text)] text-xs">
                        Pengingat Istirahat Mata 20-20-20
                      </div>
                      <div className="text-[11px] text-[var(--comfort-text-muted)]">
                        Tiap 20 menit, tatap objek jauh selama 20 detik
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePref({
                        eyeRestReminderEnabled: !eyeRestEnabled,
                        eyeRestTimerEnabled: !eyeRestEnabled,
                      })
                    }
                    className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-colors cursor-pointer ${
                      eyeRestEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    {eyeRestEnabled ? 'Aktif' : 'Mati'}
                  </button>
                </div>

                {eyeRestEnabled && (
                  <div className="flex items-center justify-between bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl px-3 py-2 text-[11px]">
                    <span className="font-mono text-[var(--comfort-text-muted)] tabular-nums">
                      Jeda berikutnya:{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {formatMinutes(secondsUntilRest)}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setSecondsUntilRest(20 * 60);
                        }}
                        title="Reset Timer 20 Menit"
                        className="p-1.5 rounded bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playStep();
                          setActiveRestCountdown(20);
                          setPopoverOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 font-semibold cursor-pointer"
                      >
                        Istirahat 20d Sekarang
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. 3T Lite GPU & Battery Saver Mode */}
              <div className="pt-2 border-t border-[var(--comfort-border)] flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--comfort-text)] text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Mode Hemat Daya 3T (Lite GPU 30 FPS)</span>
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)]">
                    Optimalkan untuk Chromebook &amp; HP RAM 2GB-4GB (hemat baterai 50%)
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  data-testid="toolbar-lite-mode-switch"
                  aria-checked={liteDeviceMode}
                  onClick={() => {
                    labSound.playClick(liteDeviceMode ? 440 : 660);
                    toggleLiteDeviceMode();
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                    liteDeviceMode
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {liteDeviceMode ? 'Aktif' : 'Mati'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Non-Intrusive 20-20-20 Eye-Rest Floating Toast */}
      <AnimatePresence>
        {activeRestCountdown !== null && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-[var(--comfort-elevated)] border border-emerald-500/45 shadow-2xl p-4 text-xs text-[var(--comfort-text)] flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0 font-mono font-bold text-sm tabular-nums">
              {activeRestCountdown}s
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Jeda Ergonomi Mata 20-20-20</span>
              </div>
              <p className="text-[11px] text-[var(--comfort-text-muted)] leading-relaxed">
                Alihkan pandangan sejauh 6 meter (20 kaki) selama{' '}
                <strong className="font-mono text-[var(--comfort-text)] tabular-nums">
                  {activeRestCountdown} detik
                </strong>{' '}
                untuk merilekskan otot fokus mata. Simulasi tetap aman.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRestCountdown(null)}
              aria-label="Tutup Pengingat"
              className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] p-1 rounded-lg cursor-pointer"
              title="Tutup Pengingat"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
