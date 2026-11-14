import React from 'react';
import { PreLabSafetyModal } from '../PreLabSafetyModal';
import {
  AcademicReportPreviewModal,
} from '../ui/AcademicReportPreviewModal';
import { AcademicReportData } from '../../utils/academicReportExporter';
import { ExperimentModule, EducationTier } from '../../registry/experimentRegistry';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';

export interface GlobalModalPortalProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  reportData?: AcademicReportData | null;
  onProceedToLab?: () => void;
}

export const GlobalModalPortal: React.FC<GlobalModalPortalProps> = ({
  experiment,
  activeTier,
  reportData,
  onProceedToLab,
}) => {
  const { activeModal, closeModal } = useUIStore(
    useShallow((s) => ({
      activeModal: s.activeModal,
      closeModal: s.closeModal,
    }))
  );

  if (!activeModal) return null;

  return (
    <>
      {/* 1. Pre-Lab Safety & Objectives Modal */}
      {(activeModal === 'safety' || activeModal === 'quiz') && (
        <PreLabSafetyModal
          experiment={experiment}
          activeTier={activeTier}
          isOpen={true}
          onClose={closeModal}
          onProceedToLab={() => {
            closeModal();
            if (onProceedToLab) onProceedToLab();
          }}
        />
      )}

      {/* 2. Formal Academic Report Preview Modal */}
      {activeModal === 'report' && reportData && (
        <AcademicReportPreviewModal
          isOpen={true}
          onClose={closeModal}
          reportData={reportData}
        />
      )}
    </>
  );
};
