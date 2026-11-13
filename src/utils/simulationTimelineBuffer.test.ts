import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TIMELINE_CAPACITY,
  SimulationTimelineBuffer,
  getDomainTimelineBuffer,
  clearAllTimelineBuffers,
} from './simulationTimelineBuffer';

test('SimulationTimelineBuffer stores frames up to 600 capacity and wraps around cleanly', () => {
  const buf = new SimulationTimelineBuffer<{ angle: number }, { speed: number }>(
    DEFAULT_TIMELINE_CAPACITY
  );

  for (let i = 0; i < 750; i++) {
    buf.push(i * 0.05, { angle: i % 90 }, { speed: i * 0.1 });
  }

  assert.equal(buf.getCount(), 600);
  const oldest = buf.getOldest();
  const latest = buf.getLatest();
  assert.ok(oldest);
  assert.ok(latest);
  assert.equal(oldest.simTime, 150 * 0.05);
  assert.equal(latest.simTime, 749 * 0.05);

  const range = buf.getRange();
  assert.equal(range.count, 600);
  assert.equal(range.minTime, 150 * 0.05);
  assert.equal(range.maxTime, 749 * 0.05);
});

test('SimulationTimelineBuffer clones snapshots so external mutation does not corrupt history', () => {
  const buf = new SimulationTimelineBuffer<{ mass: number }, { velocity: number }>(10);
  const params = { mass: 5 };
  const state = { velocity: 12 };

  buf.push(1.0, params, state);
  params.mass = 99;
  state.velocity = 999;

  const retrieved = buf.getAt(0);
  assert.ok(retrieved);
  assert.equal(retrieved.parameters.mass, 5);
  assert.equal(retrieved.stateSnapshot.velocity, 12);
});

test('SimulationTimelineBuffer supports binary search seek and branching truncateAfter', () => {
  const buf = new SimulationTimelineBuffer<{ x: number }, { y: number }>(20);
  for (let i = 0; i < 10; i++) {
    buf.push(i * 0.5, { x: i }, { y: i * 2 });
  }

  const found = buf.getByTime(2.1);
  assert.ok(found);
  assert.equal(found.index, 4);
  assert.equal(found.frame.simTime, 2.0);

  const remaining = buf.truncateAfter(4);
  assert.equal(remaining, 5);
  assert.equal(buf.getLatest()?.simTime, 2.0);

  // Branch from timestamp 2.0 with new parameter
  buf.push(2.5, { x: 42 }, { y: 84 });
  assert.equal(buf.getCount(), 6);
  assert.equal(buf.getAt(5)?.parameters.x, 42);
});

test('getDomainTimelineBuffer maintains per-domain ring buffers and clearAllTimelineBuffers resets them', () => {
  const phys = getDomainTimelineBuffer('physics');
  const chem = getDomainTimelineBuffer('chemistry');
  phys.push(0.5, { m: 1 }, { a: 2 });
  chem.push(1.0, { ph: 7 }, { v: 10 });

  assert.equal(phys.getCount(), 1);
  assert.equal(chem.getCount(), 1);

  clearAllTimelineBuffers();
  assert.equal(phys.getCount(), 0);
  assert.equal(chem.getCount(), 0);
});
