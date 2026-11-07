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
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Square,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import {
  speakNarration,
  stopNarration,
  isSpeaking,
  voiceNarration,
} from '../utils/voiceNarrationEngine';

interface PreLabBriefingViewProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  onProceedToSimulation: () => void;
  onBackToLobby: () => void;
}

export const PreLabBriefingView: React.FC<PreLabBriefingViewProps> = ({
  experiment,
  activeTier,
  onProceedToSimulation,
  onBackToLobby,
}) => {
  const [activeTab, setActiveTab] = useState<'objectives' | 'safety' | 'quiz'>('objectives');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [isSpeakingK3, setIsSpeakingK3] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = voiceNarration.subscribe((speaking) => {
      setIsSpeakingK3(speaking);
    });
    return () => {
      stopNarration();
      unsubscribe();
    };
  }, []);

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

  return (
    <div className="max-w-[1100px] mx-auto pb-24 space-y-6 select-text animate-in fade-in duration-200">
      {/* 1. Header Card: Experiment Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
                Langkah 1: Pengenalan & K3
              </span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{experiment.domain}</span>
              <span aria-hidden="true">·</span>
              <span>{experiment.subCategory}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {experiment.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Est. {experiment.estimatedMinutes} Menit</span>
            </div>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToLobby();
              }}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer px-2 py-1"
            >
              Ganti Modul
            </button>
          </div>
        </div>

        {/* Tab Navigator */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl max-w-md">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setActiveTab('objectives');
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'objectives'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tujuan & Teori</span>
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setActiveTab('safety');
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Alat & K3</span>
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setActiveTab('quiz');
            }}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Kuis K3 ({experiment.preLabQuiz.length})</span>
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT */}
      {activeTab === 'objectives' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Objectives Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <ListChecks className="w-4 h-4 text-sky-500" />
              <h2>Capaian Pembelajaran (Jenjang {activeTier})</h2>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {currentObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-600 dark:text-sky-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Theory & Key Equations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <h2>Tinjauan Teori Ilmiah</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {experiment.theorySummary}
            </p>

            {experiment.keyEquations.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Persamaan Kunci:
                </span>
                <div className="space-y-1.5">
                  {experiment.keyEquations.map((eq, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-sky-600 dark:text-sky-400 font-semibold"
                    >
                      {eq}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Apparatus Checklist */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Atom className="w-4 h-4 text-sky-500" />
              <h2>Daftar Alat & Bahan Praktikum 3D</h2>
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

          {/* Safety Protocols (K3) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <h2>Aturan Keselamatan Kerja Lab (K3)</h2>
              </div>

              {/* Voice Narration Audio Button */}
              <button
                type="button"
                onClick={handleToggleK3Narration}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  isSpeakingK3
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                }`}
                title={isSpeakingK3 ? 'Hentikan narasi suara K3' : 'Dengarkan pembacaan aturan K3 laboratorium'}
              >
                {isSpeakingK3 ? (
                  <>
                    {/* Visual Sound Wave Animation */}
                    <span className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 h-2.5 bg-slate-950 animate-pulse" />
                      <span className="w-0.5 h-4 bg-slate-950 animate-bounce" />
                      <span className="w-0.5 h-3 bg-slate-950 animate-pulse" />
                      <span className="w-0.5 h-1.5 bg-slate-950 animate-bounce" />
                    </span>
                    <span>Hentikan Suara</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Dengarkan Pengarahan K3</span>
                  </>
                )}
              </button>
            </div>
            <div className="space-y-2.5">
              {experiment.safetyNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-800 dark:text-amber-200/90 flex items-start gap-2.5 leading-relaxed"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Kuis Pemahaman Keselamatan Kerja & Prosedur
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jawab pertanyaan berikut untuk memverifikasi kesiapan Anda sebelum memasuki meja simulasi 3D.
              </p>
            </div>
            {quizResult && (
              <div className="text-right">
                <span className="text-lg font-bold font-mono text-sky-500">
                  {quizResult.correct}/{quizResult.total}
                </span>
                <span className="text-xs text-slate-400 ml-1">Benar ({quizResult.percentage}%)</span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {experiment.preLabQuiz.map((q, qIdx) => {
              const selected = selectedAnswers[q.id];
              const isAnswered = selected !== undefined;
              const isCorrect = selected === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono font-bold text-xs text-sky-500 shrink-0 mt-0.5">
                      Q{qIdx + 1}.
                    </span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {q.question}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const isChoice = selected === optIdx;
                      let btnStyle = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-500';

                      if (quizSubmitted) {
                        if (optIdx === q.correctIndex) {
                          btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                        } else if (isChoice && !isCorrect) {
                          btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300';
                        }
                      } else if (isChoice) {
                        btnStyle = 'bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-bold';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${btnStyle}`}
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
                    <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                      💡 {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            {!quizSubmitted ? (
              <button
                type="button"
                onClick={() => {
                  labSound.playRecordSuccess();
                  setQuizSubmitted(true);
                }}
                disabled={Object.keys(selectedAnswers).length < experiment.preLabQuiz.length}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-sky-600 dark:bg-slate-800 dark:hover:bg-sky-600 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Periksa Jawaban Kuis
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedAnswers({});
                  setQuizSubmitted(false);
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                Ulangi Kuis
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onProceedToSimulation();
              }}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Saya Siap, Buka Meja Simulasi 3D</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Primary CTA Banner */}
      {activeTab !== 'quiz' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Siap Melakukan Pengambilan Data Eksperimen?
              </h3>
              <p className="text-xs text-slate-300">
                Pahami aparatus dan aturan keselamatan, lalu masuki meja simulasi virtual untuk memanipulasi variabel.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onProceedToSimulation();
            }}
            className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            <span>Saya Siap, Buka Meja Simulasi 3D →</span>
          </button>
        </div>
      )}
    </div>
  );
};
