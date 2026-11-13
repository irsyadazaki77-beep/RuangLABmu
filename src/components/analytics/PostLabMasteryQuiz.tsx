import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
} from 'lucide-react';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';

export interface PostLabMasteryQuizProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  onQuizCompleted?: (score: number, correctCount: number) => void;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
}

export const PostLabMasteryQuiz: React.FC<PostLabMasteryQuizProps> = ({
  records,
  activeStudentName,
  onQuizCompleted,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Generate 3 contextual multiple-choice questions
  const sampleRecord = records[0];
  const domainLabel = sampleRecord?.domain || 'Fisika & Sains';

  const questions: QuizQuestion[] = [
    {
      id: 'q1-regression-meaning',
      question: `Berdasarkan ${records.length} data uji yang Anda catat pada praktikum ${domainLabel}, apa makna fisik dari nilai koefisien korelasi determinasi R² yang mendekati 1.0?`,
      options: [
        { key: 'A', text: 'Semua instrumen laboratorium bekerja tanpa adanya ketidakpastian pengukuran.' },
        { key: 'B', text: 'Variasi pada variabel terikat (Y) dapat dijelaskan dengan sangat presisi oleh model hubungan variabel bebas (X).' },
        { key: 'C', text: 'Gaya gesek dan disipasi energi diabaikan sepenuhnya dalam eksperimen.' },
        { key: 'D', text: 'Nilai galat pengukuran meningkat seiring pertambahan jumlah uji coba.' },
      ],
      correctKey: 'B',
      explanation: 'Nilai R² mendekati 1.0 (100%) membuktikan bahwa varians data respons eksperimen sangat selaras dengan kurva prediksi teoritis ilmiah.',
    },
    {
      id: 'q2-outlier-impact',
      question: 'Bagaimana pengaruh satu titik data anomali (outlier) terhadap gradien garis regresi linier OLS?',
      options: [
        { key: 'A', text: 'Tidak berpengaruh sama sekali karena metode kuadrat terkecil selalu mengabaikan deviasi ekstrim.' },
        { key: 'B', text: 'Hanya mengubah warna visual titik grafik di kanvas tanpa mempengaruhi persamaan matematis.' },
        { key: 'C', text: 'Menarik garis regresi ke arah titik anomali sehingga menurunkan nilai R² dan mengaburkan konstanta fisik sebenarnya.' },
        { key: 'D', text: 'Menaikkan nilai R² menjadi selalu 1.000 secara otomatis.' },
      ],
      correctKey: 'C',
      explanation: 'Karena regresi OLS meminimalkan kuadrat selisih jarak residual (Σ(y - y_hat)²), deviasi besar pada satu titik outlier memberikan pengaruh leverage yang signifikan.',
    },
    {
      id: 'q3-experimental-discipline',
      question: `Ketika menguji hipotesis pada modul ${domainLabel}, langkah ilmiah apa yang paling tepat sebelum menarik kesimpulan akhir?`,
      options: [
        { key: 'A', text: 'Mengubah nilai pengamatan langsung di spreadsheet agar sesuai dengan ekspektasi teori.' },
        { key: 'B', text: 'Melakukan repetisi uji coba minimal 3-5 kali, menganalisis residu galat, dan memverifikasi batas galat instrumen.' },
        { key: 'C', text: 'Hanya mencatat satu data pertama dan langsung mengabaikan data lainnya.' },
        { key: 'D', text: 'Menghentikan simulasi segera setelah mendapatkan satu angka yang disukai.' },
      ],
      correctKey: 'B',
      explanation: 'Repetisi data dan evaluasi ketidakpastian merupakan standar baku metode ilmiah untuk memastikan hasil observasi valid, presisi, dan reproducible.',
    },
  ];

  const handleSelectOption = (qId: string, optKey: string) => {
    if (isSubmitted) return;
    labSound.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optKey }));
  };

  const handleEvaluateQuiz = () => {
    labSound.playRecordSuccess();
    setIsSubmitted(true);

    let correctCount = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctKey) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    onQuizCompleted?.(score, correctCount);
  };

  const handleRetake = () => {
    labSound.playClick();
    setSelectedAnswers({});
    setIsSubmitted(false);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = questions.filter((q) => selectedAnswers[q.id] === q.correctKey).length;
  const score = Math.round((correctCount / questions.length) * 100);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Kuis Evaluasi Pemahaman Pasca-Praktikum
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              3 soal pilihan ganda kontekstual berdasarkan pengamatan eksperimen {activeStudentName}
            </p>
          </div>
        </div>

        {isSubmitted && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Skor Kuis: {score} / 100</span>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const userAns = selectedAnswers[q.id];
          const isCorrect = userAns === q.correctKey;

          return (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                  Pertanyaan #{idx + 1}
                </span>
                {isSubmitted && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                      isCorrect ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Benar (+33.3)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Kurang Tepat
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                {q.question}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {q.options.map((opt) => {
                  const isSelected = userAns === opt.key;
                  let optStyle =
                    'border-slate-200 dark:border-slate-700 hover:border-sky-400 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200';

                  if (isSubmitted) {
                    if (opt.key === q.correctKey) {
                      optStyle =
                        'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold';
                    } else if (isSelected && !isCorrect) {
                      optStyle =
                        'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 line-through';
                    }
                  } else if (isSelected) {
                    optStyle =
                      'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 font-bold';
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(q.id, opt.key)}
                      className={`text-left text-xs p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${optStyle}`}
                    >
                      <span className="font-mono font-bold text-slate-400 shrink-0">
                        {opt.key}.
                      </span>
                      <span className="leading-relaxed">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation upon submission */}
              {isSubmitted && (
                <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-200 leading-relaxed">
                  <strong>Pembahasan Ilmiah:</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Terjawab {answeredCount} dari {questions.length} soal
        </div>

        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <button
              type="button"
              onClick={handleRetake}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ulangi Kuis</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={answeredCount < questions.length}
              onClick={handleEvaluateQuiz}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Kirim Jawaban Kuis
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
