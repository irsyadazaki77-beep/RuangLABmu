import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import {
  Activity,
  ArrowLeft,
  Bot,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  Copy,
  Cpu,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useLabStore, DOMAIN_TO_ID } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useAdaptiveQuality } from '../../hooks/useAdaptiveQuality';
import { getExperimentById } from '../../registry/experimentRegistry';
import { LiveFormulaCard } from '../telemetry/LiveFormulaCard';
import { TelemetryGauge } from '../telemetry/TelemetryGauge';
import { SPRING_DRAWER, SPRING_TACTILE } from '../../styles/motionPresets';
import { labSound } from '../../utils/soundEngine';
import type { ExperimentRecord } from '../../utils/scienceEngine';

export type CameraPreset = string;

export const DEFAULT_SIDEBAR_WIDTH_PX = 360;

export function clampSplitSidebarWidth(
  requestedWidthPx: number,
  viewportWidthPx: number
): number {
  const minWidth = 280;
  const maxWidth = Math.max(minWidth, Math.floor(viewportWidthPx * 0.55));
  if (!Number.isFinite(requestedWidthPx)) return DEFAULT_SIDEBAR_WIDTH_PX;
  return Math.min(maxWidth, Math.max(minWidth, Math.round(requestedWidthPx)));
}

export interface TelemetryMetricDescriptor {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color?: string;
  precision?: number;
}

export interface OscilloscopeHudDescriptor {
  primaryLabel: string;
  primaryValue: number;
  primaryUnit: string;
  secondaryLabel: string;
  secondaryValue: number;
  secondaryUnit: string;
  microscopicStateLabel: string;
  microscopicDetail: string;
  accentColor: string;
}

export interface StandardLabViewShellProps {
  domain: string;
  recordsCount: number;
  hypothesisText?: string;
  recentRecords: ExperimentRecord[];
  onProceedToAnalysis?: () => void;
  onDeleteRecord?: (id: string) => void;
  onBackToPreLab?: () => void;
  telemetryMetrics: TelemetryMetricDescriptor[];
  oscilloscope?: OscilloscopeHudDescriptor;
  isHazardous?: boolean;
  shutterFlash?: boolean;
  zenMode?: boolean;
  activeCameraPreset?: CameraPreset;
  onSelectCameraPreset?: (preset: CameraPreset) => void;
  dualModeActive?: boolean;
  onToggleDualMode?: () => void;
  dualViewport?: React.ReactNode;
  topOverlay?: React.ReactNode;
  canvas: React.ReactNode;
  safetyModal?: React.ReactNode;
  sidebar: React.ReactNode;
}

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'iso', label: 'Isometrik' },
  { id: 'front', label: 'Depan' },
  { id: 'top', label: 'Atas' },
  { id: 'side', label: 'Samping' },
];

/**
 * Full-Bleed Spatial HUD Workspace & Responsive Workbench Shell
 * - 3D Viewport centerpiece with floating Spatial HUD top bar
 * - Keyboard shortcuts '[' (toggle Parameter Drawer) and ']' (toggle Telemetry & Formula HUD)
 * - "Focus 3D" button collapsing all side panels simultaneously
 * - Mobile collapsible bottom sheet with zero horizontal overflow
 */
export const StandardLabViewShell: React.FC<StandardLabViewShellProps> = ({
  domain,
  recordsCount,
  hypothesisText,
  recentRecords,
  onProceedToAnalysis,
  onDeleteRecord,
  onBackToPreLab,
  telemetryMetrics,
  oscilloscope,
  isHazardous = false,
  shutterFlash = false,
  zenMode: propZenMode,
  activeCameraPreset = 'iso',
  onSelectCameraPreset,
  dualModeActive = false,
  onToggleDualMode,
  dualViewport,
  topOverlay,
  canvas,
  safetyModal,
  sidebar,
}) => {
  const {
    storeZenMode,
    toggleZenMode,
    setDrawerTab,
    sidebarWidthPx,
    setSidebarWidthPx,
  } = useUIStore(
    useShallow((s) => ({
      storeZenMode: s.zenMode,
      toggleZenMode: s.toggleZenMode,
      setDrawerTab: s.setDrawerTab,
      sidebarWidthPx: s.sidebarWidthPx,
      setSidebarWidthPx: s.setSidebarWidthPx,
    }))
  );

  const zenMode = propZenMode ?? storeZenMode;

  const { activeDomain, activeModuleId, setIsLobbyMode } = useLabStore(
    useShallow((s) => ({
      activeDomain: s.activeDomain,
      activeModuleId: s.activeModuleId,
      setIsLobbyMode: s.setIsLobbyMode,
    }))
  );

  const { activeRoomId, wsConnected } = useCollabStore(
    useShallow((s) => ({
      activeRoomId: s.activeRoomId,
      wsConnected: s.wsConnected,
    }))
  );

  const { tier: qualityTier, controller: qualityController } = useAdaptiveQuality(true);
  const currentFps = Math.round(qualityController.getRollingFps());

  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightTelemetryOpen, setRightTelemetryOpen] = useState(true);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(true);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcuts '[' and ']' to toggle Parameter Drawer & Telemetry/Formula HUD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        labSound.playClick();
        if (zenMode) toggleZenMode();
        setLeftDrawerOpen((prev) => !prev);
      } else if (e.key === ']') {
        e.preventDefault();
        labSound.playClick();
        if (zenMode) toggleZenMode();
        setRightTelemetryOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zenMode, toggleZenMode]);

  const activeExperiment = getExperimentById(activeModuleId);
  const domainLabel = domain || DOMAIN_TO_ID[activeDomain] || 'Sains';
  const moduleTitle = activeExperiment?.title || activeModuleId;
  const formulaEquation = activeExperiment?.keyEquations?.[0] || 'F = m · a';

  const handleCopyRoomPin = () => {
    if (!activeRoomId || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(activeRoomId).then(() => {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 1800);
    });
  };

  const handleToggleFocus3D = () => {
    labSound.playClick();
    toggleZenMode();
  };

  const isSidebarVisible = !zenMode && leftDrawerOpen;
  const isRightTelemetryVisible = !zenMode && rightTelemetryOpen;

  return (
    <div
      data-testid="spatial-hud-shell"
      className="space-y-3 w-full max-w-full overflow-x-hidden transition-colors duration-300"
    >
      {/* 1. Spatial HUD Floating Top Bar: Breadcrumb + Room PIN + 3T Status + FPS/Quality + Drawer Toggles */}
      <div
        data-testid="spatial-hud-top-bar"
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)]/95 backdrop-blur-md px-3 py-2 shadow-sm"
      >
        {/* Breadcrumb: Lobby / [Domain] / [Module] */}
        <nav
          aria-label="Breadcrumb Ruang Praktikum"
          className="flex items-center gap-1.5 text-xs min-w-0"
        >
          {onBackToPreLab && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToPreLab();
              }}
              title="Kembali ke Tahap 1 Briefing Pra-Lab"
              className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setIsLobbyMode(true);
            }}
            className="font-semibold text-[var(--comfort-text-muted)] hover:text-sky-500 transition-colors cursor-pointer shrink-0"
          >
            Lobby
          </button>
          <span className="text-[var(--comfort-text-muted)]">/</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400 shrink-0 capitalize">
            {domainLabel}
          </span>
          <span className="text-[var(--comfort-text-muted)]">/</span>
          <span className="font-bold text-[var(--comfort-text)] truncate max-w-[160px] sm:max-w-[260px]">
            {moduleTitle}
          </span>
        </nav>

        {/* Right HUD Pills: Room PIN Copy + 3T Connection + FPS/Quality Tier + Dual Reality + Panel Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeRoomId && (
            <button
              type="button"
              onClick={handleCopyRoomPin}
              title="Salin PIN Room Kolaborasi"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              <span>PIN: {activeRoomId}</span>
              {copiedPin ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-80" />
              )}
            </button>
          )}

          {/* Live 3T Connection / Offline Sync Pill */}
          <span
            data-testid="hud-3t-connection-pill"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300'
            }`}
            title={
              isOnline
                ? wsConnected
                  ? 'Sinkronisasi Real-Time Aktif'
                  : 'Jaringan Online (Siap Sinkron)'
                : 'Mode Luring 3T Aktif (Antrean Lokal SQLite/IndexedDB)'
            }
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">
              {isOnline ? '3T Sinkron' : 'Mode Luring 3T'}
            </span>
          </span>

          {/* Rolling FPS & Adaptive Quality Tier Badge */}
          <span
            data-testid="hud-fps-quality-badge"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/85 border border-slate-700/80 text-cyan-300 font-mono text-[10px] font-bold tabular-nums"
            title="Kualitas Adaptif WebGL 3T & Frame Rate"
          >
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>{currentFps} FPS</span>
            <span className="uppercase text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-200">
              {qualityTier}
            </span>
          </span>

          {onToggleDualMode && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onToggleDualMode();
              }}
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                dualModeActive
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300'
                  : 'bg-[var(--comfort-bg)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
              title="Bandingkan Dua Realitas Parameter (A vs B)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Komparasi A/B</span>
            </button>
          )}

          {/* Left Drawer Toggle '[' */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              if (zenMode) toggleZenMode();
              setLeftDrawerOpen((prev) => !prev);
            }}
            aria-label="Toggle Panel Parameter ([)"
            title="Tampilkan/Sembunyikan Panel Parameter (Pintasan: [)"
            className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              isSidebarVisible
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300'
                : 'bg-[var(--comfort-bg)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
            }`}
          >
            {isSidebarVisible ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
            <span>Kontrol</span>
            <kbd className="text-[9px] font-mono opacity-75">[</kbd>
          </button>

          {/* Right Telemetry & Formula Toggle ']' */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              if (zenMode) toggleZenMode();
              setRightTelemetryOpen((prev) => !prev);
            }}
            aria-label="Toggle Panel Telemetri & Rumus (])"
            title="Tampilkan/Sembunyikan Telemetri & Rumus Hidup (Pintasan: ])"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              isRightTelemetryVisible
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-[var(--comfort-bg)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
            }`}
          >
            {isRightTelemetryVisible ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Telemetri</span>
            <kbd className="text-[9px] font-mono opacity-75">]</kbd>
          </button>

          {/* Focus 3D Button (Collapses all drawers simultaneously) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={SPRING_TACTILE}
            onClick={handleToggleFocus3D}
            data-testid="focus-3d-toggle-btn"
            aria-pressed={zenMode}
            title="Mode Fokus 3D Penuh (Sembunyikan Semua Panel)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
              zenMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                : 'bg-[var(--comfort-bg)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-sky-500/50'
            }`}
          >
            {zenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Keluar Focus 3D</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus 3D</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 2. Main Spatial Grid: Full-Bleed 3D Viewport + Collapsible Side Panels */}
      <div
        className={`grid grid-cols-1 ${
          isSidebarVisible ? 'lg:grid-cols-12' : 'lg:grid-cols-1'
        } gap-4 items-start transition-all duration-300`}
      >
        {/* Left / Centerpiece Column: 3D Viewport + Floating Camera/Telemetry Overlays */}
        <div
          className={`${
            isSidebarVisible ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-1'
          } flex flex-col gap-3 min-w-0`}
        >
          {dualModeActive && dualViewport ? (
            dualViewport
          ) : (
            <div
              className={`relative w-full ${
                zenMode
                  ? 'h-[80vh] min-h-[520px]'
                  : 'aspect-4/3 sm:aspect-16/10 min-h-[300px] sm:min-h-[440px] max-h-[70vh]'
              } rounded-2xl overflow-hidden border bg-slate-950 shadow-2xl transition-all duration-300 ${
                isHazardous
                  ? 'border-rose-500/80 ring-2 ring-rose-500/40'
                  : 'border-cyan-500/35 shadow-cyan-950/25'
              }`}
            >
              {/* 3D Canvas */}
              {canvas}

              {/* Camera Snapshot Shutter Flash */}
              {shutterFlash && (
                <div className="pointer-events-none absolute inset-0 z-40 bg-white/80 animate-ping" />
              )}

              {/* Floating Top-Left Overlay (e.g. Vector Toggle) + Camera Presets */}
              <div className="pointer-events-none absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2">
                <div className="pointer-events-auto flex items-center gap-1.5">
                  {topOverlay}
                </div>

                {onSelectCameraPreset && (
                  <div className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono">
                    <Camera className="w-3.5 h-3.5 text-sky-400 ml-1 mr-0.5 hidden sm:inline" />
                    {CAMERA_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          onSelectCameraPreset(preset.id);
                        }}
                        className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                          activeCameraPreset === preset.id
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Bottom-Left Oscilloscope / Microscopic Readout Pill */}
              {oscilloscope && !zenMode && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-end justify-between gap-2">
                  <div className="pointer-events-auto max-w-md rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-2 text-xs text-slate-200 shadow-lg space-y-0.5">
                    <div className="font-mono text-[11px] font-bold text-sky-300 truncate">
                      {oscilloscope.microscopicStateLabel}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1">
                      {oscilloscope.microscopicDetail}
                    </p>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-1.5">
                    {telemetryMetrics.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 px-2.5 py-1.5 font-mono text-xs tabular-nums shadow-lg"
                      >
                        <div className="text-[9px] text-slate-400 truncate max-w-[96px]">
                          {m.label}
                        </div>
                        <div className="font-bold text-white">
                          {Number.isFinite(m.value)
                            ? m.value.toFixed(m.precision ?? 2)
                            : '0.00'}{' '}
                          <span className="text-[10px] text-sky-300 font-normal">
                            {m.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Student Hypothesis Reminder & Recent Recorded Observations Strip */}
          {!zenMode && (hypothesisText || recentRecords.length > 0) && (
            <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 space-y-2 text-xs">
              {hypothesisText && (
                <div className="flex items-start gap-2 text-[var(--comfort-text)]">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-mono text-[10px] font-bold shrink-0">
                    Hipotesis Awal
                  </span>
                  <p className="text-xs italic text-[var(--comfort-text-muted)] line-clamp-2">
                    &ldquo;{hypothesisText}&rdquo;
                  </p>
                </div>
              )}

              {recentRecords.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-[var(--comfort-border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-[var(--comfort-text-muted)]">
                      Log Pengamatan Terakhir ({recordsCount} titik data):
                    </span>
                    {onProceedToAnalysis && (
                      <button
                        type="button"
                        onClick={onProceedToAnalysis}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Buka Grafik Regresi &amp; LKS →
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentRecords.slice(0, 4).map((rec, idx) => (
                      <div
                        key={rec.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--comfort-bg)] border border-[var(--comfort-border)] font-mono text-[11px]"
                      >
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          #{idx + 1}
                        </span>
                        <span className="truncate max-w-[160px] text-[var(--comfort-text)]">
                          {rec.parametersSummary}
                        </span>
                        {onDeleteRecord && (
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            aria-label={`Hapus data percobaan ${idx + 1}`}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right / Collapsible Drawer Column (Desktop Drawer & Mobile Bottom Sheet) */}
        <AnimatePresence initial={false}>
          {isSidebarVisible && (
            <motion.aside
              key="spatial-side-drawer"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={SPRING_DRAWER}
              aria-label="Panel Kontrol Parameter & Telemetri Eksperimen"
              data-sidebar-width={sidebarWidthPx}
              onDoubleClick={() => setSidebarWidthPx(DEFAULT_SIDEBAR_WIDTH_PX)}
              className="lg:col-span-5 xl:col-span-4 w-full min-w-0 lg:sticky lg:top-2 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 sm:p-4 shadow-lg space-y-3 transition-colors duration-200"
            >
              {/* Mobile Bottom-Sheet Collapse Handle (<1024px) */}
              <div className="flex lg:hidden items-center justify-between pb-2 border-b border-[var(--comfort-border)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--comfort-text)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  Panel Instrumen &amp; Parameter
                </span>
                <button
                  type="button"
                  onClick={() => setMobileSheetExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--comfort-bg)] border border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text)] cursor-pointer"
                >
                  {mobileSheetExpanded ? (
                    <>
                      <span>Ringkas Panel</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Buka Panel</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              <div className={`${mobileSheetExpanded ? 'block' : 'hidden lg:block'} space-y-3`}>
                {/* Collapsible Right-Drawer Telemetry Section: LiveFormulaCard + SVG Gauges + Socratic AI Trigger */}
                {isRightTelemetryVisible && (
                  <div
                    data-testid="spatial-telemetry-hud-panel"
                    className="space-y-2.5 pb-3 border-b border-[var(--comfort-border)]"
                  >
                    <LiveFormulaCard
                      moduleTitle={moduleTitle}
                      formulaEquation={formulaEquation}
                      domainLabel={domainLabel}
                    />

                    {telemetryMetrics.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {telemetryMetrics.slice(0, 2).map((metric) => (
                          <TelemetryGauge
                            key={metric.id}
                            label={metric.label}
                            value={metric.value}
                            min={metric.min}
                            max={metric.max}
                            unit={metric.unit}
                            decimals={metric.precision ?? 2}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-mono text-[var(--comfort-text-muted)] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        Telemetri Sinkron RK4
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setDrawerTab('ai');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-700 dark:text-sky-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Diskusi Sokratik Dr. LabMu</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Domain-Specific Parameter Sliders & Apparatus Controls */}
                {sidebar}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Safety Hazard Modal Overlay */}
      {safetyModal}
    </div>
  );
};
