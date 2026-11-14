import { useCallback, useEffect, useRef, useState } from 'react';
import { ScienceDomain } from '../../utils/scienceEngine';
import { type CameraSyncPose } from '../../utils/threeStudioKit';
import { labSound } from '../../utils/soundEngine';
import { LAB_EVENTS, subscribeLabEvent } from '../../utils/labEventBus';
import { ComfortThemeMode, getSceneThemeColors } from '../ui/VisualComfortToolbar';
import { useUIStore } from '../../stores/useUIStore';
import { ConceptLabelDomRef } from '../ui/ConceptLabelsOverlay';

export interface SceneCameraControlHandle<TPreset extends string> {
  setPreset: (preset: TPreset) => void;
  setOrbit: (orbit: boolean) => void;
  captureCanvas: () => string | null;
  applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  applyLiteMode?: (isLite: boolean) => void;
}

export interface UseThreeStudioSceneOptions<TPreset extends string> {
  domain: ScienceDomain;
  orderedPresets: readonly TPreset[];
  defaultPreset: TPreset;
  comfortTheme?: ComfortThemeMode;
  cameraSyncPose?: CameraSyncPose | null;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
}

/**
 * Shared React scaffolding for 3D WebGL scenes:
 * - Fullscreen container toggle & native fullscreenchange listener
 * - Theme comfort sync & Concept Label DOM refs
 * - Global snapshot & camera preset shortcut event subscriptions
 * - Remote teacher/student camera sync pose deduplication
 */
export function useThreeStudioScene<TPreset extends string>({
  domain,
  orderedPresets,
  defaultPreset,
  comfortTheme,
  cameraSyncPose,
  onCameraSyncChange,
  onCaptureSnapshot,
}: UseThreeStudioSceneOptions<TPreset>) {
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const showConceptLabels = useUIStore((s) => s.showConceptLabels);
  const showConceptLabelsRef = useRef(showConceptLabels);
  showConceptLabelsRef.current = showConceptLabels;

  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, domain);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<TPreset>(defaultPreset);
  const activePresetRef = useRef<TPreset>(defaultPreset);
  activePresetRef.current = activePreset;

  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);
  const [hoveredPartLabel, setHoveredPartLabel] = useState<string | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);

  const cameraCtrlRef = useRef<SceneCameraControlHandle<TPreset> | null>(null);
  const onCameraSyncChangeRef = useRef(onCameraSyncChange);
  onCameraSyncChangeRef.current = onCameraSyncChange;
  const onCaptureSnapshotRef = useRef(onCaptureSnapshot);
  onCaptureSnapshotRef.current = onCaptureSnapshot;
  const lastAppliedCamSeqRef = useRef<number>(-1);
  const cameraSyncHandleRef = useRef<{ applyPose: (pose: CameraSyncPose) => void } | null>(null);

  useEffect(() => {
    if (!cameraSyncPose || cameraSyncPose.seq === lastAppliedCamSeqRef.current) return;
    lastAppliedCamSeqRef.current = cameraSyncPose.seq;
    cameraSyncHandleRef.current?.applyPose(cameraSyncPose);
  }, [cameraSyncPose]);

  useEffect(() => {
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, domain));
  }, [activeComfortTheme, domain]);

  const orderedPresetsRef = useRef(orderedPresets);
  orderedPresetsRef.current = orderedPresets;

  useEffect(() => {
    const handleGlobalSnapshot = () => {
      if (onCaptureSnapshotRef.current && cameraCtrlRef.current) {
        const url = cameraCtrlRef.current.captureCanvas();
        if (url) onCaptureSnapshotRef.current(url);
      }
    };
    const unsubSnapshot = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, handleGlobalSnapshot);
    const unsubPreset = subscribeLabEvent(LAB_EVENTS.SET_CAMERA_PRESET, (detail) => {
      if (!detail) return;
      const preset = orderedPresetsRef.current[detail.index];
      if (preset) {
        setActivePreset(preset);
        cameraCtrlRef.current?.setPreset(preset);
      }
    });
    return () => {
      unsubSnapshot();
      unsubPreset();
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const container = containerRef.current;
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      } else if (container && document.fullscreenElement === container) {
        setIsFullscreen(true);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [isFullscreen]);

  const handleSelectCameraPreset = useCallback((presetName: TPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    labSound.playClick();
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const triggerSceneRebuild = useCallback(() => {
    setSceneKey((prev) => prev + 1);
  }, []);

  return {
    activeComfortTheme,
    themeColors,
    showConceptLabels,
    showConceptLabelsRef,
    mountRef,
    containerRef,
    conceptDomRef,
    bindConceptSlot,
    isFullscreen,
    handleToggleFullscreen,
    activePreset,
    activePresetRef,
    setActivePreset,
    handleSelectCameraPreset,
    dragToast,
    setDragToast,
    hoveredPartLabel,
    setHoveredPartLabel,
    sceneKey,
    triggerSceneRebuild,
    cameraCtrlRef,
    cameraSyncHandleRef,
    onCameraSyncChangeRef,
  };
}
