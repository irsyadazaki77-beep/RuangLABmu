import { create } from 'zustand';
import {
  SpatialCursorPayload,
  ParameterLockPayload,
  LabRoom,
  LabRoomClient,
  StudentLiveTelemetry,
  CustomAIMissionPayload,
} from '../utils/collabProtocol';

export interface CollabState {
  wsConnected: boolean;
  activeRoomId: string | null;
  activeRoom: LabRoom | null;
  activeCustomMission: CustomAIMissionPayload | null;
  roomPin: string | null;
  roomError: string | null;
  isFrozenByTeacher: boolean;
  teacherName: string | null;
  roomMembers: Record<string, LabRoomClient>;
  peerCursors: Record<string, SpatialCursorPayload>;
  lockedParameters: Record<string, ParameterLockPayload>;
  studentTelemetryMap: Record<string, StudentLiveTelemetry>;
  isRoomModalOpen: boolean;
  roomModalMode: 'create' | 'join';
  prefilledRoomCode: string | null;

  // Actions
  setWsConnected: (wsConnected: boolean) => void;
  setActiveRoomId: (activeRoomId: string | null) => void;
  setActiveRoom: (room: LabRoom | null) => void;
  setActiveCustomMission: (mission: CustomAIMissionPayload | null) => void;
  setRoomPin: (pin: string | null) => void;
  setRoomError: (err: string | null) => void;
  setIsFrozenByTeacher: (isFrozen: boolean, teacherName?: string) => void;
  setTeacherFreeze: (isFrozen: boolean, teacherName?: string) => void;
  setRoomMembers: (members: Record<string, LabRoomClient>) => void;
  updateStudentTelemetry: (studentName: string, telemetry: StudentLiveTelemetry) => void;
  updatePeers: (peerCursors: Record<string, SpatialCursorPayload>) => void;
  setLock: (paramKey: string, lock: ParameterLockPayload) => void;
  releaseLock: (paramKey: string) => void;
  clearLocks: () => void;
  setRoomModal: (open: boolean, mode?: 'create' | 'join') => void;
  openRoomModal: (mode?: 'create' | 'join') => void;
  closeRoomModal: () => void;
  setPrefilledRoomCode: (code: string | null) => void;
  leaveRoom: () => void;
}

export const useCollabStore = create<CollabState>((set) => ({
  wsConnected: false,
  activeRoomId: null,
  activeRoom: null,
  activeCustomMission: null,
  roomPin: null,
  roomError: null,
  isFrozenByTeacher: false,
  teacherName: null,
  roomMembers: {},
  peerCursors: {},
  lockedParameters: {},
  studentTelemetryMap: {},
  isRoomModalOpen: false,
  roomModalMode: 'join',
  prefilledRoomCode: null,

  setWsConnected: (wsConnected: boolean) => set({ wsConnected }),

  setActiveRoomId: (activeRoomId: string | null) => set({ activeRoomId }),

  setActiveRoom: (room: LabRoom | null) =>
    set((state) => ({
      activeRoom: room,
      activeRoomId: room ? room.roomId : null,
      activeCustomMission:
        room && room.customMission !== undefined
          ? room.customMission
          : room === null
          ? null
          : state.activeCustomMission,
      roomPin: room ? room.pin : null,
      roomError: null,
      isFrozenByTeacher: room ? room.isFrozenByTeacher : false,
      teacherName: room ? room.teacherName || null : null,
      roomMembers: room ? room.clients || {} : {},
    })),

  setActiveCustomMission: (activeCustomMission: CustomAIMissionPayload | null) =>
    set((state) => ({
      activeCustomMission,
      activeRoom: state.activeRoom
        ? { ...state.activeRoom, customMission: activeCustomMission }
        : state.activeRoom,
    })),

  setRoomPin: (roomPin: string | null) => set({ roomPin }),

  setRoomError: (roomError: string | null) => set({ roomError }),

  setIsFrozenByTeacher: (isFrozenByTeacher: boolean, teacherName?: string) =>
    set((state) => ({
      isFrozenByTeacher,
      teacherName: teacherName !== undefined ? teacherName : state.teacherName,
    })),

  setTeacherFreeze: (isFrozenByTeacher: boolean, teacherName?: string) =>
    set((state) => ({
      isFrozenByTeacher,
      teacherName: teacherName !== undefined ? teacherName : state.teacherName,
    })),

  setRoomMembers: (roomMembers: Record<string, LabRoomClient>) => set({ roomMembers }),

  updateStudentTelemetry: (studentName: string, telemetry: StudentLiveTelemetry) =>
    set((state) => ({
      studentTelemetryMap: {
        ...state.studentTelemetryMap,
        [studentName]: telemetry,
      },
    })),

  updatePeers: (peerCursors: Record<string, SpatialCursorPayload>) => set({ peerCursors }),

  setLock: (paramKey: string, lock: ParameterLockPayload) =>
    set((state) => ({
      lockedParameters: {
        ...state.lockedParameters,
        [paramKey]: lock,
      },
    })),

  releaseLock: (paramKey: string) =>
    set((state) => {
      const next = { ...state.lockedParameters };
      delete next[paramKey];
      return { lockedParameters: next };
    }),

  clearLocks: () => set({ lockedParameters: {} }),

  setRoomModal: (isRoomModalOpen: boolean, roomModalMode: 'create' | 'join' = 'join') =>
    set({ isRoomModalOpen, roomModalMode, roomError: null }),

  openRoomModal: (roomModalMode: 'create' | 'join' = 'join') =>
    set({ isRoomModalOpen: true, roomModalMode, roomError: null }),

  closeRoomModal: () => set({ isRoomModalOpen: false, roomError: null }),

  setPrefilledRoomCode: (prefilledRoomCode: string | null) =>
    set({
      prefilledRoomCode,
      activeRoomId: prefilledRoomCode || null,
      isRoomModalOpen: Boolean(prefilledRoomCode),
      roomModalMode: 'join',
    }),

  leaveRoom: () =>
    set({
      activeRoom: null,
      activeRoomId: null,
      roomPin: null,
      roomError: null,
      isFrozenByTeacher: false,
      teacherName: null,
      roomMembers: {},
      peerCursors: {},
      lockedParameters: {},
      studentTelemetryMap: {},
    }),
}));
