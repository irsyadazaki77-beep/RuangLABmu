import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  HelpCircle,
  Compass,
  X,
  MessageCircle,
} from 'lucide-react';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  DrLabMuStructuredResponse,
  buildDrLabMuTelemetry,
  generateSocraticDrLabMuResponse,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

interface DrLabMuAssistantPanelProps {
  domain: ScienceDomain;
  academicLevel: AcademicLevel;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  astronomyParams: AstronomyParams;
  biologyContext?: BiologyTelemetryContext;
  records: ExperimentRecord[];
  onInjectOutlierDemo?: () => void;
}

interface ConversationTurn {
  id: string;
  timestamp: string;
  studentQuery: string;
  educationLevelLabel: string;
  topic: string;
  rSquared: number;
  response: DrLabMuStructuredResponse;
}

const READABLE_TOPIC_NAME: Record<string, string> = {
  'newton-incline': 'Hukum II Newton & Bidang Miring',
  'projectile-gravity': 'Gerak Parabola & Gravitasi',
  'projectile-motion': 'Gerak Parabola (Projektil)',
  'collision-momentum': 'Tumbukan & Momentum',
  'spring-hooke': 'Osilasi Pegas Hooke',
  'orbital-gravity': 'Gravitasi Dua Massa',
  'gravity-orbital': 'Gravitasi Universal & Orbit',
  'pendulum-harmonic': 'Bandul Sederhana Harmonis',
  'stokes-viscosity': 'Viskositas Fluida & Hukum Stokes',
  'ohm-wheatstone': 'Hukum Ohm & Jembatan Wheatstone',
  'optics-young-slit': 'Interferensi Celah Ganda Young',
  'photoelectric-planck': 'Efek Fotolistrik & Konstanta Planck',
  'thermo-calorimetry': 'Termokimia & Kalorimetri',
  'acid-base-titration': 'Titrasi Asam-Basa',
  'electrochemistry-cell': 'Sel Elektrokimia Galvani',
  'redox-electrochemistry': 'Sel Volta & Elektrokimia',
  'ideal-gas-boyle': 'Hukum Gas Ideal & Kompresi',
  'reaction-kinetics-arrhenius': 'Kinetika Laju Reaksi & Arrhenius',
  'spectrophotometry-beer': 'Spektrofotometri UV-Vis & Beer',
  'photosynthesis-ingenhousz': 'Fotosintesis Ingenhousz',
  'enzyme-catalase': 'Kinetika Enzim Katalase',
  'osmosis-plasmolysis': 'Osmosis & Plasmolisis Sel',
  'solar-kepler': 'Hukum Orbit Kepler',
  'milkyway-galaxy': 'Rotasi Galaksi Bima Sakti',
  'milky-way-rotation': 'Rotasi Galaksi & Materi Gelap',
  'stellar-exoplanet': 'Spektrum Bintang & Transit',
  'exoplanet-transit': 'Kurva Transit Eksoplanet',
  'stellar-wien-spectrum': 'Hukum Wien & Spektroskopi',
  'hubble-expansion': 'Ekspansi Hubble & Redshift',
};

export const DrLabMuAssistantPanel: React.FC<DrLabMuAssistantPanelProps> = ({
  domain,
  academicLevel,
  physicsParams,
  chemistryParams,
  astronomyParams,
  biologyContext,
  records,
  onInjectOutlierDemo,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [historyByDomain, setHistoryByDomain] = useState<
    Record<string, ConversationTurn[]>
  >({});

  const liveTelemetry = useMemo(
    () =>
      buildDrLabMuTelemetry(
        domain,
        academicLevel,
        physicsParams,
        chemistryParams,
        astronomyParams,
        records,
        studentQuery ||
          'Bagaimana pola hubungan variabel pada eksperimen yang sedang saya jalankan?',
        biologyContext
      ),
    [
      domain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      records,
      studentQuery,
      biologyContext,
    ]
  );

  const readableTopic =
    READABLE_TOPIC_NAME[liveTelemetry.topic] || liveTelemetry.topic;

  const defaultInitialTurn = useMemo<ConversationTurn>(() => {
    const initialResponse = generateSocraticDrLabMuResponse(liveTelemetry);
    return {
      id: `init-dr-labmu-${domain}-${liveTelemetry.topic}`,
      timestamp: 'Aktif',
      studentQuery:
        liveTelemetry.analytics.rSquared < 0.85 &&
        liveTelemetry.recordedData.length >= 3
          ? 'Dok, kenapa titik data di grafik regresi saya melenceng?'
          : `Bimbing saya memahami eksperimen ${readableTopic} (${liveTelemetry.educationLevel}).`,
      educationLevelLabel: liveTelemetry.educationLevel,
      topic: readableTopic,
      rSquared: liveTelemetry.analytics.rSquared,
      response: initialResponse,
    };
  }, [liveTelemetry, domain, readableTopic]);

  const domainKey = `${domain}:${liveTelemetry.topic}`;
  const domainHistory = historyByDomain[domainKey] || [];
  const activeTurns =
    domainHistory.length > 0 ? domainHistory : [defaultInitialTurn];
  const latestTurn = activeTurns[0];

  const handleAskDrLabMu = async (customQuery?: string) => {
    const queryToUse = (customQuery ?? studentQuery).trim();
    if (!queryToUse) return;
    labSound.playClick();
    setIsLoading(true);

    const payload = buildDrLabMuTelemetry(
      domain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      records,
      queryToUse,
      biologyContext
    );

    let structuredResult: DrLabMuStructuredResponse | null = null;

    // Try free-chat AI endpoint first
    try {
      const res = await fetch('/api/ai/dr-labmu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryToUse,
          history: domainHistory.slice(0, 4).map((turn) => ({
            role: 'model',
            text: turn.response.observation + ' ' + turn.response.socraticQuestion,
          })),
          telemetry: payload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.reply) {
          structuredResult = {
            observation: data.reply,
            dataHighlight: `Instrumen ${readableTopic} (${payload.educationLevel}): Nilai R² saat ini ${payload.analytics.rSquared}.`,
            socraticQuestion: 'Bagaimana hasil amatan Anda bila parameter diubah sedikit lagi?',
            detectedTrigger: 'concept-analogy',
            formattedText: `💡 ${data.reply}\n\n🔍 Sorotan: Nilai R² = ${payload.analytics.rSquared}`,
          };
        }
      }
    } catch {
      // fallback
    }

    // Try structured endpoint if free-chat failed
    if (!structuredResult) {
      try {
        const res = await fetch('/api/dr-labmu/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telemetry: payload }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.response?.observation && data?.response?.socraticQuestion) {
            structuredResult = data.response as DrLabMuStructuredResponse;
          }
        }
      } catch {
        // Fallback to local Socratic engine
      }
    }

    if (!structuredResult) {
      structuredResult = generateSocraticDrLabMuResponse(payload);
    }

    const newTurn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      studentQuery: queryToUse,
      educationLevelLabel: payload.educationLevel,
      topic: READABLE_TOPIC_NAME[payload.topic] || payload.topic,
      rSquared: payload.analytics.rSquared,
      response: structuredResult,
    };

    setHistoryByDomain((prev) => ({
      ...prev,
      [domainKey]: [newTurn, ...(prev[domainKey] || []).slice(0, 4)],
    }));
    if (!customQuery) {
      setStudentQuery('');
    }
    setIsLoading(false);
  };

  const hasLowR2Alert =
    liveTelemetry.analytics.rSquared < 0.85 &&
    liveTelemetry.recordedData.length >= 3;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="dr-labmu-popover"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="Asisten Sokratik Dr. LabMu"
            className="pointer-events-auto mb-3 w-80 sm:w-96 max-h-[420px] flex flex-col backdrop-blur-xl bg-slate-900/90 border border-white/15 text-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Compact Popover Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Dr. LabMu · Mentor Sokratik
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {liveTelemetry.domain} · {readableTopic} ·{' '}
                    {liveTelemetry.educationLevel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setIsOpen(false);
                }}
                aria-label="Tutup diskusi Dr. LabMu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conversational Chat Bubbles Area */}
            <div
              data-testid="dr-labmu-latest-response"
              className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 text-xs"
            >
              {/* Student Question Bubble */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-sky-600/90 text-white px-3 py-2 shadow-sm">
                  <p className="leading-relaxed">{latestTurn.studentQuery}</p>
                </div>
              </div>

              {/* Dr. LabMu Conversational Bubbles */}
              <div className="space-y-2">
                <div className="rounded-2xl rounded-tl-sm bg-slate-800/90 border border-white/10 px-3.5 py-2.5 text-slate-100 space-y-2 shadow-sm">
                  <p className="leading-relaxed text-slate-200">
                    {latestTurn.response.observation}
                  </p>
                  <p className="leading-relaxed text-amber-200/95">
                    {latestTurn.response.dataHighlight}
                  </p>
                  <div className="pt-1.5 border-t border-white/10 text-sky-300 font-medium leading-relaxed">
                    💡 {latestTurn.response.socraticQuestion}
                  </div>
                </div>

                {isLoading && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tl-sm bg-slate-800/90 border border-sky-500/30 text-sky-300 text-[11px] animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Dr. LabMu sedang menganalisis instrumen lab Anda...</span>
                  </div>
                )}
              </div>

              {/* Quick Socratic Prompts */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleAskDrLabMu(
                      `Saya bingung memahami konsep ${readableTopic} ini Dok, ada analogi yang mudah?`
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Compass className="w-3 h-3" />
                  Beri Analogi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onInjectOutlierDemo) onInjectOutlierDemo();
                    handleAskDrLabMu(
                      'Kenapa ada titik data pada grafik regresi saya yang melenceng dan membuat R² turun?'
                    );
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Cek Outlier Grafik
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAskDrLabMu(
                      'Berapa nilai hasil akhirnya langsung Dok?'
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  Tanya Jawaban
                </button>
              </div>
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskDrLabMu();
              }}
              className="p-2.5 border-t border-white/10 bg-slate-950/70 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Tanya Dr. LabMu tentang praktikum ini..."
                aria-label="Tulis pertanyaan ke Dr. LabMu"
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-white/15 text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={isLoading || !studentQuery.trim()}
                aria-label="Kirim pertanyaan"
                className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streamlined Single-Line Floating AI Mentor Pill Button */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick(720);
          setIsOpen((prev) => !prev);
        }}
        className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-white shadow-xl cursor-pointer transition-colors"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-white shrink-0">
          <MessageCircle className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-bold whitespace-nowrap">
          Dr. LabMu
        </span>
        <span className="text-[11px] font-medium whitespace-nowrap text-slate-300 hidden sm:inline">
          {hasLowR2Alert ? (
            <span className="text-amber-300 font-mono">· ▲ Cek Anomali R²</span>
          ) : (
            <span>· Mentor Praktikum</span>
          )}
        </span>
      </button>
    </div>
  );
};
