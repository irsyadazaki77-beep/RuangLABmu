import { useEffect, useRef } from 'react';
import {
  AnyLabDomain,
  DOMAIN_TO_EN,
  LabDomain,
  useLabStore,
  WorkflowStep,
} from '../stores/useLabStore';
import { ActiveModal, useUIStore } from '../stores/useUIStore';
import { useCollabStore } from '../stores/useCollabStore';
import { getExperimentById } from '../registry/experimentRegistry';

export interface ParsedDeepLinkState {
  isLobbyMode: boolean;
  domain?: LabDomain;
  moduleId?: string;
  workflowStep?: WorkflowStep;
  roomCode?: string;
  viewModal?: 'portfolio' | 'gradebook' | null;
}

export function resolveStepFromParam(stepRaw: string | null | undefined): WorkflowStep {
  if (!stepRaw) return 2;
  const cleaned = stepRaw.toLowerCase().trim();
  if (cleaned === '1' || cleaned === 'briefing' || cleaned === 'k3' || cleaned === 'prelab') {
    return 1;
  }
  if (cleaned === '2' || cleaned === 'simulation' || cleaned === 'simulasi' || cleaned === '3d') {
    return 2;
  }
  if (cleaned === '3' || cleaned === 'analysis' || cleaned === 'worksheet' || cleaned === 'lks' || cleaned === 'grafik') {
    return 3;
  }
  if (cleaned === '4' || cleaned === 'report' || cleaned === 'laporan') {
    return 4;
  }
  return 2;
}

export function formatStepToParam(step: WorkflowStep): string {
  switch (step) {
    case 1:
      return 'briefing';
    case 2:
      return 'simulation';
    case 3:
      return 'analysis';
    case 4:
      return 'report';
    default:
      return 'simulation';
  }
}

/**
 * Pure parser for RuangLABmu v2.0 URL deep-links:
 * - `/` -> { isLobbyMode: true }
 * - `/?domain=physics&module=newton-incline&step=simulation` -> opens module at step 2
 * - `/?room=PIN123` -> prefills collaboration room code
 * - `/?view=portfolio` | `/?view=gradebook` -> opens Student Portfolio or Teacher Gradebook
 */
export function parseLabDeepLink(search: string): ParsedDeepLinkState {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const domainRaw = params.get('domain') as AnyLabDomain | null;
  const moduleRaw = params.get('module');
  const stepRaw = params.get('step');
  const roomRaw = params.get('room');
  const viewRaw = params.get('view')?.toLowerCase().trim();
  const modeRaw = params.get('mode');
  const autostartRaw = params.get('autostart');

  let domain: LabDomain | undefined = domainRaw ? DOMAIN_TO_EN[domainRaw] : undefined;
  let moduleId: string | undefined = moduleRaw ? moduleRaw.trim() : undefined;

  if (moduleId && !domain) {
    const exp = getExperimentById(moduleId);
    if (exp) {
      domain = DOMAIN_TO_EN[exp.domain.toLowerCase() as AnyLabDomain] || 'physics';
    }
  }

  const hasModuleIntent = Boolean(domain || moduleId || stepRaw || modeRaw === 'exam' || autostartRaw === '1');
  const workflowStep: WorkflowStep | undefined = hasModuleIntent
    ? resolveStepFromParam(stepRaw || (modeRaw === 'exam' || autostartRaw === '1' ? 'simulation' : 'briefing'))
    : undefined;

  const viewModal: 'portfolio' | 'gradebook' | null =
    viewRaw === 'portfolio'
      ? 'portfolio'
      : viewRaw === 'gradebook'
      ? 'gradebook'
      : null;

  const roomCode = roomRaw ? roomRaw.trim().toUpperCase() : undefined;

  return {
    isLobbyMode: !hasModuleIntent,
    domain,
    moduleId,
    workflowStep,
    roomCode,
    viewModal,
  };
}

export interface DeepLinkBuildInput {
  isLobbyMode: boolean;
  domain: LabDomain;
  moduleId: string;
  workflowStep: WorkflowStep;
  activeModal?: ActiveModal;
  roomCode?: string | null;
  existingSearch?: string;
}

/**
 * Pure serializer for RuangLABmu v2.0 URL query parameters.
 */
export function buildLabDeepLinkSearch(input: DeepLinkBuildInput): string {
  const existing = new URLSearchParams(input.existingSearch || '');
  const next = new URLSearchParams();

  // Preserve exam parameters if active
  const examMode = existing.get('mode');
  const examDuration = existing.get('duration');
  if (examMode) next.set('mode', examMode);
  if (examDuration) next.set('duration', examDuration);

  if (!input.isLobbyMode) {
    next.set('domain', input.domain);
    next.set('module', input.moduleId);
    next.set('step', formatStepToParam(input.workflowStep));
  }

  if (input.roomCode) {
    next.set('room', input.roomCode);
  }

  if (input.activeModal === 'portfolio' || input.activeModal === 'gradebook') {
    next.set('view', input.activeModal);
  }

  const qs = next.toString();
  return qs ? `/?${qs}` : '/';
}

/**
 * Builds a shareable deep-link URL for the active module & step.
 */
export function buildShareableModuleUrl(
  origin: string,
  domain: LabDomain,
  moduleId: string,
  workflowStep: WorkflowStep,
  roomCode?: string | null
): string {
  const pathAndQuery = buildLabDeepLinkSearch({
    isLobbyMode: false,
    domain,
    moduleId,
    workflowStep: workflowStep || 2,
    roomCode,
  });
  return `${origin.replace(/\/$/, '')}${pathAndQuery}`;
}

/**
 * Custom hook that bidirectionally syncs `useLabStore`, `useUIStore`, and `useCollabStore`
 * with the browser URL (`window.history.pushState` and `popstate` events).
 */
export function useUrlRouterSync(): void {
  const {
    activeDomain,
    activeModuleId,
    workflowStep,
    isLobbyMode,
    setActiveDomain,
    setActiveModule,
    setWorkflowStep,
    setIsLobbyMode,
    setUserRole,
  } = useLabStore();

  const { activeModal, openModal, closeModal } = useUIStore();
  const { activeRoomId, setPrefilledRoomCode } = useCollabStore();

  const isApplyingFromUrlRef = useRef(false);
  const lastPushedUrlRef = useRef<string>('');

  // 1. Apply URL state on mount and on browser Back/Forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyUrlToStores = (searchStr: string) => {
      isApplyingFromUrlRef.current = true;
      const parsed = parseLabDeepLink(searchStr);

      if (parsed.domain) {
        setActiveDomain(parsed.domain);
      }
      if (parsed.moduleId) {
        setActiveModule(parsed.moduleId);
      }
      if (parsed.workflowStep) {
        setWorkflowStep(parsed.workflowStep);
      }
      setIsLobbyMode(parsed.isLobbyMode);

      if (parsed.roomCode) {
        setPrefilledRoomCode(parsed.roomCode);
      }

      if (parsed.viewModal === 'portfolio') {
        openModal('portfolio');
      } else if (parsed.viewModal === 'gradebook') {
        setUserRole('pengajar');
        openModal('gradebook');
      } else {
        const curModal = useUIStore.getState().activeModal;
        if (curModal === 'portfolio' || curModal === 'gradebook') {
          closeModal();
        }
      }

      lastPushedUrlRef.current = `${window.location.pathname}${window.location.search}`;
      setTimeout(() => {
        isApplyingFromUrlRef.current = false;
      }, 0);
    };

    // Hydrate initial URL if query parameters exist
    if (window.location.search) {
      applyUrlToStores(window.location.search);
    } else {
      lastPushedUrlRef.current = `${window.location.pathname}${window.location.search}`;
    }

    const handlePopState = () => {
      applyUrlToStores(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    setActiveDomain,
    setActiveModule,
    setWorkflowStep,
    setIsLobbyMode,
    setPrefilledRoomCode,
    openModal,
    closeModal,
    setUserRole,
  ]);

  // 2. Push store state changes to browser URL history
  useEffect(() => {
    if (typeof window === 'undefined' || isApplyingFromUrlRef.current) return;

    const nextRelativeUrl = buildLabDeepLinkSearch({
      isLobbyMode,
      domain: activeDomain,
      moduleId: activeModuleId,
      workflowStep,
      activeModal,
      roomCode: activeRoomId,
      existingSearch: window.location.search,
    });

    const currentRelativeUrl = `${window.location.pathname}${window.location.search}`;
    if (nextRelativeUrl !== currentRelativeUrl && nextRelativeUrl !== lastPushedUrlRef.current) {
      lastPushedUrlRef.current = nextRelativeUrl;
      window.history.pushState({ domain: activeDomain, moduleId: activeModuleId, step: workflowStep }, '', nextRelativeUrl);
    }
  }, [isLobbyMode, activeDomain, activeModuleId, workflowStep, activeModal, activeRoomId]);
}
