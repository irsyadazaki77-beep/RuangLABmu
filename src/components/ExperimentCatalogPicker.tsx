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

  // Reset subcategory when switching science domains
  React.useEffect(() => {
    setSelectedSubCategory('all');
  }, [domain]);

  const domainExperiments = useMemo(() => {
    return getExperimentsByDomain(domain);
  }, [domain]);

  const subCategories = useMemo(() => {
    const set = new Set<string>();
    domainExperiments.forEach((exp) => set.add(exp.subCategory));
    return ['all', ...Array.from(set)];
  }, [domainExperiments]);

  const filteredExperiments = useMemo(() => {
    return domainExperiments.filter((exp) => {
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
  }, [domainExperiments, tierFilter, selectedSubCategory, searchQuery]);

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold">
              01. Tahap Persiapan & Pemilihan Modul
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              Pilih Bidang Sains & Modul Eksperimen
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Pelajari capaian pembelajaran serta prosedur Keselamatan Kerja (K3), lalu lanjutkan ke ruang simulasi 3D.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul modul, alat, atau konsep..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
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
                      : 'bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ' +
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
                      className={`text-[11px] mt-0.5 line-clamp-1 ${
                        isSelected
                          ? 'text-white/85'
                          : 'text-slate-500 dark:text-slate-400'
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
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
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
                      ? 'bg-slate-900 dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                      ? 'bg-slate-900 dark:bg-slate-700 text-white font-medium'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
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
                  ? 'border-sky-500 bg-white dark:bg-slate-900 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                {/* Unboxed Clean Metadata Row (Zero-Pill Discipline) */}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <div className="flex items-center gap-1.5 truncate">
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
                    className={`font-mono text-[11px] shrink-0 ${
                      isSafetyVerified
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isSafetyVerified ? '● K3 Siap' : '○ Cek K3'}
                  </span>
                </div>

                {/* Primary Title */}
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                  {exp.title}
                </h3>

                {/* Theory Summary */}
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {exp.theorySummary}
                </p>

                {/* Primary Formula Box */}
                {exp.keyEquations.length > 0 && (
                  <div className="mt-3 px-3 py-2 bg-slate-50 dark:bg-slate-950/70 rounded-lg border border-slate-200/80 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-sky-300 truncate">
                    {exp.keyEquations[0]}
                  </div>
                )}

                {/* Unboxed Apparatus List */}
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Alat Utama:{' '}
                  </span>
                  {exp.apparatusList.slice(0, 3).join(' · ')}
                </div>
              </div>

              {/* Action Buttons: Step 1A (Pre-Lab & K3) -> Step 1B (Start 3D Lab) */}
              <div className="flex items-center gap-2.5 mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onOpenPreLabModal(exp);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
          <BookOpen className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Tidak ada modul yang cocok dengan pencarian Anda
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Coba ubah filter jenjang kurikulum atau kata kunci pencarian di atas.
          </p>
        </div>
      )}
    </div>
  );
};
