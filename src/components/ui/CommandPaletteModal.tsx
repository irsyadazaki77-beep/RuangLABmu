import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Play,
  Pause,
  Camera,
  LineChart,
  MessageCircle,
  Printer,
  Sun,
  Moon,
  BookOpen,
  Eye,
  Atom,
  FlaskConical,
  Dna,
  Telescope,
  CornerDownLeft,
  X,
  Layers,
} from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { EXPERIMENT_CATALOG, ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';

export interface CommandPaletteModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectModule?: (module: ExperimentModule) => void;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'Aksi Cepat' | 'Tema & Tampilan';
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onSelectModule,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    isSimulating,
    toggleSimulation,
    triggerCaptureSnapshot,
    setWorkflowStep,
    setIsLobbyMode,
    setActiveDomain,
    setActiveModule,
  } = useLabStore();

  const {
    toggleDrawer,
    setDrawerTab,
    toggleZenMode,
    setComfortPrefs,
    openModal,
  } = useUIStore();

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleClose = () => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalOpen(false);
    }
    setSearchQuery('');
  };

  // Listen to Global Shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        labSound.playClick(640);
        if (controlledOnClose && controlledIsOpen !== undefined) {
          if (controlledIsOpen) controlledOnClose();
        } else {
          setInternalOpen((prev) => !prev);
        }
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, controlledIsOpen, controlledOnClose]);

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      { id: 'toggle-sim', title: isSimulating ? 'Jeda Simulasi' : 'Jalankan Simulasi', subtitle: 'Atur jalannya mesin fisika & reaksi realtime', icon: isSimulating ? Pause : Play, category: 'Aksi Cepat', action: () => { toggleSimulation(); handleClose(); } },
      { id: 'capture-3d', title: 'Ambil Snapshot 3D', subtitle: 'Tangkapan resolusi tinggi WebGL kanvas ke galeri', icon: Camera, category: 'Aksi Cepat', action: () => { triggerCaptureSnapshot(); handleClose(); } },
      { id: 'open-analytics', title: 'Buka Grafik & LKS', subtitle: 'Tahap 3: Regresi data kuantitatif & lembar kerja', icon: LineChart, category: 'Aksi Cepat', action: () => { setIsLobbyMode(false); setWorkflowStep(3); handleClose(); } },
      { id: 'ask-drlabmu', title: 'Tanya Dr. LabMu', subtitle: 'Buka asisten mentor sokratik & diagnostik visual', icon: MessageCircle, category: 'Aksi Cepat', action: () => { setDrawerTab('ai'); handleClose(); } },
      { id: 'print-report', title: 'Cetak Laporan PDF', subtitle: 'Buka dialog pratinjau berkas akademik resmi', icon: Printer, category: 'Aksi Cepat', action: () => { openModal('report'); handleClose(); } },
      { id: 'theme-light', title: 'Ganti Tema: Terang (Light Mode)', subtitle: 'Tampilan bersih kontras tinggi siang hari', icon: Sun, category: 'Tema & Tampilan', action: () => { setComfortPrefs({ theme: 'light' }); handleClose(); } },
      { id: 'theme-sepia', title: 'Ganti Tema: Sepia (Kertas Akademik)', subtitle: 'Pencahayaan hangat untuk kenyamanan LKS', icon: BookOpen, category: 'Tema & Tampilan', action: () => { setComfortPrefs({ theme: 'sepia' }); handleClose(); } },
      { id: 'theme-dark', title: 'Ganti Tema: Gelap (Dark Studio)', subtitle: 'Tampilan kontras futuristik WebGL 3D', icon: Moon, category: 'Tema & Tampilan', action: () => { setComfortPrefs({ theme: 'dark' }); handleClose(); } },
      { id: 'toggle-zen', title: 'Mode Fokus (Zen Mode)', subtitle: 'Sembunyikan sidebar parameter', icon: Eye, category: 'Tema & Tampilan', action: () => { toggleZenMode(); handleClose(); } },
      { id: 'back-lobby', title: 'Kembali ke Katalog / Lobi', subtitle: 'Jelajahi seluruh daftar modul lab sains', icon: Layers, category: 'Aksi Cepat', action: () => { setIsLobbyMode(true); handleClose(); } },
    ],
    [
      isSimulating,
      toggleSimulation,
      triggerCaptureSnapshot,
      setIsLobbyMode,
      setWorkflowStep,
      setDrawerTab,
      openModal,
      setComfortPrefs,
      toggleZenMode,
    ]
  );

  // Filter Modules by query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return EXPERIMENT_CATALOG.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return EXPERIMENT_CATALOG.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.domain.toLowerCase().includes(q) ||
        m.subCategory.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filter Quick Actions by query
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return quickActions;
    const q = searchQuery.toLowerCase();
    return quickActions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );
  }, [searchQuery, quickActions]);

  // Combined flat items for arrow key navigation
  const allNavigableItems = useMemo(() => {
    const items: Array<
      | { type: 'module'; data: ExperimentModule }
      | { type: 'action'; data: QuickAction }
    > = [];
    filteredModules.forEach((m) => items.push({ type: 'module', data: m }));
    filteredActions.forEach((a) => items.push({ type: 'action', data: a }));
    return items;
  }, [filteredModules, filteredActions]);

  // Handle arrow navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allNavigableItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, allNavigableItems.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = allNavigableItems[selectedIndex];
      if (item) {
        if (item.type === 'module') {
          handleSelectModule(item.data);
        } else {
          item.data.action();
        }
      }
    }
  };

  const handleSelectModule = (mod: ExperimentModule) => {
    labSound.playClick();
    setActiveDomain(mod.domain);
    setActiveModule(mod.id);
    setIsLobbyMode(false);
    setWorkflowStep(2);
    if (onSelectModule) {
      onSelectModule(mod);
    }
    handleClose();
  };

  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'fisika':
        return Atom;
      case 'kimia':
        return FlaskConical;
      case 'biologi':
        return Dna;
      case 'astronomi':
        return Telescope;
      default:
        return Atom;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          {/* Palette Dialog Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] z-10"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-950/50">
              <Search className="w-5 h-5 text-sky-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ketik nama modul sains atau perintah (cth: 'Newton', 'Titrasi', 'Kepler', 'Cetak')..."
                className="w-full text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-medium"
              />
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
              {/* Category 1: Lompat ke Modul */}
              {filteredModules.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Lompat ke Modul Praktikum Sains
                  </div>
                  {filteredModules.map((m, idx) => {
                    const isSelected = selectedIndex === idx;
                    const DomainIcon = getDomainIcon(m.domain);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModule(m)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                            }`}
                          >
                            <DomainIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate text-slate-900 dark:text-white">
                              {m.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {m.domain.toUpperCase()} · {m.subCategory}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {m.supportedTiers.join(', ')}
                          </span>
                          {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-sky-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Category 2: Aksi Cepat & Navigasi */}
              {filteredActions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Aksi Cepat &amp; Tampilan
                  </div>
                  {filteredActions.map((a, aIdx) => {
                    const itemGlobalIdx = filteredModules.length + aIdx;
                    const isSelected = selectedIndex === itemGlobalIdx;
                    const ActionIcon = a.icon;

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={a.action}
                        onMouseEnter={() => setSelectedIndex(itemGlobalIdx)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <ActionIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate text-slate-900 dark:text-white">
                              {a.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {a.subtitle}
                            </div>
                          </div>
                        </div>

                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredModules.length === 0 && filteredActions.length === 0 && (
                <div className="py-12 text-center text-slate-400 space-y-1">
                  <p className="font-bold">Tidak ada perintah atau modul yang cocok.</p>
                  <p className="text-[11px] text-slate-500">Coba kata kunci lain seperti "Newton", "Titrasi", atau "LKS".</p>
                </div>
              )}
            </div>

            {/* Footer Shortcut Hints */}
            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↓</kbd> Navigasi
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Enter</kbd> Pilih
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Esc</kbd> Tutup
                </span>
              </div>
              <div className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                Ctrl + K / ⌘K
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
