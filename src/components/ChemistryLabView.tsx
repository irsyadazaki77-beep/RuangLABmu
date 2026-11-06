import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  GitCompare,
  Hand,
  X,
  Camera,
  Sliders,
  BarChart3,
  ShieldCheck,
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
  LabNotification,
} from '../utils/scienceEngine';
import { ChemistryScene3D } from './ChemistryScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { ExperimentCatalogPicker } from './ExperimentCatalogPicker';
import { PreLabSafetyModal } from './PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CircularGaugeMeter,
  LiquidColumnMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';

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
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
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
  remoteCursors,
  onEmitCursor,
}) => {
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [reactionProgress, setReactionProgress] = useState<number>(0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [activeHudSection, setActiveHudSection] = useState<
    'kontrol' | 'grafik' | 'panduan'
  >('kontrol');
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [recordToastCount, setRecordToastCount] = useState<number>(0);

  const chemistryModules = getExperimentsByDomain('kimia');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(chemistryModules[0]);
  const activeTier: EducationTier =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'Mahasiswa' : 'SMA';

  const currentChemistryModuleId =
    params.mode === 'thermo-calorimetry'
      ? 'thermo-calorimetry'
      : params.mode === 'acid-base-titration'
      ? 'acid-base-titration'
      : 'redox-electrochemistry';

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
    setShutterFlash(true);
    setRecordToastCount((c) => c + 1);
    setTimeout(() => setShutterFlash(false), 220);

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

  // Interactive Live Formula Tokens for Chemistry
  const chemistryFormulaData: {
    title: string;
    subtitle: string;
    tokens: FormulaToken[];
  } = (() => {
    if (params.mode === 'acid-base-titration') {
      return {
        title: 'Stoikiometri Ekuivalensi & Derajat Keasaman Titrasi',
        subtitle: `Titik Ekuivalen V_eq = ${metrics.equivalenceVolumeMl} mL · Indikator: ${metrics.indicatorColorName}`,
        tokens: [
          { symbol: 'pH', value: metrics.currentPh, unit: 'pH', color: '#10b981' },
          { symbol: '⇔' },
          {
            symbol: 'M_a',
            paramKey: 'analyteAcidConc',
            value: params.analyteAcidConc,
            min: 0.05,
            max: 0.5,
            unit: 'M',
            color: '#f43f5e',
          },
          { symbol: '·' },
          { symbol: 'V_a', value: params.analyteVolumeMl, unit: 'mL', color: '#94a3b8' },
          { symbol: '−' },
          {
            symbol: 'M_b',
            paramKey: 'titrantBaseConc',
            value: params.titrantBaseConc,
            min: 0.05,
            max: 0.5,
            unit: 'M',
            color: '#38bdf8',
          },
          { symbol: '·' },
          {
            symbol: 'V_b',
            paramKey: 'titrantAddedMl',
            value: params.titrantAddedMl,
            min: 0,
            max: 50,
            unit: 'mL',
            color: '#a855f7',
          },
        ],
      };
    }
    if (params.mode === 'electrochemistry-cell') {
      return {
        title: 'Persamaan Nernst Sel Elektrokimia Galvani',
        subtitle: `${redoxPreset.anodeHalf}  ||  ${redoxPreset.cathodeHalf}`,
        tokens: [
          { symbol: 'E_sel', value: metrics.nernstCellPotentialE, unit: 'V', color: '#10b981' },
          { symbol: '=' },
          { symbol: 'E°', value: metrics.standardCellPotentialE0, unit: 'V', color: '#38bdf8' },
          { symbol: '−' },
          { symbol: '(RT/nF)·ln' },
          { symbol: '(' },
          {
            symbol: '[Anoda]',
            paramKey: 'anodeConcM',
            value: params.anodeConcM,
            min: 0.01,
            max: 2.0,
            unit: 'M',
            color: '#f59e0b',
          },
          { symbol: '/' },
          {
            symbol: '[Katoda]',
            paramKey: 'cathodeConcM',
            value: params.cathodeConcM,
            min: 0.01,
            max: 2.0,
            unit: 'M',
            color: '#ec4899',
          },
          { symbol: ')' },
        ],
      };
    }
    return {
      title: 'Energi Bebas Gibbs & Kalorimetri Reaksi',
      subtitle: `${preset.equation} (${metrics.spontaneityLabel})`,
      tokens: [
        { symbol: 'ΔG', value: metrics.deltaG, unit: 'kJ/mol', color: '#10b981' },
        { symbol: '=' },
        { symbol: 'ΔH°', value: metrics.deltaHReaction, unit: 'kJ/mol', color: '#f43f5e' },
        { symbol: '−' },
        {
          symbol: 'T',
          paramKey: 'initialTempC',
          value: metrics.tempKelvin,
          min: 278,
          max: 413,
          unit: 'K',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: 'ΔS°',
          paramKey: 'reactantConcentration',
          value: metrics.deltaSReaction,
          min: -200,
          max: 200,
          unit: 'J/mol·K',
          color: '#38bdf8',
        },
      ],
    };
  })();

  return (
    <div className="space-y-5">
      {/* Universal Experiment Catalog Picker */}
      <ExperimentCatalogPicker
        domain="kimia"
        currentExperimentId={currentChemistryModuleId}
        activeTier={activeTier}
        onSelectExperiment={(exp) => {
          if (exp.id === 'thermo-calorimetry') {
            handleParamChange({ mode: 'thermo-calorimetry' });
          } else if (exp.id === 'acid-base-titration') {
            handleParamChange({ mode: 'acid-base-titration' });
          } else if (exp.id === 'redox-electrochemistry') {
            handleParamChange({ mode: 'electrochemistry-cell' });
          } else if (exp.id === 'ideal-gas-boyle') {
            handleParamChange({ mode: 'thermo-calorimetry', initialTempC: 30 });
          } else if (exp.id === 'reaction-kinetics-arrhenius') {
            handleParamChange({ mode: 'thermo-calorimetry', useCatalyst: true });
          } else if (exp.id === 'spectrophotometry-beer') {
            handleParamChange({ mode: 'acid-base-titration' });
          }
        }}
        onOpenPreLabModal={(exp) => {
          setModalExperiment(exp);
          setPreLabModalOpen(true);
        }}
      />

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

      {/* SPATIAL HUD COCKPIT WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* HERO 3D STAGE (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative min-h-[560px] rounded-2xl overflow-hidden border border-emerald-500/40 bg-[#0B0F19] shadow-[0_0_50px_-12px_rgba(16,185,129,0.32)] flex flex-col justify-between">
            {/* Camera Shutter Flash on Record */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/80 to-cyan-300/60"
                />
              )}
            </AnimatePresence>

            {/* Flying "+1 Data Tercatat!" Toast Badge */}
            <AnimatePresence>
              {recordToastCount > 0 && (
                <motion.div
                  key={recordToastCount}
                  initial={{ opacity: 0, y: 24, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="pointer-events-none absolute bottom-20 right-5 z-30 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/95 text-slate-950 font-mono text-xs font-bold shadow-[0_0_25px_rgba(16,185,129,0.75)] border border-emerald-300"
                >
                  <Camera className="w-4 h-4" />
                  <span>+1 Data Kimia Tercatat!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TOP-LEFT FLOATING HUD: Experiment Status Pill + Tier Badge */}
            <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 max-w-[62%]">
              <div className="lab-glass-panel bg-slate-950/85 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isReacting ? 'bg-emerald-400' : 'bg-sky-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isReacting ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    {isReacting ? 'REAKSI BERJALAN · 60 FPS' : 'SIAGA REAKTOR'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                    {activeTier}
                  </span>
                </div>
                <div className="font-mono font-bold text-white text-xs mt-1 truncate">
                  {params.mode === 'acid-base-titration'
                    ? `Titrasi Asam-Basa · V_NaOH = ${params.titrantAddedMl} mL`
                    : params.mode === 'electrochemistry-cell'
                    ? `Sel Galvani Nernst · E = +${metrics.nernstCellPotentialE} V`
                    : `Kalorimetri · ${preset.equation}`}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIs3DMode((m) => !m);
                  }}
                  className="lab-glass-panel bg-slate-900/85 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5 text-emerald-400" />
                  {is3DMode ? '3D WebGL' : '2D Diagram'}
                </button>
                {params.mode === 'thermo-calorimetry' && (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      handleParamChange({ useCatalyst: !params.useCatalyst });
                    }}
                    className={`lab-glass-panel font-mono text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      params.useCatalyst
                        ? 'bg-emerald-600/90 border-emerald-400 text-white'
                        : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {params.useCatalyst ? 'Katalis Aktif' : '+ Katalis'}
                  </button>
                )}
              </div>
            </div>

            {/* TOP-RIGHT FLOATING HUD: Tactile Liquid Column & Circular Gauges */}
            <div className="pointer-events-none absolute top-3.5 right-3.5 z-20 hidden sm:flex items-start gap-2">
              {params.mode === 'acid-base-titration' && (
                <>
                  <LiquidColumnMeter
                    label="Tabung pH"
                    value={metrics.currentPh}
                    min={0}
                    max={14}
                    unit="pH"
                    variant="ph"
                  />
                  <LiquidColumnMeter
                    label="Buret NaOH"
                    value={params.titrantAddedMl}
                    min={0}
                    max={50}
                    unit="mL"
                    variant="volume"
                  />
                </>
              )}
              {params.mode === 'thermo-calorimetry' && (
                <>
                  <LiquidColumnMeter
                    label="Termometer"
                    value={Number(
                      (
                        params.initialTempC +
                        metrics.deltaTempC * (isReacting || reactionProgress > 0 ? Math.max(0.2, reactionProgress) : 1)
                      ).toFixed(1)
                    )}
                    min={0}
                    max={120}
                    unit="°C"
                    variant="temperature"
                  />
                  <CircularGaugeMeter
                    size="sm"
                    label="Laju Reaksi r"
                    value={metrics.reactionRate}
                    min={0}
                    max={8}
                    unit="M/s"
                    color="#10b981"
                    warningThreshold={6}
                  />
                </>
              )}
              {params.mode === 'electrochemistry-cell' && (
                <>
                  <CircularGaugeMeter
                    size="sm"
                    label="Potensial E_sel"
                    value={metrics.nernstCellPotentialE}
                    min={0}
                    max={2.5}
                    unit="Volt"
                    color="#10b981"
                  />
                  <CircularGaugeMeter
                    size="sm"
                    label="|ΔG Redoks|"
                    value={Math.abs(metrics.electroFreeEnergyDeltaG)}
                    min={0}
                    max={400}
                    unit="kJ/mol"
                    color="#38bdf8"
                  />
                </>
              )}
            </div>

            {/* 2D Canvas Interactive Drag Hint Pill */}
            {!is3DMode && (
              <div className="absolute bottom-16 left-3.5 z-20">
                <span className="lab-glass-panel bg-sky-950/90 border border-sky-500/50 text-sky-200 font-mono text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Hand className="w-3.5 h-3.5 text-sky-400" />
                  {dragHintText ||
                    (cursorCoords
                      ? `Kursor (${cursorCoords.x}, ${cursorCoords.y}) · Seret Kurva/Buret`
                      : 'Klik & Seret Kurva/Bejana di Kanvas 2D')}
                </span>
              </div>
            )}

            {/* MAIN 3D / 2D VIEWPORT */}
            <div className="flex-1 flex flex-col justify-center">
              {is3DMode ? (
                <ChemistryScene3D
                  params={params}
                  metrics={metrics}
                  preset={preset}
                  redoxPreset={redoxPreset}
                  reactionProgress={reactionProgress}
                  isReacting={isReacting}
                  remoteCursors={remoteCursors}
                  onEmitCursor={onEmitCursor}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  data-testid="chemistry-simulation-canvas"
                  width={760}
                  height={480}
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
                  className={`w-full h-[460px] sm:h-[500px] block touch-none ${
                    isDraggingCanvas ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                />
              )}
            </div>

            {/* BOTTOM FLOATING HUD DECK */}
            <div className="relative z-20 bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleToggleReaction}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.45)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleResetReaction}
                  aria-label="Reset Simulasi Kimia"
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </motion.button>
              </div>

              <div className="flex-1 min-w-[160px] max-w-xs flex items-center gap-2.5">
                <label
                  htmlFor="chem-progress-scrubber"
                  className="text-[11px] font-mono text-slate-400 whitespace-nowrap"
                >
                  {params.mode === 'acid-base-titration'
                    ? 'Titran NaOH:'
                    : 'Kemajuan ξ:'}
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
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs font-mono font-semibold text-white tabular-nums w-14 text-right">
                  {params.mode === 'acid-base-titration'
                    ? `${params.titrantAddedMl}mL`
                    : `${(reactionProgress * 100).toFixed(0)}%`}
                </span>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRecordChemistry}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Catat Data Percobaan
              </motion.button>
            </div>
          </div>
        </div>

        {/* RIGHT COCKPIT DOCK: Collapsible Segmented Drawer Tabs (4 Cols) */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          {/* Segmented Drawer Navigation */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-950/90 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {[
              { id: 'kontrol', label: 'Kontrol & Rumus', icon: Sliders },
              { id: 'grafik', label: 'Grafik & Data', icon: BarChart3 },
              { id: 'panduan', label: 'Panduan & K3', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeHudSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick(680);
                    setActiveHudSection(tab.id as 'kontrol' | 'grafik' | 'panduan');
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hud-section-pill-chem"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-emerald-600 shadow-xs"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                  <span className="relative z-10 truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {activeHudSection === 'kontrol' && (
              <motion.div
                key="kontrol"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Interactive Live Formula Card */}
                <InteractiveFormulaCard
                  title={chemistryFormulaData.title}
                  subtitle={chemistryFormulaData.subtitle}
                  tokens={chemistryFormulaData.tokens}
                  activeParamKey={hoveredParamKey}
                  accentColor="#10b981"
                />

                {/* Header & Group Sync */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Instrumen Parameter Kimia
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick(740);
                      onSyncWithGroup(
                        `Kimia (${params.mode}): T=${params.initialTempC}°C, pH=${metrics.currentPh}`
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    Sinkron Kelompok
                  </button>
                </div>

                {/* Tactile Sliders by Mode */}
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {params.mode === 'thermo-calorimetry' && (
                    <>
                      <TactileParameterControl
                        label="Suhu Awal Sistem"
                        symbol="T₀"
                        value={params.initialTempC}
                        min={5}
                        max={140}
                        step={5}
                        unit="°C"
                        accentColor="#f59e0b"
                        onHoverChange={(h) => setHoveredParamKey(h ? 'initialTempC' : null)}
                        onChange={(v) => handleParamChange({ initialTempC: v })}
                      />
                      <TactileParameterControl
                        label="Konsentrasi Reaktan"
                        symbol="[M]"
                        value={params.reactantConcentration}
                        min={0.2}
                        max={4.0}
                        step={0.2}
                        unit="mol/L"
                        accentColor="#10b981"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'reactantConcentration' : null)
                        }
                        onChange={(v) => handleParamChange({ reactantConcentration: v })}
                      />
                      <TactileParameterControl
                        label="Volume Larutan Kalorimeter"
                        symbol="V"
                        value={params.solutionVolumeMl}
                        min={50}
                        max={600}
                        step={25}
                        unit="mL"
                        accentColor="#38bdf8"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'solutionVolumeMl' : null)
                        }
                        onChange={(v) => handleParamChange({ solutionVolumeMl: v })}
                      />
                    </>
                  )}

                  {params.mode === 'acid-base-titration' && (
                    <>
                      <TactileParameterControl
                        label="Konsentrasi Analit Asam"
                        symbol="M_a"
                        value={params.analyteAcidConc}
                        min={0.05}
                        max={0.5}
                        step={0.05}
                        unit="M"
                        accentColor="#f43f5e"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'analyteAcidConc' : null)
                        }
                        onChange={(v) => handleParamChange({ analyteAcidConc: v })}
                      />
                      <TactileParameterControl
                        label="Konsentrasi Titran NaOH"
                        symbol="M_b"
                        value={params.titrantBaseConc}
                        min={0.05}
                        max={0.5}
                        step={0.05}
                        unit="M"
                        accentColor="#38bdf8"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'titrantBaseConc' : null)
                        }
                        onChange={(v) => handleParamChange({ titrantBaseConc: v })}
                      />
                      <TactileParameterControl
                        label="Volume NaOH Ditambahkan"
                        symbol="V_b"
                        value={params.titrantAddedMl}
                        min={0}
                        max={50}
                        step={0.5}
                        unit="mL"
                        accentColor="#a855f7"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'titrantAddedMl' : null)
                        }
                        onChange={(v) => {
                          labSound.playTitrationDrop(metrics.currentPh);
                          handleParamChange({ titrantAddedMl: v });
                        }}
                      />
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                        <label
                          htmlFor="titration-indicator-select"
                          className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
                          className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white"
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
                      <TactileParameterControl
                        label="Konsentrasi Ion Anoda"
                        symbol="[Anoda]"
                        value={params.anodeConcM}
                        min={0.01}
                        max={2.0}
                        step={0.05}
                        unit="M"
                        accentColor="#f59e0b"
                        onHoverChange={(h) => setHoveredParamKey(h ? 'anodeConcM' : null)}
                        onChange={(v) => handleParamChange({ anodeConcM: v })}
                      />
                      <TactileParameterControl
                        label="Konsentrasi Ion Katoda"
                        symbol="[Katoda]"
                        value={params.cathodeConcM}
                        min={0.01}
                        max={2.0}
                        step={0.05}
                        unit="M"
                        accentColor="#ec4899"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'cathodeConcM' : null)
                        }
                        onChange={(v) => handleParamChange({ cathodeConcM: v })}
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {activeHudSection === 'grafik' && (
              <motion.div
                key="grafik"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Telemetri Instrumen Kimia
                  </span>
                  <span className="text-[11px] font-mono text-emerald-500">
                    ● {params.mode}
                  </span>
                </div>

                {/* Universal Indicator pH Spectrum Bar */}
                {params.mode === 'acid-base-titration' && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-300">
                        Spektrum Universal pH (0–14)
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        pH = {metrics.currentPh} ({metrics.indicatorColorName})
                      </span>
                    </div>
                    <div className="relative w-full h-3 rounded-full bg-gradient-to-r from-rose-500 via-emerald-500 to-violet-600">
                      <motion.div
                        layout
                        className="absolute -top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-900 shadow-md -translate-x-1/2"
                        style={{ left: `${phProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <AnimatedNumberReadout
                    label={
                      params.mode === 'acid-base-titration'
                        ? 'Derajat Keasaman'
                        : params.mode === 'electrochemistry-cell'
                        ? 'Potensial Standar E°'
                        : 'Entalpi Reaksi ΔH°'
                    }
                    value={
                      params.mode === 'acid-base-titration'
                        ? metrics.currentPh
                        : params.mode === 'electrochemistry-cell'
                        ? metrics.standardCellPotentialE0
                        : metrics.deltaHReaction
                    }
                    unit={
                      params.mode === 'acid-base-titration'
                        ? 'pH'
                        : params.mode === 'electrochemistry-cell'
                        ? 'V'
                        : 'kJ/mol'
                    }
                    accentColor="#10b981"
                  />
                  <AnimatedNumberReadout
                    label={
                      params.mode === 'acid-base-titration'
                        ? 'Volume Ekuivalen'
                        : params.mode === 'electrochemistry-cell'
                        ? 'Potensial Nernst E'
                        : 'Energi Bebas Gibbs ΔG'
                    }
                    value={
                      params.mode === 'acid-base-titration'
                        ? metrics.equivalenceVolumeMl
                        : params.mode === 'electrochemistry-cell'
                        ? metrics.nernstCellPotentialE
                        : metrics.deltaG
                    }
                    unit={
                      params.mode === 'acid-base-titration'
                        ? 'mL'
                        : params.mode === 'electrochemistry-cell'
                        ? 'V'
                        : 'kJ/mol'
                    }
                    accentColor="#38bdf8"
                  />
                  <AnimatedNumberReadout
                    label="Suhu Sistem Larutan"
                    value={
                      params.mode === 'thermo-calorimetry'
                        ? metrics.finalTempC
                        : params.initialTempC
                    }
                    unit="°C"
                    accentColor="#f59e0b"
                  />
                  <AnimatedNumberReadout
                    label={
                      params.mode === 'electrochemistry-cell'
                        ? 'ΔG Redoks'
                        : 'Laju Reaksi Awal r'
                    }
                    value={
                      params.mode === 'electrochemistry-cell'
                        ? metrics.electroFreeEnergyDeltaG
                        : metrics.reactionRate
                    }
                    unit={params.mode === 'electrochemistry-cell' ? 'kJ/mol' : 'M/s'}
                    accentColor="#a855f7"
                  />
                </div>

                {/* Quick Record & Note Box */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div>
                    <label
                      htmlFor="chem-note-input"
                      className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Catatan Analisis Kimia
                    </label>
                    <input
                      id="chem-note-input"
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Contoh: Titik ekuivalen tercapai pada pH 7.00..."
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleRecordChemistry}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Rekam Data Eksperimen ke Tabel Log
                  </motion.button>
                </div>
              </motion.div>
            )}

            {activeHudSection === 'panduan' && (
              <motion.div
                key="panduan"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                <details
                  open
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3 text-xs"
                >
                  <summary className="font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>{conceptCard.heading}</span>
                    <span className="font-mono text-[10px] text-emerald-500">
                      {conceptCard.levelLabel}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{conceptCard.summaryText}</p>
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                      {conceptCard.practicalTip}
                    </p>
                    <div className="mt-2 p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px]">
                      Rumus: {conceptCard.keyEquation}
                    </div>
                  </div>
                </details>

                <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3 text-xs">
                  <summary className="font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>Keselamatan Kerja (K3) & Prosedur Kimia</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </summary>
                  <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                    <p>
                      Pastikan mengenakan jas laboratorium, kacamata pelindung, dan sarung tangan nitril sebelum mereaksikan asam/basa kuat.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreLabModalOpen(true)}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-600/25 transition-colors cursor-pointer"
                    >
                      Buka Modul K3 & Panduan Lengkap
                    </button>
                  </div>
                </details>
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
          if (modalExperiment.id === 'thermo-calorimetry') {
            handleParamChange({ mode: 'thermo-calorimetry' });
          } else if (modalExperiment.id === 'acid-base-titration') {
            handleParamChange({ mode: 'acid-base-titration' });
          } else if (modalExperiment.id === 'redox-electrochemistry') {
            handleParamChange({ mode: 'electrochemistry-cell' });
          }
        }}
      />
    </div>
  );
};
