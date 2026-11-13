import React, { useEffect, useRef, useState } from 'react';
import { Scale, RotateCcw, X, Camera, Cpu } from 'lucide-react';
import { CameraSyncPose } from '../../utils/threeStudioKit';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';

export interface DualViewportSyncProps {
  cameraSyncPose: CameraSyncPose | null;
  onCameraSyncChange: (pose: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
}

export interface DualRealityLabViewportProps {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  moduleTitle: string;
  realityASummary: string;
  realityBSummary: string;
  deltaSummary?: string;
  realityBControls?: React.ReactNode;
  onResetBToMatchA: () => void;
  onClose: () => void;
  renderViewport: (side: 'A' | 'B', syncProps: DualViewportSyncProps) => React.ReactNode;
}

export const DualRealityLabViewport: React.FC<DualRealityLabViewportProps> = ({
  domain,
  moduleTitle,
  realityASummary,
  realityBSummary,
  deltaSummary,
  realityBControls,
  onResetBToMatchA,
  onClose,
  renderViewport,
}) => {
  const prevLiteModeRef = useRef<boolean | null>(null);
  const seqRef = useRef<number>(0);
  const lastEmitAtRef = useRef<number>(0);

  const [syncState, setSyncState] = useState<{
    targetSide: 'A' | 'B' | null;
    pose: CameraSyncPose | null;
  }>({ targetSide: null, pose: null });

  // Automatic 3T Hardware Protection: force liteDeviceMode (no Bloom/ShadowMap, max 30 FPS) while dual WebGL is active
  useEffect(() => {
    const uiState = useUIStore.getState();
    prevLiteModeRef.current = uiState.liteDeviceMode;
    if (!uiState.liteDeviceMode) {
      uiState.setLiteDeviceMode(true);
    }
    return () => {
      if (prevLiteModeRef.current !== null) {
        useUIStore.getState().setLiteDeviceMode(prevLiteModeRef.current);
      }
    };
  }, []);

  const handleViewportCameraChange =
    (sourceSide: 'A' | 'B') =>
    (pose: { position: [number, number, number]; target: [number, number, number] }) => {
      const now = performance.now();
      if (now - lastEmitAtRef.current < 16) return;
      lastEmitAtRef.current = now;
      seqRef.current += 1;
      setSyncState({
        targetSide: sourceSide === 'A' ? 'B' : 'A',
        pose: {
          position: pose.position,
          target: pose.target,
          seq: seqRef.current,
          sourceId: sourceSide,
        },
      });
    };

  return (
    <div
      data-testid="dual-reality-viewport"
      className="w-full h-full flex flex-col bg-slate-950 text-slate-100 p-2.5 gap-2.5 overflow-hidden select-none"
    >
      {/* Top Dual-Reality Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-bold shrink-0">
            <Scale className="w-3.5 h-3.5" />
            <span>Dual-3D Realitas A vs B ({domain})</span>
          </span>
          <span className="hidden md:inline text-xs text-slate-300 font-semibold truncate">
            {moduleTitle}
          </span>
          <span
            data-testid="dual-3d-lite-badge"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-mono font-semibold"
            title="Proteksi Perangkat 3T otomatis aktif: Bloom & bayangan dinonaktifkan sementara untuk menjaga 30 FPS stabil"
          >
            <Cpu className="w-3 h-3" />
            <span>Proteksi 3T Aktif (Lite 30Hz)</span>
          </span>
          <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
            <Camera className="w-3 h-3 text-sky-400" />
            <span>Kamera & Waktu Tersinkron</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {deltaSummary && (
            <span
              data-testid="dual-3d-delta-pill"
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono font-bold text-[11px] tabular-nums"
            >
              {deltaSummary}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              labSound.playClick(580);
              onResetBToMatchA();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            title="Samakan variabel Realitas B dengan Realitas A"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Samakan B = A</span>
          </button>
          <button
            type="button"
            data-testid="close-dual-3d-btn"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Keluar Split 3D</span>
          </button>
        </div>
      </div>

      {/* Dual 3D Side-by-Side Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Reality A (Control) */}
        <div
          data-testid="dual-reality-panel-a"
          className="relative flex flex-col rounded-xl border-2 border-sky-500/50 bg-slate-900/60 overflow-hidden min-h-[260px]"
        >
          <div className="px-3 py-1.5 bg-sky-950/80 border-b border-sky-500/30 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span className="text-xs font-extrabold text-sky-200">Realitas A (Kontrol)</span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-sky-300 tabular-nums truncate">
              {realityASummary}
            </span>
          </div>
          <div className="relative flex-1 min-h-[220px]">
            {renderViewport('A', {
              cameraSyncPose: syncState.targetSide === 'A' ? syncState.pose : null,
              onCameraSyncChange: handleViewportCameraChange('A'),
            })}
          </div>
        </div>

        {/* Reality B (Test Variable) */}
        <div
          data-testid="dual-reality-panel-b"
          className="relative flex flex-col rounded-xl border-2 border-amber-500/50 bg-slate-900/60 overflow-hidden min-h-[260px]"
        >
          <div className="px-3 py-1.5 bg-amber-950/75 border-b border-amber-500/30 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-extrabold text-amber-200">Realitas B (Uji Variabel)</span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-amber-300 tabular-nums truncate">
              {realityBSummary}
            </span>
          </div>
          {realityBControls && (
            <div className="px-3 py-1.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
              {realityBControls}
            </div>
          )}
          <div className="relative flex-1 min-h-[220px]">
            {renderViewport('B', {
              cameraSyncPose: syncState.targetSide === 'B' ? syncState.pose : null,
              onCameraSyncChange: handleViewportCameraChange('B'),
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
