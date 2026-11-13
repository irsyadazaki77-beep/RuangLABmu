import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crosshair,
  GripVertical,
  Scale,
} from 'lucide-react';
import { CompactTelemetryRibbon, TelemetryRibbonMetric } from '../ui/CompactTelemetryRibbon';
import { InteractiveFormulaPrimer } from '../ui/InteractiveFormulaPrimer';
import {
  ActiveHypothesisBanner,
  LiveObservationFeedCard,
} from '../ui/LiveObservationStrip';
import type { ExperimentRecord } from '../../utils/scienceEngine';
import {
  checkImmersiveVRSupport,
  subscribeWebXRState,
  WebXRStateSnapshot,
  getWebXRState,
} from '../../utils/webXRStudioAdapter';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';

export interface CameraPresetItem {
  id: string;
  label: string;
}

export const DEFAULT_SIDEBAR_WIDTH_PX = 360;
export const MIN_SIDEBAR_WIDTH_PX = 280;
export const MAX_SIDEBAR_WIDTH_RATIO = 0.55;

/**
 * Pure helper to clamp the resizable right sidebar width between 280px and 55% of viewport width.
 */
export function clampSplitSidebarWidth(requestedWidthPx: number, viewportWidthPx: number): number {
  const safeViewport = Math.max(640, viewportWidthPx || 1440);
  const maxPx = Math.max(MIN_SIDEBAR_WIDTH_PX, Math.floor(safeViewport * MAX_SIDEBAR_WIDTH_RATIO));
  return Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(maxPx, Math.round(requestedWidthPx)));
}

export interface StandardLabViewShellProps {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  recordsCount: number;
  telemetryMetrics: TelemetryRibbonMetric[];
  oscilloscope?: {
    primaryLabel: string;
    primaryValue: number;
    primaryUnit: string;
    secondaryLabel: string;
    secondaryValue: number;
    secondaryUnit: string;
    microscopicStateLabel: string;
    microscopicDetail: string;
    accentColor?: string;
  };
  canvas: React.ReactNode;
  sidebar: React.ReactNode;
  safetyModal?: React.ReactNode;
  topOverlay?: React.ReactNode;
  guideHud?: React.ReactNode;
  guideTitle?: string;
  guideText?: string;
  zenMode?: boolean;
  activeCameraPreset?: string;
  cameraPresets?: CameraPresetItem[];
  onSelectCameraPreset?: (presetId: string) => void;
  isHazardous?: boolean;
  shutterFlash?: boolean;
  dualModeActive?: boolean;
  onToggleDualMode?: () => void;
  dualViewport?: React.ReactNode;
  hypothesisText?: string;
  recentRecords?: ExperimentRecord[];
  onProceedToAnalysis?: () => void;
  onBackToPreLab?: () => void;
  onDeleteRecord?: (id: string) => void;
}

export const StandardLabViewShell: React.FC<StandardLabViewShellProps> = ({
  domain,
  recordsCount,
  telemetryMetrics,
  oscilloscope,
  canvas,
  sidebar,
  safetyModal,
  topOverlay,
  zenMode = false,
  isHazardous = false,
  shutterFlash = false,
  dualModeActive = false,
  onToggleDualMode,
  dualViewport,
  hypothesisText,
  recentRecords,
  onProceedToAnalysis,
  onBackToPreLab,
  onDeleteRecord,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen] = useState<boolean>(false);
  const [xrState, setXRState] = useState<WebXRStateSnapshot>(() => getWebXRState());
  const [isDraggingSash, setIsDraggingSash] = useState<boolean>(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const activeModuleId = useLabStore((s) => s.activeModuleId);
  const workflowStep = useLabStore((s) => s.workflowStep);
  const isCompactPiPStage = workflowStep !== 2;
  const { sidebarWidthPx, setSidebarWidthPx, mobileTab } = useUIStore();
  const hideCanvasOnMobile = !isDesktopViewport && !isCompactPiPStage && mobileTab === 'variables';
  const hideSidebarOnMobile = !isDesktopViewport && !isCompactPiPStage && mobileTab !== 'variables';

  useEffect(() => {
    void checkImmersiveVRSupport();
    const unsub = subscribeWebXRState((next) => {
      setXRState(next);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onWinResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktopViewport(desktop);
      if (desktop) {
        setSidebarWidthPx(clampSplitSidebarWidth(useUIStore.getState().sidebarWidthPx, window.innerWidth));
      }
    };
    window.addEventListener('resize', onWinResize);
    return () => window.removeEventListener('resize', onWinResize);
  }, [setSidebarWidthPx]);

  // Drag Sash / Divider Handlers (PILAR 2)
  const handleSashPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingSash(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const rootEl = shellRootRef.current;
        const rect = rootEl?.getBoundingClientRect();
        const totalWidth = rect?.width || window.innerWidth || 1440;
        const rightEdge = rect ? rect.right : window.innerWidth;
        const desiredRightPanelWidth = rightEdge - moveEvent.clientX;
        const clamped = clampSplitSidebarWidth(desiredRightPanelWidth, totalWidth);
        setSidebarWidthPx(clamped);
        window.dispatchEvent(new Event('resize'));
      };

      const handlePointerUp = () => {
        setIsDraggingSash(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [setSidebarWidthPx]
  );

  const handleSashDoubleClick = useCallback(() => {
    labSound.playClick(640);
    setSidebarWidthPx(DEFAULT_SIDEBAR_WIDTH_PX);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 20);
  }, [setSidebarWidthPx]);

  return (
    <div
      ref={shellRootRef}
      className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full bg-[var(--comfort-bg)] text-[var(--comfort-text)] select-none"
    >
      {/* 1. Optional Safety Hazard Modal */}
      {safetyModal}

      {/* 2. Middle Left Area: Ribbon & 3D Canvas Container */}
      <div
        ref={containerRef}
        className={`flex-1 relative flex-col min-w-0 h-full overflow-hidden ${
          hideCanvasOnMobile ? 'hidden lg:flex' : 'flex'
        } ${
          isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : ''
        }`}
      >
        {/* Top 48px Telemetry Ribbon */}
        {!isCompactPiPStage && (
          <div data-onboarding="telemetry-ribbon">
            <CompactTelemetryRibbon
              domain={domain}
              recordsCount={recordsCount}
              metrics={telemetryMetrics}
              oscilloscope={
                oscilloscope || {
                  primaryLabel: 'Telemetri',
                  primaryValue: 0,
                  primaryUnit: '',
                  secondaryLabel: 'Variabel',
                  secondaryValue: 0,
                  secondaryUnit: '',
                  microscopicStateLabel: 'Kondisi Nominal',
                  microscopicDetail: 'Sistem beroperasi normal.',
                  accentColor: '#38bdf8',
                }
              }
              extraBadge={
                onToggleDualMode ? (
                  <button
                    type="button"
                    data-testid="toggle-dual-3d-btn"
                    onClick={() => {
                      labSound.playClick(660);
                      onToggleDualMode();
                    }}
                    title="Bandingkan 2 kondisi eksperimen secara paralel (Realitas A vs B)"
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      dualModeActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-900/5 dark:bg-slate-900/80 text-amber-700 dark:text-amber-300 border-slate-300/80 dark:border-slate-700 hover:border-amber-400/70'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">
                      {dualModeActive ? 'Tutup 2 Dunia 3D' : 'Bandingkan 2 Dunia 3D'}
                    </span>
                    <span className="lg:hidden">A/B 3D</span>
                  </button>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Full-Bleed 3D Canvas Viewport (or Dual-3D A/B Split-Screen) */}
        <div
          data-onboarding="canvas-3d"
          className={`relative w-full flex-1 ${
            isCompactPiPStage ? 'min-h-[160px] [&_button]:hidden' : 'min-h-[360px]'
          } overflow-hidden bg-slate-950 transition-all select-none ${
            isHazardous
              ? 'ring-2 ring-inset ring-rose-500/70'
              : xrState.isSessionActive
                ? 'ring-2 ring-inset ring-sky-400/80'
                : ''
          }`}
        >
          {dualModeActive && dualViewport ? dualViewport : canvas}

          {/* Shutter Flash Animation */}
          <AnimatePresence>
            {shutterFlash && (
              <motion.div
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-sky-300/60 via-white/85 to-emerald-300/60"
              />
            )}
          </AnimatePresence>

          {/* Top-Left Contextual Overlay (e.g. Vektor Gaya 3D or Planet focus, avoids colliding with top-right capsule bar or Dual-3D header) */}
          {!isCompactPiPStage && !dualModeActive && topOverlay && (
            <div className="absolute top-3 left-3 z-20 pointer-events-auto">
              {topOverlay}
            </div>
          )}

          {/* Spatial VR Controller Laser Pointer Status Pill (Only during active VR) */}
          {!isCompactPiPStage && xrState.isSessionActive && (
            <div
              data-testid="xr-spatial-hud"
              className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 max-w-sm rounded-xl bg-slate-950/90 border border-sky-500/50 px-3 py-2 text-[11px] text-slate-200 shadow-xl space-y-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {xrState.sessionMode === 'native-webxr'
                    ? 'WebXR Immersive-VR Aktif'
                    : 'Mode VR Spasial (Laser Pointer Kiri/Kanan)'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-300">
                {xrState.activeHandHover
                  ? `Target Bidik (${xrState.activeHandHover.hand === 'right' ? 'Controller Kanan' : 'Controller Kiri'}): ${xrState.activeHandHover.objectName} (${xrState.activeHandHover.distance}m)`
                  : xrState.lastSpatialAction ||
                    'Arahkan kursor / controller untuk membidik aparatus 3D & klik untuk interaksi spasial.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. PILAR 2: Resizable Vertical Split Sash / Divider (Desktop lg+) */}
      {!zenMode && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Geser untuk mengubah lebar panel kontrol, klik ganda untuk reset ke 360px"
          data-testid="workspace-split-divider"
          onPointerDown={handleSashPointerDown}
          onDoubleClick={handleSashDoubleClick}
          title="Geser untuk mengatur lebar panel (280px – 55%) · Klik 2x untuk reset (360px)"
          className={`hidden lg:flex w-2.5 shrink-0 items-center justify-center cursor-col-resize select-none transition-colors group border-l border-[var(--comfort-border)] ${
            isDraggingSash
              ? 'bg-sky-500/30 border-sky-500'
              : 'bg-[var(--comfort-surface)] hover:bg-sky-500/15'
          }`}
        >
          <GripVertical
            className={`w-3.5 h-3.5 transition-colors ${
              isDraggingSash
                ? 'text-sky-500'
                : 'text-slate-400 dark:text-slate-600 group-hover:text-sky-500'
            }`}
          />
        </div>
      )}

      {/* 4. Right Area: Resizable Sidebar Parameter, Hypothesis Continuity & Live Data Log */}
      {!zenMode && (
        <aside
          data-testid="resizable-parameter-sidebar"
          style={isDesktopViewport ? { width: `${sidebarWidthPx}px` } : undefined}
          className={`w-full flex-1 lg:flex-initial lg:shrink-0 border-t lg:border-t-0 bg-[var(--comfort-surface)] overflow-y-auto p-4 space-y-3.5 transition-[width] duration-75 ${
            hideSidebarOnMobile ? 'hidden lg:block' : 'block'
          }`}
        >
          {!isCompactPiPStage && (hypothesisText !== undefined || onBackToPreLab) && (
            <ActiveHypothesisBanner
              hypothesisText={hypothesisText}
              domain={domain}
              onEditPreLab={onBackToPreLab}
            />
          )}
          {/* PILAR 3: Interactive Formula Concept Primer ala Brilliant.org */}
          <InteractiveFormulaPrimer
            moduleId={activeModuleId}
            domain={domain}
            defaultExpanded={false}
          />
          {sidebar}
          {!isCompactPiPStage && recentRecords !== undefined && (
            <LiveObservationFeedCard
              domain={domain}
              records={recentRecords}
              totalRecordsCount={recordsCount}
              onDeleteRecord={onDeleteRecord}
              onProceedToAnalysis={onProceedToAnalysis}
            />
          )}
        </aside>
      )}
    </div>
  );
};
