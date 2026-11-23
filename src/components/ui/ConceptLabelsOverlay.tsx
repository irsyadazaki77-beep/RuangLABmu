import React from 'react';
import * as THREE from 'three';
import { Tag } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import {
  projectWorldAnchorToViewport,
  resolveConceptLabelCollisions,
} from '../../utils/pedagogicalHelpers';
import { useSceneEmbedMode } from '../../contexts/SceneEmbedModeContext';

export interface ConceptLabelToggleButtonProps {
  accentClass?: string;
}

export const ConceptLabelToggleButton: React.FC<ConceptLabelToggleButtonProps> = ({
  accentClass = 'bg-sky-500 text-slate-950 font-bold',
}) => {
  const showConceptLabels = useUIStore((s) => s.showConceptLabels);
  const toggleConceptLabels = useUIStore((s) => s.toggleConceptLabels);

  return (
    <button
      type="button"
      data-testid="toggle-concept-labels-btn"
      aria-pressed={showConceptLabels}
      onClick={() => {
        labSound.playClick(showConceptLabels ? 520 : 680);
        toggleConceptLabels();
      }}
      title={
        showConceptLabels
          ? 'Sembunyikan Label & Panah Konsep 3D'
          : 'Tampilkan Label & Panah Konsep 3D'
      }
      className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        showConceptLabels
          ? accentClass
          : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-sky-500/10 font-medium'
      }`}
    >
      <Tag className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">Label Konsep</span>
    </button>
  );
};

export interface ConceptLabelSlot {
  id: string;
  accentHex?: string;
}

export interface ConceptLabelDomRef {
  root: HTMLDivElement | null;
  text: HTMLSpanElement | null;
  lastText: string;
}

export interface ConceptLabelProjectionEntry {
  dom: ConceptLabelDomRef | undefined;
  worldPos: THREE.Vector3;
  text: string;
  active: boolean;
}

export interface ConceptLabelsLayerProps {
  slots: ConceptLabelSlot[];
  visible: boolean;
  onBindSlot: (id: string, dom: ConceptLabelDomRef | null) => void;
  onSelectSlot?: (slotId: string, labelText: string) => void;
}

interface ConceptLabelSlotItemProps {
  slot: ConceptLabelSlot;
  onBindSlot: (id: string, dom: ConceptLabelDomRef | null) => void;
  onSelectSlot?: (slotId: string, labelText: string) => void;
}

const ConceptLabelSlotItem: React.FC<ConceptLabelSlotItemProps> = React.memo(
  ({ slot, onBindSlot, onSelectSlot }) => {
    const textNodeRef = React.useRef<HTMLSpanElement | null>(null);
    const handleRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        if (!el) {
          textNodeRef.current = null;
          onBindSlot(slot.id, null);
          return;
        }
        if (!el.dataset.conceptInit) {
          el.style.display = 'none';
          el.style.transform = 'translate3d(0px, 0px, 0px)';
          el.dataset.conceptInit = '1';
        }
        const textEl = el.querySelector<HTMLSpanElement>('[data-concept-text]');
        textNodeRef.current = textEl;
        onBindSlot(slot.id, { root: el, text: textEl, lastText: '' });
      },
      [slot.id, onBindSlot]
    );

    const handleClick = React.useCallback(() => {
      if (!onSelectSlot) return;
      labSound.playClick(680);
      onSelectSlot(slot.id, textNodeRef.current?.textContent || slot.id);
    }, [onSelectSlot, slot.id]);

    return (
      <div
        ref={handleRef}
        data-concept-label-id={slot.id}
        className="absolute top-0 left-0 will-change-transform"
      >
        <div className="relative -translate-x-1/2 -translate-y-[calc(100%+10px)] flex flex-col items-center">
          {onSelectSlot ? (
            <button
              type="button"
              onClick={handleClick}
              title="Klik untuk inspeksi konsep & rumus terkait"
              className="pointer-events-auto cursor-pointer pl-2 pr-2.5 py-1 rounded-md studio-hud-surface hover:border-sky-500/70 text-[10px] font-mono font-semibold tabular-nums text-[var(--comfort-hud-text)] whitespace-nowrap shadow-md flex items-center gap-1.5 transition-colors"
            >
              <span
                aria-hidden="true"
                className="w-[2.5px] h-3 rounded-xs shrink-0"
                style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
              />
              <span data-concept-text />
            </button>
          ) : (
            <div className="pl-2 pr-2.5 py-1 rounded-md studio-hud-surface text-[10px] font-mono font-semibold tabular-nums text-[var(--comfort-hud-text)] whitespace-nowrap shadow-md flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="w-[2.5px] h-3 rounded-xs shrink-0"
                style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
              />
              <span data-concept-text />
            </div>
          )}
          <div
            className="w-px h-3 opacity-80"
            style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
          />
          <span
            className="w-2 h-2 rounded-full border-[1.5px] bg-transparent"
            style={{ borderColor: slot.accentHex || '#38bdf8' }}
          />
        </div>
      </div>
    );
  }
);
ConceptLabelSlotItem.displayName = 'ConceptLabelSlotItem';

export const ConceptLabelsLayer: React.FC<ConceptLabelsLayerProps> = React.memo(
  ({ slots, visible, onBindSlot, onSelectSlot }) => {
    const embedMode = useSceneEmbedMode();
    if (!visible || embedMode !== 'full') return null;

    return (
      <div
        data-testid="concept-labels-layer"
        className="pointer-events-none absolute inset-0 overflow-hidden z-10 select-none"
      >
        {slots.map((slot) => (
          <ConceptLabelSlotItem
            key={slot.id}
            slot={slot}
            onBindSlot={onBindSlot}
            onSelectSlot={onSelectSlot}
          />
        ))}
      </div>
    );
  }
);
ConceptLabelsLayer.displayName = 'ConceptLabelsLayer';

export function updateProjectedConceptLabels(
  entries: ConceptLabelProjectionEntry[],
  camera: THREE.Camera,
  width: number,
  height: number,
  show: boolean,
  scratchVec: THREE.Vector3
): void {
  const projectedVisible: {
    dom: ConceptLabelDomRef;
    text: string;
    x: number;
    y: number;
  }[] = [];

  const uiState = useUIStore.getState();
  const isSpatialDesktop = width >= 1024;
  const leftInset =
    isSpatialDesktop && !uiState.zenMode && uiState.leftDrawerOpen
      ? (width >= 1280 ? 440 : 426)
      : 86;
  const rightInset =
    isSpatialDesktop && !uiState.zenMode && uiState.rightTelemetryOpen
      ? (width >= 1280 ? 446 : 430)
      : 86;
  // ConceptLabelSlotItem renders ~38px above its projected (x, y) anchor dot;
  // reserve full clearance below SpatialHudTopBar + Scene3DControlDock + GuidedLabStepsOverlay.
  const topInset = width >= 1280 ? 198 : isSpatialDesktop ? 218 : 186;
  const bottomInset = isSpatialDesktop ? 124 : 134;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const dom = entry.dom;
    if (!dom || !dom.root) continue;

    if (!show || !entry.active || !entry.text) {
      if (dom.root.style.display !== 'none') {
        dom.root.style.display = 'none';
      }
      continue;
    }

    scratchVec.copy(entry.worldPos).project(camera);
    const proj = projectWorldAnchorToViewport(
      scratchVec.x,
      scratchVec.y,
      scratchVec.z,
      width,
      height,
      68,
      28,
      {
        left: leftInset,
        right: rightInset,
        top: topInset,
        bottom: bottomInset,
      }
    );

    if (!proj.visible) {
      if (dom.root.style.display !== 'none') {
        dom.root.style.display = 'none';
      }
      continue;
    }

    projectedVisible.push({
      dom,
      text: entry.text,
      x: proj.x,
      y: proj.y,
    });
  }

  const resolved = resolveConceptLabelCollisions(projectedVisible, width, height, {
    minX: leftInset,
    maxX: Math.max(leftInset, width - rightInset),
    minY: topInset,
    maxY: Math.max(topInset, height - bottomInset),
  });
  for (let i = 0; i < resolved.length; i++) {
    const item = resolved[i];
    const { dom } = item;
    if (!dom.root) continue;
    if (dom.root.style.display !== 'block') {
      dom.root.style.display = 'block';
    }
    dom.root.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0px)`;
    if (dom.text && dom.lastText !== item.text) {
      dom.text.textContent = item.text;
      dom.lastText = item.text;
    }
  }
}
