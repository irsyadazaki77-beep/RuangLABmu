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
    <div className="shrink-0 bg-[var(--comfort-surface)] border-b border-[var(--comfort-border)] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2.5 z-30 text-[var(--comfort-text)] overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2.5 text-xs shrink-0">
        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[var(--comfort-accent)] tabular-nums whitespace-nowrap">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>
            {activeRoomId
              ? `Room ${activeRoomId}${roomPin ? ` (PIN: ${roomPin})` : ''} · ${roomMembersCount} Peserta`
              : 'Mode Guru · Belum Ada Room'}
          </span>
        </span>

        {lanInfo && (
          <>
            <span className="hidden lg:inline-block w-px h-4 bg-[var(--comfort-border)]" aria-hidden="true" />
            <span
              data-testid="teacher-bar-lan-badge"
              title="Tips Daerah 3T: Nyalakan Hotspot Wi-Fi di laptop Guru agar siswa dapat membuka IP ini tanpa kuota internet!"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-mono text-[var(--comfort-text-muted)] whitespace-nowrap"
            >
              <Wifi className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
              <span>
                LAN: <strong className="text-[var(--comfort-text)] select-all">{lanInfo.localUrl}</strong>
              </span>
            </span>
          </>
        )}

        {liveStudentTelemetries.length > 0 && (
          <>
            <span className="hidden 2xl:inline-block w-px h-4 bg-[var(--comfort-border)]" aria-hidden="true" />
            <div className="hidden 2xl:flex items-center gap-2 text-xs text-[var(--comfort-text-muted)] font-mono tabular-nums whitespace-nowrap">
              <span>Aktif:</span>
              {liveStudentTelemetries.slice(0, 2).map((st, i) => (
                <span key={st.studentName} className="text-[var(--comfort-accent)]">
                  {i > 0 && <span className="text-[var(--comfort-text-muted)] mr-2">·</span>}
                  {st.studentName}: {st.moduleTitle} ({st.recordsCount})
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="teacher-view-mode-btn"
          onClick={() => {
            labSound.playClick(600);
            if (isLobbyMode) setIsLobbyMode(false);
            setTeacherViewMode(teacherViewMode === 'dashboard' ? 'lab3d' : 'dashboard');
          }}
          className={`min-h-[34px] px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherViewMode === 'lab3d' && !isLobbyMode
              ? 'comfort-tab-active border-transparent'
              : 'comfort-btn-secondary'
          }`}
          title="Beralih antara Dashboard Monitoring Kelas dan Ruang Lab 3D Demonstrasi Guru"
        >
          {teacherViewMode === 'lab3d' && !isLobbyMode ? (
            <>
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </>
          ) : (
            <>
              <FlaskConical className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
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
          className={`min-h-[34px] px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherLaserActive
              ? 'bg-rose-700 text-white border-rose-600'
              : 'comfort-btn-secondary'
          }`}
          title="Arahkan kursor pada objek 3D untuk memancarkan sinar Laser Pointer merah real-time ke seluruh layar murid"
        >
          <Crosshair className={`w-3.5 h-3.5 ${teacherLaserActive ? '' : 'text-[var(--comfort-danger)]'}`} />
          <span>{teacherLaserActive ? 'Laser Aktif' : 'Laser 3D'}</span>
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
          className={`min-h-[34px] px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
            teacherCameraSyncEnabled
              ? 'comfort-tab-active border-transparent'
              : 'comfort-btn-secondary'
          }`}
          title="Sinkronkan sudut pandang kamera 3D murid mengikuti rotasi kamera Guru secara langsung"
        >
          {teacherCameraSyncEnabled ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <VideoOff className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]" />
          )}
          <span>{teacherCameraSyncEnabled ? 'Kamera Tersinkron' : 'Sinkron Kamera'}</span>
        </button>

        <button
          type="button"
          data-testid="teacher-bar-ai-mission-btn"
          onClick={() => {
            labSound.playClick(620);
            onOpenAiMissionBuilder();
          }}
          title="Buat Misi Praktikum Kustom Berbasis AI"
          className="min-h-[34px] px-2.5 py-1 rounded-lg comfort-btn-secondary font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Wand2 className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
          <span>Misi AI</span>
        </button>

        {!activeRoomId && (
          <button
            type="button"
            onClick={onOpenCreateRoom}
            title="Buat Meja Praktikum Ber-PIN untuk Kelas"
            className="min-h-[34px] px-2.5 py-1 rounded-lg comfort-btn-primary font-semibold text-xs cursor-pointer transition-colors whitespace-nowrap"
          >
            + Buat Room PIN
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
          title={
            isFrozenByTeacher
              ? 'Buka Kunci Layar Murid (Unfreeze Inputs)'
              : 'Kunci Sementara Layar Murid (Freeze Inputs)'
          }
          className={`min-h-[34px] px-3 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
            isFrozenByTeacher
              ? 'bg-rose-700 hover:bg-rose-600 text-white border border-rose-600'
              : 'comfort-btn-secondary'
          }`}
        >
          {isFrozenByTeacher ? (
            <Unlock className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-[var(--comfort-warning)]" />
          )}
          <span>{isFrozenByTeacher ? 'Buka Kunci Layar' : 'Kunci Layar Murid'}</span>
        </button>
      </div>
    </div>
  );
};
