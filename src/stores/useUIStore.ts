import { create } from 'zustand';
import { VisualComfortPreferences } from '../components/ui/VisualComfortToolbar';

export type DrawerTab = 'variables' | 'worksheet' | 'analytics' | 'ai';
export type ActiveModal =
  | null
  | 'safety'
  | 'quiz'
  | 'report'
  | 'mystery'
  | 'portfolio'
  | 'gradebook'
  | 'ai-mission-builder';
export type MobileTab = 'canvas' | 'variables' | 'telemetry' | 'worksheet' | 'ai';
export type LobbyViewMode = 'chapters' | 'all';
export type LobbyDomainFilter = 'all' | 'fisika' | 'kimia' | 'biologi' | 'astronomi';
export type TeacherViewMode = 'dashboard' | 'lab3d';
export type LiveQualityTier = 'high' | 'balanced' | '3t-saver';
export type QualityModePreference = 'auto' | '3t-saver' | 'high';

export interface LivePerfStats {
  fps: number;
  qualityTier: LiveQualityTier;
}

export const EYE_REST_INTERVAL_SEC = 20 * 60;
export const EYE_REST_BREAK_SEC = 20;

const DEFAULT_COMFORT_PREFS: VisualComfortPreferences = {
  theme: 'light',
  fontScale: 'normal',
  lineSpacing: 'standard',
  dyslexiaMode: false,
  colorBlindSafe: false,
  blueLightFilter: 'off',
  eyeRestTimerEnabled: true,
};

function loadStoredComfortPrefs(): VisualComfortPreferences {
  try {
    const savedPrefs = window.localStorage.getItem('simulab-comfort-prefs');
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      if (parsed && parsed.theme) {
        return {
          ...DEFAULT_COMFORT_PREFS,
          ...parsed,
          dyslexiaMode: Boolean(parsed.dyslexiaMode),
          blueLightFilter:
            parsed.blueLightFilter === 'dusk' || parsed.blueLightFilter === 'night'
              ? parsed.blueLightFilter
              : 'off',
        };
      }
    }
    const legacyTheme = window.localStorage.getItem('simulab-theme');
    if (legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'sepia') {
      return {
        ...DEFAULT_COMFORT_PREFS,
        theme: legacyTheme,
      };
    }
  } catch {
    // Ignore storage parse errors
  }
  return DEFAULT_COMFORT_PREFS;
}

export interface UIState {
  zenMode: boolean;
  drawerOpen: boolean;
  activeDrawerTab: DrawerTab;
  activeModal: ActiveModal;
  comfortPrefs: VisualComfortPreferences;
  mobileTab: MobileTab;
  onboardingTourOpen: boolean;
  sidebarWidthPx: number;
  projectorMode: boolean;
  liteDeviceMode: boolean;
  qualityMode: QualityModePreference;
  prefer2DFallback: boolean;
  liteModeNotification: string | null;
  showConceptLabels: boolean;
  lobbySearchQuery: string;
  lobbyViewMode: LobbyViewMode;
  lobbySelectedDomain: LobbyDomainFilter;
  teacherViewMode: TeacherViewMode;
  livePerfStats: LivePerfStats;
  leftDrawerOpen: boolean;
  rightTelemetryOpen: boolean;
  eyeRestSecondsLeft: number;
  eyeRestPromptOpen: boolean;
  eyeRestBreakSecondsLeft: number | null;
  eyeRestPaused: boolean;

  // Actions
  toggleZenMode: () => void;
  setZenMode: (zenMode: boolean) => void;
  toggleDrawer: () => void;
  setDrawerOpen: (drawerOpen: boolean) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  setComfortPrefs: (
    prefs: Partial<VisualComfortPreferences> | ((prev: VisualComfortPreferences) => VisualComfortPreferences)
  ) => void;
  setMobileTab: (tab: MobileTab) => void;
  setOnboardingTourOpen: (open: boolean) => void;
  setSidebarWidthPx: (widthPx: number) => void;
  setLiteDeviceMode: (enabled: boolean) => void;
  toggleLiteDeviceMode: () => void;
  setQualityMode: (mode: QualityModePreference) => void;
  setPrefer2DFallback: (enabled: boolean) => void;
  setLiteModeNotification: (msg: string | null) => void;
  setProjectorMode: (enabled: boolean) => void;
  toggleProjectorMode: () => void;
  setShowConceptLabels: (show: boolean) => void;
  toggleConceptLabels: () => void;
  setLobbySearchQuery: (query: string) => void;
  setLobbyViewMode: (mode: LobbyViewMode) => void;
  setLobbySelectedDomain: (domain: LobbyDomainFilter) => void;
  setTeacherViewMode: (mode: TeacherViewMode) => void;
  setLivePerfStats: (stats: LivePerfStats) => void;
  setLeftDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setRightTelemetryOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  tickEyeRestTimer: () => { event: 'prompt' | 'break-complete' | null };
  startEyeRestBreak: () => void;
  snoozeEyeRestBreak: (minutes?: number) => void;
  dismissEyeRestBreak: () => void;
  resetEyeRestCycle: () => void;
  toggleEyeRestPaused: () => void;
  triggerEyeRestNow: () => void;
}

function loadInitialLiteMode(): boolean {
  try {
    const savedMode = window.localStorage.getItem('simulab-quality-mode');
    if (savedMode === '3t-saver') return true;
    if (savedMode === 'high') return false;
    const saved = window.localStorage.getItem('simulab-lite-device-mode');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage parse error
  }
  return false;
}

function loadInitialQualityMode(): QualityModePreference {
  try {
    const saved = window.localStorage.getItem('simulab-quality-mode');
    if (saved === 'auto' || saved === '3t-saver' || saved === 'high') {
      return saved;
    }
    const savedLite = window.localStorage.getItem('simulab-lite-device-mode');
    if (savedLite === 'true') return '3t-saver';
  } catch {
    // Ignore storage parse error
  }
  return 'auto';
}

function loadInitialProjectorMode(): boolean {
  try {
    const saved = window.localStorage.getItem('simulab-projector-mode');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage parse error
  }
  return false;
}

export const useUIStore = create<UIState>((set) => ({
  zenMode: false,
  drawerOpen: false,
  activeDrawerTab: 'variables',
  activeModal: null,
  comfortPrefs: loadStoredComfortPrefs(),
  mobileTab: 'canvas',
  onboardingTourOpen: false,
  sidebarWidthPx: 360,
  projectorMode: loadInitialProjectorMode(),
  liteDeviceMode: loadInitialLiteMode(),
  qualityMode: loadInitialQualityMode(),
  prefer2DFallback: false,
  liteModeNotification: null,
  showConceptLabels: true,
  lobbySearchQuery: '',
  lobbyViewMode: 'chapters',
  lobbySelectedDomain: 'all',
  teacherViewMode: 'dashboard',
  livePerfStats: { fps: 60, qualityTier: 'high' },
  leftDrawerOpen: true,
  rightTelemetryOpen: true,
  eyeRestSecondsLeft: EYE_REST_INTERVAL_SEC,
  eyeRestPromptOpen: false,
  eyeRestBreakSecondsLeft: null,
  eyeRestPaused: false,

  toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

  setZenMode: (zenMode: boolean) => set({ zenMode }),

  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  setDrawerOpen: (drawerOpen: boolean) => set({ drawerOpen }),

  setDrawerTab: (activeDrawerTab: DrawerTab) => set({ activeDrawerTab, drawerOpen: true }),

  openModal: (activeModal: ActiveModal) => set({ activeModal }),

  closeModal: () => set({ activeModal: null }),

  setComfortPrefs: (prefs) => {
    set((state) => {
      const nextPrefs =
        typeof prefs === 'function' ? prefs(state.comfortPrefs) : { ...state.comfortPrefs, ...prefs };
      const timerEnabled =
        nextPrefs.eyeRestTimerEnabled ?? nextPrefs.eyeRestReminderEnabled ?? true;
      try {
        window.localStorage.setItem('simulab-comfort-prefs', JSON.stringify(nextPrefs));
        window.localStorage.setItem('simulab-theme', nextPrefs.theme === 'dark' ? 'dark' : 'light');
      } catch {
        // Ignore storage error
      }
      return {
        comfortPrefs: nextPrefs,
        ...(timerEnabled
          ? {}
          : {
              eyeRestPromptOpen: false,
              eyeRestBreakSecondsLeft: null,
            }),
      };
    });
  },

  setMobileTab: (mobileTab: MobileTab) => set({ mobileTab }),

  setOnboardingTourOpen: (onboardingTourOpen: boolean) => set({ onboardingTourOpen }),

  setSidebarWidthPx: (sidebarWidthPx: number) => set({ sidebarWidthPx }),

  setLiteDeviceMode: (liteDeviceMode: boolean) => {
    const nextQualityMode: QualityModePreference = liteDeviceMode ? '3t-saver' : 'auto';
    try {
      window.localStorage.setItem('simulab-lite-device-mode', String(liteDeviceMode));
      window.localStorage.setItem('simulab-quality-mode', nextQualityMode);
    } catch {
      // Ignore storage error
    }
    set((state) => ({
      liteDeviceMode,
      qualityMode: nextQualityMode,
      livePerfStats: {
        ...state.livePerfStats,
        qualityTier: liteDeviceMode ? '3t-saver' : 'high',
      },
    }));
  },

  toggleLiteDeviceMode: () => {
    set((state) => {
      const next = !state.liteDeviceMode;
      const nextQualityMode: QualityModePreference = next ? '3t-saver' : 'auto';
      try {
        window.localStorage.setItem('simulab-lite-device-mode', String(next));
        window.localStorage.setItem('simulab-quality-mode', nextQualityMode);
      } catch {
        // Ignore storage error
      }
      return {
        liteDeviceMode: next,
        qualityMode: nextQualityMode,
        livePerfStats: {
          ...state.livePerfStats,
          qualityTier: next ? '3t-saver' : 'high',
        },
      };
    });
  },

  setQualityMode: (qualityMode: QualityModePreference) => {
    const nextLite = qualityMode === '3t-saver';
    try {
      window.localStorage.setItem('simulab-quality-mode', qualityMode);
      window.localStorage.setItem('simulab-lite-device-mode', String(nextLite));
    } catch {
      // Ignore storage error
    }
    set((state) => ({
      qualityMode,
      liteDeviceMode: nextLite,
      livePerfStats: {
        ...state.livePerfStats,
        qualityTier: qualityMode === '3t-saver' ? '3t-saver' : qualityMode === 'high' ? 'high' : state.livePerfStats.qualityTier,
      },
    }));
  },

  setPrefer2DFallback: (prefer2DFallback: boolean) => set({ prefer2DFallback }),

  setLiteModeNotification: (liteModeNotification: string | null) => set({ liteModeNotification }),
  setShowConceptLabels: (showConceptLabels: boolean) => set({ showConceptLabels }),
  toggleConceptLabels: () => set((state) => ({ showConceptLabels: !state.showConceptLabels })),
  setLobbySearchQuery: (lobbySearchQuery: string) => set({ lobbySearchQuery }),
  setLobbyViewMode: (lobbyViewMode: LobbyViewMode) => set({ lobbyViewMode }),
  setLobbySelectedDomain: (lobbySelectedDomain: LobbyDomainFilter) => set({ lobbySelectedDomain }),
  setTeacherViewMode: (teacherViewMode: TeacherViewMode) => set({ teacherViewMode }),
  setLivePerfStats: (livePerfStats: LivePerfStats) => set({ livePerfStats }),
  setLeftDrawerOpen: (open) =>
    set((state) => ({
      leftDrawerOpen: typeof open === 'function' ? open(state.leftDrawerOpen) : open,
    })),
  setRightTelemetryOpen: (open) =>
    set((state) => ({
      rightTelemetryOpen: typeof open === 'function' ? open(state.rightTelemetryOpen) : open,
    })),

  setProjectorMode: (projectorMode: boolean) => {
    try {
      window.localStorage.setItem('simulab-projector-mode', String(projectorMode));
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-projector-mode', String(projectorMode));
        if (projectorMode) {
          document.body.classList.add('projector-mode');
        } else {
          document.body.classList.remove('projector-mode');
        }
      }
    } catch {
      // Ignore storage error
    }
    set({ projectorMode });
  },

  toggleProjectorMode: () => {
    set((state) => {
      const next = !state.projectorMode;
      try {
        window.localStorage.setItem('simulab-projector-mode', String(next));
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-projector-mode', String(next));
          if (next) {
            document.body.classList.add('projector-mode');
          } else {
            document.body.classList.remove('projector-mode');
          }
        }
      } catch {
        // Ignore storage error
      }
      return { projectorMode: next };
    });
  },

  tickEyeRestTimer: () => {
    let event: 'prompt' | 'break-complete' | null = null;
    set((state) => {
      const enabled =
        state.comfortPrefs.eyeRestTimerEnabled ??
        state.comfortPrefs.eyeRestReminderEnabled ??
        true;
      if (!enabled || state.eyeRestPaused) {
        return state;
      }
      if (state.eyeRestBreakSecondsLeft !== null) {
        if (state.eyeRestBreakSecondsLeft <= 1) {
          event = 'break-complete';
          return {
            eyeRestBreakSecondsLeft: null,
            eyeRestPromptOpen: false,
            eyeRestSecondsLeft: EYE_REST_INTERVAL_SEC,
          };
        }
        return {
          eyeRestBreakSecondsLeft: state.eyeRestBreakSecondsLeft - 1,
        };
      }
      if (state.eyeRestPromptOpen) {
        return state;
      }
      if (state.eyeRestSecondsLeft <= 1) {
        event = 'prompt';
        return {
          eyeRestSecondsLeft: 0,
          eyeRestPromptOpen: true,
        };
      }
      return {
        eyeRestSecondsLeft: state.eyeRestSecondsLeft - 1,
      };
    });
    return { event };
  },

  startEyeRestBreak: () =>
    set({
      eyeRestPromptOpen: true,
      eyeRestBreakSecondsLeft: EYE_REST_BREAK_SEC,
      eyeRestPaused: false,
    }),

  snoozeEyeRestBreak: (minutes = 5) =>
    set({
      eyeRestPromptOpen: false,
      eyeRestBreakSecondsLeft: null,
      eyeRestSecondsLeft: Math.max(60, Math.round(minutes * 60)),
      eyeRestPaused: false,
    }),

  dismissEyeRestBreak: () =>
    set({
      eyeRestPromptOpen: false,
      eyeRestBreakSecondsLeft: null,
      eyeRestSecondsLeft: EYE_REST_INTERVAL_SEC,
    }),

  resetEyeRestCycle: () =>
    set({
      eyeRestPromptOpen: false,
      eyeRestBreakSecondsLeft: null,
      eyeRestSecondsLeft: EYE_REST_INTERVAL_SEC,
      eyeRestPaused: false,
    }),

  toggleEyeRestPaused: () =>
    set((state) => ({
      eyeRestPaused: !state.eyeRestPaused,
    })),

  triggerEyeRestNow: () =>
    set({
      eyeRestPromptOpen: true,
      eyeRestBreakSecondsLeft: EYE_REST_BREAK_SEC,
      eyeRestPaused: false,
    }),
}));


