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
import { InteractiveFormulaPrimer } from './ui/InteractiveFormulaPrimer';
import { DIYLocalWisdomCard } from './ui/DIYLocalWisdomCard';

interface PreLabBriefingViewProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  onProceedToSimulation: () => void;
  onBackToLobby: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  records?: ExperimentRecord[];
}

export const PreLabBriefingView: React.FC<PreLabBriefingViewProps> = ({
  experiment,
  activeTier,
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
  const [k3Complied, setK3Complied] = useState<boolean>(() =>
    loadGamificationProfile().unlockedBadges.includes('K3 Guardian')
  );

  useEffect(() => {
    const unsubscribe = voiceNarration.subscribe((speaking) => {
      setIsSpeakingK3(speaking);
    });
    return () => {
      stopNarration();
      unsubscribe();
    };
  }, []);

  const handleComplyK3 = () => {
    labSound.playSuccessChime();
    recordK3Compliance(experiment.id);
    setK3Complied(true);
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-sky-600 dark:text-sky-400">
              01. Pengenalan, Hipotesis Awal &amp; K3 Laboratorium
            </span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{experiment.domain}</span>
            <span aria-hidden="true">·</span>
            <span>{experiment.subCategory}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Est. {experiment.estimatedMinutes} Menit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
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
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
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
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm"
          >
            <span>{t('controls.openSimulation')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. BALANCED 2-COLUMN SPLIT (7 Cols Theory, Hypothesis & Safety : 5 Cols Readiness Quiz & Launch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (7 Cols): Theory, Hypothesis Formulation, K3 Safety & 3D Apparatus */}
        <div className="lg:col-span-7 space-y-5">
          {/* Theory & Key Equations Card */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
              <BookOpen className="w-4 h-4 text-sky-500" />
              <h2>Tinjauan Teori Ilmiah &amp; Persamaan Kunci</h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed comfort-prose">
              {experiment.theorySummary}
            </p>

            {experiment.keyEquations.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Rumus &amp; Hukum Dasar:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {experiment.keyEquations.map((eq, idx) => {
                    const cleanEq = eq
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
                      .replace(/\\cdot/g, '·')
                      .replace(/\\times/g, '×')
                      .replace(/\\approx/g, '≈')
                      .replace(/\\quad/g, ' ')
                      .replace(/\\max/g, 'max')
                      .replace(/\\sin/g, 'sin')
                      .replace(/\\cos/g, 'cos')
                      .replace(/\\tan/g, 'tan')
                      .replace(/\^2/g, '²')
                      .replace(/\^3/g, '³')
                      .replace(/\_\{([^}]+)\}/g, '_$1')
                      .replace(/\\/g, '');
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-sky-600 dark:text-sky-400 font-semibold leading-relaxed"
                      >
                        {cleanEq}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PILAR 3: Interactive Formula Concept Primer ala Brilliant.org */}
            <InteractiveFormulaPrimer
              moduleId={experiment.id}
              domain={experiment.domain}
              defaultExpanded={true}
            />

            {/* FITUR 4: Panduan Praktikum Alat Sekitar (DIY Kearifan Lokal 3T) */}
            <DIYLocalWisdomCard
              domain={experiment.domain}
              moduleId={experiment.id}
              defaultExpanded={true}
            />

            {/* Learning Objectives */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                <ListChecks className="w-4 h-4 text-emerald-500" />
                <h3>Capaian Pembelajaran (Jenjang {activeTier})</h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {currentObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed comfort-prose">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400 shrink-0">
                      0{i + 1}.
                    </span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Integrated Pre-Lab Hypothesis Scratchpad */}
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
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <h2>{t('safety.sectionTitle')}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleK3Narration}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSpeakingK3
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isSpeakingK3 ? t('safety.stopNarration') : t('safety.listenNarration')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleComplyK3}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    k3Complied
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{k3Complied ? t('safety.compliedBadge') : t('safety.complyButton')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {experiment.safetyNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-800 dark:text-amber-200/90 flex items-start gap-2.5 leading-relaxed comfort-prose"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>

            {/* Apparatus Grid */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                <Atom className="w-4 h-4 text-sky-500" />
                <h3>{t('apparatus.header')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {experiment.apparatusList.map((app, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{app}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 Cols): Interactive Pre-Lab Readiness Quiz with Scaffolded Hints */}
        <div className="lg:col-span-5 space-y-5">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-sky-500" />
                  <span>Kuis Kesiapan Pra-Praktikum</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dilengkapi petunjuk konsep bertahap sebelum memasuki kokpit 3D
                </p>
              </div>
              {quizResult && (
                <div className="text-right font-mono">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {quizResult.correct}/{quizResult.total}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">({quizResult.percentage}%)</span>
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
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-bold text-xs text-sky-500 shrink-0 mt-0.5">
                          0{qIdx + 1}.
                        </span>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed comfort-prose">
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
                        className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Lightbulb className="w-3 h-3" />
                        <span>{hintOpen ? 'Tutup Petunjuk' : 'Petunjuk'}</span>
                      </button>
                    </div>

                    {hintOpen && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-slate-700 dark:text-amber-200/90 leading-relaxed">
                        <strong>Petunjuk Konsep:</strong> {q.explanation.split('.')[0]}.
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isChoice = selected === optIdx;
                        let btnStyle =
                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-500';

                        if (quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            btnStyle =
                              'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                          } else if (isChoice && !isCorrect) {
                            btnStyle =
                              'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300';
                          }
                        } else if (isChoice) {
                          btnStyle =
                            'bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-bold';
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
                      <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <strong>Penjelasan:</strong> {q.explanation}
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
                  }}
                  disabled={Object.keys(selectedAnswers).length < experiment.preLabQuiz.length}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer"
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
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Ulangi Kuis Pra-Lab
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  recordK3Compliance(experiment.id);
                  onProceedToSimulation();
                }}
                className="w-full py-3 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>{t('controls.readyOpen3D')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
