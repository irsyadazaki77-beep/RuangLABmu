import React, { useEffect, useState } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  Crosshair,
  Link2,
  X,
  ArrowUpRight,
  Sliders,
} from 'lucide-react';
import {
  adaptiveScaffoldingEngine,
  AdaptiveScaffoldingHint,
} from '../../utils/engines/adaptiveScaffoldingEngine';
import {
  globalMultiApparatusEngine,
  triggerDomainApparatusSnap,
  TransferStepSummary,
} from '../../utils/engines/multiApparatusEngine';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { LAB_EVENTS, emitLabEvent } from '../../utils/labEventBus';
import { labSound } from '../../utils/soundEngine';

export interface AdaptiveNudgeToastProps {
  domain?: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  recordsCount?: number;
}

export const AdaptiveNudgeToast: React.FC<AdaptiveNudgeToastProps> = ({
  domain = 'Fisika',
  recordsCount = 0,
}) => {
  const [activeHint, setActiveHint] = useState<AdaptiveScaffoldingHint | null>(
    () => adaptiveScaffoldingEngine.getActiveHint()
  );
  const [transferStats, setTransferStats] = useState<TransferStepSummary | null>(
    null
  );
  const dockedConnections = useLabStore((s) => s.dockedConnections);
  const setDrawerTab = useUIStore((s) => s.setDrawerTab);

  useEffect(() => {
    globalMultiApparatusEngine.seedDefaultDomainNodes(domain);
  }, [domain]);

  useEffect(() => {
    const unsub = adaptiveScaffoldingEngine.subscribe((hint) => {
      setActiveHint(hint);
    });
    return unsub;
  }, []);

  // Periodic background check for Stagnant Trial (> 2 min idle)
  useEffect(() => {
    const timer = setInterval(() => {
      adaptiveScaffoldingEngine.evaluateSessionState({
        domain,
        recordsCount,
      });
    }, 15_000);
    return () => clearInterval(timer);
  }, [domain, recordsCount]);

  const handleSnapAndDockApparatus = () => {
    const { transfer } = triggerDomainApparatusSnap(domain);
    if (transfer) {
      setTransferStats(transfer);
    }
  };

  const handleTriggerOrEscalateScaffolding = () => {
    labSound.playClick(680);
    const nextTier = activeHint
      ? ((Math.min(3, activeHint.tier + 1) as 1 | 2 | 3))
      : 1;
    adaptiveScaffoldingEngine.escalateOrTriggerDiagnosticHint(
      domain,
      activeHint?.condition ?? 'erratic_outliers',
      nextTier
    );
  };

  const handleFocusInstrumentLevel3 = () => {
    labSound.playClick(820);
    const hint = adaptiveScaffoldingEngine.escalateOrTriggerDiagnosticHint(
      domain,
      activeHint?.condition ?? 'erratic_outliers',
      3
    );
    adaptiveScaffoldingEngine.triggerVisualFocusOnInstrument(hint);
  };

  const handleAskDrLabMuFurther = () => {
    labSound.playClick(740);
    const prompt =
      activeHint?.drLabMuFollowUpPrompt ||
      `Dokter LabMu, bantu saya menganalisis variabel eksperimen ${domain} agar regresi data lebih presisi.`;
    emitLabEvent(LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU, {
      prompt,
      tier: activeHint?.tier ?? 1,
      condition: activeHint?.condition ?? 'erratic_outliers',
    });
    setDrawerTab('ai');
  };

  return (
    <div
      data-testid="adaptive-nudge-toast-container"
      className="pointer-events-auto flex flex-col items-end gap-2 max-w-md select-none"
    >
      {/* Compact Sandbox Port Docking & Adaptive Hint Trigger Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl studio-hud-surface border px-2.5 py-1.5 shadow-lg text-2xs">
        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={handleSnapAndDockApparatus}
          className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            dockedConnections.length > 0
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'studio-hud-subcard border hover:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
          }`}
          title="Uji Snap-to-Port (< 0.5 unit) & Transfer Zat/Energi Antar-Alat 3D"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>
            {dockedConnections.length > 0
              ? `Port Docked (${dockedConnections[0].portType.toUpperCase()})`
              : 'Snap-to-Port Alat 3D'}
          </span>
        </button>

        {transferStats && transferStats.activeConnectionsCount > 0 && (
          <span
            data-testid="sandbox-transfer-badge"
            className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 font-mono text-2xs text-emerald-700 dark:text-emerald-300 tabular-nums"
          >
            {transferStats.fluidTransferredMl > 0
              ? `ΔV = +${transferStats.fluidTransferredMl.toFixed(1)} mL`
              : transferStats.electricCurrentAmp > 0
                ? `I = ${transferStats.electricCurrentAmp.toFixed(2)} A`
                : `Φ = ${transferStats.opticalIntensityMw.toFixed(1)} mW`}
          </span>
        )}

        <button
          type="button"
          data-testid="trigger-adaptive-scaffolding-btn"
          onClick={handleTriggerOrEscalateScaffolding}
          className="px-2.5 py-1.5 rounded-lg studio-hud-subcard border hover:border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          title="Tampilkan / Naikkan Level Petunjuk Bertingkat (3-Tier Adaptive Scaffolding)"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>
            {activeHint
              ? `Naikkan ke Level ${Math.min(3, activeHint.tier + 1)}`
              : 'Petunjuk Adaptif'}
          </span>
        </button>
      </div>

      {/* Active 3-Tier Adaptive Scaffolding Nudge Banner */}
      {activeHint && (
        <div
          role="status"
          aria-live="polite"
          data-testid="adaptive-nudge-toast"
          className={`w-full rounded-2xl border p-3.5 shadow-2xl text-xs space-y-2.5 transition-all ${
            activeHint.condition === 'safety_violation'
              ? 'bg-rose-950/95 border-rose-500/70 text-rose-100'
              : activeHint.tier === 3
                ? 'studio-hud-surface border-sky-500/70 text-[var(--comfort-hud-text)]'
                : 'studio-hud-surface border-amber-500/60 text-[var(--comfort-hud-text)]'
          }`}
        >
          {/* Header Row: Tier Badge + Title + Dismiss */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeHint.condition === 'safety_violation' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : activeHint.tier === 3 ? (
                <Crosshair className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              ) : (
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="scaffolding-tier-badge"
                    className={`px-1.5 py-0.5 rounded font-mono text-2xs font-bold uppercase tracking-wider ${
                      activeHint.condition === 'safety_violation'
                        ? 'bg-rose-500/20 text-rose-200'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Tier {activeHint.tier}/3
                  </span>
                  <span
                    className={`font-bold truncate ${
                      activeHint.condition === 'safety_violation'
                        ? 'text-white'
                        : 'text-[var(--comfort-hud-text)]'
                    }`}
                  >
                    {activeHint.title}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => adaptiveScaffoldingEngine.dismissActiveHint()}
              aria-label="Tutup Banner Petunjuk Adaptif"
              className={`p-1 rounded-lg cursor-pointer shrink-0 transition-colors ${
                activeHint.condition === 'safety_violation'
                  ? 'text-rose-200 hover:text-white hover:bg-white/10'
                  : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Level 1: Reflective Nudge Message */}
          <p
            className={`text-2xs leading-relaxed ${
              activeHint.condition === 'safety_violation'
                ? 'text-rose-100'
                : 'text-[var(--comfort-hud-text)]'
            }`}
          >
            {activeHint.nudgeMessage}
          </p>

          {/* Level 2 & 3: Targeted Variable Clue Card */}
          {activeHint.tier >= 2 && activeHint.targetedVariable && (
            <div
              data-testid="scaffolding-targeted-clue"
              className={`rounded-xl border p-2.5 space-y-1 ${
                activeHint.condition === 'safety_violation'
                  ? 'bg-rose-900/60 border-rose-400/40'
                  : 'studio-hud-subcard border-amber-500/35'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-2xs font-bold ${
                  activeHint.condition === 'safety_violation'
                    ? 'text-amber-200'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Variabel Target: {activeHint.targetedVariable}</span>
              </div>
              <p
                className={`text-2xs ${
                  activeHint.condition === 'safety_violation'
                    ? 'text-rose-100'
                    : 'text-[var(--comfort-hud-muted)]'
                }`}
              >
                {activeHint.targetedVariableAdvice}
              </p>
            </div>
          )}

          {/* Level 3: Visual Camera Focus Status */}
          {activeHint.tier === 3 && (
            <div
              data-testid="scaffolding-visual-focus-status"
              className="rounded-lg bg-sky-500/15 border border-sky-500/35 px-2.5 py-1.5 flex items-center justify-between text-2xs text-sky-800 dark:text-sky-200"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Crosshair className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Kamera 3D difokuskan ke: <b>{activeHint.instrumentId}</b>
                </span>
              </span>
              <span className="font-mono text-2xs text-emerald-700 dark:text-emerald-300 font-semibold">
                Fokus Aktif
              </span>
            </div>
          )}

          {/* Action Buttons: Escalate / Visual Focus + Tanya Dr. LabMu Lebih Lanjut */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {activeHint.tier < 3 && (
              <button
                type="button"
                onClick={handleFocusInstrumentLevel3}
                className="px-2.5 py-1.5 rounded-lg studio-hud-subcard border hover:border-sky-500/50 text-sky-700 dark:text-sky-300 text-2xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Fokus Kamera 3D (Level 3)</span>
              </button>
            )}

            <button
              type="button"
              data-testid="ask-dr-labmu-further-btn"
              onClick={handleAskDrLabMuFurther}
              className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-2xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Tanya Dr. LabMu Lebih Lanjut</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
