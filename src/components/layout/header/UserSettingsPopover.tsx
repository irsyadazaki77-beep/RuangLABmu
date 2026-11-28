import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  GraduationCap,
  HelpCircle,
  Link2,
  MessageCircle,
  Monitor,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserCircle2,
  Wand2,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { MODAL_POPOVER_VARIANTS, SPRING_TACTILE } from '../../../styles/motionPresets';
import {
  ComfortThemeMode,
  VisualComfortPreferences,
} from '../../ui/VisualComfortToolbar';
import { labSound } from '../../../utils/soundEngine';
import { GamificationProfile } from '../../../services/gamificationEngine';
import { ExperimentModule } from '../../../registry/experimentRegistry';
import { UserRole } from '../../../stores/useLabStore';
import { ActiveModal, DrawerTab } from '../../../stores/useUIStore';
import { EyeComfortSettingsSection } from './EyeComfortSettingsSection';

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
  hasLowR2Alert: _hasLowR2Alert,
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
  const authSession = useAuthStore((s) => s.session);
  const authToken = useAuthStore((s) => s.token);
  const isVerifiedSession = Boolean(
    authToken && authSession && authSession.exp > Math.floor(Date.now() / 1000)
  );
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
        className={`relative h-8 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
          isOpen
            ? 'comfort-tab-active border-transparent'
            : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text)]'
        }`}
      >
        {userRole === 'pengajar' ? (
          <GraduationCap
            className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-white' : 'text-[var(--comfort-accent)]'}`}
          />
        ) : (
          <UserCircle2
            className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-white' : 'text-[var(--comfort-accent)]'}`}
          />
        )}
        <span className="hidden sm:inline font-semibold">
          {userRole === 'pengajar' ? 'Guru' : activeProfile?.name?.split(' ')[0] || 'Siswa'}
        </span>
        <SlidersHorizontal className="w-3 h-3 opacity-70 shrink-0" aria-hidden="true" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={MODAL_POPOVER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            data-testid="settings-popover-menu"
            className="absolute right-0 mt-2 w-80 sm:w-[376px] rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-xl p-3.5 space-y-3 z-50 text-xs max-h-[84vh] overflow-y-auto"
          >
            {/* Profile & Quick Actions */}
            <div className="space-y-2 pb-2.5 border-b border-[var(--comfort-border)]">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    <span className="truncate">{authSession?.displayName || activeProfile?.name || 'Alya Pratama'}</span>
                    {isVerifiedSession && (
                      <span
                        title="Sesi Terautentikasi Server"
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-2xs font-bold shrink-0"
                      >
                        Terverifikasi
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-[var(--comfort-text-muted)] tabular-nums">
                    {activeProfile?.group || 'Kelompok 1'} · Level {gamificationProfile.level} ({gamificationProfile.xp} XP)
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="open-user-auth-btn"
                    onClick={() => {
                      labSound.playClick();
                      onClose();
                      openModal('auth');
                    }}
                    className="px-2 py-1.5 rounded-lg comfort-btn-secondary font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                    title="Masuk / Ganti Akun Siswa atau Guru"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
                    <span>Akun</span>
                  </button>
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
                    className="px-2.5 py-1.5 rounded-lg comfort-btn-secondary font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Trophy className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
                    <span>{userRole === 'pengajar' ? 'Buku Nilai' : 'Portofolio'}</span>
                  </button>
                </div>
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
                  className="px-2.5 py-1.5 rounded-lg comfort-accent-soft border hover:opacity-90 font-semibold text-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-opacity"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Asisten Dr. LabMu</span>
                  {notificationsCount > 0 && (
                    <span className="font-mono text-2xs opacity-80 tabular-nums">({notificationsCount})</span>
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
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold text-2xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                    userRole === 'pengajar'
                      ? 'comfort-tab-active border-transparent'
                      : 'comfort-btn-secondary'
                  }`}
                >
                  <GraduationCap className={`w-3.5 h-3.5 ${userRole === 'pengajar' ? '' : 'text-[var(--comfort-accent)]'}`} />
                  <span>{userRole === 'pengajar' ? 'Buku Nilai Aktif' : 'Mode Guru'}</span>
                </button>
              </div>
            </div>

            {/* Eye-Comfort Studio Section + Live Mini Reading & Chart Preview */}
            <EyeComfortSettingsSection
              comfortPrefs={comfortPrefs}
              projectorMode={projectorMode}
              onThemeSwitch={onThemeSwitch}
              onClosePopover={onClose}
            />

            {/* Language & Role */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                  Bahasa
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => onLanguageSwitch('id')}
                    className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                      activeLang === 'id'
                        ? 'comfort-tab-active'
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
                        ? 'comfort-tab-active'
                        : 'text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                  Peran
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-semibold text-2xs">
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
                        ? 'bg-[var(--comfort-surface)] text-[var(--comfort-accent)] shadow-xs'
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
              <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
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
                    ? 'comfort-accent-soft text-[var(--comfort-text)]'
                    : 'comfort-btn-secondary'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Monitor className={`w-3.5 h-3.5 ${projectorMode ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'}`} />
                  <span>Mode Proyektor Kelas (1.5x)</span>
                </span>
                <span className={`font-mono text-2xs font-bold ${projectorMode ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'}`}>
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
                    ? 'comfort-accent-soft text-[var(--comfort-text)]'
                    : 'comfort-btn-secondary'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Zap className={`w-3.5 h-3.5 ${liteDeviceMode ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'}`} />
                  <span>Mode Hemat Daya 3T (30 FPS)</span>
                </span>
                <span className={`font-mono text-2xs font-bold ${liteDeviceMode ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-text-muted)]'}`}>
                  {liteDeviceMode ? 'Aktif' : 'Off'}
                </span>
              </button>
            </div>

            {/* Lab Tools */}
            <div className="space-y-1 pt-2 border-t border-[var(--comfort-border)]">
              <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
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
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] text-xs font-medium cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
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
                <Link2 className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
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
                <span className="font-mono text-2xs text-[var(--comfort-text-muted)]">Ctrl+K</span>
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
                <HelpCircle className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
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
                className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] text-xs font-medium cursor-pointer transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
                <span>Buat Misi Praktikum AI (Guru)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
