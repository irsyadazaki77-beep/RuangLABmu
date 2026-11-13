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
export type MobileTab = 'canvas' | 'variables' | 'worksheet' | 'ai';

const DEFAULT_COMFORT_PREFS: VisualComfortPreferences = {
  theme: 'light',
  fontScale: 'normal',
  lineSpacing: 'standard',
  colorBlindSafe: false,
  eyeRestTimerEnabled: true,
};

function loadStoredComfortPrefs(): VisualComfortPreferences {
  try {
    const savedPrefs = window.localStorage.getItem('simulab-comfort-prefs');
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      if (parsed && parsed.theme) return parsed;
    }
    const legacyTheme = window.localStorage.getItem('simulab-theme');
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
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
  liteModeNotification: string | null;
  showConceptLabels: boolean;

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
  setLiteModeNotification: (msg: string | null) => void;
  setProjectorMode: (enabled: boolean) => void;
  toggleProjectorMode: () => void;
  setShowConceptLabels: (show: boolean) => void;
  toggleConceptLabels: () => void;
}

function loadInitialLiteMode(): boolean {
  try {
    const saved = window.localStorage.getItem('simulab-lite-device-mode');
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // Ignore storage parse error
  }
  return false;
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
  liteModeNotification: null,
  showConceptLabels: true,

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
      try {
        window.localStorage.setItem('simulab-comfort-prefs', JSON.stringify(nextPrefs));
        window.localStorage.setItem('simulab-theme', nextPrefs.theme === 'dark' ? 'dark' : 'light');
      } catch {
        // Ignore storage error
      }
      return { comfortPrefs: nextPrefs };
    });
  },

  setMobileTab: (mobileTab: MobileTab) => set({ mobileTab }),

  setOnboardingTourOpen: (onboardingTourOpen: boolean) => set({ onboardingTourOpen }),

  setSidebarWidthPx: (sidebarWidthPx: number) => set({ sidebarWidthPx }),

  setLiteDeviceMode: (liteDeviceMode: boolean) => {
    try {
      window.localStorage.setItem('simulab-lite-device-mode', String(liteDeviceMode));
    } catch {
      // Ignore storage error
    }
    set({ liteDeviceMode });
  },

  toggleLiteDeviceMode: () => {
    set((state) => {
      const next = !state.liteDeviceMode;
      try {
        window.localStorage.setItem('simulab-lite-device-mode', String(next));
      } catch {
        // Ignore storage error
      }
      return { liteDeviceMode: next };
    });
  },

  setLiteModeNotification: (liteModeNotification: string | null) => set({ liteModeNotification }),
  setShowConceptLabels: (showConceptLabels: boolean) => set({ showConceptLabels }),
  toggleConceptLabels: () => set((state) => ({ showConceptLabels: !state.showConceptLabels })),

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
}));


