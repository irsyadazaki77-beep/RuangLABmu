import React, { useEffect, useRef, useState } from 'react';
import { Scale, RotateCcw, X, Camera, ClipboardPlus, Check } from 'lucide-react';
import { CameraSyncPose } from '../../utils/threeStudioKit';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { SceneEmbedModeProvider } from '../../contexts/SceneEmbedModeContext';

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
  onRecordComparison?: () => void;
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
  onRecordComparison,
  onClose,
  renderViewport,
}) => {
  const [justRecordedPair, setJustRecordedPair] = useState(false);
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
      className="w-full h-full flex flex-col bg-[var(--comfort-bg)] text-[var(--comfort-text)] p-2.5 gap-2.5 overflow-hidden select-none"
    >
      {/* Top Dual-Reality Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shrink-0 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300 text-xs font-bold shrink-0">
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Komparasi A vs B ({domain})</span>
          </span>
          <span className="hidden md:inline text-xs text-[var(--comfort-text-muted)] font-medium truncate">
            · {moduleTitle}
          </span>
          <span
            data-testid="dual-3d-lite-badge"
            className="hidden xl:inline-flex items-center gap-1 text-[11px] text-[var(--comfort-text-muted)]"
            title="Kamera kedua panel tersinkron otomatis dengan mode hemat GPU"
          >
            <Camera className="w-3 h-3 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <span>Kamera Tersinkron</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {deltaSummary && (
            <span
              data-testid="dual-3d-delta-pill"
              className="font-mono font-bold text-xs text-amber-700 dark:text-amber-300 tabular-nums px-1.5"
            >
              {deltaSummary}
            </span>
          )}
          {onRecordComparison && (
            <button
              type="button"
              data-testid="record-dual-comparison-btn"
              onClick={() => {
                labSound.playRecordSuccess();
                onRecordComparison();
                setJustRecordedPair(true);
                window.setTimeout(() => setJustRecordedPair(false), 1800);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                justRecordedPair
                  ? 'bg-emerald-600'
                  : 'bg-sky-600 hover:bg-sky-500'
              }`}
              title="Catat kedua kondisi Realitas A dan Realitas B sekaligus ke Tabel Pengamatan"
            >
              {justRecordedPair ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tercatat (A &amp; B)</span>
                </>
              ) : (
                <>
                  <ClipboardPlus className="w-3.5 h-3.5" />
                  <span>Catat A vs B</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              labSound.playClick(580);
              onResetBToMatchA();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Keluar Split 3D</span>
          </button>
        </div>
      </div>

      {/* Dual 3D Side-by-Side Grid */}
      <SceneEmbedModeProvider mode="dual">
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Reality A (Control) */}
          <div
            data-testid="dual-reality-panel-a"
            className="relative flex flex-col rounded-xl border border-sky-500/45 bg-[var(--comfort-surface)] overflow-hidden min-h-[260px]"
          >
            <div className="px-3 py-1.5 bg-sky-500/10 border-b border-[var(--comfort-border)] flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-sky-800 dark:text-sky-200">
                Realitas A (Kontrol)
              </span>
              <span className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums truncate">
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
            className="relative flex flex-col rounded-xl border border-amber-500/45 bg-[var(--comfort-surface)] overflow-hidden min-h-[260px]"
          >
            <div className="px-3 py-1.5 bg-amber-500/10 border-b border-[var(--comfort-border)] flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                Realitas B (Uji Variabel)
              </span>
              <span className="font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300 tabular-nums truncate">
                {realityBSummary}
              </span>
            </div>
            {realityBControls && (
              <div className="px-3 py-1.5 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
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
      </SceneEmbedModeProvider>
    </div>
  );
};
