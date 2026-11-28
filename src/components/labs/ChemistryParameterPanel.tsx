import React from 'react';
import { ChemistryParams, ChemistryMetrics, ELECTROLYSIS_PRESETS } from '../../utils/scienceEngine';
import {
  EducationLevel,
  getChemistryParameterFeedback,
} from '../../utils/pedagogicalHelpers';
import { labSound } from '../../utils/soundEngine';
import { CollapsibleLabSection, TactileParameterControl } from '../ui/LabInstruments';

export interface ChemistryParameterPanelProps {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  educationLevel: EducationLevel;
  onParamChange: (patch: Partial<ChemistryParams>) => void;
}

export const ChemistryParameterPanel: React.FC<ChemistryParameterPanelProps> = ({
  params,
  metrics,
  educationLevel,
  onParamChange,
}) => {
  return (
    <>
      {params.mode === 'acid-base-titration' && (
        <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
          <span className="font-bold text-xs text-teal-700 dark:text-teal-300 block">
            Aliran Kran Buret 3D:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                labSound.playClick(680);
                onParamChange({
                  titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 1.0).toFixed(1))),
                });
              }}
              className="flex-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              +1.0 mL Titran
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick(720);
                onParamChange({
                  titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 5.0).toFixed(1))),
                });
              }}
              className="flex-1 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              +5.0 mL
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick(440);
                onParamChange({ titrantAddedMl: 0 });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-teal-500/50 font-bold text-xs cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <CollapsibleLabSection title="Variabel & Parameter Larutan" defaultOpen>
        <div className="space-y-3">
          {params.mode === 'acid-base-titration' ? (
            <>
              <TactileParameterControl
                id="chem-titrant-ml"
                paramKey="titrantAddedMl"
                label="Volume Titran Buret (Vb)"
                unit="mL"
                value={params.titrantAddedMl}
                min={0}
                max={50}
                step={0.5}
                glossaryTerm="Titik Ekivalen"
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'titrantAddedMl', v, lvl, {
                    equivalenceVolumeMl: metrics.equivalenceVolumeMl,
                  })
                }
                onChange={(v) => onParamChange({ titrantAddedMl: v })}
              />
              <TactileParameterControl
                paramKey="titrantBaseConc"
                label="Konsentrasi Titran (Mb)"
                unit="M"
                value={params.titrantBaseConc}
                min={0.05}
                max={1.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'titrantBaseConc', v, lvl)
                }
                onChange={(v) => onParamChange({ titrantBaseConc: v })}
              />
              <TactileParameterControl
                paramKey="analyteAcidConc"
                label="Konsentrasi Analit (Ma)"
                unit="M"
                value={params.analyteAcidConc}
                min={0.05}
                max={1.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'analyteAcidConc', v, lvl)
                }
                onChange={(v) => onParamChange({ analyteAcidConc: v })}
              />
            </>
          ) : params.mode === 'electrochemistry-cell' ? (
            <>
              <TactileParameterControl
                label="Konsentrasi Ion Anoda [Mⁿ⁺]"
                unit="M"
                value={params.anodeConcM}
                min={0.01}
                max={2.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'anodeConcM', v, lvl)
                }
                onChange={(v) => onParamChange({ anodeConcM: v })}
              />
              <TactileParameterControl
                label="Konsentrasi Ion Katoda [Mⁿ⁺]"
                unit="M"
                value={params.cathodeConcM}
                min={0.01}
                max={2.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'cathodeConcM', v, lvl)
                }
                onChange={(v) => onParamChange({ cathodeConcM: v })}
              />
              <TactileParameterControl
                label="Suhu Sel Elektrokimia (T)"
                unit="°C"
                value={params.initialTempC}
                min={10}
                max={80}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'initialTempC', v, lvl)
                }
                onChange={(v) => onParamChange({ initialTempC: v })}
              />
            </>
          ) : params.mode === 'ideal-gas-boyle' ? (
            <>
              <TactileParameterControl
                paramKey="gasVolumeL"
                label="Volume Silinder Gas (V)"
                unit="L"
                value={params.gasVolumeL ?? 10}
                min={2.0}
                max={25.0}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'gasVolumeL', v, lvl)
                }
                onChange={(v) => onParamChange({ gasVolumeL: v })}
              />
              <TactileParameterControl
                paramKey="gasTemperatureK"
                label="Suhu Mutlak Gas (T)"
                unit="K"
                value={params.gasTemperatureK ?? 300}
                min={250}
                max={700}
                step={10}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'gasTemperatureK', v, lvl)
                }
                onChange={(v) => onParamChange({ gasTemperatureK: v })}
              />
              <TactileParameterControl
                label="Jumlah Mol Gas (n)"
                unit="mol"
                value={params.gasMoles ?? 1.0}
                min={0.2}
                max={2.5}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'gasMoles', v, lvl)
                }
                onChange={(v) => onParamChange({ gasMoles: v })}
              />
            </>
          ) : params.mode === 'spectrophotometry-beer' ? (
            <>
              <TactileParameterControl
                label="Panjang Gelombang Monokromator (λ)"
                unit="nm"
                value={params.spectroWavelengthNm ?? 520}
                min={400}
                max={700}
                step={10}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'spectroWavelengthNm', v, lvl)
                }
                onChange={(v) => onParamChange({ spectroWavelengthNm: v })}
              />
              <TactileParameterControl
                label="Konsentrasi Sampel Kuvet (C)"
                unit="mM"
                value={params.spectroConcMm ?? 0.1}
                min={0.01}
                max={0.25}
                step={0.01}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'spectroConcMm', v, lvl)
                }
                onChange={(v) => onParamChange({ spectroConcMm: v })}
              />
              <TactileParameterControl
                label="Tebal Kuvet (l)"
                unit="cm"
                value={params.spectroPathLengthCm ?? 1.0}
                min={0.5}
                max={2.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'spectroPathLengthCm', v, lvl)
                }
                onChange={(v) => onParamChange({ spectroPathLengthCm: v })}
              />
            </>
          ) : params.mode === 'chemical-equilibrium-lechatelier' ? (
            <>
              <TactileParameterControl
                paramKey="equilibriumTempC"
                label="Suhu Penangas Termal (T)"
                unit="°C"
                value={params.equilibriumTempC ?? 25}
                min={-10}
                max={100}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'equilibriumTempC', v, lvl)
                }
                onChange={(v) => onParamChange({ equilibriumTempC: v })}
              />
              <TactileParameterControl
                paramKey="equilibriumPressureAtm"
                label="Tekanan Kompresi Piston (P)"
                unit="atm"
                value={params.equilibriumPressureAtm ?? 1.0}
                min={0.2}
                max={5.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'equilibriumPressureAtm', v, lvl)
                }
                onChange={(v) => onParamChange({ equilibriumPressureAtm: v })}
              />
              <TactileParameterControl
                paramKey="n2o4InitialConcM"
                label="Konsentrasi Awal [N₂O₄]₀"
                unit="M"
                value={params.n2o4InitialConcM ?? 0.5}
                min={0.1}
                max={2.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'n2o4InitialConcM', v, lvl)
                }
                onChange={(v) => onParamChange({ n2o4InitialConcM: v })}
              />
            </>
          ) : params.mode === 'electrolysis-faraday' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-2xs font-bold text-[var(--comfort-text-muted)] uppercase tracking-wider block">
                  Larutan Elektrolit &amp; Logam Endapan:
                </label>
                <select
                  value={params.electrolysisElectrolyteId ?? 'cuso4'}
                  onChange={(e) => {
                    const nextId = e.target.value as NonNullable<ChemistryParams['electrolysisElectrolyteId']>;
                    const preset = ELECTROLYSIS_PRESETS.find((el) => el.id === nextId) ?? ELECTROLYSIS_PRESETS[0];
                    labSound.playClick();
                    onParamChange({
                      electrolysisElectrolyteId: preset.id,
                      electrolysisMolarMass: preset.molarMassAr,
                      electrolysisValenceN: preset.valenceN,
                    });
                  }}
                  className="w-full text-xs p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold"
                >
                  {ELECTROLYSIS_PRESETS.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.name} · Ar={el.molarMassAr}, n={el.valenceN}
                    </option>
                  ))}
                </select>
              </div>
              <TactileParameterControl
                paramKey="electrolysisCurrentA"
                label="Arus Listrik DC (I)"
                unit="A"
                value={params.electrolysisCurrentA ?? 2.5}
                min={0.5}
                max={8.0}
                step={0.25}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'electrolysisCurrentA', v, lvl)
                }
                onChange={(v) => onParamChange({ electrolysisCurrentA: v })}
              />
              <TactileParameterControl
                paramKey="electrolysisTimeMin"
                label="Waktu Elektrolisis (t)"
                unit="menit"
                value={params.electrolysisTimeMin ?? 30}
                min={5}
                max={120}
                step={5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'electrolysisTimeMin', v, lvl)
                }
                onChange={(v) => onParamChange({ electrolysisTimeMin: v })}
              />
              <TactileParameterControl
                paramKey="electrolysisMolarMass"
                label="Massa Atom Relatif (Ar)"
                unit="g/mol"
                value={params.electrolysisMolarMass ?? 63.55}
                min={10}
                max={210}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'electrolysisMolarMass', v, lvl)
                }
                onChange={(v) => onParamChange({ electrolysisMolarMass: v })}
              />
              <TactileParameterControl
                paramKey="electrolysisValenceN"
                label="Valensi Elektron (n)"
                unit="e⁻"
                value={params.electrolysisValenceN ?? 2}
                min={1}
                max={4}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'electrolysisValenceN', v, lvl)
                }
                onChange={(v) => onParamChange({ electrolysisValenceN: v })}
              />
            </>
          ) : (
            <>
              <TactileParameterControl
                id="chem-heater-temp"
                paramKey="initialTempC"
                label="Suhu Pemanas (T)"
                unit="°C"
                value={params.initialTempC}
                min={10}
                max={95}
                step={1}
                glossaryTerm="Denaturasi"
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'initialTempC', v, lvl)
                }
                onChange={(v) => onParamChange({ initialTempC: v, kineticsTempC: v })}
              />
              <TactileParameterControl
                label="Konsentrasi Reaktan"
                unit="M"
                value={params.reactantConcentration}
                min={0.1}
                max={3.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'reactantConcentration', v, lvl)
                }
                onChange={(v) => onParamChange({ reactantConcentration: v, kineticsConcA: v })}
              />
              <TactileParameterControl
                label="Kecepatan Pengaduk Magnetik"
                unit="RPM"
                value={params.stirringRpm}
                min={0}
                max={600}
                step={20}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) =>
                  getChemistryParameterFeedback(params.mode, 'stirringRpm', v, lvl)
                }
                onChange={(v) => onParamChange({ stirringRpm: v })}
              />
            </>
          )}
        </div>
      </CollapsibleLabSection>
    </>
  );
};
