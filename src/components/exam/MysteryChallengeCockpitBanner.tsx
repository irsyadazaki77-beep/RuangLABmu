import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  evaluateMysterySubmission,
} from '../../utils/mysteryChallengeEngine';
import { labSound } from '../../utils/soundEngine';

export interface MysteryChallengeCockpitBannerProps {
  challenge: MysterySampleChallenge;
  studentName: string;
  onSubmitResult: (
    studentName: string,
    result: MysterySubmissionResult,
    challengeTitle: string
  ) => void;
  onDismiss: () => void;
  onAskDrLabMu?: (prompt: string) => void;
}

export const MysteryChallengeCockpitBanner: React.FC<
  MysteryChallengeCockpitBannerProps
> = ({ challenge, studentName, onSubmitResult, onDismiss, onAskDrLabMu }) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const [guessInput, setGuessInput] = useState<string>('');
  const [revealedCluesCount, setRevealedCluesCount] = useState<number>(1);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MysterySubmissionResult | null>(null);

  useEffect(() => {
    setGuessInput('');
    setRevealedCluesCount(1);
    setShowSolution(false);
    setValidationError(null);
    setLastResult(null);
    setExpanded(true);
  }, [challenge.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guessInput.trim();
    const numericGuess = Number(trimmed);
    if (!trimmed || !Number.isFinite(numericGuess)) {
      setValidationError(
        `Masukkan angka numerik yang valid untuk ${challenge.hiddenParamLabel}.`
      );
      return;
    }

    setValidationError(null);
    const result = evaluateMysterySubmission(challenge, numericGuess);
    setLastResult(result);
    if (result.passed) {
      labSound.playSuccess?.();
    } else {
      labSound.playClick(420);
    }
    onSubmitResult(studentName, result, challenge.title);
  };

  return (
    <div className="mx-3 sm:mx-4 mt-2 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-50/95 via-white/95 to-orange-50/95 dark:from-amber-950/50 dark:via-slate-900/95 dark:to-orange-950/40 shadow-md overflow-hidden">
      {/* Compact Top Bar */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px] font-bold">
                {challenge.codename}
              </span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Ujian Forensik Aktif ({challenge.difficulty})
              </span>
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {challenge.title} — Cari: {challenge.hiddenParamLabel} ({challenge.hiddenParamUnit})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setExpanded((prev) => !prev);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Ringkas</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Buka Panel Ujian</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onDismiss();
            }}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
            title="Akhiri / Tutup Ujian Sampel"
            aria-label="Tutup Ujian Sampel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Forensic Workspace */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-amber-200/70 dark:border-amber-800/40 grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
          {/* Left: Story, Clues & Procedure */}
          <div className="lg:col-span-7 space-y-2">
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
              {challenge.storyDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Petunjuk Ilmiah ({revealedCluesCount}/{challenge.clues.length})</span>
                  </span>
                  {revealedCluesCount < challenge.clues.length && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setRevealedCluesCount((c) => Math.min(challenge.clues.length, c + 1));
                      }}
                      className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      + Buka Petunjuk Berikutnya
                    </button>
                  )}
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  {challenge.clues.slice(0, revealedCluesCount).map((clue, idx) => (
                    <li key={idx}>{clue}</li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  Prosedur Investigasi Disarankan
                </div>
                <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {challenge.suggestedProcedure.map((step, idx) => (
                    <div key={idx}>{step}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Submission Form & Evaluation */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-amber-300/60 dark:border-amber-800/50">
            <form onSubmit={handleSubmit} className="space-y-2">
              <label className="block">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Estimasi {challenge.hiddenParamLabel} ({challenge.hiddenParamUnit})
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder={`Contoh angka (${challenge.hiddenParamUnit})`}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Verifikasi</span>
                  </button>
                </div>
              </label>

              {validationError && (
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                  {validationError}
                </div>
              )}
            </form>

            {lastResult && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                  lastResult.passed
                    ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-400/40 text-rose-800 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className="flex items-center gap-1">
                    {lastResult.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{lastResult.verdict}</span>
                  </span>
                  <span className="font-mono">
                    Skor {lastResult.score}/100 · Galat {lastResult.errorPercentage}%
                  </span>
                </div>
                <p>{lastResult.feedbackText}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {onAskDrLabMu && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onAskDrLabMu(
                      `Bantu saya menganalisis kasus Mystery Sample "${challenge.title}" (${challenge.codename}) untuk menemukan ${challenge.hiddenParamLabel} (${challenge.hiddenParamUnit}). Jangan langsung beri jawaban angka, pandu saya secara Sokratik langkah demi langkah!`
                    );
                  }}
                  className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Minta Panduan Sokratik Dr. LabMu</span>
                </button>
              )}

              {lastResult && (
                <button
                  type="button"
                  onClick={() => setShowSolution((s) => !s)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  {showSolution ? 'Sembunyikan Kunci Solusi' : 'Lihat Pembahasan Kunci'}
                </button>
              )}
            </div>

            {showSolution && lastResult && (
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200">
                <strong>Pembahasan Ilmiah:</strong> {challenge.explanationSolution}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
