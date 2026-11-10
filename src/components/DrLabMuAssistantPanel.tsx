import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  HelpCircle,
  Compass,
  X,
  MessageCircle,
  Volume2,
  Square,
  Bell,
  Trash2,
} from 'lucide-react';
import {
  speakNarration,
  stopNarration,
  voiceNarration,
} from '../utils/voiceNarrationEngine';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  LabNotification,
  DrLabMuStructuredResponse,
  buildDrLabMuTelemetry,
  generateSocraticDrLabMuResponse,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

export type DrawerTabMode = 'dr-labmu' | 'notifications';

interface DrLabMuAssistantPanelProps {
  domain: ScienceDomain;
  academicLevel: AcademicLevel;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  astronomyParams: AstronomyParams;
  biologyContext?: BiologyTelemetryContext;
  records: ExperimentRecord[];
  notifications?: LabNotification[];
  isOpen?: boolean;
  activeTab?: DrawerTabMode;
  onOpenChange?: (open: boolean) => void;
  onTabChange?: (tab: DrawerTabMode) => void;
  onInjectOutlierDemo?: () => void;
  externalPromptRequest?: { id: number; prompt: string } | null;
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
  notifications = [],
  isOpen: controlledIsOpen,
  activeTab: controlledTab,
  onOpenChange,
  onTabChange,
  onInjectOutlierDemo,
  externalPromptRequest,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [internalTab, setInternalTab] = useState<DrawerTabMode>('dr-labmu');
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeakingAnswer, setIsSpeakingAnswer] = useState<boolean>(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(false);
  const [historyByDomain, setHistoryByDomain] = useState<
    Record<string, ConversationTurn[]>
  >({});

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  const setTab = (next: DrawerTabMode) => {
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  };

  useEffect(() => {
    const unsub = voiceNarration.subscribe((speaking) => {
      setIsSpeakingAnswer(speaking);
    });
    return () => {
      stopNarration();
      unsub();
    };
  }, []);

  const handleToggleSpeakAnswer = (turn: ConversationTurn) => {
    labSound.playClick();
    if (isSpeakingAnswer) {
      stopNarration();
      setIsSpeakingAnswer(false);
      return;
    }

    const script = `${turn.response.observation} ${turn.response.dataHighlight} Pertanyaan sokratik: ${turn.response.socraticQuestion}`;
    speakNarration(script, {
      rate: 0.95,
      onStart: () => setIsSpeakingAnswer(true),
      onEnd: () => setIsSpeakingAnswer(false),
      onError: () => setIsSpeakingAnswer(false),
    });
  };

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
      [domainKey]: [newTurn, ...(prev[domainKey] || []).slice(0, 6)],
    }));
    if (!customQuery) {
      setStudentQuery('');
    }
    setIsLoading(false);

    if (autoSpeakEnabled) {
      const script = `${newTurn.response.observation} ${newTurn.response.dataHighlight} Pertanyaan sokratik: ${newTurn.response.socraticQuestion}`;
      speakNarration(script, {
        rate: 0.96,
        onStart: () => setIsSpeakingAnswer(true),
        onEnd: () => setIsSpeakingAnswer(false),
        onError: () => setIsSpeakingAnswer(false),
      });
    }
  };

  useEffect(() => {
    if (externalPromptRequest && externalPromptRequest.prompt.trim()) {
      setStudentQuery(externalPromptRequest.prompt);
      void handleAskDrLabMu(externalPromptRequest.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPromptRequest?.id]);

  const hasLowR2Alert =
    liveTelemetry.analytics.rSquared < 0.85 &&
    liveTelemetry.recordedData.length >= 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 bg-slate-950/60 backdrop-blur-xs z-40"
          />

          {/* Slide-Over Right Drawer */}
          <motion.aside
            key="dr-labmu-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Laci Samping Dr. LabMu & Log Sesi"
            className="fixed top-14 right-0 bottom-0 w-full max-w-[420px] z-50 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl select-text"
          >
            {/* Drawer Header & Segmented Tab Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    {activeTab === 'dr-labmu' ? (
                      <MessageCircle className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {activeTab === 'dr-labmu'
                        ? 'Dr. LabMu · Mentor Sokratik'
                        : 'Pusat Notifikasi & Umpan Balik'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {liveTelemetry.domain} · {readableTopic} · {liveTelemetry.educationLevel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setOpen(false);
                  }}
                  aria-label="Tutup laci samping"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2-Tab Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl border border-slate-300/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setTab('dr-labmu');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'dr-labmu'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Mentor Dr. LabMu</span>
                  {hasLowR2Alert && (
                    <span className="text-[10px] font-mono text-amber-500 font-bold">▲</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setTab('notifications');
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'notifications'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Log & Umpan Balik ({notifications.length})</span>
                </button>
              </div>
            </div>

            {/* TAB 1: MENTOR SOKRATIK DR. LABMU */}
            {activeTab === 'dr-labmu' && (
              <>
                {/* Telemetry Status Bar */}
                <div className="px-4 py-2 bg-slate-100/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
                  <span>
                    Data: <strong className="font-mono text-slate-900 dark:text-white">{records.length}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    R²:{' '}
                    <strong
                      className={`font-mono ${
                        hasLowR2Alert
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {liveTelemetry.analytics.rSquared.toFixed(3)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      const next = !autoSpeakEnabled;
                      setAutoSpeakEnabled(next);
                      if (!next) stopNarration();
                    }}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                      autoSpeakEnabled
                        ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                    title="Bacakan balasan Dr. LabMu secara otomatis dengan asisten suara"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{autoSpeakEnabled ? 'Auto-Suara: ON' : 'Auto-Suara'}</span>
                  </button>
                  {domainHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setHistoryByDomain((prev) => ({ ...prev, [domainKey]: [] }));
                      }}
                      className="text-slate-400 hover:text-rose-500 flex items-center gap-1 cursor-pointer"
                      title="Bersihkan riwayat diskusi modul ini"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Conversational Thread */}
                <div
                  data-testid="dr-labmu-latest-response"
                  className="flex-1 overflow-y-auto p-4 space-y-4 text-xs"
                >
                  {isLoading && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs animate-pulse">
                      <Sparkles className="w-4 h-4 animate-spin text-sky-500" />
                      <span>Dr. LabMu sedang menganalisis telemetri eksperimen Anda...</span>
                    </div>
                  )}

                  {activeTurns.map((turn, idx) => (
                    <div key={turn.id} className="space-y-2.5">
                      {/* Student Question Bubble */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-sky-600 text-white px-3.5 py-2.5 shadow-xs">
                          <div className="text-[10px] text-sky-200 font-mono mb-0.5">
                            Pertanyaan Siswa · {turn.timestamp}
                          </div>
                          <p className="leading-relaxed">{turn.studentQuery}</p>
                        </div>
                      </div>

                      {/* Dr. LabMu Socratic Response Card */}
                      <div className="rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                          <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                            Dr. LabMu · {turn.topic}
                          </span>
                          {idx === 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggleSpeakAnswer(turn)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                isSpeakingAnswer
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {isSpeakingAnswer ? (
                                <>
                                  <Square className="w-3 h-3 fill-current" />
                                  <span>Hentikan Suara</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                                  <span>Bacakan</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                          {turn.response.observation}
                        </p>

                        <p className="leading-relaxed text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 font-mono text-[11px]">
                          {turn.response.dataHighlight}
                        </p>

                        <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/80 text-sky-700 dark:text-sky-300 font-semibold leading-relaxed">
                          Pertanyaan Sokratik: {turn.response.socraticQuestion}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Socratic Prompts & Input Footer */}
                <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 space-y-2.5 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleAskDrLabMu(
                          `Saya bingung memahami konsep ${readableTopic} ini Dok, ada analogi yang mudah?`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Beri Analogi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onInjectOutlierDemo) onInjectOutlierDemo();
                        handleAskDrLabMu(
                          'Kenapa ada titik data pada grafik regresi saya yang melenceng dan membuat R² turun?'
                        );
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Cek Outlier Grafik</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAskDrLabMu('Bagaimana langkah menentukan kesimpulan dari data ini Dok?')
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Panduan Kesimpulan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAskDrLabMu(
                          `Bagaimana strategi mengatur parameter ${readableTopic} agar misi tantangan tercapai dengan presisi R² tinggi?`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Strategi Tantangan</span>
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAskDrLabMu();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Tanya Dr. LabMu tentang praktikum ini..."
                      aria-label="Tulis pertanyaan ke Dr. LabMu"
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !studentQuery.trim()}
                      aria-label="Kirim pertanyaan"
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Tanya</span>
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* TAB 2: PUSAT NOTIFIKASI & LOG SESI */}
            {activeTab === 'notifications' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Belum ada log aktivitas atau notifikasi pada sesi ini.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {n.domain}
                        </span>
                        <span className="font-mono">{n.timestamp}</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {n.title}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {n.message}
                      </p>
                      {n.formulaHint && (
                        <div className="pt-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                          Rumus: {n.formulaHint}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
