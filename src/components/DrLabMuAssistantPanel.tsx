import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Camera,
  Mic,
  MicOff,
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
  isEmbedded?: boolean;
  wsConnected?: boolean;
}

interface ConversationTurn {
  id: string;
  timestamp: string;
  studentQuery: string;
  educationLevelLabel: string;
  topic: string;
  rSquared: number;
  response: DrLabMuStructuredResponse;
  snapshotPreviewUrl?: string;
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
  'hukum-pendulum': 'Hukum Bandul Sederhana Harmonis',
  'stokes-viscosity': 'Viskositas Fluida & Hukum Stokes',
  'ohm-wheatstone': 'Hukum Ohm & Jembatan Wheatstone',
  'optics-young-slit': 'Interferensi Celah Ganda Young',
  'photoelectric-planck': 'Efek Fotolistrik & Konstanta Planck',
  'thermo-calorimetry': 'Termokimia & Kalorimetri',
  'acid-base-titration': 'Titrasi Asam-Basa',
  'titrasi-asam-basa': 'Titrasi Asam-Basa',
  'electrochemistry-cell': 'Sel Elektrokimia Galvani',
  'redox-electrochemistry': 'Sel Volta & Elektrokimia',
  'ideal-gas-boyle': 'Hukum Gas Ideal & Kompresi',
  'reaction-kinetics-arrhenius': 'Kinetika Laju Reaksi & Arrhenius',
  'spectrophotometry-beer': 'Spektrofotometri UV-Vis & Beer',
  'photosynthesis-ingenhousz': 'Fotosintesis Ingenhousz',
  'enzyme-catalase': 'Kinetika Enzim Katalase',
  'osmosis-plasmolysis': 'Osmosis & Plasmolisis Sel',
  'mikroskop-sel': 'Mikroskop & Struktur Organel Sel',
  'solar-kepler': 'Hukum Orbit Kepler',
  'hukum-kepler': 'Hukum-Hukum Orbit Kepler',
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
  isEmbedded = false,
  wsConnected,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [internalTab, setInternalTab] = useState<DrawerTabMode>('dr-labmu');
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeakingAnswer, setIsSpeakingAnswer] = useState<boolean>(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
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

    // 1. Try dedicated structured Socratic endpoint with full telemetry first
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
      // fallback to next endpoint
    }

    // 2. Try conversational endpoint if structured endpoint didn't respond
    if (!structuredResult) {
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
          if (data?.structured?.observation) {
            structuredResult = data.structured as DrLabMuStructuredResponse;
          } else if (data?.reply) {
            structuredResult = {
              observation: `Eksplorasi yang sangat baik di laboratorium virtual ${payload.domain} (${payload.educationLevel}).`,
              dataHighlight: data.reply,
              socraticQuestion: 'Bagaimana hipotesis Anda bila parameter simulasi disesuaikan satu langkah lagi?',
              detectedTrigger: 'concept-analogy',
              formattedText: data.reply,
            };
          }
        }
      } catch {
        // fallback to deterministic local engine
      }
    }

    // 3. Guaranteed deterministic local pedagogical engine
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
      const script = `${newTurn.response.observation} ${newTurn.response.dataHighlight} Pertanyaan pemantik reflektif: ${newTurn.response.socraticQuestion}`;
      speakNarration(script, {
        rate: 0.96,
        onStart: () => setIsSpeakingAnswer(true),
        onEnd: () => setIsSpeakingAnswer(false),
        onError: () => setIsSpeakingAnswer(false),
      });
    }
  };

  // Multimodal Gemini Vision 3D Apparatus Diagnostic (Fitur 2)
  const handleVisionDiagnose = async () => {
    labSound.playClick(720);
    setIsLoading(true);

    // 1. Capture active 3D WebGL canvas directly
    let canvasImg = '';
    const webglCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (webglCanvas) {
      try {
        canvasImg = webglCanvas.toDataURL('image/jpeg', 0.85);
      } catch {
        canvasImg = '';
      }
    }

    if (!canvasImg) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 480;
      tempCanvas.height = 270;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 480, 270);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`RuangLABmu 3D Snapshot — ${readableTopic}`, 24, 130);
        canvasImg = tempCanvas.toDataURL('image/jpeg', 0.85);
      }
    }

    const queryText =
      studentQuery.trim() ||
      `Minta Dr. LabMu Periksa Alat: Bagaimana penataan aparatus 3D dan parameter saya pada modul ${readableTopic}?`;

    const payload = buildDrLabMuTelemetry(
      domain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      records,
      queryText,
      biologyContext
    );

    let replyText = '';
    try {
      const res = await fetch('/api/ai/vision-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: canvasImg,
          telemetry: payload,
          studentQuery: queryText,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reply) {
          replyText = String(data.reply);
        }
      }
    } catch {
      // fallback below
    }

    const fallbackStructured = generateSocraticDrLabMuResponse(payload);
    const structuredVision: DrLabMuStructuredResponse = replyText
      ? {
          observation: `Diagnostik Visual 3D Selesai (${payload.domain} — ${readableTopic}). Dr. LabMu telah memeriksa tangkapan layar aparatus laboratorium Anda.`,
          dataHighlight: replyText,
          socraticQuestion: fallbackStructured.socraticQuestion,
          detectedTrigger: 'concept-analogy',
          formattedText: replyText,
        }
      : fallbackStructured;

    const newTurn: ConversationTurn = {
      id: `turn-vision-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      studentQuery: '📷 [Diagnostik Visual 3D] ' + queryText,
      educationLevelLabel: payload.educationLevel,
      topic: readableTopic,
      rSquared: payload.analytics.rSquared,
      response: structuredVision,
      snapshotPreviewUrl: canvasImg,
    };

    setHistoryByDomain((prev) => ({
      ...prev,
      [domainKey]: [newTurn, ...(prev[domainKey] || []).slice(0, 6)],
    }));
    setStudentQuery('');
    setIsLoading(false);
  };

  // Real-time Speech-to-Text Voice Input via Web Speech API (Fitur 2)
  const handleToggleVoiceInput = () => {
    labSound.playClick(620);
    if (isListeningVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningVoice(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setStudentQuery((prev) =>
        prev || 'Dok, bagaimana pengaruh perubahan variabel bebas terhadap kemiringan grafik saya?'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'id-ID';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setStudentQuery(transcript.trim());
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
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

  const panelInner = (
    <>
      {/* Drawer Header & Segmented Tab Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              {activeTab === 'dr-labmu' ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <span>Dr. LabMu</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 font-medium">
                  Mentor Sokratik
                </span>
                {isEmbedded && (
                  <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                    Docked
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {liveTelemetry.domain} · {readableTopic} · {liveTelemetry.educationLevel}
              </div>
            </div>
          </div>

          {!isEmbedded && (
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
          )}
        </div>

        {/* WebSocket Offline Alert Banner */}
        {wsConnected === false && (
          <div
            role="alert"
            className="px-3 py-2 rounded-xl bg-amber-950/70 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-2 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="text-[11px] leading-tight">
              <strong>Lab Sync Terputus (Offline):</strong> Kolaborasi multi-user sedang mencoba menyambung ulang. Mode eksperimen lokal tetap aktif secara penuh.
            </span>
          </div>
        )}

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
                    <div className="rounded-2xl rounded-tl-xs bg-slate-900/90 border border-sky-500/40 p-4 space-y-3.5 shadow-lg animate-pulse">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
                          <span className="text-[11px] font-bold text-sky-300 font-mono">
                            Dr. LabMu sedang menganalisis data...
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                          AI Sokratik Gemini
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-slate-400">1. Memvalidasi Observasi Data Telemetri...</div>
                        <div className="h-2.5 w-4/5 bg-slate-800 rounded-md" />
                        <div className="h-2.5 w-3/5 bg-slate-800 rounded-md" />
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-mono text-indigo-300">2. Menyusun Analogi Konseptual...</div>
                        <div className="h-2.5 w-full bg-slate-800/80 rounded-md" />
                        <div className="h-2.5 w-5/6 bg-slate-800/80 rounded-md" />
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-1.5">
                        <div className="text-[10px] font-mono text-amber-300">3. Merumuskan Pertanyaan Pemantik...</div>
                        <div className="h-2.5 w-3/4 bg-amber-900/40 rounded-md" />
                      </div>
                    </div>
                  )}

                  {activeTurns.map((turn, idx) => (
                    <div key={turn.id} className="space-y-2.5">
                      {/* Student Question Bubble */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-sky-600 text-white px-3.5 py-2.5 shadow-xs space-y-2">
                          <div className="text-[10px] text-sky-200 font-mono mb-0.5">
                            Pertanyaan Siswa · {turn.timestamp}
                          </div>
                          {turn.snapshotPreviewUrl && (
                            <img
                              src={turn.snapshotPreviewUrl}
                              alt="Tangkapan layar kanvas 3D"
                              className="w-full max-h-32 object-cover rounded-lg border border-sky-300/40"
                            />
                          )}
                          <p className="leading-relaxed">{turn.studentQuery}</p>
                        </div>
                      </div>

                      {/* Dr. LabMu Socratic 3-Part Response Card */}
                      <div className="rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-3.5 space-y-3 shadow-xs">
                        {/* Header bar */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                              Dr. LabMu · {turn.topic}
                            </span>
                            {turn.response.detectedTrigger === 'anomaly-outlier' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold">
                                ▲ Deviasi Data
                              </span>
                            )}
                            {turn.response.detectedTrigger === 'direct-answer-refusal' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-semibold">
                                🛡️ Metode Sokratik
                              </span>
                            )}
                          </div>
                          {idx === 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggleSpeakAnswer(turn)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                isSpeakingAnswer
                                  ? 'bg-amber-500 text-slate-950 font-bold'
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

                        {/* 1. Observasi Singkat */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span>1. Observasi Singkat & Apresiasi</span>
                          </div>
                          <p className="leading-relaxed text-slate-800 dark:text-slate-200 text-xs">
                            {turn.response.observation}
                          </p>
                        </div>

                        {/* 2. Insight / Analogi Konseptual */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <span>2. Insight / Analogi Konseptual</span>
                          </div>
                          <div className="leading-relaxed text-slate-800 dark:text-slate-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs whitespace-pre-line">
                            {turn.response.dataHighlight}
                          </div>
                        </div>

                        {/* 3. Pertanyaan Pemantik */}
                        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700/80">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
                            <span>3. Pertanyaan Pemantik Reflektif</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-800 dark:text-sky-200 font-semibold leading-relaxed text-xs">
                            💡 {turn.response.socraticQuestion}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Socratic Prompts & Input Footer */}
                <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 space-y-2.5 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    {/* Domain-Aware Quick Prompts */}
                    {domain === 'Biologi' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (onInjectOutlierDemo) onInjectOutlierDemo();
                            handleAskDrLabMu(
                              'Dok, coba amati saat suhu dinaikkan ke 80°C, mengapa laju reaksi enzim justru menurun drastis?'
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Uji Suhu 80°C Enzim</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAskDrLabMu(
                              `Apa analogi intuitif untuk memahami ${readableTopic} di tingkat ${liveTelemetry.educationLevel}?`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Compass className="w-3 h-3" />
                          <span>Analogi Sel & Enzim</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAskDrLabMu(
                              'Bagaimana struktur membran atau organel sel mempengaruhi kondisi osmosis optimal?'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Faktor Lingkungan Optimal</span>
                        </button>
                      </>
                    ) : domain === 'Kimia' ? (
                      <>
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
                          <span>Beri Analogi Kimia</span>
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
                          <span>Cek Outlier Titrasi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAskDrLabMu(
                              'Bagaimana cara membaca indikator visual warna larutan dan titik ekuivalen pada kurva pH?'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Indikator Warna & pH</span>
                        </button>
                      </>
                    ) : domain === 'Astronomi' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleAskDrLabMu(
                              `Bagaimana analogi Hukum III Kepler dan pergerakan benda langit di tata surya kita?`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Compass className="w-3 h-3" />
                          <span>Analogi Hukum Kepler</span>
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
                          <span>Cek Outlier Orbit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAskDrLabMu(
                              'Bagaimana materi gelap mempengaruhi kurva rotasi galaksi dan gravitasi universal?'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Materi Gelap & Kepler</span>
                        </button>
                      </>
                    ) : (
                      <>
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
                          <span>Beri Analogi Fisika</span>
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
                            handleAskDrLabMu(
                              'Bagaimana hubungan gradien grafik regresi dengan hukum kekekalan pada modul ini?'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Korelasi & Gradien</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Multimodal Vision Snapshot CTA Button (Fitur 2) */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleVisionDiagnose}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Minta Dr. LabMu Periksa Alat (Gemini Vision 3D)</span>
                  </button>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAskDrLabMu();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={handleToggleVoiceInput}
                      title={
                        isListeningVoice
                          ? 'Hentikan rekaman suara'
                          : 'Input Suara Bahasa Indonesia (Web Speech API)'
                      }
                      aria-label="Input Suara Mikrofon"
                      className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                        isListeningVoice
                          ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-400'
                      }`}
                    >
                      {isListeningVoice ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>

                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder={
                        isListeningVoice
                          ? 'Mendengarkan suara Anda...'
                          : 'Tanya Dr. LabMu tentang praktikum ini...'
                      }
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
    </>
  );

  if (isEmbedded) {
    return (
      <aside
        aria-label="Asisten Dr. LabMu & Log Sesi"
        className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-slate-900 dark:text-slate-100 shadow-xl select-text"
      >
        {panelInner}
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 bg-slate-950/60 backdrop-blur-xs z-40"
          />
          <motion.aside
            key="dr-labmu-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Laci Samping Dr. LabMu & Log Sesi"
            className="fixed top-14 right-0 bottom-0 w-full max-w-[440px] z-50 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl select-text"
          >
            {panelInner}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
