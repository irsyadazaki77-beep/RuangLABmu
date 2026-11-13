import { create } from 'zustand';
import { AcademicLevel } from '../utils/scienceEngine';
import { LAB_EVENTS, emitLabEvent } from '../utils/labEventBus';
import { useUIStore } from './useUIStore';
import { shouldShowConceptLabelsByDefault } from '../utils/pedagogicalHelpers';

export type LabDomain = 'physics' | 'chemistry' | 'biology' | 'astronomy';
export type IndonesianDomain = 'fisika' | 'kimia' | 'biologi' | 'astronomi';
export type AnyLabDomain = LabDomain | IndonesianDomain;
export type WorkflowStep = 1 | 2 | 3 | 4;
export type UserRole = 'siswa' | 'pengajar';

export const DOMAIN_TO_EN: Record<AnyLabDomain, LabDomain> = {
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  astronomy: 'astronomy',
  fisika: 'physics',
  kimia: 'chemistry',
  biologi: 'biology',
  astronomi: 'astronomy',
};

export const DOMAIN_TO_ID: Record<AnyLabDomain, IndonesianDomain> = {
  physics: 'fisika',
  chemistry: 'kimia',
  biology: 'biologi',
  astronomy: 'astronomi',
  fisika: 'fisika',
  kimia: 'kimia',
  biologi: 'biologi',
  astronomi: 'astronomi',
};

export interface ApparatusDockingConnection {
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  portType: 'fluid' | 'electric' | 'optical';
  snappedPosition: [number, number, number];
  timestamp: number;
}

export interface LabState {
  activeDomain: LabDomain;
  activeModuleId: string;
  isSimulating: boolean;
  playbackSpeed: number;
  soundEnabled: boolean;
  academicLevel: AcademicLevel;
  workflowStep: WorkflowStep;
  userRole: UserRole;
  isLobbyMode: boolean;
  isSubmissionLocked: boolean;
  dockedConnections: ApparatusDockingConnection[];

  // Time-Travel Scrubber State
  isTimeTraveling: boolean;
  timelineCount: number;
  timelineCursor: number;
  timelineMinTime: number;
  timelineMaxTime: number;
  timelineCurrentTime: number;

  // Dr. LabMu Hands-On Slider Highlight
  highlightedParamKey: string | null;

  // Actions
  setActiveDomain: (domain: AnyLabDomain) => void;
  setActiveModule: (moduleId: string) => void;
  setIsSimulating: (isSimulating: boolean | ((prev: boolean) => boolean)) => void;
  toggleSimulation: () => void;
  triggerResetTrial: () => void;
  triggerCaptureSnapshot: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAcademicLevel: (level: AcademicLevel) => void;
  setWorkflowStep: (step: WorkflowStep) => void;
  setUserRole: (role: UserRole) => void;
  setIsLobbyMode: (isLobby: boolean) => void;
  setSubmissionLocked: (locked: boolean) => void;
  recordApparatusDocking: (conn: ApparatusDockingConnection) => void;
  clearApparatusDockings: () => void;
  setTimelineStatus: (status: {
    timelineCount?: number;
    timelineCursor?: number;
    timelineMinTime?: number;
    timelineMaxTime?: number;
    timelineCurrentTime?: number;
    isTimeTraveling?: boolean;
  }) => void;
  setIsTimeTraveling: (isTimeTraveling: boolean) => void;
  seekTimelineCursor: (cursorIndex: number) => void;
  resetTimelineState: () => void;
  highlightParamSlider: (paramKey: string, durationMs?: number) => void;
  getIndonesianDomain: () => IndonesianDomain;
}

let highlightParamTimer: ReturnType<typeof setTimeout> | null = null;

const initialUrlParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const isAutoStart = initialUrlParams?.get('autostart') === '1' || initialUrlParams?.get('mode') === 'exam';
const urlDomainParam = initialUrlParams?.get('domain') as AnyLabDomain | null;
const urlModuleParam = initialUrlParams?.get('module');

export const useLabStore = create<LabState>((set, get) => ({
  activeDomain: (urlDomainParam && DOMAIN_TO_EN[urlDomainParam]) || 'physics',
  activeModuleId: urlModuleParam || 'newton-incline',
  isSimulating: true,
  playbackSpeed: 1.0,
  soundEnabled: true,
  academicLevel: 'sma',
  workflowStep: isAutoStart ? 2 : 1,
  userRole: 'siswa',
  isLobbyMode: !isAutoStart,
  isSubmissionLocked: false,
  dockedConnections: [],
  isTimeTraveling: false,
  timelineCount: 0,
  timelineCursor: 0,
  timelineMinTime: 0,
  timelineMaxTime: 0,
  timelineCurrentTime: 0,
  highlightedParamKey: null,

  setActiveDomain: (domain: AnyLabDomain) => {
    const canonical = DOMAIN_TO_EN[domain] || 'physics';
    set({
      activeDomain: canonical,
      isTimeTraveling: false,
      timelineCount: 0,
      timelineCursor: 0,
      timelineMinTime: 0,
      timelineMaxTime: 0,
      timelineCurrentTime: 0,
    });
  },

  setActiveModule: (moduleId: string) => {
    set({
      activeModuleId: moduleId,
      isTimeTraveling: false,
      timelineCount: 0,
      timelineCursor: 0,
      timelineMinTime: 0,
      timelineMaxTime: 0,
      timelineCurrentTime: 0,
    });
  },

  setIsSimulating: (isSimulating) => {
    if (typeof isSimulating === 'function') {
      set((state) => ({ isSimulating: isSimulating(state.isSimulating) }));
    } else {
      set({ isSimulating });
    }
  },

  toggleSimulation: () => {
    const state = get();
    const next = !state.isSimulating;
    if (next && state.isTimeTraveling) {
      set({ isSimulating: true, isTimeTraveling: false });
      emitLabEvent(LAB_EVENTS.RESUME_FROM_TIMELINE, {
        cursorIndex: state.timelineCursor,
        simTime: state.timelineCurrentTime,
      });
      emitLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, { isSimulating: true });
      return;
    }
    set({ isSimulating: next });
    emitLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, { isSimulating: next });
  },

  triggerResetTrial: () => {
    set({
      isSimulating: false,
      isTimeTraveling: false,
      timelineCount: 0,
      timelineCursor: 0,
      timelineMinTime: 0,
      timelineMaxTime: 0,
      timelineCurrentTime: 0,
    });
    emitLabEvent(LAB_EVENTS.RESET_TRIAL, { timestamp: Date.now() });
  },

  triggerCaptureSnapshot: () => {
    emitLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, { timestamp: Date.now() });
  },

  setPlaybackSpeed: (playbackSpeed: number) => {
    set({ playbackSpeed });
    emitLabEvent(LAB_EVENTS.CHANGE_SPEED, { speed: playbackSpeed });
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  setSoundEnabled: (soundEnabled: boolean) => {
    set({ soundEnabled });
  },

  setAcademicLevel: (academicLevel: AcademicLevel) => {
    set({ academicLevel });
    useUIStore.getState().setShowConceptLabels(shouldShowConceptLabelsByDefault(academicLevel));
  },

  setWorkflowStep: (workflowStep: WorkflowStep) => {
    set({ workflowStep });
  },

  setUserRole: (userRole: UserRole) => {
    set({ userRole });
  },

  setIsLobbyMode: (isLobbyMode: boolean) => {
    set({ isLobbyMode });
  },

  setSubmissionLocked: (isSubmissionLocked: boolean) => {
    set({ isSubmissionLocked });
  },

  recordApparatusDocking: (conn: ApparatusDockingConnection) => {
    set((state) => {
      const filtered = state.dockedConnections.filter(
        (c) =>
          !(c.sourceNodeId === conn.sourceNodeId && c.sourcePortId === conn.sourcePortId)
      );
      return {
        dockedConnections: [conn, ...filtered],
      };
    });
    emitLabEvent(LAB_EVENTS.APPARATUS_DOCKED, conn);
  },

  clearApparatusDockings: () => {
    set({ dockedConnections: [] });
  },

  setTimelineStatus: (status) => {
    set((state) => ({ ...state, ...status }));
  },

  setIsTimeTraveling: (isTimeTraveling: boolean) => {
    set({ isTimeTraveling });
  },

  seekTimelineCursor: (cursorIndex: number) => {
    const count = get().timelineCount;
    const clamped = Math.max(0, Math.min(Math.max(0, count - 1), Math.floor(cursorIndex)));
    set({
      isSimulating: false,
      isTimeTraveling: true,
      timelineCursor: clamped,
    });
    emitLabEvent(LAB_EVENTS.SEEK_TIMELINE, { cursorIndex: clamped });
  },

  resetTimelineState: () => {
    set({
      isTimeTraveling: false,
      timelineCount: 0,
      timelineCursor: 0,
      timelineMinTime: 0,
      timelineMaxTime: 0,
      timelineCurrentTime: 0,
    });
  },

  highlightParamSlider: (paramKey: string, durationMs = 3000) => {
    if (highlightParamTimer) {
      clearTimeout(highlightParamTimer);
      highlightParamTimer = null;
    }
    set({ highlightedParamKey: paramKey });
    const clampedMs = Math.max(500, Math.min(8000, durationMs));
    highlightParamTimer = setTimeout(() => {
      if (get().highlightedParamKey === paramKey) {
        set({ highlightedParamKey: null });
      }
      highlightParamTimer = null;
    }, clampedMs);
  },

  getIndonesianDomain: () => {
    return DOMAIN_TO_ID[get().activeDomain];
  },
}));

