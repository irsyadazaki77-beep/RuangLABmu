import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import {
  speakNarration,
  stopNarration,
  voiceNarration,
} from '../utils/voiceNarrationEngine';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
} from './ui/HypothesisAndCompareDock';
import { ExperimentRecord } from '../utils/scienceEngine';
import {
  recordK3Compliance,
  loadGamificationProfile,
} from '../services/gamificationEngine';
import {
  LabSafetyLicense,
  getLabSafetyLicenseForModule,
  issueOrUpdateLabSafetyLicense,
} from '../services/labLicenseEngine';
import { LabSafetyLicenseModal } from './ui/LabSafetyLicenseModal';
import {
  PreLabSafetyAndApparatusCard,
  PreLabTheoryPanel,
} from './prelab/PreLabTheoryAndSafetySection';
import {
  PreLabInsightsPanel,
  PreLabQuizCard,
  PreLabSafetyLicenseCard,
} from './prelab/PreLabQuizAndInsightsSection';

type PreLabWorkspaceTab = 'overview' | 'quiz';

interface PreLabBriefingViewProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  studentName?: string;
  studentGroup?: string;
  onProceedToSimulation: () => void;
  onBackToLobby: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  records?: ExperimentRecord[];
}

export const PreLabBriefingView: React.FC<PreLabBriefingViewProps> = ({
  experiment,
  activeTier,
  studentName = 'Praktikan RuangLABmu',
  studentGroup = 'Kelompok Mandiri',
  onProceedToSimulation,
  onBackToLobby,
  hypothesisNote,
  onChangeHypothesisNote,
  records = [],
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PreLabWorkspaceTab>('overview');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [isSpeakingK3, setIsSpeakingK3] = useState<boolean>(false);
  const [openedQuizHints, setOpenedQuizHints] = useState<Record<string, boolean>>({});
  const [k3Complied, setK3Complied] = useState<boolean>(() =>
    loadGamificationProfile().unlockedBadges.includes('K3 Guardian')
  );
  const [activeLicense, setActiveLicense] = useState<LabSafetyLicense | null>(() =>
    getLabSafetyLicenseForModule(experiment.id)
  );
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setActiveLicense(getLabSafetyLicenseForModule(experiment.id));
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setOpenedQuizHints({});
    setActiveTab('overview');
  }, [experiment.id]);

  useEffect(() => {
    const unsubscribe = voiceNarration.subscribe((speaking) => {
      setIsSpeakingK3(speaking);
    });
    return () => {
      stopNarration();
      unsubscribe();
    };
  }, []);

  const calculateScore = () => {
    let correct = 0;
    experiment.preLabQuiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct++;
      }
    });
    return {
      correct,
      total: experiment.preLabQuiz.length,
      percentage: Math.round((correct / Math.max(1, experiment.preLabQuiz.length)) * 100),
    };
  };

  const syncSafetyLicense = (nextK3: boolean, nextQuizPct: number) => {
    const issued = issueOrUpdateLabSafetyLicense({
      moduleId: experiment.id,
      moduleTitle: experiment.title,
      domain: experiment.domain,
      studentName,
      studentGroup,
      tier: activeTier,
      k3Complied: nextK3,
      preLabQuizScorePct: nextQuizPct,
    });
    setActiveLicense(issued);
    return issued;
  };

  const handleComplyK3 = () => {
    labSound.playSuccessChime();
    recordK3Compliance(experiment.id);
    setK3Complied(true);
    const currentQuizPct = quizSubmitted
      ? calculateScore().percentage
      : activeLicense?.preLabQuizScorePct ?? 0;
    syncSafetyLicense(true, currentQuizPct);
  };

  const handleToggleK3Narration = () => {
    labSound.playClick();
    if (isSpeakingK3) {
      stopNarration();
      setIsSpeakingK3(false);
      return;
    }

    const narrationScript = `Pengarahan Keselamatan Kerja Laboratorium untuk modul ${experiment.title}. Harap diperhatikan dengan saksama: ${experiment.safetyNotes.join('. ')}. Pastikan seluruh alat pelindung diri telah dikenakan sebelum memulai praktikum.`;

    speakNarration(narrationScript, {
      rate: 0.95,
      onStart: () => setIsSpeakingK3(true),
      onEnd: () => setIsSpeakingK3(false),
      onError: () => setIsSpeakingK3(false),
    });
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (quizSubmitted) return;
    labSound.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const quizResult = quizSubmitted ? calculateScore() : null;
  const firstParamLabel = experiment.parameters[0]?.label || 'Variabel Bebas';
  const firstOutputLabel = experiment.outputs[0]?.label || 'Variabel Terikat';
  const effectiveQuizPct = quizResult?.percentage ?? activeLicense?.preLabQuizScorePct ?? 0;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 select-text">
      {/* 1. Top Experiment Context Header */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--comfort-text-muted)]">
            <span className="font-semibold text-[var(--comfort-accent)]">
              01 · Pengenalan, Hipotesis Awal &amp; K3
            </span>
            {experiment.chapterNumber && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[var(--comfort-text)] tabular-nums">
                  Bab {experiment.chapterNumber}
                </span>
              </>
            )}
            {experiment.competencyLevel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-medium">
                  Tingkat {experiment.competencyLevel}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="capitalize">{experiment.domain}</span>
            <span aria-hidden="true">·</span>
            <span>{experiment.subCategory}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Est. {experiment.estimatedMinutes} Menit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--comfort-text)] tracking-tight">
            {experiment.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onBackToLobby();
            }}
            className="px-3.5 py-2 rounded-lg comfort-btn-secondary text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            {t('controls.changeModule')}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              recordK3Compliance(experiment.id);
              onProceedToSimulation();
            }}
            className="px-5 py-2.5 rounded-lg comfort-btn-primary font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm min-h-[40px]"
          >
            <span>{t('controls.openSimulation')}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 2. Clean Progressive Disclosure Workspace Switcher */}
      <div
        role="tablist"
        aria-label="Navigasi Materi Pra-Praktikum"
        className="flex flex-wrap items-center justify-between gap-3 bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-2"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            data-testid="prelab-tab-overview"
            onClick={() => {
              labSound.playClick();
              setActiveTab('overview');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer min-h-[38px] ${
              activeTab === 'overview'
                ? 'comfort-tab-active shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Ringkasan Teori &amp; K3</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'quiz'}
            data-testid="prelab-tab-quiz"
            onClick={() => {
              labSound.playClick();
              setActiveTab('quiz');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer min-h-[38px] ${
              activeTab === 'quiz'
                ? 'comfort-tab-active shadow-xs'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Rumus Interaktif &amp; Kuis ({experiment.preLabQuiz.length} Soal)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
          <ShieldCheck
            className={`w-3.5 h-3.5 ${k3Complied ? 'text-[var(--comfort-success)]' : 'text-[var(--comfort-warning)]'}`}
            aria-hidden="true"
          />
          <span>
            {k3Complied ? 'K3 Terkonfirmasi' : 'Perlu Konfirmasi K3'} · Kuis {effectiveQuizPct}%
          </span>
        </div>
      </div>

      {/* 3. Tabbed Balanced 2-Column Workspace */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            <PreLabTheoryPanel experiment={experiment} activeTier={activeTier} />
          </div>

          <div className="lg:col-span-5 space-y-5">
            {hypothesisNote && onChangeHypothesisNote && (
              <HypothesisScratchpadCard
                moduleTitle={experiment.title}
                defaultIndependentVar={firstParamLabel}
                defaultDependentVar={firstOutputLabel}
                note={hypothesisNote}
                onChangeNote={onChangeHypothesisNote}
                records={records}
              />
            )}

            <PreLabSafetyAndApparatusCard
              experiment={experiment}
              isSpeakingK3={isSpeakingK3}
              k3Complied={k3Complied}
              safetyTitle={t('safety.sectionTitle')}
              listenLabel={t('safety.listenNarration')}
              stopLabel={t('safety.stopNarration')}
              complyLabel={t('safety.complyButton')}
              compliedLabel={t('safety.compliedBadge')}
              apparatusHeader={t('apparatus.header')}
              onToggleK3Narration={handleToggleK3Narration}
              onComplyK3={handleComplyK3}
            />

            <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 space-y-3">
              <PreLabSafetyLicenseCard
                activeLicense={activeLicense}
                k3Complied={k3Complied}
                quizScorePct={effectiveQuizPct}
                onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
              />
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setActiveTab('quiz');
                }}
                className="w-full py-2.5 px-4 rounded-lg comfort-btn-secondary text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                <span>Lanjut ke Kuis Pra-Lab &amp; Bedah Rumus</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            <PreLabInsightsPanel experiment={experiment} />
          </div>

          <div className="lg:col-span-5">
            <PreLabQuizCard
              experiment={experiment}
              selectedAnswers={selectedAnswers}
              quizSubmitted={quizSubmitted}
              quizResult={quizResult}
              openedQuizHints={openedQuizHints}
              k3Complied={k3Complied}
              activeLicense={activeLicense}
              readyOpen3DLabel={t('controls.readyOpen3D')}
              onSelectOption={handleSelectOption}
              onToggleHint={(qId) => {
                labSound.playClick();
                setOpenedQuizHints((prev) => ({ ...prev, [qId]: !prev[qId] }));
              }}
              onSubmitQuiz={() => {
                labSound.playRecordSuccess();
                setQuizSubmitted(true);
                const res = calculateScore();
                syncSafetyLicense(k3Complied, res.percentage);
              }}
              onResetQuiz={() => {
                setSelectedAnswers({});
                setQuizSubmitted(false);
              }}
              onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
              onProceedToSimulation={() => {
                labSound.playClick();
                recordK3Compliance(experiment.id);
                onProceedToSimulation();
              }}
            />
          </div>
        </div>
      )}

      <LabSafetyLicenseModal
        isOpen={isLicenseModalOpen}
        license={activeLicense}
        onClose={() => setIsLicenseModalOpen(false)}
      />
    </div>
  );
};
