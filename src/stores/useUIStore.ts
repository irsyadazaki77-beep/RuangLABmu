import { create } from 'zustand';
import { VisualComfortPreferences } from '../components/ui/VisualComfortToolbar';

export type DrawerTab = 'variables' | 'worksheet' | 'analytics' | 'ai';
export type ActiveModal = null | 'safety' | 'quiz' | 'report' | 'mystery' | 'portfolio' | 'gradebook';
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
}));

