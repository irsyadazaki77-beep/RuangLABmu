import React, { useState } from 'react';
import {
  Wand2,
  X,
  Target,
  FileQuestion,
  Rocket,
  CheckCircle2,
  Loader2,
  BookOpen,
  FlaskConical,
  Atom,
  Dna,
  Orbit,
} from 'lucide-react';
import {
  EXPERIMENT_CATALOG,
  ExperimentModule,
  getExperimentById,
} from '../../registry/experimentRegistry';
import {
  CustomAIMissionPayload,
  generateDeterministicCustomMission,
  normalizeCustomMissionPayload,
} from '../../utils/collabProtocol';
import { useShallow } from 'zustand/react/shallow';
import { useCollabStore } from '../../stores/useCollabStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiFetch } from '../../utils/apiClient';
import { TeacherAuthGateModal } from './TeacherAuthGateModal';
import { labSound } from '../../utils/soundEngine';

export interface AICustomMissionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName?: string;
  onSelectModule?: (mod: ExperimentModule) => void;
}

interface QuickModulePreset {
  id: string;
  label: string;
  domainLabel: string;
  defaultPrompt: string;
  icon: React.ReactNode;
}

const QUICK_MODULE_PRESETS: QuickModulePreset[] = [
  {
    id: 'acid-base-titration',
    label: 'Titrasi Asam-Basa',
    domainLabel: 'Kimia Analitik',
    defaultPrompt: 'Uji sampel air hujan di sekitar kawah gunung berapi dengan titrasi',
    icon: <FlaskConical className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: 'pendulum-harmonic',
    label: 'Bandul Harmonis',
    domainLabel: 'Fisika Mekanika',
    defaultPrompt: 'Kalibrasi periode ayunan bandul seismograf di lereng gunung berapi aktif',
    icon: <Atom className="w-4 h-4 text-sky-500" />,
  },
  {
    id: 'photosynthesis-ingenhousz',
    label: 'Jantung & Fisiologi O₂',
    domainLabel: 'Biologi & Anatomi',
    defaultPrompt: 'Analisis kapasitas suplai oksigen & respons fisiologis kardiovaskular di dataran tinggi',
    icon: <Dna className="w-4 h-4 text-rose-500" />,
  },
  {
    id: 'solar-kepler',
    label: 'Orbit Hukum Kepler',
    domainLabel: 'Astronomi',
    defaultPrompt: 'Sinkronisasi orbit satelit pemantau cuaca ekstrem mengelilingi planet',
    icon: <Orbit className="w-4 h-4 text-amber-500" />,
  },
];

const CASE_STUDY_EXAMPLES: Array<{ moduleId: string; text: string }> = [
  {
    moduleId: 'acid-base-titration',
    text: 'Uji sampel air hujan di sekitar kawah gunung berapi dengan titrasi',
  },
  {
    moduleId: 'pendulum-harmonic',
    text: 'Ukur anomali percepatan gravitasi lokal di dataran tinggi menggunakan bandul sederhana',
  },
  {
    moduleId: 'photosynthesis-ingenhousz',
    text: 'Optimalkan produksi oksigen bioreaktor mikroalga untuk stasiun riset bawah laut',
  },
  {
    moduleId: 'solar-kepler',
    text: 'Rancang lintasan orbit wahana antariksa menuju Mars menggunakan Hukum III Kepler',
  },
];

export const AICustomMissionBuilderModal: React.FC<AICustomMissionBuilderModalProps> = ({
  isOpen,
  onClose,
  teacherName = 'Dr. Hendra Kusuma',
  onSelectModule,
}) => {
  const { activeRoomId, roomPin, activeCustomMission, setActiveCustomMission, setActiveRoom } =
    useCollabStore(
      useShallow((s) => ({
        activeRoomId: s.activeRoomId,
        roomPin: s.roomPin,
        activeCustomMission: s.activeCustomMission,
        setActiveCustomMission: s.setActiveCustomMission,
        setActiveRoom: s.setActiveRoom,
      }))
    );

  const [selectedModuleId, setSelectedModuleId] = useState<string>('acid-base-titration');
  const [caseStudyPrompt, setCaseStudyPrompt] = useState<string>(
    'Uji sampel air hujan di sekitar kawah gunung berapi dengan titrasi'
  );
  const [targetRoomCode, setTargetRoomCode] = useState<string>(activeRoomId || 'LAB-ALPHA');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [generatedMission, setGeneratedMission] = useState<CustomAIMissionPayload | null>(
    activeCustomMission
  );
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const authPromptOpen = useAuthStore((s) => s.authPromptOpen);
  const authPromptReason = useAuthStore((s) => s.authPromptReason);
  const closeAuthPrompt = useAuthStore((s) => s.closeAuthPrompt);

  if (!isOpen) return null;

  const effectiveRoomId = (activeRoomId || targetRoomCode || 'LAB-ALPHA').toUpperCase().trim();

  const handleGenerateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = caseStudyPrompt.trim();
    if (!trimmedPrompt) {
      setErrorMsg('Silakan ketikkan studi kasus cerita terlebih dahulu.');
      return;
    }

    labSound.playClick(620);
    setIsGenerating(true);
    setErrorMsg(null);
    setPublishSuccessMsg(null);

    try {
      const response = await apiFetch('/api/generate-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: selectedModuleId,
          caseStudyPrompt: trimmedPrompt,
          teacherName,
          roomId: effectiveRoomId,
          publishToRoom: true,
        }),
        promptTeacherAuthOn401: true,
        authReason: 'Verifikasi PIN pengajar diperlukan untuk menyiarkan misi praktikum AI ke ruangan.',
      });

      if (response.status === 401 || response.status === 403) {
        setErrorMsg('Silakan verifikasi sesi pengajar terlebih dahulu untuk menyiarkan misi ke ruangan.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const normalized = normalizeCustomMissionPayload(
          data.mission,
          {
            moduleId: selectedModuleId,
            caseStudyPrompt: trimmedPrompt,
            teacherName,
            roomId: effectiveRoomId,
          },
          data.mission?.source || 'gemini-api'
        );
        setGeneratedMission(normalized);
        setActiveCustomMission(normalized);
        if (data.room) {
          setActiveRoom(data.room);
        }
        labSound.playSuccessChime();
        setPublishSuccessMsg(
          `Misi "${normalized.title}" berhasil dibuat & disiarkan otomatis ke Room PIN [${effectiveRoomId}]!`
        );
        return;
      }
    } catch {
      // Fallback to deterministic generator if network/server unreachable
    } finally {
      setIsGenerating(false);
    }

    const fallback = generateDeterministicCustomMission({
      moduleId: selectedModuleId,
      caseStudyPrompt: trimmedPrompt,
      teacherName,
      roomId: effectiveRoomId,
    });
    setGeneratedMission(fallback);
    setActiveCustomMission(fallback);
    labSound.playSuccessChime();
    setPublishSuccessMsg(
      `Misi "${fallback.title}" berhasil diaktifkan di Room PIN [${effectiveRoomId}]!`
    );
  };

  const handlePublishToRoom = async () => {
    if (!generatedMission) return;
    labSound.playClick(680);
    setIsPublishing(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch(`/api/rooms/${encodeURIComponent(effectiveRoomId)}/mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission: {
            ...generatedMission,
            roomId: effectiveRoomId,
          },
          teacherName,
        }),
        promptTeacherAuthOn401: true,
        authReason: 'Verifikasi PIN pengajar diperlukan untuk menyimpan misi kustom ke Room.',
      });
      if (res.status === 401 || res.status === 403) {
        setErrorMsg('Silakan verifikasi sesi pengajar terlebih dahulu untuk menyimpan misi ke Room.');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setActiveRoom(data.room);
        }
      }
    } catch {
      // ignore network error; local store is still updated
    } finally {
      setIsPublishing(false);
    }

    const updated = { ...generatedMission, roomId: effectiveRoomId };
    setGeneratedMission(updated);
    setActiveCustomMission(updated);
    labSound.playSuccessChime();
    setPublishSuccessMsg(
      `Misi kustom telah disinkronkan ke Room [${effectiveRoomId}]${roomPin ? ` (PIN: ${roomPin})` : ''}. Seluruh siswa di ruangan ini langsung menerima skenario studi kasus!`
    );
  };

  const handleLaunchMissionModule = () => {
    if (!generatedMission) return;
    labSound.playClick();
    const targetMod =
      getExperimentById(generatedMission.moduleId) ||
      EXPERIMENT_CATALOG.find((m) => m.id === selectedModuleId) ||
      EXPERIMENT_CATALOG[0];
    if (onSelectModule && targetMod) {
      onSelectModule(targetMod);
    }
    onClose();
  };

  return (
    <div
      data-testid="ai-custom-mission-builder-modal"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold">
                  AI CUSTOM MISSION BUILDER · MODE GURU
                </span>
                <span className="text-2xs font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                  Room Aktif: {effectiveRoomId} {roomPin ? `(PIN: ${roomPin})` : ''}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--comfort-text)] mt-0.5">
                Buat Misi Praktikum AI &amp; Studi Kasus Kontekstual
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-ai-mission-modal-btn"
            className="p-2 rounded-xl bg-[var(--comfort-surface)] hover:opacity-90 border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] transition-colors cursor-pointer"
            aria-label="Tutup pembuat misi AI"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <form onSubmit={handleGenerateScenario} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Pilih Modul Dasar */}
              <div className="lg:col-span-5 space-y-2.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  1. Pilih Modul Dasar Praktikum 3D
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {QUICK_MODULE_PRESETS.map((preset) => {
                    const isSelected = selectedModuleId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-testid={`preset-module-${preset.id}`}
                        onClick={() => {
                          labSound.playClick();
                          setSelectedModuleId(preset.id);
                          setCaseStudyPrompt(preset.defaultPrompt);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'bg-indigo-500/15 border-indigo-500 text-[var(--comfort-text)] shadow-sm'
                            : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:border-sky-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {preset.icon}
                          <span className="text-2xs font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]">
                            {preset.domainLabel}
                          </span>
                        </div>
                        <div className="text-xs font-bold leading-snug mt-1 text-[var(--comfort-text)]">
                          {preset.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <label
                    htmlFor="ai-mission-catalog-select"
                    className="block text-2xs text-[var(--comfort-text-muted)] mb-1"
                  >
                    Atau pilih dari seluruh katalog 25 modul eksperimen:
                  </label>
                  <select
                    id="ai-mission-catalog-select"
                    data-testid="ai-mission-module-select"
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-xs text-[var(--comfort-text)] font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    {EXPERIMENT_CATALOG.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        [{mod.domain}] {mod.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-mission-room-input"
                    className="block text-2xs text-[var(--comfort-text-muted)] mb-1"
                  >
                    Kode Room PIN Kelas Target:
                  </label>
                  <input
                    id="ai-mission-room-input"
                    type="text"
                    value={targetRoomCode}
                    onChange={(e) => setTargetRoomCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: LAB-ALPHA"
                    className="w-full px-3 py-1.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-xs font-mono font-bold text-amber-600 dark:text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Ketik Studi Kasus Cerita */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-2.5">
                <div className="space-y-2">
                  <label
                    htmlFor="ai-mission-story-textarea"
                    className="block text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
                  >
                    2. Ketik Studi Kasus Cerita Kontekstual
                  </label>
                  <textarea
                    id="ai-mission-story-textarea"
                    data-testid="ai-mission-prompt-input"
                    rows={4}
                    value={caseStudyPrompt}
                    onChange={(e) => setCaseStudyPrompt(e.target.value)}
                    placeholder="Contoh: Uji sampel air hujan di sekitar kawah gunung berapi dengan titrasi..."
                    className="w-full p-3.5 rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-xs sm:text-sm text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />

                  <div className="space-y-1.5">
                    <span className="text-2xs text-[var(--comfort-text-muted)] font-medium">
                      Contoh Studi Kasus Cepat (1-Klik):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {CASE_STUDY_EXAMPLES.map((ex, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            labSound.playClick();
                            setSelectedModuleId(ex.moduleId);
                            setCaseStudyPrompt(ex.text);
                          }}
                          className="text-2xs px-2.5 py-1 rounded-lg bg-[var(--comfort-surface)] hover:bg-indigo-500/15 border border-[var(--comfort-border)] hover:border-indigo-500/40 text-[var(--comfort-text)] transition-colors cursor-pointer text-left"
                        >
                          “{ex.text}”
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-700 dark:text-rose-200 font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    data-testid="generate-ai-mission-btn"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyusun Skenario AI...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Buat &amp; Siarkan Skenario Misi AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Status Banner */}
          {publishSuccessMsg && (
            <div
              data-testid="ai-mission-published-banner"
              className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-[var(--comfort-text)]"
            >
              <div className="flex items-center gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{publishSuccessMsg}</span>
              </div>
              <span className="font-mono font-bold text-2xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                LIVE DI ROOM {effectiveRoomId}
              </span>
            </div>
          )}

          {/* Generated Structured JSON Scenario Preview */}
          {generatedMission && (
            <div
              data-testid="ai-mission-preview-card"
              className="rounded-2xl bg-[var(--comfort-surface)] border border-indigo-500/35 p-5 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-2xs font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase">
                      SKENARIO MISI TERSTRUKTUR JSON
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-2xs font-mono text-[var(--comfort-text-muted)]">
                      Modul: {generatedMission.moduleTitle}
                    </span>
                  </div>
                  <h3
                    data-testid="ai-mission-generated-title"
                    className="text-base sm:text-lg font-extrabold text-[var(--comfort-text)]"
                  >
                    {generatedMission.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePublishToRoom}
                    disabled={isPublishing}
                    data-testid="publish-ai-mission-btn"
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>
                      {isPublishing ? 'Menyimpan...' : `Simpan ke Room ${effectiveRoomId}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchMissionModule}
                    data-testid="launch-ai-mission-module-btn"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Buka Modul Praktikum</span>
                  </button>
                </div>
              </div>

              {/* 1. Narasi Studi Kasus & 2. Target Variabel */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 p-4 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1.5">
                  <div className="text-2xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                    Narasi Studi Kasus Ilmiah
                  </div>
                  <p
                    data-testid="ai-mission-generated-narrative"
                    className="text-xs sm:text-sm text-[var(--comfort-text)] leading-relaxed"
                  >
                    {generatedMission.narrative}
                  </p>
                </div>

                <div
                  data-testid="ai-mission-target-variable"
                  className="md:col-span-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/35 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-bold">
                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Target Variabel Keberhasilan</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--comfort-text)]">
                      {generatedMission.targetVariable.variableLabel}
                    </div>
                    <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {generatedMission.targetVariable.minSuccessValue} –{' '}
                      {generatedMission.targetVariable.maxSuccessValue}{' '}
                      <span className="text-xs text-[var(--comfort-text-muted)]">
                        {generatedMission.targetVariable.unit}
                      </span>
                    </div>
                  </div>
                  <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
                    Nilai Optimal: {generatedMission.targetVariable.targetValue}{' '}
                    {generatedMission.targetVariable.unit}
                  </div>
                </div>
              </div>

              {/* 3. Tiga Pertanyaan LKS Kontekstual */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <FileQuestion className="w-4 h-4 text-amber-500" />
                  <span>3 Pertanyaan LKS Kontekstual (Otomatis Disematkan ke LKS Siswa)</span>
                </div>

                <div
                  data-testid="ai-mission-questions-list"
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  {generatedMission.contextualQuestions.slice(0, 3).map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1.5">
                        <span className="inline-block text-2xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          Pertanyaan LKS #{idx + 1}
                        </span>
                        <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed">
                          {q.questionText}
                        </p>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-[var(--comfort-border)] text-2xs">
                        <div className="text-emerald-700 dark:text-emerald-300">
                          <strong className="font-mono">Kunci Konsep:</strong>{' '}
                          {q.expectedConceptOrValue}
                        </div>
                        <div className="text-[var(--comfort-text-muted)]">
                          <strong className="font-mono text-sky-600 dark:text-sky-300">
                            Petunjuk Sokratik:
                          </strong>{' '}
                          {q.hint}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <TeacherAuthGateModal
        isOpen={authPromptOpen}
        onClose={closeAuthPrompt}
        reason={authPromptReason}
        defaultTeacherName={teacherName}
      />
    </div>
  );
};

export default AICustomMissionBuilderModal;
