import React from 'react';
import { Eye, Layers, ScanEye, X } from 'lucide-react';
import { ConceptLabelToggleButton } from '../../ui/ConceptLabelsOverlay';
import type { AnatomyLayerMode, AnatomyPinDef } from './AnatomyPinsData';

export interface AnatomyHudOverlayProps {
  zenMode: boolean;
  leftDrawerOpen: boolean;
  rightTelemetryOpen: boolean;
  layerMode: AnatomyLayerMode;
  onChangeLayerMode: (mode: AnatomyLayerMode) => void;
  activePins: AnatomyPinDef[];
  selectedPinId: string | null;
  selectedPin: AnatomyPinDef | null;
  onSelectPin: (pin: AnatomyPinDef) => void;
  onClosePinCard: () => void;
  onResetCamera: () => void;
  dragToast: { label: string; value: string } | null;
  params: Record<string, number>;
}

export const AnatomyHudOverlay: React.FC<AnatomyHudOverlayProps> = ({
  zenMode,
  leftDrawerOpen,
  rightTelemetryOpen,
  layerMode,
  onChangeLayerMode,
  activePins,
  selectedPinId,
  selectedPin,
  onSelectPin,
  onClosePinCard,
  onResetCamera,
  dragToast,
  params,
}) => {
  return (
    <>
      {dragToast && (
        <div className="pointer-events-none absolute bottom-[96px] lg:bottom-[100px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-cyan-500/45 px-3.5 py-1.5 shadow-xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span className="text-[var(--comfort-hud-muted)]">{dragToast.label}:</span>
          <span className="font-bold text-cyan-700 dark:text-cyan-300">{dragToast.value}</span>
        </div>
      )}

      {/* Unified Bottom Control Dock: X-Ray / Cross-Section + Anatomical Pins + Reset */}
      <div
        className={`pointer-events-none absolute bottom-[54px] lg:bottom-[58px] z-20 flex items-center justify-center left-2.5 right-2.5 sm:left-3 sm:right-3 ${
          !zenMode && leftDrawerOpen ? 'lg:left-[320px] xl:left-[340px]' : 'lg:left-3'
        } ${!zenMode && rightTelemetryOpen ? 'lg:right-[328px] xl:right-[348px]' : 'lg:right-3'}`}
      >
        <div className="pointer-events-auto flex flex-nowrap items-center gap-1 studio-hud-surface border border-[var(--comfort-border)] rounded-xl px-1.5 py-1 shadow-md max-w-full overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'outer', label: 'Luar', Icon: Eye, activeBg: 'bg-rose-600' },
              { id: 'xray', label: 'X-Ray', Icon: ScanEye, activeBg: 'bg-cyan-600' },
              { id: 'cross-section', label: 'Penampang', Icon: Layers, activeBg: 'bg-indigo-600' },
            ] as const
          ).map(({ id, label, Icon, activeBg }) => (
            <button
              key={id}
              type="button"
              aria-pressed={layerMode === id}
              onClick={() => onChangeLayerMode(id)}
              className={`px-2 py-1 rounded-lg text-2xs font-medium transition flex items-center gap-1 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                layerMode === id
                  ? `${activeBg} text-white shadow-sm`
                  : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px bg-[var(--comfort-border)] shrink-0" aria-hidden="true" />

          {activePins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              aria-pressed={selectedPinId === pin.id}
              onClick={() => onSelectPin(pin)}
              className={`px-2 py-1 rounded-lg text-2xs font-semibold transition cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                selectedPinId === pin.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'studio-hud-subcard border hover:border-cyan-500/50 text-[var(--comfort-hud-text)]'
              }`}
            >
              [{pin.num}] {pin.name.split(' ')[0]}
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px bg-[var(--comfort-border)] shrink-0" aria-hidden="true" />

          <button
            type="button"
            data-testid="camera-reset-btn"
            aria-label="Reset View Kamera 3D"
            onClick={onResetCamera}
            title="Reset View ke Sudut 3D Awal"
            className="px-2 py-1 rounded-lg text-2xs font-medium text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/10 transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Reset
          </button>
          <ConceptLabelToggleButton accentClass="bg-cyan-500 text-slate-950 font-bold" />
        </div>
      </div>

      {/* Floating Anatomical Pin Info Card */}
      {selectedPin && (
        <div
          className={`absolute bottom-[96px] lg:bottom-[100px] z-20 w-80 max-w-[calc(100%-1.5rem)] studio-hud-surface border border-cyan-500/45 rounded-xl p-3.5 shadow-2xl ${
            !zenMode && rightTelemetryOpen ? 'right-3 lg:right-[328px] xl:right-[348px]' : 'right-3'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="inline-block text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 mb-1">
                Pin #{selectedPin.num} · Inspeksi Organ 3D
              </span>
              <h4 className="text-sm font-bold text-[var(--comfort-hud-text)] leading-tight">
                {selectedPin.name}
              </h4>
              <p className="text-2xs text-cyan-700 dark:text-cyan-300">{selectedPin.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClosePinCard}
              className="p-1 rounded-lg text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Tutup kartu pin"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-[var(--comfort-hud-muted)] leading-relaxed mb-2.5">
            {selectedPin.description}
          </p>
          <div className="space-y-1.5 border-t border-[var(--comfort-border)] pt-2">
            {selectedPin.getLiveMetrics(params).map((m) => (
              <div key={m.label} className="flex items-center justify-between text-xs gap-2">
                <span className="text-[var(--comfort-hud-muted)]">{m.label}</span>
                <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-300 tabular-nums shrink-0">
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
