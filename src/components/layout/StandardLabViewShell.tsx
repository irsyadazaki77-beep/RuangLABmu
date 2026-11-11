import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
} from 'lucide-react';
import { CompactTelemetryRibbon, TelemetryRibbonMetric } from '../ui/CompactTelemetryRibbon';
import { VoiceLabMentorDock } from '../ui/VoiceLabMentorDock';
import { AdaptiveNudgeToast } from '../ui/AdaptiveNudgeToast';
import {
  checkImmersiveVRSupport,
  subscribeWebXRState,
  toggleImmersiveVRSession,
  WebXRStateSnapshot,
  getWebXRState,
} from '../../utils/webXRStudioAdapter';
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
  isHazardous = false,
  shutterFlash = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [guideCollapsed, setGuideCollapsed] = useState<boolean>(true);
  const [xrState, setXRState] = useState<WebXRStateSnapshot>(() => getWebXRState());

  useEffect(() => {
    void checkImmersiveVRSupport();
    const unsub = subscribeWebXRState((next) => {
      setXRState(next);
    });
    return unsub;
  }, []);

  const handleToggleVRMode = async () => {
    labSound.playClick(700);
    await toggleImmersiveVRSession();
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
            isHazardous
              ? 'ring-2 ring-inset ring-rose-500/70'
              : xrState.isSessionActive
                ? 'ring-2 ring-inset ring-sky-400/80'
                : ''
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

          {/* Top-Left Custom Overlays + WebXR Mode VR Button */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
            {topOverlay && <div className="pointer-events-auto">{topOverlay}</div>}

            {(xrState.isHardwareVRSupported || xrState.isProgressiveVRAvailable) && (
              <button
                type="button"
                data-testid="enter-vr-lab-btn"
                onClick={handleToggleVRMode}
                aria-pressed={xrState.isSessionActive}
                title={
                  xrState.isHardwareVRSupported
                    ? 'Perangkat mendukung WebXR Immersive-VR — Klik untuk masuk sesi VR'
                    : 'Aktifkan Mode VR Spasial 3D dengan Kontrol Laser Pointer Kiri/Kanan'
                }
                className={`pointer-events-auto px-3 py-1.5 rounded-xl border text-xs font-bold tracking-tight flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                  xrState.isSessionActive
                    ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-300/80 shadow-sky-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-sky-300 hover:text-white border-sky-500/40'
                }`}
              >
                <span aria-hidden="true">🥽</span>
                <span>{xrState.isSessionActive ? 'Keluar Mode VR' : 'Masuk Mode VR'}</span>
              </button>
            )}

            <AdaptiveNudgeToast domain={domain} recordsCount={recordsCount} />
          </div>

          {/* Spatial VR Controller Laser Pointer Status Pill (Active when VR mode is engaged) */}
          {xrState.isSessionActive && (
            <div
              data-testid="xr-spatial-hud"
              className="pointer-events-none absolute top-14 left-3 z-20 max-w-sm rounded-xl bg-slate-950/90 border border-sky-500/50 px-3 py-2 text-[11px] text-slate-200 shadow-xl space-y-1"
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

          {/* Bottom-Left: Minimalist Collapsible Panduan 3D Pill */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-auto hidden md:block max-w-xs">
            {guideHud ? (
              guideHud
            ) : (
              <div className="rounded-xl bg-slate-900/85 border border-white/15 shadow-lg text-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(620);
                    setGuideCollapsed(!guideCollapsed);
                  }}
                  className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-slate-200 hover:text-white font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>💡 Panduan</span>
                  </span>
                  {guideCollapsed ? (
                    <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </button>

                {!guideCollapsed && (
                  <div className="px-3 pb-3 pt-1.5 text-slate-300 text-[11px] leading-relaxed border-t border-white/10 space-y-1">
                    <p className="font-semibold text-white">
                      {guideTitle || 'Eksplorasi Variabel & Aparatus'}
                    </p>
                    <p>
                      {guideText ||
                        'Atur parameter di panel kanan atau seret objek 3D langsung. Catat minimal 3 data pengamatan untuk grafik regresi.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom-Right: Full-Duplex AI Voice Mentor Dock */}
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
            <VoiceLabMentorDock domain={domain} />
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

