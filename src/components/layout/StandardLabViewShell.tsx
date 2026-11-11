import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Maximize2,
  Minimize2,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';
import { CompactTelemetryRibbon, TelemetryRibbonMetric } from '../ui/CompactTelemetryRibbon';
import { labSound } from '../../utils/soundEngine';

export interface CameraPresetItem {
  id: string;
  label: string;
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
}

const DEFAULT_CAMERA_PRESETS: CameraPresetItem[] = [
  { id: 'isometric', label: 'Isometrik' },
  { id: 'top', label: 'Atas' },
  { id: 'focus', label: 'Fokus' },
];

export const StandardLabViewShell: React.FC<StandardLabViewShellProps> = ({
  domain,
  recordsCount,
  telemetryMetrics,
  oscilloscope,
  canvas,
  sidebar,
  safetyModal,
  topOverlay,
  guideHud,
  guideTitle,
  guideText,
  zenMode = false,
  activeCameraPreset = 'isometric',
  cameraPresets = DEFAULT_CAMERA_PRESETS,
  onSelectCameraPreset,
  isHazardous = false,
  shutterFlash = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [guideCollapsed, setGuideCollapsed] = useState<boolean>(true);

  const toggleFullscreen = () => {
    labSound.playClick();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {
        setIsFullscreen(!isFullscreen);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
      });
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full bg-[var(--comfort-bg)] text-[var(--comfort-text)] select-none">
      {/* 1. Optional Safety Hazard Modal */}
      {safetyModal}

      {/* 2. Middle Left Area: Ribbon & 3D Canvas Container */}
      <div
        ref={containerRef}
        className={`flex-1 relative flex flex-col min-w-0 h-full overflow-hidden ${
          isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : ''
        }`}
      >
        {/* Top 48px Telemetry Ribbon */}
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
        />

        {/* Full-Bleed 3D Canvas Viewport */}
        <div
          className={`relative w-full flex-1 min-h-[360px] overflow-hidden bg-slate-950 transition-all select-none ${
            isHazardous ? 'ring-2 ring-inset ring-rose-500/70' : ''
          }`}
        >
          {canvas}

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

          {/* Top-Left Custom Overlays (e.g. Vector Toggles, Domain Badges) */}
          {topOverlay && (
            <div className="absolute top-3 left-3 z-20 flex items-center pointer-events-none">
              <div className="pointer-events-auto">{topOverlay}</div>
            </div>
          )}

          {/* Bottom-Left: Collapsible Panduan Praktikum 3D Pill (Collapsed by default) */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-auto hidden sm:block max-w-sm">
            {guideHud ? (
              guideHud
            ) : (
              <div className="rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg text-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(620);
                    setGuideCollapsed(!guideCollapsed);
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between gap-3 text-sky-300 hover:text-white font-semibold cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <span>💡 Panduan Praktikum 3D</span>
                  </span>
                  {guideCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {!guideCollapsed && (
                  <div className="px-3 pb-3 pt-1 text-slate-300 text-[11px] leading-relaxed border-t border-slate-800/80 space-y-1.5">
                    <p className="font-semibold text-white">{guideTitle || 'Eksplorasi Variabel & Aparatus'}</p>
                    <p>{guideText || 'Ubah parameter di panel samping atau interaksikan langsung objek 3D di kanvas. Ambil minimal 3 rekaman data untuk melihat kurva regresi ilmiah.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Right Area: Sidebar Parameter & Preset (Scrollable, w-80 lg:w-96) */}
      {!zenMode && (
        <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-[var(--comfort-border)] bg-[var(--comfort-surface)] overflow-y-auto p-4 shrink-0 space-y-3.5">
          {sidebar}
        </aside>
      )}
    </div>
  );
};
