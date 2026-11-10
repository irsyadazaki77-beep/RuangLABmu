import { create } from 'zustand';
import { AcademicLevel } from '../utils/scienceEngine';

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
  setPlaybackSpeed: (speed: number) => void;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAcademicLevel: (level: AcademicLevel) => void;
  setWorkflowStep: (step: WorkflowStep) => void;
  setUserRole: (role: UserRole) => void;
  setIsLobbyMode: (isLobby: boolean) => void;
  getIndonesianDomain: () => IndonesianDomain;
}

export const useLabStore = create<LabState>((set, get) => ({
  activeDomain: 'physics',
  activeModuleId: 'newton-incline',
  isSimulating: false,
  playbackSpeed: 1.0,
  soundEnabled: true,
  academicLevel: 'sma',
  workflowStep: 1,
  userRole: 'siswa',
  isLobbyMode: true,

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

  setPlaybackSpeed: (playbackSpeed: number) => {
    set({ playbackSpeed });
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
