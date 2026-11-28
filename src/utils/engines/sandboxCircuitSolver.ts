/**
 * Open Sandbox Multi-Domain Solver (Pilar 1 — RuangLABmu v2.2)
 * Menyediakan solver deterministik untuk Meja Eksperimen Bebas:
 * 1. Listrik (Kirchhoff / Modified Nodal Analysis - MNA): menghitung tegangan tiap simpul,
 *    arus total, daya disipasi, serta intensitas nyala lampu pada topologi seri/paralel/campuran.
 * 2. Fluida (Laju alir buret -> gelas beker & estimasi pH campuran asam-basa).
 * 3. Optik (Transmisi intensitas berkas laser melewati lensa & filter polarisasi).
 */

export type SandboxComponentKind =
  | 'battery'
  | 'resistor'
  | 'lamp'
  | 'switch'
  | 'ammeter'
  | 'burette'
  | 'beaker'
  | 'laser'
  | 'lens'
  | 'detector';

export type SandboxPortDomain = 'electric' | 'fluid' | 'optical';

export interface SandboxNode {
  id: string;
  kind: SandboxComponentKind;
  label: string;
  domain: SandboxPortDomain;
  x: number;
  y: number;
  /** Primary numeric parameter (Voltage V, Resistance Ohm, Flow mL/s, Power mW, Focal cm) */
  value: number;
  /** Secondary boolean state (e.g. switch closed, burette valve open, laser on) */
  enabled: boolean;
}

export interface SandboxWire {
  id: string;
  fromNodeId: string;
  fromPort: 'a' | 'b';
  toNodeId: string;
  toPort: 'a' | 'b';
  domain: SandboxPortDomain;
}

export interface SandboxNodeReadout {
  nodeId: string;
  currentAmp: number;
  voltageDropV: number;
  powerWatts: number;
  /** 0..1 visual intensity (lamp glow, laser beam, fluid level) */
  intensity: number;
  statusLabel: string;
}

export interface SandboxSimulationResult {
  isClosedCircuit: boolean;
  totalVoltageV: number;
  totalCurrentAmp: number;
  equivalentResistanceOhm: number;
  totalPowerWatts: number;
  fluidTransferredMlPerSec: number;
  estimatedPh: number;
  opticalOutputMw: number;
  nodeReadouts: Record<string, SandboxNodeReadout>;
  diagnostics: string[];
}

/**
 * Union-Find (Disjoint Set) helper untuk mengelompokkan terminal-terminal yang terhubung kawat
 * menjadi satu simpul listrik ekuivalen (electrical net).
 */
class DisjointSet {
  private parent = new Map<string, string>();

  public find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  public union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(ra, rb);
    }
  }
}

/**
 * Gaussian Elimination with partial pivoting untuk menyelesaikan sistem linear Ax = b (MNA).
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (maxVal < 1e-12) return null;

    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Menyelesaikan topologi rangkaian bebas (Listrik MNA + Fluida + Optik) secara deterministik.
 */
export function solveSandboxTopology(
  nodes: SandboxNode[],
  wires: SandboxWire[]
): SandboxSimulationResult {
  const nodeReadouts: Record<string, SandboxNodeReadout> = {};
  const diagnostics: string[] = [];

  for (const n of nodes) {
    nodeReadouts[n.id] = {
      nodeId: n.id,
      currentAmp: 0,
      voltageDropV: 0,
      powerWatts: 0,
      intensity: 0,
      statusLabel: 'Siaga',
    };
  }

  // --- 1. ELECTRIC DOMAIN (Modified Nodal Analysis) ---
  const electricNodes = nodes.filter((n) => n.domain === 'electric');
  const electricWires = wires.filter((w) => w.domain === 'electric');
  const batteries = electricNodes.filter((n) => n.kind === 'battery' && n.enabled);

  let isClosedCircuit = false;
  let totalVoltageV = 0;
  let totalCurrentAmp = 0;
  let equivalentResistanceOhm = 0;
  let totalPowerWatts = 0;

  if (batteries.length > 0 && electricWires.length > 0) {
    const dsu = new DisjointSet();
    for (const n of electricNodes) {
      dsu.find(`${n.id}:a`);
      dsu.find(`${n.id}:b`);
    }
    for (const w of electricWires) {
      dsu.union(`${w.fromNodeId}:${w.fromPort}`, `${w.toNodeId}:${w.toPort}`);
    }

    // Collect distinct electrical nets
    const netSet = new Set<string>();
    for (const n of electricNodes) {
      netSet.add(dsu.find(`${n.id}:a`));
      netSet.add(dsu.find(`${n.id}:b`));
    }

    // Pick negative terminal ('b') of the first active battery as Ground (0 V)
    const groundNet = dsu.find(`${batteries[0].id}:b`);
    const nonGroundNets = Array.from(netSet).filter((net) => net !== groundNet);
    const netToIndex = new Map<string, number>();
    nonGroundNets.forEach((net, idx) => netToIndex.set(net, idx));

    const numNets = nonGroundNets.length;
    const numSources = batteries.length;
    const dim = numNets + numSources;

    if (dim > 0) {
      const A: number[][] = Array.from({ length: dim }, () => Array(dim).fill(0));
      const b: number[] = Array(dim).fill(0);

      // Tiny leakage conductance to ground for floating nodes to keep matrix non-singular
      const G_LEAK = 1e-9;
      for (let i = 0; i < numNets; i++) {
        A[i][i] += G_LEAK;
      }

      // Stamp passive resistive elements (resistor, lamp, closed switch, ammeter)
      for (const n of electricNodes) {
        if (n.kind === 'battery') continue;
        let resistance = Infinity;
        if (n.kind === 'resistor') {
          resistance = Math.max(0.1, n.value);
        } else if (n.kind === 'lamp') {
          resistance = Math.max(1, n.value);
        } else if (n.kind === 'switch') {
          resistance = n.enabled ? 0.01 : 1e9;
        } else if (n.kind === 'ammeter') {
          resistance = 0.01;
        }

        const g = 1 / resistance;
        const na = netToIndex.get(dsu.find(`${n.id}:a`));
        const nb = netToIndex.get(dsu.find(`${n.id}:b`));

        if (na !== undefined) A[na][na] += g;
        if (nb !== undefined) A[nb][nb] += g;
        if (na !== undefined && nb !== undefined) {
          A[na][nb] -= g;
          A[nb][na] -= g;
        }
      }

      // Stamp independent voltage sources (batteries: port 'a' = +, port 'b' = -)
      // Include small internal resistance 0.05 Ohm for realistic short-circuit protection
      const R_INTERNAL = 0.05;
      batteries.forEach((bat, sIdx) => {
        const row = numNets + sIdx;
        const nPos = netToIndex.get(dsu.find(`${bat.id}:a`));
        const nNeg = netToIndex.get(dsu.find(`${bat.id}:b`));

        if (nPos !== undefined) {
          A[nPos][row] += 1;
          A[row][nPos] += 1;
        }
        if (nNeg !== undefined) {
          A[nNeg][row] -= 1;
          A[row][nNeg] -= 1;
        }
        // Internal resistance term: Vpos - Vneg + I_src * R_int = V_bat
        A[row][row] -= R_INTERNAL;
        b[row] = Math.max(0, bat.value);
      });

      const sol = solveLinearSystem(A, b);
      if (sol) {
        const getNetVoltage = (net: string): number => {
          const idx = netToIndex.get(net);
          return idx === undefined ? 0 : sol[idx];
        };

        let batteryCurrentSum = 0;
        batteries.forEach((bat, sIdx) => {
          const vPos = getNetVoltage(dsu.find(`${bat.id}:a`));
          const vNeg = getNetVoltage(dsu.find(`${bat.id}:b`));
          const vDrop = vPos - vNeg;
          // MNA branch current leaving positive terminal is -sol[numNets + sIdx]
          const iBat = Math.abs(sol[numNets + sIdx]);
          batteryCurrentSum += iBat;
          totalVoltageV += bat.value;

          nodeReadouts[bat.id] = {
            nodeId: bat.id,
            currentAmp: Number(iBat.toFixed(4)),
            voltageDropV: Number(Math.abs(vDrop).toFixed(3)),
            powerWatts: Number((Math.abs(vDrop) * iBat).toFixed(3)),
            intensity: Math.min(1, iBat / 2),
            statusLabel: iBat > 5 ? 'Peringatan Arus Tinggi!' : iBat > 0.001 ? 'Mengalir' : 'Terbuka',
          };
        });

        totalCurrentAmp = Number(batteryCurrentSum.toFixed(4));
        isClosedCircuit = totalCurrentAmp > 0.001;
        if (isClosedCircuit) {
          equivalentResistanceOhm = Number((totalVoltageV / totalCurrentAmp).toFixed(3));
        }

        for (const n of electricNodes) {
          if (n.kind === 'battery') continue;
          const va = getNetVoltage(dsu.find(`${n.id}:a`));
          const vb = getNetVoltage(dsu.find(`${n.id}:b`));
          const vDrop = Math.abs(va - vb);
          let r = 1e9;
          if (n.kind === 'resistor') r = Math.max(0.1, n.value);
          else if (n.kind === 'lamp') r = Math.max(1, n.value);
          else if (n.kind === 'switch') r = n.enabled ? 0.01 : 1e9;
          else if (n.kind === 'ammeter') r = 0.01;

          const current = vDrop / r;
          const power = vDrop * current;
          totalPowerWatts += power;

          // Lamp reaches full visual glow at ~3W
          const intensity =
            n.kind === 'lamp'
              ? Math.min(1, Math.sqrt(Math.max(0, power) / 3.0))
              : n.kind === 'switch'
              ? n.enabled
                ? 1
                : 0
              : Math.min(1, current / 1.5);

          let statusLabel = 'Terbuka';
          if (n.kind === 'switch') {
            statusLabel = n.enabled ? 'Tertutup (ON)' : 'Terbuka (OFF)';
          } else if (n.kind === 'lamp') {
            statusLabel = power > 0.05 ? `Menyala (${power.toFixed(2)} W)` : 'Padam';
          } else if (n.kind === 'ammeter') {
            statusLabel = `${current.toFixed(3)} A`;
          } else if (current > 0.001) {
            statusLabel = `${vDrop.toFixed(2)} V · ${current.toFixed(3)} A`;
          }

          nodeReadouts[n.id] = {
            nodeId: n.id,
            currentAmp: Number(current.toFixed(4)),
            voltageDropV: Number(vDrop.toFixed(3)),
            powerWatts: Number(power.toFixed(3)),
            intensity: Number(intensity.toFixed(3)),
            statusLabel,
          };
        }

        totalPowerWatts = Number(totalPowerWatts.toFixed(3));
        if (totalCurrentAmp > 8) {
          diagnostics.push('Peringatan K3: Arus hubung singkat terdeteksi (> 8 A). Tambahkan resistor beban.');
        } else if (isClosedCircuit) {
          diagnostics.push(
            `Rangkaian tertutup stabil: I = ${totalCurrentAmp.toFixed(3)} A, R_eq = ${equivalentResistanceOhm.toFixed(2)} Ω.`
          );
        } else {
          diagnostics.push('Rangkaian listrik masih terbuka. Pastikan kabel membentuk loop tertutup dan sakelar ON.');
        }
      }
    }
  }

  // --- 2. FLUID DOMAIN (Burette -> Beaker Titration Transfer) ---
  const fluidWires = wires.filter((w) => w.domain === 'fluid');
  let fluidTransferredMlPerSec = 0;
  let estimatedPh = 7.0;

  for (const w of fluidWires) {
    const src = nodes.find((n) => n.id === w.fromNodeId);
    const dst = nodes.find((n) => n.id === w.toNodeId);
    if (!src || !dst) continue;
    const burette = src.kind === 'burette' ? src : dst.kind === 'burette' ? dst : null;
    const beaker = src.kind === 'beaker' ? src : dst.kind === 'beaker' ? dst : null;
    if (burette && beaker && burette.enabled) {
      const flow = Math.max(0.1, burette.value); // mL/s
      fluidTransferredMlPerSec += flow;
      // Simplified strong base titrant into acid analyte pH curve
      const ratio = Math.min(2.0, flow / Math.max(0.5, beaker.value));
      estimatedPh = Number((1.5 + 11.0 / (1 + Math.exp(-6 * (ratio - 1)))).toFixed(2));
      nodeReadouts[burette.id] = {
        nodeId: burette.id,
        currentAmp: 0,
        voltageDropV: 0,
        powerWatts: 0,
        intensity: Math.min(1, flow / 5),
        statusLabel: `Menetes ${flow.toFixed(1)} mL/s`,
      };
      nodeReadouts[beaker.id] = {
        nodeId: beaker.id,
        currentAmp: 0,
        voltageDropV: 0,
        powerWatts: 0,
        intensity: Math.min(1, estimatedPh / 14),
        statusLabel: `pH ${estimatedPh.toFixed(2)}`,
      };
    }
  }

  // --- 3. OPTICAL DOMAIN (Laser -> Lens -> Detector) ---
  const opticalWires = wires.filter((w) => w.domain === 'optical');
  let opticalOutputMw = 0;
  const lasers = nodes.filter((n) => n.kind === 'laser' && n.enabled);
  if (lasers.length > 0 && opticalWires.length > 0) {
    for (const laser of lasers) {
      let beamPower = Math.max(1, laser.value); // mW
      // Trace downstream connected optical components
      const visited = new Set<string>([laser.id]);
      let frontier = [laser.id];
      nodeReadouts[laser.id] = {
        nodeId: laser.id,
        currentAmp: 0,
        voltageDropV: 0,
        powerWatts: beamPower / 1000,
        intensity: 1,
        statusLabel: `Emisi ${beamPower.toFixed(1)} mW`,
      };

      while (frontier.length > 0) {
        const nextFrontier: string[] = [];
        for (const currId of frontier) {
          for (const w of opticalWires) {
            const peerId =
              w.fromNodeId === currId
                ? w.toNodeId
                : w.toNodeId === currId
                ? w.fromNodeId
                : null;
            if (!peerId || visited.has(peerId)) continue;
            visited.add(peerId);
            const peer = nodes.find((n) => n.id === peerId);
            if (!peer) continue;

            if (peer.kind === 'lens') {
              // Borosilicate lens transmission ~92%, focal efficiency factor
              beamPower *= 0.92;
              nodeReadouts[peer.id] = {
                nodeId: peer.id,
                currentAmp: 0,
                voltageDropV: 0,
                powerWatts: beamPower / 1000,
                intensity: Math.min(1, beamPower / Math.max(1, laser.value)),
                statusLabel: `f = ${peer.value} cm · ${beamPower.toFixed(1)} mW`,
              };
              nextFrontier.push(peer.id);
            } else if (peer.kind === 'detector') {
              opticalOutputMw += beamPower;
              nodeReadouts[peer.id] = {
                nodeId: peer.id,
                currentAmp: 0,
                voltageDropV: 0,
                powerWatts: beamPower / 1000,
                intensity: Math.min(1, beamPower / 100),
                statusLabel: `Terdeteksi ${beamPower.toFixed(1)} mW`,
              };
            }
          }
        }
        frontier = nextFrontier;
      }
    }
    opticalOutputMw = Number(opticalOutputMw.toFixed(2));
  }

  return {
    isClosedCircuit,
    totalVoltageV: Number(totalVoltageV.toFixed(2)),
    totalCurrentAmp,
    equivalentResistanceOhm,
    totalPowerWatts,
    fluidTransferredMlPerSec: Number(fluidTransferredMlPerSec.toFixed(2)),
    estimatedPh,
    opticalOutputMw,
    nodeReadouts,
    diagnostics,
  };
}

/**
 * Preset siap pakai untuk demonstrasi cepat di Meja Eksperimen Bebas.
 */
export function createSandboxPreset(
  preset: 'series-circuit' | 'parallel-circuit' | 'titration-bench' | 'optical-bench'
): { nodes: SandboxNode[]; wires: SandboxWire[] } {
  if (preset === 'series-circuit') {
    return {
      nodes: [
        { id: 'bat-1', kind: 'battery', label: 'Baterai DC', domain: 'electric', x: 110, y: 180, value: 9, enabled: true },
        { id: 'sw-1', kind: 'switch', label: 'Sakelar Utama', domain: 'electric', x: 290, y: 90, value: 0, enabled: true },
        { id: 'res-1', kind: 'resistor', label: 'Resistor R1', domain: 'electric', x: 480, y: 90, value: 10, enabled: true },
        { id: 'lamp-1', kind: 'lamp', label: 'Lampu Filamen', domain: 'electric', x: 480, y: 260, value: 15, enabled: true },
        { id: 'amp-1', kind: 'ammeter', label: 'Amperemeter', domain: 'electric', x: 290, y: 260, value: 0, enabled: true },
      ],
      wires: [
        { id: 'w-1', fromNodeId: 'bat-1', fromPort: 'a', toNodeId: 'sw-1', toPort: 'a', domain: 'electric' },
        { id: 'w-2', fromNodeId: 'sw-1', fromPort: 'b', toNodeId: 'res-1', toPort: 'a', domain: 'electric' },
        { id: 'w-3', fromNodeId: 'res-1', fromPort: 'b', toNodeId: 'lamp-1', toPort: 'a', domain: 'electric' },
        { id: 'w-4', fromNodeId: 'lamp-1', fromPort: 'b', toNodeId: 'amp-1', toPort: 'a', domain: 'electric' },
        { id: 'w-5', fromNodeId: 'amp-1', fromPort: 'b', toNodeId: 'bat-1', toPort: 'b', domain: 'electric' },
      ],
    };
  }

  if (preset === 'parallel-circuit') {
    return {
      nodes: [
        { id: 'bat-p', kind: 'battery', label: 'Sumber 12V', domain: 'electric', x: 100, y: 180, value: 12, enabled: true },
        { id: 'res-p1', kind: 'resistor', label: 'Resistor Cabang A', domain: 'electric', x: 350, y: 95, value: 12, enabled: true },
        { id: 'lamp-p2', kind: 'lamp', label: 'Lampu Cabang B', domain: 'electric', x: 350, y: 265, value: 24, enabled: true },
      ],
      wires: [
        { id: 'wp-1', fromNodeId: 'bat-p', fromPort: 'a', toNodeId: 'res-p1', toPort: 'a', domain: 'electric' },
        { id: 'wp-2', fromNodeId: 'bat-p', fromPort: 'a', toNodeId: 'lamp-p2', toPort: 'a', domain: 'electric' },
        { id: 'wp-3', fromNodeId: 'res-p1', fromPort: 'b', toNodeId: 'bat-p', toPort: 'b', domain: 'electric' },
        { id: 'wp-4', fromNodeId: 'lamp-p2', fromPort: 'b', toNodeId: 'bat-p', toPort: 'b', domain: 'electric' },
      ],
    };
  }

  if (preset === 'titration-bench') {
    return {
      nodes: [
        { id: 'bur-1', kind: 'burette', label: 'Buret NaOH 0.1M', domain: 'fluid', x: 220, y: 110, value: 2.0, enabled: true },
        { id: 'bek-1', kind: 'beaker', label: 'Labu HCl + Indikator', domain: 'fluid', x: 220, y: 270, value: 2.0, enabled: true },
      ],
      wires: [
        { id: 'wf-1', fromNodeId: 'bur-1', fromPort: 'b', toNodeId: 'bek-1', toPort: 'a', domain: 'fluid' },
      ],
    };
  }

  return {
    nodes: [
      { id: 'las-1', kind: 'laser', label: 'Laser He-Ne 632nm', domain: 'optical', x: 110, y: 180, value: 50, enabled: true },
      { id: 'len-1', kind: 'lens', label: 'Lensa Cembung Borosilikat', domain: 'optical', x: 310, y: 180, value: 15, enabled: true },
      { id: 'det-1', kind: 'detector', label: 'Fotodetektor Optik', domain: 'optical', x: 510, y: 180, value: 0, enabled: true },
    ],
    wires: [
      { id: 'wo-1', fromNodeId: 'las-1', fromPort: 'b', toNodeId: 'len-1', toPort: 'a', domain: 'optical' },
      { id: 'wo-2', fromNodeId: 'len-1', fromPort: 'b', toNodeId: 'det-1', toPort: 'a', domain: 'optical' },
    ],
  };
}
