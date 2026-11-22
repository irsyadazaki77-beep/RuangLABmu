import React from 'react';
import {
  Crosshair,
  FlaskConical,
  LayoutDashboard,
  Lock,
  Wand2,
  Unlock,
  Users,
  Video,
  VideoOff,
  Wifi,
} from 'lucide-react';
import { useCollabStore } from '../../stores/useCollabStore';
import type { StudentLiveTelemetry } from '../../utils/collabProtocol';
import { labSound } from '../../utils/soundEngine';
import type { WorkspaceLanInfo } from '../../hooks/useWorkspaceMissions';

export interface TeacherControlBarProps {
  activeRoomId: string | null;
  roomPin: string | null;
  roomMembersCount: number;
  lanInfo: WorkspaceLanInfo | null;
  liveStudentTelemetries: StudentLiveTelemetry[];
  isLobbyMode: boolean;
  setIsLobbyMode: (val: boolean) => void;
  teacherViewMode: 'dashboard' | 'lab3d';
  setTeacherViewMode: (mode: 'dashboard' | 'lab3d') => void;
  teacherLaserActive: boolean;
  setTeacherLaserActive: (val: boolean) => void;
  teacherCameraSyncEnabled: boolean;
  setTeacherCameraSyncEnabled: (val: boolean) => void;
  isFrozenByTeacher: boolean;
  currentProfileName: string;
  onOpenAiMissionBuilder: () => void;
  onOpenCreateRoom: () => void;
  onToggleTeacherFreeze?: (freeze: boolean) => void;
}

/**
 * Clean Teacher Control Bar displayed at the top of the workspace when role === 'pengajar'.
 */
export const TeacherControlBar: React.FC<TeacherControlBarProps> = ({
  activeRoomId,
  roomPin,
  roomMembersCount,
  lanInfo,
  liveStudentTelemetries,
  isLobbyMode,
  setIsLobbyMode,
  teacherViewMode,
  setTeacherViewMode,
  teacherLaserActive,
  setTeacherLaserActive,
  teacherCameraSyncEnabled,
  setTeacherCameraSyncEnabled,
  isFrozenByTeacher,
  currentProfileName,
  onOpenAiMissionBuilder,
  onOpenCreateRoom,
  onToggleTeacherFreeze,
}) => {
  return (
    <div className="shrink-0 bg-[var(--comfort-surface)] border-b border-[var(--comfort-border)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-30 text-[var(--comfort-text)]">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>
            {activeRoomId
              ? `MEJA AKTIF: ${activeRoomId}${roomPin ? ` (PIN: ${roomPin})` : ''} · ${roomMembersCount} Peserta`
              : 'MODE GURU: Belum Membuka Room PIN'}
          </span>
        </span>

        {lanInfo && (
          <>
            <span className="hidden lg:inline-block w-px h-4 bg-[var(--comfort-border)]" aria-hidden="true" />
            <span
              data-testid="teacher-bar-lan-badge"
              title="Tips Daerah 3T: Nyalakan Hotspot Wi-Fi di laptop Guru agar siswa dapat membuka IP ini tanpa kuota internet!"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-mono text-[var(--comfort-text-muted)]"
            >
              <Wifi className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                LAN: <strong className="text-[var(--comfort-text)] select-all">{lanInfo.localUrl}</strong>
              </span>
            </span>
          </>
        )}

        {liveStudentTelemetries.length > 0 && (
          <>
            <span className="hidden xl:inline-block w-px h-4 bg-[var(--comfort-border)]" aria-hidden="true" />
            <div className="hidden xl:flex items-center gap-2 text-xs text-[var(--comfort-text-muted)] font-mono tabular-nums">
              <span>Telemetri:</span>
              {liveStudentTelemetries.slice(0, 2).map((st, i) => (
                <span key={st.studentName} className="text-sky-600 dark:text-sky-300">
                  {i > 0 && <span className="text-[var(--comfort-text-muted)] mr-2">·</span>}
                  {st.studentName}: {st.moduleTitle} ({st.recordsCount})
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="teacher-view-mode-btn"
          onClick={() => {
            labSound.playClick(600);
            if (isLobbyMode) setIsLobbyMode(false);
            setTeacherViewMode(teacherViewMode === 'dashboard' ? 'lab3d' : 'dashboard');
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherViewMode === 'lab3d' && !isLobbyMode
              ? 'bg-sky-600 text-white border-sky-500'
              : 'bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border-[var(--comfort-border)]'
          }`}
          title="Beralih antara Dashboard Monitoring Kelas dan Ruang Lab 3D Demonstrasi Guru"
        >
          {teacherViewMode === 'lab3d' && !isLobbyMode ? (
            <>
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard Guru</span>
            </>
          ) : (
            <>
              <FlaskConical className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Lab 3D Guru</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="teacher-laser-toggle-btn"
          onClick={() => {
            const next = !teacherLaserActive;
            labSound.playClick(next ? 740 : 480);
            setTeacherLaserActive(next);
            if (next) {
              if (isLobbyMode) setIsLobbyMode(false);
              setTeacherViewMode('lab3d');
            }
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherLaserActive
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-elevated)] text-rose-700 dark:text-rose-300 border-[var(--comfort-border)]'
          }`}
          title="Arahkan kursor pada objek 3D untuk memancarkan sinar Laser Pointer merah real-time ke seluruh layar murid"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>{teacherLaserActive ? 'Laser Pointer Aktif' : 'Laser Pointer 3D'}</span>
        </button>

        <button
          type="button"
          data-testid="teacher-camera-sync-toggle-btn"
          onClick={() => {
            const next = !teacherCameraSyncEnabled;
            labSound.playClick(next ? 700 : 460);
            setTeacherCameraSyncEnabled(next);
            if (next) {
              if (isLobbyMode) setIsLobbyMode(false);
              setTeacherViewMode('lab3d');
            }
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherCameraSyncEnabled
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-elevated)] text-indigo-700 dark:text-indigo-300 border-[var(--comfort-border)]'
          }`}
          title="Sinkronkan sudut pandang kamera 3D murid mengikuti rotasi kamera Guru secara langsung"
        >
          {teacherCameraSyncEnabled ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <VideoOff className="w-3.5 h-3.5" />
          )}
          <span>{teacherCameraSyncEnabled ? 'Kamera Tersinkron' : 'Sinkronkan Kamera Murid'}</span>
        </button>

        <button
          type="button"
          data-testid="teacher-bar-ai-mission-btn"
          onClick={() => {
            labSound.playClick(620);
            onOpenAiMissionBuilder();
          }}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Buat Misi Praktikum AI</span>
        </button>

        {!activeRoomId && (
          <button
            type="button"
            onClick={onOpenCreateRoom}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer transition-colors whitespace-nowrap"
          >
            + Buat Meja Praktikum Ber-PIN
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            labSound.playClick(540);
            if (onToggleTeacherFreeze) {
              onToggleTeacherFreeze(!isFrozenByTeacher);
            } else {
              useCollabStore.getState().setTeacherFreeze(!isFrozenByTeacher, currentProfileName);
            }
          }}
          className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
            isFrozenByTeacher
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
          }`}
        >
          {isFrozenByTeacher ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          <span>
            {isFrozenByTeacher
              ? 'Buka Kunci Layar Murid (Unfreeze)'
              : 'Kunci Layar Murid (Freeze Inputs)'}
          </span>
        </button>
      </div>
    </div>
  );
};
