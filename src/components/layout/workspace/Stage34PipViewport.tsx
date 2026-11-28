import React from 'react';
import { labSound } from '../../../utils/soundEngine';
import { useLabSessionContext } from '../../../contexts/LabSessionContext';
import { useLabStore } from '../../../stores/useLabStore';
import { useUIStore } from '../../../stores/useUIStore';
import { normalizeEducationLevel } from '../../../utils/pedagogicalHelpers';
import { MysteryChallengeCockpitBanner } from '../../exam/MysteryChallengeCockpitBanner';
import { SceneEmbedModeProvider } from '../../../contexts/SceneEmbedModeContext';

const PhysicsLabView = React.lazy(() =>
  import('../../PhysicsLabView').then((m) => ({ default: m.PhysicsLabView }))
);
const ChemistryLabView = React.lazy(() =>
  import('../../ChemistryLabView').then((m) => ({ default: m.ChemistryLabView }))
);
const BiologyLabView = React.lazy(() =>
  import('../../BiologyLabView').then((m) => ({ default: m.BiologyLabView }))
);
const AstronomyLabView = React.lazy(() =>
  import('../../AstronomyLabView').then((m) => ({ default: m.AstronomyLabView }))
);
const EarthScienceLabView = React.lazy(() =>
  import('../../EarthScienceLabView').then((m) => ({ default: m.EarthScienceLabView }))
);

export interface Stage34PipViewportProps {
  effectiveStep: number;
  pip3DMode: 'pip' | 'split' | 'minimized';
  onChangePip3DMode: (next: 'pip' | 'split' | 'minimized') => void;
  onQueueDrLabMuPrompt: (prompt: string) => void;
}

export const Stage34PipViewport: React.FC<Stage34PipViewportProps> = ({
  effectiveStep,
  pip3DMode,
  onChangePip3DMode,
  onQueueDrLabMuPrompt,
}) => {
  const activeDomain = useLabStore((s) => s.activeDomain);
  const academicLevel = useLabStore((s) => s.academicLevel);
  const setAcademicLevel = useLabStore((s) => s.setAcademicLevel);
  const setWorkflowStep = useLabStore((s) => s.setWorkflowStep);
  const setIsLobbyMode = useLabStore((s) => s.setIsLobbyMode);
  const zenMode = useUIStore((s) => s.zenMode);
  const setDrawerTab = useUIStore((s) => s.setDrawerTab);
  const setDrawerOpen = useUIStore((s) => s.setDrawerOpen);

  const {
    currentExperimentModule,
    activeTierLabel,
    currentProfile,
    records,
    capturedSnapshots,
    completedChallengeIds,
    currentModuleHypothesis,
    physicsParams,
    setPhysicsParams,
    chemistryParams,
    setChemistryParams,
    setBiologyContext,
    astronomyParams,
    setAstronomyParams,
    selectedBioModuleId,
    setSelectedBioModuleId,
    activeMysteryChallenge,
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
    deleteRecord,
    onExportCSV,
    onSubmitQuizScoreAndGrade,
    handleRecordExperiment,
    pushNotification,
    onSyncWithGroup,
    handleCapture3DSnapshot,
    onCompleteChallenge,
    submitMysteryExam,
    dismissMysteryChallenge,
    handleUpdateCurrentHypothesis,
  } = useLabSessionContext();

  return (
    <div
      data-testid={effectiveStep === 2 ? 'main-3d-cockpit' : 'mini-3d-pip-viewport'}
      data-pip-mode={effectiveStep === 2 ? 'full' : pip3DMode}
      className={
        effectiveStep === 2
          ? 'flex-1 min-h-0 flex flex-col overflow-hidden relative w-full h-full'
          : pip3DMode === 'split'
          ? 'w-full lg:w-[45%] h-[300px] lg:h-full shrink-0 flex flex-col overflow-hidden relative border-b lg:border-b-0 lg:border-r border-[var(--comfort-border)] bg-[var(--comfort-surface)]'
          : pip3DMode === 'pip'
          ? 'fixed bottom-4 right-4 w-[310px] sm:w-[360px] h-[235px] z-30 rounded-xl border border-[var(--comfort-accent-border)] bg-[var(--comfort-surface)] shadow-2xl overflow-hidden flex flex-col'
          : 'fixed bottom-4 right-4 w-auto h-auto z-30 rounded-xl border border-[var(--comfort-accent-border)] studio-hud-surface shadow-xl overflow-hidden flex flex-col'
      }
    >
      {/* Active Mystery Sample Forensic Exam Banner (All 4 Domains on Step 2) */}
      {effectiveStep === 2 && activeMysteryChallenge && (
        <MysteryChallengeCockpitBanner
          challenge={activeMysteryChallenge}
          studentName={currentProfile.name}
          onSubmitResult={(sName, res, title) => {
            submitMysteryExam(sName, res, title);
            if (res.passed) {
              onCompleteChallenge(activeMysteryChallenge.id);
            }
          }}
          onDismiss={dismissMysteryChallenge}
          onAskDrLabMu={(prompt) => {
            setDrawerTab('ai');
            setDrawerOpen(true);
            onQueueDrLabMuPrompt(prompt);
          }}
        />
      )}

      {/* Mini-3D PiP / Split Control Header Bar when in Step 3 or Step 4 */}
      {effectiveStep !== 2 && (
        <div className="px-3 py-1.5 studio-hud-surface border-b border-[var(--comfort-hud-border)] flex items-center justify-between gap-2 text-2xs text-[var(--comfort-hud-text)] shrink-0 z-20">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-[var(--comfort-hud-text)] truncate">
              Pratinjau 3D · {currentExperimentModule.title}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="pip-mode-split-btn"
              onClick={() => {
                labSound.playClick();
                onChangePip3DMode(pip3DMode === 'split' ? 'pip' : 'split');
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
              }}
              className={`px-2 py-1 rounded font-mono text-2xs font-bold cursor-pointer transition-colors ${
                pip3DMode === 'split'
                  ? 'comfort-tab-active'
                  : 'studio-hud-subcard border hover:border-[var(--comfort-accent-border)] text-[var(--comfort-hud-text)]'
              }`}
              title="Alihkan antara Split 45%/55% dan Jendela Melayang Mini-PiP"
            >
              {pip3DMode === 'split' ? 'Mini-PiP' : 'Split 45/55'}
            </button>
            <button
              type="button"
              data-testid="pip-toggle-minimize-btn"
              onClick={() => {
                labSound.playClick();
                onChangePip3DMode(pip3DMode === 'minimized' ? 'pip' : 'minimized');
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
              }}
              className="px-2 py-1 rounded studio-hud-subcard border hover:border-[var(--comfort-accent-border)] text-[var(--comfort-hud-text)] font-mono text-2xs cursor-pointer transition-colors"
            >
              {pip3DMode === 'minimized' ? 'Tampilkan 3D' : 'Kecilkan'}
            </button>
            <button
              type="button"
              data-testid="pip-return-to-3d-btn"
              onClick={() => {
                labSound.playClick();
                setWorkflowStep(2);
              }}
              className="px-2 py-1 rounded comfort-btn-primary font-mono text-2xs font-bold cursor-pointer transition-colors"
            >
              Penuh
            </button>
          </div>
        </div>
      )}

      {/* 3D Scene Inner Viewport */}
      <SceneEmbedModeProvider mode={effectiveStep === 2 ? 'full' : 'pip'}>
        <div
          className={
            effectiveStep !== 2 && pip3DMode === 'minimized'
              ? 'hidden'
              : 'flex-1 min-h-0 flex overflow-hidden relative w-full h-full'
          }
        >
        {activeDomain === 'physics' && (
          <PhysicsLabView
            params={physicsParams}
            onChangeParams={setPhysicsParams}
            academicLevel={academicLevel}
            records={records}
            activeStudentName={currentProfile.name}
            activeGroupId={currentProfile.group}
            onDeleteRecord={deleteRecord}
            onExportCSV={onExportCSV}
            onSubmitQuizScore={onSubmitQuizScoreAndGrade}
            onProceedToAnalysis={() => setWorkflowStep(3)}
            onBackToCatalog={() => setIsLobbyMode(true)}
            onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
              handleRecordExperiment('Fisika', title, summary, keyMetrics, noteText, numericCoords)
            }
            onPushNotification={pushNotification}
            onSyncWithGroup={(summary) => onSyncWithGroup('Fisika', summary)}
            remoteCursors={remoteCursors}
            onEmitCursor={emitCursor3D}
            paramLocks={paramLocks}
            onAcquireLock={acquireParamLock}
            onReleaseLock={releaseParamLock}
            activeMysteryChallenge={activeMysteryChallenge}
            onSubmitMysteryExam={submitMysteryExam}
            hypothesisNote={currentModuleHypothesis}
            onChangeHypothesisNote={handleUpdateCurrentHypothesis}
            zenMode={effectiveStep === 2 ? zenMode : true}
            snapshotCount={capturedSnapshots.length}
            onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
              handleCapture3DSnapshot('Fisika', dataUrl, modTitle, pSum, pMetric)
            }
            completedChallengeIds={completedChallengeIds}
            onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
          />
        )}

        {activeDomain === 'chemistry' && (
          <ChemistryLabView
            params={chemistryParams}
            onChangeParams={setChemistryParams}
            academicLevel={academicLevel}
            records={records}
            activeStudentName={currentProfile.name}
            activeGroupId={currentProfile.group}
            onDeleteRecord={deleteRecord}
            onExportCSV={onExportCSV}
            onSubmitQuizScore={onSubmitQuizScoreAndGrade}
            onProceedToAnalysis={() => setWorkflowStep(3)}
            onBackToCatalog={() => setIsLobbyMode(true)}
            onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
              handleRecordExperiment('Kimia', title, summary, keyMetrics, noteText, numericCoords)
            }
            onPushNotification={pushNotification}
            onSyncWithGroup={(summary) => onSyncWithGroup('Kimia', summary)}
            remoteCursors={remoteCursors}
            onEmitCursor={emitCursor3D}
            activeMysteryChallenge={activeMysteryChallenge}
            onSubmitMysteryExam={submitMysteryExam}
            hypothesisNote={currentModuleHypothesis}
            onChangeHypothesisNote={handleUpdateCurrentHypothesis}
            zenMode={effectiveStep === 2 ? zenMode : true}
            snapshotCount={capturedSnapshots.length}
            onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
              handleCapture3DSnapshot('Kimia', dataUrl, modTitle, pSum, pMetric)
            }
            completedChallengeIds={completedChallengeIds}
            onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
          />
        )}

        {activeDomain === 'biology' && (
          <BiologyLabView
            activeStudentName={currentProfile.name}
            activeGroupId={currentProfile.group}
            activeTier={activeTierLabel}
            selectedModuleId={selectedBioModuleId}
            onSelectModuleId={setSelectedBioModuleId}
            records={records}
            onDeleteRecord={deleteRecord}
            onExportCSV={onExportCSV}
            onSubmitQuizScore={onSubmitQuizScoreAndGrade}
            onProceedToAnalysis={() => setWorkflowStep(3)}
            onBackToCatalog={() => setIsLobbyMode(true)}
            onBiologyContextChange={setBiologyContext}
            onRecordExperiment={(_d, title, summary, keyMetrics, noteText, numericCoords) =>
              handleRecordExperiment('Biologi', title, summary, keyMetrics, noteText, numericCoords)
            }
            remoteCursors={remoteCursors}
            onEmitCursor={emitCursor3D}
            paramLocks={paramLocks}
            onAcquireLock={acquireParamLock}
            onReleaseLock={releaseParamLock}
            onTierChange={(newTier) => {
              setAcademicLevel(normalizeEducationLevel(newTier));
            }}
            hypothesisNote={currentModuleHypothesis}
            onChangeHypothesisNote={handleUpdateCurrentHypothesis}
            zenMode={effectiveStep === 2 ? zenMode : true}
            snapshotCount={capturedSnapshots.length}
            onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
              handleCapture3DSnapshot('Biologi', dataUrl, modTitle, pSum, pMetric)
            }
            completedChallengeIds={completedChallengeIds}
            onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
          />
        )}

        {activeDomain === 'astronomy' && (
          <AstronomyLabView
            params={astronomyParams}
            onChangeParams={setAstronomyParams}
            academicLevel={academicLevel}
            records={records}
            activeStudentName={currentProfile.name}
            activeGroupId={currentProfile.group}
            onDeleteRecord={deleteRecord}
            onExportCSV={onExportCSV}
            onSubmitQuizScore={onSubmitQuizScoreAndGrade}
            onProceedToAnalysis={() => setWorkflowStep(3)}
            onBackToCatalog={() => setIsLobbyMode(true)}
            onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
              handleRecordExperiment('Astronomi', title, summary, keyMetrics, noteText, numericCoords)
            }
            onPushNotification={pushNotification}
            onSyncWithGroup={(summary) => onSyncWithGroup('Astronomi', summary)}
            remoteCursors={remoteCursors}
            onEmitCursor={emitCursor3D}
            activeMysteryChallenge={activeMysteryChallenge}
            onSubmitMysteryExam={submitMysteryExam}
            hypothesisNote={currentModuleHypothesis}
            onChangeHypothesisNote={handleUpdateCurrentHypothesis}
            zenMode={effectiveStep === 2 ? zenMode : true}
            snapshotCount={capturedSnapshots.length}
            onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
              handleCapture3DSnapshot('Astronomi', dataUrl, modTitle, pSum, pMetric)
            }
            completedChallengeIds={completedChallengeIds}
            onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
          />
        )}

        {activeDomain === 'earth' && (
          <EarthScienceLabView
            records={records}
            onDeleteRecord={deleteRecord}
            onProceedToAnalysis={() => setWorkflowStep(3)}
            onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
              handleRecordExperiment('Kebumian', title, summary, keyMetrics, noteText, numericCoords)
            }
            hypothesisNote={currentModuleHypothesis?.hypothesisText}
            zenMode={effectiveStep === 2 ? zenMode : true}
          />
        )}
        </div>
      </SceneEmbedModeProvider>
    </div>
  );
};
