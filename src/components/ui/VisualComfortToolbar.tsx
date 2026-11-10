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
  Sparkles,
  RotateCcw,
  X,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export type ComfortThemeMode = 'light' | 'dark' | 'sepia';
export type EyeComfortTheme = ComfortThemeMode;
export type FontScaleMode = 'normal' | 'comfortable' | 'large';
export type LineSpacingMode = 'standard' | 'relaxed';

export interface SceneThemeColors {
  theme: ComfortThemeMode;
  backgroundHex: number;
  fogHex: number;
  floorHex: number;
  tableHex: number;
  gridPrimaryHex: number;
  gridSecondaryHex: number;
  ambientSkyHex: number;
  ambientGroundHex: number;
  ambientIntensity: number;
  containerBgClass: string;
}

/**
 * Synchronizes 3D WebGL canvas background, fog, floor/bench surfaces, and lighting
 * with the user's selected Visual Comfort theme (Warm Paper, Sepia, Observatory Dark).
 */
export function getSceneThemeColors(
  comfortTheme: ComfortThemeMode = 'dark',
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' = 'Fisika'
): SceneThemeColors {
  if (domain === 'Astronomi') {
    if (comfortTheme === 'light') {
      return {
        theme: 'light',
        backgroundHex: 0x0f172a,
        fogHex: 0x0f172a,
        floorHex: 0x1e293b,
        tableHex: 0x1e293b,
        gridPrimaryHex: 0x475569,
        gridSecondaryHex: 0x1e293b,
        ambientSkyHex: 0xe2e8f0,
        ambientGroundHex: 0x1e293b,
        ambientIntensity: 0.6,
        containerBgClass: 'bg-[#0F172A]',
      };
    }
    if (comfortTheme === 'sepia') {
      return {
        theme: 'sepia',
        backgroundHex: 0x14110f,
        fogHex: 0x14110f,
        floorHex: 0x26201a,
        tableHex: 0x26201a,
        gridPrimaryHex: 0x5c5346,
        gridSecondaryHex: 0x2a241e,
        ambientSkyHex: 0xfef3c7,
        ambientGroundHex: 0x26201a,
        ambientIntensity: 0.55,
        containerBgClass: 'bg-[#14110F]',
      };
    }
    return {
      theme: 'dark',
      backgroundHex: 0x050811,
      fogHex: 0x050811,
      floorHex: 0x0f172a,
      tableHex: 0x1e293b,
      gridPrimaryHex: 0x334155,
      gridSecondaryHex: 0x0f172a,
      ambientSkyHex: 0x94a3b8,
      ambientGroundHex: 0x090d16,
      ambientIntensity: 0.45,
      containerBgClass: 'bg-[#050811]',
    };
  }

  if (comfortTheme === 'light') {
    return {
      theme: 'light',
      backgroundHex: 0xeef2f6,
      fogHex: 0xeef2f6,
      floorHex: 0xdbe3ec,
      tableHex: 0xcbd5e1,
      gridPrimaryHex: 0x94a3b8,
      gridSecondaryHex: 0xcbd5e1,
      ambientSkyHex: 0xffffff,
      ambientGroundHex: 0x64748b,
      ambientIntensity: 0.9,
      containerBgClass: 'bg-[#EEF2F6]',
    };
  }

  if (comfortTheme === 'sepia') {
    return {
      theme: 'sepia',
      backgroundHex: 0xe9e1d2,
      fogHex: 0xe9e1d2,
      floorHex: 0xd8cebc,
      tableHex: 0xc7bba6,
      gridPrimaryHex: 0x8c7f6b,
      gridSecondaryHex: 0xbdb099,
      ambientSkyHex: 0xfff8eb,
      ambientGroundHex: 0x5c5346,
      ambientIntensity: 0.85,
      containerBgClass: 'bg-[#E9E1D2]',
    };
  }

  return {
    theme: 'dark',
    backgroundHex: 0x0b1120,
    fogHex: 0x0b1120,
    floorHex: 0x0f172a,
    tableHex: 0x1e293b,
    gridPrimaryHex: 0x334155,
    gridSecondaryHex: 0x1e293b,
    ambientSkyHex: 0xe0f2fe,
    ambientGroundHex: 0x1e293b,
    ambientIntensity: 0.65,
    containerBgClass: 'bg-[#0B1120]',
  };
}

export interface VisualComfortPreferences {
  theme: ComfortThemeMode;
  fontScale: FontScaleMode;
  lineSpacing: LineSpacingMode;
  colorBlindSafe: boolean;
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
      theme: 'dark',
      fontScale: 'normal',
      lineSpacing: 'standard',
      colorBlindSafe: false,
      eyeRestReminderEnabled: true,
    };
  const eyeRestEnabled =
    preferences.eyeRestReminderEnabled ?? preferences.eyeRestTimerEnabled ?? true;
  const emitChange = (next: VisualComfortPreferences) => {
    if (onChangePreferences) onChangePreferences(next);
    if (onChangePrefs) onChangePrefs(next);
  };

  // Sync HTML root attributes for CSS variables, font scale, line spacing & colorblind mode
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', preferences.theme);
    root.setAttribute('data-font-scale', preferences.fontScale);
    root.setAttribute('data-line-spacing', preferences.lineSpacing);
    root.setAttribute('data-colorblind', preferences.colorBlindSafe ? 'true' : 'false');
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [
    preferences.theme,
    preferences.fontScale,
    preferences.lineSpacing,
    preferences.colorBlindSafe,
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
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          {zenMode ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
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
            : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white'
        }`}
      >
        {themeIcon}
        <span className={compactTrigger ? 'hidden sm:inline' : 'hidden xl:inline'}>
          {themeLabel}
        </span>
        {eyeRestEnabled && !compactTrigger && (
          <span className="hidden 2xl:inline font-mono text-[10px] text-slate-400 pl-1 border-l border-slate-700 tabular-nums">
            {formatMinutes(secondsUntilRest)}
          </span>
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
              className={`absolute z-50 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-4 text-xs text-slate-100 space-y-4 select-none ${
                popoverPlacement === 'top'
                  ? 'bottom-12 left-1/2 -translate-x-1/2'
                  : 'right-0 top-11'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <div>
                    <div className="font-bold text-white text-xs">
                      Kenyamanan Visual & Ergonomi Belajar
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Kalibrasi luminansi, tipografi & reduksi beban kognitif
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPopoverOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Adaptive Eye-Comfort Theme (3 Modes) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span>1. Mode Luminansi Layar (Eye-Comfort)</span>
                  <span className="font-mono text-[10px] text-sky-400">Anti-Silau</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      {
                        id: 'light',
                        label: 'Terang Hangat',
                        sub: 'Kertas #FAF8F5',
                        swatch: 'bg-[#FAF8F5] text-slate-900 border-slate-300',
                      },
                      {
                        id: 'sepia',
                        label: 'Sepia Kertas',
                        sub: 'Baca LKS #F3EFE6',
                        swatch: 'bg-[#F3EFE6] text-[#2A241E] border-[#D5CBB8]',
                      },
                      {
                        id: 'dark',
                        label: 'Gelap Redup',
                        sub: 'Fokus 3D #0B0F17',
                        swatch: 'bg-[#0B0F17] text-slate-100 border-slate-700',
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
                            ? 'border-sky-400 ring-2 ring-sky-500/30 bg-slate-800'
                            : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`w-4 h-4 rounded-full border ${mode.swatch}`}
                          />
                          {active && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <div className="font-bold text-white text-[11px] leading-tight">
                          {mode.label}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {mode.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Font Scale & Line Spacing */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Type className="w-3.5 h-3.5 text-sky-400" />
                    <span>Ukuran Teks</span>
                  </div>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
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
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {fs.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Spasi Baris Baca
                  </div>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
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
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Color-Blind Safe Palette (Okabe-Ito) */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white text-xs">
                    Mode Ramah Buta Warna (Okabe-Ito)
                  </div>
                  <div className="text-[11px] text-slate-400">
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
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preferences.colorBlindSafe ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              {/* 4. 20-20-20 Eye-Rest Timer */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-white text-xs">
                        Pengingat Istirahat Mata 20-20-20
                      </div>
                      <div className="text-[11px] text-slate-400">
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
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {eyeRestEnabled ? 'Aktif' : 'Mati'}
                  </button>
                </div>

                {eyeRestEnabled && (
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px]">
                    <span className="font-mono text-slate-300 tabular-nums">
                      Jeda berikutnya:{' '}
                      <strong className="text-emerald-400">
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
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
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
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
                      >
                        Istirahat 20d Sekarang
                      </button>
                    </div>
                  </div>
                )}
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
            className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl p-4 text-xs text-white flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 font-mono font-bold text-sm tabular-nums">
              {activeRestCountdown}s
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Jeda Ergonomi Mata 20-20-20</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Alihkan pandangan sejauh 6 meter (20 kaki) selama{' '}
                <strong className="font-mono text-white tabular-nums">
                  {activeRestCountdown} detik
                </strong>{' '}
                untuk merilekskan otot fokus mata. Simulasi tetap aman.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRestCountdown(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
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
