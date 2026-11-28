import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeArrheniusKineticsState,
  computeBeerLambertBeamState,
  computeCalorimeterVisualState,
  computeGalvanicCellVisualState,
  computeGasPistonVisualState,
  computeTitrationVisualState,
  computeElectrolysisVisualState,
} from './chemistryVisualHelpers';

test('computeGasPistonVisualState computes piston height, thermal color, moles, and calibrated manometer', () => {
  const cool = computeGasPistonVisualState(10, 290, 0.5, 1.2);
  const hot = computeGasPistonVisualState(20, 520, 2.0, 32.0);
  assert.ok(hot.pistonY > cool.pistonY);
  assert.equal(cool.gasColorHex, 0x38bdf8);
  assert.equal(hot.gasColorHex, 0xef4444);
  assert.ok(hot.particleSpeed > cool.particleSpeed);
  assert.ok(hot.activeMoleculeCount > cool.activeMoleculeCount, 'More moles must render more gas molecules');
  assert.equal(cool.manometerMaxAtm, 6);
  assert.equal(hot.manometerMaxAtm, 50, 'High pressure must auto-range manometer scale cleanly');
});

test('computeArrheniusKineticsState computes heater glow, stirrer speed, and exponential [A](t) conversion', () => {
  const room = computeArrheniusKineticsState(25, 200, false, 0.05, 0.5, 4);
  const heated = computeArrheniusKineticsState(80, 600, true, 0.45, 1.0, 4);
  assert.ok(Math.abs(room.heaterIntensity) < 1e-4);
  assert.ok(heated.heaterIntensity > 1.0);
  assert.ok(heated.stirAngularStep > room.stirAngularStep);
  assert.ok(heated.vortexOpacity > room.vortexOpacity);
  assert.ok(
    heated.reactionConversion > room.reactionConversion,
    'Higher Arrhenius rate constant k must yield faster conversion 1 - exp(-k*t)'
  );
  assert.ok(heated.turbidityOpacity > room.turbidityOpacity);
});

test('computeBeerLambertBeamState computes attenuation, complementary solution hue, and path length scale', () => {
  const lowAbs = computeBeerLambertBeamState(470, 0.1, 1.0);
  const highAbs = computeBeerLambertBeamState(650, 1.8, 3.0);
  assert.equal(lowAbs.beamColorHex, 0x3b82f6);
  assert.equal(highAbs.beamColorHex, 0xef4444);
  assert.ok(lowAbs.transmittedOpacity > highAbs.transmittedOpacity);
  assert.ok(lowAbs.transmittance > 0.75);
  assert.ok(highAbs.transmittance < 0.05);
  assert.ok(highAbs.cuvettePathScale > lowAbs.cuvettePathScale, 'Longer path length b widens 3D cuvette');
  assert.ok(highAbs.solutionOpacity > lowAbs.solutionOpacity);
});

test('computeCalorimeterVisualState distinguishes exothermic heating vs endothermic cooling', () => {
  const exo = computeCalorimeterVisualState(25, 45, 300, 600, 0.8, true);
  assert.equal(exo.isExothermic, true);
  assert.equal(exo.isEndothermic, false);
  assert.ok(exo.liveTempC > 38 && exo.liveTempC < 45);
  assert.ok(exo.thermalVaporIntensity > 0.5);
  assert.equal(exo.frostCondensationIntensity, 0);

  const endo = computeCalorimeterVisualState(25, 12, 150, 300, 1.0, false);
  assert.equal(endo.isEndothermic, true);
  assert.ok(endo.frostCondensationIntensity > 0.5);
  assert.ok(exo.liquidHeightScale > endo.liquidHeightScale, 'Larger volume mL raises liquid height');
});

test('computeTitrationVisualState drains burette over 0..100 mL and rises flask volume', () => {
  const start = computeTitrationVisualState(50, 0, 400);
  const mid = computeTitrationVisualState(50, 50, 400);
  const high = computeTitrationVisualState(50, 90, 800);
  assert.equal(start.buretteFillFrac, 1.0);
  assert.equal(mid.buretteFillFrac, 0.5);
  assert.ok(high.buretteFillFrac < mid.buretteFillFrac && high.buretteFillFrac > 0.04);
  assert.ok(high.flaskVolumeScale > mid.flaskVolumeScale && mid.flaskVolumeScale > start.flaskVolumeScale);
});

test('computeGalvanicCellVisualState updates electrode metals, plating thickness, and reversed flow sign', () => {
  const znCu = computeGalvanicCellVisualState('zn-cu-daniell', 1.1, 1.0, 1.5, 20);
  const feCu = computeGalvanicCellVisualState('fe-cu-volta', 0.78, 0.2, 1.0, 20);
  const reversed = computeGalvanicCellVisualState('zn-cu-daniell', -0.4, 1.0, 0.01, 20);

  assert.notEqual(znCu.anodeMetalHex, feCu.anodeMetalHex);
  assert.equal(znCu.electronFlowSign, 1);
  assert.ok(znCu.anodeWidthScale < 1 && znCu.cathodeWidthScale > 1, 'Anode dissolves while cathode plates');
  assert.equal(reversed.electronFlowSign, -1, 'Negative cell potential must reverse electron flow direction');
});

test('computeElectrolysisVisualState scales cathode plating and anode bubbles with current and electrolyte', () => {
  const lowI = computeElectrolysisVisualState(
    { electrolysisElectrolyteId: 'cuso4', electrolysisCurrentA: 1.0, electrolysisTimeMin: 30 },
    {},
    12
  );
  const highI = computeElectrolysisVisualState(
    { electrolysisElectrolyteId: 'cuso4', electrolysisCurrentA: 5.0, electrolysisTimeMin: 30 },
    {},
    12
  );
  const silver = computeElectrolysisVisualState(
    { electrolysisElectrolyteId: 'agno3', electrolysisCurrentA: 2.5, electrolysisTimeMin: 30 },
    {},
    12
  );
  assert.ok(highI.cathodePlatingThicknessScale > lowI.cathodePlatingThicknessScale);
  assert.ok(highI.anodeBubbleSpeed > lowI.anodeBubbleSpeed);
  assert.equal(silver.metalSymbol, 'Ag');
  assert.notEqual(silver.solutionHex, lowI.solutionHex);
});
