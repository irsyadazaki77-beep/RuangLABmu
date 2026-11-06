import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Clock,
  Award,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle,
  Sparkles,
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
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenPreLabModal: (experiment: ExperimentModule) => void;
  onTierChange?: (tier: EducationTier) => void;
}

export const ExperimentCatalogPicker: React.FC<ExperimentCatalogPickerProps> = ({
  domain,
  currentExperimentId,
  activeTier,
  onSelectExperiment,
  onOpenPreLabModal,
  onTierChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<EducationTier | 'Semua'>(activeTier);

  // Sync internal tier filter if parent tier changes
  React.useEffect(() => {
    setTierFilter(activeTier);
  }, [activeTier]);

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
      // Tier filter
      if (tierFilter !== 'Semua' && !exp.supportedTiers.includes(tierFilter)) {
        return false;
      }
      // SubCategory filter
      if (selectedSubCategory !== 'all' && exp.subCategory !== selectedSubCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = exp.title.toLowerCase().includes(query);
        const matchSub = exp.subCategory.toLowerCase().includes(query);
        const matchTheory = exp.theorySummary.toLowerCase().includes(query);
        const matchApparatus = exp.apparatusList.some((a) => a.toLowerCase().includes(query));
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

  const getDifficultyLabel = (diff: 1 | 2 | 3) => {
    if (diff === 1) return { text: 'Tingkat Dasar', color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    if (diff === 2) return { text: 'Tingkat Menengah', color: 'text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800' };
    return { text: 'Tingkat Lanjut', color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6 shadow-sm">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Katalog Modul Praktikum Terstandar ({filteredExperiments.length} Modul)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kurikulum Terintegrasi SMP, SMA, dan Perguruan Tinggi (Mahasiswa)
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, alat, atau teori..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
      </div>

      {/* Filters: Education Tier & SubCategory */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 pb-2">
        {/* Tier filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Jenjang:
          </span>
          {(['Semua', 'SMP', 'SMA', 'Mahasiswa'] as const).map((t) => {
            const active = tierFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTierClick(t)}
                className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* SubCategory Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          {subCategories.map((sub) => {
            const active = selectedSubCategory === sub;
            const label = sub === 'all' ? 'Semua Kategori' : sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedSubCategory(sub);
                }}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-900 dark:bg-slate-700 text-white font-medium'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Experiment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
        {filteredExperiments.map((exp) => {
          const isCurrent = exp.id === currentExperimentId;
          const diff = getDifficultyLabel(exp.difficulty);

          return (
            <div
              key={exp.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-all duration-150 ${
                isCurrent
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div>
                {/* Badges row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-sm border border-sky-100 dark:border-sky-900/40">
                    {exp.subCategory}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-sm border font-medium ${diff.color}`}>
                      {diff.text}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      {exp.estimatedMinutes}m
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-1">
                  {exp.title}
                </h4>

                {/* Theory preview */}
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {exp.theorySummary}
                </p>

                {/* Formula pill */}
                {exp.keyEquations.length > 0 && (
                  <div className="mt-2.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200/70 dark:border-slate-700/60 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                    {exp.keyEquations[0]}
                  </div>
                )}

                {/* Apparatus preview */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {exp.apparatusList.slice(0, 2).map((app, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[140px]"
                    >
                      {app}
                    </span>
                  ))}
                  {exp.apparatusList.length > 2 && (
                    <span className="text-[10px] text-slate-400 px-1 py-0.5">
                      +{exp.apparatusList.length - 2} lagi
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onOpenPreLabModal(exp);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  K3 & Pre-Lab
                </button>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    onSelectExperiment(exp);
                  }}
                  disabled={isCurrent}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-sky-600 text-white cursor-default'
                      : 'bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                      Aktif
                    </>
                  ) : (
                    <>
                      Mulai
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
