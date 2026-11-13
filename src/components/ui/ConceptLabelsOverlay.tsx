import React from 'react';
import * as THREE from 'three';
import { Tag } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { projectWorldAnchorToViewport } from '../../utils/pedagogicalHelpers';

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
      className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
        showConceptLabels
          ? accentClass
          : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
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
}

interface ConceptLabelSlotItemProps {
  slot: ConceptLabelSlot;
  onBindSlot: (id: string, dom: ConceptLabelDomRef | null) => void;
}

const ConceptLabelSlotItem: React.FC<ConceptLabelSlotItemProps> = React.memo(
  ({ slot, onBindSlot }) => {
    const handleRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        if (!el) {
          onBindSlot(slot.id, null);
          return;
        }
        if (!el.dataset.conceptInit) {
          el.style.display = 'none';
          el.style.transform = 'translate3d(0px, 0px, 0px)';
          el.dataset.conceptInit = '1';
        }
        const textEl = el.querySelector<HTMLSpanElement>('[data-concept-text]');
        onBindSlot(slot.id, { root: el, text: textEl, lastText: '' });
      },
      [slot.id, onBindSlot]
    );

    return (
      <div
        ref={handleRef}
        data-concept-label-id={slot.id}
        className="absolute top-0 left-0 will-change-transform"
      >
        <div className="relative -translate-x-1/2 -translate-y-[calc(100%+10px)] flex flex-col items-center">
          <div className="px-2 py-0.5 rounded-md bg-slate-950/92 border border-slate-600/80 text-[10px] font-mono font-semibold text-slate-100 whitespace-nowrap shadow-md flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
            />
            <span data-concept-text />
          </div>
          <div
            className="w-px h-2.5"
            style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full border border-slate-950"
            style={{ backgroundColor: slot.accentHex || '#38bdf8' }}
          />
        </div>
      </div>
    );
  }
);
ConceptLabelSlotItem.displayName = 'ConceptLabelSlotItem';

export const ConceptLabelsLayer: React.FC<ConceptLabelsLayerProps> = React.memo(
  ({ slots, visible, onBindSlot }) => {
    if (!visible) return null;

    return (
      <div
        data-testid="concept-labels-layer"
        className="pointer-events-none absolute inset-0 overflow-hidden z-10 select-none"
        aria-hidden="true"
      >
        {slots.map((slot) => (
          <ConceptLabelSlotItem key={slot.id} slot={slot} onBindSlot={onBindSlot} />
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
      height
    );

    if (!proj.visible) {
      if (dom.root.style.display !== 'none') {
        dom.root.style.display = 'none';
      }
      continue;
    }

    if (dom.root.style.display !== 'block') {
      dom.root.style.display = 'block';
    }
    dom.root.style.transform = `translate3d(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px, 0px)`;
    if (dom.text && dom.lastText !== entry.text) {
      dom.text.textContent = entry.text;
      dom.lastText = entry.text;
    }
  }
}
