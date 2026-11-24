import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Globe, HardDrive, Wifi, X } from 'lucide-react';
import { MODAL_POPOVER_VARIANTS } from '../../../styles/motionPresets';
import { labSound } from '../../../utils/soundEngine';

export type ConnectivityMode = 'online-cloud' | 'lan-hotspot' | 'offline-standalone';

export interface ConnectivityPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  connectivityMode: ConnectivityMode;
  hostname: string;
  wsConnected: boolean;
  isOnline: boolean;
  outboxStatus: {
    syncStatus: string;
    pendingCount: number;
    label: string;
  };
}

export const ConnectivityPopover: React.FC<ConnectivityPopoverProps> = ({
  isOpen,
  onToggle,
  onClose,
  connectivityMode,
  hostname,
  wsConnected,
  isOnline,
  outboxStatus,
}) => {
  const statusLabel =
    connectivityMode === 'online-cloud'
      ? 'Online'
      : connectivityMode === 'lan-hotspot'
      ? 'LAN Kelas'
      : 'Luring';

  const statusToneClass =
    connectivityMode === 'online-cloud'
      ? 'text-emerald-700 dark:text-emerald-400'
      : connectivityMode === 'lan-hotspot'
      ? 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
      : 'text-amber-700 dark:text-amber-400';

  const dotClass =
    connectivityMode === 'online-cloud'
      ? 'bg-emerald-500'
      : connectivityMode === 'lan-hotspot'
      ? 'bg-sky-500'
      : 'bg-amber-500';

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="tri-state-connectivity-badge"
        onClick={() => {
          labSound.playClick();
          onToggle();
        }}
        aria-expanded={isOpen}
        aria-label={`Status Konektivitas: ${statusLabel}`}
        className={`h-8 px-2 flex items-center gap-1.5 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-2xs xl:text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${statusToneClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
        <span className="font-medium text-[var(--comfort-text)]">{statusLabel}</span>
        <span
          data-testid="outbox-sync-status-label"
          className={`${
            outboxStatus.syncStatus === 'syncing' || outboxStatus.pendingCount > 0 || !isOnline
              ? 'hidden sm:inline'
              : 'hidden xl:inline'
          } text-2xs text-[var(--comfort-text-muted)] tabular-nums`}
        >
          · {outboxStatus.label}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <motion.div
              variants={MODAL_POPOVER_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              data-testid="connectivity-status-tooltip"
              className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-xl p-4 z-50 text-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[var(--comfort-border)] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      connectivityMode === 'online-cloud'
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : connectivityMode === 'lan-hotspot'
                        ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
                        : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {connectivityMode === 'online-cloud' && <Globe className="w-4 h-4" />}
                    {connectivityMode === 'lan-hotspot' && <Wifi className="w-4 h-4" />}
                    {connectivityMode === 'offline-standalone' && <HardDrive className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs">
                      {connectivityMode === 'online-cloud'
                        ? 'Mode Online 3T Siap'
                        : connectivityMode === 'lan-hotspot'
                        ? 'Mode LAN Kelas (Tanpa Kuota)'
                        : 'Mode Luring Mandiri'}
                    </div>
                    <div className="text-2xs text-[var(--comfort-text-muted)] font-mono tabular-nums">
                      {hostname || 'localhost'} · {wsConnected ? 'Sync Aktif' : 'Cache Lokal'} · {outboxStatus.label}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup Detail Konektivitas"
                  className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] p-1 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-[var(--comfort-text-muted)]">
                {connectivityMode === 'lan-hotspot'
                  ? 'Terhubung ke server laptop Guru via Wi-Fi lokal kelas tanpa kuota internet. Data & nilai tersinkron ke Buku Nilai Guru.'
                  : connectivityMode === 'online-cloud'
                  ? 'Koneksi jaringan aktif. Modul simulasi tetap dicache otomatis di perangkat (PWA) untuk ketahanan sinyal 3T.'
                  : 'Berjalan 100% di memori lokal perangkat (PWA + Offline Dr. LabMu). Seluruh data pengamatan dan LKS aman tersimpan lokal.'}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
