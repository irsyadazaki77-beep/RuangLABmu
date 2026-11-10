import React, { useState, useMemo } from 'react';
import {
  Search,
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
  Sparkles,
  CheckCircle2,
  Eye,
  BrainCircuit,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  EXPERIMENT_CATALOG,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import { ComfortThemeMode } from './ui/VisualComfortToolbar';
import {
  ScientificBadge,
  AchievementBadgesStrip,
} from './ui/ScientificEnhancementSuite';

interface LabLobbyHubProps {
  activeTier: EducationTier;
  studentName: string;
  studentGroup: string;
  completedModuleIds: string[];
  recordsCount: number;
  onTierChange: (tier: EducationTier) => void;
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenMysteryExam?: () => void;
  comfortTheme?: ComfortThemeMode;
  onChangeComfortTheme?: (theme: ComfortThemeMode) => void;
  badges?: ScientificBadge[];
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

type CognitiveLoadTier = 'all' | 'ringan' | 'terstruktur' | 'analitik';

function getCognitiveLoadProfile(mod: ExperimentModule): {
  tier: 'ringan' | 'terstruktur' | 'analitik';
  label: string;
  symbol: string;
  toneClass: string;
} {
  const varCount = mod.parameters.length;
  if (varCount <= 3 && mod.estimatedMinutes <= 20) {
    return {
      tier: 'ringan',
      label: 'Beban Kognitif Ringan · Eksplorasi Intuitif',
      symbol: '● RINGAN',
      toneClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  if (varCount <= 4) {
    return {
      tier: 'terstruktur',
      label: 'Beban Kognitif Terstruktur · Multi-Variabel',
      symbol: '◆ TERSTRUKTUR',
      toneClass: 'text-sky-700 dark:text-sky-400',
    };
  }
  return {
    tier: 'analitik',
    label: 'Beban Kognitif Analitik · Presisi Tinggi',
    symbol: '▲ ANALITIK',
    toneClass: 'text-amber-700 dark:text-amber-400',
  };
}

export const LabLobbyHub: React.FC<LabLobbyHubProps> = ({
  activeTier,
  studentName,
  studentGroup,
  completedModuleIds,
  recordsCount,
  onTierChange,
  onSelectExperiment,
  onOpenMysteryExam,
  comfortTheme = 'dark',
  onChangeComfortTheme,
  badges = [],
}) => {
  const [selectedDomain, setSelectedDomain] = useState<ScienceDomain | 'all'>('all');
  const [cognitiveFilter, setCognitiveFilter] = useState<CognitiveLoadTier>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredModules = useMemo(() => {
    return EXPERIMENT_CATALOG.filter((mod) => {
      if (!mod.supportedTiers.includes(activeTier)) return false;
      if (selectedDomain !== 'all' && mod.domain !== selectedDomain) return false;

      if (cognitiveFilter !== 'all') {
        const cog = getCognitiveLoadProfile(mod);
        if (cog.tier !== cognitiveFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = mod.title.toLowerCase().includes(q);
        const matchesSub = mod.subCategory.toLowerCase().includes(q);
        const matchesTheory = mod.theorySummary.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSub && !matchesTheory) return false;
      }

      return true;
    });
  }, [activeTier, selectedDomain, cognitiveFilter, searchQuery]);

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 select-text">
      {/* 1. UNIFIED HERO & ERGONOMIC CONTROL DECK */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-sky-600 dark:text-sky-400">{studentName}</span>
              <span aria-hidden="true">·</span>
              <span>{studentGroup}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Jenjang {activeTier}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                <Eye className="w-3.5 h-3.5" />
                <span>Ergonomi Visual Aktif</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Katalog Laboratorium Sains Interaktif 3D
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed comfort-prose">
              Pilih modul eksperimen sesuai tingkat kenyamanan belajar Anda: dilengkapi Panduan Langkah Mikro 3D bebas distraksi, Buku Catatan Hipotesis, Komparator 2 Percobaan, dan Petunjuk Bertahap LKS.
            </p>
          </div>

          {/* Right KPI Strip & Mystery Exam CTA */}
          <div className="flex flex-wrap items-center gap-4 shrink-0 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl text-xs">
            <div className="text-center px-2">
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {completedModuleIds.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Modul Selesai
              </div>
            </div>
            <div className="w-px h-7 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="text-center px-2">
              <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                {recordsCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Data Tercatat
              </div>
            </div>
            <div className="w-px h-7 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="text-center px-2">
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {filteredModules.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Modul Tersedia
              </div>
            </div>

            {onOpenMysteryExam && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onOpenMysteryExam();
                }}
                className="ml-1 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ujian Sampel Misterius →</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Single-Row Filter & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Domain Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800 overflow-x-auto">
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedDomain === tab.id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Academic Tier Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800 shrink-0">
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

            {/* Compact Cognitive Load Select */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs">
              <BrainCircuit className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <select
                aria-label="Filter Beban Kognitif"
                value={cognitiveFilter}
                onChange={(e) => {
                  labSound.playClick();
                  setCognitiveFilter(e.target.value as CognitiveLoadTier);
                }}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">Semua Tingkat Kesulitan</option>
                <option value="ringan" className="bg-white dark:bg-slate-900">● Beban Ringan</option>
                <option value="terstruktur" className="bg-white dark:bg-slate-900">◆ Beban Terstruktur</option>
                <option value="analitik" className="bg-white dark:bg-slate-900">▲ Beban Analitik</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[190px] sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari modul atau rumus..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 1B. STUDENT SCIENTIFIC ACHIEVEMENT BADGES STRIP */}
      {badges.length > 0 && <AchievementBadgesStrip badges={badges} />}

      {/* 2. 3-COLUMN PROPORTIONAL EXPERIMENT MODULE GRID */}
      {filteredModules.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tidak ada modul eksperimen yang sesuai dengan pencarian atau filter beban kognitif Anda.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedDomain('all');
              setCognitiveFilter('all');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
          >
            Tampilkan Semua Modul
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {filteredModules.map((exp) => {
            const isCompleted = completedModuleIds.includes(exp.id);
            const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
            const accentColor = DOMAIN_COLORS[exp.domain] || '#0ea5e9';
            const conciseDesc =
              exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;
            const primaryEquation = (exp.keyEquations[0] || '')
              .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
              .replace(/\\text\{([^}]+)\}/g, '$1')
              .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
              .replace(/\\left\(/g, '(')
              .replace(/\\right\)/g, ')')
              .replace(/\\Sigma/g, 'Σ')
              .replace(/\\Delta/g, 'Δ')
              .replace(/\\Psi/g, 'Ψ')
              .replace(/\\lambda/g, 'λ')
              .replace(/\\theta/g, 'θ')
              .replace(/\\mu/g, 'μ')
              .replace(/\\pi/g, 'π')
              .replace(/\\eta/g, 'η')
              .replace(/\\rho/g, 'ρ')
              .replace(/\\nu/g, 'ν')
              .replace(/\\phi/g, 'φ')
              .replace(/\\cdot/g, '·')
              .replace(/\\times/g, '×')
              .replace(/\\approx/g, '≈')
              .replace(/\\quad/g, ' ')
              .replace(/\\max/g, 'max')
              .replace(/\\sin/g, 'sin')
              .replace(/\\cos/g, 'cos')
              .replace(/\\tan/g, 'tan')
              .replace(/\^2/g, '²')
              .replace(/\^3/g, '³')
              .replace(/\_\{([^}]+)\}/g, '_$1')
              .replace(/\\/g, '');
            const cogLoad = getCognitiveLoadProfile(exp);

            return (
              <article
                key={exp.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 transition-colors flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-2.5">
                  {/* Unboxed Metadata Kicker with Cognitive Load Indicator */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <DomainIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: accentColor }}
                      />
                      <span className="capitalize font-semibold text-slate-700 dark:text-slate-200">
                        {exp.domain}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{exp.subCategory}</span>
                    </div>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selesai</span>
                      </span>
                    ) : (
                      <span
                        className={`font-mono text-[10px] font-bold shrink-0 ${cogLoad.toneClass}`}
                        title={cogLoad.label}
                      >
                        {cogLoad.symbol}
                      </span>
                    )}
                  </div>

                  {/* Card Title */}
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {exp.title}
                  </h2>

                  {/* 1-Sentence Summary */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed comfort-prose">
                    {conciseDesc}
                  </p>

                  {/* Unboxed Technical Details & Key Formula */}
                  <div className="pt-1 space-y-2">
                    {primaryEquation && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 font-mono text-[11px] text-sky-700 dark:text-sky-300 truncate">
                        {primaryEquation}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>Est. {exp.estimatedMinutes} menit</span>
                      <span aria-hidden="true">·</span>
                      <span>{exp.parameters.length} Variabel</span>
                      <span aria-hidden="true">·</span>
                      <span>{exp.apparatusList[0] || 'Aparatus 3D'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {cogLoad.label.split('·')[1]?.trim() || '4 Tahap Praktikum'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      onSelectExperiment(exp);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Mulai Praktikum →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
