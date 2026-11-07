import React, { useState, useMemo } from 'react';
import {
  Search,
  Atom,
  FlaskConical,
  Leaf,
  Orbit,
  ArrowRight,
  Clock,
  Sparkles,
  HelpCircle,
  FileText,
  Compass,
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

const DOMAIN_DATA: {
  id: ScienceDomain;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  borderColor: string;
  imageSrc: string;
  fallbackGradient: string;
}[] = [
  {
    id: 'fisika',
    label: 'Fisika',
    shortDesc: 'Mekanika Newton, Osilasi Pegas, Gelombang Celah Young & Efek Fotolistrik',
    icon: Atom,
    accentColor: '#0ea5e9',
    borderColor: 'border-sky-500/40',
    imageSrc: '/src/assets/images/physics_lab_preview_1794016081177.jpg',
    fallbackGradient: 'from-sky-950 via-slate-900 to-slate-950',
  },
  {
    id: 'kimia',
    label: 'Kimia',
    shortDesc: 'Termokimia Kalorimetri, Titrasi Asam-Basa, Kinetika Reaksi & Spektrofotometri',
    icon: FlaskConical,
    accentColor: '#14b8a6',
    borderColor: 'border-teal-500/40',
    imageSrc: '/src/assets/images/chemistry_lab_preview_1794016082025.jpg',
    fallbackGradient: 'from-teal-950 via-slate-900 to-slate-950',
  },
  {
    id: 'biologi',
    label: 'Biologi',
    shortDesc: 'Fotosintesis Percobaan Ingenhousz, Kinetika Enzim Katalase & Plasmolisis Sel',
    icon: Leaf,
    accentColor: '#10b981',
    borderColor: 'border-emerald-500/40',
    imageSrc: '/src/assets/images/biology_lab_preview_1794016082721.jpg',
    fallbackGradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  {
    id: 'astronomi',
    label: 'Astronomi',
    shortDesc: 'Hukum III Kepler, Rotasi Galaksi Bima Sakti, Radiasi Bintang & Ekspansi Hubble',
    icon: Orbit,
    accentColor: '#6366f1',
    borderColor: 'border-indigo-500/40',
    imageSrc: '/src/assets/images/astronomy_lab_preview_1794016082169.jpg',
    fallbackGradient: 'from-indigo-950 via-slate-900 to-slate-950',
  },
];

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
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');

  // Filter modules based on tier, domain, subCategory, and search
  const filteredModules = useMemo(() => {
    return EXPERIMENT_CATALOG.filter((mod) => {
      // Tier filter
      if (!mod.supportedTiers.includes(activeTier)) return false;

      // Domain filter
      if (selectedDomain !== 'all' && mod.domain !== selectedDomain) return false;

      // SubCategory filter
      if (selectedSubCategory !== 'all' && mod.subCategory !== selectedSubCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = mod.title.toLowerCase().includes(q);
        const matchesSub = mod.subCategory.toLowerCase().includes(q);
        const matchesTheory = mod.theorySummary.toLowerCase().includes(q);
        const matchesApparatus = mod.apparatusList.some((a) => a.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSub && !matchesTheory && !matchesApparatus) return false;
      }

      return true;
    });
  }, [activeTier, selectedDomain, selectedSubCategory, searchQuery]);

  // Available subcategories for the active domain
  const availableSubCategories = useMemo(() => {
    const pool =
      selectedDomain === 'all'
        ? EXPERIMENT_CATALOG
        : EXPERIMENT_CATALOG.filter((m) => m.domain === selectedDomain);
    return Array.from(new Set(pool.map((m) => m.subCategory)));
  }, [selectedDomain]);

  const domainCounts = useMemo(() => {
    return {
      fisika: EXPERIMENT_CATALOG.filter((m) => m.domain === 'fisika' && m.supportedTiers.includes(activeTier)).length,
      kimia: EXPERIMENT_CATALOG.filter((m) => m.domain === 'kimia' && m.supportedTiers.includes(activeTier)).length,
      biologi: EXPERIMENT_CATALOG.filter((m) => m.domain === 'biologi' && m.supportedTiers.includes(activeTier)).length,
      astronomi: EXPERIMENT_CATALOG.filter((m) => m.domain === 'astronomi' && m.supportedTiers.includes(activeTier)).length,
    };
  }, [activeTier]);

  return (
    <div className="max-w-[1380px] mx-auto pb-16 space-y-8 select-text">
      {/* 1. HERO BANNER: Welcome, Student Profile & Quick Stats */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="text-sky-600 dark:text-sky-400 font-semibold">{studentName}</span>
              <span aria-hidden="true">·</span>
              <span>{studentGroup}</span>
              <span aria-hidden="true">·</span>
              <span>Kurikulum Jenjang {activeTier}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white" style={{ textWrap: 'balance' }}>
              Laboratorium Virtual Sains Terpadu
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Jalankan simulasi 3D terkalibrasi ilmiah, amati respon dinamis instrumen, rekam data trial, dan diskusikan hipotesis bersama asisten Sokratik Dr. LabMu.
            </p>
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <div className="text-center px-2">
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {completedModuleIds.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Praktikum Selesai
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="text-center px-2">
              <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                {recordsCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Titik Data Tercatat
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
            <div className="text-center px-2">
              <div className="text-2xl font-bold font-mono text-amber-500 tabular-nums">
                {filteredModules.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Modul Tersedia
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SPECIAL BANNER: Tantangan Sampel Misterius (Mode Ujian) */}
      {onOpenMysteryExam && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Ujian Praktikum Mandiri
                </span>
                <span className="text-[11px] text-slate-400">
                  · Nilai Akurasi Otomatis
                </span>
              </div>
              <h2 className="text-base font-bold text-white">
                Tantangan Sampel Misterius (Blind Experiment)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Uji kemampuan analisis Anda! Amati gerak aparatus, ukur respon telemetri, dan tebak nilai variabel tersembunyi dengan batas galat ±5%.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onOpenMysteryExam();
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Mulai Ujian Misterius →</span>
          </button>
        </section>
      )}

      {/* 3. 4 DOMAIN CARDS: Visual 3D Previews & Counts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Pilih Bidang Laboratorium
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setiap domain dilengkapi aparatus 3D interaktif, sensor digital, dan panduan keselamatan K3.
            </p>
          </div>
          {selectedDomain !== 'all' && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setSelectedDomain('all');
                setSelectedSubCategory('all');
              }}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              Lihat Semua Domain (24 Modul)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DOMAIN_DATA.map((dom) => {
            const Icon = dom.icon;
            const isSelected = selectedDomain === dom.id;
            const count = domainCounts[dom.id];

            return (
              <div
                key={dom.id}
                onClick={() => {
                  labSound.playClick();
                  setSelectedDomain(selectedDomain === dom.id ? 'all' : dom.id);
                  setSelectedSubCategory('all');
                }}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `${dom.borderColor} bg-slate-900/90 shadow-md ring-2 ring-sky-500/30`
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* 16:9 Preview Image Slot with Zero-Broken-Image Fallback */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                  <img
                    src={dom.imageSrc}
                    alt={`Laboratorium ${dom.label}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback: hide broken image and let styled background show
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  
                  {/* Floating Domain Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-xs border border-white/10 text-white text-xs font-semibold">
                    <Icon className="w-3.5 h-3.5" style={{ color: dom.accentColor }} />
                    <span>Lab {dom.label}</span>
                  </div>

                  <div className="absolute bottom-2.5 right-3 text-xs font-mono font-bold text-white/90">
                    {count} Modul
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-500 transition-colors">
                      {dom.label}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {dom.shortDesc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      {isSelected ? 'Filter Aktif' : 'Pilih Domain'}
                    </span>
                    <span className="font-semibold flex items-center gap-1 text-sky-600 dark:text-sky-400">
                      Telusuri <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. FILTER BAR: Tier Switcher + Search + SubCategory */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Education Tier Tabs (Functional Buttons) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
            {(
              [
                { id: 'SMP' as const, label: 'Jenjang SMP' },
                { id: 'SMA' as const, label: 'Jenjang SMA/SMK' },
                { id: 'Mahasiswa' as const, label: 'Perguruan Tinggi' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onTierChange(t.id);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTier === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari eksperimen (contoh: Hukum Newton, Titrasi, Hubble)..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-sky-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Subcategories Filter Chips */}
        {availableSubCategories.length > 1 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Subkategori:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSubCategory('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedSubCategory === 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Semua ({filteredModules.length})
            </button>
            {availableSubCategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubCategory(sub)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedSubCategory === sub
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 5. EXPERIMENT CARDS GRID: Clean, Informative Cards with Primary CTA */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Menampilkan <strong className="text-slate-900 dark:text-white font-mono">{filteredModules.length}</strong> modul praktikum
          </span>
          <span className="hidden sm:inline">
            Klik <strong>Mulai Praktikum</strong> untuk memulai alur bertahap (K3 → Simulasi 3D → Analisis → Laporan).
          </span>
        </div>

        {filteredModules.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tidak ada modul praktikum yang sesuai dengan filter pencarian.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('all');
                setSelectedSubCategory('all');
              }}
              className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white hover:bg-sky-500 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredModules.map((exp) => {
              const isCompleted = completedModuleIds.includes(exp.id);
              const domainInfo = DOMAIN_DATA.find((d) => d.id === exp.domain) || DOMAIN_DATA[0];
              const DomainIcon = domainInfo.icon;

              return (
                <div
                  key={exp.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-all duration-200 flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Header: Metadata Line (Zero-Pill Discipline) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                        <DomainIcon className="w-3.5 h-3.5" style={{ color: domainInfo.accentColor }} />
                        <span className="capitalize">{exp.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span>{exp.subCategory}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{exp.estimatedMinutes}m</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-500 transition-colors">
                      {exp.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {exp.theorySummary}
                    </p>
                  </div>

                  {/* Card Middle: Apparatus Tags (Unboxed Text with Separators) */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Alat:</span>
                      {exp.apparatusList.slice(0, 3).map((item, idx) => (
                        <React.Fragment key={item}>
                          <span className="text-slate-600 dark:text-slate-300">{item}</span>
                          {idx < Math.min(2, exp.apparatusList.length - 1) && (
                            <span aria-hidden="true" className="text-slate-400">·</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Key Equation hint if available */}
                    {exp.keyEquations && exp.keyEquations[0] && (
                      <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400/90 truncate bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-md">
                        {exp.keyEquations[0]}
                      </div>
                    )}
                  </div>

                  {/* Card Action Button: Prominent "Mulai Praktikum" */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Laporan Siap</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        {exp.parameters.length} Parameter Dinamis
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        onSelectExperiment(exp);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-sky-600 dark:bg-slate-800 dark:hover:bg-sky-600 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                    >
                      <span>Mulai Praktikum</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
