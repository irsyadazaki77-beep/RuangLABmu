import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb,
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
  Sprout,
  Zap,
  BookmarkPlus,
  Check,
  FileCheck2,
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
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import { useDrLabMuChat } from '../hooks/useDrLabMuChat';
import { formatDrLabMuActionChipLabel } from '../utils/drLabMuActions';

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
  onSaveSummaryToNotes?: (text: string) => void;
  rSquared?: number;
  activeModuleTitle?: string;
  hypothesisText?: string;
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
  onSaveSummaryToNotes,
  rSquared,
  activeModuleTitle,
  hypothesisText,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [internalTab, setInternalTab] = useState<DrawerTabMode>('dr-labmu');
  const [savedTurnIds, setSavedTurnIds] = useState<Record<string, boolean>>({});

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
    handleTriggerUIAction,
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

  const { isLobbyMode, userRole, workflowStep } = useLabStore(
    useShallow((s) => ({
      isLobbyMode: s.isLobbyMode,
      userRole: s.userRole,
      workflowStep: s.workflowStep,
    }))
  );
  const teacherViewMode = useUIStore((s) => s.teacherViewMode);
  const isFullBleedActiveLab =
    !isLobbyMode &&
    ((userRole === 'siswa' && workflowStep === 2) ||
      (userRole === 'pengajar' && teacherViewMode === 'lab3d'));

  const effectiveR2 =
    typeof rSquared === 'number' && Number.isFinite(rSquared)
      ? rSquared
      : liveTelemetry.analytics.rSquared;
  const hasLowR2Alert =
    effectiveR2 < 0.85 && liveTelemetry.recordedData.length >= 3;

  useEffect(() => {
    if (isEmbedded || !isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onOpenChange) onOpenChange(false);
        else setInternalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEmbedded, isOpen, onOpenChange]);

  const panelInner = (
    <>
      {/* Drawer Header & Segmented Tab Bar */}
      <div className="p-4 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              {activeTab === 'dr-labmu' ? <MessageCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--comfort-text)] truncate flex items-center gap-1.5 flex-wrap">
                <span>Dr. LabMu</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium">
                  Mentor Sokratik
                </span>
                {isOfflineMentorActive && (
                  <span
                    data-testid="offline-mentor-badge"
                    title="Dr. LabMu beroperasi penuh dalam mode luring tanpa kuota internet dengan basis pengetahuan Sokratik lokal"
                    className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1"
                  >
                    <Sprout className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Mode Mentor Luring (Tanpa Kuota)</span>
                  </span>
                )}
                {isEmbedded && (
                  <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] font-mono">
                    Docked
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--comfort-text-muted)] truncate">
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
              className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* WebSocket Alert */}
        {wsConnected === false && (
          <div
            role="alert"
            className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/45 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
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
            className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/45 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[11px] leading-tight">{rateLimitMessage}</span>
            </div>
            {rateLimitCountdown > 0 && (
              <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0 tabular-nums">
                {rateLimitCountdown}s
              </span>
            )}
          </div>
        )}

        {/* 2-Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--comfort-surface)] rounded-xl border border-[var(--comfort-border)]">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setTab('dr-labmu');
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'dr-labmu'
                ? 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-sky-500" />
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
                ? 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
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
          <div className="px-4 py-2 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex items-center justify-between text-[11px] text-[var(--comfort-text-muted)] shrink-0">
            <span>
              Data: <strong className="font-mono text-[var(--comfort-text)]">{records.length}</strong>
            </span>
            <span>·</span>
            <span>
              R²:{' '}
              <strong
                className={`font-mono ${
                  hasLowR2Alert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {effectiveR2.toFixed(3)}
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
                  : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>{autoSpeakEnabled ? 'Auto-Suara: ON' : 'Auto-Suara'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[var(--comfort-text-muted)] hover:text-rose-500 flex items-center gap-1 cursor-pointer"
              title="Bersihkan riwayat diskusi"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Live Simulation Parameter Context Strip */}
          {(() => {
            const rawParams: Record<string, unknown> =
              domain === 'Fisika'
                ? { ...physicsParams }
                : domain === 'Kimia'
                  ? { ...chemistryParams }
                  : domain === 'Astronomi'
                    ? { ...astronomyParams }
                    : { ...(biologyContext?.params ?? {}) };
            const numericEntries = Object.entries(rawParams)
              .filter(([, v]) => typeof v === 'number')
              .slice(0, 4);
            if (numericEntries.length === 0) return null;
            return (
              <div
                data-testid="dr-labmu-sim-context-strip"
                className="px-4 py-1.5 bg-sky-500/5 border-b border-[var(--comfort-border)] flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono text-[var(--comfort-text-muted)] shrink-0"
              >
                <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">
                  Konteks 3D:
                </span>
                {numericEntries.map(([key, val]) => (
                  <span
                    key={key}
                    className="px-1.5 py-0.5 rounded bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] whitespace-nowrap tabular-nums"
                  >
                    {key}: <strong>{(val as number).toFixed(2)}</strong>
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Contextual Next-Step Guidance Strip */}
          {(() => {
            let stepGuidance: string;
            let toneClass =
              'bg-sky-500/8 border-sky-500/25 text-[var(--comfort-text)]';
            if (records.length === 0) {
              stepGuidance =
                'Langkah berikutnya: Catat titik data pertama di meja 3D atau jalankan Auto-Sweep 5 Titik.';
            } else if (records.length < 3) {
              stepGuidance = `Langkah berikutnya: Baru ${records.length}/3 titik tercatat. Tambahkan minimal ${
                3 - records.length
              } variasi lagi agar analisis regresi & residual dapat dihitung.`;
              toneClass = 'bg-amber-500/10 border-amber-500/30 text-[var(--comfort-text)]';
            } else if (effectiveR2 < 0.85) {
              stepGuidance = `Perhatian kurva: R² = ${effectiveR2.toFixed(
                3
              )} (< 0.85). Aktifkan Plot Residual di Tahap 3 untuk memeriksa outlier atau ulangi variasi parameter.`;
              toneClass = 'bg-amber-500/10 border-amber-500/30 text-[var(--comfort-text)]';
            } else {
              stepGuidance = `Data konsisten (R² = ${effectiveR2.toFixed(
                3
              )}, ${records.length} titik). Anda siap melengkapi LKS dinamis & meninjau draf kesimpulan.`;
              toneClass = 'bg-emerald-500/10 border-emerald-500/30 text-[var(--comfort-text)]';
            }
            return (
              <div
                data-testid="dr-labmu-next-step-strip"
                className={`mx-4 mt-3 px-3 py-2 rounded-xl border text-[11px] leading-snug shrink-0 ${toneClass}`}
              >
                <span className="font-semibold">{stepGuidance}</span>
              </div>
            );
          })()}

          {/* Chat Turn History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading && (
              <div
                data-testid="dr-labmu-thinking-bubble"
                className="flex justify-start"
              >
                <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tl-xs bg-sky-500/12 border border-sky-500/35 text-xs text-sky-800 dark:text-sky-200 flex items-center gap-2 shadow-xs">
                  <Lightbulb className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="font-semibold">Dr. LabMu sedang menganalisis telemetri 3D...</span>
                </div>
              </div>
            )}
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
                      className="max-w-[240px] rounded-xl border border-[var(--comfort-border)] shadow-md object-cover"
                    />
                  </div>
                )}

                {/* Socratic Assistant Card */}
                <div className="flex justify-start">
                  <div className="max-w-[92%] p-3.5 rounded-2xl rounded-tl-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] text-[var(--comfort-text-muted)] border-b border-[var(--comfort-border)] pb-1.5">
                      <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Dr. LabMu
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeakAnswer(turn)}
                          className="hover:text-sky-500 cursor-pointer p-0.5"
                          title="Bacakan teks"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-[10px]">{turn.timestamp}</span>
                      </div>
                    </div>

                    <p className="leading-relaxed font-medium comfort-prose">{turn.response.observation}</p>
                    {turn.response.dataHighlight && (
                      <div className="p-2.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] font-mono text-[11px] text-amber-700 dark:text-amber-300">
                        {turn.response.dataHighlight}
                      </div>
                    )}
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[var(--comfort-text)]">
                      <span className="font-bold text-[11px] uppercase tracking-wider block text-sky-700 dark:text-sky-300 mb-0.5">
                        Pertanyaan Pemantik:
                      </span>
                      <p className="leading-relaxed comfort-prose">{turn.response.socraticQuestion}</p>
                    </div>
                    {turn.response.uiActions && turn.response.uiActions.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5" data-testid="dr-labmu-action-chips">
                        {turn.response.uiActions.map((act, idx) => (
                          <button
                            key={`${turn.id}-act-${idx}`}
                            type="button"
                            data-testid="dr-labmu-action-chip"
                            onClick={() => handleTriggerUIAction(act)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            <Zap className="w-3 h-3 shrink-0" />
                            <span>{formatDrLabMuActionChipLabel(act)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {onSaveSummaryToNotes && (
                      <div className="pt-1 border-t border-[var(--comfort-border)] flex justify-end">
                        <button
                          type="button"
                          data-testid="dr-labmu-save-note-btn"
                          onClick={() => {
                            labSound.playSuccessChime();
                            const summaryText = `[Dr. LabMu · ${activeModuleTitle || readableTopic}] ${turn.response.observation} — Refleksi: ${turn.response.socraticQuestion}`;
                            onSaveSummaryToNotes(summaryText);
                            setSavedTurnIds((prev) => ({ ...prev, [turn.id]: true }));
                            window.setTimeout(() => {
                              setSavedTurnIds((prev) => ({ ...prev, [turn.id]: false }));
                            }, 3000);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--comfort-surface)] hover:border-sky-500/50 border border-[var(--comfort-border)] text-[var(--comfort-text)] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {savedTurnIds[turn.id] ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Tersimpan di Catatan Laporan
                              </span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3 h-3 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                              <span>Salin ke Catatan Laporan</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Prompts & Input Bar */}
          <div className="p-3 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2 shrink-0">
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
                <span>Korelasi &amp; Rumus</span>
              </button>
              <button
                type="button"
                data-testid="dr-labmu-review-lks-chip"
                onClick={() =>
                  handleAskDrLabMu(
                    `Tolong tinjau kesiapan draf LKS saya untuk modul ${
                      activeModuleTitle || readableTopic
                    }. Saat ini ada ${records.length} titik data${
                      hypothesisText ? ` dengan hipotesis: "${hypothesisText}"` : ''
                    }. Apa yang perlu saya perkuat dalam kesimpulan ilmiah tanpa memberi jawaban langsung?`
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-700 dark:text-teal-300 font-semibold cursor-pointer whitespace-nowrap"
              >
                <FileCheck2 className="w-3 h-3" />
                <span>Tinjau Draf LKS</span>
              </button>
            </div>

            {/* Vision Snapshot Diagnostic Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleVisionDiagnose}
              className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-sky-500'
                }`}
              >
                {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder={isListeningVoice ? 'Mendengarkan suara...' : 'Tanya Dr. LabMu...'}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-sky-500"
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
            <div className="py-12 text-center text-[var(--comfort-text-muted)]">
              Belum ada log aktivitas atau notifikasi pada sesi ini.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-[var(--comfort-text-muted)]">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">{n.domain}</span>
                  <span className="font-mono">{n.timestamp}</span>
                </div>
                <div className="font-bold text-[var(--comfort-text)]">{n.title}</div>
                <p className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">{n.message}</p>
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
      <aside className="w-full h-full flex flex-col bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl overflow-hidden text-[var(--comfort-text)] shadow-xl select-text">
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
            className={`fixed inset-0 ${isFullBleedActiveLab ? 'top-0' : 'top-14'} bg-slate-950/65 z-40`}
          />
          <motion.aside
            key="dr-labmu-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Laci Samping Dr. LabMu & Log Sesi"
            className={`fixed ${isFullBleedActiveLab ? 'top-0' : 'top-14'} right-0 bottom-0 w-full max-w-[440px] z-50 flex flex-col bg-[var(--comfort-surface)] border-l border-[var(--comfort-border)] text-[var(--comfort-text)] shadow-2xl select-text`}
          >
            {panelInner}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
