import { useState, useMemo, useEffect, useRef } from 'react';
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
  DrLabMuStructuredResponse,
  buildDrLabMuTelemetry,
  generateSocraticDrLabMuResponse,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

export interface ConversationTurn {
  id: string;
  timestamp: string;
  studentQuery: string;
  educationLevelLabel: string;
  topic: string;
  rSquared: number;
  response: DrLabMuStructuredResponse;
  snapshotPreviewUrl?: string;
}

export const READABLE_TOPIC_NAME: Record<string, string> = {
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

export interface UseDrLabMuChatProps {
  domain: ScienceDomain;
  academicLevel: AcademicLevel;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  astronomyParams: AstronomyParams;
  biologyContext?: BiologyTelemetryContext;
  records: ExperimentRecord[];
  externalPromptRequest?: { id: number; prompt: string } | null;
}

export function useDrLabMuChat({
  domain,
  academicLevel,
  physicsParams,
  chemistryParams,
  astronomyParams,
  biologyContext,
  records,
  externalPromptRequest,
}: UseDrLabMuChatProps) {
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeakingAnswer, setIsSpeakingAnswer] = useState<boolean>(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const [historyByDomain, setHistoryByDomain] = useState<Record<string, ConversationTurn[]>>({});

  useEffect(() => {
    const unsub = voiceNarration.subscribe((speaking) => {
      setIsSpeakingAnswer(speaking);
    });
    return () => {
      stopNarration();
      unsub();
    };
  }, []);

  const liveTelemetry = useMemo(
    () =>
      buildDrLabMuTelemetry(
        domain,
        academicLevel,
        physicsParams,
        chemistryParams,
        astronomyParams,
        records,
        'Analisis instan status praktikum 3D',
        biologyContext
      ),
    [
      domain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      records,
      biologyContext,
    ]
  );

  const readableTopic = READABLE_TOPIC_NAME[liveTelemetry.topic] || liveTelemetry.topic;

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
  const activeTurns = domainHistory.length > 0 ? domainHistory : [defaultInitialTurn];

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

    // 1. Try dedicated structured Socratic endpoint
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
      // fallback
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

  const handleVisionDiagnose = async () => {
    labSound.playClick(720);
    setIsLoading(true);

    // Capture active 3D WebGL canvas
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
      // fallback
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

  const handleToggleSpeakAnswer = (turn: ConversationTurn) => {
    if (isSpeakingAnswer) {
      stopNarration();
      setIsSpeakingAnswer(false);
    } else {
      const script = `${turn.response.observation} ${turn.response.dataHighlight} Pertanyaan pemantik: ${turn.response.socraticQuestion}`;
      speakNarration(script, {
        rate: 0.96,
        onStart: () => setIsSpeakingAnswer(true),
        onEnd: () => setIsSpeakingAnswer(false),
        onError: () => setIsSpeakingAnswer(false),
      });
    }
  };

  const handleClearHistory = () => {
    labSound.playClick();
    setHistoryByDomain((prev) => ({
      ...prev,
      [domainKey]: [],
    }));
  };

  // External trigger (e.g. from telemetry anomaly or command palette)
  useEffect(() => {
    if (externalPromptRequest && externalPromptRequest.prompt) {
      handleAskDrLabMu(externalPromptRequest.prompt);
    }
  }, [externalPromptRequest]);

  return {
    studentQuery,
    setStudentQuery,
    isLoading,
    isSpeakingAnswer,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    isListeningVoice,
    activeTurns,
    liveTelemetry,
    readableTopic,
    handleAskDrLabMu,
    handleVisionDiagnose,
    handleToggleVoiceInput,
    handleToggleSpeakAnswer,
    handleClearHistory,
  };
}
