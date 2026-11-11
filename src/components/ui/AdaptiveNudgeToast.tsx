import React, { useEffect, useState } from 'react';
import {
  Sparkles,
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
    labSound.playClick(760);
    const nodes = globalMultiApparatusEngine.getAllNodes();
    if (nodes.length < 2) {
      globalMultiApparatusEngine.seedDefaultDomainNodes(domain);
    }
    const allNodes = globalMultiApparatusEngine.getAllNodes();
    if (allNodes.length >= 2) {
      const src = allNodes[0];
      const tgt = allNodes[1];
      const srcPort = src.ports[0];
      const tgtPort = tgt.ports[0];
      if (srcPort && tgtPort) {
        // 1. Move within magnetic snap radius (< 0.5 units) to trigger green snap ring
        globalMultiApparatusEngine.moveNodeAndEvaluateSnap(src.id, {
          [srcPort.id]: [
            tgtPort.position[0] - 0.18,
            tgtPort.position[1] + 0.08,
            tgtPort.position[2],
          ],
        });
        // 2. Lock docking connection on release and run transfer step
        globalMultiApparatusEngine.commitActiveSnapOnRelease();
        const stepRes = globalMultiApparatusEngine.stepTransfer(1.5);
        setTransferStats(stepRes);
      }
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
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-950/90 border border-slate-700/80 px-2.5 py-1.5 shadow-lg text-[11px]">
        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={handleSnapAndDockApparatus}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            dockedConnections.length > 0
              ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-emerald-300'
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
            className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 font-mono text-[10px] text-emerald-300"
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
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          title="Tampilkan / Naikkan Level Petunjuk Bertingkat (3-Tier Adaptive Scaffolding)"
        >
          <Sparkles className="w-3.5 h-3.5" />
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
                ? 'bg-sky-950/95 border-sky-400/80 text-sky-100'
                : 'bg-slate-950/95 border-amber-500/60 text-slate-100'
          }`}
        >
          {/* Header Row: Tier Badge + Title + Dismiss */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeHint.condition === 'safety_violation' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : activeHint.tier === 3 ? (
                <Crosshair className="w-4 h-4 text-sky-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="scaffolding-tier-badge"
                    className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300"
                  >
                    Tier {activeHint.tier}/3
                  </span>
                  <span className="font-bold text-white truncate">
                    {activeHint.title}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => adaptiveScaffoldingEngine.dismissActiveHint()}
              aria-label="Tutup Banner Petunjuk Adaptif"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Level 1: Reflective Nudge Message */}
          <p className="text-[11px] leading-relaxed text-slate-200">
            {activeHint.nudgeMessage}
          </p>

          {/* Level 2 & 3: Targeted Variable Clue Card */}
          {activeHint.tier >= 2 && activeHint.targetedVariable && (
            <div
              data-testid="scaffolding-targeted-clue"
              className="rounded-xl bg-slate-900/90 border border-amber-400/30 p-2.5 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                <Sliders className="w-3.5 h-3.5" />
                <span>Variabel Target: {activeHint.targetedVariable}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {activeHint.targetedVariableAdvice}
              </p>
            </div>
          )}

          {/* Level 3: Visual Camera Focus Status */}
          {activeHint.tier === 3 && (
            <div
              data-testid="scaffolding-visual-focus-status"
              className="rounded-lg bg-sky-900/40 border border-sky-400/40 px-2.5 py-1.5 flex items-center justify-between text-[11px] text-sky-200"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Kamera 3D difokuskan ke: <b>{activeHint.instrumentId}</b>
                </span>
              </span>
              <span className="font-mono text-[10px] text-emerald-300">
                Pulse Aktif
              </span>
            </div>
          )}

          {/* Action Buttons: Escalate / Visual Focus + Tanya Dr. LabMu Lebih Lanjut */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {activeHint.tier < 3 && (
              <button
                type="button"
                onClick={handleFocusInstrumentLevel3}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Fokus Kamera 3D (Level 3)</span>
              </button>
            )}

            <button
              type="button"
              data-testid="ask-dr-labmu-further-btn"
              onClick={handleAskDrLabMuFurther}
              className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
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
