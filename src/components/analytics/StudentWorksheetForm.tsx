import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  HelpCircle,
  Filter,
} from 'lucide-react';
import {
  WORKSHEET_QUESTIONS,
  gradeWorksheetAnswers,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { HypothesisNote } from '../ui/HypothesisAndCompareDock';

export interface StudentWorksheetFormProps {
  activeStudentName: string;
  activeGroupId: string;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (note: HypothesisNote) => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onPrintPDFReport?: (conclusionText: string) => void;
}

export const StudentWorksheetForm: React.FC<StudentWorksheetFormProps> = ({
  activeStudentName,
  activeGroupId,
  hypothesisNote,
  onChangeHypothesisNote,
  onSubmitQuizScore,
  onPrintPDFReport,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({
    'q-newton-1': '9.0',
    'q-collision-2': '4.0',
    'q-thermo-3': '-90.0',
    'q-titration-4': '20.0',
    'q-kepler-5': '8.0',
    'q-exoplanet-6': '1.0',
  });
  const [hintLevelByQuestion, setHintLevelByQuestion] = useState<Record<string, number>>({});
  const [lksDomainFilter, setLksDomainFilter] = useState<'Semua' | 'Fisika' | 'Kimia' | 'Astronomi'>('Semua');
  const [conclusionText, setConclusionText] = useState<string>(
    'Berdasarkan perolehan data percobaan dan kurva regresi kuantitatif, hipotesis awal terbukti valid. Hubungan antar variabel menunjukkan korelasi linear yang kuat sesuai teori ilmiah yang berlaku.'
  );
  const [gradedResult, setGradedResult] = useState<ReturnType<typeof gradeWorksheetAnswers> | null>(null);

  const filteredQuestions = WORKSHEET_QUESTIONS.filter((q) =>
    lksDomainFilter === 'Semua' ? true : q.domain === lksDomainFilter
  );

  const handleAdvanceHint = (qId: string) => {
    labSound.playClick();
    setHintLevelByQuestion((prev) => {
      const current = prev[qId] ?? 0;
      const next = current >= 3 ? 0 : current + 1;
      return { ...prev, [qId]: next };
    });
  };

  const handleGradeForm = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playRecordSuccess();
    const res = gradeWorksheetAnswers(answers);
    setGradedResult(res);
    onSubmitQuizScore?.(res.totalScore, res.correctCount);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Lembar Kerja Siswa (LKS) &amp; Pertanyaan Analisis
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Praktikan: <strong>{activeStudentName}</strong> ({activeGroupId})
            </p>
          </div>
        </div>

        {/* Filter and Print Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {(['Semua', 'Fisika', 'Kimia', 'Astronomi'] as const).map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setLksDomainFilter(dom)}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  lksDomainFilter === dom
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          {onPrintPDFReport && (
            <button
              type="button"
              onClick={() => onPrintPDFReport(conclusionText)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Hypothesis Review & Conclusion Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hipotesis Awal */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
            Hipotesis Awal Praktikum:
          </span>
          <textarea
            rows={3}
            value={hypothesisNote?.hypothesisText || ''}
            onChange={(e) => {
              if (onChangeHypothesisNote && hypothesisNote) {
                onChangeHypothesisNote({
                  ...hypothesisNote,
                  hypothesisText: e.target.value,
                });
              }
            }}
            placeholder="Tuliskan dugaan ilmiah Anda sebelum pengamatan..."
            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Kesimpulan Akhir */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
            Kesimpulan &amp; Refleksi Ilmiah:
          </span>
          <textarea
            rows={3}
            value={conclusionText}
            onChange={(e) => setConclusionText(e.target.value)}
            placeholder="Tuliskan kesimpulan komprehensif berdasarkan data..."
            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* LKS Questions Form */}
      <form onSubmit={handleGradeForm} className="space-y-4">
        <div className="space-y-3">
          {filteredQuestions.map((q, idx) => {
            const userAns = answers[q.id] || '';
            const hintLvl = hintLevelByQuestion[q.id] || 0;
            const evalItem = gradedResult?.results?.[q.id];

            return (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        Soal {idx + 1} · {q.domain}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Bobot: {Math.round(100 / (filteredQuestions.length || 1))} Poin
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {q.questionText}
                    </p>
                  </div>

                  {/* Scaffolded Hint Trigger */}
                  <button
                    type="button"
                    onClick={() => handleAdvanceHint(q.id)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Petunjuk ({hintLvl}/3)</span>
                  </button>
                </div>

                {/* Scaffolded Hints Accordion */}
                {hintLvl > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="font-bold text-[11px]">
                      {hintLvl === 1
                        ? '💡 Petunjuk Tingkat 1 (Konseptual):'
                        : hintLvl === 2
                        ? '📐 Petunjuk Tingkat 2 (Rumus & Variabel):'
                        : '🎯 Petunjuk Tingkat 3 (Langkah Solusi):'}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {q.scaffoldedHints?.[hintLvl - 1] || q.formulaHint || q.explanation}
                    </p>
                  </div>
                )}

                {/* Input and Evaluation Feedback */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userAns}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Ketikkan nilai numerik atau jawaban..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                  {evalItem && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        evalItem.isCorrect
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {evalItem.isCorrect ? '✓ Benar' : '✗ Kurang Tepat'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit and Grade Button */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {gradedResult && (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                Nilai LKS: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{gradedResult.totalScore}/100</strong> ({gradedResult.correctCount} dari {WORKSHEET_QUESTIONS.length} Soal Benar)
              </span>
            </div>
          )}

          <button
            type="submit"
            className="ml-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
          >
            Periksa &amp; Beri Nilai LKS
          </button>
        </div>
      </form>
    </div>
  );
};
