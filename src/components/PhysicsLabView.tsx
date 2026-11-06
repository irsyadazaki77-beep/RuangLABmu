import React, { useEffect, useRef, useState } from 'react';
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
}

export const PhysicsLabView: React.FC<PhysicsLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  onSyncWithGroup,
  academicLevel = 'sma',
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(1.2);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);

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
      modeLabel = `Hukum II Newton & Bidang Miring (θ=${params.inclineAngle}°)`;
      summary = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°, μk=${params.frictionCoeffKinetic}, g=${params.gravity}m/s²`;
      keyMetrics = {
        'ΣF': `${metrics.netForce} N`,
        Percepatan: `${metrics.acceleration} m/s²`,
        'Kecepatan (t)': `${instant.speed} m/s`,
        'Energi Kinetik': `${instant.kineticEnergy} J`,
      };
      numericCoords = {
        x: params.appliedForce,
        y1: metrics.acceleration,
        y2: instant.kineticEnergy,
      };
    } else if (params.mode === 'projectile-gravity') {
      modeLabel = `Kinematika Projektil (∠=${params.launchAngle}°, g=${params.gravity} m/s²)`;
      summary = `m=${params.mass}kg, v₀=${params.initialVelocity}m/s, ∠=${params.launchAngle}°, h₀=${params.initialHeight}m, g=${params.gravity}m/s²`;
      keyMetrics = {
        'Jarak Maks (R)': `${metrics.projectileRange} m`,
        'Tinggi Puncak (H)': `${metrics.maxProjectileHeight} m`,
        'Waktu Tempuh': `${metrics.timeOfFlight} s`,
        'Energi Mekanik': `${instant.totalMechanicalEnergy} J`,
      };
      numericCoords = {
        x: params.initialVelocity,
        y1: metrics.projectileRange,
        y2: metrics.maxProjectileHeight,
      };
    } else if (params.mode === 'collision-momentum') {
      modeLabel = `Tumbukan 1D & Momentum (e=${params.restitutionCoeff})`;
      summary = `m₁=${params.mass}kg, v₁=${params.initialVelocity}m/s, m₂=${params.collisionMass2}kg, v₂=${params.velocity2Initial}m/s, e=${params.restitutionCoeff}`;
      keyMetrics = {
        'Momentum Total': `${metrics.initialTotalMomentum} kg·m/s`,
        "Kecepatan v₁'": `${metrics.v1Final} m/s`,
        "Kecepatan v₂'": `${metrics.v2Final} m/s`,
        'Hilang EK': `${metrics.energyLossPct}%`,
      };
      numericCoords = {
        x: params.mass,
        y1: metrics.v1Final,
        y2: metrics.kineticEnergyFinal,
      };
    } else if (params.mode === 'spring-hooke') {
      modeLabel = `Osilasi Pegas Hooke (k=${params.springConstantK} N/m)`;
      summary = `m=${params.mass}kg, k=${params.springConstantK}N/m, Δx=${params.springDisplacement}m, b=${params.dampingCoeff}`;
      keyMetrics = {
        'Gaya Pemulih (Fp)': `${metrics.springRestoringForce} N`,
        'Periode (T)': `${metrics.oscillationPeriod} s`,
        'Energi Potensial': `${metrics.springPotentialEnergy} J`,
        'Frekuensi Sudut': `${metrics.angularFrequency} rad/s`,
      };
      numericCoords = {
        x: params.springDisplacement,
        y1: Math.abs(metrics.springRestoringForce),
        y2: metrics.springPotentialEnergy,
      };
    } else {
      modeLabel = `Gravitasi Universal Dua Massa (r=${params.separationDistance} m)`;
      summary = `m₁=${params.mass}kg, m₂=${params.secondaryMass}kg, r=${params.separationDistance}m, g=${params.gravity}m/s²`;
      keyMetrics = {
        'Gaya Gravitasi (Fg)': `${metrics.universalGravityForce} µN`,
        'Berat Benda (W)': `${metrics.weightForce} N`,
        'Kecepatan Lepas': `${metrics.escapeVelocitySurface} km/s`,
      };
      numericCoords = {
        x: params.separationDistance,
        y1: metrics.universalGravityForce,
        y2: metrics.weightForce,
      };
    }

    onRecordExperiment(
      modeLabel,
      summary,
      keyMetrics,
      noteInput.trim() ||
        `Data eksperimen ${modeLabel} terekam pada t=${instant.time}s.`,
      numericCoords
    );

    const fb = generateAutomaticFeedback('Fisika', params);
    onPushNotification(fb);
    setNoteInput('');
  };

  return (
    <div className="space-y-5">
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

      {/* Guided Experiment Scenario Cards (1-Click Student Presets) */}
      <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Skenario Eksperimen Terbimbing (Klik untuk memuat parameter uji otomatis)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pilih misi praktikum agar langsung siap diamati di kanvas 3D/2D
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {physicsScenarios.map((sc, idx) => {
            const isActiveScenario =
              sc.physicsPatch?.mode === params.mode &&
              sc.physicsPatch?.mass === params.mass;
            return (
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
                className={`text-left p-3 rounded-lg border transition-all ${
                  isActiveScenario
                    ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-400 dark:border-sky-500/70 text-slate-900 dark:text-white'
                    : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="text-xs font-mono text-sky-700 dark:text-sky-400 font-medium">
                  0{idx + 1}. {sc.badgeText}
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
                  {sc.title}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {sc.objective}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split-Screen Interactive Workbench (8 Cols Stage + 4 Cols Deck) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Kanvas Vektor, Kinematika & Osilasi Real-Time
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {params.mode === 'collision-momentum' ? (
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                      ● KEKEKALAN MOMENTUM: p = {metrics.initialTotalMomentum} kg·m/s · v₁&apos; = {metrics.v1Final} m/s · v₂&apos; = {metrics.v2Final} m/s
                    </span>
                  ) : params.mode === 'spring-hooke' ? (
                    <span className="font-mono text-sky-700 dark:text-sky-400 font-semibold">
                      ● OSILASI HARMONIK: Fp = {metrics.springRestoringForce} N · Periode T = {metrics.oscillationPeriod} s · ω = {metrics.angularFrequency} rad/s
                    </span>
                  ) : (
                    <>
                      Status Sistem:{' '}
                      <span
                        className={`font-mono font-semibold ${
                          metrics.isMoving
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {metrics.isMoving
                          ? '● BERGERAK DIPERCEPAT (ΣF ≠ 0)'
                          : '▲ SETIMBANG STATIS (ΣF = 0)'}
                      </span>
                      {' · '}
                      <span className="font-mono">
                        F = m · a ⇔ {metrics.netForce} N = {params.mass} kg × {metrics.acceleration} m/s²
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIs3DMode((m) => !m);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    is3DMode
                      ? 'bg-slate-900 dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Box className="w-3.5 h-3.5 text-sky-400 dark:text-white" />
                  {is3DMode ? 'Mode 3D Interaktif' : 'Mode 2D Diagram'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setShowVectorOverlay((v) => !v);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {showVectorOverlay ? 'Sembunyikan Vektor' : 'Tampilkan Vektor'}
                </button>
              </div>
            </div>

            {/* Interactive Viewport Container with Floating HUD & Floating Bottom Dock */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19]">
              {/* Floating Top-Left Glass HUD Overlay */}
              <div className="pointer-events-none absolute top-3 left-3 z-10 lab-glass-panel bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 space-y-0.5">
                <div className="font-mono text-[11px] text-sky-400 font-semibold tabular-nums">
                  WAKTU SIMULASI: t = {instant.time.toFixed(2)} s · ({playbackSpeed}x)
                </div>
                <div className="font-mono font-semibold text-white tabular-nums">
                  v = {instant.speed.toFixed(2)} m/s · a = {instant.acceleration.toFixed(2)} m/s²
                </div>
                <div className="font-mono text-[11px] text-slate-300 tabular-nums">
                  Posisi: ({instant.positionX.toFixed(2)} m, {instant.positionY.toFixed(2)} m)
                </div>
              </div>

              {/* Floating Top-Right Interactive Canvas Drag Hint / Coordinate Probe */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                {!is3DMode ? (
                  <span className="lab-glass-panel bg-sky-950/85 border border-sky-500/50 text-sky-200 font-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <Hand className="w-3.5 h-3.5 text-sky-400" />
                    {dragHintText ||
                      (cursorCoords
                        ? `Kursor (${cursorCoords.x}, ${cursorCoords.y}) · Seret Objek Langsung`
                        : 'Klik & Seret Objek di Kanvas 2D')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setIs3DMode(false);
                    }}
                    className="lab-glass-panel bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors"
                  >
                    <Hand className="w-3.5 h-3.5 text-sky-400" />
                    Buka Kanvas 2D untuk Seret Vektor Langsung
                  </button>
                )}
              </div>

              {is3DMode ? (
                <PhysicsScene3D
                  params={params}
                  metrics={metrics}
                  instant={instant}
                  simTime={simTime}
                  showVectorOverlay={showVectorOverlay}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  data-testid="physics-simulation-canvas"
                  width={760}
                  height={360}
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
                  className={`w-full h-[340px] sm:h-[360px] block touch-none ${
                    isDraggingCanvas ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                />
              )}

              {/* Floating Bottom Playback & Speed Control Dock */}
              <div className="bg-slate-950/90 border-t border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Jeda Simulasi
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Mulai Simulasi
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    aria-label="Reset Waktu Simulasi Fisika"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                  <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-md">
                    {[0.5, 1, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setPlaybackSpeed(spd);
                        }}
                        className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                          playbackSpeed === spd
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-w-[180px] flex items-center gap-2.5">
                  <label
                    htmlFor="sim-time-scrubber"
                    className="text-[11px] font-mono text-slate-400 whitespace-nowrap"
                  >
                    Garis Waktu (t):
                  </label>
                  <input
                    id="sim-time-scrubber"
                    type="range"
                    min={0}
                    max={
                      params.mode === 'projectile-gravity'
                        ? Math.max(2, metrics.timeOfFlight)
                        : 8
                    }
                    step={0.05}
                    value={simTime}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setSimTime(parseFloat(e.target.value));
                    }}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-semibold text-white tabular-nums w-14 text-right">
                    {simTime.toFixed(2)} s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {params.mode === 'collision-momentum'
                  ? 'Momentum Total (p)'
                  : params.mode === 'spring-hooke'
                  ? 'Gaya Pemulih Hooke (Fp)'
                  : 'Resultan Gaya (ΣF)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {params.mode === 'collision-momentum'
                    ? metrics.initialTotalMomentum
                    : params.mode === 'spring-hooke'
                    ? metrics.springRestoringForce
                    : metrics.netForce}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {params.mode === 'collision-momentum' ? 'kg·m/s' : 'N'}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                {params.mode === 'collision-momentum'
                  ? `e = ${params.restitutionCoeff}`
                  : params.mode === 'spring-hooke'
                  ? `k = ${params.springConstantK} N/m`
                  : `fk = ${metrics.frictionForce} N · N = ${metrics.normalForce} N`}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {params.mode === 'collision-momentum'
                  ? "Kecepatan Akhir (v₁' & v₂')"
                  : params.mode === 'spring-hooke'
                  ? 'Periode Osilasi (T)'
                  : 'Percepatan (a = ΣF/m)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                  {params.mode === 'collision-momentum'
                    ? `${metrics.v1Final} / ${metrics.v2Final}`
                    : params.mode === 'spring-hooke'
                    ? metrics.oscillationPeriod
                    : metrics.acceleration}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {params.mode === 'collision-momentum'
                    ? 'm/s'
                    : params.mode === 'spring-hooke'
                    ? 's'
                    : 'm/s²'}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                v(t) = {instant.speed} m/s
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Energi Mekanik Total
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {instant.totalMechanicalEnergy}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">J</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                EK: {instant.kineticEnergy} J · EP: {instant.potentialEnergy} J
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Gaya Gravitasi (Fg)
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {metrics.universalGravityForce}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">µN</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                W = {metrics.weightForce} N (g={params.gravity})
              </div>
            </div>
          </div>

          {/* Live Mechanical Energy Distribution Bar & Academic Level Concept Companion */}
          <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Neraca Konservasi Energi Mekanik Sesaat (E_total = {instant.totalMechanicalEnergy} J)
              </span>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span className="text-sky-700 dark:text-sky-400 font-semibold">
                  ■ Energi Kinetik (EK): {instant.kineticEnergy} J ({kePct}%)
                </span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  ■ Energi Potensial (EP): {instant.potentialEnergy} J ({pePct}%)
                </span>
              </div>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-sky-600 transition-all duration-150"
                style={{ width: `${kePct}%` }}
              />
              <div
                className="h-full bg-amber-500 transition-all duration-150"
                style={{ width: `${pePct}%` }}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {conceptCard.heading}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-sky-700 dark:text-sky-400">
                    {conceptCard.levelLabel}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {conceptCard.summaryText}
                </p>
                <p className="text-slate-700 dark:text-slate-200 font-medium">
                  {conceptCard.practicalTip}
                </p>
              </div>
              <div className="sm:shrink-0 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 font-mono text-sky-900 dark:text-sky-300">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Rumus Kunci:
                </div>
                <div className="font-semibold">{conceptCard.keyEquation}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Zone: Parameter Controls */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Parameter Eksperimen Fisika
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gunakan geseran, tombol [- / +], atau seret di kanvas 2D
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                labSound.playClick(740);
                onSyncWithGroup(
                  `Fisika (${params.mode}): m=${params.mass}kg, a=${metrics.acceleration}m/s²`
                );
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/60 dark:border-sky-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              Sinkron Kelompok
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label
                  htmlFor="physics-mass-slider"
                  className="font-medium text-slate-700 dark:text-slate-200"
                >
                  Massa Benda Utama (m₁)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Kurangi massa benda utama"
                    onClick={() => {
                      labSound.playStep('down');
                      handleParamUpdate({
                        mass: stepParameterValue(params.mass, -0.5, 0.5, 30, 1),
                      });
                    }}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[54px] text-center">
                    {params.mass} kg
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah massa benda utama"
                    onClick={() => {
                      labSound.playStep('up');
                      handleParamUpdate({
                        mass: stepParameterValue(params.mass, 0.5, 0.5, 30, 1),
                      });
                    }}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                id="physics-mass-slider"
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={params.mass}
                onChange={(e) =>
                  handleParamUpdate({ mass: parseFloat(e.target.value) })
                }
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {params.mode === 'newton-incline' && (
              <>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="physics-force-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Gaya Dorong / Tarik (F)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Kurangi gaya dorong"
                        onClick={() => {
                          labSound.playStep('down');
                          handleParamUpdate({
                            appliedForce: stepParameterValue(
                              params.appliedForce,
                              -5,
                              -100,
                              250,
                              0
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[54px] text-center">
                        {params.appliedForce} N
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah gaya dorong"
                        onClick={() => {
                          labSound.playStep('up');
                          handleParamUpdate({
                            appliedForce: stepParameterValue(
                              params.appliedForce,
                              5,
                              -100,
                              250,
                              0
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    id="physics-force-slider"
                    type="range"
                    min={-100}
                    max={250}
                    step={5}
                    value={params.appliedForce}
                    onChange={(e) =>
                      handleParamUpdate({
                        appliedForce: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="physics-angle-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Sudut Kemiringan Bidang (θ)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Kurangi sudut kemiringan"
                        onClick={() => {
                          labSound.playStep('down');
                          handleParamUpdate({
                            inclineAngle: stepParameterValue(
                              params.inclineAngle,
                              -1,
                              0,
                              45,
                              0
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[46px] text-center">
                        {params.inclineAngle}°
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah sudut kemiringan"
                        onClick={() => {
                          labSound.playStep('up');
                          handleParamUpdate({
                            inclineAngle: stepParameterValue(
                              params.inclineAngle,
                              1,
                              0,
                              45,
                              0
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    id="physics-angle-slider"
                    type="range"
                    min={0}
                    max={45}
                    step={1}
                    value={params.inclineAngle}
                    onChange={(e) =>
                      handleParamUpdate({
                        inclineAngle: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-friction-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Koefisien Gesek Kinetis (μk)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.frictionCoeffKinetic.toFixed(2)} (μs ={' '}
                      {params.frictionCoeffStatic.toFixed(2)})
                    </span>
                  </div>
                  <input
                    id="physics-friction-slider"
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.02}
                    value={params.frictionCoeffKinetic}
                    onChange={(e) => {
                      const muk = parseFloat(e.target.value);
                      handleParamUpdate({
                        frictionCoeffKinetic: muk,
                        frictionCoeffStatic: Number((muk * 1.35).toFixed(2)),
                      });
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}

            {params.mode === 'projectile-gravity' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-v0-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Kecepatan Awal (v₀)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.initialVelocity} m/s
                    </span>
                  </div>
                  <input
                    id="physics-v0-slider"
                    type="range"
                    min={2}
                    max={50}
                    step={1}
                    value={params.initialVelocity}
                    onChange={(e) =>
                      handleParamUpdate({
                        initialVelocity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-launch-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Sudut Elevasi Tembakan (∠)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.launchAngle}°
                    </span>
                  </div>
                  <input
                    id="physics-launch-slider"
                    type="range"
                    min={10}
                    max={80}
                    step={1}
                    value={params.launchAngle}
                    onChange={(e) =>
                      handleParamUpdate({
                        launchAngle: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-height-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Ketinggian Awal (h₀)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.initialHeight} m
                    </span>
                  </div>
                  <input
                    id="physics-height-slider"
                    type="range"
                    min={0}
                    max={60}
                    step={2}
                    value={params.initialHeight}
                    onChange={(e) =>
                      handleParamUpdate({
                        initialHeight: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}

            {params.mode === 'collision-momentum' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="collision-v1-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Kecepatan Awal Benda 1 (v₁)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.initialVelocity} m/s
                    </span>
                  </div>
                  <input
                    id="collision-v1-slider"
                    type="range"
                    min={1}
                    max={25}
                    step={1}
                    value={params.initialVelocity}
                    onChange={(e) =>
                      handleParamUpdate({
                        initialVelocity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="collision-m2-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Massa Benda Kedua (m₂)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.collisionMass2} kg
                    </span>
                  </div>
                  <input
                    id="collision-m2-slider"
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.5}
                    value={params.collisionMass2}
                    onChange={(e) =>
                      handleParamUpdate({
                        collisionMass2: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="collision-v2-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Kecepatan Awal Benda 2 (v₂)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.velocity2Initial} m/s
                    </span>
                  </div>
                  <input
                    id="collision-v2-slider"
                    type="range"
                    min={-20}
                    max={10}
                    step={1}
                    value={params.velocity2Initial}
                    onChange={(e) =>
                      handleParamUpdate({
                        velocity2Initial: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="collision-e-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Koefisien Restitusi (e)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.restitutionCoeff.toFixed(2)} (
                      {params.restitutionCoeff === 1
                        ? 'Lenting Sempurna'
                        : params.restitutionCoeff === 0
                        ? 'Tidak Lenting'
                        : 'Lenting Sebagian'}
                      )
                    </span>
                  </div>
                  <input
                    id="collision-e-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={params.restitutionCoeff}
                    onChange={(e) =>
                      handleParamUpdate({
                        restitutionCoeff: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}

            {params.mode === 'spring-hooke' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="spring-k-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konstanta Pegas (k)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.springConstantK} N/m
                    </span>
                  </div>
                  <input
                    id="spring-k-slider"
                    type="range"
                    min={20}
                    max={400}
                    step={10}
                    value={params.springConstantK}
                    onChange={(e) =>
                      handleParamUpdate({
                        springConstantK: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="spring-disp-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Simpangan Amplitudo Awal (Δx)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.springDisplacement.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    id="spring-disp-slider"
                    type="range"
                    min={-1.5}
                    max={1.5}
                    step={0.1}
                    value={params.springDisplacement}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleParamUpdate({
                        springDisplacement: val,
                      });
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="spring-damping-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Koefisien Redaman (b)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.dampingCoeff.toFixed(2)} N·s/m
                    </span>
                  </div>
                  <input
                    id="spring-damping-slider"
                    type="range"
                    min={0}
                    max={2.0}
                    step={0.05}
                    value={params.dampingCoeff}
                    onChange={(e) =>
                      handleParamUpdate({
                        dampingCoeff: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}

            {params.mode === 'orbital-gravity' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-m2-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Massa Objek Kedua (m₂)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.secondaryMass} kg
                    </span>
                  </div>
                  <input
                    id="physics-m2-slider"
                    type="range"
                    min={100}
                    max={10000}
                    step={100}
                    value={params.secondaryMass}
                    onChange={(e) =>
                      handleParamUpdate({
                        secondaryMass: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="physics-dist-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Jarak Antar Pusat Massa (r)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.separationDistance} m
                    </span>
                  </div>
                  <input
                    id="physics-dist-slider"
                    type="range"
                    min={1}
                    max={40}
                    step={0.5}
                    value={params.separationDistance}
                    onChange={(e) =>
                      handleParamUpdate({
                        separationDistance: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <label
                htmlFor="physics-note-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1"
              >
                Catatan Pengamatan Eksperimen
              </label>
              <input
                id="physics-note-input"
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Contoh: Momentum total kekal sebelum & sesudah tumbukan..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <button
              type="button"
              onClick={handleRecordClick}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              Rekam Data Eksperimen ke Tabel Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
