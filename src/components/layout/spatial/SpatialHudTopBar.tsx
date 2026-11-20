import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  Check,
  Columns2,
  Copy,
  Cpu,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
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
  return (
    <div
      data-testid="spatial-hud-top-bar"
      className="absolute top-2.5 left-2.5 right-2.5 sm:left-3 sm:right-3 z-30 flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-950/92 text-slate-100 px-2.5 sm:px-3 py-1.5 shadow-xl"
    >
      {/* Left: Exit / Back + Concise Zero-Pill Breadcrumb */}
      <nav
        aria-label="Breadcrumb Ruang Praktikum"
        className="flex items-center gap-1.5 text-xs min-w-0"
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
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onRequestExitToLobby}
          aria-label="Kembali ke Katalog Laboratorium"
          className="font-semibold text-slate-300 hover:text-sky-400 transition-colors cursor-pointer shrink-0 rounded whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          Lobby
        </button>
        <span className="text-slate-600 shrink-0" aria-hidden="true">/</span>
        <span className="font-semibold text-sky-400 shrink-0 capitalize hidden sm:inline whitespace-nowrap">
          {domainLabel}
        </span>
        <span className="text-slate-600 hidden sm:inline shrink-0" aria-hidden="true">/</span>
        <span className="font-bold text-white truncate max-w-[95px] sm:max-w-[230px]">
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>PIN: {activeRoomId}</span>
            {copiedPin ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 opacity-80" />
            )}
          </button>
        )}

        <span
          data-testid="hud-3t-connection-pill"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-medium whitespace-nowrap shrink-0 ${
            !isOnline || outboxPendingCount > 0
              ? 'bg-amber-500/12 border-amber-500/40 text-amber-300'
              : outboxSyncStatus === 'syncing'
              ? 'bg-sky-500/12 border-sky-500/40 text-sky-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
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
            <Wifi className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <WifiOff className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          <span data-testid="hud-3t-sync-status-label" className="hidden md:inline">
            {outboxLabel}
          </span>
        </span>

        {/* Live FPS & 3T Lite Mode Toggle */}
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
              ? 'Mode Ringan 3T Aktif (Klik untuk Kualitas Otomatis)'
              : 'Klik untuk Mengaktifkan Mode Ringan 3T'
          }
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[10px] font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            liteDeviceMode
              ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
              : 'bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500/50'
          }`}
        >
          {liteDeviceMode ? (
            <Zap className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
          ) : (
            <Cpu className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" />
          )}
          <span data-testid="hud-fps-quality-badge">{Math.round(fps)} FPS</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="uppercase text-[9px] text-cyan-200">
            {liteDeviceMode ? 'lite' : qualityTier}
          </span>
        </button>

        {/* Manual Quality Tier Selector */}
        <label className="hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 focus-within:ring-2 focus-within:ring-sky-400 shrink-0">
          <span className="text-slate-400">Kualitas:</span>
          <select
            data-testid="hud-quality-mode-select"
            aria-label="Pilih Kualitas Grafis 3D"
            value={qualityMode}
            onChange={(e) => {
              const nextMode = e.target.value as 'auto' | '3t-saver' | 'high';
              labSound.playClick();
              onChangeQualityMode(nextMode);
            }}
            className="bg-transparent text-sky-300 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="auto" className="bg-slate-900 text-slate-100">Otomatis</option>
            <option value="3t-saver" className="bg-slate-900 text-slate-100">Hemat Baterai 3T</option>
            <option value="high" className="bg-slate-900 text-slate-100">Tinggi</option>
          </select>
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
          className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            prefer2DFallback
              ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
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
            className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              dualModeActive
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Bandingkan Dua Realitas Parameter (A vs B)"
          >
            <Columns2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>A/B</span>
          </button>
        )}

        <span className="hidden lg:block w-px h-4 bg-slate-700/80 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Left Drawer Toggle '[' */}
        <button
          type="button"
          onClick={onToggleLeftDrawer}
          aria-label="Toggle Panel Parameter ([)"
          aria-pressed={isLeftVisible}
          title="Tampilkan/Sembunyikan Panel Parameter ([)"
          className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            isLeftVisible
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          {isLeftVisible ? (
            <PanelLeftClose className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Parameter</span>
          <kbd className="text-[9px] font-mono opacity-75">[</kbd>
        </button>

        {/* Right Drawer Toggle ']' */}
        <button
          type="button"
          onClick={onToggleRightDrawer}
          aria-label="Toggle Panel Telemetri & Rumus (])"
          aria-pressed={isRightVisible}
          title="Tampilkan/Sembunyikan Telemetri & Grafik (])"
          className={`hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            isRightVisible
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          {isRightVisible ? (
            <PanelRightClose className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Telemetri</span>
          <kbd className="text-[9px] font-mono opacity-75">]</kbd>
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
          className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            zenMode
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900 border-slate-700 text-slate-100 hover:border-sky-500/50'
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
          title="Diskusi Sokratik Dr. LabMu"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Bot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden xl:inline">Dr. LabMu</span>
        </button>
      </div>
    </div>
  );
};
