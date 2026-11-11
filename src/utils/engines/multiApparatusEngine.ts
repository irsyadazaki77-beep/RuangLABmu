/**
 * Multi-Apparatus Sandbox & Connection Engine (Fase 2 — Tugas 1)
 * Mengelola:
 * 1. Node Aparatus 3D (`source` | `modifier` | `detector`) dan sistem Port (`fluid` | `electric` | `optical`)
 * 2. Deteksi kedekatan Snap-to-Port (radius toleransi < 0.5 unit) & cincin snap visual hijau menyala
 * 3. Penguncian otomatis (docked) saat mouse dilepas dan pengiriman event ke `useLabStore.ts`
 * 4. Simulasi transfer zat & energi antar-alat yang terhubung:
 *    - Fluida: Laju alir buret -> labu Erlenmeyer / gelas beker
 *    - Listrik: Propagasi tegangan & arus Hukum Ohm antar komponen
 *    - Optik: Pembiasan & transmisi berkas cahaya antar sumber laser, lensa, dan detektor
 */

import * as THREE from 'three';
import { useLabStore, ApparatusDockingConnection } from '../../stores/useLabStore';
import { LAB_EVENTS, subscribeLabEvent } from '../labEventBus';

export type ApparatusNodeType = 'source' | 'modifier' | 'detector';
export type ApparatusPortType = 'fluid' | 'electric' | 'optical';

export interface ApparatusPort {
  id: string;
  type: ApparatusPortType;
  position: [number, number, number];
  connectedTo?: string;
}

export interface ApparatusNode {
  id: string;
  type: ApparatusNodeType;
  ports: Array<{
    id: string;
    type: 'fluid' | 'electric' | 'optical';
    position: [number, number, number];
    connectedTo?: string;
  }>;
  state: Record<string, number | boolean | string>;
}

export interface SnapPreviewCandidate {
  isWithinSnapRadius: boolean;
  distance: number;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  portType: ApparatusPortType;
  snapPosition: [number, number, number];
}

export interface TransferStepSummary {
  dt: number;
  fluidTransferredMl: number;
  electricCurrentAmp: number;
  opticalIntensityMw: number;
  activeConnectionsCount: number;
}

export const DEFAULT_SNAP_TOLERANCE = 0.5;

/**
 * Menghitung jarak Euclidean 3D antara dua koordinat port `[x, y, z]`.
 */
export function computePortDistance3D(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Number(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(6));
}

export function formatPortEndpoint(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`;
}

export function parsePortEndpoint(
  endpoint?: string
): { nodeId: string; portId: string } | null {
  if (!endpoint || !endpoint.includes(':')) return null;
  const [nodeId, portId] = endpoint.split(':');
  if (!nodeId || !portId) return null;
  return { nodeId, portId };
}

export class MultiApparatusEngine {
  private nodes = new Map<string, ApparatusNode>();
  private snapTolerance: number;
  private activeSnapCandidate: SnapPreviewCandidate | null = null;

  constructor(snapTolerance = DEFAULT_SNAP_TOLERANCE) {
    this.snapTolerance = snapTolerance;
  }

  public registerNode(node: ApparatusNode): ApparatusNode {
    const cloned: ApparatusNode = {
      id: node.id,
      type: node.type,
      ports: node.ports.map((p) => ({
        ...p,
        position: [...p.position] as [number, number, number],
      })),
      state: { ...node.state },
    };
    this.nodes.set(cloned.id, cloned);
    return cloned;
  }

  public unregisterNode(nodeId: string): void {
    const existing = this.nodes.get(nodeId);
    if (!existing) return;

    // Disconnect any peer ports linked to this node
    for (const port of existing.ports) {
      if (port.connectedTo) {
        this.disconnectPort(nodeId, port.id);
      }
    }
    this.nodes.delete(nodeId);
  }

  public getNode(nodeId: string): ApparatusNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): ApparatusNode[] {
    return Array.from(this.nodes.values());
  }

  public updateNodeState(
    nodeId: string,
    patch: Record<string, number | boolean | string>
  ): ApparatusNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;
    node.state = { ...node.state, ...patch };
    return node;
  }

  /**
   * Menggeser posisi seluruh port pada node sebesar delta atau ke posisi absolut baru,
   * sekaligus mengevaluasi apakah ada port kompatibel dalam radius snap (< 0.5 unit).
   */
  public moveNodeAndEvaluateSnap(
    nodeId: string,
    newPortPositions: Record<string, [number, number, number]>
  ): SnapPreviewCandidate | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    for (const port of node.ports) {
      if (newPortPositions[port.id]) {
        port.position = [...newPortPositions[port.id]] as [number, number, number];
      }
    }

    const candidate = this.findMagneticSnapCandidate(nodeId);
    this.activeSnapCandidate = candidate;
    return candidate;
  }

  /**
   * Mencari pasangan port terdekat dari node lain yang memiliki tipe sama (`fluid`, `electric`, `optical`)
   * dan berada dalam radius toleransi (< 0.5 unit).
   */
  public findMagneticSnapCandidate(
    movingNodeId: string,
    tolerance = this.snapTolerance
  ): SnapPreviewCandidate | null {
    const movingNode = this.nodes.get(movingNodeId);
    if (!movingNode) return null;

    let bestCandidate: SnapPreviewCandidate | null = null;

    for (const srcPort of movingNode.ports) {
      for (const [otherId, otherNode] of this.nodes.entries()) {
        if (otherId === movingNodeId) continue;

        for (const tgtPort of otherNode.ports) {
          if (srcPort.type !== tgtPort.type) continue;

          const dist = computePortDistance3D(srcPort.position, tgtPort.position);
          if (dist < tolerance) {
            if (!bestCandidate || dist < bestCandidate.distance) {
              bestCandidate = {
                isWithinSnapRadius: true,
                distance: Number(dist.toFixed(4)),
                sourceNodeId: movingNode.id,
                sourcePortId: srcPort.id,
                targetNodeId: otherNode.id,
                targetPortId: tgtPort.id,
                portType: srcPort.type,
                snapPosition: [...tgtPort.position] as [number, number, number],
              };
            }
          }
        }
      }
    }

    return bestCandidate;
  }

  public getActiveSnapCandidate(): SnapPreviewCandidate | null {
    return this.activeSnapCandidate;
  }

  /**
   * Mengunci koneksi antar dua port kompatibel dan mengirimkan event keterhubungan ke `useLabStore.ts`.
   */
  public connectPorts(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ): ApparatusDockingConnection | null {
    if (sourceNodeId === targetNodeId) return null;

    const sourceNode = this.nodes.get(sourceNodeId);
    const targetNode = this.nodes.get(targetNodeId);
    if (!sourceNode || !targetNode) return null;

    const srcPort = sourceNode.ports.find((p) => p.id === sourcePortId);
    const tgtPort = targetNode.ports.find((p) => p.id === targetPortId);
    if (!srcPort || !tgtPort) return null;

    // Ports must share the same physical medium
    if (srcPort.type !== tgtPort.type) return null;

    // Clean up any previous connections on these two ports
    if (srcPort.connectedTo) {
      this.disconnectPort(sourceNodeId, sourcePortId);
    }
    if (tgtPort.connectedTo) {
      this.disconnectPort(targetNodeId, targetPortId);
    }

    // Snap source port position directly onto target port docking coordinates
    srcPort.position = [...tgtPort.position] as [number, number, number];
    srcPort.connectedTo = formatPortEndpoint(targetNode.id, tgtPort.id);
    tgtPort.connectedTo = formatPortEndpoint(sourceNode.id, srcPort.id);

    this.activeSnapCandidate = null;

    const connectionEvent: ApparatusDockingConnection = {
      sourceNodeId: sourceNode.id,
      sourcePortId: srcPort.id,
      targetNodeId: targetNode.id,
      targetPortId: tgtPort.id,
      portType: srcPort.type,
      snappedPosition: [...tgtPort.position] as [number, number, number],
      timestamp: Date.now(),
    };

    // Dispatch connection event to Zustand store (`useLabStore.ts`)
    try {
      useLabStore.getState().recordApparatusDocking(connectionEvent);
    } catch {
      // Safe fallback in isolated environments
    }

    return connectionEvent;
  }

  /**
   * Saat mouse dilepas (pointerup), kunci otomatis jika terdapat kandidat snap aktif (< 0.5 unit).
   */
  public commitActiveSnapOnRelease(): ApparatusDockingConnection | null {
    if (!this.activeSnapCandidate || !this.activeSnapCandidate.isWithinSnapRadius) {
      return null;
    }
    const { sourceNodeId, sourcePortId, targetNodeId, targetPortId } =
      this.activeSnapCandidate;
    return this.connectPorts(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
  }

  public disconnectPort(nodeId: string, portId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    const port = node.ports.find((p) => p.id === portId);
    if (!port || !port.connectedTo) return false;

    const peer = parsePortEndpoint(port.connectedTo);
    port.connectedTo = undefined;

    if (peer) {
      const peerNode = this.nodes.get(peer.nodeId);
      const peerPort = peerNode?.ports.find((p) => p.id === peer.portId);
      if (peerPort) {
        peerPort.connectedTo = undefined;
      }
    }
    return true;
  }

  /**
   * Menjalankan 1 langkah simulasi transfer zat/energi (`dtSeconds`) di antara seluruh alat yang terhubung:
   * 1. Transfer Fluida (`fluid`): Buret (`source`) -> Labu Erlenmeyer / Gelas Beker (`detector`/`modifier`)
   * 2. Propagasi Arus Listrik (`electric`): Sumber Tegangan (`source`) -> Resistor (`modifier`) -> Amperemeter (`detector`)
   * 3. Pembiasan / Transmisi Optik (`optical`): Laser (`source`) -> Lensa (`modifier`) -> Layar Detektor (`detector`)
   */
  public stepTransfer(dtSeconds: number): TransferStepSummary {
    const dt = Math.max(0, dtSeconds);
    let fluidTransferredMl = 0;
    let electricCurrentAmp = 0;
    let opticalIntensityMw = 0;
    let activeConnectionsCount = 0;

    const processedPairs = new Set<string>();

    for (const node of this.nodes.values()) {
      for (const port of node.ports) {
        if (!port.connectedTo) continue;
        const peerRef = parsePortEndpoint(port.connectedTo);
        if (!peerRef) continue;

        const pairKey = [
          formatPortEndpoint(node.id, port.id),
          formatPortEndpoint(peerRef.nodeId, peerRef.portId),
        ]
          .sort()
          .join('<->');

        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        activeConnectionsCount += 1;

        const peerNode = this.nodes.get(peerRef.nodeId);
        if (!peerNode) continue;

        // Order pair so upstream (source or modifier) transfers to downstream (modifier or detector)
        const rank = (t: ApparatusNodeType) =>
          t === 'source' ? 0 : t === 'modifier' ? 1 : 2;
        const [upstream, downstream] =
          rank(node.type) <= rank(peerNode.type)
            ? [node, peerNode]
            : [peerNode, node];

        if (port.type === 'fluid') {
          const valveOpen = upstream.state.valveOpen !== false;
          const availVol = Number(upstream.state.volumeMl ?? 50);
          const flowRate = Number(upstream.state.flowRateMlPerSec ?? 2.5);

          if (valveOpen && availVol > 0 && flowRate > 0 && dt > 0) {
            const dV = Math.min(availVol, flowRate * dt);
            upstream.state.volumeMl = Number((availVol - dV).toFixed(4));

            const prevTargetVol = Number(downstream.state.volumeMl ?? 25);
            const prevReceived = Number(downstream.state.receivedFluidMl ?? 0);
            const nextVol = Number((prevTargetVol + dV).toFixed(4));
            const nextReceived = Number((prevReceived + dV).toFixed(4));

            downstream.state.volumeMl = nextVol;
            downstream.state.receivedFluidMl = nextReceived;

            // Update pH neutralization curve if titrating acid with base
            const baseConc = Number(upstream.state.concentrationM ?? 0.1);
            const acidConc = Number(downstream.state.initialAcidM ?? 0.1);
            const initialAcidVol = Number(downstream.state.initialAcidVolumeMl ?? 25);
            const molesAcid = (acidConc * initialAcidVol) / 1000;
            const molesBase = (baseConc * nextReceived) / 1000;
            const totalVolL = Math.max(0.001, (initialAcidVol + nextReceived) / 1000);

            if (molesBase < molesAcid - 1e-6) {
              const hPlus = (molesAcid - molesBase) / totalVolL;
              downstream.state.pH = Number(
                Math.max(1, Math.min(7, -Math.log10(hPlus))).toFixed(2)
              );
            } else if (Math.abs(molesBase - molesAcid) <= 1e-6) {
              downstream.state.pH = 7.0;
            } else {
              const ohMinus = (molesBase - molesAcid) / totalVolL;
              const pOH = Math.max(0, Math.min(13, -Math.log10(ohMinus)));
              downstream.state.pH = Number(Math.min(14, 14 - pOH).toFixed(2));
            }

            fluidTransferredMl = Number((fluidTransferredMl + dV).toFixed(4));
          }
        } else if (port.type === 'electric') {
          const switchClosed = upstream.state.switchClosed !== false;
          const sourceVoltage = switchClosed
            ? Number(upstream.state.voltageV ?? upstream.state.propagatedVoltageV ?? 0)
            : 0;
          const upstreamResistance = Number(upstream.state.resistanceOhm ?? 0);
          const downstreamResistance = Number(downstream.state.resistanceOhm ?? 10);
          const totalR = Math.max(0.1, upstreamResistance + downstreamResistance);
          const currentI = Number((sourceVoltage / totalR).toFixed(4));
          const powerW = Number((sourceVoltage * currentI).toFixed(4));

          downstream.state.propagatedVoltageV = sourceVoltage;
          downstream.state.currentAmp = currentI;
          downstream.state.powerWatt = powerW;
          downstream.state.isEnergized = currentI > 0;

          electricCurrentAmp = Math.max(electricCurrentAmp, currentI);
        } else if (port.type === 'optical') {
          const laserActive = upstream.state.laserOn !== false;
          const inIntensity = laserActive
            ? Number(
                upstream.state.intensityMw ??
                  upstream.state.transmittedIntensityMw ??
                  0
              )
            : 0;
          const wavelengthNm = Number(upstream.state.wavelengthNm ?? 532);
          const transmittance = Number(downstream.state.transmittance ?? 0.92);
          const refractiveIndex = Number(downstream.state.refractiveIndex ?? 1.52);
          const incidentAngleDeg = Number(
            upstream.state.incidentAngleDeg ?? upstream.state.refractedAngleDeg ?? 30
          );

          // Snell's Law: n1 * sin(theta1) = n2 * sin(theta2)
          const sinTheta2 = Math.min(
            0.999,
            Math.sin((incidentAngleDeg * Math.PI) / 180) / Math.max(1.0, refractiveIndex)
          );
          const refractedDeg = Number(
            ((Math.asin(sinTheta2) * 180) / Math.PI).toFixed(2)
          );
          const outIntensity = Number((inIntensity * transmittance).toFixed(3));

          downstream.state.wavelengthNm = wavelengthNm;
          downstream.state.transmittedIntensityMw = outIntensity;
          downstream.state.detectedIntensityMw = outIntensity;
          downstream.state.refractedAngleDeg = refractedDeg;
          downstream.state.isIlluminated = outIntensity > 0;

          opticalIntensityMw = Math.max(opticalIntensityMw, outIntensity);
        }
      }
    }

    return {
      dt,
      fluidTransferredMl,
      electricCurrentAmp,
      opticalIntensityMw,
      activeConnectionsCount,
    };
  }

  /**
   * Membuat preset node aparatus default sesuai domain aktif agar sandbox 3D
   * selalu memiliki port interaktif yang siap di-snap.
   */
  public seedDefaultDomainNodes(
    domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' = 'Kimia'
  ): void {
    this.nodes.clear();
    if (domain === 'Kimia') {
      this.registerNode({
        id: 'buret-titran-3d',
        type: 'source',
        ports: [{ id: 'nozzle-out', type: 'fluid', position: [0.0, 2.15, 0.0] }],
        state: {
          label: 'Buret Standar NaOH',
          volumeMl: 50,
          flowRateMlPerSec: 2.0,
          concentrationM: 0.1,
          valveOpen: true,
        },
      });
      this.registerNode({
        id: 'erlenmeyer-analit-3d',
        type: 'detector',
        ports: [{ id: 'neck-in', type: 'fluid', position: [0.28, 2.05, 0.0] }],
        state: {
          label: 'Labu Erlenmeyer HCl',
          volumeMl: 25,
          initialAcidVolumeMl: 25,
          initialAcidM: 0.1,
          receivedFluidMl: 0,
          pH: 1.0,
        },
      });
    } else if (domain === 'Fisika') {
      this.registerNode({
        id: 'catu-daya-dc-3d',
        type: 'source',
        ports: [{ id: 'terminal-pos', type: 'electric', position: [-1.2, 1.2, 0.0] }],
        state: {
          label: 'Catu Daya DC Variabel',
          voltageV: 12,
          switchClosed: true,
        },
      });
      this.registerNode({
        id: 'resistor-beban-3d',
        type: 'detector',
        ports: [{ id: 'terminal-in', type: 'electric', position: [-0.88, 1.2, 0.0] }],
        state: {
          label: ' Jembatan Resistor & Amperemeter',
          resistanceOhm: 6,
          currentAmp: 0,
          powerWatt: 0,
        },
      });
    } else {
      this.registerNode({
        id: 'laser-monokromatik-3d',
        type: 'source',
        ports: [{ id: 'aperture-out', type: 'optical', position: [-1.0, 1.4, 0.0] }],
        state: {
          label: 'Sumber Berkas Optik 532nm',
          wavelengthNm: 532,
          intensityMw: 15,
          incidentAngleDeg: 30,
          laserOn: true,
        },
      });
      this.registerNode({
        id: 'sensor-fotodetektor-3d',
        type: 'detector',
        ports: [{ id: 'sensor-in', type: 'optical', position: [-0.68, 1.4, 0.0] }],
        state: {
          label: 'Lensa & Fotodetektor Kuantum',
          transmittance: 0.9,
          refractiveIndex: 1.52,
          detectedIntensityMw: 0,
        },
      });
    }
  }
}

export const globalMultiApparatusEngine = new MultiApparatusEngine(DEFAULT_SNAP_TOLERANCE);
globalMultiApparatusEngine.seedDefaultDomainNodes('Fisika');

/**
 * Mengintegrasikan visualisasi Snap-to-Port (cincin hijau menyala) dan
 * Level 3 Adaptive Scaffolding (Smooth Camera Lerp + Pulse Highlight) ke scene Three.js.
 */
export function attachMultiApparatusAndScaffoldingVisuals(
  scene: THREE.Scene,
  camera: THREE.Camera
): {
  updatePerFrame: (dt: number) => void;
  dispose: () => void;
} {
  const overlayGroup = new THREE.Group();
  overlayGroup.name = 'ruanglab-sandbox-and-scaffolding-group';
  scene.add(overlayGroup);

  // 1. Magnetic Snap Preview Green Glowing Ring (`#10b981`)
  const snapRingGeo = new THREE.TorusGeometry(0.24, 0.028, 16, 36);
  const snapRingMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.5,
    transparent: true,
    opacity: 0.92,
  });
  const snapRingMesh = new THREE.Mesh(snapRingGeo, snapRingMat);
  snapRingMesh.visible = false;
  overlayGroup.add(snapRingMesh);

  // 2. Level 3 Adaptive Scaffolding Focus Highlight Ring (`#f59e0b` / `#38bdf8`)
  const focusHaloGeo = new THREE.TorusGeometry(0.42, 0.032, 16, 40);
  const focusHaloMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.6,
    transparent: true,
    opacity: 0.9,
  });
  const focusHaloMesh = new THREE.Mesh(focusHaloGeo, focusHaloMat);
  focusHaloMesh.rotation.x = Math.PI / 2;
  focusHaloMesh.visible = false;
  overlayGroup.add(focusHaloMesh);

  let cameraLerpActive = false;
  let focusHighlightTimer = 0;
  const targetCameraPos = new THREE.Vector3();
  const targetLookAtPos = new THREE.Vector3();

  // Subscribe to Level 3 Scaffolding Visual Focus events
  const unsubFocus = subscribeLabEvent(
    LAB_EVENTS.SCAFFOLDING_FOCUS_INSTRUMENT,
    (detail) => {
      if (!detail) return;
      const [tx, ty, tz] = detail.targetPosition;
      const [ox, oy, oz] = detail.cameraOffset ?? [2.4, 2.2, 4.6];

      targetLookAtPos.set(tx, ty, tz);
      targetCameraPos.set(tx + ox, ty + oy, tz + oz);
      cameraLerpActive = true;
      focusHighlightTimer = 5.5; // Show pulse highlight ring for 5.5 seconds

      focusHaloMesh.position.set(tx, Math.max(0.25, ty), tz);
      focusHaloMesh.visible = true;
    }
  );

  // Subscribe to Apparatus Docked events to briefly show the green magnetic lock ring
  let dockFlashTimer = 0;
  const unsubDocked = subscribeLabEvent(LAB_EVENTS.APPARATUS_DOCKED, (detail) => {
    if (!detail) return;
    const [sx, sy, sz] = detail.snappedPosition;
    snapRingMesh.position.set(sx, sy, sz);
    snapRingMesh.visible = true;
    dockFlashTimer = 2.2;
  });

  const updatePerFrame = (dt: number) => {
    const safeDt = Math.min(0.1, Math.max(0.001, dt));

    // Check active magnetic snap candidate from global engine
    const snapCandidate = globalMultiApparatusEngine.getActiveSnapCandidate();
    if (snapCandidate && snapCandidate.isWithinSnapRadius) {
      const [px, py, pz] = snapCandidate.snapPosition;
      snapRingMesh.position.set(px, py, pz);
      snapRingMesh.visible = true;
      snapRingMesh.lookAt(camera.position);
    } else if (dockFlashTimer > 0) {
      dockFlashTimer = Math.max(0, dockFlashTimer - safeDt);
      snapRingMesh.rotation.z += safeDt * 2.5;
      if (dockFlashTimer <= 0) {
        snapRingMesh.visible = false;
      }
    } else if (snapRingMesh.visible) {
      snapRingMesh.visible = false;
    }

    // Smooth camera lerp & pulse highlight for Level 3 Adaptive Scaffolding
    if (cameraLerpActive) {
      const alpha = 1 - Math.exp(-4.2 * safeDt);
      camera.position.lerp(targetCameraPos, alpha);
      camera.lookAt(targetLookAtPos);
      if (camera.position.distanceToSquared(targetCameraPos) < 0.02) {
        cameraLerpActive = false;
      }
    }

    if (focusHighlightTimer > 0) {
      focusHighlightTimer = Math.max(0, focusHighlightTimer - safeDt);
      const scaleWave = 1 + Math.sin(focusHighlightTimer * 6.0) * 0.12;
      focusHaloMesh.scale.set(scaleWave, scaleWave, 1);
      if (focusHighlightTimer <= 0) {
        focusHaloMesh.visible = false;
      }
    }
  };

  const dispose = () => {
    unsubFocus();
    unsubDocked();
    scene.remove(overlayGroup);
    snapRingGeo.dispose();
    snapRingMat.dispose();
    focusHaloGeo.dispose();
    focusHaloMat.dispose();
  };

  return {
    updatePerFrame,
    dispose,
  };
}
