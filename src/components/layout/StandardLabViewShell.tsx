import React, { useEffect, useRef, useState } from 'react';
import { Activity, PlusCircle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import { useLabStore, DOMAIN_TO_ID } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { getExperimentById } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { LAB_EVENTS, emitLabEvent } from '../../utils/labEventBus';
import { shouldConfirmLabExit } from '../../utils/spatialHudHelpers';
import { useOfflineOutboxStatus } from '../../utils/offlineOutbox';
import type { ExperimentRecord } from '../../utils/scienceEngine';
import { SpatialHudTopBar } from './spatial/SpatialHudTopBar';
import { SpatialParameterDrawer } from './spatial/SpatialParameterDrawer';
import { SpatialTelemetryDrawer } from './spatial/SpatialTelemetryDrawer';
import { MobileInstrumentSheet } from './spatial/MobileInstrumentSheet';
import { LabExitConfirmModal } from './spatial/LabExitConfirmModal';
import { GuidedLabStepsOverlay } from './spatial/GuidedLabStepsOverlay';

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
 * Orchestrates floating top bar, collapsible parameter/telemetry drawers,
 * mobile instrument bottom sheet, and exit confirmation modal.
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
    setDrawerOpen,
    liteDeviceMode,
    toggleLiteDeviceMode,
    qualityMode,
    setQualityMode,
    prefer2DFallback,
    setPrefer2DFallback,
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
      setDrawerOpen: s.setDrawerOpen,
      liteDeviceMode: s.liteDeviceMode,
      toggleLiteDeviceMode: s.toggleLiteDeviceMode,
      qualityMode: s.qualityMode,
      setQualityMode: s.setQualityMode,
      prefer2DFallback: s.prefer2DFallback,
      setPrefer2DFallback: s.setPrefer2DFallback,
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

  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isWideDesktopViewport, setIsWideDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lgQuery = window.matchMedia('(min-width: 1024px)');
    const xlQuery = window.matchMedia('(min-width: 1280px)');
    const syncViewport = () => {
      setIsDesktopViewport(lgQuery.matches);
      setIsWideDesktopViewport(xlQuery.matches);
    };
    syncViewport();
    lgQuery.addEventListener('change', syncViewport);
    xlQuery.addEventListener('change', syncViewport);
    return () => {
      lgQuery.removeEventListener('change', syncViewport);
      xlQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  // Keep >=65% of the 3D stage unobstructed on 1024-1279px laptops
  useEffect(() => {
    if (isDesktopViewport && !isWideDesktopViewport && leftDrawerOpen && rightTelemetryOpen) {
      setRightTelemetryOpen(false);
    }
  }, [isDesktopViewport, isWideDesktopViewport, leftDrawerOpen, rightTelemetryOpen, setRightTelemetryOpen]);

  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<'params' | 'telemetry'>('params');
  const [copiedPin, setCopiedPin] = useState(false);
  const copiedPinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const outboxStatus = useOfflineOutboxStatus();

  useEffect(() => {
    return () => {
      if (copiedPinTimerRef.current) {
        clearTimeout(copiedPinTimerRef.current);
        copiedPinTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!exitConfirmOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExitConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [exitConfirmOpen]);

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

  useEffect(() => {
    if (mobileTab === 'variables') {
      setMobileSheetTab('params');
      setMobileSheetExpanded(true);
    } else if (mobileTab === 'telemetry') {
      setMobileSheetTab('telemetry');
      setMobileSheetExpanded(true);
    } else {
      setMobileSheetExpanded(false);
    }
  }, [mobileTab]);

  const handleToggleLeftDrawer = () => {
    labSound.playClick();
    if (zenMode) toggleZenMode();
    const nextOpen = !leftDrawerOpen;
    setLeftDrawerOpen(nextOpen);
    if (nextOpen && isDesktopViewport && !isWideDesktopViewport) {
      setRightTelemetryOpen(false);
    }
  };

  const handleToggleRightDrawer = () => {
    labSound.playClick();
    if (zenMode) toggleZenMode();
    const nextOpen = !rightTelemetryOpen;
    setRightTelemetryOpen(nextOpen);
    if (nextOpen && isDesktopViewport && !isWideDesktopViewport) {
      setLeftDrawerOpen(false);
    }
  };

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
        setLeftDrawerOpen((prev) => {
          const next = !prev;
          if (next && isDesktopViewport && !isWideDesktopViewport) {
            setRightTelemetryOpen(false);
          }
          return next;
        });
      } else if (e.key === ']') {
        e.preventDefault();
        labSound.playClick();
        if (zenMode) toggleZenMode();
        setRightTelemetryOpen((prev) => {
          const next = !prev;
          if (next && isDesktopViewport && !isWideDesktopViewport) {
            setLeftDrawerOpen(false);
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zenMode, toggleZenMode, setLeftDrawerOpen, setRightTelemetryOpen, isDesktopViewport, isWideDesktopViewport]);

  const activeExperiment = getExperimentById(activeModuleId);
  const domainLabel = domain || DOMAIN_TO_ID[activeDomain] || 'Sains';
  const moduleTitle = activeExperiment?.title || activeModuleId;
  const formulaEquation = activeExperiment?.keyEquations?.[0] || 'F = m · a';

  const handleCopyRoomPin = () => {
    if (!activeRoomId || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(activeRoomId).then(() => {
      setCopiedPin(true);
      if (copiedPinTimerRef.current) clearTimeout(copiedPinTimerRef.current);
      copiedPinTimerRef.current = setTimeout(() => {
        copiedPinTimerRef.current = null;
        setCopiedPin(false);
      }, 1800);
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

  const handleOpenDrLabMu = () => {
    labSound.playClick();
    setDrawerTab('ai');
    setDrawerOpen(true);
  };

  const isMiniViewportMode = !isFullBleedStage && propZenMode === true;
  const isLeftVisible = !zenMode && leftDrawerOpen;
  const isRightVisible = !zenMode && rightTelemetryOpen && !dualModeActive;
  const hasGuidedSteps = Boolean(
    !dualModeActive && !prefer2DFallback && !zenMode && activeExperiment?.stepByStepGuide?.length
  );
      const hasTopOverlay = Boolean(!dualModeActive && !prefer2DFallback && topOverlay);
  const showFloatingLiveReadout = Boolean(
    !dualModeActive && !prefer2DFallback && !isRightVisible && telemetryMetrics.length > 0
  );

  const centerCorridorClass = [
    'left-2.5 right-2.5 sm:left-3 sm:right-3',
    isLeftVisible ? 'lg:left-[320px] xl:left-[340px]' : 'lg:left-3',
    isRightVisible ? 'lg:right-[328px] xl:right-[348px]' : 'lg:right-3',
  ].join(' ');

  if (isMiniViewportMode) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-[var(--comfort-bg)]">
        {canvas}
        {safetyModal}
      </div>
    );
  }

  return (
    <div
      data-testid="spatial-hud-shell"
      className="relative w-full h-full min-h-0 overflow-hidden bg-[var(--comfort-bg)] select-none"
    >
      {/* 1. Full-Bleed 3D Viewport */}
      <div
        className={`absolute inset-0 z-0 ${
          isHazardous ? 'ring-2 ring-inset ring-[var(--comfort-danger)]/70' : ''
        }`}
      >
        {dualModeActive && dualViewport ? (
          <div
            className={`w-full h-full pt-[56px] pb-[88px] px-3 overflow-hidden bg-[var(--comfort-bg)] transition-[padding] duration-200 ${
              isLeftVisible ? 'lg:pl-[320px] xl:pl-[340px]' : ''
            }`}
          >
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

      {/* 2. Floating Top Bar */}
      <SpatialHudTopBar
        domainLabel={domainLabel}
        moduleTitle={moduleTitle}
        activeRoomId={activeRoomId}
        copiedPin={copiedPin}
        onCopyRoomPin={handleCopyRoomPin}
        onRequestExitToLobby={handleRequestExitToLobby}
        onBackToPreLab={onBackToPreLab}
        isOnline={isOnline}
        wsConnected={wsConnected}
        outboxSyncStatus={outboxStatus.syncStatus}
        outboxPendingCount={outboxStatus.pendingCount}
        outboxLabel={outboxStatus.label}
        liteDeviceMode={liteDeviceMode}
        onToggleLiteDeviceMode={toggleLiteDeviceMode}
        fps={livePerfStats.fps}
        qualityTier={livePerfStats.qualityTier}
        qualityMode={qualityMode}
        onChangeQualityMode={setQualityMode}
        prefer2DFallback={prefer2DFallback}
        onToggle2DFallback={() => setPrefer2DFallback(!prefer2DFallback)}
        dualModeActive={dualModeActive}
        onToggleDualMode={onToggleDualMode}
        isLeftVisible={isLeftVisible}
        onToggleLeftDrawer={handleToggleLeftDrawer}
        isRightVisible={isRightVisible}
        onToggleRightDrawer={handleToggleRightDrawer}
        zenMode={zenMode}
        onToggleFocus3D={() => {
          labSound.playClick();
          toggleZenMode();
        }}
        onOpenDrLabMu={handleOpenDrLabMu}
      />

      {/* 3. Unified Non-Overlapping Center Overlay Stack (Guided Steps + Module Top Overlay + Compact Live Readout) */}
      {(hasGuidedSteps || hasTopOverlay || showFloatingLiveReadout) && (
        <div
          className={`pointer-events-none absolute top-[64px] z-20 flex-col items-center gap-1.5 transition-[left,right] duration-200 ${
            mobileSheetExpanded ? 'hidden lg:flex' : 'flex'
          } ${centerCorridorClass}`}
        >
          {hasGuidedSteps && activeExperiment?.stepByStepGuide && (
            <GuidedLabStepsOverlay
              key={activeModuleId}
              steps={activeExperiment.stepByStepGuide}
              recordsCount={recordsCount}
              onOpenParameterDrawer={() => {
                if (isDesktopViewport) {
                  setLeftDrawerOpen(true);
                } else {
                  setMobileSheetTab('params');
                  setMobileSheetExpanded(true);
                  setMobileTab('variables');
                }
              }}
              onProceedToAnalysis={onProceedToAnalysis}
            />
          )}

          {(hasTopOverlay || showFloatingLiveReadout) && (
            <div className="w-full flex flex-wrap items-center justify-between gap-1.5">
              {hasTopOverlay ? (
                <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 max-w-full">
                  {topOverlay}
                </div>
              ) : (
                <div />
              )}

              {showFloatingLiveReadout && (
                <div
                  data-testid="floating-live-readout-hud"
                  className="pointer-events-auto ml-auto flex items-center gap-2 px-2.5 py-1 rounded-xl studio-hud-surface border border-[var(--comfort-border)] shadow-sm text-2xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isDesktopViewport) {
                        handleToggleRightDrawer();
                      } else {
                        setMobileSheetTab('telemetry');
                        setMobileSheetExpanded(true);
                        setMobileTab('telemetry');
                      }
                    }}
                    title="Buka Panel Telemetri Lengkap (])"
                    className="flex items-center gap-2 cursor-pointer hover:opacity-90"
                  >
                    <Activity className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                    {telemetryMetrics.slice(0, 2).map((metric, idx) => (
                      <div
                        key={metric.id}
                        className={`flex items-baseline gap-1 ${
                          idx > 0 ? 'pl-2 border-l border-[var(--comfort-border)]' : ''
                        }`}
                      >
                        <span className="text-[var(--comfort-hud-muted)] font-medium truncate max-w-[76px] sm:max-w-[96px]">
                          {metric.label.split(' ')[0]}:
                        </span>
                        <span className="font-mono font-bold text-[var(--comfort-hud-text)] tabular-nums">
                          {typeof metric.value === 'number'
                            ? Number(metric.value.toFixed(metric.precision ?? 2))
                            : metric.value}
                        </span>
                        {metric.unit && (
                          <span className="font-mono text-[var(--comfort-hud-muted)]">{metric.unit}</span>
                        )}
                      </div>
                    ))}
                  </button>
                  <button
                    type="button"
                    data-testid="floating-hud-record-btn"
                    onClick={() => {
                      labSound.playRecordSuccess();
                      emitLabEvent(LAB_EVENTS.RECORD_TRIAL, { source: 'dock', timestamp: Date.now() });
                    }}
                    title="[D] Catat Data Pengamatan Sekarang"
                    className="hidden sm:flex ml-0.5 px-2 py-0.5 rounded-lg bg-[var(--comfort-accent)] hover:opacity-95 text-white font-bold items-center gap-1 cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Catat</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4 & 5. Desktop Side Drawers (mounted ONLY on >=1024px so sidebar never double-mounts with MobileInstrumentSheet) */}
      {isDesktopViewport && (
        <>
          <SpatialParameterDrawer
            isOpen={isLeftVisible}
            onClose={() => setLeftDrawerOpen(false)}
            hypothesisText={hypothesisText}
            theorySummary={activeExperiment?.theorySummary}
            keyTakeaways={activeExperiment?.keyTakeaways}
            safetyNotes={activeExperiment?.safetyNotes}
            sidebar={sidebar}
          />

          <SpatialTelemetryDrawer
            isOpen={isRightVisible}
            onClose={() => setRightTelemetryOpen(false)}
            oscilloscope={oscilloscope}
            telemetryMetrics={telemetryMetrics}
            moduleTitle={moduleTitle}
            formulaEquation={formulaEquation}
            domainLabel={domainLabel}
            recentRecords={recentRecords}
            recordsCount={recordsCount}
            onProceedToAnalysis={onProceedToAnalysis}
            onDeleteRecord={onDeleteRecord}
            onOpenDrLabMu={handleOpenDrLabMu}
          />
        </>
      )}

      {/* 6. Mobile Collapsible Bottom Sheet (mounted ONLY on <1024px to guarantee single RECORD_TRIAL listener) */}
      {!isDesktopViewport && !zenMode && (
        <MobileInstrumentSheet
          expanded={mobileSheetExpanded}
          activeTab={mobileSheetTab}
          onSelectTab={(tab) => {
            setMobileSheetTab(tab);
            setMobileSheetExpanded(true);
            setMobileTab(tab === 'params' ? 'variables' : 'telemetry');
          }}
          onToggleExpand={() => {
            const next = !mobileSheetExpanded;
            setMobileSheetExpanded(next);
            if (!next) setMobileTab('canvas');
          }}
          sidebar={sidebar}
          moduleTitle={moduleTitle}
          formulaEquation={formulaEquation}
          domainLabel={domainLabel}
          telemetryMetrics={telemetryMetrics}
          recordsCount={recordsCount}
        />
      )}

      {/* 7. Exit Confirmation Modal */}
      <LabExitConfirmModal
        isOpen={exitConfirmOpen}
        recordsCount={recordsCount}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirmExit={() => {
          setExitConfirmOpen(false);
          setIsLobbyMode(true);
        }}
      />

      {/* 8. Safety Hazard Modal */}
      {safetyModal}
    </div>
  );
};
