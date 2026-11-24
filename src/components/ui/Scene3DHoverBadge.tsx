import React from 'react';
import { Hand } from 'lucide-react';

interface Scene3DHoverBadgeProps {
  /** Label of the hovered or actively dragged 3D apparatus part (null when idle) */
  hoveredLabel: string | null;
  /** Domain accent color scheme */
  accent?: 'sky' | 'emerald' | 'amber' | 'violet';
}

const ACCENT_CLASSES: Record<NonNullable<Scene3DHoverBadgeProps['accent']>, string> = {
  sky: 'border-sky-400/50 bg-sky-950/85 text-sky-100 shadow-sky-950/60',
  emerald: 'border-emerald-400/50 bg-emerald-950/85 text-emerald-100 shadow-emerald-950/60',
  amber: 'border-amber-400/50 bg-amber-950/85 text-amber-100 shadow-amber-950/60',
  violet: 'border-violet-400/50 bg-violet-950/85 text-violet-100 shadow-violet-950/60',
};

/**
 * Floating non-intrusive HUD badge displayed when a student or teacher hovers
 * or drags an interactive 3D apparatus part directly inside the WebGL viewport.
 */
export const Scene3DHoverBadge: React.FC<Scene3DHoverBadgeProps> = ({
  hoveredLabel,
  accent = 'sky',
}) => {
  if (!hoveredLabel) return null;

  return (
    <div
      data-testid="scene-3d-hover-badge"
      className={`pointer-events-none absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg transition-all duration-150 ${ACCENT_CLASSES[accent]}`}
      role="status"
      aria-live="polite"
    >
      <Hand className="h-3.5 w-3.5 shrink-0 opacity-90" />
      <span className="font-semibold tracking-wide truncate">{hoveredLabel}</span>
      <span className="hidden text-2xs opacity-75 shrink-0 sm:inline">
        · Seret vertikal untuk ubah parameter
      </span>
    </div>
  );
};

