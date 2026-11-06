import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Share2,
  Compass,
  Gauge,
  Orbit,
  Minimize2,
  Activity,
  Box,
  BookOpen,
  Minus,
  Plus,
  GitCompare,
  Hand,
  Sparkles,
  X,
  Camera,
  Sliders,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  StepForward,
} from 'lucide-react';
import {
  PhysicsParams,
  PhysicsMetrics,
  KinematicsInstant,
  GRAVITY_PRESETS,
  AcademicLevel,
  GUIDED_LAB_SCENARIOS,
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  generateAutomaticFeedback,
  getConceptCardContent,
  stepParameterValue,
  LabNotification,
} from '../utils/scienceEngine';
import { PhysicsScene3D } from './PhysicsScene3D';
import { labSound } from '../utils/soundEngine';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import { SimulationPlaybackBar } from './SimulationPlaybackBar';
import {
  InstrumentSpecs,
  DEFAULT_INSTRUMENTS,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import { ExperimentCatalogPicker } from './ExperimentCatalogPicker';
import { PreLabSafetyModal } from './PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CircularGaugeMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';

interface PhysicsLabViewProps {
  params: PhysicsParams;
  onChangeParams: (next: PhysicsParams) => void;
  onRecordExperiment: (
    title: string,
    paramsSummary: string,
    metrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup: (summary: string) => void;
  academicLevel?: AcademicLevel;
  currentUserId?: string;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  paramLocks?: Record<string, ParameterLockPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onAcquireLock?: (paramKey: string) => void;
  onReleaseLock?: (paramKey: string) => void;
  onSyncParamValue?: (paramKey: string, value: number) => void;
}

export const PhysicsLabView: React.FC<PhysicsLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  onSyncWithGroup,
  academicLevel = 'sma',
  currentUserId,
  remoteCursors,
  paramLocks,
  onEmitCursor,
  onAcquireLock,
  onReleaseLock,
  onSyncParamValue,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(1.2);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);

  const physicsModules = getExperimentsByDomain('fisika');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(physicsModules[0]);
  const activeTier: EducationTier =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'Mahasiswa' : 'SMA';

  const currentPhysicsModuleId =
    params.mode === 'newton-incline'
      ? 'newton-incline'
      : params.mode === 'projectile-gravity'
      ? 'projectile-motion'
      : params.mode === 'collision-momentum'
      ? 'collision-momentum'
      : params.mode === 'spring-hooke'
      ? 'spring-hooke'
      : 'gravity-orbital';

  // Deterministic Web Worker Physics Simulation Engine Hook
  const workerParams = {
    mass: params.mass,
    appliedForce: params.appliedForce,
    inclineAngle: params.inclineAngle,
    frictionCoeffStatic: params.frictionCoeffStatic,
    frictionCoeffKinetic: params.frictionCoeffKinetic,
    gravity: params.gravity,
    initialVelocity: params.initialVelocity,
    launchAngle: params.launchAngle,
    initialHeight: params.initialHeight,
    secondaryMass: params.secondaryMass,
    separationDistance: params.separationDistance,
    collisionMass2: params.collisionMass2,
    velocity2Initial: params.velocity2Initial,
    restitutionCoeff: params.restitutionCoeff,
    springConstantK: params.springConstantK,
    springDisplacement: params.springDisplacement,
    dampingCoeff: params.dampingCoeff,
  };

  const simWorker = useSimulationWorker(params.mode, workerParams);

  // Synchronize worker simulation frames with simTime
  useEffect(() => {
    if (simWorker.currentFrame) {
      setSimTime(simWorker.currentFrame.timestamp);
    }
  }, [simWorker.currentFrame]);

  // Synchronize playback state
  useEffect(() => {
    setIsPlaying(simWorker.isPlaying);
  }, [simWorker.isPlaying]);

  // Handle simulation events emitted by worker
  useEffect(() => {
    if (simWorker.lastEvent) {
      if (simWorker.lastEvent.event === 'collision') {
        labSound.playCollisionThud(params.restitutionCoeff);
      } else if (simWorker.lastEvent.event === 'ground-hit') {
        labSound.playSnapshotPin();
      }
    }
  }, [simWorker.lastEvent, params.restitutionCoeff]);

  // Side-by-Side A/B Experiment Comparison State
  const [baselineParams, setBaselineParams] = useState<PhysicsParams | null>(
    null
  );
  const [showComparisonPanel, setShowComparisonPanel] =
    useState<boolean>(false);

  // Direct Canvas Manipulation & Crosshair Probe State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragHintText, setDragHintText] = useState<string>('');
  const [cursorCoords, setCursorCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const collisionSoundPlayedRef = useRef<boolean>(false);

  const metrics: PhysicsMetrics = calculatePhysicsMetrics(params);
  const instant: KinematicsInstant = evaluateKinematicsAtTime(params, simTime);
  const baselineMetrics: PhysicsMetrics | null = baselineParams
    ? calculatePhysicsMetrics(baselineParams)
    : null;
  const baselineInstant: KinematicsInstant | null = baselineParams
    ? evaluateKinematicsAtTime(baselineParams, simTime)
    : null;

  const conceptCard = getConceptCardContent(
    'Fisika',
    params.mode,
    academicLevel
  );
  const physicsScenarios = GUIDED_LAB_SCENARIOS.filter(
    (s) => s.domain === 'Fisika'
  );
  const totalMechE = Math.max(0.01, instant.totalMechanicalEnergy);
  const kePct = Math.min(
    100,
    Math.max(0, Math.round((instant.kineticEnergy / totalMechE) * 100))
  );
  const pePct = Math.max(0, 100 - kePct);

  // Simulation time loop with speed multiplier & collision sound trigger
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTickRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = timestamp;
      }
      const dt = ((timestamp - lastTickRef.current) / 1000) * playbackSpeed;
      lastTickRef.current = timestamp;

      setSimTime((prev) => {
        const maxDuration =
          params.mode === 'projectile-gravity'
            ? Math.max(2, metrics.timeOfFlight + 0.5)
            : 8;
        const next = prev + dt;

        if (
          params.mode === 'collision-momentum' &&
          prev < 1.5 &&
          next >= 1.5 &&
          !collisionSoundPlayedRef.current
        ) {
          collisionSoundPlayedRef.current = true;
          labSound.playCollisionThud(params.restitutionCoeff);
        }

        if (next >= maxDuration) {
          setIsPlaying(false);
          return Number(maxDuration.toFixed(2));
        }
        return next;
      });

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [
    isPlaying,
    playbackSpeed,
    params.mode,
    params.restitutionCoeff,
    metrics.timeOfFlight,
  ]);

  // Direct Canvas Pointer Manipulation Handlers (2D Mode)
  const applyCanvasDragAtPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setCursorCoords({ x: Math.round(x), y: Math.round(y) });
    if (!isDraggingCanvas) return;

    const width = canvas.width;
    const height = canvas.height;

    if (params.mode === 'newton-incline') {
      const baseX = 90;
      const baseY = height - 60;
      const dx = Math.max(40, x - baseX);
      const dy = Math.max(0, baseY - y);
      const newAngle = Math.min(
        45,
        Math.max(0, Math.round((Math.atan2(dy, dx) * 180) / Math.PI))
      );
      const newForce = Math.min(
        250,
        Math.max(-100, Math.round(((x - 220) / 360) * 180))
      );
      onChangeParams({
        ...params,
        inclineAngle: newAngle,
        appliedForce: newForce,
      });
      setDragHintText(`Seret: θ = ${newAngle}° · F = ${newForce} N`);
    } else if (params.mode === 'projectile-gravity') {
      const originX = 70;
      const groundY = height - 48;
      const dx = Math.max(20, x - originX);
      const dy = Math.max(10, groundY - y);
      const launchAngle = Math.min(
        80,
        Math.max(10, Math.round((Math.atan2(dy, dx) * 180) / Math.PI))
      );
      const dist = Math.hypot(dx, dy);
      const initialVelocity = Math.min(
        50,
        Math.max(4, Math.round(dist / 11))
      );
      onChangeParams({
        ...params,
        launchAngle,
        initialVelocity,
      });
      setDragHintText(
        `Seret Vektor: ∠ = ${launchAngle}° · v₀ = ${initialVelocity} m/s`
      );
    } else if (params.mode === 'spring-hooke') {
      const eqX = 390;
      const disp = Math.min(
        1.5,
        Math.max(-1.5, Number(((x - eqX) / 115).toFixed(2)))
      );
      setSimTime(0);
      setIsPlaying(false);
      onChangeParams({
        ...params,
        springDisplacement: disp,
      });
      setDragHintText(`Seret Pegas: Δx = ${disp.toFixed(2)} m`);
    } else if (params.mode === 'collision-momentum') {
      if (x < width / 2) {
        const v1 = Math.min(
          25,
          Math.max(1, Math.round(((x - 80) / (width / 2 - 90)) * 24))
        );
        onChangeParams({ ...params, initialVelocity: v1 });
        setDragHintText(`Seret Benda 1: v₁ = ${v1} m/s`);
      } else {
        const v2 = Math.min(
          10,
          Math.max(
            -20,
            Math.round(((width - 80 - x) / (width / 2 - 90)) * -18)
          )
        );
        onChangeParams({ ...params, velocity2Initial: v2 });
        setDragHintText(`Seret Benda 2: v₂ = ${v2} m/s`);
      }
    } else if (params.mode === 'orbital-gravity') {
      const m1X = 180;
      const rDist = Math.min(
        40,
        Math.max(1, Number(((x - m1X) / 8.5).toFixed(1)))
      );
      onChangeParams({
        ...params,
        separationDistance: rDist,
      });
      setDragHintText(`Seret Massa m₂: r = ${rDist} m`);
    }
  };

  // Draw interactive physics canvas across all 5 modes + Ghost A/B Baseline overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background laboratory grid
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const drawArrow = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      label: string,
      labelOffsetX = 8,
      labelOffsetY = -6
    ) => {
      const headLen = 9;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 4) return;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(label, x2 + labelOffsetX, y2 + labelOffsetY);
      ctx.restore();
    };

    if (params.mode === 'newton-incline') {
      const baseX = 90;
      const baseY = height - 60;
      const rampLength = 520;
      const thetaRad = (params.inclineAngle * Math.PI) / 180;

      // Draw Scenario A Ghost Incline if baseline pinned
      if (baselineParams && baselineParams.mode === 'newton-incline') {
        const baseThetaRad = (baselineParams.inclineAngle * Math.PI) / 180;
        const bTopX = baseX + rampLength * Math.cos(baseThetaRad);
        const bTopY = baseY - rampLength * Math.sin(baseThetaRad);
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(bTopX, bTopY);
        ctx.stroke();
        ctx.restore();
      }

      const topX = baseX + rampLength * Math.cos(thetaRad);
      const topY = baseY - rampLength * Math.sin(thetaRad);

      ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(topX, topY);
      ctx.lineTo(topX, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (params.inclineAngle > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(baseX, baseY, 48, -thetaRad, 0);
        ctx.stroke();
        ctx.fillStyle = '#38BDF8';
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        ctx.fillText(`θ = ${params.inclineAngle}°`, baseX + 54, baseY - 8);
      }

      const rawDisp =
        params.initialVelocity * simTime +
        0.5 * metrics.acceleration * simTime * simTime;
      const clampedDispMeters = Math.max(-5, Math.min(42, rawDisp));
      const distPx = 110 + clampedDispMeters * 8;

      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(-thetaRad);

      ctx.strokeStyle = '#64748B';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      for (let mTick = 0; mTick <= 40; mTick += 10) {
        const px = 110 + mTick * 8;
        if (px < rampLength - 10) {
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, 6);
          ctx.stroke();
          ctx.fillText(`${mTick}m`, px - 8, 18);
        }
      }

      const blockW = 64;
      const blockH = 44;
      const blockCenterX = distPx;
      const blockCenterY = -blockH / 2;

      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(blockCenterX - blockW / 2, -blockH, blockW, blockH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${params.mass} kg`, blockCenterX, -blockH / 2 + 4);
      ctx.textAlign = 'left';

      if (showVectorOverlay) {
        if (Math.abs(params.appliedForce) > 0.5) {
          const dir = Math.sign(params.appliedForce);
          const fLen =
            dir *
            Math.min(115, Math.max(42, Math.abs(params.appliedForce) * 0.6));
          drawArrow(
            blockCenterX + dir * (blockW / 2),
            blockCenterY - 6,
            blockCenterX + dir * (blockW / 2) + fLen,
            blockCenterY - 6,
            '#10B981',
            `F = ${params.appliedForce} N`,
            dir > 0 ? 8 : -78,
            -6
          );
        }

        if (Math.abs(metrics.frictionForce) > 0.5) {
          const dir = Math.sign(metrics.frictionForce);
          const fkLen =
            dir *
            Math.min(95, Math.max(38, Math.abs(metrics.frictionForce) * 0.8));
          drawArrow(
            blockCenterX + dir * (blockW / 2),
            -4,
            blockCenterX + dir * (blockW / 2) + fkLen,
            -4,
            '#F59E0B',
            `fk = ${metrics.frictionForce} N`,
            dir < 0 ? -96 : 8,
            -6
          );
        }

        const nLen = Math.min(80, Math.max(36, metrics.normalForce * 0.45));
        drawArrow(
          blockCenterX,
          -blockH,
          blockCenterX,
          -blockH - nLen,
          '#38BDF8',
          `N = ${metrics.normalForce} N`,
          -34,
          -10
        );

        const wLen = Math.min(82, Math.max(38, metrics.weightForce * 0.45));
        const wx = -wLen * Math.sin(thetaRad);
        const wy = wLen * Math.cos(thetaRad);
        drawArrow(
          blockCenterX,
          0,
          blockCenterX + wx,
          wy,
          '#F43F5E',
          `W = ${metrics.weightForce} N`,
          10,
          12
        );
      }

      ctx.restore();
    } else if (params.mode === 'projectile-gravity') {
      const originX = 70;
      const groundY = height - 48;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, groundY);
      ctx.lineTo(width - 30, groundY);
      ctx.stroke();

      const maxRange = Math.max(
        40,
        metrics.projectileRange * 1.15,
        baselineMetrics ? baselineMetrics.projectileRange * 1.15 : 40
      );
      const maxH = Math.max(
        25,
        metrics.maxProjectileHeight * 1.25,
        baselineMetrics ? baselineMetrics.maxProjectileHeight * 1.25 : 25
      );
      const scaleX = (width - 140) / maxRange;
      const scaleY = (groundY - 50) / maxH;

      // Draw Scenario A Ghost Trajectory if baseline is active
      if (baselineParams && baselineMetrics) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const bTotalT = Math.max(0.5, baselineMetrics.timeOfFlight);
        for (let i = 0; i <= 60; i++) {
          const tSample = (i / 60) * bTotalT;
          const samplePt = evaluateKinematicsAtTime(baselineParams, tSample);
          const px = originX + samplePt.positionX * scaleX;
          const py = groundY - samplePt.positionY * scaleY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(
          `Skenario A: R=${baselineMetrics.projectileRange}m`,
          originX + 12,
          groundY - 12
        );
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const totalT = Math.max(0.5, metrics.timeOfFlight);
      for (let i = 0; i <= 60; i++) {
        const tSample = (i / 60) * totalT;
        const samplePt = evaluateKinematicsAtTime(params, tSample);
        const px = originX + samplePt.positionX * scaleX;
        const py = groundY - samplePt.positionY * scaleY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      const curX = originX + instant.positionX * scaleX;
      const curY = groundY - instant.positionY * scaleY;

      if (params.initialHeight > 0) {
        const towerTopY = groundY - params.initialHeight * scaleY;
        ctx.fillStyle = '#334155';
        ctx.fillRect(originX - 10, towerTopY, 20, groundY - towerTopY);
      }

      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (showVectorOverlay) {
        drawArrow(
          curX,
          curY,
          curX + instant.velocityX * 1.8,
          curY,
          '#10B981',
          `vx = ${instant.velocityX} m/s`
        );
        drawArrow(
          curX,
          curY,
          curX,
          curY - instant.velocityY * 1.8,
          '#F59E0B',
          `vy = ${instant.velocityY} m/s`
        );
      }

      const peakX = originX + (metrics.projectileRange / 2) * scaleX;
      const peakY = groundY - metrics.maxProjectileHeight * scaleY;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `H_maks = ${metrics.maxProjectileHeight} m`,
        Math.min(width - 150, Math.max(originX, peakX - 40)),
        Math.max(24, peakY - 10)
      );
    } else if (params.mode === 'collision-momentum') {
      const trackY = height / 2 + 35;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, trackY);
      ctx.lineTo(width - 40, trackY);
      ctx.stroke();

      const collisionTime = 1.5;
      const centerCollisionX = width / 2;
      const dtFromImpact = simTime - collisionTime;

      const r1 = Math.min(36, Math.max(20, 16 + params.mass * 1.1));
      const r2 = Math.min(36, Math.max(20, 16 + params.collisionMass2 * 1.1));

      let x1 = 0;
      let x2 = 0;
      const pxPerMeter = 16;

      if (dtFromImpact <= 0) {
        x1 =
          centerCollisionX -
          r1 +
          params.initialVelocity * dtFromImpact * pxPerMeter;
        x2 =
          centerCollisionX +
          r2 +
          params.velocity2Initial * dtFromImpact * pxPerMeter;
      } else {
        x1 =
          centerCollisionX - r1 + metrics.v1Final * dtFromImpact * pxPerMeter;
        x2 =
          centerCollisionX + r2 + metrics.v2Final * dtFromImpact * pxPerMeter;
      }

      x1 = Math.max(60, Math.min(width - 100, x1));
      x2 = Math.max(100, Math.min(width - 60, x2));

      // Sphere 1
      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x1, trackY - r1, r1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(`m₁=${params.mass}kg`, x1 - 24, trackY - r1 * 2 - 10);

      // Sphere 2
      ctx.fillStyle = '#10B981';
      ctx.strokeStyle = '#D1FAE5';
      ctx.beginPath();
      ctx.arc(x2, trackY - r2, r2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        `m₂=${params.collisionMass2}kg`,
        x2 - 24,
        trackY - r2 * 2 - 10
      );

      if (showVectorOverlay) {
        const v1Now =
          dtFromImpact <= 0 ? params.initialVelocity : metrics.v1Final;
        const v2Now =
          dtFromImpact <= 0 ? params.velocity2Initial : metrics.v2Final;
        if (Math.abs(v1Now) > 0.1) {
          drawArrow(
            x1,
            trackY - r1,
            x1 + v1Now * 6,
            trackY - r1,
            '#38BDF8',
            `v₁=${v1Now} m/s`,
            6,
            -8
          );
        }
        if (Math.abs(v2Now) > 0.1) {
          drawArrow(
            x2,
            trackY - r2,
            x2 + v2Now * 6,
            trackY - r2,
            '#F59E0B',
            `v₂=${v2Now} m/s`,
            6,
            16
          );
        }
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Momentum Total: p_awal = ${metrics.initialTotalMomentum} kg·m/s  |  p_akhir = ${metrics.finalTotalMomentum} kg·m/s (Kekal)`,
        45,
        height - 22
      );
    } else if (params.mode === 'spring-hooke') {
      const wallX = 95;
      const centerY = height / 2 + 15;
      const eqX = 390;
      const curPosMeters = instant.positionX;
      const massX = eqX + curPosMeters * 115;

      // Wall & Floor
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wallX, centerY - 70);
      ctx.lineTo(wallX, centerY + 42);
      ctx.lineTo(width - 50, centerY + 42);
      ctx.stroke();

      // Equilibrium dashed line (x = 0)
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(eqX, centerY - 65);
      ctx.lineTo(eqX, centerY + 55);
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText('Titik Setimbang (x = 0)', eqX - 65, centerY + 72);
      ctx.restore();

      // Draw Coiled Spring
      const coils = 14;
      const springStart = wallX;
      const springEnd = massX - 34;
      const coilStep = (springEnd - springStart) / coils;

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(springStart, centerY);
      for (let i = 1; i < coils; i++) {
        const cx = springStart + i * coilStep;
        const cy = centerY + (i % 2 === 0 ? -16 : 16);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(springEnd, centerY);
      ctx.stroke();

      // Draw Mass Block with interactive grab ring
      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = isDraggingCanvas ? '#38BDF8' : '#E0F2FE';
      ctx.lineWidth = isDraggingCanvas ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(massX - 34, centerY - 36, 68, 72, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText(`${params.mass} kg`, massX - 18, centerY + 4);

      if (showVectorOverlay) {
        const fRestoring = -params.springConstantK * curPosMeters;
        if (Math.abs(fRestoring) > 0.5) {
          const dir = Math.sign(fRestoring);
          const len =
            dir * Math.min(110, Math.max(32, Math.abs(fRestoring) * 0.45));
          drawArrow(
            massX,
            centerY - 12,
            massX + len,
            centerY - 12,
            '#F43F5E',
            `Fp = ${fRestoring.toFixed(1)} N`,
            dir > 0 ? 8 : -95,
            -8
          );
        }
      }
    } else {
      // Universal Gravitation Two-Body Mode
      const centerY = height / 2;
      const m1X = 180;
      const distScaled = Math.min(
        340,
        Math.max(110, params.separationDistance * 6.5)
      );
      const m2X = m1X + distScaled;

      ctx.strokeStyle = '#475569';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(m1X, centerY + 65);
      ctx.lineTo(m2X, centerY + 65);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Jarak Pisah r = ${params.separationDistance} m`,
        (m1X + m2X) / 2 - 65,
        centerY + 84
      );

      const r1 = Math.min(44, Math.max(20, 16 + params.mass * 0.5));
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(m1X, centerY, r1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText(`m₁=${params.mass}kg`, m1X - 28, centerY - r1 - 10);

      const r2 = Math.min(
        58,
        Math.max(26, 20 + Math.log10(params.secondaryMass) * 10)
      );
      ctx.fillStyle = '#6366F1';
      ctx.beginPath();
      ctx.arc(m2X, centerY, r2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        `m₂=${params.secondaryMass}kg`,
        m2X - 36,
        centerY - r2 - 10
      );

      if (showVectorOverlay) {
        drawArrow(
          m1X + r1 + 4,
          centerY,
          m1X + r1 + 68,
          centerY,
          '#10B981',
          `+Fg (${metrics.universalGravityForce} µN)`
        );
        drawArrow(
          m2X - r2 - 4,
          centerY,
          m2X - r2 - 68,
          centerY,
          '#F59E0B',
          `-Fg (${metrics.universalGravityForce} µN)`
        );
      }
    }
  }, [
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    baselineParams,
    baselineMetrics,
    isDraggingCanvas,
  ]);

  const handleParamUpdate = (patch: Partial<PhysicsParams>) => {
    onChangeParams({ ...params, ...patch });
    if (onSyncParamValue) {
      for (const [key, val] of Object.entries(patch)) {
        if (typeof val === 'number') {
          onSyncParamValue(key, val);
        }
      }
    }
  };

  const isParamLocked = (paramKey: string): boolean => {
    const lock = paramLocks?.[paramKey];
    return Boolean(lock && lock.lockedByUserId !== currentUserId);
  };

  const renderLockBadge = (paramKey: string) => {
    const lock = paramLocks?.[paramKey];
    if (!lock || lock.lockedByUserId === currentUserId) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/70 border border-amber-600/70 rounded px-2 py-0.5 animate-pulse shadow-sm">
        <span>🔒</span> Sedang diatur oleh {lock.lockedByName}
      </span>
    );
  };

  const handleStartSimulation = () => {
    labSound.playClick(700);
    collisionSoundPlayedRef.current = false;
    if (simTime >= 7.5) setSimTime(0);
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    if (nextPlay) {
      if (params.mode === 'spring-hooke') {
        labSound.playSpringTwang(params.springDisplacement);
      }
      const fb = generateAutomaticFeedback('Fisika', params);
      onPushNotification(fb);
    }
  };

  const handleResetSimulation = () => {
    labSound.playClick(460);
    collisionSoundPlayedRef.current = false;
    setIsPlaying(false);
    setSimTime(0);
  };

  const handleTogglePinBaseline = () => {
    labSound.playSnapshotPin();
    if (!baselineParams) {
      setBaselineParams({ ...params });
      setShowComparisonPanel(true);
    } else {
      setShowComparisonPanel((v) => !v);
    }
  };

  const handleRecordClick = () => {
    labSound.playRecordSuccess();
    let modeLabel = '';
    let summary = '';
    let keyMetrics: Record<string, number | string> = {};
    let numericCoords = {
      x: params.mass,
      y1: metrics.acceleration,
      y2: metrics.netForce,
    };

    if (params.mode === 'newton-incline') {
      const mA = applyInstrumentNoise(metrics.acceleration, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);
      const mF = applyInstrumentNoise(metrics.netForce, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);
      const mV = applyInstrumentNoise(instant.speed, DEFAULT_INSTRUMENTS.stopwatch, noiseEnabled);

      modeLabel = `Hukum II Newton & Bidang Miring (θ=${params.inclineAngle}°)`;
      summary = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°, μk=${params.frictionCoeffKinetic}, g=${params.gravity}m/s²${noiseEnabled ? ' [Noise Aktif]' : ''}`;
      keyMetrics = {
        'ΣF': noiseEnabled
          ? formatMeasurementWithUncertainty(mF.measuredValue, mF.uncertainty, 'N')
          : `${metrics.netForce} N`,
        Percepatan: noiseEnabled
          ? formatMeasurementWithUncertainty(mA.measuredValue, mA.uncertainty, 'm/s²')
          : `${metrics.acceleration} m/s²`,
        'Kecepatan (t)': noiseEnabled
          ? formatMeasurementWithUncertainty(mV.measuredValue, mV.uncertainty, 'm/s')
          : `${instant.speed} m/s`,
        'Energi Kinetik': `${instant.kineticEnergy} J`,
      };
      numericCoords = {
        x: params.appliedForce,
        y1: noiseEnabled ? mA.measuredValue : metrics.acceleration,
        y2: instant.kineticEnergy,
      };
    } else if (params.mode === 'projectile-gravity') {
      const mR = applyInstrumentNoise(metrics.projectileRange, DEFAULT_INSTRUMENTS.ruler, noiseEnabled);
      const mH = applyInstrumentNoise(metrics.maxProjectileHeight, DEFAULT_INSTRUMENTS.ruler, noiseEnabled);
      const mT = applyInstrumentNoise(metrics.timeOfFlight, DEFAULT_INSTRUMENTS.stopwatch, noiseEnabled);

      modeLabel = `Kinematika Projektil (∠=${params.launchAngle}°, g=${params.gravity} m/s²)`;
      summary = `m=${params.mass}kg, v₀=${params.initialVelocity}m/s, ∠=${params.launchAngle}°, h₀=${params.initialHeight}m, g=${params.gravity}m/s²${noiseEnabled ? ' [Noise Aktif]' : ''}`;
      keyMetrics = {
        'Jarak Maks (R)': noiseEnabled
          ? formatMeasurementWithUncertainty(mR.measuredValue, mR.uncertainty, 'm')
          : `${metrics.projectileRange} m`,
        'Tinggi Puncak (H)': noiseEnabled
          ? formatMeasurementWithUncertainty(mH.measuredValue, mH.uncertainty, 'm')
          : `${metrics.maxProjectileHeight} m`,
        'Waktu Tempuh': noiseEnabled
          ? formatMeasurementWithUncertainty(mT.measuredValue, mT.uncertainty, 's')
          : `${metrics.timeOfFlight} s`,
        'Energi Mekanik': `${instant.totalMechanicalEnergy} J`,
      };
      numericCoords = {
        x: params.initialVelocity,
        y1: noiseEnabled ? mR.measuredValue : metrics.projectileRange,
        y2: noiseEnabled ? mH.measuredValue : metrics.maxProjectileHeight,
      };
    } else if (params.mode === 'collision-momentum') {
      const mP = applyInstrumentNoise(metrics.initialTotalMomentum, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);
      const mV1 = applyInstrumentNoise(metrics.v1Final, DEFAULT_INSTRUMENTS.stopwatch, noiseEnabled);
      const mV2 = applyInstrumentNoise(metrics.v2Final, DEFAULT_INSTRUMENTS.stopwatch, noiseEnabled);

      modeLabel = `Tumbukan 1D & Momentum (e=${params.restitutionCoeff})`;
      summary = `m₁=${params.mass}kg, v₁=${params.initialVelocity}m/s, m₂=${params.collisionMass2}kg, v₂=${params.velocity2Initial}m/s, e=${params.restitutionCoeff}${noiseEnabled ? ' [Noise Aktif]' : ''}`;
      keyMetrics = {
        'Momentum Total': noiseEnabled
          ? formatMeasurementWithUncertainty(mP.measuredValue, mP.uncertainty, 'kg·m/s')
          : `${metrics.initialTotalMomentum} kg·m/s`,
        "Kecepatan v₁'": noiseEnabled
          ? formatMeasurementWithUncertainty(mV1.measuredValue, mV1.uncertainty, 'm/s')
          : `${metrics.v1Final} m/s`,
        "Kecepatan v₂'": noiseEnabled
          ? formatMeasurementWithUncertainty(mV2.measuredValue, mV2.uncertainty, 'm/s')
          : `${metrics.v2Final} m/s`,
        'Hilang EK': `${metrics.energyLossPct}%`,
      };
      numericCoords = {
        x: params.mass,
        y1: noiseEnabled ? mV1.measuredValue : metrics.v1Final,
        y2: metrics.kineticEnergyFinal,
      };
    } else if (params.mode === 'spring-hooke') {
      const mFp = applyInstrumentNoise(metrics.springRestoringForce, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);
      const mT = applyInstrumentNoise(metrics.oscillationPeriod, DEFAULT_INSTRUMENTS.stopwatch, noiseEnabled);
      const mEp = applyInstrumentNoise(metrics.springPotentialEnergy, DEFAULT_INSTRUMENTS.ruler, noiseEnabled);

      modeLabel = `Osilasi Pegas Hooke (k=${params.springConstantK} N/m)`;
      summary = `m=${params.mass}kg, k=${params.springConstantK}N/m, Δx=${params.springDisplacement}m, b=${params.dampingCoeff}${noiseEnabled ? ' [Noise Aktif]' : ''}`;
      keyMetrics = {
        'Gaya Pemulih (Fp)': noiseEnabled
          ? formatMeasurementWithUncertainty(mFp.measuredValue, mFp.uncertainty, 'N')
          : `${metrics.springRestoringForce} N`,
        'Periode (T)': noiseEnabled
          ? formatMeasurementWithUncertainty(mT.measuredValue, mT.uncertainty, 's')
          : `${metrics.oscillationPeriod} s`,
        'Energi Potensial': noiseEnabled
          ? formatMeasurementWithUncertainty(mEp.measuredValue, mEp.uncertainty, 'J')
          : `${metrics.springPotentialEnergy} J`,
        'Frekuensi Sudut': `${metrics.angularFrequency} rad/s`,
      };
      numericCoords = {
        x: params.springDisplacement,
        y1: noiseEnabled ? Math.abs(mFp.measuredValue) : Math.abs(metrics.springRestoringForce),
        y2: noiseEnabled ? mEp.measuredValue : metrics.springPotentialEnergy,
      };
    } else {
      const mFg = applyInstrumentNoise(metrics.universalGravityForce, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);
      const mW = applyInstrumentNoise(metrics.weightForce, DEFAULT_INSTRUMENTS.dynamometer, noiseEnabled);

      modeLabel = `Gravitasi Universal Dua Massa (r=${params.separationDistance} m)`;
      summary = `m₁=${params.mass}kg, m₂=${params.secondaryMass}kg, r=${params.separationDistance}m, g=${params.gravity}m/s²${noiseEnabled ? ' [Noise Aktif]' : ''}`;
      keyMetrics = {
        'Gaya Gravitasi (Fg)': noiseEnabled
          ? formatMeasurementWithUncertainty(mFg.measuredValue, mFg.uncertainty, 'µN')
          : `${metrics.universalGravityForce} µN`,
        'Berat Benda (W)': noiseEnabled
          ? formatMeasurementWithUncertainty(mW.measuredValue, mW.uncertainty, 'N')
          : `${metrics.weightForce} N`,
        'Kecepatan Lepas': `${metrics.escapeVelocitySurface} km/s`,
      };
      numericCoords = {
        x: params.separationDistance,
        y1: noiseEnabled ? mFg.measuredValue : metrics.universalGravityForce,
        y2: noiseEnabled ? mW.measuredValue : metrics.weightForce,
      };
    }

    const noteSuffix = noiseEnabled
      ? ` (Terekam dengan ketidakpastian alat ukur realistis Gaussian noise).`
      : '';

    setShutterFlash(true);
    setRecordToastCount((c) => c + 1);
    setTimeout(() => setShutterFlash(false), 220);

    onRecordExperiment(
      modeLabel,
      summary,
      keyMetrics,
      (noteInput.trim() || `Data eksperimen ${modeLabel} terekam pada t=${instant.time}s.`) + noteSuffix,
      numericCoords
    );

    const fb = generateAutomaticFeedback('Fisika', params);
    onPushNotification(fb);
    setNoteInput('');
  };

  // Spatial HUD Cockpit State & Live Formula Tokens
  const [hudTab, setHudTab] = useState<'controls' | 'telemetry' | 'guide'>('controls');
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [recordToastCount, setRecordToastCount] = useState<number>(0);
  const [openAccordion, setOpenAccordion] = useState<string>('konsep');

  const getLockedByName = (paramKey: string): string | undefined => {
    const lock = paramLocks?.[paramKey];
    if (lock && lock.lockedByUserId !== currentUserId) {
      return lock.lockedByName;
    }
    return undefined;
  };

  const physicsFormulaTokens: FormulaToken[] = (() => {
    if (params.mode === 'newton-incline') {
      return [
        { symbol: 'ΣF', value: metrics.netForce, unit: 'N', color: '#0ea5e9' },
        { symbol: '=' },
        {
          symbol: 'F_dorong',
          paramKey: 'appliedForce',
          value: params.appliedForce,
          min: 0,
          max: 120,
          unit: 'N',
          color: '#10b981',
        },
        { symbol: '−' },
        {
          symbol: 'm',
          paramKey: 'mass',
          value: params.mass,
          min: 0.5,
          max: 15,
          unit: 'kg',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: 'g',
          paramKey: 'gravity',
          value: params.gravity,
          min: 1.6,
          max: 25,
          unit: 'm/s²',
          color: '#38bdf8',
        },
        { symbol: '·' },
        {
          symbol: 'sin(θ)',
          paramKey: 'inclineAngle',
          value: params.inclineAngle,
          min: 0,
          max: 60,
          unit: '°',
          color: '#a855f7',
        },
        { symbol: '−' },
        {
          symbol: 'f_k',
          paramKey: 'frictionCoeffKinetic',
          value: metrics.frictionForce,
          min: 0,
          max: 50,
          unit: 'N',
          color: '#f43f5e',
        },
      ];
    }
    if (params.mode === 'projectile-gravity') {
      return [
        { symbol: 'R_maks', value: metrics.projectileRange, unit: 'm', color: '#0ea5e9' },
        { symbol: '=' },
        {
          symbol: 'v₀²',
          paramKey: 'initialVelocity',
          value: params.initialVelocity,
          min: 2,
          max: 45,
          unit: 'm/s',
          color: '#10b981',
        },
        { symbol: '·' },
        {
          symbol: 'sin(2∠)',
          paramKey: 'launchAngle',
          value: params.launchAngle,
          min: 10,
          max: 85,
          unit: '°',
          color: '#f59e0b',
        },
        { symbol: '/' },
        {
          symbol: 'g',
          paramKey: 'gravity',
          value: params.gravity,
          min: 1.6,
          max: 25,
          unit: 'm/s²',
          color: '#a855f7',
        },
      ];
    }
    if (params.mode === 'collision-momentum') {
      return [
        { symbol: 'p_total', value: metrics.finalTotalMomentum, unit: 'kg·m/s', color: '#0ea5e9' },
        { symbol: '=' },
        {
          symbol: 'm₁',
          paramKey: 'mass',
          value: params.mass,
          min: 0.5,
          max: 15,
          unit: 'kg',
          color: '#38bdf8',
        },
        { symbol: '·' },
        {
          symbol: 'v₁',
          paramKey: 'initialVelocity',
          value: params.initialVelocity,
          min: 0,
          max: 30,
          unit: 'm/s',
          color: '#10b981',
        },
        { symbol: '+' },
        {
          symbol: 'm₂',
          paramKey: 'collisionMass2',
          value: params.collisionMass2,
          min: 0.5,
          max: 15,
          unit: 'kg',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: 'v₂',
          paramKey: 'velocity2Initial',
          value: params.velocity2Initial,
          min: -15,
          max: 15,
          unit: 'm/s',
          color: '#ec4899',
        },
      ];
    }
    if (params.mode === 'spring-hooke') {
      return [
        { symbol: 'E_p', value: metrics.springPotentialEnergy, unit: 'J', color: '#0ea5e9' },
        { symbol: '=' },
        { symbol: '½' },
        { symbol: '·' },
        {
          symbol: 'k',
          paramKey: 'springConstantK',
          value: params.springConstantK,
          min: 20,
          max: 400,
          unit: 'N/m',
          color: '#10b981',
        },
        { symbol: '·' },
        {
          symbol: 'Δx²',
          paramKey: 'springDisplacement',
          value: params.springDisplacement,
          min: 0.1,
          max: 2.0,
          unit: 'm',
          color: '#f59e0b',
        },
      ];
    }
    return [
      { symbol: 'F_g', value: metrics.universalGravityForce, unit: 'µN', color: '#0ea5e9' },
      { symbol: '=' },
      { symbol: 'G' },
      { symbol: '·' },
      {
        symbol: 'm₁',
        paramKey: 'mass',
        value: params.mass,
        min: 0.5,
        max: 15,
        unit: 'kg',
        color: '#38bdf8',
      },
      { symbol: '·' },
      {
        symbol: 'M₂',
        paramKey: 'secondaryMass',
        value: params.secondaryMass,
        min: 100,
        max: 5000,
        unit: 'kg',
        color: '#f59e0b',
      },
      { symbol: '/' },
      {
        symbol: 'r²',
        paramKey: 'separationDistance',
        value: params.separationDistance,
        min: 1,
        max: 20,
        unit: 'm',
        color: '#10b981',
      },
    ];
  })();

  return (
    <div className="space-y-5">
      {/* Universal Experiment Catalog Picker */}
      <ExperimentCatalogPicker
        domain="fisika"
        currentExperimentId={currentPhysicsModuleId}
        activeTier={activeTier}
        onSelectExperiment={(exp) => {
          if (exp.id === 'newton-incline') {
            handleParamUpdate({ mode: 'newton-incline' });
          } else if (exp.id === 'projectile-motion') {
            handleParamUpdate({ mode: 'projectile-gravity' });
          } else if (exp.id === 'collision-momentum') {
            handleParamUpdate({ mode: 'collision-momentum' });
          } else if (exp.id === 'spring-hooke') {
            handleParamUpdate({ mode: 'spring-hooke' });
          } else if (exp.id === 'gravity-orbital') {
            handleParamUpdate({ mode: 'orbital-gravity' });
          } else if (exp.id === 'pendulum-harmonic') {
            handleParamUpdate({ mode: 'spring-hooke', springConstantK: 40, mass: 0.1 });
          } else if (exp.id === 'stokes-viscosity') {
            handleParamUpdate({ mode: 'newton-incline', inclineAngle: 60, frictionCoeffKinetic: 0.5 });
          }
        }}
        onOpenPreLabModal={(exp) => {
          setModalExperiment(exp);
          setPreLabModalOpen(true);
        }}
      />

      {/* Mode Sub-Selector & Planet Gravity Calibration Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(1.2);
              setIsPlaying(false);
              handleParamUpdate({ mode: 'newton-incline' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'newton-incline'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Hukum Newton
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(1.0);
              setIsPlaying(false);
              handleParamUpdate({
                mode: 'projectile-gravity',
                initialVelocity:
                  params.initialVelocity > 0 ? params.initialVelocity : 22,
                launchAngle: params.launchAngle > 0 ? params.launchAngle : 45,
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'projectile-gravity'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Kinematika Projektil
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(0);
              setIsPlaying(false);
              handleParamUpdate({ mode: 'orbital-gravity' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'orbital-gravity'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Orbit className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Gravitasi Universal
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(0.8);
              setIsPlaying(false);
              handleParamUpdate({
                mode: 'collision-momentum',
                initialVelocity:
                  params.initialVelocity > 0 ? params.initialVelocity : 6,
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'collision-momentum'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Tumbukan & Momentum
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(0.4);
              setIsPlaying(false);
              handleParamUpdate({ mode: 'spring-hooke' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'spring-hooke'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Osilasi Pegas Hooke
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label
            htmlFor="gravity-preset-select"
            className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
          >
            Medan Gravitasi (g):
          </label>
          <select
            id="gravity-preset-select"
            value={params.gravity}
            onChange={(e) => {
              labSound.playClick();
              const gVal = parseFloat(e.target.value);
              const next = { ...params, gravity: gVal };
              onChangeParams(next);
              onPushNotification(generateAutomaticFeedback('Fisika', next));
            }}
            className="text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            {GRAVITY_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.g}>
                {preset.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleTogglePinBaseline}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              showComparisonPanel
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-500" />
            {baselineParams
              ? 'Mode Bandingkan A/B Aktif'
              : 'Bandingkan Eksperimen (A/B)'}
          </button>
        </div>
      </div>

      {/* Side-by-Side Experiment Comparison Drawer (A/B Mode) */}
      {showComparisonPanel && (
        <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-amber-300/80 dark:border-amber-500/40 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Mode Perbandingan Eksperimen Berdampingan (Skenario A Baseline vs Skenario B Aktif)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const earthBase: PhysicsParams = {
                    ...params,
                    mode: 'projectile-gravity',
                    gravity: 9.81,
                    initialVelocity: 22,
                    launchAngle: 45,
                  };
                  setBaselineParams(earthBase);
                  onChangeParams({
                    ...earthBase,
                    gravity: 3.72,
                  });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Bumi (9.81) vs Mars (3.72)
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const incline15: PhysicsParams = {
                    ...params,
                    mode: 'newton-incline',
                    inclineAngle: 15,
                    appliedForce: 45,
                  };
                  setBaselineParams(incline15);
                  onChangeParams({
                    ...incline15,
                    inclineAngle: 30,
                  });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Bidang θ=15° vs θ=30°
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  setBaselineParams({ ...params });
                }}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Perbarui Skenario A = Saat Ini
              </button>
              <button
                type="button"
                onClick={() => setShowComparisonPanel(false)}
                aria-label="Tutup panel perbandingan A/B"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {baselineParams && baselineMetrics && baselineInstant && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  SKENARIO A (BASELINE DISEMATKAN)
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-mono">
                  m={baselineParams.mass}kg · θ={baselineParams.inclineAngle}° · g={baselineParams.gravity}m/s²
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>a = {baselineMetrics.acceleration} m/s²</span>
                  <span>ΣF = {baselineMetrics.netForce} N</span>
                  <span>R = {baselineMetrics.projectileRange} m</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-800/70 space-y-1">
                <div className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-semibold">
                  SKENARIO B (EKSPERIMEN AKTIF)
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-mono">
                  m={params.mass}kg · θ={params.inclineAngle}° · g={params.gravity}m/s²
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>a = {metrics.acceleration} m/s²</span>
                  <span>ΣF = {metrics.netForce} N</span>
                  <span>R = {metrics.projectileRange} m</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 space-y-1">
                <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  SELISIH KOMPARASI (Δ = B − A)
                </div>
                <div className="font-mono text-slate-700 dark:text-slate-200 space-y-0.5 tabular-nums">
                  <div>
                    Δ Percepatan:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.acceleration - baselineMetrics.acceleration) >= 0 ? '+' : ''}
                      {(metrics.acceleration - baselineMetrics.acceleration).toFixed(2)} m/s²
                    </strong>
                  </div>
                  <div>
                    Δ Resultan ΣF:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.netForce - baselineMetrics.netForce) >= 0 ? '+' : ''}
                      {(metrics.netForce - baselineMetrics.netForce).toFixed(2)} N
                    </strong>
                  </div>
                  <div>
                    Δ Jarak Projektil:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.projectileRange - baselineMetrics.projectileRange) >= 0 ? '+' : ''}
                      {(metrics.projectileRange - baselineMetrics.projectileRange).toFixed(2)} m
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SPATIAL HUD COCKPIT WORKBENCH (8 Cols Hero 3D Stage + 4 Cols Segmented HUD Dock) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Hero 3D Simulation Cockpit Stage */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative min-h-[560px] rounded-2xl border border-sky-500/30 dark:border-sky-400/25 bg-slate-950 p-3 shadow-[0_0_50px_-12px_rgba(14,165,233,0.3)] flex flex-col justify-between overflow-hidden">
            {/* Camera-Shutter Flash Overlay on Catat Data */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-white via-sky-200 to-cyan-400"
                />
              )}
            </AnimatePresence>

            {/* Animated +1 Data Tercatat! Flying Toast Badge */}
            <AnimatePresence>
              {recordToastCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="pointer-events-none absolute bottom-20 right-6 z-40 flex items-center gap-2 rounded-full border border-emerald-400/60 bg-slate-900/95 px-4 py-2 text-xs font-mono font-bold text-emerald-300 shadow-2xl"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  +1 Data Tercatat ke Tabel & Grafik!
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Top-Left HUD Overlay Badge */}
            <div className="absolute top-5 left-5 z-20 flex flex-wrap items-center gap-2 max-w-[60%]">
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-1.5 text-xs shadow-lg">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isPlaying
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                      : 'bg-sky-400'
                  }`}
                />
                <span className="font-semibold text-white">
                  {params.mode === 'newton-incline'
                    ? 'Hukum II Newton'
                    : params.mode === 'projectile-gravity'
                    ? 'Kinematika Projektil'
                    : params.mode === 'collision-momentum'
                    ? 'Tumbukan 1D'
                    : params.mode === 'spring-hooke'
                    ? 'Osilasi Pegas Hooke'
                    : 'Gravitasi Universal'}
                </span>
                <span className="rounded bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                  {activeTier}
                </span>
                <span className="hidden sm:inline font-mono text-[10px] text-emerald-400">
                  {isPlaying ? '60 FPS · AKTIF' : 'SIAP UJI'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIs3DMode((m) => !m);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                    is3DMode
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  {is3DMode ? 'Mode 3D Interaktif' : 'Mode 2D Diagram'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setShowVectorOverlay((v) => !v);
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-mono text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                >
                  {showVectorOverlay ? 'Vektor: ON' : 'Vektor: OFF'}
                </button>
              </div>
            </div>

            {/* Floating Top-Right HUD: Quick Instrument Gauges */}
            <div className="hidden sm:flex items-start gap-2.5 absolute top-5 right-5 z-20">
              <CircularGaugeMeter
                label={params.mode === 'spring-hooke' ? 'Gaya Pemulih |Fp|' : 'Kecepatan v(t)'}
                value={
                  params.mode === 'spring-hooke'
                    ? Math.abs(metrics.springRestoringForce)
                    : instant.speed
                }
                min={0}
                max={params.mode === 'spring-hooke' ? 300 : 50}
                unit={params.mode === 'spring-hooke' ? 'N' : 'm/s'}
                color="#0EA5E9"
                warningThreshold={params.mode === 'spring-hooke' ? 240 : 40}
                size="sm"
              />
              <CircularGaugeMeter
                label="Energi Kinetik (EK)"
                value={instant.kineticEnergy}
                min={0}
                max={Math.max(200, instant.totalMechanicalEnergy)}
                unit="J"
                color="#10B981"
                warningThreshold={Math.max(250, instant.totalMechanicalEnergy * 0.92)}
                size="sm"
              />
            </div>

            {/* Hero 3D / 2D Stage Centerpiece */}
            <div className="relative flex-1 flex flex-col justify-center">
              {is3DMode ? (
                <PhysicsScene3D
                  params={params}
                  metrics={metrics}
                  instant={instant}
                  simTime={simTime}
                  showVectorOverlay={showVectorOverlay}
                  simFrame={simWorker.currentFrame}
                  remoteCursors={remoteCursors}
                  onEmitCursor={onEmitCursor}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  data-testid="physics-simulation-canvas"
                  width={760}
                  height={480}
                  onPointerDown={(e) => {
                    setIsDraggingCanvas(true);
                    labSound.playClick(540);
                    applyCanvasDragAtPoint(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) =>
                    applyCanvasDragAtPoint(e.clientX, e.clientY)
                  }
                  onPointerUp={() => {
                    if (isDraggingCanvas && params.mode === 'spring-hooke') {
                      labSound.playSpringTwang(params.springDisplacement);
                    }
                    setIsDraggingCanvas(false);
                    setDragHintText('');
                  }}
                  onPointerLeave={() => {
                    setIsDraggingCanvas(false);
                    setCursorCoords(null);
                    setDragHintText('');
                  }}
                  className={`w-full h-[460px] sm:h-[520px] rounded-xl block touch-none ${
                    isDraggingCanvas ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                />
              )}
            </div>

            {/* Bottom HUD: Floating Playback Deck + High-Visibility "Catat Data Percobaan" Button */}
            <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/95 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      handleStartSimulation();
                      if (!simWorker.isPlaying) simWorker.play();
                      else simWorker.pause();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs transition-colors"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Jeda
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Mulai Simulasi
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      handleResetSimulation();
                      simWorker.reset();
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      setIsPlaying(false);
                      setSimTime((t) => Number((t + 0.1).toFixed(2)));
                      simWorker.stepForward(1);
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                  >
                    <StepForward className="w-3.5 h-3.5 text-sky-400" />
                    Step +0.1s
                  </motion.button>
                </div>

                {/* High-Visibility Catat Data Percobaan Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRecordClick}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 hover:from-emerald-300 hover:to-sky-300 rounded-lg shadow-lg transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-slate-950" />
                  Catat Data Percobaan
                </motion.button>
              </div>

              <SimulationPlaybackBar
                currentFrame={simWorker.currentFrame}
                bounds={simWorker.bounds}
                isPlaying={simWorker.isPlaying}
                onPlay={() => {
                  handleStartSimulation();
                  simWorker.play();
                }}
                onPause={() => {
                  setIsPlaying(false);
                  simWorker.pause();
                }}
                onReset={() => {
                  handleResetSimulation();
                  simWorker.reset();
                }}
                onStepForward={() => {
                  setIsPlaying(false);
                  simWorker.stepForward(1);
                }}
                onStepBackward={() => {
                  setIsPlaying(false);
                  simWorker.stepBackward(1);
                }}
                onSeek={(frameIdx) => {
                  setIsPlaying(false);
                  simWorker.seekFrame(frameIdx);
                }}
                noiseEnabled={noiseEnabled}
                onToggleNoise={setNoiseEnabled}
                instrumentType={
                  params.mode === 'spring-hooke'
                    ? 'ruler'
                    : params.mode === 'newton-incline'
                    ? 'dynamometer'
                    : 'stopwatch'
                }
              />
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Collapsible Segmented HUD Drawer Tabs */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
          {/* Segmented Drawer Tab Bar with motion layoutId */}
          <div
            role="tablist"
            aria-label="Navigasi Kokpit Fisika"
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80"
          >
            {(
              [
                { id: 'controls', label: 'Kontrol & Rumus', icon: Sliders },
                { id: 'telemetry', label: 'Grafik & Data', icon: BarChart3 },
                { id: 'guide', label: 'Panduan & K3', icon: ShieldCheck },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = hudTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    labSound.playClick();
                    setHudTab(t.id);
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hud-section-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-slate-200/80 dark:border-slate-700"
                    />
                  )}
                  <Icon className="relative z-10 w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="relative z-10 truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {hudTab === 'controls' && (
              <motion.div
                key="controls"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3.5"
              >
                {/* Interactive Live Formula Card */}
                <InteractiveFormulaCard
                  title="Rumus Hidup Interaktif Fisika"
                  subtitle={conceptCard.heading}
                  tokens={physicsFormulaTokens}
                  activeParamKey={hoveredParamKey}
                />

                <div className="flex items-center justify-between pt-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Instrumen Parameter Taktil
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick(740);
                      onSyncWithGroup(
                        `Fisika (${params.mode}): m=${params.mass}kg, a=${metrics.acceleration}m/s²`
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 border border-sky-200/60 dark:border-sky-800/60 rounded-md transition-colors"
                  >
                    <Share2 className="w-3 h-3" />
                    Sinkron Kelompok
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[370px] overflow-y-auto pr-1">
                  <TactileParameterControl
                    id="physics-mass-slider"
                    label="Massa Benda Utama"
                    symbol="m₁"
                    value={params.mass}
                    min={0.5}
                    max={30}
                    step={0.5}
                    unit="kg"
                    lockedBy={getLockedByName('mass')}
                    onHoverChange={(h) => setHoveredParamKey(h ? 'mass' : null)}
                    onFocusLock={() => onAcquireLock?.('mass')}
                    onBlurLock={() => onReleaseLock?.('mass')}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />

                  {params.mode === 'newton-incline' && (
                    <>
                      <TactileParameterControl
                        id="physics-force-slider"
                        label="Gaya Dorong / Tarik"
                        symbol="F"
                        value={params.appliedForce}
                        min={-100}
                        max={250}
                        step={5}
                        unit="N"
                        lockedBy={getLockedByName('appliedForce')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'appliedForce' : null)}
                        onFocusLock={() => onAcquireLock?.('appliedForce')}
                        onBlurLock={() => onReleaseLock?.('appliedForce')}
                        onChange={(v) => handleParamUpdate({ appliedForce: v })}
                      />
                      <TactileParameterControl
                        id="physics-angle-slider"
                        label="Sudut Kemiringan Bidang"
                        symbol="θ"
                        value={params.inclineAngle}
                        min={0}
                        max={45}
                        step={1}
                        unit="°"
                        lockedBy={getLockedByName('inclineAngle')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'inclineAngle' : null)}
                        onFocusLock={() => onAcquireLock?.('inclineAngle')}
                        onBlurLock={() => onReleaseLock?.('inclineAngle')}
                        onChange={(v) => handleParamUpdate({ inclineAngle: v })}
                      />
                      <TactileParameterControl
                        id="physics-friction-slider"
                        label="Koefisien Gesek Kinetis"
                        symbol="μk"
                        value={params.frictionCoeffKinetic}
                        min={0}
                        max={0.6}
                        step={0.02}
                        unit=""
                        badgeText={`μs=${params.frictionCoeffStatic.toFixed(2)}`}
                        lockedBy={getLockedByName('frictionCoeffKinetic')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'frictionCoeffKinetic' : null)}
                        onFocusLock={() => onAcquireLock?.('frictionCoeffKinetic')}
                        onBlurLock={() => onReleaseLock?.('frictionCoeffKinetic')}
                        onChange={(muk) =>
                          handleParamUpdate({
                            frictionCoeffKinetic: muk,
                            frictionCoeffStatic: Number((muk * 1.35).toFixed(2)),
                          })
                        }
                      />
                    </>
                  )}

                  {params.mode === 'projectile-gravity' && (
                    <>
                      <TactileParameterControl
                        id="physics-v0-slider"
                        label="Kecepatan Awal"
                        symbol="v₀"
                        value={params.initialVelocity}
                        min={2}
                        max={50}
                        step={1}
                        unit="m/s"
                        lockedBy={getLockedByName('initialVelocity')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'initialVelocity' : null)}
                        onFocusLock={() => onAcquireLock?.('initialVelocity')}
                        onBlurLock={() => onReleaseLock?.('initialVelocity')}
                        onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                      />
                      <TactileParameterControl
                        id="physics-launch-slider"
                        label="Sudut Elevasi Tembakan"
                        symbol="∠"
                        value={params.launchAngle}
                        min={10}
                        max={80}
                        step={1}
                        unit="°"
                        lockedBy={getLockedByName('launchAngle')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'launchAngle' : null)}
                        onFocusLock={() => onAcquireLock?.('launchAngle')}
                        onBlurLock={() => onReleaseLock?.('launchAngle')}
                        onChange={(v) => handleParamUpdate({ launchAngle: v })}
                      />
                      <TactileParameterControl
                        id="physics-height-slider"
                        label="Ketinggian Awal"
                        symbol="h₀"
                        value={params.initialHeight}
                        min={0}
                        max={60}
                        step={2}
                        unit="m"
                        lockedBy={getLockedByName('initialHeight')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'initialHeight' : null)}
                        onFocusLock={() => onAcquireLock?.('initialHeight')}
                        onBlurLock={() => onReleaseLock?.('initialHeight')}
                        onChange={(v) => handleParamUpdate({ initialHeight: v })}
                      />
                    </>
                  )}

                  {params.mode === 'collision-momentum' && (
                    <>
                      <TactileParameterControl
                        id="collision-v1-slider"
                        label="Kecepatan Awal Benda 1"
                        symbol="v₁"
                        value={params.initialVelocity}
                        min={1}
                        max={25}
                        step={1}
                        unit="m/s"
                        lockedBy={getLockedByName('initialVelocity')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'initialVelocity' : null)}
                        onFocusLock={() => onAcquireLock?.('initialVelocity')}
                        onBlurLock={() => onReleaseLock?.('initialVelocity')}
                        onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                      />
                      <TactileParameterControl
                        id="collision-m2-slider"
                        label="Massa Benda Kedua"
                        symbol="m₂"
                        value={params.collisionMass2}
                        min={0.5}
                        max={25}
                        step={0.5}
                        unit="kg"
                        lockedBy={getLockedByName('collisionMass2')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'collisionMass2' : null)}
                        onFocusLock={() => onAcquireLock?.('collisionMass2')}
                        onBlurLock={() => onReleaseLock?.('collisionMass2')}
                        onChange={(v) => handleParamUpdate({ collisionMass2: v })}
                      />
                      <TactileParameterControl
                        id="collision-v2-slider"
                        label="Kecepatan Awal Benda 2"
                        symbol="v₂"
                        value={params.velocity2Initial}
                        min={-20}
                        max={10}
                        step={1}
                        unit="m/s"
                        lockedBy={getLockedByName('velocity2Initial')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'velocity2Initial' : null)}
                        onFocusLock={() => onAcquireLock?.('velocity2Initial')}
                        onBlurLock={() => onReleaseLock?.('velocity2Initial')}
                        onChange={(v) => handleParamUpdate({ velocity2Initial: v })}
                      />
                      <TactileParameterControl
                        id="collision-e-slider"
                        label="Koefisien Restitusi"
                        symbol="e"
                        value={params.restitutionCoeff}
                        min={0}
                        max={1}
                        step={0.05}
                        unit=""
                        badgeText={
                          params.restitutionCoeff === 1
                            ? 'Lenting Sempurna'
                            : params.restitutionCoeff === 0
                            ? 'Tidak Lenting'
                            : 'Lenting Sebagian'
                        }
                        lockedBy={getLockedByName('restitutionCoeff')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'restitutionCoeff' : null)}
                        onFocusLock={() => onAcquireLock?.('restitutionCoeff')}
                        onBlurLock={() => onReleaseLock?.('restitutionCoeff')}
                        onChange={(v) => handleParamUpdate({ restitutionCoeff: v })}
                      />
                    </>
                  )}

                  {params.mode === 'spring-hooke' && (
                    <>
                      <TactileParameterControl
                        id="spring-k-slider"
                        label="Konstanta Pegas"
                        symbol="k"
                        value={params.springConstantK}
                        min={20}
                        max={400}
                        step={10}
                        unit="N/m"
                        lockedBy={getLockedByName('springConstantK')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'springConstantK' : null)}
                        onFocusLock={() => onAcquireLock?.('springConstantK')}
                        onBlurLock={() => onReleaseLock?.('springConstantK')}
                        onChange={(v) => handleParamUpdate({ springConstantK: v })}
                      />
                      <TactileParameterControl
                        id="spring-disp-slider"
                        label="Simpangan Amplitudo Awal"
                        symbol="Δx"
                        value={params.springDisplacement}
                        min={-1.5}
                        max={1.5}
                        step={0.1}
                        unit="m"
                        lockedBy={getLockedByName('springDisplacement')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'springDisplacement' : null)}
                        onFocusLock={() => onAcquireLock?.('springDisplacement')}
                        onBlurLock={() => onReleaseLock?.('springDisplacement')}
                        onChange={(v) => handleParamUpdate({ springDisplacement: v })}
                      />
                      <TactileParameterControl
                        id="spring-damping-slider"
                        label="Koefisien Redaman"
                        symbol="b"
                        value={params.dampingCoeff}
                        min={0}
                        max={2.0}
                        step={0.05}
                        unit="N·s/m"
                        lockedBy={getLockedByName('dampingCoeff')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'dampingCoeff' : null)}
                        onFocusLock={() => onAcquireLock?.('dampingCoeff')}
                        onBlurLock={() => onReleaseLock?.('dampingCoeff')}
                        onChange={(v) => handleParamUpdate({ dampingCoeff: v })}
                      />
                    </>
                  )}

                  {params.mode === 'orbital-gravity' && (
                    <>
                      <TactileParameterControl
                        id="physics-m2-slider"
                        label="Massa Objek Kedua"
                        symbol="m₂"
                        value={params.secondaryMass}
                        min={100}
                        max={10000}
                        step={100}
                        unit="kg"
                        lockedBy={getLockedByName('secondaryMass')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'secondaryMass' : null)}
                        onFocusLock={() => onAcquireLock?.('secondaryMass')}
                        onBlurLock={() => onReleaseLock?.('secondaryMass')}
                        onChange={(v) => handleParamUpdate({ secondaryMass: v })}
                      />
                      <TactileParameterControl
                        id="physics-dist-slider"
                        label="Jarak Antar Pusat Massa"
                        symbol="r"
                        value={params.separationDistance}
                        min={1}
                        max={40}
                        step={0.5}
                        unit="m"
                        lockedBy={getLockedByName('separationDistance')}
                        onHoverChange={(h) => setHoveredParamKey(h ? 'separationDistance' : null)}
                        onFocusLock={() => onAcquireLock?.('separationDistance')}
                        onBlurLock={() => onReleaseLock?.('separationDistance')}
                        onChange={(v) => handleParamUpdate({ separationDistance: v })}
                      />
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <input
                    id="physics-note-input"
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Tambahkan catatan observasi sebelum rekam..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleRecordClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Rekam Data Eksperimen ke Tabel Log
                  </motion.button>
                </div>
              </motion.div>
            )}

            {hudTab === 'telemetry' && (
              <motion.div
                key="telemetry"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3.5"
              >
                {/* Radial Instrument Gauges Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <CircularGaugeMeter
                    label="Percepatan (a)"
                    value={metrics.acceleration}
                    min={-15}
                    max={25}
                    unit="m/s²"
                    color="#0EA5E9"
                    warningThreshold={18}
                  />
                  <CircularGaugeMeter
                    label="Resultan Gaya (ΣF)"
                    value={metrics.netForce}
                    min={-100}
                    max={250}
                    unit="N"
                    color="#10B981"
                    warningThreshold={200}
                  />
                </div>

                {/* Animated Digital Telemetry Readout Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Kecepatan Sesaat v(t)
                    </div>
                    <AnimatedNumberReadout
                      value={instant.speed}
                      unit="m/s"
                      className="mt-1 text-base text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Energi Mekanik Total
                    </div>
                    <AnimatedNumberReadout
                      value={instant.totalMechanicalEnergy}
                      unit="J"
                      className="mt-1 text-base text-sky-600 dark:text-sky-400"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Gaya Gesek / Pemulih
                    </div>
                    <AnimatedNumberReadout
                      value={
                        params.mode === 'spring-hooke'
                          ? metrics.springRestoringForce
                          : metrics.frictionForce
                      }
                      unit="N"
                      className="mt-1 text-base text-amber-600 dark:text-amber-400"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Gaya Gravitasi (Fg)
                    </div>
                    <AnimatedNumberReadout
                      value={metrics.universalGravityForce}
                      unit="µN"
                      className="mt-1 text-base text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                </div>

                {/* Live Mechanical Energy Distribution Bar */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/75 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-sky-600 dark:text-sky-400 font-bold">
                      EK: {instant.kineticEnergy} J ({kePct}%)
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      EP: {instant.potentialEnergy} J ({pePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden flex">
                    <motion.div
                      animate={{ width: `${kePct}%` }}
                      className="h-full bg-sky-500"
                    />
                    <motion.div
                      animate={{ width: `${pePct}%` }}
                      className="h-full bg-amber-500"
                    />
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleRecordClick}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Catat Titik Data Ini ke Grafik Regresi
                </motion.button>
              </motion.div>
            )}

            {hudTab === 'guide' && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5"
              >
                {/* Accordion 1: Concept Companion */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion('concept')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                      {conceptCard.heading} ({conceptCard.levelLabel})
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        openAccordion === 'concept' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openAccordion === 'concept' && (
                    <div className="p-3.5 text-xs space-y-2 bg-white dark:bg-slate-900">
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {conceptCard.summaryText}
                      </p>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">
                        {conceptCard.practicalTip}
                      </p>
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sky-700 dark:text-sky-300 font-semibold">
                        Rumus: {conceptCard.keyEquation}
                      </div>
                    </div>
                  )}
                </div>

                {/* Accordion 2: Guided Lab Scenarios */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion('scenarios')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Misi Skenario Praktikum Terbimbing
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        openAccordion === 'scenarios' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openAccordion === 'scenarios' && (
                    <div className="p-3 space-y-2 bg-white dark:bg-slate-900 max-h-60 overflow-y-auto">
                      {physicsScenarios.map((sc, idx) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            labSound.playClick(660);
                            const next = { ...params, ...sc.physicsPatch };
                            setSimTime(0.8);
                            setIsPlaying(false);
                            onChangeParams(next);
                            onPushNotification(generateAutomaticFeedback('Fisika', next));
                          }}
                          className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:border-sky-400 bg-slate-50/70 dark:bg-slate-800/60 transition-colors"
                        >
                          <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-semibold">
                            0{idx + 1}. {sc.badgeText}
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {sc.title}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {sc.objective}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Accordion 3: K3 & Pre-Lab Briefing */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion('k3')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Prosedur K3 & Briefing Pra-Praktikum
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        openAccordion === 'k3' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openAccordion === 'k3' && (
                    <div className="p-3.5 text-xs space-y-2.5 bg-white dark:bg-slate-900">
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Pastikan kalibrasi titik nol dinamometer dan batas elastisitas pegas diperiksa sebelum memberikan beban maksimum.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPreLabModalOpen(true)}
                        className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors"
                      >
                        Buka Panduan K3 & Briefing Lengkap
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <PreLabSafetyModal
        experiment={modalExperiment}
        activeTier={activeTier}
        isOpen={preLabModalOpen}
        onClose={() => setPreLabModalOpen(false)}
        onProceedToLab={() => {
          if (modalExperiment.id === 'newton-incline') {
            handleParamUpdate({ mode: 'newton-incline' });
          } else if (modalExperiment.id === 'projectile-motion') {
            handleParamUpdate({ mode: 'projectile-gravity' });
          } else if (modalExperiment.id === 'collision-momentum') {
            handleParamUpdate({ mode: 'collision-momentum' });
          } else if (modalExperiment.id === 'spring-hooke') {
            handleParamUpdate({ mode: 'spring-hooke' });
          } else if (modalExperiment.id === 'gravity-orbital') {
            handleParamUpdate({ mode: 'orbital-gravity' });
          }
        }}
      />
    </div>
  );
};
