import { useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useCollabStore } from '../stores/useCollabStore';
import { useBackendSync } from './useBackendSync';
import { useSpatialCollab } from './useSpatialCollab';
import type { LabDomain, UserRole } from '../stores/useLabStore';
import type {
  INITIAL_PHYSICS_PARAMS,
  INITIAL_CHEMISTRY_PARAMS,
  INITIAL_ASTRONOMY_PARAMS,
} from '../stores/initialLabParams';

type PhysicsState = typeof INITIAL_PHYSICS_PARAMS;
type ChemistryState = typeof INITIAL_CHEMISTRY_PARAMS;
type AstronomyState = typeof INITIAL_ASTRONOMY_PARAMS;

export interface UseLabCollabBridgeOptions {
  studentName: string;
  groupName: string;
  userRole: UserRole;
  activeDomain: LabDomain;
  setPhysicsParams: Dispatch<SetStateAction<PhysicsState>>;
  setChemistryParams: Dispatch<SetStateAction<ChemistryState>>;
  setAstronomyParams: Dispatch<SetStateAction<AstronomyState>>;
}

function mapDomainToServerDomain(
  activeDomain: LabDomain
): 'fisika' | 'kimia' | 'biologi' | 'astronomi' {
  if (activeDomain === 'chemistry') return 'kimia';
  if (activeDomain === 'biology') return 'biologi';
  if (activeDomain === 'astronomy') return 'astronomi';
  return 'fisika';
}

export function useLabCollabBridge({
  studentName,
  groupName,
  userRole,
  activeDomain,
  setPhysicsParams,
  setChemistryParams,
  setAstronomyParams,
}: UseLabCollabBridgeOptions) {
  const setWsConnected = useCollabStore((s) => s.setWsConnected);
  const serverDomain = mapDomainToServerDomain(activeDomain);
  const serverRole = userRole === 'pengajar' ? 'Pengajar' : 'Siswa';

  const backend = useBackendSync(
    studentName,
    groupName,
    serverRole,
    serverDomain
  );

  useEffect(() => {
    setWsConnected(backend.wsConnected);
  }, [backend.wsConnected, setWsConnected]);

  const handleRemoteParamSync = useCallback(
    (paramKey: string, value: number) => {
      if (activeDomain === 'physics') {
        setPhysicsParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'chemistry') {
        setChemistryParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'astronomy') {
        setAstronomyParams((prev) => ({ ...prev, [paramKey]: value }));
      }
    },
    [activeDomain, setAstronomyParams, setChemistryParams, setPhysicsParams]
  );

  const currentUserId = studentName.toLowerCase().replace(/\s+/g, '-');
  const spatial = useSpatialCollab({
    ws: backend.ws,
    userId: currentUserId,
    userName: studentName,
    role: serverRole,
    groupId: groupName,
    domain: serverDomain,
    onRemoteParamSync: handleRemoteParamSync,
  });

  return {
    ...backend,
    ...spatial,
  };
}
