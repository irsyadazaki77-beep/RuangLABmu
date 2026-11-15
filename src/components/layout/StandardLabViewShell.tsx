import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
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
  Sliders,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useLabStore, DOMAIN_TO_ID } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { getExperimentById } from '../../registry/experimentRegistry';
import { LiveFormulaCard } from '../telemetry/LiveFormulaCard';
import { TelemetryGauge } from '../telemetry/TelemetryGauge';
import { LiveTimeSeriesChart } from '../telemetry/LiveTimeSeriesChart';
import {
  DRAWER_LEFT_VARIANTS,
  DRAWER_RIGHT_VARIANTS,
  MODAL_POPOVER_VARIANTS,
  SPRING_TACTILE,
} from '../../styles/motionPresets';
import { labSound } from '../../utils/soundEngine';
import { shouldConfirmLabExit } from '../../utils/spatialHudHelpers';
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

/**
 * Full-Bleed Spatial HUD Workspace (100vw x 100vh centerpiece)
 * - Floating Top Bar with Exit Confirmation, Breadcrumb, PIN Copy, 3T Status, Live FPS/Quality
 * - Left Drawer ([): Parameters & Precision Controls
 * - Right Drawer (]): SVG Gauges, LiveFormulaCard, LiveTimeSeriesChart, Trials & Socratic AI
 * - Focus 3D button collapses both side drawers simultaneously
 * - Mobile (<1024px) collapsible bottom sheet keeps the 3D apparatus unobstructed
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
    liteDeviceMode,
    toggleLiteDeviceMode,
    livePerfStats,
    mobileTab,
    setMobileTab,
    leftDrawerOpen,
    setLeftDrawerOpen,
    rightTelemetryOpen,
    setRightTelemetryOpen,
    teacherViewMode,
  } = useUIStore(
    useShallow((s) => ({
      storeZenMode: s.zenMode,
      toggleZenMode: s.toggleZenMode,
      setDrawerTab: s.setDrawerTab,
      liteDeviceMode: s.liteDeviceMode,
      toggleLiteDeviceMode: s.toggleLiteDeviceMode,
      livePerfStats: s.livePerfStats,
      mobileTab: s.mobileTab,
      setMobileTab: s.setMobileTab,
      leftDrawerOpen: s.leftDrawerOpen,
      setLeftDrawerOpen: s.setLeftDrawerOpen,
      rightTelemetryOpen: s.rightTelemetryOpen,
      setRightTelemetryOpen: s.setRightTelemetryOpen,
      teacherViewMode: s.teacherViewMode,
    }))
  );

  const {
    activeDomain,
    activeModuleId,
    setIsLobbyMode,
    timelineCount,
    workflowStep,
    userRole,
  } = useLabStore(
    useShallow((s) => ({
      activeDomain: s.activeDomain,
      activeModuleId: s.activeModuleId,
      setIsLobbyMode: s.setIsLobbyMode,
      timelineCount: s.timelineCount,
      workflowStep: s.workflowStep,
      userRole: s.userRole,
    }))
  );

  const isFullBleedStage =
    (userRole === 'siswa' && workflowStep === 2) ||
    (userRole === 'pengajar' && teacherViewMode === 'lab3d');
  const zenMode = isFullBleedStage ? storeZenMode : (propZenMode ?? storeZenMode);

  const { activeRoomId, wsConnected } = useCollabStore(
    useShallow((s) => ({
      activeRoomId: s.activeRoomId,
      wsConnected: s.wsConnected,
    }))
  );

  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<'params' | 'telemetry'>('params');
  const [copiedPin, setCopiedPin] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
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

  // Sync mobile bottom navigation selection with bottom sheet visibility
  useEffect(() => {
    if (mobileTab === 'variables') {
      setMobileSheetTab('params');
      setMobileSheetExpanded(true);
    } else if (mobileTab === 'canvas') {
      setMobileSheetExpanded(false);
    }
  }, [mobileTab]);

  // Keyboard shortcuts '[' and ']' to toggle Left & Right HUD Drawers
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

  const handleRequestExitToLobby = () => {
    labSound.playClick();
    if (shouldConfirmLabExit({ recordsCount, timelineCount })) {
      setExitConfirmOpen(true);
    } else {
      setIsLobbyMode(true);
    }
  };

  const handleToggleFocus3D = () => {
    labSound.playClick();
    toggleZenMode();
  };

  // Mini-3D PiP / Split viewport on Stages 3 & 4 passes zenMode=true explicitly
  const isMiniViewportMode = !isFullBleedStage && propZenMode === true;
  const isLeftVisible = !zenMode && leftDrawerOpen;
  const isRightVisible = !zenMode && rightTelemetryOpen;

  const primaryMetric = telemetryMetrics[0];
  const secondaryMetric = telemetryMetrics[1];

  if (isMiniViewportMode) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-950">
        {canvas}
        {topOverlay && (
          <div className="pointer-events-none absolute top-2 left-2 right-2 z-20 flex items-center justify-between">
            <div className="pointer-events-auto">{topOverlay}</div>
          </div>
        )}
        {safetyModal}
      </div>
    );
  }

  return (
    <div
      data-testid="spatial-hud-shell"
      className="relative w-full h-full min-h-0 overflow-hidden bg-slate-950 select-none"
    >
      {/* 1. FULL-BLEED 3D VIEWPORT CENTERPIECE */}
      <div
        className={`absolute inset-0 z-0 ${
          isHazardous ? 'ring-2 ring-inset ring-rose-500/70' : ''
        }`}
      >
        {dualModeActive && dualViewport ? (
          <div className="w-full h-full pt-16 pb-20 px-3 overflow-y-auto bg-slate-950">
            {dualViewport}
          </div>
        ) : (
          canvas
        )}
      </div>

      {/* Camera Snapshot Shutter Flash */}
      {shutterFlash && (
        <div className="pointer-events-none absolute inset-0 z-40 bg-white/70 transition-opacity duration-150" />
      )}

      {/* 2. MINIMAL FLOATING TOP BAR */}
      <div
        data-testid="spatial-hud-top-bar"
        className="absolute top-2.5 left-2.5 right-2.5 sm:left-3 sm:right-3 z-30 flex items-center justify-between gap-1.5 sm:gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/92 text-slate-100 px-2.5 sm:px-3 py-1.5 shadow-xl"
      >
        {/* Left: Exit / Back + Breadcrumb */}
        <nav
          aria-label="Breadcrumb Ruang Praktikum"
          className="flex items-center gap-1 sm:gap-1.5 text-xs min-w-0"
        >
          {onBackToPreLab && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToPreLab();
              }}
              title="Kembali ke Tahap 1 Briefing Pra-Lab"
              aria-label="Kembali ke Briefing Pra-Lab"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleRequestExitToLobby}
            aria-label="Kembali ke Katalog Laboratorium"
            className="font-semibold text-slate-300 hover:text-sky-400 transition-colors cursor-pointer shrink-0"
          >
            Lobby
          </button>
          <span className="text-slate-600">/</span>
          <span className="font-semibold text-sky-400 shrink-0 capitalize hidden sm:inline">
            {domainLabel}
          </span>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <span className="font-bold text-white truncate max-w-[95px] sm:max-w-[240px]">
            {moduleTitle}
          </span>
        </nav>

        {/* Right: Room PIN + 3T Status + Live FPS/Quality/Lite + A/B + Drawer Toggles + Focus 3D + Dr. LabMu */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {activeRoomId && (
            <button
              type="button"
              onClick={handleCopyRoomPin}
              title="Salin PIN Room Kolaborasi"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              <span>PIN: {activeRoomId}</span>
              {copiedPin ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-80" />
              )}
            </button>
          )}

          <span
            data-testid="hud-3t-connection-pill"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/45 text-amber-300'
            }`}
            title={
              isOnline
                ? wsConnected
                  ? 'Sinkronisasi Real-Time Aktif'
                  : 'Online (PWA 3T Siap)'
                : 'Mode Luring 3T Aktif'
            }
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden md:inline">
              {isOnline ? '3T Sinkron' : 'Mode Luring'}
            </span>
          </span>

          {/* Live FPS & Adaptive Quality / 3T Lite Toggle */}
          <button
            type="button"
            data-testid="hud-lite-mode-toggle-btn"
            onClick={() => {
              labSound.playClick(liteDeviceMode ? 680 : 520);
              toggleLiteDeviceMode();
            }}
            title={
              liteDeviceMode
                ? 'Mode Ringan 3T Aktif (Klik untuk Kualitas Penuh)'
                : 'Klik untuk Mengaktifkan Mode Ringan 3T'
            }
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[10px] font-bold tabular-nums transition-colors cursor-pointer ${
              liteDeviceMode
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                : 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500/50'
            }`}
          >
            {liteDeviceMode ? (
              <Zap className="w-3 h-3 text-amber-400" />
            ) : (
              <Cpu className="w-3 h-3 text-cyan-400" />
            )}
            <span data-testid="hud-fps-quality-badge">
              {Math.round(livePerfStats.fps)} FPS
            </span>
            <span className="uppercase text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-200">
              {liteDeviceMode ? 'lite' : livePerfStats.qualityTier}
            </span>
          </button>

          {onToggleDualMode && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onToggleDualMode();
              }}
              className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                dualModeActive
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Bandingkan Dua Realitas Parameter (A vs B)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>A/B</span>
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
            title="Tampilkan/Sembunyikan Panel Parameter ([)"
            className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              isLeftVisible
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isLeftVisible ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
            <span>Parameter</span>
            <kbd className="text-[9px] font-mono opacity-75">[</kbd>
          </button>

          {/* Right Drawer Toggle ']' */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              if (zenMode) toggleZenMode();
              setRightTelemetryOpen((prev) => !prev);
            }}
            aria-label="Toggle Panel Telemetri & Rumus (])"
            title="Tampilkan/Sembunyikan Telemetri & Grafik (])"
            className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              isRightVisible
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isRightVisible ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span>Telemetri</span>
            <kbd className="text-[9px] font-mono opacity-75">]</kbd>
          </button>

          {/* Focus 3D Button (Collapses both drawers simultaneously) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={SPRING_TACTILE}
            onClick={handleToggleFocus3D}
            data-testid="focus-3d-toggle-btn"
            aria-pressed={zenMode}
            title="Focus 3D Penuh (Sembunyikan Kedua Panel)"
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
              zenMode
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900 border-slate-700 text-slate-100 hover:border-sky-500/50'
            }`}
          >
            {zenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar Focus 3D</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Focus 3D</span>
              </>
            )}
          </motion.button>

          {/* Quick Dr. LabMu Socratic Assistant Button */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setDrawerTab('ai');
            }}
            aria-label="Buka Asisten Dr. LabMu"
            title="Diskusi Sokratik Dr. LabMu"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Dr. LabMu</span>
          </button>
        </div>
      </div>

      {/* 3. FLOATING VIEWPORT OVERLAY (Left-aligned below top-16 scene capsule to prevent overlap) */}
      {!dualModeActive && topOverlay && (
        <div
          className={`pointer-events-none absolute top-[110px] z-20 flex items-center left-3 ${
            isLeftVisible ? 'lg:left-[356px]' : 'lg:left-3'
          }`}
        >
          <div className="pointer-events-auto flex items-center gap-1.5">{topOverlay}</div>
        </div>
      )}

      {/* 4. COLLAPSIBLE LEFT DRAWER (Desktop >=1024px): Parameters & Precision Controls */}
      <AnimatePresence initial={false}>
        {isLeftVisible && (
          <motion.aside
            key="spatial-left-drawer"
            data-testid="spatial-left-drawer"
            variants={DRAWER_LEFT_VARIANTS}
            initial="closed"
            animate="open"
            exit="closed"
            aria-label="Panel Parameter & Kontrol Eksperimen"
            className="hidden lg:flex flex-col absolute top-16 bottom-16 left-3 w-[332px] z-20 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
          >
            <div className="px-3.5 py-2.5 border-b border-[var(--comfort-border)] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                <span>Parameter Eksperimen</span>
              </span>
              <button
                type="button"
                onClick={() => setLeftDrawerOpen(false)}
                aria-label="Tutup Panel Parameter"
                className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {hypothesisText && (
                <div className="p-2.5 rounded-xl bg-[var(--comfort-bg)] border border-[var(--comfort-border)] text-xs space-y-1">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-mono text-[10px] font-bold">
                    Hipotesis Awal
                  </span>
                  <p className="text-[11px] italic text-[var(--comfort-text-muted)] line-clamp-2">
                    &ldquo;{hypothesisText}&rdquo;
                  </p>
                </div>
              )}

              {sidebar}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 5. COLLAPSIBLE RIGHT DRAWER (Desktop >=1024px): Telemetry, Formula, Time-Series Chart & Socratic AI */}
      <AnimatePresence initial={false}>
        {isRightVisible && (
          <motion.aside
            key="spatial-telemetry-hud-panel"
            data-testid="spatial-telemetry-hud-panel"
            variants={DRAWER_RIGHT_VARIANTS}
            initial="closed"
            animate="open"
            exit="closed"
            aria-label="Panel Telemetri, Rumus Hidup & Grafik"
            className="hidden lg:flex flex-col absolute top-16 bottom-16 right-3 w-[348px] z-20 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
          >
            <div className="px-3.5 py-2.5 border-b border-[var(--comfort-border)] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>Telemetri &amp; Rumus</span>
              </span>
              <button
                type="button"
                onClick={() => setRightTelemetryOpen(false)}
                aria-label="Tutup Panel Telemetri"
                className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {/* Microscopic Readout Strip */}
              {oscilloscope && (
                <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 space-y-0.5">
                  <div className="font-mono text-[11px] font-bold text-sky-300 truncate">
                    {oscilloscope.microscopicStateLabel}
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2">
                    {oscilloscope.microscopicDetail}
                  </p>
                </div>
              )}

              {/* Live SVG Radial Gauges */}
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

              {/* Live Governing Equation & Active Variable Substitution */}
              <LiveFormulaCard
                moduleTitle={moduleTitle}
                formulaEquation={formulaEquation}
                domainLabel={domainLabel}
              />

              {/* Synchronized Ring-Buffer Time-Series Chart */}
              <LiveTimeSeriesChart
                primaryLabel={primaryMetric?.label}
                primaryUnit={primaryMetric?.unit}
                secondaryLabel={secondaryMetric?.label}
                secondaryUnit={secondaryMetric?.unit}
              />

              {/* Recent Recorded Trials & Step 3 Navigation */}
              {recentRecords.length > 0 && (
                <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-[var(--comfort-text-muted)]">
                      Data Tercatat ({recordsCount})
                    </span>
                    {onProceedToAnalysis && (
                      <button
                        type="button"
                        onClick={onProceedToAnalysis}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Grafik &amp; LKS →
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {recentRecords.slice(0, 4).map((rec, idx) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] font-mono text-[10px]"
                      >
                        <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="truncate flex-1 text-[var(--comfort-text)]">
                          {rec.parametersSummary}
                        </span>
                        {onDeleteRecord && (
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            aria-label={`Hapus data percobaan ${idx + 1}`}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Socratic AI Trigger */}
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setDrawerTab('ai');
                }}
                className="w-full py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Diskusi Sokratik Dr. LabMu</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 6. MOBILE COLLAPSIBLE BOTTOM SHEET (<1024px) */}
      {!zenMode && (
        <div
          data-testid="mobile-lab-bottom-sheet"
          className="lg:hidden absolute left-2 right-2 bottom-2 z-30 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-[var(--comfort-border)]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMobileSheetTab('params');
                  setMobileSheetExpanded(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  mobileSheetExpanded && mobileSheetTab === 'params'
                    ? 'bg-sky-600 text-white'
                    : 'bg-[var(--comfort-bg)] text-[var(--comfort-text-muted)]'
                }`}
              >
                Parameter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileSheetTab('telemetry');
                  setMobileSheetExpanded(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  mobileSheetExpanded && mobileSheetTab === 'telemetry'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--comfort-bg)] text-[var(--comfort-text-muted)]'
                }`}
              >
                Telemetri &amp; Grafik
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !mobileSheetExpanded;
                setMobileSheetExpanded(next);
                if (!next) setMobileTab('canvas');
              }}
              aria-label={mobileSheetExpanded ? 'Tutup Sheet Instrumen' : 'Buka Sheet Instrumen'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--comfort-bg)] border border-[var(--comfort-border)] text-[11px] font-semibold cursor-pointer"
            >
              <span>{mobileSheetExpanded ? 'Tutup' : 'Buka Panel'}</span>
              {mobileSheetExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {mobileSheetExpanded && (
            <div className="max-h-[44vh] overflow-y-auto p-3 space-y-2.5">
              {mobileSheetTab === 'params' ? (
                sidebar
              ) : (
                <>
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
                  <LiveTimeSeriesChart
                    primaryLabel={primaryMetric?.label}
                    primaryUnit={primaryMetric?.unit}
                    secondaryLabel={secondaryMetric?.label}
                    secondaryUnit={secondaryMetric?.unit}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. EXIT CONFIRMATION MODAL (When records or timeline history exist) */}
      <AnimatePresence>
        {exitConfirmOpen && (
          <div
            data-testid="lab-exit-confirm-modal"
            className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
            onClick={() => setExitConfirmOpen(false)}
          >
            <motion.div
              variants={MODAL_POPOVER_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="max-w-sm w-full rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 text-slate-900 dark:text-slate-100"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Keluar ke Lobby Katalog?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Anda memiliki{' '}
                    <strong>{recordsCount} data pengamatan</strong> dan jejak simulasi aktif. Kembali ke Lobby akan menutup sesi praktikum 3D ini.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Tetap di Lab
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setExitConfirmOpen(false);
                    setIsLobbyMode(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Keluar ke Lobby
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. SAFETY HAZARD MODAL */}
      {safetyModal}
    </div>
  );
};
