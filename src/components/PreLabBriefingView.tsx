import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ListChecks,
  HelpCircle,
  ArrowRight,
  Atom,
  Volume2,
  Lightbulb,
  Compass,
  Factory,
  GraduationCap,
  History,
  Calculator,
  XCircle,
  BadgeCheck,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import {
  speakNarration,
  stopNarration,
  voiceNarration,
} from '../utils/voiceNarrationEngine';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
} from './ui/HypothesisAndCompareDock';
import { ExperimentRecord } from '../utils/scienceEngine';
import { useTranslation } from 'react-i18next';
import {
  recordK3Compliance,
  loadGamificationProfile,
} from '../services/gamificationEngine';
import {
  LabSafetyLicense,
  getLabSafetyLicenseForModule,
  issueOrUpdateLabSafetyLicense,
  MIN_PASSING_PRELAB_SCORE,
} from '../services/labLicenseEngine';
import { LabSafetyLicenseModal } from './ui/LabSafetyLicenseModal';
import { InteractiveFormulaPrimer } from './ui/InteractiveFormulaPrimer';
import { DIYLocalWisdomCard } from './ui/DIYLocalWisdomCard';

function cleanLatexEquation(eq: string): string {
  if (!eq) return '';
  return eq
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Psi/g, 'Ψ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\eta/g, 'η')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\phi/g, 'φ')
    .replace(/\\varepsilon/g, 'ε')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\implies/g, '⟹')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\propto/g, '∝')
    .replace(/\\quad/g, ' ')
    .replace(/\\max/g, 'max')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\_\{([^}]+)\}/g, '_$1')
    .replace(/\\/g, '')
    .trim();
}

interface PreLabBriefingViewProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  studentName?: string;
  studentGroup?: string;
  onProceedToSimulation: () => void;
  onBackToLobby: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  records?: ExperimentRecord[];
}

export const PreLabBriefingView: React.FC<PreLabBriefingViewProps> = ({
  experiment,
  activeTier,
  studentName = 'Praktikan RuangLABmu',
  studentGroup = 'Kelompok Mandiri',
  onProceedToSimulation,
  onBackToLobby,
  hypothesisNote,
  onChangeHypothesisNote,
  records = [],
}) => {
  const { t } = useTranslation();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [isSpeakingK3, setIsSpeakingK3] = useState<boolean>(false);
  const [openedQuizHints, setOpenedQuizHints] = useState<Record<string, boolean>>({});
  const [showMisconceptions, setShowMisconceptions] = useState<boolean>(false);
  const [showIndustryApps, setShowIndustryApps] = useState<boolean>(false);
  const [showDeepDive, setShowDeepDive] = useState<boolean>(false);
  const [k3Complied, setK3Complied] = useState<boolean>(() =>
    loadGamificationProfile().unlockedBadges.includes('K3 Guardian')
  );
  const [activeLicense, setActiveLicense] = useState<LabSafetyLicense | null>(() =>
    getLabSafetyLicenseForModule(experiment.id)
  );
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setActiveLicense(getLabSafetyLicenseForModule(experiment.id));
  }, [experiment.id]);

  useEffect(() => {
    const unsubscribe = voiceNarration.subscribe((speaking) => {
      setIsSpeakingK3(speaking);
    });
    return () => {
      stopNarration();
      unsubscribe();
    };
  }, []);

  const syncSafetyLicense = (nextK3: boolean, nextQuizPct: number) => {
    const issued = issueOrUpdateLabSafetyLicense({
      moduleId: experiment.id,
      moduleTitle: experiment.title,
      domain: experiment.domain,
      studentName,
      studentGroup,
      tier: activeTier,
      k3Complied: nextK3,
      preLabQuizScorePct: nextQuizPct,
    });
    setActiveLicense(issued);
    return issued;
  };

  const handleComplyK3 = () => {
    labSound.playSuccessChime();
    recordK3Compliance(experiment.id);
    setK3Complied(true);
    const currentQuizPct = quizSubmitted
      ? calculateScore().percentage
      : activeLicense?.preLabQuizScorePct ?? 0;
    syncSafetyLicense(true, currentQuizPct);
  };

  const handleToggleK3Narration = () => {
    labSound.playClick();
    if (isSpeakingK3) {
      stopNarration();
      setIsSpeakingK3(false);
      return;
    }

    const narrationScript = `Pengarahan Keselamatan Kerja Laboratorium untuk modul ${experiment.title}. Harap diperhatikan dengan saksama: ${experiment.safetyNotes.join('. ')}. Pastikan seluruh alat pelindung diri telah dikenakan sebelum memulai praktikum.`;

    speakNarration(narrationScript, {
      rate: 0.95,
      onStart: () => setIsSpeakingK3(true),
      onEnd: () => setIsSpeakingK3(false),
      onError: () => setIsSpeakingK3(false),
    });
  };

  const currentObjectives =
    experiment.objectives[activeTier] ||
    experiment.objectives.SMA ||
    experiment.objectives.SMP ||
    [];

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (quizSubmitted) return;
    labSound.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const calculateScore = () => {
    let correct = 0;
    experiment.preLabQuiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct++;
      }
    });
    return {
      correct,
      total: experiment.preLabQuiz.length,
      percentage: Math.round((correct / Math.max(1, experiment.preLabQuiz.length)) * 100),
    };
  };

  const quizResult = quizSubmitted ? calculateScore() : null;
  const firstParamLabel = experiment.parameters[0]?.label || 'Variabel Bebas';
  const firstOutputLabel = experiment.outputs[0]?.label || 'Variabel Terikat';

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 select-text">
      {/* 1. Top Experiment Context Header */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--comfort-text-muted)]">
            <span className="font-semibold text-[var(--comfort-accent)]">
              01 · Pengenalan, Hipotesis Awal &amp; K3
            </span>
            {experiment.chapterNumber && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[var(--comfort-text)] tabular-nums">
                  Bab {experiment.chapterNumber}
                </span>
              </>
            )}
            {experiment.competencyLevel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-medium">
                  Tingkat {experiment.competencyLevel}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="capitalize">{experiment.domain}</span>
            <span aria-hidden="true">·</span>
            <span>{experiment.subCategory}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Est. {experiment.estimatedMinutes} Menit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--comfort-text)] tracking-tight">
            {experiment.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onBackToLobby();
            }}
            className="px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:opacity-85 text-xs font-semibold transition-opacity cursor-pointer whitespace-nowrap"
          >
            {t('controls.changeModule')}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              recordK3Compliance(experiment.id);
              onProceedToSimulation();
            }}
            className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <span>{t('controls.openSimulation')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 2. BALANCED 2-COLUMN SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Theory & Key Equations */}
          <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm border-b border-[var(--comfort-border)] pb-3">
              <BookOpen className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <h2>Tinjauan Teori Ilmiah &amp; Persamaan Kunci</h2>
            </div>

            <p className="text-xs sm:text-sm text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
              {experiment.theorySummary}
            </p>

            {experiment.keyEquations.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-[var(--comfort-text-muted)]">
                  Rumus &amp; Hukum Dasar:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {experiment.keyEquations.map((eq, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-xs text-[var(--comfort-accent)] font-semibold leading-relaxed"
                    >
                      {cleanLatexEquation(eq)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <InteractiveFormulaPrimer
              moduleId={experiment.id}
              domain={experiment.domain}
              defaultExpanded={true}
            />

            <DIYLocalWisdomCard
              domain={experiment.domain}
              moduleId={experiment.id}
              defaultExpanded={false}
            />

            {/* Learning Objectives */}
            <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2.5">
              <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-xs">
                <ListChecks className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                <h3>Capaian Pembelajaran (Jenjang {activeTier})</h3>
              </div>
              <ul className="space-y-2 text-xs text-[var(--comfort-text-muted)]">
                {currentObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed comfort-prose">
                    <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                      0{i + 1}.
                    </span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Scientific Investigation Guide */}
          {experiment.stepByStepGuide && experiment.stepByStepGuide.length > 0 && (
            <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-3">
                <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
                  <Compass className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                  <h2>Panduan Investigasi Ilmiah Terarah</h2>
                </div>
                <span className="text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
                  {experiment.stepByStepGuide.length} Tahap
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {experiment.stepByStepGuide.map((stepText, idx) => {
                  const cleanStep = stepText.replace(/^\d+\.\s*/, '');
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-start gap-2.5 text-xs text-[var(--comfort-text)] leading-relaxed"
                    >
                      <span className="font-mono font-bold text-[11px] text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span>{cleanStep}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Hypothesis Scratchpad */}
          {hypothesisNote && onChangeHypothesisNote && (
            <HypothesisScratchpadCard
              moduleTitle={experiment.title}
              defaultIndependentVar={firstParamLabel}
              defaultDependentVar={firstOutputLabel}
              note={hypothesisNote}
              onChangeNote={onChangeHypothesisNote}
              records={records}
            />
          )}

          {/* K3 Safety Rules & Apparatus Checklist */}
          <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                <h2>{t('safety.sectionTitle')}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleK3Narration}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isSpeakingK3
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{isSpeakingK3 ? t('safety.stopNarration') : t('safety.listenNarration')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleComplyK3}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    k3Complied
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{k3Complied ? t('safety.compliedBadge') : t('safety.complyButton')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {experiment.safetyNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/25 text-xs text-[var(--comfort-text)] flex items-start gap-2.5 leading-relaxed comfort-prose"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{note}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2.5">
              <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-xs">
                <Atom className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                <h3>{t('apparatus.header')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {experiment.apparatusList.map((app, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                    <span className="text-[var(--comfort-text)] font-medium">{app}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Collapsible Enrichment Sections (Klinik Miskonsepsi, Industri, Penurunan Rumus) */}
          {experiment.commonMisconceptions && experiment.commonMisconceptions.length > 0 && (
            <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMisconceptions((prev) => !prev)}
                aria-expanded={showMisconceptions}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                    <span>Klinik Miskonsepsi: Mitos vs Fakta Ilmiah</span>
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                    Klarifikasi konsep · {experiment.commonMisconceptions.length} poin penting
                  </div>
                </div>
                {showMisconceptions ? (
                  <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                )}
              </button>

              {showMisconceptions && (
                <div className="px-5 pb-5 pt-2 border-t border-[var(--comfort-border)] space-y-3">
                  {experiment.commonMisconceptions.map((item, idx) => {
                    const parts = item.split(/Faktanya:|Fakta:/i);
                    const misconception = parts[0]?.trim() || item;
                    const fact = parts[1]?.trim() || '';

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2.5 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" aria-hidden="true" />
                          <div>
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              Mitos Umum:{' '}
                            </span>
                            <span className="text-[var(--comfort-text)]">{misconception}</span>
                          </div>
                        </div>
                        {fact && (
                          <div className="flex items-start gap-2.5 pt-2 border-t border-[var(--comfort-border)]">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                Fakta Ilmiah:{' '}
                              </span>
                              <span className="text-[var(--comfort-text-muted)] leading-relaxed">
                                {fact}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {experiment.realWorldApplications && experiment.realWorldApplications.length > 0 && (
            <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowIndustryApps((prev) => !prev)}
                aria-expanded={showIndustryApps}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                    <Factory className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                    <span>Aplikasi Nyata &amp; Industri di Indonesia</span>
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                    Konteks nasional &amp; industri · {experiment.realWorldApplications.length} studi kasus
                  </div>
                </div>
                {showIndustryApps ? (
                  <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                )}
              </button>

              {showIndustryApps && (
                <div className="px-5 pb-5 pt-3 border-t border-[var(--comfort-border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {experiment.realWorldApplications.map((appText, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-col justify-between text-xs space-y-2"
                    >
                      <div className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        0{idx + 1} · Aplikasi
                      </div>
                      <p className="text-[var(--comfort-text-muted)] leading-relaxed text-xs">
                        {appText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {experiment.deepDiveContent && (
            <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDeepDive((prev) => !prev)}
                aria-expanded={showDeepDive}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                    <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden="true" />
                    <span>Bedah Penurunan Rumus &amp; Sejarah Penemuan</span>
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                    Pengayaan konseptual &amp; derivasi matematis
                  </div>
                </div>
                {showDeepDive ? (
                  <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
                )}
              </button>

              {showDeepDive && (
                <div className="px-5 pb-5 pt-3 border-t border-[var(--comfort-border)] space-y-4">
                  {experiment.deepDiveContent.historicalContext && (
                    <div className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs space-y-1.5 text-[var(--comfort-text-muted)] leading-relaxed">
                      <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                        <History className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                        <span>Konteks Sejarah Sains:</span>
                      </div>
                      <p>{experiment.deepDiveContent.historicalContext}</p>
                    </div>
                  )}

                  {experiment.deepDiveContent.derivationLatex &&
                    experiment.deepDiveContent.derivationLatex.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[var(--comfort-text-muted)] flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                          <span>Langkah Penurunan Matematis Eksak:</span>
                        </div>
                        <div className="space-y-1.5">
                          {experiment.deepDiveContent.derivationLatex.map((step, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-xs text-indigo-600 dark:text-indigo-300 overflow-x-auto flex items-center gap-2"
                            >
                              <span className="text-[var(--comfort-text-muted)] font-mono text-[10px] shrink-0 tabular-nums">
                                [{idx + 1}]
                              </span>
                              <span className="font-semibold">{cleanLatexEquation(step)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {experiment.deepDiveContent.advancedConcept && (
                    <div className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs text-[var(--comfort-text-muted)] leading-relaxed">
                      <strong className="text-[var(--comfort-text)]">Konsep Lanjutan &amp; Batasan: </strong>
                      {experiment.deepDiveContent.advancedConcept}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* RIGHT COLUMN (5 Cols): Interactive Pre-Lab Readiness Quiz */}
        <div className="lg:col-span-5 space-y-5">
          <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--comfort-border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--comfort-text)] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                  <span>Kuis Kesiapan Pra-Praktikum</span>
                </h2>
                <p className="text-xs text-[var(--comfort-text-muted)] mt-0.5">
                  Dilengkapi petunjuk konsep bertahap sebelum memasuki kokpit 3D
                </p>
              </div>
              {quizResult && (
                <div className="text-right font-mono tabular-nums">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {quizResult.correct}/{quizResult.total}
                  </span>
                  <span className="text-xs text-[var(--comfort-text-muted)] ml-1">
                    ({quizResult.percentage}%)
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {experiment.preLabQuiz.map((q, qIdx) => {
                const selected = selectedAnswers[q.id];
                const isCorrect = selected === q.correctIndex;
                const hintOpen = Boolean(openedQuizHints[q.id]);

                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-bold text-xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                          0{qIdx + 1}.
                        </span>
                        <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed comfort-prose">
                          {q.question}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setOpenedQuizHints((prev) => ({
                            ...prev,
                            [q.id]: !prev[q.id],
                          }));
                        }}
                        className="px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        <Lightbulb className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>{hintOpen ? 'Tutup Petunjuk' : 'Petunjuk'}</span>
                      </button>
                    </div>

                    {hintOpen && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-[var(--comfort-text)] leading-relaxed">
                        <strong>Petunjuk Konsep:</strong> {q.explanation.split('.')[0]}.
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isChoice = selected === optIdx;
                        let btnStyle =
                          'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-sky-500';

                        if (quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            btnStyle =
                              'bg-emerald-500/18 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                          } else if (isChoice && !isCorrect) {
                            btnStyle =
                              'bg-rose-500/18 border-rose-500 text-rose-700 dark:text-rose-300';
                          }
                        } else if (isChoice) {
                          btnStyle =
                            'bg-sky-500/18 border-sky-500 text-sky-700 dark:text-sky-300 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${btnStyle}`}
                          >
                            <span className="font-mono mr-1.5 opacity-60">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="pt-1 text-[11px] text-[var(--comfort-text-muted)]">
                        <strong className="text-[var(--comfort-text)]">Penjelasan:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              {!quizSubmitted ? (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    setQuizSubmitted(true);
                    const res = calculateScore();
                    syncSafetyLicense(k3Complied, res.percentage);
                  }}
                  disabled={Object.keys(selectedAnswers).length < experiment.preLabQuiz.length}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Periksa Jawaban Kuis Pra-Lab
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="w-full py-2 text-xs text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                >
                  Ulangi Kuis Pra-Lab
                </button>
              )}

              {/* Lab Safety License Card */}
              <div className="p-3.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--comfort-text)]">
                    <BadgeCheck
                      className={`w-4 h-4 shrink-0 ${
                        activeLicense?.status === 'TERVERIFIKASI'
                          ? 'text-emerald-500'
                          : 'text-[var(--comfort-text-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>SIM Laboratorium K3</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                      activeLicense?.status === 'TERVERIFIKASI'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {activeLicense?.status === 'TERVERIFIKASI'
                      ? 'Terverifikasi'
                      : 'Menunggu Syarat'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--comfort-text-muted)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        k3Complied ? 'text-emerald-500' : 'text-[var(--comfort-text-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>1. Patuh SOP K3</span>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <Award
                      className={`w-3.5 h-3.5 shrink-0 ${
                        (quizResult?.percentage ?? activeLicense?.preLabQuizScorePct ?? 0) >=
                        MIN_PASSING_PRELAB_SCORE
                          ? 'text-emerald-500'
                          : 'text-[var(--comfort-text-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      2. Kuis ≥ {MIN_PASSING_PRELAB_SCORE}% (
                      {quizResult?.percentage ?? activeLicense?.preLabQuizScorePct ?? 0}%)
                    </span>
                  </div>
                </div>

                {activeLicense?.status === 'TERVERIFIKASI' ? (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playSuccessChime();
                      setIsLicenseModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Buka &amp; Cetak SIM Lab ({activeLicense.licenseId})</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-[var(--comfort-text-muted)] leading-relaxed">
                    Klik <strong className="text-[var(--comfort-text)]">&quot;Saya Patuh K3&quot;</strong> dan selesaikan Kuis Pra-Lab (minimal skor {MIN_PASSING_PRELAB_SCORE}%) untuk menerbitkan kartu SIM Lab ber-QR Code.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  recordK3Compliance(experiment.id);
                  onProceedToSimulation();
                }}
                className="w-full py-3 px-5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>{t('controls.readyOpen3D')}</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </div>

      <LabSafetyLicenseModal
        isOpen={isLicenseModalOpen}
        license={activeLicense}
        onClose={() => setIsLicenseModalOpen(false)}
      />
    </div>
  );
};
