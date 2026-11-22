import React, { useState } from 'react';
import { Radio, Send } from 'lucide-react';
import { StudentProgressItem } from '../TeacherDashboardView';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  PRESET_MYSTERY_CHALLENGES,
} from '../../utils/mysteryChallengeEngine';
import { labSound } from '../../utils/soundEngine';

export interface TeacherMysteryExamTabProps {
  students: StudentProgressItem[];
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onBroadcastMysteryChallenge?: (challenge: MysterySampleChallenge) => void;
  mysterySubmissions?: MysterySubmissionResult[];
  onSendTeacherFeedback: (targetStudentId: string, message: string) => void;
}

export const TeacherMysteryExamTab: React.FC<TeacherMysteryExamTabProps> = ({
  students,
  activeMysteryChallenge,
  onBroadcastMysteryChallenge,
  mysterySubmissions = [],
  onSendTeacherFeedback,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackError, setFeedbackError] = useState<string>('');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    PRESET_MYSTERY_CHALLENGES[0].id
  );
  const [challengeBuilderMode, setChallengeBuilderMode] = useState<'preset' | 'custom'>('preset');
  const [customDomain, setCustomDomain] = useState<'Fisika' | 'Kimia' | 'Astronomi'>('Kimia');
  const [customCodename, setCustomCodename] = useState<string>('SAMPEL-KUSTOM-09');
  const [customTitle, setCustomTitle] = useState<string>('Uji Konsentrasi Larutan Asam X');
  const [customParamLabel] = useState<string>('Molaritas Asam (M_a)');
  const [customSecretValue, setCustomSecretValue] = useState<string>('0.32');
  const [customUnit, setCustomUnit] = useState<string>('M');
  const [customTolerancePct, setCustomTolerancePct] = useState<string>('5');
  const [customStory, setCustomStory] = useState<string>(
    'Lakukan titrasi sampel larutan asam tak dikenal ini menggunakan NaOH standar hingga mencapai titik ekuivalen, lalu hitung konsentrasi molarnya!'
  );

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackError('Tulis pesan umpan balik atau arahan praktikum terlebih dahulu.');
      return;
    }
    setFeedbackError('');
    labSound.playRecordSuccess();
    onSendTeacherFeedback(selectedStudentId, feedbackMessage.trim());
    setFeedbackMessage('');
  };

  return (
    <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* 1. Mystery Challenge Broadcast & Submissions */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl p-5 space-y-4">
        <div className="border-b border-[var(--comfort-border)] pb-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[var(--comfort-text)] flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-500" />
              <span>Siaran Ujian Sampel Misterius</span>
            </h2>
          </div>
          <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
            Siarkan sampel tak dikenal ke seluruh siswa untuk diuji secara kuantitatif.
          </p>
          {activeMysteryChallenge && (
            <div className="pt-1 text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
              Aktif: {activeMysteryChallenge.codename} ({activeMysteryChallenge.domain})
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setChallengeBuilderMode('preset');
            }}
            className={`py-1.5 px-2 rounded-lg font-semibold transition-colors cursor-pointer ${
              challengeBuilderMode === 'preset'
                ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            Paket Preset ({PRESET_MYSTERY_CHALLENGES.length})
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setChallengeBuilderMode('custom');
            }}
            className={`py-1.5 px-2 rounded-lg font-semibold transition-colors cursor-pointer ${
              challengeBuilderMode === 'custom'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            + Racik Sampel Kustom
          </button>
        </div>

        {challengeBuilderMode === 'preset' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--comfort-text)] block mb-1">
                Pilih Paket Tantangan:
              </label>
              <select
                value={selectedChallengeId}
                onChange={(e) => setSelectedChallengeId(e.target.value)}
                className="w-full text-xs font-mono bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl p-2.5 text-[var(--comfort-text)] focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {PRESET_MYSTERY_CHALLENGES.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    [{ch.domain.toUpperCase()}] {ch.codename}: {ch.title} ({ch.hiddenParamLabel})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                labSound.playRecordSuccess();
                const ch = PRESET_MYSTERY_CHALLENGES.find((c) => c.id === selectedChallengeId);
                if (ch && onBroadcastMysteryChallenge) {
                  onBroadcastMysteryChallenge(ch);
                }
              }}
              className="w-full py-2.5 px-4 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              <span>Siarkan Tantangan ke Kelas</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-[var(--comfort-text-muted)] mb-0.5">
                  Domain Lab
                </label>
                <select
                  value={customDomain}
                  onChange={(e) =>
                    setCustomDomain(e.target.value as 'Fisika' | 'Kimia' | 'Astronomi')
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs"
                >
                  <option value="Fisika">Fisika</option>
                  <option value="Kimia">Kimia</option>
                  <option value="Astronomi">Astronomi</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--comfort-text-muted)] mb-0.5">
                  Kode Sampel
                </label>
                <input
                  type="text"
                  value={customCodename}
                  onChange={(e) => setCustomCodename(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--comfort-text-muted)] mb-0.5">
                Judul Ujian Sampel
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <label className="block text-[10px] text-[var(--comfort-text-muted)] mb-0.5">
                  Nilai Rahasia
                </label>
                <input
                  type="number"
                  step="any"
                  value={customSecretValue}
                  onChange={(e) => setCustomSecretValue(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--comfort-text-muted)] mb-0.5">
                  Satuan
                </label>
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--comfort-text-muted)] mb-0.5">
                  Toleransi (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={customTolerancePct}
                  onChange={(e) => setCustomTolerancePct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--comfort-text-muted)] mb-0.5">
                Instruksi Kasus untuk Siswa
              </label>
              <textarea
                rows={2}
                value={customStory}
                onChange={(e) => setCustomStory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const secretNum = parseFloat(customSecretValue);
                if (Number.isNaN(secretNum)) return;
                labSound.playRecordSuccess();
                const customChallenge: MysterySampleChallenge = {
                  id: `custom-${Date.now()}`,
                  codename: customCodename.trim() || 'SAMPEL-KUSTOM',
                  domain: customDomain,
                  moduleId:
                    customDomain === 'Fisika'
                      ? 'spring-hooke'
                      : customDomain === 'Kimia'
                      ? 'acid-base-titration'
                      : 'solar-kepler',
                  difficulty: 'Sedang',
                  title: customTitle.trim() || 'Ujian Sampel Kustom',
                  storyDescription: customStory.trim(),
                  hiddenParamKey: 'customTarget',
                  hiddenParamLabel: customParamLabel.trim() || 'Parameter Target',
                  hiddenParamUnit: customUnit.trim() || 'satuan',
                  actualHiddenValue: secretNum,
                  acceptableTolerancePct: Math.max(1, parseFloat(customTolerancePct) || 5),
                  clues: [
                    'Lakukan minimal 3 variasi pengukuran dan catat pada tabel pengamatan.',
                    'Gunakan grafik regresi dan kalkulator ketidakpastian untuk mengestimasi parameter tersembunyi.',
                  ],
                  suggestedProcedure: [
                    '1. Atur parameter variabel bebas secara bertahap.',
                    '2. Catat hasil pengukuran di setiap variasi.',
                    '3. Hitung nilai parameter dari gradien atau persamaan modul.',
                  ],
                  formulaHint: 'Gunakan regresi dan persamaan modul terkait',
                  explanationSolution: `Nilai parameter sebenarnya adalah ${secretNum} ${customUnit.trim() || 'satuan'}.`,
                };
                if (onBroadcastMysteryChallenge) {
                  onBroadcastMysteryChallenge(customChallenge);
                }
              }}
              className="w-full py-2.5 px-4 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              <span>Siarkan Sampel Kustom ke Kelas</span>
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2">
          <div className="text-xs font-semibold text-[var(--comfort-text)]">
            Hasil Jawaban Siswa ({mysterySubmissions.length} Dikirim)
          </div>
          {mysterySubmissions.length === 0 ? (
            <div className="p-3 text-xs text-[var(--comfort-text-muted)] bg-[var(--comfort-surface-subtle)] rounded-xl border border-dashed border-[var(--comfort-border)]">
              Belum ada kiriman estimasi ujian misterius dari siswa.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 font-mono text-xs">
              {mysterySubmissions.map((sub, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-sans font-semibold text-[var(--comfort-text)]">
                      {sub.codename} · Tebakan: {sub.studentGuess}
                    </div>
                    <div className="text-[11px] text-[var(--comfort-text-muted)]">
                      Asli: {sub.actualValue} · Galat: {sub.errorPercentage}%
                    </div>
                  </div>
                  <span
                    className={`font-bold ${
                      sub.passed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {sub.score}/100
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Instructor Direct Feedback & Guidance Console */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl p-5 space-y-4">
        <div className="border-b border-[var(--comfort-border)] pb-3">
          <h3 className="text-base font-bold text-[var(--comfort-text)]">
            Kirim Umpan Balik &amp; Instruksi Pengajar
          </h3>
          <p className="text-xs text-[var(--comfort-text-muted)]">
            Pesan tampil di laci notifikasi siswa serta tercatat di diskusi kelompok
          </p>
        </div>

        <form onSubmit={handleBroadcastSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="teacher-target-select"
              className="block text-xs font-medium text-[var(--comfort-text)] mb-1"
            >
              Penerima Arahan
            </label>
            <select
              id="teacher-target-select"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl px-3 py-2 text-[var(--comfort-text)] focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="all">Seluruh Kelompok Praktikum (Broadcast)</option>
              {students.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  {stu.name} ({stu.groupId} — {stu.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="teacher-feedback-textarea"
              className="block text-xs font-medium text-[var(--comfort-text)] mb-1"
            >
              Isi Umpan Balik / Petunjuk Eksperimen
            </label>
            <textarea
              id="teacher-feedback-textarea"
              rows={3}
              value={feedbackMessage}
              onChange={(e) => {
                setFeedbackMessage(e.target.value);
                if (feedbackError) setFeedbackError('');
              }}
              placeholder="Contoh: Untuk Dimas (Kelompok 2), naikkan suhu kalorimeter di atas 85°C agar dekomposisi CaCO₃ mencapai ΔG < 0..."
              className="w-full text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl p-3 text-[var(--comfort-text)] focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            {feedbackError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                {feedbackError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[var(--comfort-text-muted)]">
              Template Cepat:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setFeedbackMessage(
                    'Perhatikan hubungan linier ΣF terhadap percepatan a. Pastikan minimal 3 variasi massa dicatat sebelum ekspor CSV.'
                  );
                }}
                className="px-2.5 py-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:opacity-90 text-[var(--comfort-text)] rounded-lg transition-colors cursor-pointer"
              >
                Cek Kemiringan Grafik F = m·a
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setFeedbackMessage(
                    'Pada titrasi asam-basa, amati lonjakan tajam pH di sekitar titik ekuivalen 20.0 mL dan catat ke LKS.'
                  );
                }}
                className="px-2.5 py-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:opacity-90 text-[var(--comfort-text)] rounded-lg transition-colors cursor-pointer"
              >
                Petunjuk Titik Ekuivalen Titrasi
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 min-h-[40px] text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Notifikasi Umpan Balik ke Siswa</span>
          </button>
        </form>
      </div>
    </div>
  );
};
