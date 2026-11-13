import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  X,
  Target,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PRESET_MYSTERY_CHALLENGES,
  MysterySampleChallenge,
} from '../../utils/mysteryChallengeEngine';
import { labSound } from '../../utils/soundEngine';

export interface MysteryChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChallenge: (challenge: MysterySampleChallenge) => void;
  activeChallengeId?: string | null;
}

const DOMAIN_FILTERS = ['Semua', 'Fisika', 'Kimia', 'Biologi', 'Astronomi'] as const;

const DIFFICULTY_BADGE_MAP: Record<MysterySampleChallenge['difficulty'], string> = {
  Mudah: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40',
  Sedang: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40',
  'Tantangan Olimpiade':
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40',
};

export const MysteryChallengeModal: React.FC<MysteryChallengeModalProps> = ({
  isOpen,
  onClose,
  onSelectChallenge,
  activeChallengeId,
}) => {
  const [domainFilter, setDomainFilter] =
    useState<(typeof DOMAIN_FILTERS)[number]>('Semua');

  const filteredChallenges = useMemo(() => {
    if (domainFilter === 'Semua') return PRESET_MYSTERY_CHALLENGES;
    return PRESET_MYSTERY_CHALLENGES.filter((c) => c.domain === domainFilter);
  }, [domainFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mystery-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-sky-500/10 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Ujian Forensik Sains &amp; Blind Sample Verification
              </div>
              <h2
                id="mystery-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
              >
                Pilih Kasus Mystery Sample ({PRESET_MYSTERY_CHALLENGES.length} Kasus Tersedia)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Tutup modal ujian sampel misteri"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center gap-1.5">
            {DOMAIN_FILTERS.map((dom) => {
              const active = dom === domainFilter;
              return (
                <button
                  key={dom}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setDomainFilter(dom);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {dom}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Simulasi membuka modul praktikum &amp; memeriksa ketepatan kalkulasi Anda</span>
          </div>
        </div>

        {/* Challenge Cards Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredChallenges.map((ch) => {
            const isActive = ch.id === activeChallengeId;
            return (
              <div
                key={ch.id}
                className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-400 shadow-md'
                    : 'bg-slate-50/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-amber-400/60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-800 text-amber-300 font-mono text-[10px] font-bold">
                        {ch.codename}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                        {ch.domain}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        DIFFICULTY_BADGE_MAP[ch.difficulty]
                      }`}
                    >
                      {ch.difficulty}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                    {ch.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ch.storyDescription}
                  </p>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-500" />
                      Target Pengukuran:
                    </span>
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {ch.hiddenParamLabel} ({ch.hiddenParamUnit})
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(680);
                    onSelectChallenge(ch);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isActive ? 'Lanjutkan Misi Ini di Kokpit 3D' : 'Mulai Ujian Sampel 3D'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
