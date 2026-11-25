import React, { useEffect } from 'react';
import { BookOpen, Focus, Sliders, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import type { ApparatusInspectionInfo } from '../../utils/studio3DCatalog';
import { SciFormula } from './ScientificNotation';
import { labSound } from '../../utils/soundEngine';
import { LAB_EVENTS, emitLabEvent } from '../../utils/labEventBus';

export interface Scene3DInspectorCardProps {
  info: ApparatusInspectionInfo | null;
  liveMetricSummary?: string;
  onFocusApparatus?: () => void;
  onClose: () => void;
}

/**
 * Floating 3D Apparatus & Concept Inspector Card.
 * Connects any clicked 3D object or Concept Label directly to its scientific explanation and formula.
 */
export const Scene3DInspectorCard: React.FC<Scene3DInspectorCardProps> = ({
  info,
  liveMetricSummary,
  onFocusApparatus,
  onClose,
}) => {
  const { leftDrawerOpen, rightTelemetryOpen, zenMode, setLeftDrawerOpen, setMobileTab, toggleZenMode } =
    useUIStore(
      useShallow((s) => ({
        leftDrawerOpen: s.leftDrawerOpen,
        rightTelemetryOpen: s.rightTelemetryOpen,
        zenMode: s.zenMode,
        setLeftDrawerOpen: s.setLeftDrawerOpen,
        setMobileTab: s.setMobileTab,
        toggleZenMode: s.toggleZenMode,
      }))
    );

  useEffect(() => {
    if (!info) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [info, onClose]);

  if (!info) return null;

  const isLeftOpen = !zenMode && leftDrawerOpen;
  const isRightOpen = !zenMode && rightTelemetryOpen;

  const corridorClass = [
    'left-3 right-3',
    isLeftOpen ? 'lg:left-[332px] xl:left-[344px]' : 'lg:left-4',
    isRightOpen ? 'lg:right-[348px] xl:right-[360px]' : 'lg:right-4',
  ].join(' ');

  const handleOpenParameters = () => {
    labSound.playClick(640);
    if (zenMode) toggleZenMode();
    setLeftDrawerOpen(true);
    setMobileTab('variables');
  };

  const handleFocusCamera = () => {
    labSound.playClick(680);
    if (onFocusApparatus) {
      onFocusApparatus();
    } else {
      emitLabEvent(LAB_EVENTS.SET_CAMERA_PRESET, { index: 3 });
    }
  };

  return (
    <div
      data-testid="scene-3d-inspector-card"
      role="dialog"
      aria-label={`Inspeksi alat ${info.title}`}
      className={`pointer-events-none absolute bottom-[122px] lg:bottom-[106px] z-30 flex justify-center ${corridorClass}`}
    >
      <div className="pointer-events-auto w-full max-w-[420px] rounded-xl studio-hud-surface shadow-xl p-3.5 space-y-2.5 text-[var(--comfort-hud-text)]">
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--comfort-border)]">
          <div className="min-w-0">
            <div className="text-2xs font-mono font-semibold text-sky-600 dark:text-sky-400">
              {info.category}
            </div>
            <h3 className="text-xs sm:text-sm font-bold leading-snug truncate">{info.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              labSound.playClick(480);
              onClose();
            }}
            aria-label="Tutup kartu inspeksi alat"
            className="p-1 rounded-lg hover:bg-sky-500/15 text-[var(--comfort-text-muted)] hover:text-[var(--comfort-hud-text)] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-2xs leading-relaxed text-[var(--comfort-text-muted)]">
          <strong className="text-[var(--comfort-hud-text)]">Peran Alat: </strong>
          {info.roleSummary}
        </p>

        <p className="text-2xs leading-relaxed text-[var(--comfort-text-muted)]">
          <strong className="text-[var(--comfort-hud-text)]">Konsep Ilmiah: </strong>
          {info.scientificConcept}
        </p>

        <div className="px-2.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-2xs font-bold text-sky-700 dark:text-sky-300">
            <SciFormula text={info.relatedFormula} wrap />
          </div>
          {liveMetricSummary && (
            <span className="font-mono text-2xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {liveMetricSummary}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 text-2xs text-[var(--comfort-text-muted)] min-w-0">
            <BookOpen className="w-3 h-3 text-amber-500 shrink-0" aria-hidden="true" />
            <span className="truncate">{info.interactionHint}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="inspector-focus-apparatus-btn"
              onClick={handleFocusCamera}
              title="Zoom kamera fokus langsung ke instrumen 3D"
              className="px-2 py-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:border-sky-500/50 text-[var(--comfort-hud-text)] text-2xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <Focus className="w-3 h-3 text-sky-500 shrink-0" aria-hidden="true" />
              <span>Fokus Kamera</span>
            </button>

            <button
              type="button"
              onClick={handleOpenParameters}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-2xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <Sliders className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Atur Variabel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
