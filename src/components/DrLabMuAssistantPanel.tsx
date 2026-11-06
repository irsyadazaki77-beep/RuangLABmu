import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Code2,
  AlertTriangle,
  HelpCircle,
  Compass,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
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

export const DrLabMuAssistantPanel: React.FC<DrLabMuAssistantPanelProps> = ({
  domain,
  academicLevel,
  physicsParams,
  chemistryParams,
  astronomyParams,
  records,
  onInjectOutlierDemo,
}) => {
  const [studentQuery, setStudentQuery] = useState<string>('');
  const [showTelemetryJson, setShowTelemetryJson] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
          'Bagaimana pola hubungan variabel pada eksperimen yang sedang saya jalankan?'
      ),
    [
      domain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      records,
      studentQuery,
    ]
  );

  // Initial welcome response from Dr. LabMu based on current telemetry
  const defaultInitialTurn = useMemo<ConversationTurn>(() => {
    const initialResponse = generateSocraticDrLabMuResponse(liveTelemetry);
    return {
      id: 'init-dr-labmu',
      timestamp: 'Sesi Aktif',
      studentQuery:
        liveTelemetry.analytics.rSquared < 0.85 &&
        liveTelemetry.recordedData.length >= 3
          ? 'Dok, kenapa titik data di grafik regresi saya melenceng (R² rendah)?'
          : `Bimbing saya menganalisis modul ${liveTelemetry.topic} untuk jenjang ${liveTelemetry.educationLevel}.`,
      educationLevelLabel: liveTelemetry.educationLevel,
      topic: liveTelemetry.topic,
      rSquared: liveTelemetry.analytics.rSquared,
      response: initialResponse,
    };
  }, [liveTelemetry]);

  const [history, setHistory] = useState<ConversationTurn[]>([]);

  const activeTurns = history.length > 0 ? history : [defaultInitialTurn];

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
      queryToUse
    );

    let structuredResult: DrLabMuStructuredResponse | null = null;

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
      // Fallback to deterministic Socratic engine if offline or key not set
    }

    if (!structuredResult) {
      structuredResult = generateSocraticDrLabMuResponse(payload);
    }

    const newTurn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      studentQuery: queryToUse,
      educationLevelLabel: payload.educationLevel,
      topic: payload.topic,
      rSquared: payload.analytics.rSquared,
      response: structuredResult,
    };

    setHistory((prev) => [newTurn, ...prev.slice(0, 5)]);
    if (!customQuery) {
      setStudentQuery('');
    }
    setIsLoading(false);
  };

  return (
    <section
      aria-label="Asisten Instruktur Sokratik Dr. LabMu"
      className="bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-sky-200/90 dark:border-sky-900/70 rounded-xl p-5 shadow-xs space-y-4"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Dr. LabMu — Asisten Instruktur Laboratorium Sokratik
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                RuangLABmu · Metode Sokratik
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Jenjang: {liveTelemetry.educationLevel}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border ${
                  liveTelemetry.analytics.rSquared < 0.85 &&
                  liveTelemetry.recordedData.length >= 3
                    ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Telemetri: {liveTelemetry.domain} ({liveTelemetry.topic}) · R² ={' '}
                {liveTelemetry.analytics.rSquared}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Dr. LabMu membaca telemetri meja lab 3D, tabel percobaan, dan regresi R² Anda secara real-time untuk memandu penemuan konsep tanpa membocorkan jawaban instan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowTelemetryJson((v) => !v);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            {showTelemetryJson ? 'Sembunyikan Telemetri JSON' : 'Inspeksi Telemetri JSON'}
          </button>
        </div>
      </div>

      {/* Collapsible Live JSON Telemetry Context Viewer */}
      {showTelemetryJson && (
        <div className="bg-slate-950 text-slate-100 rounded-lg p-3.5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-sky-400">
            <span>
              EXPERIMENTAL TELEMETRY CONTEXT (JSON PAYLOAD KE DR. LABMU)
            </span>
            <span>
              {liveTelemetry.recordedData.length} titik data · slope ={' '}
              {liveTelemetry.analytics.slope}
            </span>
          </div>
          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
            {JSON.stringify(liveTelemetry, null, 2)}
          </pre>
        </div>
      )}

      {/* Quick Pedagogical Scenario Triggers (Outlier R² < 0.85, Stuck Analogy, Direct Answer Refusal) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
          Uji Respons Sokratik:
        </span>
        <button
          type="button"
          onClick={() =>
            handleAskDrLabMu('Berapa nilai g-nya bro? Kasih tahu angka pastinya langsung!')
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Tanya Jawaban Langsung (&ldquo;Berapa nilai g-nya bro?&rdquo;)
        </button>

        <button
          type="button"
          onClick={() =>
            handleAskDrLabMu(
              `Saya bingung memahami konsep di modul ${liveTelemetry.topic} ini Dok, ada analogi yang mudah?`
            )
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 transition-colors"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Saya Bingung / Stuck (Analogi {liveTelemetry.educationLevel})
        </button>

        <button
          type="button"
          onClick={() => {
            if (onInjectOutlierDemo) {
              onInjectOutlierDemo();
            }
            handleAskDrLabMu(
              'Kenapa pada percobaan ke-3 saat sudut diubah ke 85° jarak tempuhnya merosot drastis dan R² turun di bawah 0.85?'
            );
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Evaluasi Anomali Outlier (R² &lt; 0.85)
        </button>
      </div>

      {/* Latest Structured 3-Part Socratic Guidance Card */}
      <div className="space-y-3">
        {activeTurns.slice(0, 2).map((turn, idx) => (
          <div
            key={turn.id}
            data-testid={idx === 0 ? 'dr-labmu-latest-response' : undefined}
            className={`rounded-xl border p-4 space-y-3 ${
              idx === 0
                ? 'bg-slate-50/90 dark:bg-slate-800/70 border-sky-200 dark:border-sky-800/80'
                : 'bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-85'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200/70 dark:border-slate-700/70 pb-2">
              <div className="font-medium text-slate-700 dark:text-slate-300">
                <span className="font-mono text-slate-500 dark:text-slate-400 mr-1.5">
                  [{turn.timestamp}] Pertanyaan Siswa:
                </span>
                &ldquo;{turn.studentQuery}&rdquo;
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Mode Respons:{' '}
                {turn.response.detectedTrigger === 'direct-answer-refusal'
                  ? 'Tolak Jawaban Instan → Fokus Slope Grafik'
                  : turn.response.detectedTrigger === 'anomaly-outlier'
                  ? 'Deteksi Anomali / Outlier (R² < 0.85)'
                  : `Analogi Kontekstual (${turn.educationLevelLabel})`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* 1. Apresiasi / Observasi Singkat */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  1. [Apresiasi/Observasi Singkat]
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {turn.response.observation}
                </p>
              </div>

              {/* 2. Sorotan Data / Anomali */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-700 dark:text-amber-400 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  2. [Sorotan Data/Anomali]
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {turn.response.dataHighlight}
                </p>
              </div>

              {/* 3. Pertanyaan Pemantik */}
              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 space-y-1">
                <div className="flex items-center gap-1.5 font-mono font-bold text-sky-700 dark:text-sky-300 text-[11px]">
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  3. [Pertanyaan Pemantik]
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                  {turn.response.socraticQuestion}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Student Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAskDrLabMu();
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1"
      >
        <label htmlFor="dr-labmu-query-input" className="sr-only">
          Tanyakan sesuatu atau konsultasikan grafik kepada Dr. LabMu
        </label>
        <input
          id="dr-labmu-query-input"
          type="text"
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
          placeholder="Tulis pertanyaan atau keluhan praktikum ke Dr. LabMu (misal: 'Berapa nilai g-nya bro?' atau 'Kenapa titik ke-3 melenceng?')..."
          className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={isLoading || !studentQuery.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          {isLoading ? 'Menganalisis Telemetri...' : 'Konsultasi ke Dr. LabMu'}
        </button>
      </form>
    </section>
  );
};
