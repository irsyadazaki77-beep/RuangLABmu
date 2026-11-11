import React from 'react';
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
  if (!isOpen || typeof document === 'undefined') return null;

  const progress = getLevelProgress(profile.xp);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pencapaian & Koleksi Lencana Saintifik Siswa"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {newlyUnlockedBadge
                  ? `Lencana Saintifik Baru Terbuka!`
                  : `Profil Gamifikasi & Koleksi Lencana Saintifik`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Celebration Banner when a New Badge is Unlocked */}
          {newlyUnlockedBadge && (
            <div className="p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 flex flex-col sm:flex-row items-center gap-4 transition-transform duration-200">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0 shadow-sm">
                {getBadgeIcon(newlyUnlockedBadge.id)}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Penghargaan Saintifik Baru · +{recentXpDelta || newlyUnlockedBadge.xpBonus} XP
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {newlyUnlockedBadge.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {newlyUnlockedBadge.description}
                </p>
              </div>
            </div>
          )}

          {/* Level & XP Progress Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Level {progress.level} — {progress.rankTitle}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-2">
                  ({profile.unlockedBadges.length}/{SCIENTIFIC_BADGES_CATALOG.length} Lencana Terkumpul)
                </span>
              </div>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {progress.currentLevelXp} / {progress.nextLevelXp} XP
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-300"
                style={{ width: `${progress.progressPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span>Aturan K3: +100 XP</span>
              <span>·</span>
              <span>Presisi R² ≥ 0.95: +150 XP (R² ≥ 0.99: +300 XP)</span>
              <span>·</span>
              <span>LKS Sempurna: +200 XP</span>
            </div>
          </div>

          {/* 5 Scientific Badges Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Koleksi 5 Lencana Saintifik RuangLABmu
              </h3>
              {!profile.unlockedBadges.includes('K3 Guardian') && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playSuccessChime();
                    recordK3Compliance('manual-pledge');
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
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
                        ? 'bg-white dark:bg-slate-900 border-emerald-500/40'
                        : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-75'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isUnlocked
                          ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 grayscale'
                      }`}
                    >
                      {getBadgeIcon(badge.id)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {badge.title}
                        </span>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terbuka</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                            <Lock className="w-3 h-3" />
                            <span>Terkunci</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
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
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Total Skor Pengalaman: {profile.xp} XP
          </span>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Lanjutkan Eksplorasi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
