import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDrLabMuUIActions,
  deriveContextualDrLabMuActions,
  formatDrLabMuActionChipLabel,
} from './drLabMuActions';

test('sanitizeDrLabMuUIActions filters invalid actions and clamps slider duration', () => {
  const cleaned = sanitizeDrLabMuUIActions([
    { type: 'FOCUS_CAMERA', target: 'burette_tip' },
    { type: 'FOCUS_CAMERA', target: 'unknown_hacked_target' },
    { type: 'TOGGLE_XRAY', enabled: true },
    { type: 'HIGHLIGHT_SLIDER', paramKey: 'titrantAddedMl', durationMs: 999999 },
    { type: 'HIGHLIGHT_SLIDER', paramKey: 'bad key with spaces!!', durationMs: 2000 },
    { type: 'SET_SIMULATION_STATE', action: 'play' },
    { type: 'SET_SIMULATION_STATE', action: 'drop_table' },
  ]);

  assert.equal(cleaned.length, 4);
  assert.deepEqual(cleaned[0], { type: 'FOCUS_CAMERA', target: 'burette_tip' });
  assert.deepEqual(cleaned[1], { type: 'TOGGLE_XRAY', enabled: true });
  assert.deepEqual(cleaned[2], {
    type: 'HIGHLIGHT_SLIDER',
    paramKey: 'titrantAddedMl',
    durationMs: 8000,
  });
  assert.deepEqual(cleaned[3], { type: 'SET_SIMULATION_STATE', action: 'play' });
});

test('deriveContextualDrLabMuActions infers domain-specific 3D camera, X-Ray, and slider actions offline', () => {
  const chemActions = deriveContextualDrLabMuActions({
    domain: 'Kimia',
    topic: 'acid-base-titration',
    studentQuery: 'Kenapa warna indikator berubah di ujung buret?',
  });
  assert.ok(chemActions.some((a) => a.type === 'FOCUS_CAMERA' && a.target === 'burette_tip'));
  assert.ok(chemActions.some((a) => a.type === 'HIGHLIGHT_SLIDER' && a.paramKey === 'titrantAddedMl'));

  const heartActions = deriveContextualDrLabMuActions({
    domain: 'Biologi',
    topic: 'anatomy-cardiovascular-heart',
    studentQuery: 'Bagaimana aliran darah di ventrikel kiri saat pembuluh menyempit?',
  });
  assert.ok(heartActions.some((a) => a.type === 'FOCUS_CAMERA' && a.target === 'left_ventricle'));
  assert.ok(heartActions.some((a) => a.type === 'TOGGLE_XRAY' && a.enabled === true));
  assert.ok(heartActions.some((a) => a.type === 'HIGHLIGHT_SLIDER' && a.paramKey === 'vesselRadiusRatio'));

  const pendActions = deriveContextualDrLabMuActions({
    domain: 'Fisika',
    topic: 'pendulum-harmonic',
    studentQuery: 'Pengaruh panjang tali bandul terhadap periode?',
  });
  assert.ok(pendActions.some((a) => a.type === 'FOCUS_CAMERA' && a.target === 'pendulum_bob'));
  assert.ok(pendActions.some((a) => a.type === 'HIGHLIGHT_SLIDER' && a.paramKey === 'pendulumLength'));

  const exoActions = deriveContextualDrLabMuActions({
    domain: 'Astronomi',
    topic: 'exoplanet-transit',
    studentQuery: 'Mengapa kurva cahaya transit eksoplanet menurun saat melintas?',
  });
  assert.ok(exoActions.some((a) => a.type === 'FOCUS_CAMERA' && a.target === 'planet_focus'));
  assert.ok(exoActions.some((a) => a.type === 'HIGHLIGHT_SLIDER' && a.paramKey === 'exoplanetRadiusEarth'));

  const ecoActions = deriveContextualDrLabMuActions({
    domain: 'Biologi',
    topic: 'predator-prey-dynamics',
    studentQuery: 'Mengapa siklus populasi predator tertinggal dari mangsa?',
  });
  assert.ok(ecoActions.some((a) => a.type === 'HIGHLIGHT_SLIDER' && a.paramKey === 'preyPopulationX'));
});

test('formatDrLabMuActionChipLabel produces readable Indonesian labels', () => {
  assert.equal(
    formatDrLabMuActionChipLabel({ type: 'FOCUS_CAMERA', target: 'planet_focus' }),
    'Fokus Kamera: Fokus Planet Orbit'
  );
  assert.equal(
    formatDrLabMuActionChipLabel({ type: 'TOGGLE_XRAY', enabled: true }),
    'Aktifkan Mode X-Ray'
  );
});
