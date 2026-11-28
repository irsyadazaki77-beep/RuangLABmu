import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import type { AntiAliasingMode } from '../../utils/threePostProcessing';

export interface PostProcessingPopoverButtonProps {
  activeClass: string;
  idleClass: string;
}

const AA_OPTIONS: { id: AntiAliasingMode; label: string; hint: string }[] = [
  { id: 'smaa', label: 'SMAA', hint: 'Halus & tajam pada skala gelas dan garis tipis' },
  { id: 'fxaa', label: 'FXAA', hint: 'Anti-aliasing cepat untuk GPU ringan' },
  { id: 'off', label: 'Off', hint: 'Tanpa filter anti-aliasing tambahan' },
];

/**
 * Compact studio popover inside Scene3DControlDock for real-time Bloom, SSAO, and Anti-Aliasing control.
 * Renders its dialog via a document.body portal (z-90) with an opaque surface so it always sits cleanly
 * above GuidedLabStepsOverlay and never stalls WebGL with backdrop-filter.
 */
export const PostProcessingPopoverButton: React.FC<PostProcessingPopoverButtonProps> = ({
  activeClass,
  idleClass,
}) => {
  const [open, setOpen] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{ top?: number; bottom?: number; right: number }>({
    bottom: 96,
    right: 16,
  });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const { postProcessing, liteDeviceMode, qualityMode, setPostProcessing, resetPostProcessing } =
    useUIStore(
      useShallow((s) => ({
        postProcessing: s.postProcessing,
        liteDeviceMode: s.liteDeviceMode,
        qualityMode: s.qualityMode,
        setPostProcessing: s.setPostProcessing,
        resetPostProcessing: s.resetPostProcessing,
      }))
    );

  const updateAnchorPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const rightOffset = Math.max(12, window.innerWidth - rect.right);
    const maxRight = Math.max(12, window.innerWidth - 288);
    const clampedRight = Math.round(Math.min(rightOffset, maxRight));
    if (rect.top > window.innerHeight * 0.5) {
      setAnchorPos({
        bottom: Math.max(12, Math.round(window.innerHeight - rect.top + 8)),
        right: clampedRight,
      });
    } else {
      setAnchorPos({
        top: Math.max(12, Math.round(rect.bottom + 8)),
        right: clampedRight,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateAnchorPosition();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateAnchorPosition);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateAnchorPosition);
    };
  }, [open, updateAnchorPosition]);

  const isSaverPaused = liteDeviceMode || qualityMode === '3t-saver';
  const isActivePipeline = postProcessing.enabled && !isSaverPaused;

  const popoverPanel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Pengaturan Post-Processing 3D"
            data-testid="postfx-popover-panel"
            style={{
              ...(anchorPos.top !== undefined ? { top: anchorPos.top } : {}),
              ...(anchorPos.bottom !== undefined ? { bottom: anchorPos.bottom } : {}),
              right: anchorPos.right,
            }}
            className="fixed z-[90] w-[276px] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl p-3 shadow-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] text-left"
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[var(--comfort-border)]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
                <span className="text-2xs font-bold tracking-tight text-[var(--comfort-text)]">
                  Post-Processing 3D
                </span>
              </div>
              <button
                type="button"
                data-testid="postfx-reset-btn"
                onClick={() => {
                  labSound.playClick(560);
                  resetPostProcessing();
                }}
                title="Kembalikan pengaturan Post-Processing ke standar studio"
                className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-sky-500/12 transition-colors cursor-pointer"
                aria-label="Reset Post-Processing ke Default"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>

            {isSaverPaused && (
              <div className="mb-2.5 px-2 py-1.5 rounded-lg bg-amber-500/12 border border-amber-500/30 text-2xs leading-snug text-amber-800 dark:text-amber-300">
                Mode Ringan 3T aktif — efek multi-pass dijeda otomatis untuk menghemat GPU &amp; baterai.
              </div>
            )}

            {/* Master Pipeline Switch */}
            <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
              <div>
                <div className="text-2xs font-semibold text-[var(--comfort-text)]">
                  Aktifkan Pipeline FX
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)]">
                  HDR Tone-Mapping + Pass Visual
                </div>
              </div>
              <input
                type="checkbox"
                data-testid="postfx-master-toggle"
                checked={postProcessing.enabled}
                onChange={(e) => {
                  labSound.playClick(e.target.checked ? 680 : 500);
                  setPostProcessing({ enabled: e.target.checked });
                }}
                className="w-4 h-4 accent-sky-600 cursor-pointer"
              />
            </label>

            <div
              className={`mt-2 pt-2 border-t border-[var(--comfort-border)] space-y-2.5 transition-opacity ${
                postProcessing.enabled ? 'opacity-100' : 'opacity-45 pointer-events-none'
              }`}
            >
              {/* SSAO Ambient Occlusion */}
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <div>
                    <div className="text-2xs font-semibold text-[var(--comfort-text)]">
                      SSAO (Bayangan Kontak)
                    </div>
                    <div className="text-2xs text-[var(--comfort-text-muted)]">
                      Kedalaman celah meja &amp; instrumen
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    data-testid="postfx-ssao-toggle"
                    checked={postProcessing.ssaoEnabled}
                    onChange={(e) => {
                      labSound.playClick(e.target.checked ? 660 : 520);
                      setPostProcessing({ ssaoEnabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-sky-600 cursor-pointer"
                  />
                </label>
                {postProcessing.ssaoEnabled && (
                  <div className="flex items-center gap-2 pl-0.5">
                    <span className="text-2xs text-[var(--comfort-text-muted)] w-12 shrink-0">
                      Radius
                    </span>
                    <input
                      type="range"
                      aria-label="Radius SSAO"
                      data-testid="postfx-ssao-radius-slider"
                      min={0.2}
                      max={1.2}
                      step={0.05}
                      value={postProcessing.ssaoRadius}
                      onChange={(e) =>
                        setPostProcessing({ ssaoRadius: parseFloat(e.target.value) })
                      }
                      className="flex-1 h-1.5 accent-sky-600 cursor-pointer"
                    />
                    <span className="text-2xs font-mono tabular-nums text-[var(--comfort-text)] w-8 text-right">
                      {postProcessing.ssaoRadius.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Bloom */}
              <div className="space-y-1">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <div>
                    <div className="text-2xs font-semibold text-[var(--comfort-text)]">
                      Bloom HDR
                    </div>
                    <div className="text-2xs text-[var(--comfort-text-muted)]">
                      Pendar halus OLED, laser &amp; bintang
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    data-testid="postfx-bloom-toggle"
                    checked={postProcessing.bloomEnabled}
                    onChange={(e) => {
                      labSound.playClick(e.target.checked ? 660 : 520);
                      setPostProcessing({ bloomEnabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-sky-600 cursor-pointer"
                  />
                </label>
                {postProcessing.bloomEnabled && (
                  <div className="flex items-center gap-2 pl-0.5">
                    <span className="text-2xs text-[var(--comfort-text-muted)] w-12 shrink-0">
                      Intensitas
                    </span>
                    <input
                      type="range"
                      aria-label="Intensitas Bloom"
                      data-testid="postfx-bloom-strength-slider"
                      min={0.05}
                      max={0.6}
                      step={0.01}
                      value={postProcessing.bloomStrength}
                      onChange={(e) =>
                        setPostProcessing({ bloomStrength: parseFloat(e.target.value) })
                      }
                      className="flex-1 h-1.5 accent-sky-600 cursor-pointer"
                    />
                    <span className="text-2xs font-mono tabular-nums text-[var(--comfort-text)] w-8 text-right">
                      {postProcessing.bloomStrength.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Anti-Aliasing Mode */}
              <div className="space-y-1.5 pt-1 border-t border-[var(--comfort-border)]">
                <div className="text-2xs font-semibold text-[var(--comfort-text)]">
                  Anti-Aliasing Tepi &amp; Tekstur
                </div>
                <div
                  role="radiogroup"
                  aria-label="Mode Anti-Aliasing 3D"
                  className="grid grid-cols-3 gap-1"
                >
                  {AA_OPTIONS.map((opt) => {
                    const selected = postProcessing.aaMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`postfx-aa-${opt.id}`}
                        title={opt.hint}
                        onClick={() => {
                          labSound.playClick(620);
                          setPostProcessing({ aaMode: opt.id });
                        }}
                        className={`px-2 py-1 rounded-lg text-2xs font-mono font-semibold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'studio-hud-subcard text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="toggle-postfx-popover-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          labSound.playClick(open ? 520 : 660);
          if (!open) updateAnchorPosition();
          setOpen((prev) => !prev);
        }}
        title="Pengaturan Post-Processing 3D (Bloom, SSAO, Anti-Aliasing)"
        className={`px-1.5 py-1 text-2xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
          open ? activeClass : idleClass
        }`}
      >
        <Sparkles
          className={`w-3 h-3 shrink-0 ${isActivePipeline && !open ? 'text-sky-500' : ''}`}
          aria-hidden="true"
        />
        <span className="hidden md:inline 2xl:hidden">FX</span>
        <span className="hidden 2xl:inline">FX 3D</span>
      </button>
      {popoverPanel}
    </div>
  );
};
