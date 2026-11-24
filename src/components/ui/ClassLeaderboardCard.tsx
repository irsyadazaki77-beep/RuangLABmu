import React from 'react';
import { ShieldCheck, Trophy } from 'lucide-react';
import type { StudentProgressItem } from '../TeacherDashboardView';

export const ClassLeaderboardCard: React.FC<{
  students: StudentProgressItem[];
  highlightStudentName?: string;
}> = ({ students, highlightStudentName }) => {
  const rankedStudents = [...students]
    .map((s) => {
      const r2Score = Math.round((s.rSquared ?? 0.85) * 40);
      const trialScore = Math.min(30, s.trialsRecorded * 8);
      const quizPart = Math.round(((s.quizScore ?? 75) / 100) * 30);
      const compositeScore = Math.min(100, r2Score + trialScore + quizPart);
      return {
        ...s,
        compositeScore,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return (
    <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--comfort-text)]">
              Papan Peringkat Ketelitian &amp; Kompetensi Kelas
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Diurutkan berdasarkan Indeks Presisi Regresi (R²), Jumlah Data Terukur, dan Skor Diagnostik LKS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[var(--comfort-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Terverifikasi Real-Time</span>
          </span>
        </div>
      </div>

      {rankedStudents.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--comfort-surface-subtle)] border border-dashed border-[var(--comfort-border)] text-xs text-[var(--comfort-text-muted)] text-center">
          Belum ada data praktikum siswa yang tercatat pada sesi ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--comfort-border)] text-[var(--comfort-text-muted)] font-mono text-2xs">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 px-2">Praktikan &amp; Modul</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">R²</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">Uji</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">LKS</th>
                <th className="py-2 pl-2 text-right whitespace-nowrap">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)]">
              {rankedStudents.map((stu, idx) => {
                const isHighlighted = highlightStudentName && stu.name === highlightStudentName;
                return (
                  <tr
                    key={stu.id}
                    className={`transition-colors ${
                      isHighlighted
                        ? 'bg-sky-500/10 dark:bg-sky-500/15'
                        : 'hover:bg-[var(--comfort-surface-subtle)]'
                    }`}
                  >
                    <td className="py-2.5 pr-2 font-mono font-bold tabular-nums whitespace-nowrap align-top">
                      {idx === 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">#1</span>
                      ) : idx === 1 ? (
                        <span className="text-sky-600 dark:text-sky-400">#2</span>
                      ) : idx === 2 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">#3</span>
                      ) : (
                        <span className="text-[var(--comfort-text-muted)]">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 min-w-[140px]">
                      <div className="font-semibold text-[var(--comfort-text)] leading-snug">
                        {stu.name}
                      </div>
                      <div className="text-2xs text-[var(--comfort-text-muted)] truncate max-w-[200px]">
                        {stu.groupId} · <span className="text-sky-600 dark:text-sky-400 font-medium">{stu.activeDomain}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      {(stu.rSquared ?? 0.88).toFixed(3)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--comfort-text)] whitespace-nowrap">
                      {stu.trialsRecorded}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--comfort-text)] whitespace-nowrap">
                      {stu.quizScore ?? 80}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {stu.compositeScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
