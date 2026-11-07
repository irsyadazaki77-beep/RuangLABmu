import React, { useState, useMemo } from 'react';
import {
  Search,
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  EXPERIMENT_CATALOG,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';

interface LabLobbyHubProps {
  activeTier: EducationTier;
  studentName: string;
  studentGroup: string;
  completedModuleIds: string[];
  recordsCount: number;
  onTierChange: (tier: EducationTier) => void;
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenMysteryExam?: () => void;
}

const DOMAIN_ICONS: Record<
  ScienceDomain,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  fisika: Atom,
  kimia: FlaskConical,
  biologi: Leaf,
  astronomi: Orbit,
};

const DOMAIN_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0ea5e9',
  kimia: '#14b8a6',
  biologi: '#10b981',
  astronomi: '#6366f1',
};

export const LabLobbyHub: React.FC<LabLobbyHubProps> = ({
  activeTier,
  studentName,
  studentGroup,
  completedModuleIds,
  recordsCount,
  onTierChange,
  onSelectExperiment,
  onOpenMysteryExam,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<ScienceDomain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter modules based on tier, domain, and search
  const filteredModules = useMemo(() => {
    return EXPERIMENT_CATALOG.filter((mod) => {
      if (!mod.supportedTiers.includes(activeTier)) return false;
      if (selectedDomain !== 'all' && mod.domain !== selectedDomain) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = mod.title.toLowerCase().includes(q);
        const matchesSub = mod.subCategory.toLowerCase().includes(q);
        const matchesTheory = mod.theorySummary.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSub && !matchesTheory) return false;
      }

      return true;
    });
  }, [activeTier, selectedDomain, searchQuery]);

  return (
    <div className="max-w-[1380px] mx-auto pb-16 space-y-6 select-text">
      {/* 1. COMPACT WELCOME & PROGRESS STRIP (TOP) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-sky-600 dark:text-sky-400 font-bold">{studentName}</span>
            <span aria-hidden="true">·</span>
            <span>{studentGroup}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Katalog Laboratorium Virtual RuangLABmu
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Pilih modul eksperimen interaktif untuk memulai simulasi 3D dan analisis LKS bertahap.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs">
          <div className="text-center px-2">
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {completedModuleIds.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Selesai
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-2">
            <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
              {recordsCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Data Tercatat
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
          <div className="text-center px-2">
            <div className="text-xl font-bold font-mono text-amber-500 tabular-nums">
              {filteredModules.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Modul
            </div>
          </div>

          {onOpenMysteryExam && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onOpenMysteryExam();
              }}
              className="ml-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ujian Misterius →</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. SINGLE-ROW DOMAIN FILTER TABS + TIER FILTER + SEARCH */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Domain Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'Semua Domain' },
              { id: 'fisika', label: 'Fisika' },
              { id: 'kimia', label: 'Kimia' },
              { id: 'biologi', label: 'Biologi' },
              { id: 'astronomi', label: 'Astronomi' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDomain(tab.id as ScienceDomain | 'all');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedDomain === tab.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Tier Filter Tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-950 rounded-xl shrink-0">
              {(['SMP', 'SMA', 'Mahasiswa'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onTierChange(tier);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeTier === tier
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari eksperimen..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. CLEAN 3-COLUMN GRID OF EXPERIMENT CARDS */}
      <section className="space-y-3">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Menampilkan <strong className="text-slate-900 dark:text-white font-mono">{filteredModules.length}</strong> modul eksperimen
        </div>

        {filteredModules.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tidak ada modul praktikum yang sesuai dengan filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('all');
              }}
              className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredModules.map((exp) => {
              const isCompleted = completedModuleIds.includes(exp.id);
              const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
              const accentColor = DOMAIN_COLORS[exp.domain] || '#0ea5e9';

              // Extract 1 concise sentence description
              const conciseDesc =
                exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;

              return (
                <div
                  key={exp.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Content */}
                  <div className="space-y-2.5">
                    {/* Domain & Subcategory */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400">
                        <DomainIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                        <span className="capitalize">{exp.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span>{exp.subCategory}</span>
                      </div>
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                          <FileText className="w-3 h-3" /> Selesai
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-500 transition-colors">
                      {exp.title}
                    </h3>

                    {/* Exactly 1 Concise Sentence Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {conciseDesc}
                    </p>

                    {/* Max 3 Badge Tags: Tier, Duration, Difficulty */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        Jenjang {activeTier}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                        {exp.estimatedMinutes} menit
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/10 dark:bg-sky-500/20 text-[10px] font-mono font-semibold text-sky-600 dark:text-sky-300">
                        {exp.parameters.length} Parameter
                      </span>
                    </div>
                  </div>

                  {/* Card CTA */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {exp.apparatusList[0] || 'Simulasi 3D'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        onSelectExperiment(exp);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-sky-600 dark:bg-slate-800 dark:hover:bg-sky-600 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                    >
                      <span>Mulai Praktikum →</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
