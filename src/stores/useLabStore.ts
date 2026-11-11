import { create } from 'zustand';
import { AcademicLevel } from '../utils/scienceEngine';
import { LAB_EVENTS, emitLabEvent } from '../utils/labEventBus';

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
  getIndonesianDomain: () => IndonesianDomain;
}

const initialUrlParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const isAutoStart = initialUrlParams?.get('autostart') === '1';
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

  setActiveDomain: (domain: AnyLabDomain) => {
    const canonical = DOMAIN_TO_EN[domain] || 'physics';
    set({ activeDomain: canonical });
  },

  setActiveModule: (moduleId: string) => {
    set({ activeModuleId: moduleId });
  },

  setIsSimulating: (isSimulating) => {
    if (typeof isSimulating === 'function') {
      set((state) => ({ isSimulating: isSimulating(state.isSimulating) }));
    } else {
      set({ isSimulating });
    }
  },

  toggleSimulation: () => {
    const next = !get().isSimulating;
    set({ isSimulating: next });
    emitLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, { isSimulating: next });
  },

  triggerResetTrial: () => {
    set({ isSimulating: false });
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

  getIndonesianDomain: () => {
    return DOMAIN_TO_ID[get().activeDomain];
  },
}));
