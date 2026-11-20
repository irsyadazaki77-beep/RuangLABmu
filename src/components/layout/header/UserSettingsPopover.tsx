import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  GraduationCap,
  HelpCircle,
  Link2,
  MessageCircle,
  Monitor,
  Moon,
  Printer,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trophy,
  UserCircle2,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MODAL_POPOVER_VARIANTS, SPRING_TACTILE } from '../../../styles/motionPresets';
import { ComfortThemeMode, VisualComfortPreferences } from '../../ui/VisualComfortToolbar';
import { labSound } from '../../../utils/soundEngine';
import { GamificationProfile } from '../../../services/gamificationEngine';
import { ExperimentModule } from '../../../registry/experimentRegistry';
import { UserRole } from '../../../stores/useLabStore';
import { ActiveModal, DrawerTab } from '../../../stores/useUIStore';

export interface UserSettingsPopoverProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  activeProfile?: { name: string; group: string };
  gamificationProfile: GamificationProfile;
  hasLowR2Alert: boolean;
  notificationsCount: number;
  drawerOpen: boolean;
  toggleDrawer: () => void;
  setDrawerTab: (tab: DrawerTab) => void;
  comfortPrefs: VisualComfortPreferences;
  onThemeSwitch: (theme: ComfortThemeMode) => void;
  activeLang: 'id' | 'en';
  onLanguageSwitch: (lang: 'id' | 'en') => void;
  projectorMode: boolean;
  toggleProjectorMode: () => void;
  liteDeviceMode: boolean;
  toggleLiteDeviceMode: () => void;
  experimentModule: ExperimentModule;
  onShareModuleLink: () => Promise<void>;
  onOpenGradebook: () => void;
  openModal: (modal: ActiveModal) => void;
  setOnboardingTourOpen: (open: boolean) => void;
}

export const UserSettingsPopover: React.FC<UserSettingsPopoverProps> = ({
  containerRef,
  isOpen,
  onToggle,
  onClose,
  userRole,
  setUserRole,
  activeProfile,
  gamificationProfile,
  hasLowR2Alert,
  notificationsCount,
  drawerOpen,
  toggleDrawer,
  setDrawerTab,
  comfortPrefs,
  onThemeSwitch,
  activeLang,
  onLanguageSwitch,
  projectorMode,
  toggleProjectorMode,
  liteDeviceMode,
  toggleLiteDeviceMode,
  experimentModule,
  onShareModuleLink,
  onOpenGradebook,
  openModal,
  setOnboardingTourOpen,
}) => {
  const { t } = useTranslation();

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_TACTILE}
        data-testid="settings-popover-trigger-btn"
        onClick={() => {
          labSound.playClick();
          onToggle();
        }}
        aria-expanded={isOpen}
        aria-label="Dr. LabMu, Profil & Pengaturan"
        className={`relative h-8 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          isOpen
            ? 'bg-sky-600 text-white border-sky-600'
            : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] hover:border-sky-500/50 text-[var(--comfort-text)]'
        }`}
      >
        {userRole === 'pengajar' ? (
          <GraduationCap
            className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}
          />
        ) : (
          <UserCircle2
            className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`}
          />
        )}
        <span className="hidden sm:inline font-semibold">
          {userRole === 'pengajar' ? 'Guru' : activeProfile?.name?.split(' ')[0] || 'Siswa'}
        </span>
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${
            isOpen ? 'text-white/90' : 'text-[var(--comfort-text-muted)]'
          }`}
        >
          Lv.{gamificationProfile.level}
        </span>
        <SlidersHorizontal className="w-3 h-3 opacity-70 shrink-0" />
        {hasLowR2Alert && (
          <span
            className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5"
            title="Deviasi Data Terdeteksi!"
          />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={MODAL_POPOVER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            data-testid="settings-popover-menu"
            className="absolute right-0 mt-2 w-80 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-xl p-3.5 space-y-3 z-50 text-xs max-h-[82vh] overflow-y-auto"
          >
            {/* Profile & Quick Actions */}
            <div className="space-y-2 pb-2.5 border-b border-[var(--comfort-border)]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {activeProfile?.name || 'Alya Pratama'}
                  </div>
                  <div className="text-[11px] text-[var(--comfort-text-muted)] tabular-nums">
                    {activeProfile?.group || 'Kelompok 1'} · Level {gamificationProfile.level} ({gamificationProfile.xp} XP)
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="open-portfolio-btn"
                  onClick={() => {
                    labSound.playClick();
                    onClose();
                    if (userRole === 'pengajar') {
                      onOpenGradebook();
                    } else {
                      openModal('portfolio');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{userRole === 'pengajar' ? 'Buku Nilai' : 'Portofolio'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-onboarding="dr-labmu-trigger"
                  onClick={() => {
                    labSound.playClick();
                    onClose();
                    if (drawerOpen) toggleDrawer();
                    else setDrawerTab('ai');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/18 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Asisten Dr. LabMu</span>
                  {notificationsCount > 0 && (
                    <span className="font-mono text-[10px] opacity-80 tabular-nums">({notificationsCount})</span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="lobby-teacher-gradebook-toggle-btn"
                  onClick={() => {
                    labSound.playClick();
                    const nextRole = userRole === 'pengajar' ? 'siswa' : 'pengajar';
                    setUserRole(nextRole);
                    if (nextRole === 'pengajar') {
                      onOpenGradebook();
                      onClose();
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    userRole === 'pengajar'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-sky-500'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{userRole === 'pengajar' ? 'Buku Nilai Aktif' : 'Mode Guru'}</span>
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--comfort-text-muted)]">
                Tema Tampilan
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
                {(
                  [
                    { id: 'light' as ComfortThemeMode, label: t('nav.themeLight'), Icon: Sun },
                    { id: 'sepia' as ComfortThemeMode, label: t('nav.themeSepia'), Icon: BookOpen },
                    { id: 'dark' as ComfortThemeMode, label: t('nav.themeDark'), Icon: Moon },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const active = comfortPrefs.theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onThemeSwitch(id)}
                      className={`py-1.5 px-1 rounded-md font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                          : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                      }`}
                    >
                      <Icon className="w-3 h-3 text-amber-500 dark:text-sky-400 shrink-0" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language & Role */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--comfort-border)]">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--comfort-text-muted)]">
                  Bahasa
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => onLanguageSwitch('id')}
                    className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                      activeLang === 'id'
                        ? 'bg-sky-600 text-white'
                        : 'text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    ID
                  </button>
                  <button
                    type="button"
                    onClick={() => onLanguageSwitch('en')}
                    className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                      activeLang === 'en'
                        ? 'bg-sky-600 text-white'
                        : 'text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--comfort-text-muted)]">
                  Peran
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-semibold text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setUserRole('siswa');
                    }}
                    className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                      userRole === 'siswa'
                        ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs'
                        : 'text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    Siswa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setUserRole('pengajar');
                    }}
                    className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                      userRole === 'pengajar'
                        ? 'bg-[var(--comfort-surface)] text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    Guru
                  </button>
                </div>
              </div>
            </div>

            {/* 3T Visual Classroom Modes */}
            <div className="pt-2 border-t border-[var(--comfort-border)] space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--comfort-text-muted)]">
                Mode Visual Ruang Kelas 3T
              </span>

              <button
                type="button"
                data-testid="projector-mode-toggle-btn"
                onClick={() => {
                  labSound.playClick(projectorMode ? 480 : 720);
                  toggleProjectorMode();
                }}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  projectorMode
                    ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/60'
                    : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-amber-500/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Monitor className={`w-3.5 h-3.5 ${projectorMode ? 'text-amber-500' : 'text-[var(--comfort-text-muted)]'}`} />
                  <span>Mode Proyektor Kelas (1.5x)</span>
                </span>
                <span className={`font-mono text-[10px] font-bold ${projectorMode ? 'text-amber-600 dark:text-amber-300' : 'text-[var(--comfort-text-muted)]'}`}>
                  {projectorMode ? 'Aktif' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                data-testid="lite-device-mode-toggle-btn"
                onClick={() => {
                  labSound.playClick(liteDeviceMode ? 440 : 660);
                  toggleLiteDeviceMode();
                }}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  liteDeviceMode
                    ? 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/40'
                    : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-amber-500/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Zap className={`w-3.5 h-3.5 ${liteDeviceMode ? 'text-amber-500 fill-amber-500' : 'text-[var(--comfort-text-muted)]'}`} />
                  <span>Mode Hemat Daya 3T (30 FPS)</span>
                </span>
                <span className={`font-mono text-[10px] font-bold ${liteDeviceMode ? 'text-amber-600 dark:text-amber-300' : 'text-[var(--comfort-text-muted)]'}`}>
                  {liteDeviceMode ? 'Aktif' : 'Off'}
                </span>
              </button>
            </div>

            {/* Lab Tools */}
            <div className="space-y-1 pt-2 border-t border-[var(--comfort-border)]">
              <span className="text-[11px] font-semibold text-[var(--comfort-text-muted)]">
                Alat Praktikum
              </span>
              <button
                type="button"
                data-testid="header-print-blank-worksheet-btn"
                onClick={() => {
                  labSound.playClick();
                  onClose();
                  void import('../../../utils/academicReportExporter').then((m) =>
                    m.printBlankStudentWorksheet(experimentModule, 'SMA')
                  );
                }}
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-sky-700 dark:text-sky-300 text-xs font-medium cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Cetak LKS Kosong (Fotokopi Kelas)</span>
              </button>

              <button
                type="button"
                data-testid="share-module-link-btn"
                onClick={() => {
                  void onShareModuleLink();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-xs cursor-pointer transition-colors"
              >
                <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Salin Link Modul Praktikum</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onClose();
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
                }}
                className="w-full px-2.5 py-1.5 flex items-center justify-between rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-xs cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" />
                  <span>Pencarian Cepat</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--comfort-text-muted)]">Ctrl+K</span>
              </button>

              <button
                type="button"
                data-testid="open-onboarding-tour-btn"
                onClick={() => {
                  labSound.playClick();
                  onClose();
                  setOnboardingTourOpen(true);
                }}
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-xs cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Tur Panduan UI Interaktif</span>
              </button>

              <button
                type="button"
                data-testid="header-open-ai-mission-builder-btn"
                onClick={() => {
                  labSound.playClick(620);
                  onClose();
                  if (userRole !== 'pengajar') {
                    setUserRole('pengajar');
                  }
                  openModal('ai-mission-builder');
                }}
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-indigo-700 dark:text-indigo-300 text-xs font-medium cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Buat Misi Praktikum AI (Guru)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
