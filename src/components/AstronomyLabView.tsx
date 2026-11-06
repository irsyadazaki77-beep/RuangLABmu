import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  BookmarkPlus,
  Share2,
  Sparkles,
  Orbit,
  Compass,
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
  AstronomyParams,
  AstronomyMode,
  AcademicLevel,
  SOLAR_PLANET_PRESETS,
  GUIDED_LAB_SCENARIOS,
  calculateAstronomyMetrics,
  generateAutomaticFeedback,
  getConceptCardContent,
  LabNotification,
} from '../utils/scienceEngine';
import { AstronomyScene3D } from './AstronomyScene3D';
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
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';

interface AstronomyLabViewProps {
  params: AstronomyParams;
  onChangeParams: React.Dispatch<React.SetStateAction<AstronomyParams>>;
  academicLevel?: AcademicLevel;
  onRecordExperiment: (
    title: string,
    summary: string,
    keyMetrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup: (summary: string) => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
}

const STAR_FIELD_POINTS = Array.from({ length: 85 }, (_, i) => ({
  xFrac: ((i * 73 + 19) % 100) / 100,
  yFrac: ((i * 41 + 37) % 100) / 100,
  size: (i % 3) * 0.6 + 0.8,
  alpha: 0.25 + ((i * 17) % 65) / 100,
}));

export const AstronomyLabView: React.FC<AstronomyLabViewProps> = ({
  params,
  onChangeParams,
  academicLevel = 'sma',
  onRecordExperiment,
  onPushNotification,
  onSyncWithGroup,
  remoteCursors,
  onEmitCursor,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const [noteInput, setNoteInput] = useState<string>('');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [activeHudSection, setActiveHudSection] = useState<
    'kontrol' | 'grafik' | 'panduan'
  >('kontrol');
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [recordToastCount, setRecordToastCount] = useState<number>(0);

  const astronomyModules = getExperimentsByDomain('astronomi');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(astronomyModules[0]);
  const activeTier: EducationTier =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'Mahasiswa' : 'SMA';

  const currentAstronomyModuleId =
    params.mode === 'solar-kepler'
      ? 'solar-kepler'
      : params.mode === 'milkyway-galaxy'
      ? 'milky-way-rotation'
      : 'exoplanet-transit';

  // Side-by-Side A/B Experiment Comparison State
  const [baselineParams, setBaselineParams] =
    useState<AstronomyParams | null>(null);
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

  const metrics = calculateAstronomyMetrics(params);
  const baselineMetrics = baselineParams
    ? calculateAstronomyMetrics(baselineParams)
    : null;

  const conceptCard = getConceptCardContent(
    'Astronomi',
    params.mode,
    academicLevel
  );
  const astronomyScenarios = GUIDED_LAB_SCENARIOS.filter(
    (s) => s.domain === 'Astronomi'
  );
  const activePlanet =
    SOLAR_PLANET_PRESETS.find((p) => p.id === params.selectedPlanetId) ||
    SOLAR_PLANET_PRESETS[2];

  useEffect(() => {
    if (!isRunning) return;
    let animId: number;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      setSimTime((prev) => prev + dt * (params.timeScaleSpeed || 1));
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, params.timeScaleSpeed]);

  // Direct Canvas Pointer Manipulation Handler (2D Mode)
  const applyAstronomyCanvasDrag = (clientX: number, clientY: number) => {
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

    if (params.mode === 'solar-kepler') {
      const cx = width * 0.44;
      const cy = height * 0.52;
      const distPx = Math.hypot(x - cx, y - cy);
      const nextA = Math.min(
        30.0,
        Math.max(
          0.3,
          Number(Math.pow(10, (distPx - 48) / 95 - 0.1).toFixed(2))
        )
      );
      const nextE = Math.min(
        0.85,
        Math.max(0, Number((Math.abs(x - cx) / 260).toFixed(2)))
      );
      onChangeParams((prev) => ({
        ...prev,
        customSemiMajorAxisAu: nextA,
        customEccentricity: nextE,
      }));
      setDragHintText(`Seret Orbit: a = ${nextA} AU · e = ${nextE}`);
    } else if (params.mode === 'milkyway-galaxy') {
      let nextR = params.galactocentricRadiusKpc;
      if (x < 360) {
        const galCx = 195;
        const galCy = height * 0.54;
        const rPx = Math.hypot(x - galCx, y - galCy);
        nextR = Math.min(25, Math.max(1.0, Number(((rPx / 142) * 25).toFixed(1))));
      } else {
        const plotX = 395;
        const plotW = width - plotX - 26;
        nextR = Math.min(
          25,
          Math.max(1.0, Number((((x - plotX) / plotW) * 25).toFixed(1)))
        );
      }
      onChangeParams((prev) => ({
        ...prev,
        galactocentricRadiusKpc: nextR,
      }));
      setDragHintText(`Seret Radius Galaksi: R = ${nextR} kpc`);
    } else {
      if (x < 365) {
        const hrX = 48;
        const hrW = 300;
        const xFrac = Math.min(1, Math.max(0, (x - hrX) / hrW));
        const logT =
          Math.log10(30000) -
          xFrac * (Math.log10(30000) - Math.log10(2800));
        const nextTeff = Math.min(
          28000,
          Math.max(2800, Math.round(Math.pow(10, logT) / 100) * 100)
        );
        onChangeParams((prev) => ({
          ...prev,
          starEffectiveTempK: nextTeff,
        }));
        setDragHintText(`Seret Diagram H-R: T_eff = ${nextTeff} K`);
      } else {
        const trY = 76;
        const trH = height - trY - 42;
        const nextRp = Math.min(
          15.0,
          Math.max(
            0.5,
            Number((((y - trY) / Math.max(1, trH)) * 15.0).toFixed(1))
          )
        );
        onChangeParams((prev) => ({
          ...prev,
          exoplanetRadiusEarth: nextRp,
        }));
        setDragHintText(`Seret Transit Eksoplanet: Rp = ${nextRp} R⊕`);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep space observatory background (#090D16)
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // Subtle background starfield
    STAR_FIELD_POINTS.forEach((st) => {
      ctx.fillStyle = `rgba(226, 232, 240, ${st.alpha})`;
      ctx.beginPath();
      ctx.arc(st.xFrac * width, st.yFrac * height, st.size, 0, Math.PI * 2);
      ctx.fill();
    });

    if (params.mode === 'solar-kepler') {
      const cx = width * 0.44;
      const cy = height * 0.52;
      const a = Math.max(0.2, params.customSemiMajorAxisAu);
      const e = Math.max(0, Math.min(0.88, params.customEccentricity));

      const rx = Math.min(185, Math.max(68, 48 + Math.log10(a + 0.7) * 95));
      const ry = rx * Math.sqrt(Math.max(0.08, 1 - e * e));
      const focalShift = rx * e;
      const sunX = cx + focalShift;
      const sunY = cy;

      // Draw Scenario A Ghost Orbit if baseline active
      if (baselineParams && baselineParams.mode === 'solar-kepler') {
        const bA = Math.max(0.2, baselineParams.customSemiMajorAxisAu);
        const bE = Math.max(0, Math.min(0.88, baselineParams.customEccentricity));
        const bRx = Math.min(185, Math.max(68, 48 + Math.log10(bA + 0.7) * 95));
        const bRy = bRx * Math.sqrt(Math.max(0.08, 1 - bE * bE));
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, bRx, bRy, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Background reference planetary rings
      SOLAR_PLANET_PRESETS.slice(0, 8).forEach((pl) => {
        const refR = Math.min(
          195,
          Math.max(36, 48 + Math.log10(pl.semiMajorAxisAu + 0.7) * 95)
        );
        ctx.strokeStyle =
          pl.id === params.selectedPlanetId
            ? 'rgba(56, 189, 248, 0.35)'
            : 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sunX, sunY, refR, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw active Keplerian Ellipse
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.lineTo(cx + rx, cy);
      ctx.stroke();

      if (params.showKeplerAreaSweep) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        for (let ang = -0.42; ang <= 0.42; ang += 0.06) {
          ctx.lineTo(cx + rx * Math.cos(ang), cy + ry * Math.sin(ang));
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.20)';
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        for (let ang = Math.PI - 0.18; ang <= Math.PI + 0.18; ang += 0.04) {
          ctx.lineTo(cx + rx * Math.cos(ang), cy + ry * Math.sin(ang));
        }
        ctx.closePath();
        ctx.fill();
      }

      const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 24);
      sunGrad.addColorStop(0, '#FFFBEB');
      sunGrad.addColorStop(0.45, '#FACC15');
      sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FDE047';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Matahari (${params.centralStarMassSolar.toFixed(1)} M☉)`,
        sunX - 48,
        sunY + 32
      );

      const angularRate = 1.35 / Math.max(0.35, Math.pow(a, 0.55));
      const meanAnomaly = simTime * angularRate;
      const eccentricAnomaly = meanAnomaly + e * Math.sin(meanAnomaly);
      const px = cx + rx * Math.cos(eccentricAnomaly);
      const py = cy - ry * Math.sin(eccentricAnomaly);

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(px, py);
      ctx.stroke();

      const vxDir = -rx * Math.sin(eccentricAnomaly);
      const vyDir = -ry * Math.cos(eccentricAnomaly);
      const vNorm = Math.max(1, Math.hypot(vxDir, vyDir));
      const speedScale = 28 * (1 + 0.45 * e * Math.cos(eccentricAnomaly));
      const vEndX = px + (vxDir / vNorm) * speedScale;
      const vEndY = py + (vyDir / vNorm) * speedScale;

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(vEndX, vEndY);
      ctx.stroke();

      if (activePlanet.hasRings) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(px, py, 16, 6, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = activePlanet.colorHex;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(activePlanet.name, px + 12, py - 10);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Aphelion (${metrics.aphelionAu} AU)`,
        Math.max(14, cx - rx - 20),
        cy - 12
      );
      ctx.fillText(
        `Perihelion (${metrics.perihelionAu} AU)`,
        Math.min(width - 150, cx + rx - 30),
        cy - 12
      );
    } else if (params.mode === 'milkyway-galaxy') {
      const galCx = 195;
      const galCy = height * 0.54;
      const maxGalRadiusPx = 142;

      if (params.darkMatterHaloFraction > 0.05) {
        const dmGrad = ctx.createRadialGradient(
          galCx,
          galCy,
          20,
          galCx,
          galCy,
          maxGalRadiusPx + 22
        );
        dmGrad.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
        dmGrad.addColorStop(
          0.7,
          `rgba(99, 102, 241, ${Math.min(
            0.28,
            params.darkMatterHaloFraction * 0.18
          )})`
        );
        dmGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = dmGrad;
        ctx.beginPath();
        ctx.arc(galCx, galCy, maxGalRadiusPx + 22, 0, Math.PI * 2);
        ctx.fill();
      }

      const rotAngle = simTime * 0.22;
      const numArms = 4;
      for (let arm = 0; arm < numArms; arm++) {
        const armOffset = (arm * Math.PI * 2) / numArms;
        for (let step = 0; step < 58; step++) {
          const frac = step / 58;
          const rPx = 18 + frac * (maxGalRadiusPx - 18);
          const theta = armOffset + frac * 3.6 - rotAngle;
          const sx = galCx + rPx * Math.cos(theta);
          const sy = galCy + rPx * Math.sin(theta);

          ctx.fillStyle =
            arm % 2 === 0
              ? `rgba(125, 211, 252, ${0.72 - frac * 0.45})`
              : `rgba(196, 181, 253, ${0.65 - frac * 0.4})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 2.2 - frac * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.translate(galCx, galCy);
      ctx.rotate(-rotAngle * 0.6 + 0.4);
      const bulgeGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
      bulgeGrad.addColorStop(0, '#FEF08A');
      bulgeGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.65)');
      bulgeGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = bulgeGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(galCx, galCy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const solarOrbitPx = (8.2 / 25) * maxGalRadiusPx;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(galCx, galCy, solarOrbitPx, 0, Math.PI * 2);
      ctx.stroke();

      const activeRPx =
        (Math.min(25, Math.max(0.5, params.galactocentricRadiusKpc)) / 25) *
        maxGalRadiusPx;
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(galCx, galCy, activeRPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const starOrbAng =
        -simTime * (metrics.observedDarkMatterVelocityKms / 180);
      const testStarX = galCx + activeRPx * Math.cos(starOrbAng);
      const testStarY = galCy + activeRPx * Math.sin(starOrbAng);
      ctx.fillStyle = '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(testStarX, testStarY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('Inti Sgr A*', galCx - 28, galCy + 18);
      ctx.fillStyle = '#10B981';
      ctx.fillText(
        `R = ${params.galactocentricRadiusKpc} kpc`,
        testStarX + 8,
        testStarY - 6
      );

      const plotX = 395;
      const plotY = 76;
      const plotW = width - plotX - 26;
      const plotH = height - plotY - 46;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(plotX - 14, plotY - 20, plotW + 26, plotH + 46, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(plotX, plotY);
      ctx.lineTo(plotX, plotY + plotH);
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('KURVA ROTASI GALAKSI v(R) [km/s]', plotX + 6, plotY - 5);

      const toPlotX = (rVal: number) => plotX + (rVal / 25) * plotW;
      const toPlotY = (vVal: number) =>
        plotY + plotH - (Math.min(300, vVal) / 300) * plotH;

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let r = 0.5; r <= 25; r += 0.5) {
        const ptM = calculateAstronomyMetrics({
          ...params,
          galactocentricRadiusKpc: r,
        });
        const sx = toPlotX(r);
        const sy = toPlotY(ptM.keplerianVelocityKms);
        if (r === 0.5) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let r = 0.5; r <= 25; r += 0.5) {
        const ptM = calculateAstronomyMetrics({
          ...params,
          galactocentricRadiusKpc: r,
        });
        const sx = toPlotX(r);
        const sy = toPlotY(ptM.observedDarkMatterVelocityKms);
        if (r === 0.5) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      const curX = toPlotX(params.galactocentricRadiusKpc);
      const curYObs = toPlotY(metrics.observedDarkMatterVelocityKms);
      const curYKep = toPlotY(metrics.keplerianVelocityKms);

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(curX, curYObs, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(curX, curYKep, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38BDF8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('━ Observasi + Halo Materi Gelap', plotX + 10, plotY + 18);
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(
        '┅ Ekspektasi Keplerian (Materi Tampak)',
        plotX + 10,
        plotY + 34
      );
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(
        'Jarak Inti Galaksi R (0 → 25 kpc)',
        plotX + 55,
        plotY + plotH + 18
      );
    } else {
      const hrX = 48;
      const hrY = 76;
      const hrW = 300;
      const hrH = height - hrY - 42;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(hrX - 18, hrY - 18, hrW + 30, hrH + 42, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hrX + 20, hrY + 22);
      ctx.quadraticCurveTo(
        hrX + hrW * 0.52,
        hrY + hrH * 0.55,
        hrX + hrW - 18,
        hrY + hrH - 18
      );
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText('Deret Utama (Main Sequence)', hrX + 45, hrY + hrH * 0.52);
      ctx.fillStyle = '#FCA5A5';
      ctx.fillText('Raksasa Merah', hrX + hrW - 95, hrY + 58);
      ctx.fillStyle = '#BAE6FD';
      ctx.fillText('Katai Putih', hrX + 32, hrY + hrH - 22);

      const tClamped = Math.min(30000, Math.max(2800, params.starEffectiveTempK));
      const xFrac =
        (Math.log10(30000) - Math.log10(tClamped)) /
        (Math.log10(30000) - Math.log10(2800));
      const logL = Math.min(
        5,
        Math.max(-3, Math.log10(Math.max(0.001, metrics.stellarLuminositySolar)))
      );
      const yFrac = 1 - (logL + 3) / 8;

      const starHrX = hrX + 14 + xFrac * (hrW - 28);
      const starHrY = hrY + 14 + yFrac * (hrH - 28);

      ctx.fillStyle = metrics.starColorHex;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(starHrX, starHrY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('DIAGRAM H-R (KELAS SPEKTRAL O–M)', hrX - 4, hrY - 5);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(
        '30,000 K (O)  ← Suhu Efektif →  2,800 K (M)',
        hrX + 16,
        hrY + hrH + 16
      );

      const trX = 395;
      const trY = 76;
      const trW = width - trX - 24;
      const trH = height - trY - 42;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(trX - 10, trY - 18, trW + 20, trH + 42, 8);
      ctx.fill();
      ctx.stroke();

      const diskCx = trX + trW / 2;
      const diskCy = trY + 58;
      const starDiskR = 36;

      ctx.fillStyle = metrics.starColorHex;
      ctx.beginPath();
      ctx.arc(diskCx, diskCy, starDiskR, 0, Math.PI * 2);
      ctx.fill();

      const phase = ((simTime * 0.45) % 2) - 1;
      const planetPxX = diskCx + phase * (trW * 0.42);
      const planetDiskR = Math.min(
        18,
        Math.max(
          3.5,
          (params.exoplanetRadiusEarth / (109.1 * params.starRadiusSolar)) *
            starDiskR *
            8
        )
      );

      ctx.fillStyle = '#090D16';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(planetPxX, diskCy, planetDiskR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const lcTop = trY + 122;
      const lcH = trH - 132;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = (i / 60) * 2 - 1;
        const sx = trX + 10 + (i / 60) * (trW - 20);
        const inTransit = Math.abs(u) < 0.34;
        const dipFactor = inTransit
          ? Math.cos((u / 0.34) * (Math.PI / 2))
          : 0;
        const dropPx =
          Math.min(lcH * 0.72, Math.max(10, metrics.transitDepthPct * 22)) *
          dipFactor;
        const sy = lcTop + 14 + dropPx;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('KURVA CAHAYA TRANSIT EKSOPLANET', trX + 6, trY - 3);
      ctx.fillStyle = '#10B981';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `ΔF/F = -${metrics.transitDepthPct}% (${metrics.transitDepthPpm} ppm)`,
        trX + 14,
        lcTop + lcH + 8
      );
    }
  }, [params, metrics, activePlanet, simTime, baselineParams]);

  const handleModeSwitch = (mode: AstronomyMode) => {
    labSound.playClick();
    const updated: AstronomyParams = { ...params, mode };
    onChangeParams(updated);
    onPushNotification(
      generateAutomaticFeedback('Astronomi', undefined, undefined, updated)
    );
  };

  const handleSelectPlanetPreset = (planetId: string) => {
    labSound.playClick();
    const preset =
      SOLAR_PLANET_PRESETS.find((p) => p.id === planetId) ||
      SOLAR_PLANET_PRESETS[2];
    const updated: AstronomyParams = {
      ...params,
      selectedPlanetId: preset.id,
      customSemiMajorAxisAu: preset.semiMajorAxisAu,
      customEccentricity: preset.eccentricity,
    };
    onChangeParams(updated);
    onPushNotification(
      generateAutomaticFeedback('Astronomi', undefined, undefined, updated)
    );
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
    setShutterFlash(true);
    setRecordToastCount((c) => c + 1);
    setTimeout(() => setShutterFlash(false), 220);

    const title =
      params.mode === 'solar-kepler'
        ? `Orbit Hukum Kepler — ${activePlanet.name} (a = ${params.customSemiMajorAxisAu} AU)`
        : params.mode === 'milkyway-galaxy'
        ? `Kurva Rotasi Galaksi Bima Sakti (R = ${params.galactocentricRadiusKpc} kpc)`
        : `Diagram H-R Bintang Kelas ${metrics.spectralClass} & Transit Eksoplanet`;

    const summary =
      params.mode === 'solar-kepler'
        ? `Planet=${activePlanet.name}, a=${params.customSemiMajorAxisAu} AU, e=${params.customEccentricity}, M*=${params.centralStarMassSolar} M☉`
        : params.mode === 'milkyway-galaxy'
        ? `R=${params.galactocentricRadiusKpc} kpc, Fraksi DM=${params.darkMatterHaloFraction}, Sgr A*=${params.sgrAStarMassMillionSolar}×10⁶ M☉`
        : `T_eff=${params.starEffectiveTempK} K, R*=${params.starRadiusSolar} R☉, Rp=${params.exoplanetRadiusEarth} R⊕, d=${params.exoplanetOrbitAu} AU`;

    const keyMetrics: Record<string, number | string> =
      params.mode === 'solar-kepler'
        ? {
            'Periode T': `${metrics.orbitalPeriodYears} tahun`,
            'v Orbit Rata-rata': `${metrics.meanOrbitalVelocityKms} km/s`,
            'Rasio T²/a³': `${metrics.keplerRatioT2OverA3}`,
          }
        : params.mode === 'milkyway-galaxy'
        ? {
            'v Observasi (DM)': `${metrics.observedDarkMatterVelocityKms} km/s`,
            'v Keplerian': `${metrics.keplerianVelocityKms} km/s`,
            'Massa M(<R)': `${metrics.enclosedMassBillionSolar}×10⁹ M☉`,
          }
        : {
            'Luminositas L': `${metrics.stellarLuminositySolar} L☉`,
            'Kedalaman Transit': `${metrics.transitDepthPct}% (${metrics.transitDepthPpm} ppm)`,
            'Status Orbit': metrics.isInHabitableZone
              ? 'Zona Laik Huni'
              : 'Luar Zona Laik Huni',
          };

    const numericCoords =
      params.mode === 'solar-kepler'
        ? {
            x: Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(2)),
            y1: Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(2)),
            y2: metrics.meanOrbitalVelocityKms,
          }
        : params.mode === 'milkyway-galaxy'
        ? {
            x: params.galactocentricRadiusKpc,
            y1: metrics.observedDarkMatterVelocityKms,
            y2: metrics.keplerianVelocityKms,
          }
        : {
            x: params.exoplanetRadiusEarth,
            y1: metrics.transitDepthPct,
            y2: metrics.stellarLuminositySolar,
          };

    onRecordExperiment(
      title,
      summary,
      keyMetrics,
      noteInput.trim() ||
        'Pengamatan astronomi tercatat untuk evaluasi regresi dan LKS.',
      numericCoords
    );
    setNoteInput('');
  };

  const handleApplyGuidedScenario = (
    scenario: (typeof astronomyScenarios)[number]
  ) => {
    labSound.playClick(660);
    setActiveScenarioId(scenario.id);
    const updated: AstronomyParams = {
      ...params,
      ...(scenario.astronomyPatch || {}),
    };
    onChangeParams(updated);
    setSimTime(0);
    setIsRunning(true);
    onPushNotification(
      generateAutomaticFeedback('Astronomi', undefined, undefined, updated)
    );
  };

  // Interactive Live Formula Tokens for Astronomy
  const astronomyFormulaData: {
    title: string;
    subtitle: string;
    tokens: FormulaToken[];
  } = (() => {
    if (params.mode === 'milkyway-galaxy') {
      return {
        title: 'Kecepatan Rotasi Galaksi & Halo Materi Gelap',
        subtitle: `Anomali Kecepatan Δv = +${metrics.velocityAnomalyKms} km/s pada R = ${params.galactocentricRadiusKpc} kpc`,
        tokens: [
          {
            symbol: 'v_obs',
            value: metrics.observedDarkMatterVelocityKms,
            unit: 'km/s',
            color: '#818cf8',
          },
          { symbol: '=' },
          { symbol: '√[G·(' },
          {
            symbol: 'M_SgrA*',
            paramKey: 'sgrAStarMassMillionSolar',
            value: params.sgrAStarMassMillionSolar,
            min: 1.0,
            max: 15.0,
            unit: '×10⁶ M☉',
            color: '#f59e0b',
          },
          { symbol: '+' },
          {
            symbol: 'M_DM',
            paramKey: 'darkMatterHaloFraction',
            value: params.darkMatterHaloFraction,
            min: 0.0,
            max: 1.5,
            unit: '×Halo',
            color: '#38bdf8',
          },
          { symbol: ') /' },
          {
            symbol: 'R',
            paramKey: 'galactocentricRadiusKpc',
            value: params.galactocentricRadiusKpc,
            min: 1.0,
            max: 25.0,
            unit: 'kpc',
            color: '#10b981',
          },
          { symbol: ']' },
        ],
      };
    }
    if (params.mode === 'stellar-exoplanet') {
      return {
        title: 'Hukum Stefan-Boltzmann & Kedalaman Transit Eksoplanet',
        subtitle: `Kelas Spektral ${metrics.spectralClass} · ΔF/F = -${metrics.transitDepthPct}% (${metrics.transitDepthPpm} ppm)`,
        tokens: [
          {
            symbol: 'ΔF/F',
            value: metrics.transitDepthPct,
            unit: '%',
            color: '#818cf8',
          },
          { symbol: '=' },
          { symbol: '(' },
          {
            symbol: 'R_p',
            paramKey: 'exoplanetRadiusEarth',
            value: params.exoplanetRadiusEarth,
            min: 0.5,
            max: 15.0,
            unit: 'R⊕',
            color: '#10b981',
          },
          { symbol: '/' },
          {
            symbol: 'R*',
            paramKey: 'starRadiusSolar',
            value: params.starRadiusSolar,
            min: 0.2,
            max: 8.0,
            unit: 'R☉',
            color: '#f59e0b',
          },
          { symbol: ')²' },
          { symbol: '·' },
          {
            symbol: 'T_eff',
            paramKey: 'starEffectiveTempK',
            value: params.starEffectiveTempK,
            min: 2800,
            max: 28000,
            unit: 'K',
            color: '#38bdf8',
          },
        ],
      };
    }
    return {
      title: 'Hukum III Kepler & Dinamika Orbit Elips',
      subtitle: `${activePlanet.name} · Perihelion ${metrics.perihelionAu} AU · Aphelion ${metrics.aphelionAu} AU`,
      tokens: [
        {
          symbol: 'T²',
          value: Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(2)),
          unit: 'thn²',
          color: '#818cf8',
        },
        { symbol: '=' },
        {
          symbol: 'a³',
          paramKey: 'customSemiMajorAxisAu',
          value: Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(2)),
          min: 0.02,
          max: 32768,
          unit: 'AU³',
          color: '#38bdf8',
        },
        { symbol: '/' },
        {
          symbol: 'M*',
          paramKey: 'centralStarMassSolar',
          value: params.centralStarMassSolar,
          min: 0.2,
          max: 4.0,
          unit: 'M☉',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: '(1−e²)',
          paramKey: 'customEccentricity',
          value: params.customEccentricity,
          min: 0,
          max: 0.85,
          unit: 'e',
          color: '#10b981',
        },
      ],
    };
  })();

  return (
    <div className="space-y-5">
      {/* Universal Experiment Catalog Picker */}
      <ExperimentCatalogPicker
        domain="astronomi"
        currentExperimentId={currentAstronomyModuleId}
        activeTier={activeTier}
        onSelectExperiment={(exp) => {
          if (exp.id === 'solar-kepler') {
            onChangeParams((p) => ({ ...p, mode: 'solar-kepler' }));
          } else if (exp.id === 'milky-way-rotation') {
            onChangeParams((p) => ({ ...p, mode: 'milkyway-galaxy' }));
          } else if (exp.id === 'exoplanet-transit') {
            onChangeParams((p) => ({ ...p, mode: 'stellar-exoplanet' }));
          } else if (exp.id === 'stellar-wien-spectrum') {
            onChangeParams((p) => ({ ...p, mode: 'stellar-exoplanet' }));
          } else if (exp.id === 'hubble-expansion') {
            onChangeParams((p) => ({ ...p, mode: 'milkyway-galaxy' }));
          }
        }}
        onOpenPreLabModal={(exp) => {
          setModalExperiment(exp);
          setPreLabModalOpen(true);
        }}
      />

      {/* Guided Experiment Scenarios Strip */}
      <div className="bg-white/90 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Misi Eksperimen Terbimbing (1-Klik Preset Observatorium)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Klik skenario untuk menguji Hukum Kepler, Halo Materi Gelap, atau Transit Eksoplanet
            </span>
            <button
              type="button"
              onClick={handleTogglePinBaseline}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {astronomyScenarios.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleApplyGuidedScenario(sc)}
                className={`text-left p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-400 dark:border-sky-500/70'
                    : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-sky-700 dark:text-sky-400 font-semibold">
                  <span>{sc.badgeText}</span>
                  <span>Terapkan →</span>
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                  {sc.title}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-snug">
                  {sc.objective}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Astronomy Comparison Drawer (A/B Mode) */}
      {showComparisonPanel && (
        <div className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-amber-300/80 dark:border-amber-500/40 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Mode Perbandingan Astrofisika Berdampingan (Skenario A Baseline vs Skenario B Aktif)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const earthBase: AstronomyParams = {
                    ...params,
                    mode: 'solar-kepler',
                    selectedPlanetId: 'earth',
                    customSemiMajorAxisAu: 1.0,
                    customEccentricity: 0.017,
                  };
                  setBaselineParams(earthBase);
                  onChangeParams({
                    ...earthBase,
                    selectedPlanetId: 'jupiter',
                    customSemiMajorAxisAu: 5.2,
                    customEccentricity: 0.049,
                  });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Bumi (1.0 AU) vs Jupiter (5.2 AU)
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playSnapshotPin();
                  const noDm: AstronomyParams = {
                    ...params,
                    mode: 'milkyway-galaxy',
                    galactocentricRadiusKpc: 15.0,
                    darkMatterHaloFraction: 0.0,
                  };
                  setBaselineParams(noDm);
                  onChangeParams({
                    ...noDm,
                    darkMatterHaloFraction: 1.0,
                  });
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Preset A/B: Tanpa Materi Gelap vs Halo DM Aktif
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
                aria-label="Tutup panel perbandingan astronomi"
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
                  a={baselineParams.customSemiMajorAxisAu} AU · R={baselineParams.galactocentricRadiusKpc} kpc
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>T = {baselineMetrics.orbitalPeriodYears} thn</span>
                  <span>v_orb = {baselineMetrics.meanOrbitalVelocityKms} km/s</span>
                  <span>v_DM = {baselineMetrics.observedDarkMatterVelocityKms} km/s</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-800/70 space-y-1">
                <div className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-semibold">
                  SKENARIO B (EKSPERIMEN AKTIF)
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-mono">
                  a={params.customSemiMajorAxisAu} AU · R={params.galactocentricRadiusKpc} kpc
                </div>
                <div className="pt-1 flex items-center justify-between font-mono text-slate-900 dark:text-white font-semibold tabular-nums">
                  <span>T = {metrics.orbitalPeriodYears} thn</span>
                  <span>v_orb = {metrics.meanOrbitalVelocityKms} km/s</span>
                  <span>v_DM = {metrics.observedDarkMatterVelocityKms} km/s</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 space-y-1">
                <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  SELISIH KOMPARASI (Δ = B − A)
                </div>
                <div className="font-mono text-slate-700 dark:text-slate-200 space-y-0.5 tabular-nums">
                  <div>
                    Δ Periode Orbit T:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.orbitalPeriodYears - baselineMetrics.orbitalPeriodYears) >= 0 ? '+' : ''}
                      {(metrics.orbitalPeriodYears - baselineMetrics.orbitalPeriodYears).toFixed(2)} tahun
                    </strong>
                  </div>
                  <div>
                    Δ Laju Orbit:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.meanOrbitalVelocityKms - baselineMetrics.meanOrbitalVelocityKms) >= 0 ? '+' : ''}
                      {(metrics.meanOrbitalVelocityKms - baselineMetrics.meanOrbitalVelocityKms).toFixed(2)} km/s
                    </strong>
                  </div>
                  <div>
                    Δ Rotasi Galaksi:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {(metrics.observedDarkMatterVelocityKms - baselineMetrics.observedDarkMatterVelocityKms) >= 0 ? '+' : ''}
                      {(metrics.observedDarkMatterVelocityKms - baselineMetrics.observedDarkMatterVelocityKms).toFixed(1)} km/s
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SPATIAL HUD COCKPIT WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* HERO 3D OBSERVATORY STAGE (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Mode Bar Above Stage */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg">
              <button
                type="button"
                onClick={() => handleModeSwitch('solar-kepler')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  params.mode === 'solar-kepler'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tata Surya & Hukum Kepler
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('milkyway-galaxy')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  params.mode === 'milkyway-galaxy'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Galaksi Bima Sakti & Sgr A*
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('stellar-exoplanet')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  params.mode === 'stellar-exoplanet'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Diagram H-R & Eksoplanet
              </button>
            </div>

            {params.mode === 'solar-kepler' && (
              <div className="flex flex-wrap items-center gap-1">
                {SOLAR_PLANET_PRESETS.slice(0, 6).map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSelectPlanetPreset(pl.id)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      params.selectedPlanetId === pl.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pl.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative min-h-[560px] rounded-2xl overflow-hidden border border-indigo-500/40 bg-[#090D16] shadow-[0_0_50px_-12px_rgba(99,102,241,0.35)] flex flex-col justify-between">
            {/* Camera Shutter Flash on Record */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-indigo-300/60 via-white/80 to-sky-300/60"
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
                  className="pointer-events-none absolute bottom-20 right-5 z-30 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/95 text-white font-mono text-xs font-bold shadow-[0_0_25px_rgba(99,102,241,0.75)] border border-indigo-300"
                >
                  <Camera className="w-4 h-4" />
                  <span>+1 Data Astronomi Tercatat!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TOP-LEFT FLOATING HUD: Observatory Pill + Tier Badge */}
            <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 max-w-[62%]">
              <div className="lab-glass-panel bg-slate-950/85 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isRunning ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isRunning ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
                    {isRunning ? 'OBSERVATORIUM AKTIF · 60 FPS' : 'ORBIT DIJEDA'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono text-[10px] font-bold">
                    {activeTier}
                  </span>
                </div>
                <div className="font-mono font-bold text-white text-xs mt-1 truncate">
                  {params.mode === 'solar-kepler'
                    ? `Tata Surya Kepler · ${activePlanet.name}`
                    : params.mode === 'milkyway-galaxy'
                    ? `Galaksi Bima Sakti · Sgr A* (${params.sgrAStarMassMillionSolar}×10⁶ M☉)`
                    : `Astrofisika Bintang · Kelas Spektral ${metrics.spectralClass}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setIs3DMode((m) => !m);
                }}
                className="lab-glass-panel bg-slate-900/85 hover:bg-slate-800 border border-indigo-500/40 text-indigo-300 font-mono text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
              >
                <Box className="w-3.5 h-3.5 text-indigo-400" />
                {is3DMode ? '3D WebGL' : '2D Diagram'}
              </button>
            </div>

            {/* TOP-RIGHT FLOATING HUD: Tactile Circular Gauges */}
            <div className="pointer-events-none absolute top-3.5 right-3.5 z-20 hidden sm:flex items-start gap-2">
              {params.mode === 'solar-kepler' && (
                <>
                  <CircularGaugeMeter
                    size="sm"
                    label="Kecepatan Orbit"
                    value={metrics.meanOrbitalVelocityKms}
                    min={0}
                    max={55}
                    unit="km/s"
                    color="#818cf8"
                  />
                  <CircularGaugeMeter
                    size="sm"
                    label="Periode Orbit T"
                    value={metrics.orbitalPeriodYears}
                    min={0}
                    max={170}
                    unit="tahun"
                    color="#38bdf8"
                  />
                </>
              )}
              {params.mode === 'milkyway-galaxy' && (
                <>
                  <CircularGaugeMeter
                    size="sm"
                    label="Rotasi v_obs (DM)"
                    value={metrics.observedDarkMatterVelocityKms}
                    min={0}
                    max={300}
                    unit="km/s"
                    color="#818cf8"
                  />
                  <CircularGaugeMeter
                    size="sm"
                    label="Anomali DM Δv"
                    value={metrics.velocityAnomalyKms}
                    min={0}
                    max={180}
                    unit="km/s"
                    color="#10b981"
                  />
                </>
              )}
              {params.mode === 'stellar-exoplanet' && (
                <>
                  <CircularGaugeMeter
                    size="sm"
                    label="Kedalaman Transit"
                    value={metrics.transitDepthPct}
                    min={0}
                    max={5}
                    unit="%"
                    color="#818cf8"
                  />
                  <CircularGaugeMeter
                    size="sm"
                    label="Suhu Bintang T*"
                    value={params.starEffectiveTempK}
                    min={2800}
                    max={28000}
                    unit="K"
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
                      ? `Kursor (${cursorCoords.x}, ${cursorCoords.y}) · Seret Orbit/Bintang`
                      : 'Klik & Seret Orbit/Diagram di Kanvas 2D')}
                </span>
              </div>
            )}

            {/* MAIN 3D / 2D VIEWPORT */}
            <div className="flex-1 flex flex-col justify-center">
              {is3DMode ? (
                <AstronomyScene3D
                  params={params}
                  metrics={metrics}
                  activePlanet={activePlanet}
                  simTime={simTime}
                  remoteCursors={remoteCursors}
                  onEmitCursor={onEmitCursor}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  data-testid="astronomy-simulation-canvas"
                  width={740}
                  height={480}
                  onPointerDown={(e) => {
                    setIsDraggingCanvas(true);
                    labSound.playClick(540);
                    applyAstronomyCanvasDrag(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) =>
                    applyAstronomyCanvasDrag(e.clientX, e.clientY)
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
            <div className="relative z-20 bg-slate-950/95 backdrop-blur-md border-t border-indigo-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    labSound.playClick(700);
                    setIsRunning((r) => !r);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-[0_0_16px_rgba(99,102,241,0.45)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Jeda Orbit
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Jalankan Orbit
                    </>
                  )}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    labSound.playClick(460);
                    setSimTime(0);
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </motion.button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Kecepatan Waktu:
                </span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                  {[0.5, 1.0, 2.0].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        onChangeParams((prev) => ({
                          ...prev,
                          timeScaleSpeed: spd,
                        }));
                      }}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded-md transition-colors cursor-pointer ${
                        (params.timeScaleSpeed || 1.0) === spd
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRecordClick}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
                      layoutId="hud-section-pill-astro"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-indigo-600 shadow-xs"
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
                  title={astronomyFormulaData.title}
                  subtitle={astronomyFormulaData.subtitle}
                  tokens={astronomyFormulaData.tokens}
                  activeParamKey={hoveredParamKey}
                  accentColor="#818cf8"
                />

                {/* Header & Group Sync */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Orbit className="w-3.5 h-3.5 text-indigo-500" />
                    Instrumen Parameter Astrofisika
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick(740);
                      onSyncWithGroup(
                        `Astronomi (${params.mode}): ${
                          params.mode === 'solar-kepler'
                            ? `${activePlanet.name} a=${params.customSemiMajorAxisAu} AU`
                            : params.mode === 'milkyway-galaxy'
                            ? `Bima Sakti R=${params.galactocentricRadiusKpc} kpc`
                            : `Bintang Kelas ${metrics.spectralClass}`
                        }`
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/60 dark:border-indigo-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    Sinkronkan
                  </button>
                </div>

                {/* Tactile Sliders by Mode */}
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {params.mode === 'solar-kepler' && (
                    <>
                      <TactileParameterControl
                        label="Sumbu Semi-Mayor Orbit"
                        symbol="a"
                        value={params.customSemiMajorAxisAu}
                        min={0.3}
                        max={32.0}
                        step={0.1}
                        unit="AU"
                        accentColor="#38bdf8"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'customSemiMajorAxisAu' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, customSemiMajorAxisAu: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Eksentrisitas Elips Orbit"
                        symbol="e"
                        value={params.customEccentricity}
                        min={0.0}
                        max={0.85}
                        step={0.01}
                        unit=""
                        accentColor="#10b981"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'customEccentricity' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, customEccentricity: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Massa Bintang Pusat"
                        symbol="M*"
                        value={params.centralStarMassSolar}
                        min={0.2}
                        max={4.0}
                        step={0.1}
                        unit="M☉"
                        accentColor="#f59e0b"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'centralStarMassSolar' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, centralStarMassSolar: v }))
                        }
                      />
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                        <label
                          htmlFor="kepler-sweep-toggle"
                          className="text-xs font-medium text-slate-700 dark:text-slate-200"
                        >
                          Sapuan Juring Hukum II Kepler (ΔA/Δt)
                        </label>
                        <input
                          id="kepler-sweep-toggle"
                          type="checkbox"
                          checked={params.showKeplerAreaSweep}
                          onChange={(e) => {
                            labSound.playClick();
                            onChangeParams((p) => ({
                              ...p,
                              showKeplerAreaSweep: e.target.checked,
                            }));
                          }}
                          className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </div>
                    </>
                  )}

                  {params.mode === 'milkyway-galaxy' && (
                    <>
                      <TactileParameterControl
                        label="Jarak dari Inti Galaksi Bima Sakti"
                        symbol="R"
                        value={params.galactocentricRadiusKpc}
                        min={1.0}
                        max={25.0}
                        step={0.2}
                        unit="kpc"
                        accentColor="#10b981"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'galactocentricRadiusKpc' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, galactocentricRadiusKpc: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Fraksi Kerapatan Halo Materi Gelap"
                        symbol="M_DM"
                        value={params.darkMatterHaloFraction}
                        min={0.0}
                        max={1.5}
                        step={0.05}
                        unit="x"
                        accentColor="#38bdf8"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'darkMatterHaloFraction' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, darkMatterHaloFraction: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Massa Lubang Hitam Sgr A*"
                        symbol="SgrA*"
                        value={params.sgrAStarMassMillionSolar}
                        min={1.0}
                        max={15.0}
                        step={0.15}
                        unit="×10⁶ M☉"
                        accentColor="#f59e0b"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'sgrAStarMassMillionSolar' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, sgrAStarMassMillionSolar: v }))
                        }
                      />
                    </>
                  )}

                  {params.mode === 'stellar-exoplanet' && (
                    <>
                      <TactileParameterControl
                        label="Suhu Efektif Permukaan Bintang"
                        symbol="T_eff"
                        value={params.starEffectiveTempK}
                        min={2800}
                        max={28000}
                        step={100}
                        unit="K"
                        accentColor="#38bdf8"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'starEffectiveTempK' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, starEffectiveTempK: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Jari-Jari Bintang Induk"
                        symbol="R*"
                        value={params.starRadiusSolar}
                        min={0.2}
                        max={8.0}
                        step={0.1}
                        unit="R☉"
                        accentColor="#f59e0b"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'starRadiusSolar' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, starRadiusSolar: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Jari-Jari Eksoplanet Transit"
                        symbol="R_p"
                        value={params.exoplanetRadiusEarth}
                        min={0.5}
                        max={15.0}
                        step={0.5}
                        unit="R⊕"
                        accentColor="#10b981"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'exoplanetRadiusEarth' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, exoplanetRadiusEarth: v }))
                        }
                      />
                      <TactileParameterControl
                        label="Jarak Orbit Eksoplanet"
                        symbol="d"
                        value={params.exoplanetOrbitAu}
                        min={0.1}
                        max={4.5}
                        step={0.05}
                        unit="AU"
                        accentColor="#a855f7"
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? 'exoplanetOrbitAu' : null)
                        }
                        onChange={(v) =>
                          onChangeParams((p) => ({ ...p, exoplanetOrbitAu: v }))
                        }
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
                    Telemetri Observatorium
                  </span>
                  <span className="text-[11px] font-mono text-indigo-400">
                    ● {params.mode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {params.mode === 'solar-kepler' && (
                    <>
                      <AnimatedNumberReadout
                        label="Periode Orbit (T)"
                        value={metrics.orbitalPeriodYears}
                        unit="tahun"
                        accentColor="#818cf8"
                      />
                      <AnimatedNumberReadout
                        label="Kecepatan Orbit"
                        value={metrics.meanOrbitalVelocityKms}
                        unit="km/s"
                        accentColor="#38bdf8"
                      />
                      <AnimatedNumberReadout
                        label="Jarak Perihelion"
                        value={metrics.perihelionAu}
                        unit="AU"
                        accentColor="#10b981"
                      />
                      <AnimatedNumberReadout
                        label="Jarak Aphelion"
                        value={metrics.aphelionAu}
                        unit="AU"
                        accentColor="#f59e0b"
                      />
                    </>
                  )}

                  {params.mode === 'milkyway-galaxy' && (
                    <>
                      <AnimatedNumberReadout
                        label="Kecepatan Rotasi v_obs"
                        value={metrics.observedDarkMatterVelocityKms}
                        unit="km/s"
                        accentColor="#818cf8"
                      />
                      <AnimatedNumberReadout
                        label="Anomali Materi Gelap"
                        value={metrics.velocityAnomalyKms}
                        unit="km/s"
                        accentColor="#10b981"
                      />
                      <AnimatedNumberReadout
                        label="Periode Galaktik T_gal"
                        value={metrics.galacticOrbitalPeriodMyr}
                        unit="Myr"
                        accentColor="#38bdf8"
                      />
                      <AnimatedNumberReadout
                        label="Massa M(<R)"
                        value={metrics.enclosedMassBillionSolar}
                        unit="×10⁹ M☉"
                        accentColor="#f59e0b"
                      />
                    </>
                  )}

                  {params.mode === 'stellar-exoplanet' && (
                    <>
                      <AnimatedNumberReadout
                        label="Luminositas Bintang"
                        value={metrics.stellarLuminositySolar}
                        unit="L☉"
                        accentColor="#f59e0b"
                      />
                      <AnimatedNumberReadout
                        label="Kedalaman Transit"
                        value={metrics.transitDepthPct}
                        unit="%"
                        accentColor="#10b981"
                      />
                      <AnimatedNumberReadout
                        label="HZ Dalam (Inner)"
                        value={metrics.habitableZoneInnerAu}
                        unit="AU"
                        accentColor="#38bdf8"
                      />
                      <AnimatedNumberReadout
                        label="Umur Deret Utama"
                        value={metrics.mainSequenceLifetimeGyr}
                        unit="Gyr"
                        accentColor="#818cf8"
                      />
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div>
                    <label
                      htmlFor="astro-note-input"
                      className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Catatan Pengamatan Astronomi
                    </label>
                    <input
                      id="astro-note-input"
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Contoh: Rasio T²/a³ konstan bernilai 1.00..."
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleRecordClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-xl transition-colors cursor-pointer"
                  >
                    <BookmarkPlus className="w-4 h-4" />
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
                    <span className="font-mono text-[10px] text-indigo-400">
                      {activeTier}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{conceptCard.summaryText}</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {conceptCard.practicalTip}
                    </p>
                    <div className="mt-2 p-2 rounded-lg bg-slate-900 text-indigo-300 font-mono text-[11px]">
                      Rumus: {conceptCard.keyEquation}
                    </div>
                  </div>
                </details>

                <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3 text-xs">
                  <summary className="font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>Kalibrasi Instrumen & Panduan Observatorium</span>
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  </summary>
                  <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                    <p>
                      Gunakan filter spektral dan kalibrasi fotometri sebelum merekam kurva cahaya transit eksoplanet atau kecepatan rotasi galaksi.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreLabModalOpen(true)}
                      className="w-full py-1.5 px-3 rounded-lg bg-indigo-600/15 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-600/25 transition-colors cursor-pointer"
                    >
                      Buka Panduan Observatorium Lengkap
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
          if (modalExperiment.id === 'solar-kepler') {
            onChangeParams((p) => ({ ...p, mode: 'solar-kepler' }));
          } else if (modalExperiment.id === 'milky-way-rotation') {
            onChangeParams((p) => ({ ...p, mode: 'milkyway-galaxy' }));
          } else if (modalExperiment.id === 'exoplanet-transit') {
            onChangeParams((p) => ({ ...p, mode: 'stellar-exoplanet' }));
          }
        }}
      />
    </div>
  );
};
