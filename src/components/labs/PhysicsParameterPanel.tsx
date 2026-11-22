import React from 'react';
import {
  GRAVITY_PRESETS,
  PhysicsParams,
} from '../../utils/scienceEngine';
import {
  EducationLevel,
  getPhysicsParameterFeedback,
} from '../../utils/pedagogicalHelpers';
import { labSound } from '../../utils/soundEngine';
import { CollapsibleLabSection, TactileParameterControl } from '../ui/LabInstruments';

export interface PhysicsParameterPanelProps {
  params: PhysicsParams;
  educationLevel: EducationLevel;
  onParamUpdate: (patch: Partial<PhysicsParams>) => void;
}

export const PhysicsParameterPanel: React.FC<PhysicsParameterPanelProps> = ({
  params,
  educationLevel,
  onParamUpdate,
}) => {
  return (
    <>
      <CollapsibleLabSection title="Variabel & Parameter Eksperimen" defaultOpen>
        <div className="space-y-3">
          {params.mode === 'projectile-gravity' ? (
            <>
              <TactileParameterControl
                paramKey="initialVelocity"
                label="Kecepatan Awal (v₀)"
                unit="m/s"
                value={params.initialVelocity || 22}
                min={5}
                max={50}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'initialVelocity', v, lvl)}
                onChange={(v) => onParamUpdate({ initialVelocity: v })}
              />
              <TactileParameterControl
                paramKey="launchAngle"
                label="Sudut Peluncuran (θ)"
                unit="°"
                value={params.launchAngle}
                min={10}
                max={85}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'launchAngle', v, lvl)}
                onChange={(v) => onParamUpdate({ launchAngle: v })}
              />
              <TactileParameterControl
                paramKey="initialHeight"
                label="Tinggi Awal Menara (h₀)"
                unit="m"
                value={params.initialHeight}
                min={0}
                max={40}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'initialHeight', v, lvl)}
                onChange={(v) => onParamUpdate({ initialHeight: v })}
              />
              <TactileParameterControl
                paramKey="mass"
                label="Massa Proyektil (m)"
                unit="kg"
                value={params.mass}
                min={0.5}
                max={25}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
            </>
          ) : params.mode === 'spring-hooke' ? (
            <>
              <TactileParameterControl
                paramKey="springConstantK"
                label="Konstanta Pegas (k)"
                unit="N/m"
                value={params.springConstantK}
                min={10}
                max={400}
                step={5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'springConstantK', v, lvl)}
                onChange={(v) => onParamUpdate({ springConstantK: v })}
              />
              <TactileParameterControl
                paramKey="springDisplacement"
                label="Simpangan Tarik (Δx)"
                unit="m"
                value={params.springDisplacement}
                min={-2.0}
                max={2.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'springDisplacement', v, lvl)}
                onChange={(v) => onParamUpdate({ springDisplacement: v })}
              />
              <TactileParameterControl
                paramKey="mass"
                label="Massa Beban (m)"
                unit="kg"
                value={params.mass}
                min={0.5}
                max={25}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
              <TactileParameterControl
                paramKey="dampingCoeff"
                label="Koefisien Redaman (b)"
                unit="Ns/m"
                value={params.dampingCoeff}
                min={0}
                max={2.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'dampingCoeff', v, lvl)}
                onChange={(v) => onParamUpdate({ dampingCoeff: v })}
              />
            </>
          ) : params.mode === 'pendulum-harmonic' ? (
            <>
              <TactileParameterControl
                id="pendulum-length"
                paramKey="pendulumLength"
                label="Panjang Tali Bandul (L)"
                unit="m"
                value={params.pendulumLength ?? 1.2}
                min={0.3}
                max={2.5}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'pendulumLength', v, lvl)}
                onChange={(v) => onParamUpdate({ pendulumLength: v })}
              />
              <TactileParameterControl
                id="pendulum-angle"
                paramKey="pendulumAngle"
                label="Sudut Simpangan Awal (θ₀)"
                unit="°"
                value={params.pendulumAngle ?? 25}
                min={5}
                max={85}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'pendulumAngle', v, lvl)}
                onChange={(v) => onParamUpdate({ pendulumAngle: v })}
              />
              <TactileParameterControl
                paramKey="mass"
                label="Massa Bandul (m)"
                unit="kg"
                value={params.mass}
                min={0.5}
                max={20}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
            </>
          ) : params.mode === 'collision-momentum' ? (
            <>
              <TactileParameterControl
                label="Massa Benda 1 (m₁)"
                unit="kg"
                value={params.mass}
                min={0.5}
                max={25}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
              <TactileParameterControl
                label="Kecepatan Awal 1 (v₁)"
                unit="m/s"
                value={params.initialVelocity || 10}
                min={1}
                max={30}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'initialVelocity', v, lvl)}
                onChange={(v) => onParamUpdate({ initialVelocity: v })}
              />
              <TactileParameterControl
                label="Massa Benda 2 (m₂)"
                unit="kg"
                value={params.collisionMass2}
                min={0.5}
                max={25}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'collisionMass2', v, lvl)}
                onChange={(v) => onParamUpdate({ collisionMass2: v })}
              />
              <TactileParameterControl
                label="Koefisien Restitusi (e)"
                unit=""
                value={params.restitutionCoeff}
                min={0}
                max={1.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'restitutionCoeff', v, lvl)}
                onChange={(v) => onParamUpdate({ restitutionCoeff: v })}
              />
            </>
          ) : params.mode === 'stokes-viscosity' ? (
            <>
              <TactileParameterControl
                label="Viskositas Fluida (η)"
                unit="Pa·s"
                value={params.fluidViscosity ?? 0.8}
                min={0.05}
                max={2.0}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'fluidViscosity', v, lvl)}
                onChange={(v) => onParamUpdate({ fluidViscosity: v })}
              />
              <TactileParameterControl
                label="Jari-jari Bola (r)"
                unit="mm"
                value={params.sphereRadius ?? 5}
                min={1}
                max={20}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'sphereRadius', v, lvl)}
                onChange={(v) => onParamUpdate({ sphereRadius: v })}
              />
              <TactileParameterControl
                label="Massa Jenis Bola (ρb)"
                unit="kg/m³"
                value={params.sphereDensity ?? 7800}
                min={2000}
                max={9000}
                step={100}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'sphereDensity', v, lvl)}
                onChange={(v) => onParamUpdate({ sphereDensity: v })}
              />
            </>
          ) : params.mode === 'ohm-wheatstone' ? (
            <>
              <TactileParameterControl
                label="Tegangan Sumber (V)"
                unit="V"
                value={params.circuitVoltage ?? 12}
                min={1}
                max={24}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'circuitVoltage', v, lvl)}
                onChange={(v) => onParamUpdate({ circuitVoltage: v })}
              />
              <TactileParameterControl
                label="Resistor Uji (Rx)"
                unit="Ω"
                value={params.resistorRx ?? 100}
                min={10}
                max={500}
                step={5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'resistorRx', v, lvl)}
                onChange={(v) => onParamUpdate({ resistorRx: v })}
              />
              <TactileParameterControl
                label="Resistor Pembanding (R₃)"
                unit="Ω"
                value={params.resistorR3 ?? 100}
                min={10}
                max={500}
                step={5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'resistorR3', v, lvl)}
                onChange={(v) => onParamUpdate({ resistorR3: v })}
              />
            </>
          ) : params.mode === 'optics-young-slit' ? (
            <>
              <TactileParameterControl
                label="Panjang Gelombang Laser (λ)"
                unit="nm"
                value={params.lightWavelength ?? 532}
                min={400}
                max={700}
                step={10}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'lightWavelength', v, lvl)}
                onChange={(v) => onParamUpdate({ lightWavelength: v })}
              />
              <TactileParameterControl
                label="Jarak Antar Celah (d)"
                unit="mm"
                value={params.slitDistance ?? 0.25}
                min={0.05}
                max={0.8}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'slitDistance', v, lvl)}
                onChange={(v) => onParamUpdate({ slitDistance: v })}
              />
              <TactileParameterControl
                label="Jarak Celah ke Layar (L)"
                unit="m"
                value={params.screenDistance ?? 1.5}
                min={0.5}
                max={3.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'screenDistance', v, lvl)}
                onChange={(v) => onParamUpdate({ screenDistance: v })}
              />
            </>
          ) : params.mode === 'photoelectric-planck' ? (
            <>
              <TactileParameterControl
                label="Panjang Gelombang Foton (λ)"
                unit="nm"
                value={params.lightWavelength ?? 400}
                min={200}
                max={700}
                step={10}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'lightWavelength', v, lvl)}
                onChange={(v) => onParamUpdate({ lightWavelength: v })}
              />
              <TactileParameterControl
                label="Fungsi Kerja Logam (W₀)"
                unit="eV"
                value={params.targetMetalWorkFunction ?? 2.3}
                min={2.0}
                max={5.5}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'targetMetalWorkFunction', v, lvl)}
                onChange={(v) => onParamUpdate({ targetMetalWorkFunction: v })}
              />
              <TactileParameterControl
                label="Potensial Penghenti (V₀)"
                unit="V"
                value={params.stoppingPotential ?? 1.2}
                min={0}
                max={5.0}
                step={0.1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'stoppingPotential', v, lvl)}
                onChange={(v) => onParamUpdate({ stoppingPotential: v })}
              />
            </>
          ) : params.mode === 'orbital-gravity' ? (
            <>
              <TactileParameterControl
                label="Massa Primer (M₁)"
                unit="kg"
                value={params.mass}
                min={1}
                max={50}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
              <TactileParameterControl
                label="Massa Sekunder (M₂)"
                unit="kg"
                value={params.secondaryMass}
                min={100}
                max={5000}
                step={100}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'secondaryMass', v, lvl)}
                onChange={(v) => onParamUpdate({ secondaryMass: v })}
              />
              <TactileParameterControl
                label="Jarak Pisah Pusat (r)"
                unit="m"
                value={params.separationDistance}
                min={1}
                max={30}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'separationDistance', v, lvl)}
                onChange={(v) => onParamUpdate({ separationDistance: v })}
              />
            </>
          ) : (
            <>
              <TactileParameterControl
                id="incline-mass"
                paramKey="mass"
                label="Massa Benda (m)"
                unit="kg"
                value={params.mass}
                min={0.5}
                max={30}
                step={0.5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'mass', v, lvl)}
                onChange={(v) => onParamUpdate({ mass: v })}
              />
              <TactileParameterControl
                id="incline-applied-force"
                paramKey="appliedForce"
                label="Gaya Dorong Luar (F)"
                unit="N"
                value={params.appliedForce}
                min={-150}
                max={250}
                step={5}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'appliedForce', v, lvl)}
                onChange={(v) => onParamUpdate({ appliedForce: v })}
              />
              <TactileParameterControl
                id="incline-angle"
                paramKey="inclineAngle"
                label="Sudut Kemiringan (θ)"
                unit="°"
                value={params.inclineAngle}
                min={0}
                max={60}
                step={1}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'inclineAngle', v, lvl)}
                onChange={(v) => onParamUpdate({ inclineAngle: v })}
              />
              <TactileParameterControl
                id="incline-friction"
                paramKey="frictionCoeffKinetic"
                label="Koefisien Gesek Kinetis (μk)"
                unit=""
                value={params.frictionCoeffKinetic}
                min={0}
                max={0.8}
                step={0.05}
                educationLevel={educationLevel}
                dynamicFeedback={(v, lvl) => getPhysicsParameterFeedback(params.mode, 'frictionCoeffKinetic', v, lvl)}
                onChange={(v) => onParamUpdate({ frictionCoeffKinetic: v })}
              />
            </>
          )}
        </div>
      </CollapsibleLabSection>

      {/* Gravity Preset Switcher */}
      <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2 text-xs">
        <span className="font-bold text-[11px] text-[var(--comfort-text-muted)] uppercase tracking-wider block">
          Gravitasi Lingkungan (g):
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {GRAVITY_PRESETS.slice(0, 3).map((gp) => (
            <button
              key={gp.name}
              type="button"
              title={gp.name}
              onClick={() => {
                labSound.playClick();
                onParamUpdate({ gravity: gp.g });
              }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer whitespace-nowrap truncate ${
                Math.abs(params.gravity - gp.g) < 0.1
                  ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                  : 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] border-[var(--comfort-border)] hover:border-sky-500/50'
              }`}
            >
              {gp.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
