import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import { useLabStore, DOMAIN_TO_ID } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { getExperimentById } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
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
  }, [zenMode, toggleZenMode, setLeftDrawerOpen, setRightTelemetryOpen]);

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

  const isMiniViewportMode = !isFullBleedStage && propZenMode === true;
  const isLeftVisible = !zenMode && leftDrawerOpen;
  const isRightVisible = !zenMode && rightTelemetryOpen;

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
          isHazardous ? 'ring-2 ring-inset ring-rose-500/70' : ''
        }`}
      >
        {dualModeActive && dualViewport ? (
          <div
            className={`w-full h-full pt-[60px] pb-[92px] px-3 overflow-hidden bg-[var(--comfort-bg)] transition-[padding] duration-200 ${
              isLeftVisible ? 'lg:pl-[336px] xl:pl-[348px]' : ''
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
        onToggleLeftDrawer={() => {
          labSound.playClick();
          if (zenMode) toggleZenMode();
          setLeftDrawerOpen((prev) => !prev);
        }}
        isRightVisible={isRightVisible}
        onToggleRightDrawer={() => {
          labSound.playClick();
          if (zenMode) toggleZenMode();
          setRightTelemetryOpen((prev) => !prev);
        }}
        zenMode={zenMode}
        onToggleFocus3D={() => {
          labSound.playClick();
          toggleZenMode();
        }}
        onOpenDrLabMu={() => {
          labSound.playClick();
          setDrawerTab('ai');
        }}
      />

      {/* 3. Guided Step-by-Step Overlay (collapsible, strictly inside center corridor) */}
      {!dualModeActive && !prefer2DFallback && !zenMode && activeExperiment?.stepByStepGuide && (
        <GuidedLabStepsOverlay
          steps={activeExperiment.stepByStepGuide}
          recordsCount={recordsCount}
          isLeftVisible={isLeftVisible}
          isRightVisible={isRightVisible}
        />
      )}

      {/* 3b. Floating Viewport Overlay */}
      {!dualModeActive && !prefer2DFallback && topOverlay && (
        <div
          className={`pointer-events-none absolute top-[164px] xl:top-[134px] z-20 flex items-center left-3 ${
            isLeftVisible ? 'lg:left-[336px] xl:left-[348px]' : 'lg:left-3'
          }`}
        >
          <div className="pointer-events-auto flex items-center gap-1.5">{topOverlay}</div>
        </div>
      )}

      {/* 4. Left Parameter Drawer */}
      <SpatialParameterDrawer
        isOpen={isLeftVisible}
        onClose={() => setLeftDrawerOpen(false)}
        hypothesisText={hypothesisText}
        sidebar={sidebar}
      />

      {/* 5. Right Telemetry & Formula Drawer (auto-yields in Dual A/B mode so both panes remain wide) */}
      <SpatialTelemetryDrawer
        isOpen={isRightVisible && !dualModeActive}
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
        onOpenDrLabMu={() => setDrawerTab('ai')}
      />

      {/* 6. Mobile Collapsible Bottom Sheet */}
      {!zenMode && (
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
