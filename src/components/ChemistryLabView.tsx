import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Share2,
  Flame,
  Snowflake,
  Sparkles,
  Droplets,
  Zap,
  Box,
  BookOpen,
  Minus,
  Plus,
  GitCompare,
  Hand,
  X,
} from 'lucide-react';
import {
  ChemistryParams,
  ChemistryMetrics,
  THERMO_PRESETS,
  REDOX_PRESETS,
  AcademicLevel,
  GUIDED_LAB_SCENARIOS,
  calculateChemistryMetrics,
  calculateTitrationPh,
  generateAutomaticFeedback,
  getConceptCardContent,
  stepParameterValue,
  LabNotification,
} from '../utils/scienceEngine';
import { ChemistryScene3D } from './ChemistryScene3D';
import { labSound } from '../utils/soundEngine';

interface ChemistryLabViewProps {
  params: ChemistryParams;
  onChangeParams: (next: ChemistryParams) => void;
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isProduct: boolean;
}

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  onSyncWithGroup,
  academicLevel = 'sma',
}) => {
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [reactionProgress, setReactionProgress] = useState<number>(0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);

  // Side-by-Side A/B Experiment Comparison State
  const [baselineParams, setBaselineParams] =
    useState<ChemistryParams | null>(null);
  const [showComparisonPanel, setShowComparisonPanel] =
    useState<boolean>(false);

  // Direct Canvas Manipulation State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragHintText, setDragHintText] = useState<string>('');
  const [cursorCoords, setCursorCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number | null>(null);

  const preset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) || THERMO_PRESETS[0];
  const redoxPreset =
    REDOX_PRESETS.find((r) => r.id === params.redoxPairId) || REDOX_PRESETS[0];
  const metrics: ChemistryMetrics = calculateChemistryMetrics(params);
  const baselineMetrics: ChemistryMetrics | null = baselineParams
    ? calculateChemistryMetrics(baselineParams)
    : null;

  const conceptCard = getConceptCardContent(
    'Kimia',
    params.mode,
    academicLevel
  );
  const chemScenarios = GUIDED_LAB_SCENARIOS.filter(
    (s) => s.domain === 'Kimia'
  );
  const phProgressPct = Math.min(
    100,
    Math.max(0, (metrics.currentPh / 14) * 100)
  );

  useEffect(() => {
    const count = Math.min(
      48,
      Math.max(16, Math.round(params.reactantConcentration * 14))
    );
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: 45 + (i % 6) * 42,
        y: 65 + Math.floor(i / 6) * 32,
        vx: ((i % 3) - 1) * 1.6 || 1.2,
        vy: ((i % 2) * 2 - 1) * 1.4,
        isProduct: false,
      });
    }
    particlesRef.current = arr;
  }, [params.reactantConcentration, params.reactionId]);

  useEffect(() => {
    if (!isReacting) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      if (params.mode === 'acid-base-titration') {
        const nextMl = Math.min(
          50,
          Number((params.titrantAddedMl + dt * 4).toFixed(1))
        );
        labSound.playTitrationDrop(metrics.currentPh);
        onChangeParams({
          ...params,
          titrantAddedMl: nextMl,
        });
        if (nextMl >= 49.5) {
          setIsReacting(false);
        }
      } else {
        setReactionProgress((prev) => {
          const speedFactor = params.useCatalyst ? 0.28 : 0.16;
          const next = prev + dt * speedFactor;
          if (next >= 1) {
            setIsReacting(false);
            return 1;
          }
          return next;
        });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isReacting, params, metrics.currentPh]);

  // Direct Canvas Pointer Manipulation Handler (2D Mode)
  const applyChemistryCanvasDrag = (clientX: number, clientY: number) => {
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

    if (params.mode === 'thermo-calorimetry') {
      if (x < 330) {
        const temp = Math.min(
          140,
          Math.max(5, Math.round(140 - ((y - 54) / 240) * 135))
        );
        onChangeParams({ ...params, initialTempC: temp });
        setDragHintText(`Seret Kalorimeter: T₀ = ${temp} °C`);
      } else {
        const chartLeft = 355;
        const chartRight = width - 30;
        const prog = Math.min(
          1,
          Math.max(0, (x - chartLeft) / Math.max(1, chartRight - chartLeft))
        );
        setIsReacting(false);
        setReactionProgress(Number(prog.toFixed(2)));
        setDragHintText(
          `Seret Koordinat Reaksi: ξ = ${(prog * 100).toFixed(0)}%`
        );
      }
    } else if (params.mode === 'acid-base-titration') {
      const chartLeft = 345;
      const chartRight = width - 32;
      let nextVb = params.titrantAddedMl;
      if (x >= chartLeft - 20) {
        nextVb = Math.min(
          50,
          Math.max(
            0,
            Number(
              (
                ((x - chartLeft) / Math.max(1, chartRight - chartLeft)) *
                50
              ).toFixed(1)
            )
          )
        );
      } else {
        nextVb = Math.min(
          50,
          Math.max(0, Number((((y - 30) / (height - 80)) * 50).toFixed(1)))
        );
      }
      labSound.playTitrationDrop(metrics.currentPh);
      onChangeParams({ ...params, titrantAddedMl: nextVb });
      setDragHintText(
        `Seret Titrasi: V_NaOH = ${nextVb} mL · pH = ${metrics.currentPh}`
      );
    } else {
      if (x < width / 2) {
        const anodeM = Math.min(
          2.0,
          Math.max(0.01, Number((((290 - y) / 170) * 2.0).toFixed(2)))
        );
        onChangeParams({ ...params, anodeConcM: anodeM });
        setDragHintText(`Seret Anoda: [Anoda] = ${anodeM} M`);
      } else {
        const cathodeM = Math.min(
          2.0,
          Math.max(0.01, Number((((290 - y) / 170) * 2.0).toFixed(2)))
        );
        onChangeParams({ ...params, cathodeConcM: cathodeM });
        setDragHintText(`Seret Katoda: [Katoda] = ${cathodeM} M`);
      }
    }
  };

  // Render Canvas for 3 Chemistry Modes + Scenario A Ghost Curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (params.mode === 'thermo-calorimetry') {
      const vesselX = 36;
      const vesselY = 54;
      const vesselW = 260;
      const vesselH = 240;

      const currentTemp =
        params.initialTempC + metrics.deltaTempC * reactionProgress;
      const isExo = metrics.deltaHReaction < 0;

      ctx.fillStyle = isExo
        ? `rgba(244, 63, 94, ${0.08 + reactionProgress * 0.16})`
        : `rgba(56, 189, 248, ${0.08 + reactionProgress * 0.16})`;
      ctx.strokeStyle = isExo ? '#F43F5E' : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vesselX, vesselY, vesselW, vesselH, 10);
      ctx.fill();
      ctx.stroke();

      const thermalSpeedScale = Math.max(0.6, (currentTemp + 273.15) / 298.15);
      particlesRef.current.forEach((pt, idx) => {
        if (isReacting) {
          pt.x += pt.vx * thermalSpeedScale * 1.5;
          pt.y += pt.vy * thermalSpeedScale * 1.5;
          if (pt.x < vesselX + 14 || pt.x > vesselX + vesselW - 14) pt.vx *= -1;
          if (pt.y < vesselY + 24 || pt.y > vesselY + vesselH - 14) pt.vy *= -1;
        }
        const converted = idx / particlesRef.current.length < reactionProgress;
        ctx.fillStyle = converted
          ? isExo
            ? '#10B981'
            : '#38BDF8'
          : '#F59E0B';
        ctx.beginPath();
        ctx.arc(
          Math.max(vesselX + 12, Math.min(vesselX + vesselW - 12, pt.x)),
          Math.max(vesselY + 24, Math.min(vesselY + vesselH - 12, pt.y)),
          converted ? 6.5 : 5.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText(
        `KALORIMETER: T = ${currentTemp.toFixed(1)} °C`,
        vesselX + 12,
        vesselY - 12
      );
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Konversi Reaktan: ${(reactionProgress * 100).toFixed(0)}%  |  V = ${params.solutionVolumeMl} mL`,
        vesselX + 12,
        vesselY + vesselH + 20
      );

      const chartLeft = 355;
      const chartRight = width - 30;
      const chartTop = 48;
      const chartBottom = height - 46;
      const chartW = chartRight - chartLeft;
      const chartH = chartBottom - chartTop;

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartLeft, chartTop);
      ctx.lineTo(chartLeft, chartBottom);
      ctx.lineTo(chartRight, chartBottom);
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText('Entalpi (H) [kJ/mol]', chartLeft + 8, chartTop + 12);
      ctx.fillText('Koordinat Reaksi →', chartRight - 135, chartBottom + 20);

      const reactantY = isExo
        ? chartTop + chartH * 0.45
        : chartTop + chartH * 0.72;
      const productY = isExo
        ? chartTop + chartH * 0.78
        : chartTop + chartH * 0.38;
      const uncatalysedPeakY = chartTop + chartH * 0.14;
      const catalysedPeakY = chartTop + chartH * 0.27;

      const drawEnergyCurve = (
        peakY: number,
        color: string,
        dashed: boolean
      ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = dashed ? 2 : 3;
        if (dashed) ctx.setLineDash([5, 5]);

        const startX = chartLeft + 18;
        const rEnd = chartLeft + chartW * 0.22;
        const peakX = chartLeft + chartW * 0.5;
        const pStart = chartLeft + chartW * 0.78;
        const endX = chartRight - 14;

        ctx.beginPath();
        ctx.moveTo(startX, reactantY);
        ctx.lineTo(rEnd, reactantY);
        ctx.bezierCurveTo(
          rEnd + 35,
          reactantY,
          peakX - 35,
          peakY,
          peakX,
          peakY
        );
        ctx.bezierCurveTo(
          peakX + 35,
          peakY,
          pStart - 35,
          productY,
          pStart,
          productY
        );
        ctx.lineTo(endX, productY);
        ctx.stroke();
        ctx.restore();
      };

      drawEnergyCurve(
        uncatalysedPeakY,
        params.useCatalyst ? 'rgba(148, 163, 184, 0.45)' : '#F59E0B',
        params.useCatalyst
      );
      if (params.useCatalyst) {
        drawEnergyCurve(catalysedPeakY, '#10B981', false);
      }

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('Reaktan', chartLeft + 22, reactantY - 8);
      ctx.fillText('Produk', chartRight - 72, productY - 8);

      const activePeakY = params.useCatalyst
        ? catalysedPeakY
        : uncatalysedPeakY;
      ctx.fillStyle = params.useCatalyst ? '#10B981' : '#F59E0B';
      ctx.fillText(
        `Ea = ${metrics.effectiveEa} kJ/mol`,
        chartLeft + chartW * 0.38,
        activePeakY - 8
      );

      ctx.fillStyle = isExo ? '#F43F5E' : '#38BDF8';
      ctx.fillText(
        `ΔH = ${metrics.deltaHReaction > 0 ? '+' : ''}${metrics.deltaHReaction} kJ/mol`,
        chartLeft + chartW * 0.56,
        (reactantY + productY) / 2 + 4
      );

      const markerX = chartLeft + 18 + reactionProgress * (chartW - 36);
      const markerY =
        reactionProgress < 0.22
          ? reactantY
          : reactionProgress > 0.78
          ? productY
          : activePeakY +
            Math.pow((reactionProgress - 0.5) / 0.28, 2) *
              ((reactionProgress < 0.5 ? reactantY : productY) - activePeakY);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (params.mode === 'acid-base-titration') {
      const flaskCenterX = 165;
      const flaskBottomY = height - 48;

      // Burette tube at top
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(flaskCenterX - 10, 26, 20, 95);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      const buretteLevel = Math.max(10, 85 - params.titrantAddedMl * 1.4);
      ctx.fillRect(
        flaskCenterX - 8,
        26 + (85 - buretteLevel),
        16,
        buretteLevel
      );

      // Erlenmeyer Flask outline & solution fill
      ctx.fillStyle = metrics.indicatorColorHex;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(flaskCenterX - 24, 180);
      ctx.lineTo(flaskCenterX - 68, flaskBottomY);
      ctx.lineTo(flaskCenterX + 68, flaskBottomY);
      ctx.lineTo(flaskCenterX + 24, 180);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(flaskCenterX - 18, 145);
      ctx.lineTo(flaskCenterX - 18, 175);
      ctx.lineTo(flaskCenterX - 70, flaskBottomY);
      ctx.lineTo(flaskCenterX + 70, flaskBottomY);
      ctx.lineTo(flaskCenterX + 18, 175);
      ctx.lineTo(flaskCenterX + 18, 145);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText(`pH LARUTAN: ${metrics.currentPh}`, 44, 42);
      ctx.fillStyle = '#38BDF8';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Indikator: ${metrics.indicatorColorName}`,
        40,
        height - 18
      );

      // RIGHT: Sigmoidal pH Titration Curve (0 to 50 mL titrant)
      const chartLeft = 345;
      const chartRight = width - 32;
      const chartTop = 40;
      const chartBottom = height - 48;
      const chartW = chartRight - chartLeft;
      const chartH = chartBottom - chartTop;

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartLeft, chartTop);
      ctx.lineTo(chartLeft, chartBottom);
      ctx.lineTo(chartRight, chartBottom);
      ctx.stroke();

      // pH = 7.0 reference line
      const ph7Y = chartBottom - (7 / 14) * chartH;
      ctx.save();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, ph7Y);
      ctx.lineTo(chartRight, ph7Y);
      ctx.stroke();
      ctx.fillStyle = '#10B981';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('pH 7.0 (Netral)', chartRight - 96, ph7Y - 6);
      ctx.restore();

      // Draw Baseline Scenario A Sigmoidal Curve if active
      if (baselineParams && baselineParams.mode === 'acid-base-titration') {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let vSample = 0; vSample <= 50; vSample += 0.5) {
          const phSample = calculateTitrationPh(
            baselineParams.analyteAcidConc,
            baselineParams.analyteVolumeMl,
            baselineParams.titrantBaseConc,
            vSample,
            baselineParams.acidPka
          );
          const px = chartLeft + (vSample / 50) * chartW;
          const py = chartBottom - (phSample / 14) * chartH;
          if (vSample === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw full sigmoidal curve
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let vSample = 0; vSample <= 50; vSample += 0.5) {
        const phSample = calculateTitrationPh(
          params.analyteAcidConc,
          params.analyteVolumeMl,
          params.titrantBaseConc,
          vSample,
          params.acidPka
        );
        const px = chartLeft + (vSample / 50) * chartW;
        const py = chartBottom - (phSample / 14) * chartH;
        if (vSample === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current Titration Point Marker
      const curX =
        chartLeft + (Math.min(50, params.titrantAddedMl) / 50) * chartW;
      const curY = chartBottom - (metrics.currentPh / 14) * chartH;
      ctx.fillStyle = '#F43F5E';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(curX, curY, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `(${params.titrantAddedMl} mL, pH ${metrics.currentPh})`,
        Math.min(chartRight - 130, curX + 10),
        Math.max(chartTop + 16, curY - 8)
      );
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(
        `Volume NaOH Ditambahkan (V_eq = ${metrics.equivalenceVolumeMl} mL) →`,
        chartLeft + 20,
        chartBottom + 22
      );
    } else {
      // Electrochemistry Galvani Cell Diagram
      const anodeBeakerX = 95;
      const cathodeBeakerX = 455;
      const beakerY = 120;
      const beakerW = 190;
      const beakerH = 170;

      // Anode Half-Cell Beaker
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(anodeBeakerX, beakerY, beakerW, beakerH, 8);
      ctx.fill();
      ctx.stroke();

      // Cathode Half-Cell Beaker
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.strokeStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(cathodeBeakerX, beakerY, beakerW, beakerH, 8);
      ctx.fill();
      ctx.stroke();

      // Electrodes
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(anodeBeakerX + 45, beakerY - 25, 28, 155);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(cathodeBeakerX + 115, beakerY - 25, 28, 155);

      // External Wire & Digital Voltmeter
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(anodeBeakerX + 59, beakerY - 25);
      ctx.lineTo(anodeBeakerX + 59, 44);
      ctx.lineTo(cathodeBeakerX + 129, 44);
      ctx.lineTo(cathodeBeakerX + 129, beakerY - 25);
      ctx.stroke();

      // Voltmeter box
      const vmX = width / 2 - 68;
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vmX, 22, 136, 44, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = '700 14px "IBM Plex Mono", monospace';
      ctx.fillText(`+${metrics.nernstCellPotentialE} V`, vmX + 26, 49);

      // Salt Bridge (Jembatan Garam KNO3)
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(anodeBeakerX + 145, beakerY + 50);
      ctx.lineTo(anodeBeakerX + 145, beakerY - 10);
      ctx.lineTo(cathodeBeakerX + 45, beakerY - 10);
      ctx.lineTo(cathodeBeakerX + 45, beakerY + 50);
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('Jembatan Garam (KNO₃)', width / 2 - 68, beakerY - 24);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(
        `ANODA (-): ${redoxPreset.anodeHalf}`,
        anodeBeakerX,
        beakerY + beakerH + 22
      );
      ctx.fillStyle = '#10B981';
      ctx.fillText(
        `KATODA (+): ${redoxPreset.cathodeHalf}`,
        cathodeBeakerX - 10,
        beakerY + beakerH + 22
      );
    }
  }, [
    params,
    metrics,
    reactionProgress,
    isReacting,
    redoxPreset,
    baselineParams,
  ]);

  const handleParamChange = (patch: Partial<ChemistryParams>) => {
    onChangeParams({ ...params, ...patch });
  };

  const handleToggleReaction = () => {
    labSound.playClick(700);
    if (reactionProgress >= 1) setReactionProgress(0);
    const nextState = !isReacting;
    setIsReacting(nextState);
    if (nextState) {
      onPushNotification(generateAutomaticFeedback('Kimia', undefined, params));
    }
  };

  const handleResetReaction = () => {
    labSound.playClick(460);
    setIsReacting(false);
    setReactionProgress(0);
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

  const handleRecordChemistry = () => {
    labSound.playRecordSuccess();
    let title = '';
    let summary = '';
    let keyMetrics: Record<string, number | string> = {};
    let numericCoords = {
      x: params.initialTempC,
      y1: metrics.deltaG,
      y2: metrics.reactionRate,
    };

    if (params.mode === 'acid-base-titration') {
      title = `Titrasi Asam-Basa (V_NaOH = ${params.titrantAddedMl} mL)`;
      summary = `[Asam]=${params.analyteAcidConc}M (${params.analyteVolumeMl}mL), [Basa]=${params.titrantBaseConc}M, V_b=${params.titrantAddedMl}mL`;
      keyMetrics = {
        'pH Larutan': metrics.currentPh,
        'Volume Ekuivalen': `${metrics.equivalenceVolumeMl} mL`,
        Zona: metrics.titrationRegion,
        Indikator: metrics.indicatorColorName,
      };
      numericCoords = {
        x: params.titrantAddedMl,
        y1: metrics.currentPh,
        y2: metrics.equivalenceVolumeMl,
      };
    } else if (params.mode === 'electrochemistry-cell') {
      title = `Sel Galvani: ${redoxPreset.name}`;
      summary = `[Anoda]=${params.anodeConcM}M, [Katoda]=${params.cathodeConcM}M, T=${params.initialTempC}°C`;
      keyMetrics = {
        'Potensial E°_sel': `+${metrics.standardCellPotentialE0} V`,
        'Potensial Nernst E': `+${metrics.nernstCellPotentialE} V`,
        'ΔG Redoks': `${metrics.electroFreeEnergyDeltaG} kJ/mol`,
        'Kuosien Q': metrics.reactionQuotientQ,
      };
      numericCoords = {
        x: Math.log10(metrics.reactionQuotientQ),
        y1: metrics.nernstCellPotentialE,
        y2: metrics.electroFreeEnergyDeltaG,
      };
    } else {
      title = `${preset.name} (${preset.equation})`;
      summary = `T₀=${params.initialTempC}°C, [M]=${params.reactantConcentration}M, V=${params.solutionVolumeMl}mL, Katalis=${params.useCatalyst ? 'Ya' : 'Tidak'}`;
      keyMetrics = {
        'ΔH': `${metrics.deltaHReaction} kJ/mol`,
        'ΔG': `${metrics.deltaG} kJ/mol`,
        'Suhu Akhir': `${metrics.finalTempC} °C`,
        'Laju Reaksi (r)': `${metrics.reactionRate} M/s`,
      };
      numericCoords = {
        x: params.initialTempC,
        y1: metrics.deltaG,
        y2: metrics.finalTempC,
      };
    }

    onRecordExperiment(
      title,
      summary,
      keyMetrics,
      noteInput.trim() ||
        `Data eksperimen kimia (${params.mode}) berhasil direkam.`,
      numericCoords
    );
    onPushNotification(generateAutomaticFeedback('Kimia', undefined, params));
    setNoteInput('');
  };

  return (
    <div className="space-y-5">
      {/* Chemistry Mode Selector & Preset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              handleParamChange({ mode: 'thermo-calorimetry' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'thermo-calorimetry'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Termodinamika & Kalorimetri
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              handleParamChange({ mode: 'acid-base-titration' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'acid-base-titration'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Titrasi Asam-Basa (Kurva pH)
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              handleParamChange({ mode: 'electrochemistry-cell' });
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
              params.mode === 'electrochemistry-cell'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Sel Elektrokimia Galvani (Nernst)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {params.mode === 'thermo-calorimetry' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {THERMO_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIsReacting(false);
                    setReactionProgress(0);
                    const next = { ...params, reactionId: item.id };
                    onChangeParams(next);
                    onPushNotification(
                      generateAutomaticFeedback('Kimia', undefined, next)
                    );
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    params.reactionId === item.id
                      ? 'bg-slate-900 dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.deltaHStandard < 0 ? (
                    <Flame className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Snowflake className="w-3 h-3 text-sky-400" />
                  )}
                  {item.name}
                </button>
              ))}
            </div>
          )}

          {params.mode === 'electrochemistry-cell' && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="redox-preset-select"
                className="text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Pasangan Elektrode:
              </label>
              <select
                id="redox-preset-select"
                value={params.redoxPairId}
                onChange={(e) => {
                  labSound.playClick();
                  handleParamChange({ redoxPairId: e.target.value });
                }}
                className="text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
              >
                {REDOX_PRESETS.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {/* Side-by-Side Chemistry Comparison Drawer (A/B Mode) */}
      {showComparisonPanel && (
        <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-amber-300/80 dark:border-amber-500/40 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Mode Perbandingan Kimia Berdampingan (Skenario A Baseline vs Skenario B Aktif)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const noCat: ChemistryParams = {
                    ...params,
                    mode: 'thermo-calorimetry',
                    useCatalyst: false,
                  };
                  setBaselineParams(noCat);
                  onChangeParams({ ...noCat, useCatalyst: true });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Tanpa Katalis vs Katalis Aktif
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const preEq: ChemistryParams = {
                    ...params,
                    mode: 'acid-base-titration',
                    titrantAddedMl: 18.0,
                  };
                  setBaselineParams(preEq);
                  onChangeParams({ ...preEq, titrantAddedMl: 20.0 });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Titrasi 18 mL vs Titik Ekuivalen 20 mL
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
                aria-label="Tutup panel perbandingan kimia"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {baselineParams && baselineMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  SKENARIO A (BASELINE DISEMATKAN)
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-mono">
                  T₀={baselineParams.initialTempC}°C · V_b={baselineParams.titrantAddedMl}mL · Katalis={baselineParams.useCatalyst ? 'Ya' : 'Tidak'}
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>ΔG = {baselineMetrics.deltaG} kJ</span>
                  <span>pH = {baselineMetrics.currentPh}</span>
                  <span>r = {baselineMetrics.reactionRate} M/s</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-800/70 space-y-1">
                <div className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-semibold">
                  SKENARIO B (EKSPERIMEN AKTIF)
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-mono">
                  T₀={params.initialTempC}°C · V_b={params.titrantAddedMl}mL · Katalis={params.useCatalyst ? 'Ya' : 'Tidak'}
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>ΔG = {metrics.deltaG} kJ</span>
                  <span>pH = {metrics.currentPh}</span>
                  <span>r = {metrics.reactionRate} M/s</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 space-y-1">
                <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  SELISIH KOMPARASI (Δ = B − A)
                </div>
                <div className="font-mono text-slate-700 dark:text-slate-200 space-y-0.5 tabular-nums">
                  <div>
                    Δ pH Larutan:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.currentPh - baselineMetrics.currentPh) >= 0 ? '+' : ''}
                      {(metrics.currentPh - baselineMetrics.currentPh).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    Δ Energi Aktivasi Ea:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.effectiveEa - baselineMetrics.effectiveEa) >= 0 ? '+' : ''}
                      {(metrics.effectiveEa - baselineMetrics.effectiveEa).toFixed(1)} kJ/mol
                    </strong>
                  </div>
                  <div>
                    Δ Laju Reaksi (r):{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.reactionRate - baselineMetrics.reactionRate) >= 0 ? '+' : ''}
                      {(metrics.reactionRate - baselineMetrics.reactionRate).toFixed(2)} M/s
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guided Chemistry Scenario Cards */}
      <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Skenario Eksperimen Kimia Terbimbing (Klik untuk mengatur parameter reaksi)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Memudahkan siswa & mahasiswa mengamati kalorimetri, titik ekuivalen titrasi, dan sel Galvani
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {chemScenarios.map((sc, idx) => {
            const isActiveScenario = sc.chemistryPatch?.mode === params.mode;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  labSound.playClick(660);
                  const next = { ...params, ...sc.chemistryPatch };
                  setIsReacting(false);
                  setReactionProgress(0);
                  onChangeParams(next);
                  onPushNotification(
                    generateAutomaticFeedback('Kimia', undefined, next)
                  );
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

      {/* Main Split-Screen Interactive Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {params.mode === 'acid-base-titration'
                    ? 'Simulasi Buret Titrasi Asam-Basa & Kurva Sigmoidal pH'
                    : params.mode === 'electrochemistry-cell'
                    ? 'Diagram Sel Galvani, Jembatan Garam & Potensial Nernst'
                    : 'Bejana Kalorimetri & Kurva Profil Energi Termodinamika'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {params.mode === 'acid-base-titration' ? (
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                      ● {metrics.titrationRegion} · pH = {metrics.currentPh} · Titik Ekuivalen = {metrics.equivalenceVolumeMl} mL
                    </span>
                  ) : params.mode === 'electrochemistry-cell' ? (
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      ● SEL VOLTA SPONTAN: E° = +{metrics.standardCellPotentialE0} V · E_sel = +{metrics.nernstCellPotentialE} V · ΔG = {metrics.electroFreeEnergyDeltaG} kJ/mol
                    </span>
                  ) : (
                    <>
                      Status Termodinamika:{' '}
                      <span
                        className={`font-mono font-semibold ${
                          metrics.isSpontaneous
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {metrics.isSpontaneous
                          ? `● SPONTAN (${metrics.spontaneityLabel})`
                          : `▲ NON-SPONTAN (${metrics.spontaneityLabel})`}
                      </span>
                      {' · '}
                      <span>{preset.equation}</span>
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
                  <Box className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
                  {is3DMode ? 'Mode 3D Interaktif' : 'Mode 2D Diagram'}
                </button>
                {params.mode === 'thermo-calorimetry' && (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      handleParamChange({ useCatalyst: !params.useCatalyst });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      params.useCatalyst
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {params.useCatalyst ? 'Katalis Aktif' : 'Gunakan Katalis'}
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Viewport Container with Floating HUD & Floating Bottom Dock */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F19]">
              <div className="pointer-events-none absolute top-3 left-3 z-10 lab-glass-panel bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 space-y-0.5">
                <div className="font-mono text-[11px] text-emerald-400 font-semibold tabular-nums">
                  {params.mode === 'acid-base-titration'
                    ? `TITRASI ASAM-BASA · V_NaOH = ${params.titrantAddedMl} mL`
                    : params.mode === 'electrochemistry-cell'
                    ? `POTENSIAL SEL NERNST · E = +${metrics.nernstCellPotentialE} V`
                    : `KALORIMETRI · T = ${(
                        params.initialTempC +
                        metrics.deltaTempC * reactionProgress
                      ).toFixed(1)} °C`}
                </div>
                <div className="font-mono font-semibold text-white tabular-nums">
                  {params.mode === 'acid-base-titration'
                    ? `pH = ${metrics.currentPh} (${metrics.indicatorColorName})`
                    : params.mode === 'electrochemistry-cell'
                    ? `Q = ${metrics.reactionQuotientQ} · ΔG = ${metrics.electroFreeEnergyDeltaG} kJ/mol`
                    : `ΔH = ${metrics.deltaHReaction} kJ/mol · ΔG = ${metrics.deltaG} kJ/mol`}
                </div>
              </div>

              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                {!is3DMode ? (
                  <span className="lab-glass-panel bg-sky-950/85 border border-sky-500/50 text-sky-200 font-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <Hand className="w-3.5 h-3.5 text-sky-400" />
                    {dragHintText ||
                      (cursorCoords
                        ? `Kursor (${cursorCoords.x}, ${cursorCoords.y}) · Seret Kurva/Buret`
                        : 'Klik & Seret Kurva/Bejana di Kanvas 2D')}
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
                    <Hand className="w-3.5 h-3.5 text-emerald-400" />
                    Buka Kanvas 2D untuk Seret Kurva/Titrasi
                  </button>
                )}
              </div>

              {is3DMode ? (
                <ChemistryScene3D
                  params={params}
                  metrics={metrics}
                  preset={preset}
                  redoxPreset={redoxPreset}
                  reactionProgress={reactionProgress}
                  isReacting={isReacting}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  data-testid="chemistry-simulation-canvas"
                  width={760}
                  height={350}
                  onPointerDown={(e) => {
                    setIsDraggingCanvas(true);
                    labSound.playClick(540);
                    applyChemistryCanvasDrag(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) =>
                    applyChemistryCanvasDrag(e.clientX, e.clientY)
                  }
                  onPointerUp={() => {
                    setIsDraggingCanvas(false);
                    setDragHintText('');
                  }}
                  onPointerLeave={() => {
                    setIsDraggingCanvas(false);
                    setCursorCoords(null);
                    setDragHintText('');
                  }}
                  className={`w-full h-[330px] sm:h-[350px] block touch-none ${
                    isDraggingCanvas ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                />
              )}

              {/* Floating Bottom Dock */}
              <div className="bg-slate-950/90 border-t border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleReaction}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {isReacting ? (
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
                    onClick={handleResetReaction}
                    aria-label="Reset Simulasi Kimia"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>

                <div className="flex-1 min-w-[180px] flex items-center gap-2.5">
                  <label
                    htmlFor="chem-progress-scrubber"
                    className="text-[11px] font-mono text-slate-400 whitespace-nowrap"
                  >
                    {params.mode === 'acid-base-titration'
                      ? 'Volume Titran NaOH (mL):'
                      : 'Kemajuan Reaksi (ξ):'}
                  </label>
                  <input
                    id="chem-progress-scrubber"
                    type="range"
                    min={0}
                    max={params.mode === 'acid-base-titration' ? 50 : 1}
                    step={params.mode === 'acid-base-titration' ? 0.5 : 0.02}
                    value={
                      params.mode === 'acid-base-titration'
                        ? params.titrantAddedMl
                        : reactionProgress
                    }
                    onChange={(e) => {
                      setIsReacting(false);
                      const val = parseFloat(e.target.value);
                      if (params.mode === 'acid-base-titration') {
                        labSound.playTitrationDrop(metrics.currentPh);
                        handleParamChange({ titrantAddedMl: val });
                      } else {
                        setReactionProgress(val);
                      }
                    }}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-semibold text-white tabular-nums w-16 text-right">
                    {params.mode === 'acid-base-titration'
                      ? `${params.titrantAddedMl} mL`
                      : `${(reactionProgress * 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {params.mode === 'acid-base-titration'
                  ? 'Derajat Keasaman (pH)'
                  : params.mode === 'electrochemistry-cell'
                  ? 'Potensial Sel Standar (E°)'
                  : 'Perubahan Entalpi (ΔH°)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {params.mode === 'acid-base-titration'
                    ? metrics.currentPh
                    : params.mode === 'electrochemistry-cell'
                    ? `+${metrics.standardCellPotentialE0}`
                    : metrics.deltaHReaction}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {params.mode === 'acid-base-titration'
                    ? 'pH'
                    : params.mode === 'electrochemistry-cell'
                    ? 'V'
                    : 'kJ/mol'}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                {params.mode === 'acid-base-titration'
                  ? metrics.titrationRegion
                  : params.mode === 'electrochemistry-cell'
                  ? `n = ${redoxPreset.electronsTransferred} elektron`
                  : `q = ${metrics.heatReleasedJoules} J`}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {params.mode === 'acid-base-titration'
                  ? 'Volume Titik Ekuivalen'
                  : params.mode === 'electrochemistry-cell'
                  ? 'Potensial Sel Nernst (E)'
                  : 'Energi Bebas Gibbs (ΔG)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {params.mode === 'acid-base-titration'
                    ? metrics.equivalenceVolumeMl
                    : params.mode === 'electrochemistry-cell'
                    ? `+${metrics.nernstCellPotentialE}`
                    : metrics.deltaG}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {params.mode === 'acid-base-titration'
                    ? 'mL'
                    : params.mode === 'electrochemistry-cell'
                    ? 'V'
                    : 'kJ/mol'}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                {params.mode === 'acid-base-titration'
                  ? `pKa = ${params.acidPka}`
                  : params.mode === 'electrochemistry-cell'
                  ? `Q = ${metrics.reactionQuotientQ}`
                  : `ΔS° = ${metrics.deltaSReaction} J/(mol·K)`}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Suhu Sistem Larutan
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {params.mode === 'thermo-calorimetry'
                    ? metrics.finalTempC
                    : params.initialTempC}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  °C
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                T = {metrics.tempKelvin} K
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {params.mode === 'electrochemistry-cell'
                  ? 'Energi Bebas Redoks (ΔG)'
                  : 'Laju Reaksi Awal (r)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {params.mode === 'electrochemistry-cell'
                    ? metrics.electroFreeEnergyDeltaG
                    : metrics.reactionRate}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {params.mode === 'electrochemistry-cell' ? 'kJ/mol' : 'M/s'}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                Ea = {metrics.effectiveEa} kJ/mol
              </div>
            </div>
          </div>

          {/* pH 0-14 Spectrum / Spontaneity Visual Gauge & Academic Concept Companion */}
          <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            {params.mode === 'acid-base-titration' && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    Spektrum Derajat Keasaman Larutan (pH 0.0 Asam Kuat → 7.0 Netral → 14.0 Basa Kuat)
                  </span>
                  <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">
                    pH Saat Ini = {metrics.currentPh} ({metrics.indicatorColorName})
                  </span>
                </div>
                <div className="relative w-full h-3 rounded-full bg-gradient-to-r from-rose-500 via-emerald-500 to-sky-600">
                  <div
                    className="absolute -top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-900 shadow-xs transition-all duration-150 -translate-x-1/2"
                    style={{ left: `${phProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {conceptCard.heading}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
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
              <div className="sm:shrink-0 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 font-mono text-slate-900 dark:text-emerald-300">
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
                Parameter Eksperimen Kimia
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
                  `Kimia (${params.mode}): T=${params.initialTempC}°C, pH=${metrics.currentPh}`
                );
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/60 dark:border-sky-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              Sinkron Kelompok
            </button>
          </div>

          <div className="space-y-4">
            {params.mode === 'thermo-calorimetry' && (
              <>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="chem-temp-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Suhu Awal Sistem (T₀)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Kurangi suhu awal sistem"
                        onClick={() => {
                          labSound.playStep('down');
                          handleParamChange({
                            initialTempC: stepParameterValue(
                              params.initialTempC,
                              -5,
                              5,
                              140,
                              0
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[82px] text-center">
                        {params.initialTempC} °C
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah suhu awal sistem"
                        onClick={() => {
                          labSound.playStep('up');
                          handleParamChange({
                            initialTempC: stepParameterValue(
                              params.initialTempC,
                              5,
                              5,
                              140,
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
                    id="chem-temp-slider"
                    type="range"
                    min={5}
                    max={140}
                    step={5}
                    value={params.initialTempC}
                    onChange={(e) =>
                      handleParamChange({
                        initialTempC: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="chem-conc-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konsentrasi Reaktan ([M])
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.reactantConcentration.toFixed(1)} mol/L
                    </span>
                  </div>
                  <input
                    id="chem-conc-slider"
                    type="range"
                    min={0.2}
                    max={4.0}
                    step={0.2}
                    value={params.reactantConcentration}
                    onChange={(e) =>
                      handleParamChange({
                        reactantConcentration: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="chem-vol-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Volume Larutan Kalorimeter (V)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.solutionVolumeMl} mL ({metrics.molesReacted} mol)
                    </span>
                  </div>
                  <input
                    id="chem-vol-slider"
                    type="range"
                    min={50}
                    max={600}
                    step={25}
                    value={params.solutionVolumeMl}
                    onChange={(e) =>
                      handleParamChange({
                        solutionVolumeMl: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </>
            )}

            {params.mode === 'acid-base-titration' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="titration-ma-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konsentrasi Analit Asam (M_a)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.analyteAcidConc.toFixed(2)} M
                    </span>
                  </div>
                  <input
                    id="titration-ma-slider"
                    type="range"
                    min={0.05}
                    max={0.5}
                    step={0.05}
                    value={params.analyteAcidConc}
                    onChange={(e) =>
                      handleParamChange({
                        analyteAcidConc: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="titration-mb-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konsentrasi Titran NaOH (M_b)
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.titrantBaseConc.toFixed(2)} M
                    </span>
                  </div>
                  <input
                    id="titration-mb-slider"
                    type="range"
                    min={0.05}
                    max={0.5}
                    step={0.05}
                    value={params.titrantBaseConc}
                    onChange={(e) =>
                      handleParamChange({
                        titrantBaseConc: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="titration-vb-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Volume NaOH Ditambahkan (V_b)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Kurangi tetesan NaOH 0.5 mL"
                        onClick={() => {
                          labSound.playTitrationDrop(metrics.currentPh);
                          handleParamChange({
                            titrantAddedMl: stepParameterValue(
                              params.titrantAddedMl,
                              -0.5,
                              0,
                              50,
                              1
                            ),
                          });
                        }}
                        className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[60px] text-center">
                        {params.titrantAddedMl} mL
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah tetesan NaOH 0.5 mL"
                        onClick={() => {
                          labSound.playTitrationDrop(metrics.currentPh);
                          handleParamChange({
                            titrantAddedMl: stepParameterValue(
                              params.titrantAddedMl,
                              0.5,
                              0,
                              50,
                              1
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
                    id="titration-vb-slider"
                    type="range"
                    min={0}
                    max={50}
                    step={0.5}
                    value={params.titrantAddedMl}
                    onChange={(e) => {
                      labSound.playTitrationDrop(metrics.currentPh);
                      handleParamChange({
                        titrantAddedMl: parseFloat(e.target.value),
                      });
                    }}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="titration-indicator-select"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Indikator Asam-Basa
                  </label>
                  <select
                    id="titration-indicator-select"
                    value={params.indicatorType}
                    onChange={(e) => {
                      labSound.playClick();
                      handleParamChange({
                        indicatorType: e.target.value as
                          | 'fenolftalein'
                          | 'bromtimol-biru'
                          | 'metil-jingga',
                      });
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="fenolftalein">
                      Fenolftalein (Trayek pH 8.2 – 10.0)
                    </option>
                    <option value="bromtimol-biru">
                      Bromtimol Biru (Trayek pH 6.0 – 7.6)
                    </option>
                    <option value="metil-jingga">
                      Metil Jingga (Trayek pH 3.1 – 4.4)
                    </option>
                  </select>
                </div>
              </>
            )}

            {params.mode === 'electrochemistry-cell' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="electro-anode-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konsentrasi Ion Anoda ([Anoda])
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.anodeConcM.toFixed(3)} M
                    </span>
                  </div>
                  <input
                    id="electro-anode-slider"
                    type="range"
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    value={params.anodeConcM}
                    onChange={(e) =>
                      handleParamChange({
                        anodeConcM: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label
                      htmlFor="electro-cathode-slider"
                      className="font-medium text-slate-700 dark:text-slate-200"
                    >
                      Konsentrasi Ion Katoda ([Katoda])
                    </label>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {params.cathodeConcM.toFixed(3)} M
                    </span>
                  </div>
                  <input
                    id="electro-cathode-slider"
                    type="range"
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    value={params.cathodeConcM}
                    onChange={(e) =>
                      handleParamChange({
                        cathodeConcM: parseFloat(e.target.value),
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
                htmlFor="chem-note-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1"
              >
                Catatan Analisis Kimia
              </label>
              <input
                id="chem-note-input"
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Contoh: Titik ekuivalen tercapai pada pH 7.00..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <button
              type="button"
              onClick={handleRecordChemistry}
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
