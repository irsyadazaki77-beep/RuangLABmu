import React, { useEffect, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Contrast,
  Glasses,
  Info,
  Magnet,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { ConceptLabelToggleButton } from './ConceptLabelsOverlay';
import { PostProcessingPopoverButton } from './PostProcessingPopoverButton';
import type { StudioCameraPreset } from '../../utils/studio3DCatalog';
import { useSceneEmbedMode } from '../../contexts/SceneEmbedModeContext';

export interface Scene3DToolAction {
  id: string;
  testId?: string;
  label: string;
  title?: string;
  active: boolean;
  icon: React.ReactNode;
  activeClass?: string;
  onClick: () => void;
}

export interface Scene3DControlDockProps {
  accentTone?: 'sky' | 'teal' | 'emerald' | 'indigo' | 'rose';
  activePreset?: StudioCameraPreset;
  frontLabel?: string;
  onResetCamera: () => void;
  onSelectPreset: (preset: 'isometric' | 'front' | 'top' | 'focus') => void;
  tools?: Scene3DToolAction[];
  showConceptLabelsToggle?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onOpenInspector?: () => void;
  inspectorActive?: boolean;
  onEnterVR?: () => void;
  isVRSupported?: boolean;
  isVRActive?: boolean;
  onSnapApparatus?: () => void;
  snapActive?: boolean;
  extraControl?: React.ReactNode;
}

const ACCENT_ACTIVE: Record<NonNullable<Scene3DControlDockProps['accentTone']>, string> = {
  sky: 'bg-sky-600 text-white font-bold',
  teal: 'bg-teal-600 text-white font-bold',
  emerald: 'bg-emerald-600 text-white font-bold',
  indigo: 'bg-indigo-600 text-white font-bold',
  rose: 'bg-rose-600 text-white font-bold',
};

/**
 * Unified, collapsible bottom 3D control dock positioned strictly inside the
 * unobstructed center corridor between the left and right spatial HUD drawers.
 * Uses zero backdrop-filter so WebGL rendering stays fast on all GPUs.
 */
export const Scene3DControlDock: React.FC<Scene3DControlDockProps> = ({
  accentTone = 'sky',
  activePreset = 'isometric',
  frontLabel = 'Depan',
  onResetCamera,
  onSelectPreset,
  tools = [],
  showConceptLabelsToggle = true,
  onToggleFullscreen,
  isFullscreen = false,
  onOpenInspector,
  inspectorActive = false,
  onEnterVR,
  isVRSupported = false,
  isVRActive = false,
  onSnapApparatus,
  snapActive = false,
  extraControl,
}) => {
  const { leftDrawerOpen, rightTelemetryOpen, zenMode, comfortTheme, setComfortPrefs } = useUIStore(
    useShallow((s) => ({
      leftDrawerOpen: s.leftDrawerOpen,
      rightTelemetryOpen: s.rightTelemetryOpen,
      zenMode: s.zenMode,
      comfortTheme: s.comfortPrefs.theme,
      setComfortPrefs: s.setComfortPrefs,
    }))
  );

  const embedMode = useSceneEmbedMode();
  const [collapsed, setCollapsed] = useState(false);

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
      if (e.key === 'h' || e.key === 'H') {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isLeftOpen = !zenMode && leftDrawerOpen;
  const isRightOpen = !zenMode && rightTelemetryOpen;

  // Strictly constrained inside the open center corridor on lg (1024px+) and xl (1280px+)
  // Left drawer: left-3 (12px) + w-[312px] = right 324px (lg), w-[324px] = right 336px (xl)
  // Right drawer: right-3 (12px) + w-[328px] = left edge 340px from right (lg), w-[340px] = 352px (xl)
  const corridorClass = [
    'left-2 right-2',
    isLeftOpen ? 'lg:left-[330px] xl:left-[342px]' : 'lg:left-3',
    isRightOpen ? 'lg:right-[346px] xl:right-[358px]' : 'lg:right-3',
  ].join(' ');

  const activeBtnClass = ACCENT_ACTIVE[accentTone];
  const idleBtnClass =
    'text-[var(--comfort-hud-text)]/80 hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/12 font-medium';

  if (embedMode !== 'full') {
    return null;
  }

  return (
    <div
      data-testid="scene-3d-control-dock"
      className={`pointer-events-auto absolute bottom-[88px] z-20 flex justify-center ${corridorClass}`}
    >
      {collapsed ? (
        <button
          type="button"
          data-testid="toggle-3d-dock-btn"
          onClick={() => {
            labSound.playClick(620);
            setCollapsed(false);
          }}
          title="Tampilkan Dok Kontrol Kamera & Alat 3D (H)"
          className="studio-hud-surface px-3 py-1 rounded-xl text-2xs font-semibold text-[var(--comfort-hud-text)] shadow-md flex items-center gap-1.5 cursor-pointer hover:border-sky-500/50 transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
          <span>Kontrol 3D</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0" aria-hidden="true" />
        </button>
      ) : (
        <div
          role="toolbar"
          aria-label="Kontrol Kamera dan Instrumen 3D"
          className="studio-hud-surface max-w-full rounded-xl px-1.5 py-0.5 shadow-md flex flex-wrap items-center justify-center gap-1"
        >
          {/* Group 1: Camera Reset & Presets */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              data-testid="camera-reset-btn"
              onClick={() => {
                labSound.playClick(540);
                onResetCamera();
              }}
              aria-label="Reset View Kamera 3D"
              title="Reset sudut pandang kamera ke posisi standar"
              className="px-1.5 py-1 rounded-lg text-2xs font-medium text-[var(--comfort-hud-text)] hover:bg-sky-500/15 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick(600);
                onSelectPreset('isometric');
              }}
              className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer shrink-0 ${
                activePreset === 'isometric' ? activeBtnClass : idleBtnClass
              }`}
            >
              3D
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick(600);
                onSelectPreset('front');
              }}
              className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer shrink-0 ${
                activePreset === 'front' || activePreset === 'ecliptic'
                  ? activeBtnClass
                  : idleBtnClass
              }`}
            >
              {frontLabel}
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick(600);
                onSelectPreset('top');
              }}
              className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer shrink-0 ${
                activePreset === 'top' ? activeBtnClass : idleBtnClass
              }`}
            >
              Atas
            </button>

            <button
              type="button"
              onClick={() => {
                labSound.playClick(600);
                onSelectPreset('focus');
              }}
              className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer shrink-0 ${
                activePreset === 'focus' ? activeBtnClass : idleBtnClass
              }`}
            >
              Fokus
            </button>

            {/* Interactive 3D Orientation Gimbal (X/Y/Z Axis Compass Widget) */}
            <button
              type="button"
              data-testid="scene-3d-orientation-gimbal"
              onClick={() => {
                labSound.playClick(640);
                const nextCycle: 'isometric' | 'front' | 'top' | 'focus' =
                  activePreset === 'isometric'
                    ? 'front'
                    : activePreset === 'front' || activePreset === 'ecliptic'
                    ? 'top'
                    : activePreset === 'top'
                    ? 'focus'
                    : 'isometric';
                onSelectPreset(nextCycle);
              }}
              title="Kompas Sumbu 3D (X/Y/Z) — Klik untuk memutar sudut kamera (3D → Depan → Atas → Fokus)"
              aria-label="Kompas Orientasi Sumbu 3D"
              className="px-1.5 py-0.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                {/* Y Axis (Vertical - Emerald) */}
                <line x1="12" y1="12" x2="12" y2="3" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="3" r="2" fill="#10b981" />
                {/* X Axis (Right-Down - Rose) */}
                <line x1="12" y1="12" x2="20" y2="17" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="20" cy="17" r="2" fill="#f43f5e" />
                {/* Z Axis (Left-Down - Sky) */}
                <line x1="12" y1="12" x2="4" y2="17" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="4" cy="17" r="2" fill="#0ea5e9" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
              <span className="font-mono text-2xs font-bold text-[var(--comfort-hud-text)] uppercase hidden md:inline">
                {activePreset === 'top'
                  ? 'Y-Atas'
                  : activePreset === 'front' || activePreset === 'ecliptic'
                  ? 'Z-Depan'
                  : activePreset === 'focus'
                  ? 'Zoom'
                  : 'XYZ'}
              </span>
            </button>
          </div>

          <span className="h-4 w-px bg-[var(--comfort-border)] hidden sm:inline-block" aria-hidden="true" />

          {/* Group 2: Lab Instruments, Inspector & Labels */}
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {extraControl}

            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                data-testid={tool.testId}
                onClick={tool.onClick}
                aria-pressed={tool.active}
                title={tool.title || tool.label}
                className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  tool.active ? tool.activeClass || activeBtnClass : idleBtnClass
                }`}
              >
                {tool.icon}
                <span className="hidden sm:inline">{tool.label}</span>
              </button>
            ))}

            {onSnapApparatus && (
              <button
                type="button"
                data-testid="snap-dock-apparatus-btn"
                onClick={onSnapApparatus}
                title="Rapatkan dan pusatkan alat praktikum di meja"
                className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  snapActive ? 'bg-emerald-600 text-white font-bold' : idleBtnClass
                }`}
              >
                <Magnet className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="hidden 2xl:inline">Snap</span>
              </button>
            )}

            {showConceptLabelsToggle && (
              <ConceptLabelToggleButton accentClass={activeBtnClass} />
            )}

            {onOpenInspector && (
              <button
                type="button"
                data-testid="toggle-3d-inspector-btn"
                onClick={() => {
                  labSound.playClick(650);
                  onOpenInspector();
                }}
                aria-pressed={inspectorActive}
                title="Inspeksi konsep dan rumus alat 3D aktif"
                className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  inspectorActive ? activeBtnClass : idleBtnClass
                }`}
              >
                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Info Alat</span>
              </button>
            )}

            {/* Lab Lighting & Contrast Switcher (Studio / Hangat / Gelap) */}
            <button
              type="button"
              data-testid="scene-3d-lighting-toggle-btn"
              onClick={() => {
                labSound.playClick(610);
                const nextTheme =
                  comfortTheme === 'light'
                    ? 'sepia'
                    : comfortTheme === 'sepia'
                    ? 'dark'
                    : 'light';
                setComfortPrefs({ theme: nextTheme });
              }}
              title="Ubah Pencahayaan Kanvas 3D (Studio Terang / Hangat Sepia / Gelap Observatorium)"
              aria-label="Ubah Pencahayaan Kanvas 3D"
              className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${idleBtnClass}`}
            >
              {comfortTheme === 'dark' ? (
                <Moon className="w-3 h-3 text-indigo-400 shrink-0" aria-hidden="true" />
              ) : comfortTheme === 'sepia' ? (
                <Contrast className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
              ) : (
                <Sun className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden xl:inline">
                {comfortTheme === 'dark'
                  ? 'Gelap'
                  : comfortTheme === 'sepia'
                  ? 'Hangat'
                  : 'Studio'}
              </span>
            </button>

            <PostProcessingPopoverButton activeClass={activeBtnClass} idleClass={idleBtnClass} />

            {isVRSupported && onEnterVR && (
              <button
                type="button"
                data-testid="enter-vr-lab-btn"
                onClick={onEnterVR}
                title="Masuk ke mode Imersif WebXR / VR"
                className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  isVRActive ? 'bg-indigo-600 text-white font-bold' : idleBtnClass
                }`}
              >
                <Glasses className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="hidden 2xl:inline">{isVRActive ? 'Keluar VR' : 'VR'}</span>
              </button>
            )}

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh 3D'}
                title={isFullscreen ? 'Keluar Layar Penuh' : 'Perluas Layar Penuh 3D'}
                className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${idleBtnClass}`}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            )}

            <button
              type="button"
              data-testid="toggle-3d-dock-btn"
              onClick={() => {
                labSound.playClick(500);
                setCollapsed(true);
              }}
              aria-label="Sembunyikan Dok Kontrol 3D"
              title="Sembunyikan dok kontrol agar kanvas lebih lapang (H)"
              className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${idleBtnClass}`}
            >
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
