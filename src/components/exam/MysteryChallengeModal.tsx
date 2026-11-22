import React, { useEffect, useMemo, useState } from 'react';
import {
  FlaskConical,
  X,
  Target,
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mystery-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Ujian Forensik Sains &amp; Blind Sample Verification
              </div>
              <h2
                id="mystery-modal-title"
                className="text-base sm:text-lg font-extrabold text-[var(--comfort-text)]"
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
            className="p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-elevated)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Tutup modal ujian sampel misteri"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--comfort-bg)]">
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
                      : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
                  }`}
                >
                  {dom}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-[var(--comfort-text-muted)] flex items-center gap-1.5">
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
                className={`rounded-2xl p-4 border transition-colors flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'bg-amber-500/8 border-amber-500/60 shadow-sm'
                    : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-amber-500/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold">
                        {ch.codename}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                        {ch.domain}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        DIFFICULTY_BADGE_MAP[ch.difficulty]
                      }`}
                    >
                      {ch.difficulty}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[var(--comfort-text)] leading-snug">
                    {ch.title}
                  </h3>

                  <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                    {ch.storyDescription}
                  </p>

                  <div className="p-2.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[11px] flex items-center justify-between gap-2">
                    <span className="text-[var(--comfort-text-muted)] flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-500" />
                      Target Pengukuran:
                    </span>
                    <strong className="font-mono text-[var(--comfort-text)]">
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
                  <Target className="w-3.5 h-3.5" />
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
