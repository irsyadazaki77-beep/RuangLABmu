import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Filter,
  CheckCircle2,
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CURRICULUM_CHAPTERS,
} from '../registry/curriculumChapters';
import { labSound } from '../utils/soundEngine';

interface ExperimentCatalogPickerProps {
  domain: ScienceDomain;
  currentExperimentId: string;
  activeTier: EducationTier;
  completedSafetyIds?: string[];
  onDomainChange?: (domain: ScienceDomain) => void;
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenPreLabModal: (experiment: ExperimentModule) => void;
  onTierChange?: (tier: EducationTier) => void;
}

const DOMAIN_OPTIONS: {
  id: ScienceDomain;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  activeBg: string;
}[] = [
  {
    id: 'fisika',
    label: 'Lab Fisika',
    desc: 'Mekanika, Tumbukan, Pegas & Gravitasi',
    icon: Atom,
    accentText: 'text-sky-600 dark:text-sky-400',
    activeBg: 'bg-sky-600 text-white border-sky-500',
  },
  {
    id: 'kimia',
    label: 'Lab Kimia',
    desc: 'Termokimia, Titrasi Asam-Basa & Sel Galvani',
    icon: FlaskConical,
    accentText: 'text-teal-600 dark:text-teal-400',
    activeBg: 'bg-teal-600 text-white border-teal-500',
  },
  {
    id: 'biologi',
    label: 'Lab Biologi',
    desc: 'Fotosintesis, Enzim Katalase & Osmosis Sel',
    icon: Leaf,
    accentText: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-600 text-white border-emerald-500',
  },
  {
    id: 'astronomi',
    label: 'Lab Astronomi',
    desc: 'Orbit Kepler, Rotasi Galaksi & Eksoplanet',
    icon: Orbit,
    accentText: 'text-indigo-600 dark:text-indigo-400',
    activeBg: 'bg-indigo-600 text-white border-indigo-500',
  },
];

export const ExperimentCatalogPicker: React.FC<ExperimentCatalogPickerProps> = ({
  domain,
  currentExperimentId,
  completedSafetyIds = [],
  onDomainChange,
  onSelectExperiment,
  onOpenPreLabModal,
  onTierChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<EducationTier | 'Semua'>('Semua');
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | 'all'>('all');

  // Reset subcategory and chapter when switching science domains
  React.useEffect(() => {
    setSelectedSubCategory('all');
    setSelectedChapterNum('all');
  }, [domain]);

  const domainExperiments = useMemo(() => {
    return getExperimentsByDomain(domain);
  }, [domain]);

  const domainChapters = useMemo(() => {
    return CURRICULUM_CHAPTERS.filter((ch) => ch.domain === domain);
  }, [domain]);

  const subCategories = useMemo(() => {
    const set = new Set<string>();
    domainExperiments.forEach((exp) => set.add(exp.subCategory));
    return ['all', ...Array.from(set)];
  }, [domainExperiments]);

  const filteredExperiments = useMemo(() => {
    return domainExperiments.filter((exp) => {
      if (selectedChapterNum !== 'all' && exp.chapterNumber !== selectedChapterNum) {
        return false;
      }
      if (tierFilter !== 'Semua' && !exp.supportedTiers.includes(tierFilter)) {
        return false;
      }
      if (selectedSubCategory !== 'all' && exp.subCategory !== selectedSubCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = exp.title.toLowerCase().includes(query);
        const matchSub = exp.subCategory.toLowerCase().includes(query);
        const matchTheory = exp.theorySummary.toLowerCase().includes(query);
        const matchApparatus = exp.apparatusList.some((a) =>
          a.toLowerCase().includes(query)
        );
        if (!matchTitle && !matchSub && !matchTheory && !matchApparatus) {
          return false;
        }
      }
      return true;
    });
  }, [domainExperiments, selectedChapterNum, tierFilter, selectedSubCategory, searchQuery]);

  const handleTierClick = (tier: EducationTier | 'Semua') => {
    labSound.playClick();
    setTierFilter(tier);
    if (tier !== 'Semua' && onTierChange) {
      onTierChange(tier);
    }
  };

  const getDifficultyText = (diff: 1 | 2 | 3) => {
    if (diff === 1) return 'Tingkat Dasar';
    if (diff === 2) return 'Tingkat Menengah';
    return 'Tingkat Lanjut';
  };

  return (
    <div className="space-y-6">
      {/* Step 1 Intro Banner & Science Domain Selector */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--comfort-border)] pb-4">
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold">
              01. Tahap Persiapan & Pemilihan Modul
            </div>
            <h1 className="text-xl font-bold text-[var(--comfort-text)] mt-0.5">
              Pilih Bidang Sains & Modul Eksperimen
            </h1>
            <p className="text-xs text-[var(--comfort-text-muted)] mt-1">
              Pelajari capaian pembelajaran serta prosedur Keselamatan Kerja (K3), lalu lanjutkan ke ruang simulasi 3D.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-[var(--comfort-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul modul, alat, atau konsep..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-lg text-[var(--comfort-text)] placeholder-[var(--comfort-text-muted)] focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* 4 Science Domain Cards */}
        {onDomainChange && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DOMAIN_OPTIONS.map((item) => {
              const Icon = item.icon;
              const isSelected = domain === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onDomainChange(item.id);
                  }}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? item.activeBg
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:bg-[var(--comfort-elevated)]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--comfort-surface)] border border-[var(--comfort-border)] ' +
                          item.accentText
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold whitespace-nowrap truncate">
                      {item.label}
                    </div>
                    <p
                      className={`text-2xs mt-0.5 line-clamp-1 ${
                        isSelected
                          ? 'text-white/85'
                          : 'text-[var(--comfort-text-muted)]'
                      }`}
                    >
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Bar: Tier & SubCategory */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--comfort-text-muted)] font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter Jenjang:
            </span>
            {(['Semua', 'SMP', 'SMA', 'Mahasiswa'] as const).map((t) => {
              const active = tierFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTierClick(t)}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {t === 'Mahasiswa' ? 'Perguruan Tinggi' : t}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
            {subCategories.map((sub) => {
              const active = selectedSubCategory === sub;
              const label = sub === 'all' ? 'Semua Topik' : sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setSelectedSubCategory(sub);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white font-medium'
                      : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chapter Filter Pills for the Domain */}
        {domainChapters.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 border-t border-[var(--comfort-border)] pt-2">
            <span className="text-[var(--comfort-text-muted)] font-medium mr-1 flex items-center gap-1 shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-sky-500" /> Bab Kurikulum:
            </span>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setSelectedChapterNum('all');
              }}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedChapterNum === 'all'
                  ? 'bg-sky-600 text-white font-medium'
                  : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
              }`}
            >
              Semua Bab
            </button>
            {domainChapters.map((ch) => {
              const active = selectedChapterNum === ch.chapterNumber;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setSelectedChapterNum(ch.chapterNumber);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white font-medium shadow-2xs'
                      : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {ch.shortTitle} ({ch.competencyTier.split(' ')[0]})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Experiment Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExperiments.map((exp) => {
          const isCurrent = exp.id === currentExperimentId;
          const isSafetyVerified = completedSafetyIds.includes(exp.id);
          const diffText = getDifficultyText(exp.difficulty);

          return (
            <div
              key={exp.id}
              className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                isCurrent
                  ? 'border-sky-500 bg-[var(--comfort-surface)] shadow-xs'
                  : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-sky-500/40'
              }`}
            >
              <div>
                {/* Unboxed Clean Metadata Row */}
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)] mb-2">
                  <div className="flex items-center gap-1.5 truncate">
                    {exp.chapterNumber && (
                      <span className="font-bold text-sky-700 dark:text-sky-300">
                        Bab {exp.chapterNumber} ·
                      </span>
                    )}
                    {exp.competencyLevel && (
                      <span className="font-mono text-2xs font-semibold text-[var(--comfort-text-muted)]">
                        {exp.competencyLevel} ·
                      </span>
                    )}
                    <span className="font-medium text-sky-600 dark:text-sky-400">
                      {exp.subCategory}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{diffText}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {exp.estimatedMinutes} mnt
                    </span>
                  </div>
                  <span
                    className={`font-mono text-2xs shrink-0 ${
                      isSafetyVerified
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isSafetyVerified ? '● K3 Siap' : '○ Cek K3'}
                  </span>
                </div>

                {/* Primary Title */}
                <h3 className="font-bold text-[var(--comfort-text)] text-base leading-snug">
                  {exp.title}
                </h3>

                {/* Theory Summary */}
                <p className="text-xs text-[var(--comfort-text-muted)] mt-2 line-clamp-2 leading-relaxed comfort-prose">
                  {exp.theorySummary}
                </p>

                {/* Subtle Curriculum Context Note */}
                <div className="mt-2 flex items-center gap-1.5 text-2xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Miskonsepsi &amp; Konteks Industri Lengkap</span>
                </div>

                {/* Primary Formula Box */}
                {exp.keyEquations.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)] font-mono text-xs text-[var(--comfort-text)] truncate">
                    {exp.keyEquations[0]}
                  </div>
                )}

                {/* Unboxed Apparatus List */}
                <div className="mt-3 text-xs text-[var(--comfort-text-muted)] truncate">
                  <span className="font-medium text-[var(--comfort-text)]">
                    Alat Utama:{' '}
                  </span>
                  {exp.apparatusList.slice(0, 3).join(' · ')}
                </div>
              </div>

              {/* Action Buttons: Step 1A (Pre-Lab & K3) -> Step 1B (Start 3D Lab) */}
              <div className="flex items-center gap-2.5 mt-5 pt-3.5 border-t border-[var(--comfort-border)]">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onOpenPreLabModal(exp);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[var(--comfort-text)] bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Panduan & K3</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    onSelectExperiment(exp);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isCurrent ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Buka Simulasi 3D</span>
                    </>
                  ) : (
                    <>
                      <span>Mulai Simulasi 3D</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredExperiments.length === 0 && (
        <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-8 text-center space-y-2">
          <BookOpen className="w-7 h-7 text-[var(--comfort-text-muted)] mx-auto" />
          <p className="text-sm font-semibold text-[var(--comfort-text)]">
            Tidak ada modul yang cocok dengan pencarian Anda
          </p>
          <p className="text-xs text-[var(--comfort-text-muted)]">
            Coba ubah filter jenjang kurikulum atau kata kunci pencarian di atas.
          </p>
        </div>
      )}
    </div>
  );
};
