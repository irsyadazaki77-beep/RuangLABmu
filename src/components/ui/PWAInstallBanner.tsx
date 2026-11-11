import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { labSound } from '@/utils/soundEngine';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallBanner: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    labSound.playClick();
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (!installPrompt || isDismissed || isInstalled) {
    return null;
  }

  return (
    <aside
      aria-label="Pemberitahuan Pasang Aplikasi RuangLABmu"
      className="fixed bottom-4 right-4 z-50 max-w-sm p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-500/30 shadow-xl shadow-sky-950/15 flex items-center gap-3 transition-all animate-in slide-in-from-bottom-3"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-sm">
        <Smartphone className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
          Pasang RuangLABmu (PWA)
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
          Praktikum sains offline tanpa internet dengan performa native.
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pasang</span>
        </button>
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setIsDismissed(true);
          }}
          aria-label="Tutup notifikasi pasang aplikasi"
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
