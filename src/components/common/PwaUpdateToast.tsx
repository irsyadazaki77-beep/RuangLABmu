import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export const PwaUpdateToast: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;
    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        const updateSW = registerSW({
          immediate: false,
          onNeedRefresh() {
            if (!cancelled) {
              setNeedRefresh(true);
            }
          },
          onOfflineReady() {
            // Core shell & worker cached; no disruptive modal needed
          },
        });
        updateSwRef.current = updateSW;
      })
      .catch(() => {
        // Ignore when running without built service worker (dev / test)
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    labSound.playClick();
    setNeedRefresh(false);
  }, []);

  useEffect(() => {
    if (!needRefresh) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [needRefresh, handleDismiss]);

  const handleApplyUpdate = async () => {
    labSound.playClick(680);
    setIsUpdating(true);
    try {
      if (updateSwRef.current) {
        await updateSwRef.current(true);
      } else {
        window.location.reload();
      }
    } catch {
      setIsUpdating(false);
    }
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Pembaruan Aplikasi Tersedia"
      data-testid="pwa-update-toast"
      className="fixed bottom-4 left-4 z-50 max-w-sm p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-sky-500/40 text-slate-100 shadow-2xl flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
        <Sparkles className="w-4 h-4" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-xs font-bold text-white">
          Pembaruan Aplikasi Tersedia
        </div>
        <p className="text-[11px] text-slate-300 leading-snug">
          Versi baru RuangLABmu siap digunakan. Muat ulang saat Anda selesai menyimpan pengamatan.
        </p>
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            data-testid="pwa-update-reload-btn"
            disabled={isUpdating}
            onClick={() => void handleApplyUpdate()}
            className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isUpdating ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>
          <button
            type="button"
            data-testid="pwa-update-dismiss-btn"
            onClick={handleDismiss}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Nanti
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Tutup pemberitahuan pembaruan aplikasi"
        className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </aside>
  );
};
