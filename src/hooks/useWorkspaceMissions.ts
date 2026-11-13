import { useEffect, useMemo, useState } from 'react';
import {
  LAB_MISSIONS_CATALOG,
  LabMission,
  MissionProgressEvaluation,
  evaluateLabMissionProgress,
} from '../registry/missionRegistry';
import {
  AstronomyParams,
  BiologyTelemetryContext,
  ChemistryParams,
  LabNotification,
  PhysicsParams,
  ScienceDomain,
  calculateAstronomyMetrics,
  calculateChemistryMetrics,
  calculatePhysicsMetrics,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

export interface WorkspaceLanInfo {
  ip: string;
  port: number;
  localUrl: string;
}

export interface UseWorkspaceMissionsOptions {
  activeDomain: string;
  activeScienceDomain: ScienceDomain;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  biologyContext: BiologyTelemetryContext;
  astronomyParams: AstronomyParams;
  completedChallengeIds: string[];
  onCompleteChallenge: (id: string) => void;
  onPushNotification: (n: LabNotification) => void;
}

/**
 * Custom hook encapsulating active lab mission selection, real-time progress
 * evaluation, automatic badge rewards, and 3T LAN hotspot discovery.
 */
export function useWorkspaceMissions({
  activeDomain,
  activeScienceDomain,
  physicsParams,
  chemistryParams,
  biologyContext,
  astronomyParams,
  completedChallengeIds,
  onCompleteChallenge,
  onPushNotification,
}: UseWorkspaceMissionsOptions): {
  domainMissions: LabMission[];
  selectedMissionId: string;
  setSelectedMissionId: (id: string) => void;
  activeMission: LabMission;
  missionProgress: MissionProgressEvaluation;
  lanInfo: WorkspaceLanInfo | null;
} {
  const domainMissions = useMemo(
    () => LAB_MISSIONS_CATALOG.filter((m) => m.domain === activeDomain),
    [activeDomain]
  );

  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    domainMissions[0]?.id || LAB_MISSIONS_CATALOG[0].id
  );
  const [claimedBadges, setClaimedBadges] = useState<string[]>([]);
  const [lanInfo, setLanInfo] = useState<WorkspaceLanInfo | null>(null);

  useEffect(() => {
    fetch('/api/lan-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.primaryLanIp || data.primaryIp || data.ip)) {
          const ip = data.primaryLanIp || data.primaryIp || data.ip;
          setLanInfo({
            ip,
            port: data.port,
            localUrl: data.lanUrl || data.localUrl || `http://${ip}:${data.port}`,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (domainMissions.length > 0 && !domainMissions.some((m) => m.id === selectedMissionId)) {
      setSelectedMissionId(domainMissions[0].id);
    }
  }, [domainMissions, selectedMissionId]);

  const activeMission = useMemo(
    () =>
      domainMissions.find((m) => m.id === selectedMissionId) ||
      domainMissions[0] ||
      LAB_MISSIONS_CATALOG[0],
    [domainMissions, selectedMissionId]
  );

  const missionProgress = useMemo(() => {
    const pMetrics = calculatePhysicsMetrics(physicsParams);
    const cMetrics = calculateChemistryMetrics(chemistryParams);
    const aMetrics = calculateAstronomyMetrics(astronomyParams);
    return evaluateLabMissionProgress(
      activeMission,
      physicsParams,
      pMetrics,
      chemistryParams,
      cMetrics,
      biologyContext,
      astronomyParams,
      aMetrics
    );
  }, [activeMission, physicsParams, chemistryParams, biologyContext, astronomyParams]);

  useEffect(() => {
    if (
      missionProgress.isCompleted &&
      !claimedBadges.includes(activeMission.id) &&
      !completedChallengeIds.includes(activeMission.id)
    ) {
      setClaimedBadges((prev) => [...prev, activeMission.id]);
      onCompleteChallenge(activeMission.id);
      labSound.playRecordSuccess();
      onPushNotification({
        id: `notif-mission-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        severity: 'nominal',
        domain: activeScienceDomain,
        title: `Misi Praktikum Tuntas: ${activeMission.title}`,
        message: `Selamat! Anda meraih lencana ${activeMission.rewardBadge} dengan galat ${missionProgress.errorPct}%.`,
      });
    }
  }, [
    missionProgress.isCompleted,
    missionProgress.errorPct,
    activeMission,
    claimedBadges,
    completedChallengeIds,
    onCompleteChallenge,
    onPushNotification,
    activeScienceDomain,
  ]);

  return {
    domainMissions,
    selectedMissionId,
    setSelectedMissionId,
    activeMission,
    missionProgress,
    lanInfo,
  };
}
