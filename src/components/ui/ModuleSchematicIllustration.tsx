import React from 'react';
import { ScienceDomain } from '../../registry/experimentRegistry';
import { PhysicsSchematics } from './schematics/PhysicsSchematics';
import { ChemistrySchematics } from './schematics/ChemistrySchematics';
import { BiologySchematics } from './schematics/BiologySchematics';
import { AstronomySchematics } from './schematics/AstronomySchematics';

export const DOMAIN_SCHEMATIC_COLORS: Record<ScienceDomain, string> = {
  fisika: '#0ea5e9',
  kimia: '#14b8a6',
  biologi: '#10b981',
  astronomi: '#6366f1',
};

export interface ModuleSchematicIllustrationProps {
  moduleId: string;
  domain: ScienceDomain;
  title?: string;
  subCategory?: string;
  className?: string;
}

export const ModuleSchematicIllustration: React.FC<ModuleSchematicIllustrationProps> = ({
  moduleId,
  domain,
  title = '',
  subCategory = '',
  className = '',
}) => {
  const accent = DOMAIN_SCHEMATIC_COLORS[domain] || '#0ea5e9';
  const keyText = `${moduleId} ${title} ${subCategory}`.toLowerCase();

  const renderDomainSchematic = () => {
    switch (domain) {
      case 'fisika':
        return <PhysicsSchematics moduleId={moduleId} keyText={keyText} accent={accent} />;
      case 'kimia':
        return <ChemistrySchematics moduleId={moduleId} keyText={keyText} accent={accent} />;
      case 'biologi':
        return <BiologySchematics moduleId={moduleId} keyText={keyText} accent={accent} />;
      case 'astronomi':
      default:
        return <AstronomySchematics moduleId={moduleId} keyText={keyText} accent={accent} />;
    }
  };

  return (
    <svg
      viewBox="0 0 280 110"
      className={`w-full h-full block select-none ${className}`}
      role="img"
      aria-label={`Skematik Ilmiah ${domain} - ${moduleId}`}
    >
      {renderDomainSchematic()}
    </svg>
  );
};
