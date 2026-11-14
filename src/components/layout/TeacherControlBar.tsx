import React from 'react';
import {
  Crosshair,
  FlaskConical,
  LayoutDashboard,
  Lock,
  Sparkles,
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
  setTeacherViewMode: React.Dispatch<React.SetStateAction<'dashboard' | 'lab3d'>>;
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
 * Floating Teacher Control Bar displayed at the top of the workspace when role === 'pengajar'.
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
    <div className="shrink-0 bg-slate-900/95 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-mono font-bold text-amber-300">
          <Users className="w-3.5 h-3.5" />
          {activeRoomId
            ? `MEJA AKTIF: ${activeRoomId}${roomPin ? ` (PIN: ${roomPin})` : ''} · ${roomMembersCount} Peserta`
            : 'MODE GURU: Belum Membuka Room PIN'}
        </span>

        {lanInfo && (
          <span
            data-testid="teacher-bar-lan-badge"
            title="Tips Daerah 3T: Nyalakan Hotspot Wi-Fi di laptop Guru agar siswa dapat membuka IP ini tanpa kuota internet!"
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300"
          >
            <Wifi className="w-3.5 h-3.5 text-amber-400" />
            <span>
              LAN: <strong className="text-white select-all">{lanInfo.localUrl}</strong>
            </span>
          </span>
        )}

        {liveStudentTelemetries.length > 0 && (
          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-300 font-mono">
            <span className="text-slate-500">Live Telemetri Siswa:</span>
            {liveStudentTelemetries.slice(0, 3).map((st) => (
              <span
                key={st.studentName}
                className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300"
              >
                {st.studentName}: {st.moduleTitle} ({st.recordsCount} data)
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="teacher-view-mode-btn"
          onClick={() => {
            labSound.playClick(600);
            if (isLobbyMode) setIsLobbyMode(false);
            setTeacherViewMode((prev) => (prev === 'dashboard' ? 'lab3d' : 'dashboard'));
          }}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
            teacherViewMode === 'lab3d' && !isLobbyMode
              ? 'bg-sky-600 text-white border-sky-400 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
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
              <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
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
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
            teacherLaserActive
              ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/50 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-slate-700'
          }`}
          title="Arahkan kursor pada objek 3D untuk memancarkan sinar Laser Pointer merah real-time ke seluruh layar murid"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>{teacherLaserActive ? '🔴 Laser Pointer Aktif' : '🔴 Laser Pointer 3D'}</span>
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
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
            teacherCameraSyncEnabled
              ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
          }`}
          title="Sinkronkan sudut pandang kamera 3D murid mengikuti rotasi kamera Guru secara langsung"
        >
          {teacherCameraSyncEnabled ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <VideoOff className="w-3.5 h-3.5" />
          )}
          <span>{teacherCameraSyncEnabled ? '🎥 Kamera Tersinkron' : '🎥 Sinkronkan Kamera Murid'}</span>
        </button>

        <button
          type="button"
          data-testid="teacher-bar-ai-mission-btn"
          onClick={() => {
            labSound.playClick(620);
            onOpenAiMissionBuilder();
          }}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>✨ Buat Misi Praktikum AI</span>
        </button>

        {!activeRoomId && (
          <button
            type="button"
            onClick={onOpenCreateRoom}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
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
          className={`px-4 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
            isFrozenByTeacher
              ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/50'
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
