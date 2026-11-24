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
  Square,
  ChevronDown,
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
  const [show3DContext, setShow3DContext] = useState<boolean>(false);
  const [expandNextStep, setExpandNextStep] = useState<boolean>(false);
  const [expandedTurnIds, setExpandedTurnIds] = useState<Record<string, boolean>>({});

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
    isStreaming,
    streamingText,
    cancelStreaming,
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
            <div className="w-8 h-8 rounded-xl bg-[var(--comfort-accent-solid)] text-white flex items-center justify-center shrink-0 shadow-sm">
              {activeTab === 'dr-labmu' ? <MessageCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--comfort-text)] truncate flex items-center gap-1.5 flex-wrap">
                <span>Dr. LabMu</span>
                <span aria-hidden="true" className="text-[var(--comfort-text-muted)] opacity-45">·</span>
                <span className="text-xs font-medium text-[var(--comfort-accent)]">
                  Mentor Sokratik
                </span>
                {isOfflineMentorActive && (
                  <span
                    data-testid="offline-mentor-badge"
                    title="Dr. LabMu beroperasi penuh dalam mode luring tanpa kuota internet dengan basis pengetahuan Sokratik lokal"
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-success)]"
                  >
                    <span aria-hidden="true" className="opacity-45">·</span>
                    <Sprout className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Luring 3T</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--comfort-text-muted)] truncate leading-snug">
                {liveTelemetry.domain} · {readableTopic} · {liveTelemetry.educationLevel}
                {isEmbedded ? ' · Docked' : ''}
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
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* WebSocket Alert */}
        {wsConnected === false && (
          <div
            role="alert"
            className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/45 text-amber-800 dark:text-amber-200 flex items-start gap-2 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="comfort-chat-callout">
              <strong>Lab Sync Terputus (Offline):</strong> Kolaborasi multi-user sedang mencoba menyambung ulang. Mode eksperimen lokal tetap aktif secara penuh.
            </p>
          </div>
        )}

        {/* HTTP 429 Friendly Rate-Limit Banner */}
        {rateLimitMessage && (
          <div
            role="alert"
            data-testid="dr-labmu-rate-limit-banner"
            className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/45 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-2 shadow-sm"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="comfort-chat-callout">{rateLimitMessage}</p>
            </div>
            {rateLimitCountdown > 0 && (
              <span className="font-mono font-bold text-2xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0 tabular-nums">
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
            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'dr-labmu'
                ? 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <Lightbulb
              className={`w-3.5 h-3.5 shrink-0 ${
                activeTab === 'dr-labmu' ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'
              }`}
            />
            <span className="truncate">Mentor Dr. LabMu</span>
            {hasLowR2Alert && (
              <span className="text-2xs font-mono text-[var(--comfort-warning)] font-bold shrink-0">▲</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setTab('notifications');
            }}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <Bell
              className={`w-3.5 h-3.5 shrink-0 ${
                activeTab === 'notifications' ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'
              }`}
            />
            <span className="truncate">Log &amp; Umpan Balik ({notifications.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MENTOR SOKRATIK DR. LABMU */}
      {activeTab === 'dr-labmu' && (() => {
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

        let stepGuidance: string;
        let stepDotClass = 'bg-[var(--comfort-accent)]';
        if (records.length === 0) {
          stepGuidance =
            'Catat titik data pertama di meja 3D atau jalankan Auto-Sweep 5 Titik.';
        } else if (records.length < 3) {
          stepGuidance = `Baru ${records.length}/3 titik tercatat — tambah minimal ${
            3 - records.length
          } variasi lagi untuk analisis regresi.`;
          stepDotClass = 'bg-[var(--comfort-warning)]';
        } else if (effectiveR2 < 0.85) {
          stepGuidance = `R² = ${effectiveR2.toFixed(
            3
          )} (< 0.85) — cek Plot Residual di Tahap 3 atau ulangi variasi parameter.`;
          stepDotClass = 'bg-[var(--comfort-warning)]';
        } else {
          stepGuidance = `Data konsisten (R² = ${effectiveR2.toFixed(
            3
          )}, ${records.length} titik) — siap melengkapi LKS & kesimpulan.`;
          stepDotClass = 'bg-[var(--comfort-success)]';
        }

        return (
        <>
          {/* Compact Single-Line Telemetry + Collapsible 3D Context Bar */}
          <div className="bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] shrink-0">
            <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)] tabular-nums">
              <div className="flex items-center gap-2">
                <span>
                  Data <strong className="font-mono text-[var(--comfort-text)]">{records.length}</strong>
                </span>
                <span aria-hidden="true" className="opacity-45">·</span>
                <span>
                  R²{' '}
                  <strong
                    className={`font-mono ${
                      hasLowR2Alert ? 'text-[var(--comfort-warning)]' : 'text-[var(--comfort-success)]'
                    }`}
                  >
                    {effectiveR2.toFixed(3)}
                  </strong>
                </span>
                {numericEntries.length > 0 && (
                  <>
                    <span aria-hidden="true" className="opacity-45">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setShow3DContext((prev) => !prev);
                      }}
                      aria-expanded={show3DContext}
                      className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-accent)] hover:underline cursor-pointer"
                    >
                      <span>Konteks 3D</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-150 ${
                          show3DContext ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setAutoSpeakEnabled(!autoSpeakEnabled);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono text-2xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                    autoSpeakEnabled
                      ? 'comfort-accent-soft'
                      : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
                  }`}
                >
                  <Volume2 className="w-3 h-3" />
                  <span>{autoSpeakEnabled ? 'Suara ON' : 'Suara'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-danger)] flex items-center gap-1 cursor-pointer p-1 rounded-md"
                  title="Bersihkan riwayat diskusi"
                  aria-label="Bersihkan riwayat diskusi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Collapsible Live 3D Parameter Context Strip */}
            {show3DContext && numericEntries.length > 0 && (
              <div
                data-testid="dr-labmu-sim-context-strip"
                className="px-4 py-1.5 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface)] flex items-center gap-2 overflow-x-auto text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums"
              >
                {numericEntries.map(([key, val], idx) => (
                  <span key={key} className="whitespace-nowrap">
                    {idx > 0 && <span aria-hidden="true" className="mr-2 opacity-40">·</span>}
                    {key}: <strong className="text-[var(--comfort-text)]">{(val as number).toFixed(2)}</strong>
                  </span>
                ))}
              </div>
            )}

            {/* Compact 1-Line Expandable Next-Step Guidance Strip */}
            <button
              type="button"
              data-testid="dr-labmu-next-step-strip"
              aria-expanded={expandNextStep}
              onClick={() => setExpandNextStep((prev) => !prev)}
              className="w-full px-4 py-2 border-t border-[var(--comfort-border)] flex items-start justify-between gap-2 text-left hover:bg-[var(--comfort-surface)]/70 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${stepDotClass}`} aria-hidden="true" />
                <span
                  className={`comfort-chat-callout text-[var(--comfort-text)] ${
                    expandNextStep ? '' : 'line-clamp-1'
                  }`}
                >
                  {stepGuidance}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0 mt-0.5 transition-transform duration-150 ${
                  expandNextStep ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Chat Turn History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isStreaming && streamingText.trim() ? (
              <div
                data-testid="dr-labmu-streaming-bubble"
                aria-live="polite"
                className="flex justify-start"
              >
                <div className="max-w-[92%] p-3.5 rounded-2xl rounded-tl-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-accent-border)] text-[var(--comfort-text)] space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)] border-b border-[var(--comfort-border)] pb-1.5">
                    <span className="font-semibold text-[var(--comfort-accent)] flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Dr. LabMu sedang mengetik...</span>
                    </span>
                    <button
                      type="button"
                      data-testid="dr-labmu-stop-stream-btn"
                      onClick={() => {
                        labSound.playClick();
                        cancelStreaming();
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--comfort-danger-soft)] hover:opacity-90 border border-[var(--comfort-danger)]/35 text-[var(--comfort-danger)] font-semibold text-2xs cursor-pointer transition-opacity"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                      <span>Hentikan</span>
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap comfort-chat-prose">
                    {streamingText}
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-[var(--comfort-accent)] animate-pulse rounded-xs"
                    />
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div
                data-testid="dr-labmu-thinking-bubble"
                className="flex justify-start"
              >
                <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tl-xs comfort-accent-soft border flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                    <span className="comfort-chat-callout font-semibold text-[var(--comfort-text)]">Dr. LabMu sedang menganalisis telemetri 3D...</span>
                  </div>
                  {isStreaming && (
                    <button
                      type="button"
                      data-testid="dr-labmu-stop-stream-btn"
                      onClick={() => {
                        labSound.playClick();
                        cancelStreaming();
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--comfort-danger-soft)] hover:opacity-90 text-[var(--comfort-danger)] font-semibold text-2xs cursor-pointer shrink-0"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                      <span>Hentikan</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
            {activeTurns.map((turn) => (
              <div key={turn.id} className="space-y-2.5">
                {/* Student Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tr-xs bg-[var(--comfort-accent-solid)] text-white shadow-sm">
                    <p className="comfort-chat-prose">{turn.studentQuery}</p>
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

                {/* Flattened Socratic Assistant Card */}
                {(() => {
                  const isLongObs = turn.response.observation.length > 180;
                  const isObsExpanded = Boolean(expandedTurnIds[turn.id]);
                  return (
                  <div className="flex justify-start">
                    <div className="max-w-[95%] p-3.5 rounded-2xl rounded-tl-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)] pb-1 border-b border-[var(--comfort-border)]">
                        <span className="font-semibold text-[var(--comfort-accent)] flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 shrink-0" /> Dr. LabMu
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakAnswer(turn)}
                            className="hover:text-[var(--comfort-accent)] cursor-pointer p-1 rounded-md"
                            title="Bacakan teks"
                            aria-label="Bacakan teks"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-2xs tabular-nums">{turn.timestamp}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p
                          className={`comfort-chat-prose ${
                            isLongObs && !isObsExpanded ? 'line-clamp-3' : ''
                          }`}
                        >
                          {turn.response.observation}
                        </p>
                        {isLongObs && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTurnIds((prev) => ({
                                ...prev,
                                [turn.id]: !prev[turn.id],
                              }))
                            }
                            aria-expanded={isObsExpanded}
                            className="text-2xs font-semibold text-[var(--comfort-accent)] hover:underline cursor-pointer"
                          >
                            {isObsExpanded ? 'Ringkas' : 'Lihat Detail'}
                          </button>
                        )}
                      </div>

                      {turn.response.dataHighlight && (
                        <div className="pt-2 border-t border-[var(--comfort-border)] font-mono comfort-chat-callout text-[var(--comfort-warning)]">
                          {turn.response.dataHighlight}
                        </div>
                      )}

                      {/* Single Visual Focal Point: Pertanyaan Pemantik */}
                      <div className="p-2.5 rounded-xl border border-[var(--comfort-accent-border)] bg-[var(--comfort-accent-soft)] text-[var(--comfort-text)] space-y-0.5">
                        <span className="font-bold text-2xs tracking-wide block text-[var(--comfort-accent)]">
                          Pertanyaan Pemantik
                        </span>
                        <p className="comfort-chat-prose font-medium">
                          {turn.response.socraticQuestion}
                        </p>
                      </div>

                      {((turn.response.uiActions && turn.response.uiActions.length > 0) ||
                        onSaveSummaryToNotes) && (
                        <div className="pt-2 border-t border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2">
                          {turn.response.uiActions && turn.response.uiActions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5" data-testid="dr-labmu-action-chips">
                              {turn.response.uiActions.map((act, idx) => (
                                <button
                                  key={`${turn.id}-act-${idx}`}
                                  type="button"
                                  data-testid="dr-labmu-action-chip"
                                  onClick={() => handleTriggerUIAction(act)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg comfort-accent-soft border hover:opacity-90 font-semibold text-2xs transition-opacity cursor-pointer"
                                >
                                  <Zap className="w-3 h-3 shrink-0" />
                                  <span>{formatDrLabMuActionChipLabel(act)}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span />
                          )}

                          {onSaveSummaryToNotes && (
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
                              className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-text-muted)] hover:text-[var(--comfort-accent)] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {savedTurnIds[turn.id] ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[var(--comfort-success)]" aria-hidden="true" />
                                  <span className="text-[var(--comfort-success)]">
                                    Tersimpan
                                  </span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                                  <span>Salin ke Laporan</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {/* Quick Prompts & Input Bar */}
          <div className="p-3 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2 shrink-0">
            {/* Quick Socratic Suggestion Chips (Uniform Calm Neutral Chips) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() =>
                  handleAskDrLabMu(
                    `Beri saya analogi sederhana dan praktis untuk memahami konsep ${readableTopic}.`
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg comfort-btn-secondary font-semibold cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-3 h-3 text-[var(--comfort-accent)]" />
                <span>Beri Analogi</span>
              </button>
              {onInjectOutlierDemo && (
                <button
                  type="button"
                  onClick={() => {
                    onInjectOutlierDemo();
                    handleAskDrLabMu('Kenapa nilai R² saya turun dan ada data yang melenceng?');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg comfort-btn-secondary font-semibold cursor-pointer whitespace-nowrap"
                >
                  <AlertTriangle className="w-3 h-3 text-[var(--comfort-warning)]" />
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg comfort-btn-secondary font-semibold cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-3 h-3 text-[var(--comfort-accent)]" />
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg comfort-btn-secondary font-semibold cursor-pointer whitespace-nowrap"
              >
                <FileCheck2 className="w-3 h-3 text-[var(--comfort-accent)]" />
                <span>Tinjau Draf LKS</span>
              </button>
            </div>

            {/* Vision Snapshot Diagnostic Button (Secondary so Tanya is sole primary CTA) */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleVisionDiagnose}
              className="w-full py-2 px-3 rounded-xl comfort-btn-secondary disabled:opacity-50 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-[var(--comfort-accent)]" />
              <span>Minta Dr. LabMu Periksa Alat (Gemini Vision 3D)</span>
            </button>

            {/* Input Form with Voice Button & Live Stop Control */}
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
                className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${
                  isListeningVoice
                    ? 'bg-rose-700 border-rose-600 text-white'
                    : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-accent)]'
                }`}
              >
                {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder={isListeningVoice ? 'Mendengarkan suara...' : 'Tanya Dr. LabMu...'}
                className="flex-1 min-h-[40px] px-3 py-2 text-[0.8125rem] leading-normal rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-[var(--comfort-accent)]"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    cancelStreaming();
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Hentikan</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading || !studentQuery.trim()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl comfort-btn-primary disabled:opacity-40 font-bold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Tanya</span>
                </button>
              )}
            </form>
          </div>
        </>
        );
      })()}

      {/* TAB 2: PUSAT NOTIFIKASI & LOG SESI */}
      {activeTab === 'notifications' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--comfort-text-muted)]">
              Belum ada log aktivitas atau notifikasi pada sesi ini.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
                  <span className="font-semibold text-[var(--comfort-accent)]">{n.domain}</span>
                  <span className="font-mono text-2xs tabular-nums">{n.timestamp}</span>
                </div>
                <div className="text-[0.8125rem] font-bold leading-snug text-[var(--comfort-text)]">
                  {n.title}
                </div>
                <p className="text-[var(--comfort-text-muted)] comfort-chat-prose">{n.message}</p>
                {n.formulaHint && (
                  <div className="pt-1 font-mono comfort-chat-callout text-[var(--comfort-accent)]">
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
