import { useState, useMemo, useEffect, useCallback } from 'react';
import { ScienceDomain } from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import { HypothesisNote } from '../components/ui/HypothesisAndCompareDock';
import {
  ExperimentModule,
  getExperimentById,
  EXPERIMENT_CATALOG,
} from '../registry/experimentRegistry';
import { VisualComfortPreferences } from '../components/ui/VisualComfortToolbar';
import {
  INITIAL_PHYSICS_PARAMS,
  INITIAL_CHEMISTRY_PARAMS,
  INITIAL_BIOLOGY_CONTEXT,
  INITIAL_ASTRONOMY_PARAMS,
} from '../stores/initialLabParams';
import { LAB_EVENTS } from '../utils/labEventBus';
import type { LabDomain, WorkflowStep } from '../stores/useLabStore';

export interface UseLabParamsSyncOptions {
  activeDomain: LabDomain;
  activeModuleId: string;
  soundEnabled: boolean;
  comfortPrefs: VisualComfortPreferences;
  setActiveDomain: (domain: LabDomain) => void;
  setActiveModule: (moduleId: string) => void;
  setIsLobbyMode: (lobby: boolean) => void;
  setWorkflowStep: (step: WorkflowStep) => void;
}

export function useLabParamsSync({
  activeDomain,
  activeModuleId,
  soundEnabled,
  comfortPrefs,
  setActiveDomain,
  setActiveModule,
  setIsLobbyMode,
  setWorkflowStep,
}: UseLabParamsSyncOptions) {
  const [selectedBioModuleId, setSelectedBioModuleId] = useState<string>('photosynthesis-ingenhousz');
  const [externalDrLabMuPrompt, setExternalDrLabMuPrompt] = useState<{ id: number; prompt: string } | null>(null);

  const [physicsParams, setPhysicsParams] = useState(INITIAL_PHYSICS_PARAMS);
  const [chemistryParams, setChemistryParams] = useState(INITIAL_CHEMISTRY_PARAMS);
  const [biologyContext, setBiologyContext] = useState(INITIAL_BIOLOGY_CONTEXT);
  const [astronomyParams, setAstronomyParams] = useState(INITIAL_ASTRONOMY_PARAMS);

  const [hypothesisNotesByModule, setHypothesisNotesByModule] = useState<Record<string, HypothesisNote>>(() => {
    try {
      const saved = window.localStorage.getItem('simulab-hypothesis-notes');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore invalid storage
    }
    return {
      'newton-incline': {
        independentVar: 'Gaya Dorong (F) dan Sudut Kemiringan (θ)',
        dependentVar: 'Percepatan Balok (a)',
        hypothesisText:
          'Semakin besar gaya dorong F pada massa tetap, maka percepatan balok a akan meningkat secara linier sesuai Hukum II Newton (a = ΣF/m).',
        reflectionText:
          'Data eksperimen menunjukkan hubungan linier kuat (R² > 0.98) antara ΣF dan percepatan.',
        updatedAt: '08:45',
      },
    };
  });

  // Sync Comfort Preferences with DOM root attributes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', comfortPrefs.theme);
    root.setAttribute('data-font-scale', comfortPrefs.fontScale);
    root.setAttribute('data-line-spacing', comfortPrefs.lineSpacing);
    root.setAttribute('data-colorblind', comfortPrefs.colorBlindSafe ? 'true' : 'false');
    if (comfortPrefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [comfortPrefs]);

  useEffect(() => {
    labSound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const currentExperimentModule = useMemo(() => {
    const domainDefaultMap: Record<string, string> = {
      physics: 'newton-incline',
      chemistry: 'thermo-calorimetry',
      biology: selectedBioModuleId,
      astronomy: 'solar-kepler',
    };
    const modId = activeModuleId || domainDefaultMap[activeDomain] || 'newton-incline';
    return getExperimentById(modId) ?? EXPERIMENT_CATALOG[0];
  }, [activeDomain, activeModuleId, selectedBioModuleId]);

  const activeScienceDomain: ScienceDomain =
    activeDomain === 'chemistry'
      ? 'Kimia'
      : activeDomain === 'biology'
      ? 'Biologi'
      : activeDomain === 'astronomy'
      ? 'Astronomi'
      : 'Fisika';

  const currentModuleHypothesis = hypothesisNotesByModule[currentExperimentModule.id] ?? {
    independentVar: 'Variabel Bebas',
    dependentVar: 'Variabel Terikat',
    hypothesisText: '',
    reflectionText: '',
    updatedAt: '',
  };

  const handleUpdateCurrentHypothesis = useCallback(
    (next: HypothesisNote) => {
      setHypothesisNotesByModule((prev) => {
        const updated = { ...prev, [currentExperimentModule.id]: next };
        try {
          window.localStorage.setItem('simulab-hypothesis-notes', JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
        return updated;
      });
    },
    [currentExperimentModule.id]
  );

  // Synchronize domain simulation mode whenever activeModuleId changes
  useEffect(() => {
    const physicsModeMap: Record<string, typeof physicsParams.mode> = {
      'newton-incline': 'newton-incline',
      'projectile-motion': 'projectile-gravity',
      'projectile-gravity': 'projectile-gravity',
      'pendulum-harmonic': 'pendulum-harmonic',
      'spring-hooke': 'spring-hooke',
      'collision-momentum': 'collision-momentum',
      'stokes-viscosity': 'stokes-viscosity',
      'ohm-wheatstone': 'ohm-wheatstone',
      'optics-young-slit': 'optics-young-slit',
      'photoelectric-planck': 'photoelectric-planck',
      'gravity-orbital': 'orbital-gravity',
      'orbital-gravity': 'orbital-gravity',
    };
    const chemistryModeMap: Record<string, typeof chemistryParams.mode> = {
      'thermo-calorimetry': 'thermo-calorimetry',
      'acid-base-titration': 'acid-base-titration',
      'redox-electrochemistry': 'electrochemistry-cell',
      'electrochemistry-cell': 'electrochemistry-cell',
      'ideal-gas-boyle': 'ideal-gas-boyle',
      'reaction-kinetics-arrhenius': 'reaction-kinetics-arrhenius',
      'spectrophotometry-beer': 'spectrophotometry-beer',
    };
    const astronomyModeMap: Record<string, typeof astronomyParams.mode> = {
      'solar-kepler': 'solar-kepler',
      'milky-way-rotation': 'milkyway-galaxy',
      'exoplanet-transit': 'stellar-exoplanet',
      'stellar-wien-spectrum': 'stellar-wien-spectrum',
      'hubble-expansion': 'hubble-expansion',
    };

    if (physicsModeMap[activeModuleId]) {
      const targetMode = physicsModeMap[activeModuleId];
      setPhysicsParams((prev) =>
        prev.mode === targetMode
          ? prev
          : {
              ...prev,
              mode: targetMode,
              initialVelocity:
                targetMode === 'projectile-gravity' && prev.initialVelocity <= 0
                  ? 22
                  : prev.initialVelocity,
            }
      );
    } else if (chemistryModeMap[activeModuleId]) {
      setChemistryParams((prev) =>
        prev.mode === chemistryModeMap[activeModuleId]
          ? prev
          : { ...prev, mode: chemistryModeMap[activeModuleId] }
      );
    } else if (astronomyModeMap[activeModuleId]) {
      setAstronomyParams((prev) =>
        prev.mode === astronomyModeMap[activeModuleId]
          ? prev
          : { ...prev, mode: astronomyModeMap[activeModuleId] }
      );
    } else if (getExperimentById(activeModuleId)?.domain === 'biologi') {
      setSelectedBioModuleId(activeModuleId);
    }
  }, [activeModuleId]);

  const handleSelectCatalogModule = useCallback(
    (mod: ExperimentModule, onSaveOpened?: (moduleId: string) => void) => {
      labSound.playClick();
      onSaveOpened?.(mod.id);
      setActiveModule(mod.id);
      const rawDomain = (mod.domain as string).toLowerCase();
      const mappedDomain: LabDomain =
        rawDomain === 'kimia'
          ? 'chemistry'
          : rawDomain === 'biologi'
          ? 'biology'
          : rawDomain === 'astronomi'
          ? 'astronomy'
          : rawDomain === 'fisika'
          ? 'physics'
          : (rawDomain as LabDomain);
      setActiveDomain(mappedDomain);
      if (rawDomain === 'biologi') {
        setSelectedBioModuleId(mod.id);
      }
      setIsLobbyMode(false);
      setWorkflowStep(1);
    },
    [setActiveDomain, setActiveModule, setIsLobbyMode, setWorkflowStep]
  );

  // Listen to spatial VR raycast selection and scaffolding prompts
  useEffect(() => {
    const onXRSpatialSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ parameterDelta?: number }>).detail;
      const stepDir = detail?.parameterDelta && detail.parameterDelta < 0 ? -1 : 1;
      labSound.playClick(stepDir > 0 ? 740 : 560);

      if (activeDomain === 'physics') {
        setPhysicsParams((prev) => ({
          ...prev,
          appliedForce: Math.max(5, Math.min(100, prev.appliedForce + stepDir * 5)),
        }));
      } else if (activeDomain === 'chemistry') {
        setChemistryParams((prev) => ({
          ...prev,
          titrantAddedMl: Number(
            Math.max(0, Math.min(50, prev.titrantAddedMl + stepDir * 1.5)).toFixed(1)
          ),
        }));
      } else if (activeDomain === 'astronomy') {
        setAstronomyParams((prev) => ({
          ...prev,
          customSemiMajorAxisAu: Number(
            Math.max(0.4, Math.min(10, prev.customSemiMajorAxisAu + stepDir * 0.25)).toFixed(2)
          ),
        }));
      }
    };

    const onScaffoldingAskDrLabMu = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          prompt: string;
        }>
      ).detail;
      if (detail?.prompt) {
        setExternalDrLabMuPrompt({
          id: Date.now(),
          prompt: detail.prompt,
        });
      }
    };

    window.addEventListener('ruanglab:xr-spatial-select', onXRSpatialSelect);
    window.addEventListener(LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU, onScaffoldingAskDrLabMu);
    return () => {
      window.removeEventListener('ruanglab:xr-spatial-select', onXRSpatialSelect);
      window.removeEventListener(LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU, onScaffoldingAskDrLabMu);
    };
  }, [activeDomain]);

  return {
    physicsParams,
    setPhysicsParams,
    chemistryParams,
    setChemistryParams,
    biologyContext,
    setBiologyContext,
    astronomyParams,
    setAstronomyParams,
    selectedBioModuleId,
    setSelectedBioModuleId,
    currentExperimentModule,
    activeScienceDomain,
    currentModuleHypothesis,
    handleUpdateCurrentHypothesis,
    handleSelectCatalogModule,
    externalDrLabMuPrompt,
    setExternalDrLabMuPrompt,
  };
}
