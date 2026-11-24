import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  ShieldCheck,
  Target,
  FlaskConical,
  Orbit,
  Microscope,
  X,
  CheckCircle2,
  Lock,
  Trophy,
} from 'lucide-react';
import {
  BadgeName,
  GamificationProfile,
  SCIENTIFIC_BADGES_CATALOG,
  ScientificBadge,
  getLevelProgress,
  recordK3Compliance,
} from '../../services/gamificationEngine';
import { labSound } from '../../utils/soundEngine';

export interface BadgeNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: GamificationProfile;
  newlyUnlockedBadge?: ScientificBadge | null;
  recentXpDelta?: number;
}

function getBadgeIcon(badgeId: BadgeName) {
  switch (badgeId) {
    case 'K3 Guardian':
      return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
    case 'Precision Analyst':
      return <Target className="w-6 h-6 text-sky-500" />;
    case 'Master Titrator':
      return <FlaskConical className="w-6 h-6 text-amber-500" />;
    case 'Kepler Navigator':
      return <Orbit className="w-6 h-6 text-indigo-500" />;
    case 'Bio Explorer':
      return <Microscope className="w-6 h-6 text-teal-500" />;
    default:
      return <Award className="w-6 h-6 text-sky-500" />;
  }
}

export const BadgeNotificationModal: React.FC<BadgeNotificationModalProps> = ({
  isOpen,
  onClose,
  profile,
  newlyUnlockedBadge,
  recentXpDelta = 0,
}) => {
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

  if (!isOpen || typeof document === 'undefined') return null;

  const progress = getLevelProgress(profile.xp);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pencapaian & Koleksi Lencana Saintifik Siswa"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[var(--comfort-border)] flex items-center justify-between bg-[var(--comfort-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--comfort-text)]">
                {newlyUnlockedBadge
                  ? `Lencana Saintifik Baru Terbuka!`
                  : `Profil Gamifikasi & Koleksi Lencana Saintifik`}
              </h2>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Level {progress.level} · {progress.rankTitle} · Total {profile.xp} XP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            aria-label="Tutup Modal Lencana"
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {newlyUnlockedBadge && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-col sm:flex-row items-center gap-4 transition-transform duration-200">
              <div className="w-14 h-14 rounded-2xl bg-[var(--comfort-surface)] border border-amber-500/40 flex items-center justify-center shrink-0 shadow-sm">
                {getBadgeIcon(newlyUnlockedBadge.id)}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Penghargaan Saintifik Baru · +{recentXpDelta || newlyUnlockedBadge.xpBonus} XP
                </div>
                <h3 className="text-lg font-bold text-[var(--comfort-text)]">
                  {newlyUnlockedBadge.title}
                </h3>
                <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
                  {newlyUnlockedBadge.description}
                </p>
              </div>
            </div>
          )}

          {/* Level & XP Progress Card */}
          <div className="p-4 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[var(--comfort-text)]">
                  Level {progress.level} — {progress.rankTitle}
                </span>
                <span className="text-[var(--comfort-text-muted)] ml-2">
                  ({profile.unlockedBadges.length}/{SCIENTIFIC_BADGES_CATALOG.length} Lencana Terkumpul)
                </span>
              </div>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                {progress.currentLevelXp} / {progress.nextLevelXp} XP
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[var(--comfort-surface)] border border-[var(--comfort-border)] overflow-hidden">
              <div
                className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-300"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-[var(--comfort-text-muted)] pt-1">
              <span>Aturan K3: +100 XP</span>
              <span>·</span>
              <span>Presisi R² ≥ 0.95: +150 XP (R² ≥ 0.99: +300 XP)</span>
              <span>·</span>
              <span>LKS Sempurna: +200 XP</span>
            </div>
          </div>

          {/* 5 Scientific Badges Grid */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[var(--comfort-text)]">
                Koleksi 5 Lencana Saintifik RuangLABmu
              </h3>
              {!profile.unlockedBadges.includes('K3 Guardian') && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playSuccessChime();
                    recordK3Compliance('manual-pledge');
                  }}
                  className="px-3 py-1.5 min-h-[34px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-2xs font-semibold transition-colors cursor-pointer"
                >
                  Verifikasi Kepatuhan K3 (+100 XP)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SCIENTIFIC_BADGES_CATALOG.map((badge) => {
                const isUnlocked = profile.unlockedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                      isUnlocked
                        ? 'bg-[var(--comfort-surface)] border-emerald-500/45'
                        : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] opacity-75'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isUnlocked
                          ? 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]'
                          : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] grayscale'
                      }`}
                    >
                      {getBadgeIcon(badge.id)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-[var(--comfort-text)] truncate">
                          {badge.title}
                        </span>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terbuka</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-2xs text-[var(--comfort-text-muted)] shrink-0">
                            <Lock className="w-3 h-3" />
                            <span>Terkunci</span>
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] flex items-center justify-between">
          <span className="text-xs text-[var(--comfort-text-muted)] font-mono tabular-nums">
            Total Skor Pengalaman: {profile.xp} XP
          </span>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            className="px-4 py-2 min-h-[38px] rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Lanjutkan Eksplorasi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
