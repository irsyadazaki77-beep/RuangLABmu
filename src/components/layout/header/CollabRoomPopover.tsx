import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, KeyRound, Lock, LogOut, Plus, Unlock, Users, X } from 'lucide-react';
import { MODAL_POPOVER_VARIANTS } from '../../../styles/motionPresets';
import { labSound } from '../../../utils/soundEngine';
import { UserRole } from '../../../stores/useLabStore';

export interface CollabRoomPopoverProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  activeRoomId: string | null;
  roomPin: string | null;
  memberCount: number;
  userRole: UserRole;
  isFrozenByTeacher: boolean;
  onOpenRoomModal: (mode: 'create' | 'join') => void;
  onLeaveRoom?: () => void;
  onToggleTeacherFreeze?: (isFrozen: boolean) => void;
}

export const CollabRoomPopover: React.FC<CollabRoomPopoverProps> = ({
  containerRef,
  isOpen,
  onToggle,
  onClose,
  activeRoomId,
  roomPin,
  memberCount,
  userRole,
  isFrozenByTeacher,
  onOpenRoomModal,
  onLeaveRoom,
  onToggleTeacherFreeze,
}) => {
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="navbar-meja-bersama-btn"
        onClick={() => {
          labSound.playClick();
          onToggle();
        }}
        aria-expanded={isOpen}
        className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
          activeRoomId
            ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success)]/35 text-[var(--comfort-success)]'
            : isOpen
            ? 'comfort-tab-active border-transparent'
            : 'comfort-btn-secondary'
        }`}
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {activeRoomId ? `Room: ${activeRoomId}` : 'Meja Bersama'}
        </span>
        {activeRoomId && (
          <span className="font-mono text-2xs font-bold tabular-nums opacity-85">
            · {memberCount}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={MODAL_POPOVER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            data-testid="meja-bersama-popover"
            className="absolute right-0 mt-2 w-72 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-xl p-3.5 space-y-3 z-50 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
              <div className="flex items-center gap-2 font-semibold">
                <Users className="w-4 h-4 text-[var(--comfort-accent)]" />
                <span>Meja Bersama (Kolaborasi)</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup Popover Meja Bersama"
                className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] p-1 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeRoomId ? (
              <div className="p-2.5 rounded-lg bg-[var(--comfort-success-soft)] border border-[var(--comfort-success)]/30 space-y-2">
                <div className="flex items-center justify-between font-mono text-2xs font-bold text-[var(--comfort-success)] tabular-nums">
                  <span>Room: {activeRoomId}</span>
                  <span>{memberCount} Peserta</span>
                </div>
                {roomPin && (
                  <div className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                    PIN Meja: <strong className="text-[var(--comfort-text)]">{roomPin}</strong>
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  {userRole === 'pengajar' && onToggleTeacherFreeze && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick(540);
                        onToggleTeacherFreeze(!isFrozenByTeacher);
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-2xs flex items-center justify-center gap-1 cursor-pointer ${
                        isFrozenByTeacher
                          ? 'bg-rose-700 hover:bg-rose-600 text-white'
                          : 'comfort-btn-secondary'
                      }`}
                    >
                      {isFrozenByTeacher ? (
                        <Unlock className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3 text-[var(--comfort-warning)]" />
                      )}
                      <span>{isFrozenByTeacher ? 'Buka Kunci' : 'Kunci Layar'}</span>
                    </button>
                  )}
                  {onLeaveRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        onLeaveRoom();
                        onClose();
                      }}
                      className="py-1.5 px-2.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:text-rose-600 text-2xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Keluar</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                Gabung meja praktikum kelompok dengan PIN atau buat ruangan baru via Internet maupun Hotspot LAN kelas.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onClose();
                  onOpenRoomModal('join');
                }}
                className="py-2 px-2.5 rounded-lg comfort-btn-secondary font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
                <span>Masuk dengan PIN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onClose();
                  onOpenRoomModal('create');
                }}
                className="py-2 px-2.5 rounded-lg comfort-btn-primary font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>+ Buat Room</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
