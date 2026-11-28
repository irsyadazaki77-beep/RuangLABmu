import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Columns2,
  Copy,
  Cpu,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { SPRING_TACTILE } from '../../../styles/motionPresets';
import { labSound } from '../../../utils/soundEngine';

export interface SpatialHudTopBarProps {
  domainLabel: string;
  moduleTitle: string;
  activeRoomId: string | null;
  copiedPin: boolean;
  onCopyRoomPin: () => void;
  onRequestExitToLobby: () => void;
  onBackToPreLab?: () => void;
  isOnline: boolean;
  wsConnected: boolean;
  outboxSyncStatus: string;
  outboxPendingCount: number;
  outboxLabel: string;
  liteDeviceMode: boolean;
  onToggleLiteDeviceMode: () => void;
  fps: number;
  qualityTier: string;
  qualityMode: 'auto' | '3t-saver' | 'high';
  onChangeQualityMode: (mode: 'auto' | '3t-saver' | 'high') => void;
  prefer2DFallback: boolean;
  onToggle2DFallback: () => void;
  dualModeActive: boolean;
  onToggleDualMode?: () => void;
  isLeftVisible: boolean;
  onToggleLeftDrawer: () => void;
  isRightVisible: boolean;
  onToggleRightDrawer: () => void;
  zenMode: boolean;
  onToggleFocus3D: () => void;
  onOpenDrLabMu: () => void;
}

export const SpatialHudTopBar: React.FC<SpatialHudTopBarProps> = ({
  domainLabel,
  moduleTitle,
  activeRoomId,
  copiedPin,
  onCopyRoomPin,
  onRequestExitToLobby,
  onBackToPreLab,
  isOnline,
  wsConnected,
  outboxSyncStatus,
  outboxPendingCount,
  outboxLabel,
  liteDeviceMode,
  onToggleLiteDeviceMode,
  fps,
  qualityTier,
  qualityMode,
  onChangeQualityMode,
  prefer2DFallback,
  onToggle2DFallback,
  dualModeActive,
  onToggleDualMode,
  isLeftVisible,
  onToggleLeftDrawer,
  isRightVisible,
  onToggleRightDrawer,
  zenMode,
  onToggleFocus3D,
  onOpenDrLabMu,
}) => {
  const [displayPopoverOpen, setDisplayPopoverOpen] = useState(false);
  const displayPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!displayPopoverOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        displayPopoverRef.current &&
        !displayPopoverRef.current.contains(e.target as Node)
      ) {
        setDisplayPopoverOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDisplayPopoverOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [displayPopoverOpen]);

  return (
    <div
      data-testid="spatial-hud-top-bar"
      className="absolute top-2.5 left-2.5 right-2.5 sm:left-3 sm:right-3 z-30 flex items-center justify-between gap-2 rounded-xl border studio-hud-surface px-2.5 sm:px-3 py-1.5 shadow-xl"
    >
      {/* Left: Exit / Back + Concise Zero-Pill Breadcrumb */}
      <nav
        aria-label="Breadcrumb Ruang Praktikum"
        className="flex items-center gap-1.5 text-xs min-w-0 flex-1"
      >
        {onBackToPreLab && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onBackToPreLab();
            }}
            title="Kembali ke Tahap 1 Briefing Pra-Lab"
            aria-label="Kembali ke Briefing Pra-Lab"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onRequestExitToLobby}
          aria-label="Kembali ke Katalog Laboratorium"
          className="font-semibold text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-accent)] transition-colors cursor-pointer shrink-0 rounded whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
        >
          Lobby
        </button>
        <span className="text-[var(--comfort-hud-muted)] opacity-45 shrink-0" aria-hidden="true">/</span>
        <span className="font-semibold text-[var(--comfort-accent)] shrink-0 capitalize hidden sm:inline whitespace-nowrap">
          {domainLabel}
        </span>
        <span className="text-[var(--comfort-hud-muted)] opacity-45 hidden sm:inline shrink-0" aria-hidden="true">/</span>
        <span
          title={moduleTitle}
          className="font-bold text-[var(--comfort-hud-text)] truncate min-w-0 max-w-[130px] sm:max-w-[210px] xl:max-w-[300px] 2xl:max-w-[400px]"
        >
          {moduleTitle}
        </span>
      </nav>

      {/* Right: Room PIN · 3T Sync · Performance & Quality · Drawers · Focus 3D · Dr. LabMu */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {activeRoomId && (
          <button
            type="button"
            onClick={onCopyRoomPin}
            title="Salin PIN Room Kolaborasi"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--comfort-success-soft)] border border-[var(--comfort-success-border)] text-[var(--comfort-success)] font-mono text-2xs font-bold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>PIN: {activeRoomId}</span>
            {copiedPin ? (
              <Check className="w-3 h-3 text-[var(--comfort-success)]" />
            ) : (
              <Copy className="w-3 h-3 opacity-80" />
            )}
          </button>
        )}

        <span
          data-testid="hud-3t-connection-pill"
          className={`inline-flex items-center gap-1 px-1.5 py-1 text-2xs font-medium whitespace-nowrap shrink-0 ${
            !isOnline || outboxPendingCount > 0
              ? 'text-[var(--comfort-warning)]'
              : outboxSyncStatus === 'syncing'
              ? 'text-[var(--comfort-accent)]'
              : 'text-[var(--comfort-hud-muted)]'
          }`}
          title={
            isOnline
              ? wsConnected
                ? `Sinkronisasi Real-Time Aktif · ${outboxLabel}`
                : `Online (PWA 3T Siap) · ${outboxLabel}`
              : `Mode Luring 3T Aktif · ${outboxLabel}`
          }
        >
          {isOnline ? (
            <Wifi className="w-3 h-3 text-[var(--comfort-success)] shrink-0" aria-hidden="true" />
          ) : (
            <WifiOff className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          <span data-testid="hud-3t-sync-status-label" className="hidden md:inline">
            {outboxLabel}
          </span>
        </span>

        {/* Compact Display & 3T Settings Popover on < xl viewports */}
        <div ref={displayPopoverRef} className="relative xl:hidden shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setDisplayPopoverOpen((prev) => !prev);
            }}
            aria-expanded={displayPopoverOpen}
            aria-label="Pengaturan Tampilan 3D & Mode 3T"
            title="Pengaturan Grafis 3D, Mode 2D & Hemat 3T"
            className={`inline-flex items-center gap-1 px-2 py-1 min-h-[34px] rounded-lg border text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              displayPopoverOpen || liteDeviceMode || prefer2DFallback
                ? 'comfort-accent-soft'
                : 'studio-hud-subcard text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">
              {prefer2DFallback ? '2D' : liteDeviceMode ? 'Lite' : 'Grafis'}
            </span>
          </button>

          {displayPopoverOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-elevated)] text-[var(--comfort-text)] shadow-2xl p-3 space-y-2.5 z-40">
              <div className="flex items-center justify-between text-2xs font-semibold border-b border-[var(--comfort-border)] pb-1.5">
                <span>Tampilan &amp; Optimasi 3T</span>
                <span className="font-mono text-2xs text-[var(--comfort-text-muted)] tabular-nums">
                  {Math.round(fps)} FPS
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-2xs font-medium text-[var(--comfort-text-muted)]">
                  Kualitas Grafis 3D
                </label>
                <select
                  aria-label="Pilih Kualitas Grafis 3D (Compact)"
                  value={qualityMode}
                  onChange={(e) => {
                    labSound.playClick();
                    onChangeQualityMode(e.target.value as 'auto' | '3t-saver' | 'high');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs font-semibold text-[var(--comfort-text)]"
                >
                  <option value="auto">Otomatis</option>
                  <option value="3t-saver">Hemat Baterai 3T</option>
                  <option value="high">Tinggi</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(liteDeviceMode ? 680 : 520);
                    onToggleLiteDeviceMode();
                  }}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg border text-2xs font-semibold cursor-pointer transition-colors ${
                    liteDeviceMode
                      ? 'comfort-tab-active border-transparent'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
                  }`}
                >
                  {liteDeviceMode ? 'Mode Lite: ON' : 'Mode Lite 3T'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onToggle2DFallback();
                  }}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg border text-2xs font-semibold cursor-pointer transition-colors ${
                    prefer2DFallback
                      ? 'comfort-tab-active border-transparent'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
                  }`}
                >
                  {prefer2DFallback ? 'Kembali 3D' : 'Mode 2D'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Direct 3T & Quality Controls */}
        <button
          type="button"
          data-testid="hud-lite-mode-toggle-btn"
          aria-pressed={liteDeviceMode}
          onClick={() => {
            labSound.playClick(liteDeviceMode ? 680 : 520);
            onToggleLiteDeviceMode();
          }}
          title={
            liteDeviceMode
              ? `Mode Ringan 3T Aktif (${Math.round(fps)} FPS) — Klik untuk Kualitas Otomatis`
              : `Kualitas ${qualityTier} — Klik untuk Mengaktifkan Mode Ringan 3T`
          }
          className={`hidden xl:inline-flex items-center gap-1 h-8 px-2 rounded-lg border text-2xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            liteDeviceMode
              ? 'comfort-accent-soft font-semibold'
              : 'studio-hud-subcard hover:border-[var(--comfort-accent-border)] text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
          }`}
        >
          {liteDeviceMode ? (
            <Zap className="w-3 h-3 text-[var(--comfort-warning)] shrink-0" aria-hidden="true" />
          ) : (
            <Cpu className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          <span data-testid="hud-fps-quality-badge">
            {liteDeviceMode ? 'Mode Lite' : 'Standar'}
          </span>
        </button>

        {/* Manual Quality Tier Selector */}
        <label className="hidden xl:inline-flex flex-nowrap items-center gap-1.5 h-8 px-2.5 rounded-lg border studio-hud-subcard text-2xs font-mono focus-within:ring-2 focus-within:ring-[var(--comfort-accent)] shrink-0 whitespace-nowrap">
          <span className="text-[var(--comfort-hud-muted)] leading-none">Kualitas:</span>
          <span className="relative inline-flex items-center">
            <select
              data-testid="hud-quality-mode-select"
              aria-label="Pilih Kualitas Grafis 3D"
              value={qualityMode}
              onChange={(e) => {
                const nextMode = e.target.value as 'auto' | '3t-saver' | 'high';
                labSound.playClick();
                onChangeQualityMode(nextMode);
              }}
              className="appearance-none bg-transparent pr-4 text-[var(--comfort-accent)] font-semibold focus:outline-none cursor-pointer whitespace-nowrap leading-none py-0 m-0"
            >
              <option value="auto" className="bg-[var(--comfort-surface)] text-[var(--comfort-text)]">Otomatis</option>
              <option value="3t-saver" className="bg-[var(--comfort-surface)] text-[var(--comfort-text)]">Hemat Baterai 3T</option>
              <option value="high" className="bg-[var(--comfort-surface)] text-[var(--comfort-text)]">Tinggi</option>
            </select>
            <ChevronDown
              className="w-3 h-3 text-[var(--comfort-hud-muted)] pointer-events-none absolute right-0"
              aria-hidden="true"
            />
          </span>
        </label>

        {/* Manual 2D Lightweight Telemetry Fallback Toggle */}
        <button
          type="button"
          data-testid="hud-2d-fallback-toggle-btn"
          aria-pressed={prefer2DFallback}
          aria-label={
            prefer2DFallback
              ? 'Kembali ke Visualisasi WebGL 3D'
              : 'Beralih ke Mode Ringan 2D'
          }
          onClick={() => {
            labSound.playClick();
            onToggle2DFallback();
          }}
          title={
            prefer2DFallback
              ? 'Kembali ke Visualisasi WebGL 3D'
              : 'Beralih ke Mode Ringan 2D (Hemat Baterai / Perangkat Non-WebGL)'
          }
          className={`hidden xl:inline-flex items-center gap-1 h-8 px-2 rounded-lg border font-mono text-2xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            prefer2DFallback
              ? 'comfort-accent-soft'
              : 'studio-hud-subcard text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
          }`}
        >
          <span>{prefer2DFallback ? '3D' : '2D'}</span>
        </button>

        {onToggleDualMode && (
          <button
            type="button"
            aria-pressed={dualModeActive}
            onClick={() => {
              labSound.playClick();
              onToggleDualMode();
            }}
            className={`hidden md:inline-flex items-center gap-1 h-8 px-2 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              dualModeActive
                ? 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)] text-[var(--comfort-warning)]'
                : 'studio-hud-subcard text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
            }`}
            title="Bandingkan Dua Realitas Parameter (A vs B)"
          >
            <Columns2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>A/B</span>
          </button>
        )}

        <span className="hidden lg:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* Left Drawer Toggle '[' */}
        <button
          type="button"
          onClick={onToggleLeftDrawer}
          aria-label="Toggle Panel Parameter ([)"
          aria-pressed={isLeftVisible}
          title="Tampilkan/Sembunyikan Panel Parameter ([)"
          className={`hidden lg:inline-flex items-center gap-1 h-8 px-2 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            isLeftVisible
              ? 'comfort-accent-soft'
              : 'studio-hud-subcard text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
          }`}
        >
          {isLeftVisible ? (
            <PanelLeftClose className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Parameter</span>
          <kbd className="text-2xs font-mono opacity-75">[</kbd>
        </button>

        {/* Right Drawer Toggle ']' */}
        <button
          type="button"
          onClick={onToggleRightDrawer}
          aria-label="Toggle Panel Telemetri & Rumus (])"
          aria-pressed={isRightVisible}
          title="Tampilkan/Sembunyikan Telemetri & Grafik (])"
          className={`hidden lg:inline-flex items-center gap-1 h-8 px-2 rounded-lg border text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            isRightVisible
              ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)] text-[var(--comfort-success)]'
              : 'studio-hud-subcard text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
          }`}
        >
          {isRightVisible ? (
            <PanelRightClose className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Telemetri</span>
          <kbd className="text-2xs font-mono opacity-75">]</kbd>
        </button>

        {/* Focus 3D Button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          transition={SPRING_TACTILE}
          onClick={onToggleFocus3D}
          data-testid="focus-3d-toggle-btn"
          aria-pressed={zenMode}
          title="Focus 3D Penuh (Sembunyikan Kedua Panel)"
          className={`inline-flex items-center justify-center gap-1 h-8 min-w-[34px] px-2 sm:px-2.5 rounded-lg border text-2xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            zenMode
              ? 'bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] border-[var(--comfort-warning)]'
              : 'studio-hud-subcard text-[var(--comfort-hud-text)] hover:border-[var(--comfort-accent-border)]'
          }`}
        >
          {zenMode ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar Focus 3D</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Focus 3D</span>
            </>
          )}
        </motion.button>

        {/* Quick Dr. LabMu Assistant Button */}
        <button
          type="button"
          onClick={onOpenDrLabMu}
          aria-label="Buka Asisten Dr. LabMu"
          title="Diskusi Sokratik Dr. LabMu (Shortcut A)"
          className="inline-flex items-center justify-center gap-1 h-8 min-w-[34px] px-2.5 rounded-lg comfort-btn-primary text-2xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
        >
          <Bot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden 2xl:inline">Dr. LabMu</span>
        </button>
      </div>
    </div>
  );
};
