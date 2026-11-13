import React, { useState } from 'react';
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
  Bell,
  Camera,
  Mic,
  MicOff,
  Trash2,
} from 'lucide-react';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  LabNotification,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import { useDrLabMuChat } from '../hooks/useDrLabMuChat';

export type DrawerTabMode = 'dr-labmu' | 'notifications';

export interface DrLabMuAssistantPanelProps {
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

  const {
    studentQuery,
    setStudentQuery,
    isLoading,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    isListeningVoice,
    rateLimitCountdown,
    rateLimitMessage,
    isOfflineMentorActive,
    activeTurns,
    liveTelemetry,
    readableTopic,
    handleAskDrLabMu,
    handleVisionDiagnose,
    handleToggleVoiceInput,
    handleToggleSpeakAnswer,
    handleClearHistory,
  } = useDrLabMuChat({
    domain,
    academicLevel,
    physicsParams,
    chemistryParams,
    astronomyParams,
    biologyContext,
    records,
    externalPromptRequest,
  });

  const hasLowR2Alert =
    liveTelemetry.analytics.rSquared < 0.85 && liveTelemetry.recordedData.length >= 3;

  const panelInner = (
    <>
      {/* Drawer Header & Segmented Tab Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              {activeTab === 'dr-labmu' ? <MessageCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                <span>Dr. LabMu</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 font-medium">
                  Mentor Sokratik
                </span>
                {isOfflineMentorActive && (
                  <span
                    data-testid="offline-mentor-badge"
                    title="Dr. LabMu beroperasi penuh dalam mode luring tanpa kuota internet dengan basis pengetahuan Sokratik lokal"
                    className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1"
                  >
                    🌱 Mode Mentor Luring (Tanpa Kuota)
                  </span>
                )}
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

        {/* WebSocket Alert */}
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

        {/* HTTP 429 Friendly Rate-Limit Banner */}
        {rateLimitMessage && (
          <div
            role="alert"
            data-testid="dr-labmu-rate-limit-banner"
            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-500/50 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px] leading-tight">{rateLimitMessage}</span>
            </div>
            {rateLimitCountdown > 0 && (
              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                {rateLimitCountdown}s
              </span>
            )}
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
            {hasLowR2Alert && <span className="text-[10px] font-mono text-amber-500 font-bold">▲</span>}
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
                  hasLowR2Alert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {liveTelemetry.analytics.rSquared.toFixed(3)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setAutoSpeakEnabled(!autoSpeakEnabled);
              }}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                autoSpeakEnabled
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>{autoSpeakEnabled ? 'Auto-Suara: ON' : 'Auto-Suara'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-slate-400 hover:text-rose-500 flex items-center gap-1 cursor-pointer"
              title="Bersihkan riwayat diskusi"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Chat Turn History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTurns.map((turn) => (
              <div key={turn.id} className="space-y-2 text-xs">
                {/* Student Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-xs bg-sky-600 text-white shadow-sm leading-relaxed">
                    {turn.studentQuery}
                  </div>
                </div>

                {/* Optional snapshot preview */}
                {turn.snapshotPreviewUrl && (
                  <div className="flex justify-start">
                    <img
                      src={turn.snapshotPreviewUrl}
                      alt="Tangkapan aparatus 3D"
                      className="max-w-[240px] rounded-xl border border-slate-700 shadow-md object-cover"
                    />
                  </div>
                )}

                {/* Socratic Assistant Card */}
                <div className="flex justify-start">
                  <div className="max-w-[92%] p-3.5 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60 pb-1.5">
                      <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Dr. LabMu
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeakAnswer(turn)}
                          className="hover:text-sky-400 cursor-pointer p-0.5"
                          title="Bacakan teks"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-[10px]">{turn.timestamp}</span>
                      </div>
                    </div>

                    <p className="leading-relaxed font-medium">{turn.response.observation}</p>
                    {turn.response.dataHighlight && (
                      <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/60 font-mono text-[11px] text-amber-600 dark:text-amber-300">
                        {turn.response.dataHighlight}
                      </div>
                    )}
                    <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 text-sky-900 dark:text-sky-200">
                      <span className="font-bold text-[11px] uppercase tracking-wider block text-sky-600 dark:text-sky-400 mb-0.5">
                        Pertanyaan Pemantik:
                      </span>
                      <p className="italic leading-relaxed">{turn.response.socraticQuestion}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Prompts & Input Bar */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 space-y-2 shrink-0">
            {/* Quick Socratic Suggestion Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  handleAskDrLabMu(
                    `Beri saya analogi sederhana dan praktis untuk memahami konsep ${readableTopic}.`
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-semibold cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-3 h-3" />
                <span>Beri Analogi</span>
              </button>
              {onInjectOutlierDemo && (
                <button
                  type="button"
                  onClick={() => {
                    onInjectOutlierDemo();
                    handleAskDrLabMu('Kenapa nilai R² saya turun dan ada data yang melenceng?');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer whitespace-nowrap"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Cek Deviasi R²</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleAskDrLabMu(
                    'Bagaimana hubungan gradien garis regresi dengan hukum ilmiah pada modul ini?'
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Korelasi & Rumus</span>
              </button>
            </div>

            {/* Vision Snapshot Diagnostic Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleVisionDiagnose}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Minta Dr. LabMu Periksa Alat (Gemini Vision 3D)</span>
            </button>

            {/* Input Form with Voice Button */}
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
                title={isListeningVoice ? 'Hentikan rekaman' : 'Input Suara Bahasa Indonesia'}
                className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  isListeningVoice
                    ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-400'
                }`}
              >
                {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder={isListeningVoice ? 'Mendengarkan suara...' : 'Tanya Dr. LabMu...'}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={isLoading || !studentQuery.trim()}
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
                  <span className="font-semibold text-sky-600 dark:text-sky-400">{n.domain}</span>
                  <span className="font-mono">{n.timestamp}</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white">{n.title}</div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
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
      <aside className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-slate-900 dark:text-slate-100 shadow-xl select-text">
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
