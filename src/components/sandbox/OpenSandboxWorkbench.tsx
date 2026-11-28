import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Battery,
  Beaker,
  Droplets,
  Gauge,
  Lightbulb,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Zap,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import {
  SandboxComponentKind,
  SandboxNode,
  SandboxPortDomain,
  solveSandboxTopology,
} from '../../utils/engines/sandboxCircuitSolver';
import { labSound } from '../../utils/soundEngine';

interface PaletteItem {
  kind: SandboxComponentKind;
  label: string;
  domain: SandboxPortDomain;
  defaultValue: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { kind: 'battery', label: 'Baterai DC', domain: 'electric', defaultValue: 9, unit: 'V', min: 1, max: 24, step: 0.5 },
  { kind: 'resistor', label: 'Resistor', domain: 'electric', defaultValue: 10, unit: 'Ω', min: 1, max: 100, step: 1 },
  { kind: 'lamp', label: 'Lampu Filamen', domain: 'electric', defaultValue: 15, unit: 'Ω', min: 2, max: 60, step: 1 },
  { kind: 'switch', label: 'Sakelar', domain: 'electric', defaultValue: 0, unit: '', min: 0, max: 1, step: 1 },
  { kind: 'ammeter', label: 'Amperemeter', domain: 'electric', defaultValue: 0, unit: 'A', min: 0, max: 1, step: 1 },
  { kind: 'burette', label: 'Buret Titran', domain: 'fluid', defaultValue: 2, unit: 'mL/s', min: 0.2, max: 5, step: 0.2 },
  { kind: 'beaker', label: 'Labu Analit', domain: 'fluid', defaultValue: 2, unit: 'M', min: 0.5, max: 5, step: 0.5 },
  { kind: 'laser', label: 'Laser He-Ne', domain: 'optical', defaultValue: 50, unit: 'mW', min: 5, max: 100, step: 5 },
  { kind: 'lens', label: 'Lensa Cembung', domain: 'optical', defaultValue: 15, unit: 'cm', min: 5, max: 50, step: 1 },
  { kind: 'detector', label: 'Fotodetektor', domain: 'optical', defaultValue: 0, unit: 'mW', min: 0, max: 100, step: 1 },
];

const NODE_W = 136;
const NODE_H = 68;

function getPortCoords(node: SandboxNode, port: 'a' | 'b'): { x: number; y: number } {
  return {
    x: port === 'a' ? node.x : node.x + NODE_W,
    y: node.y + NODE_H / 2,
  };
}

function getWireColor(domain: SandboxPortDomain, active: boolean): string {
  if (domain === 'electric') return active ? '#38bdf8' : '#64748b';
  if (domain === 'fluid') return active ? '#34d399' : '#64748b';
  return active ? '#fb7185' : '#64748b';
}

function renderComponentIcon(kind: SandboxComponentKind, intensity: number, enabled: boolean) {
  switch (kind) {
    case 'battery':
      return <Battery className="w-4 h-4 text-amber-400" />;
    case 'resistor':
      return <Activity className="w-4 h-4 text-sky-400" />;
    case 'lamp':
      return (
        <Lightbulb
          className="w-4 h-4 transition-colors"
          style={{
            color: intensity > 0.15 ? '#facc15' : '#94a3b8',
            filter: intensity > 0.15 ? `drop-shadow(0 0 ${Math.round(intensity * 10)}px #facc15)` : undefined,
          }}
        />
      );
    case 'switch':
      return enabled ? (
        <ToggleRight className="w-4 h-4 text-emerald-400" />
      ) : (
        <ToggleLeft className="w-4 h-4 text-rose-400" />
      );
    case 'ammeter':
      return <Gauge className="w-4 h-4 text-indigo-400" />;
    case 'burette':
      return <Droplets className="w-4 h-4 text-emerald-400" />;
    case 'beaker':
      return <Beaker className="w-4 h-4 text-teal-400" />;
    case 'laser':
      return <Zap className="w-4 h-4 text-rose-400" />;
    case 'lens':
      return <Sparkles className="w-4 h-4 text-cyan-400" />;
    case 'detector':
      return <Sun className="w-4 h-4 text-amber-300" />;
  }
}

export const OpenSandboxWorkbench: React.FC = () => {
  const {
    sandboxNodes,
    sandboxWires,
    setActiveSandboxMode,
    setIsLobbyMode,
    addSandboxNode,
    moveSandboxNode,
    updateSandboxNode,
    removeSandboxNode,
    connectSandboxPorts,
    removeSandboxWire,
    loadSandboxPreset,
    resetSandbox,
  } = useLabStore(
    useShallow((s) => ({
      sandboxNodes: s.sandboxNodes,
      sandboxWires: s.sandboxWires,
      setActiveSandboxMode: s.setActiveSandboxMode,
      setIsLobbyMode: s.setIsLobbyMode,
      addSandboxNode: s.addSandboxNode,
      moveSandboxNode: s.moveSandboxNode,
      updateSandboxNode: s.updateSandboxNode,
      removeSandboxNode: s.removeSandboxNode,
      connectSandboxPorts: s.connectSandboxPorts,
      removeSandboxWire: s.removeSandboxWire,
      loadSandboxPreset: s.loadSandboxPreset,
      resetSandbox: s.resetSandbox,
    }))
  );

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    sandboxNodes[0]?.id ?? null
  );
  const [pendingPort, setPendingPort] = useState<{
    nodeId: string;
    port: 'a' | 'b';
    domain: SandboxPortDomain;
  } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const simResult = useMemo(
    () => solveSandboxTopology(sandboxNodes, sandboxWires),
    [sandboxNodes, sandboxWires]
  );

  const selectedNode = useMemo(
    () => sandboxNodes.find((n) => n.id === selectedNodeId) ?? null,
    [sandboxNodes, selectedNodeId]
  );

  const selectedPaletteMeta = useMemo(
    () => (selectedNode ? PALETTE_ITEMS.find((p) => p.kind === selectedNode.kind) : null),
    [selectedNode]
  );

  const handleAddFromPalette = (item: PaletteItem) => {
    labSound.playClick(640);
    const id = `${item.kind}-${Date.now().toString(36)}`;
    const count = sandboxNodes.length;
    const x = 100 + ((count * 44) % 340);
    const y = 80 + ((count * 38) % 220);
    addSandboxNode({
      id,
      kind: item.kind,
      label: `${item.label} #${count + 1}`,
      domain: item.domain,
      x,
      y,
      value: item.defaultValue,
      enabled: true,
    });
    setSelectedNodeId(id);
  };

  const handlePortClick = (
    e: React.MouseEvent,
    node: SandboxNode,
    port: 'a' | 'b'
  ) => {
    e.stopPropagation();
    if (!pendingPort) {
      labSound.playClick(560);
      setPendingPort({ nodeId: node.id, port, domain: node.domain });
      return;
    }

    if (pendingPort.nodeId === node.id && pendingPort.port === port) {
      setPendingPort(null);
      return;
    }

    if (pendingPort.domain !== node.domain) {
      labSound.playClick(280);
      setPendingPort(null);
      return;
    }

    labSound.playClick(780);
    connectSandboxPorts({
      id: `wire-${Date.now().toString(36)}`,
      fromNodeId: pendingPort.nodeId,
      fromPort: pendingPort.port,
      toNodeId: node.id,
      toPort: port,
      domain: node.domain,
    });
    setPendingPort(null);
  };

  const handlePointerDownNode = (e: React.PointerEvent, node: SandboxNode) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedNodeId(node.id);
    setDraggingNode({
      nodeId: node.id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(12, Math.min(rect.width - NODE_W - 12, e.clientX - rect.left - draggingNode.offsetX));
    const ny = Math.max(12, Math.min(rect.height - NODE_H - 12, e.clientY - rect.top - draggingNode.offsetY));
    moveSandboxNode(draggingNode.nodeId, Math.round(nx), Math.round(ny));
  };

  const handlePointerUpCanvas = () => {
    if (draggingNode) setDraggingNode(null);
  };

  return (
    <div
      data-testid="open-sandbox-workbench"
      className="flex-1 min-h-0 flex flex-col bg-[var(--comfort-bg)] text-[var(--comfort-text)] overflow-hidden"
    >
      {/* Top Action Bar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setActiveSandboxMode(false);
              setIsLobbyMode(true);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] hover:bg-[var(--comfort-surface-muted)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Katalog</span>
          </button>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-sky-500" />
              <span>Meja Eksperimen Bebas (Open Sandbox Workbench)</span>
            </h1>
            <p className="text-2xs text-[var(--comfort-text-muted)]">
              Geser aparatus, klik dua port terminal untuk menyambungkan kabel/pipa/berkas, dan amati solusi Kirchhoff/Fluida/Optik real-time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'series-circuit', label: 'Seri DC' },
              { id: 'parallel-circuit', label: 'Paralel DC' },
              { id: 'titration-bench', label: 'Titrasi Fluida' },
              { id: 'optical-bench', label: 'Optik Laser' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                labSound.playClick(620);
                loadSandboxPreset(preset.id);
                setPendingPort(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-semibold cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              labSound.playClick(420);
              resetSandbox();
              setSelectedNodeId(null);
              setPendingPort(null);
            }}
            className="px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Kosongkan</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left: Apparatus Inventory Palette */}
        <aside className="lg:col-span-3 xl:col-span-2 border-b lg:border-b-0 lg:border-r border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 overflow-y-auto space-y-3">
          <div className="text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)]">
            Inventaris Aparatus
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
            {PALETTE_ITEMS.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => handleAddFromPalette(item)}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] hover:border-sky-500/50 hover:bg-sky-500/5 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {renderComponentIcon(item.kind, 0.5, true)}
                  <div className="truncate">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className="text-2xs text-[var(--comfort-text-muted)] capitalize">
                      {item.domain}
                    </div>
                  </div>
                </div>
                <Plus className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              </button>
            ))}
          </div>
        </aside>

        {/* Center: Interactive Drag-and-Wire Canvas */}
        <div
          ref={canvasRef}
          onPointerMove={handlePointerMoveCanvas}
          onPointerUp={handlePointerUpCanvas}
          onPointerLeave={handlePointerUpCanvas}
          onClick={() => setPendingPort(null)}
          className="lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-slate-950 select-none min-h-[380px]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Connection Hint */}
          {pendingPort && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-sky-600 text-white text-xs font-semibold shadow-lg">
              Klik terminal port aparatus {pendingPort.domain} tujuan untuk menyambung...
            </div>
          )}

          {/* SVG Wires Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {sandboxWires.map((wire) => {
              const fromNode = sandboxNodes.find((n) => n.id === wire.fromNodeId);
              const toNode = sandboxNodes.find((n) => n.id === wire.toNodeId);
              if (!fromNode || !toNode) return null;
              const p1 = getPortCoords(fromNode, wire.fromPort);
              const p2 = getPortCoords(toNode, wire.toPort);
              const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.45);
              const d = `M ${p1.x} ${p1.y} C ${p1.x + (wire.fromPort === 'b' ? dx : -dx)} ${p1.y}, ${
                p2.x + (wire.toPort === 'b' ? dx : -dx)
              } ${p2.y}, ${p2.x} ${p2.y}`;
              const isActive =
                (wire.domain === 'electric' && simResult.isClosedCircuit) ||
                (wire.domain === 'fluid' && simResult.fluidTransferredMlPerSec > 0) ||
                (wire.domain === 'optical' && simResult.opticalOutputMw > 0);
              const stroke = getWireColor(wire.domain, isActive);

              return (
                <g
                  key={wire.id}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    labSound.playClick(380);
                    removeSandboxWire(wire.id);
                  }}
                >
                  <title>Klik kabel untuk memutus sambungan</title>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isActive ? 3.2 : 2.2}
                    strokeDasharray={isActive ? '8 6' : undefined}
                    className={isActive ? 'animate-pulse' : undefined}
                  />
                </g>
              );
            })}
          </svg>

          {/* Draggable Nodes Layer */}
          {sandboxNodes.map((node) => {
            const readout = simResult.nodeReadouts[node.id];
            const isSelected = node.id === selectedNodeId;
            return (
              <div
                key={node.id}
                onPointerDown={(e) => handlePointerDownNode(e, node)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  height: NODE_H,
                }}
                className={`absolute z-20 rounded-xl border px-3 py-2 flex flex-col justify-between bg-slate-900/95 text-slate-100 shadow-lg cursor-grab active:cursor-grabbing transition-shadow ${
                  isSelected
                    ? 'border-sky-400 ring-2 ring-sky-400/40'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                {/* Port A (Left) */}
                <button
                  type="button"
                  title="Terminal Port A"
                  onClick={(e) => handlePortClick(e, node, 'a')}
                  className={`absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                    pendingPort?.nodeId === node.id && pendingPort.port === 'a'
                      ? 'bg-amber-400 border-white scale-125'
                      : 'bg-sky-500 border-slate-950'
                  }`}
                />
                {/* Port B (Right) */}
                <button
                  type="button"
                  title="Terminal Port B"
                  onClick={(e) => handlePortClick(e, node, 'b')}
                  className={`absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 cursor-crosshair transition-transform hover:scale-125 ${
                    pendingPort?.nodeId === node.id && pendingPort.port === 'b'
                      ? 'bg-amber-400 border-white scale-125'
                      : 'bg-emerald-500 border-slate-950'
                  }`}
                />

                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {renderComponentIcon(node.kind, readout?.intensity ?? 0, node.enabled)}
                    <span className="text-2xs font-bold truncate">{node.label}</span>
                  </div>
                </div>
                <div className="text-2xs font-mono text-sky-300 truncate tabular-nums">
                  {readout?.statusLabel ?? 'Siaga'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Inspector & Live MNA Readout */}
        <aside className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3.5 overflow-y-auto space-y-4">
          {/* Live Telemetry Summary */}
          <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-3 space-y-2">
            <div className="text-2xs font-bold uppercase tracking-wider text-sky-500">
              Telemetri Solver Real-Time
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
              <div className="p-2 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                <div className="text-2xs text-[var(--comfort-text-muted)]">Tegangan Total</div>
                <div className="font-bold text-amber-500">{simResult.totalVoltageV.toFixed(2)} V</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                <div className="text-2xs text-[var(--comfort-text-muted)]">Arus Listrik</div>
                <div className="font-bold text-sky-500">{simResult.totalCurrentAmp.toFixed(3)} A</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                <div className="text-2xs text-[var(--comfort-text-muted)]">Hambatan Eq.</div>
                <div className="font-bold text-indigo-400">
                  {simResult.isClosedCircuit ? `${simResult.equivalentResistanceOhm.toFixed(2)} Ω` : '∞ Ω'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                <div className="text-2xs text-[var(--comfort-text-muted)]">Daya Total</div>
                <div className="font-bold text-emerald-500">{simResult.totalPowerWatts.toFixed(2)} W</div>
              </div>
            </div>

            {simResult.fluidTransferredMlPerSec > 0 && (
              <div className="text-xs font-mono p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300">
                Fluida: {simResult.fluidTransferredMlPerSec} mL/s · pH ≈ {simResult.estimatedPh}
              </div>
            )}

            {simResult.opticalOutputMw > 0 && (
              <div className="text-xs font-mono p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
                Optik Terdeteksi: {simResult.opticalOutputMw} mW
              </div>
            )}

            {simResult.diagnostics.map((msg, i) => (
              <div
                key={i}
                className="text-2xs leading-relaxed p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[var(--comfort-text)]"
              >
                {msg}
              </div>
            ))}
          </div>

          {/* Selected Node Inspector */}
          {selectedNode && selectedPaletteMeta ? (
            <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold truncate">{selectedNode.label}</div>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(340);
                    removeSandboxNode(selectedNode.id);
                    setSelectedNodeId(null);
                  }}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  title="Hapus Komponen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {(selectedNode.kind === 'switch' ||
                selectedNode.kind === 'battery' ||
                selectedNode.kind === 'burette' ||
                selectedNode.kind === 'laser') && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(selectedNode.enabled ? 460 : 660);
                    updateSandboxNode(selectedNode.id, { enabled: !selectedNode.enabled });
                  }}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    selectedNode.enabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  Status: {selectedNode.enabled ? 'AKTIF / TERTUTUP (ON)' : 'NONAKTIF / TERBUKA (OFF)'}
                </button>
              )}

              {selectedPaletteMeta.max > selectedPaletteMeta.min &&
                selectedNode.kind !== 'switch' &&
                selectedNode.kind !== 'ammeter' &&
                selectedNode.kind !== 'detector' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--comfort-text-muted)]">Nilai Parameter</span>
                      <span className="font-mono font-bold tabular-nums">
                        {selectedNode.value} {selectedPaletteMeta.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={selectedPaletteMeta.min}
                      max={selectedPaletteMeta.max}
                      step={selectedPaletteMeta.step}
                      value={selectedNode.value}
                      onChange={(e) =>
                        updateSandboxNode(selectedNode.id, { value: Number(e.target.value) })
                      }
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>
                )}
            </div>
          ) : (
            <div className="text-xs text-[var(--comfort-text-muted)] text-center py-6 border border-dashed border-[var(--comfort-border)] rounded-xl">
              Pilih aparatus pada kanvas untuk mengatur nilai tegangan, hambatan, atau sakelar.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
