import React from 'react';
import {
  AstronomyParams,
  SOLAR_PLANET_PRESETS,
  SolarPlanetPreset,
} from '../../utils/scienceEngine';
import {
  EducationLevel,
  getAstronomyParameterFeedback,
} from '../../utils/pedagogicalHelpers';
import { labSound } from '../../utils/soundEngine';
import { CollapsibleLabSection, TactileParameterControl } from '../ui/LabInstruments';

export interface AstronomyParameterPanelProps {
  params: AstronomyParams;
  educationLevel: EducationLevel;
  onParamPatch: (patch: Partial<AstronomyParams>) => void;
  onFocusPlanet: (name: string) => void;
}

export const AstronomyParameterPanel: React.FC<AstronomyParameterPanelProps> = ({
  params,
  educationLevel,
  onParamPatch,
  onFocusPlanet,
}) => {
  return (
    <>
      {params.mode === 'solar-kepler' && (
        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2 text-xs">
          <span className="font-bold text-2xs text-[var(--comfort-text-muted)] uppercase tracking-wider">
            Pilih Benda Langit:
          </span>
          <div className="grid grid-cols-3 gap-1">
            {SOLAR_PLANET_PRESETS.map((planet: SolarPlanetPreset) => (
              <button
                key={planet.id}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onParamPatch({
                    selectedPlanetId: planet.id,
                    customSemiMajorAxisAu: planet.semiMajorAxisAu,
                    customEccentricity: planet.eccentricity,
                  });
                  onFocusPlanet(planet.name);
                }}
                className={`py-1.5 px-2 rounded-lg text-2xs font-semibold border transition-colors cursor-pointer ${
                  params.selectedPlanetId === planet.id
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] border-[var(--comfort-border)] hover:bg-[var(--comfort-surface-subtle)]'
                }`}
              >
                {planet.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <CollapsibleLabSection title="Parameter Astrofisika & Orbit" defaultOpen>
        <div className="space-y-3">
          {params.mode === 'milkyway-galaxy' ? (
            <>
              <TactileParameterControl
                label="Jarak Galaktosentrik (R)"
                unit="kpc"
                value={params.galactocentricRadiusKpc}
                min={1.0}
                max={25.0}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'galactocentricRadiusKpc', v, lvl)
                }
                onChange={(v) => onParamPatch({ galactocentricRadiusKpc: v })}
              />
              <TactileParameterControl
                label="Fraksi Halo Materi Gelap"
                unit="×"
                value={params.darkMatterHaloFraction}
                min={0}
                max={1.5}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'darkMatterHaloFraction', v, lvl)
                }
                onChange={(v) => onParamPatch({ darkMatterHaloFraction: v })}
              />
              <TactileParameterControl
                label="Faktor Massa Bulge & Disk"
                unit="×"
                value={params.bulgeDiskMassFactor}
                min={0.5}
                max={2.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'bulgeDiskMassFactor', v, lvl)
                }
                onChange={(v) => onParamPatch({ bulgeDiskMassFactor: v })}
              />
            </>
          ) : params.mode === 'stellar-exoplanet' ? (
            <>
              <TactileParameterControl
                label="Radius Eksoplanet (Rp)"
                unit="R⊕"
                value={params.exoplanetRadiusEarth}
                min={0.5}
                max={15.0}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'exoplanetRadiusEarth', v, lvl)
                }
                onChange={(v) => onParamPatch({ exoplanetRadiusEarth: v })}
              />
              <TactileParameterControl
                label="Radius Bintang Induk (R*)"
                unit="R☉"
                value={params.starRadiusSolar}
                min={0.2}
                max={5.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'starRadiusSolar', v, lvl)
                }
                onChange={(v) => onParamPatch({ starRadiusSolar: v })}
              />
              <TactileParameterControl
                label="Jarak Orbit Eksoplanet"
                unit="AU"
                value={params.exoplanetOrbitAu}
                min={0.05}
                max={5.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'exoplanetOrbitAu', v, lvl)
                }
                onChange={(v) => onParamPatch({ exoplanetOrbitAu: v })}
              />
            </>
          ) : params.mode === 'stellar-wien-spectrum' ? (
            <>
              <TactileParameterControl
                paramKey="starEffectiveTempK"
                label="Suhu Efektif Bintang (T*)"
                unit="K"
                value={params.starEffectiveTempK}
                min={2800}
                max={30000}
                step={200}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'starEffectiveTempK', v, lvl)
                }
                onChange={(v) => onParamPatch({ starEffectiveTempK: v })}
              />
              <TactileParameterControl
                paramKey="starRadiusSolar"
                label="Radius Bintang (R*)"
                unit="R☉"
                value={params.starRadiusSolar}
                min={0.2}
                max={10.0}
                step={0.2}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'starRadiusSolar', v, lvl)
                }
                onChange={(v) => onParamPatch({ starRadiusSolar: v })}
              />
            </>
          ) : params.mode === 'hubble-expansion' ? (
            <>
              <TactileParameterControl
                id="astro-hubble-distance"
                paramKey="galaxyDistanceMpc"
                label="Jarak Galaksi Jauh (d)"
                unit="Mpc"
                value={params.galaxyDistanceMpc ?? 120}
                min={20}
                max={600}
                step={10}
                glossaryTerm="Redshift"
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'galaxyDistanceMpc', v, lvl)
                }
                onChange={(v) => onParamPatch({ galaxyDistanceMpc: v })}
              />
              <TactileParameterControl
                label="Konstanta Hubble (H₀)"
                unit="km/s/Mpc"
                value={params.hubbleConstantH0 ?? 70}
                min={65}
                max={78}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'hubbleConstantH0', v, lvl)
                }
                onChange={(v) => onParamPatch({ hubbleConstantH0: v })}
              />
            </>
          ) : (
            <>
              <TactileParameterControl
                paramKey="customSemiMajorAxisAu"
                label="Jarak Semi-Mayor (a)"
                unit="AU"
                value={params.customSemiMajorAxisAu}
                min={0.2}
                max={30}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'customSemiMajorAxisAu', v, lvl)
                }
                onChange={(v) => onParamPatch({ customSemiMajorAxisAu: v })}
              />
              <TactileParameterControl
                id="astro-eccentricity"
                paramKey="customEccentricity"
                label="Eksentrisitas Orbit (e)"
                unit=""
                value={params.customEccentricity}
                min={0}
                max={0.9}
                step={0.02}
                glossaryTerm="Eksentrisitas"
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'customEccentricity', v, lvl)
                }
                onChange={(v) => onParamPatch({ customEccentricity: v })}
              />
              <TactileParameterControl
                paramKey="centralStarMassSolar"
                label="Massa Bintang Pusat (M*)"
                unit="M☉"
                value={params.centralStarMassSolar}
                min={0.2}
                max={5.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getAstronomyParameterFeedback(params.mode, 'centralStarMassSolar', v, lvl)
                }
                onChange={(v) => onParamPatch({ centralStarMassSolar: v })}
              />
            </>
          )}
        </div>
      </CollapsibleLabSection>
    </>
  );
};
