/**
 * The Studio ANALYSIS-tab controller hook. Pure React (no RN import), so it runs
 * in the engine harness with react-test-renderer.
 */
import { act, createElement, useEffect, type ReactElement } from 'react';
import { useLevelAnalysis, type LevelAnalysisController } from '@/hooks/useLevelAnalysis';
import { addCharge, createBlankLevel, paintCell } from '../../model';
import { toLevelDefinition } from '../../serialize';
import type { StudioLevel } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create: (el: ReactElement) => { unmount: () => void; update: (el: ReactElement) => void };
};

let ctrl: LevelAnalysisController;
function Probe({ level }: { level: StudioLevel }) {
  const c = useLevelAnalysis(level, true);
  useEffect(() => { ctrl = c; });
  return null;
}

function filledLevel(id: number, size: number): StudioLevel {
  let l = createBlankLevel({ id, width: size, height: size });
  for (let x = 0; x < size; x += 1) for (let y = 0; y < size; y += 1) l = paintCell(l, x, y, 'white');
  return addCharge(l, 0, { color: 'white', capacity: size * size });
}

async function flush() {
  for (let i = 0; i < 30; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 8)); });
  }
}

beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

test('run → done produces an analysis for the current level; edit marks it stale', async () => {
  const level = filledLevel(9100, 4);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });

  expect(ctrl.status).toBe('idle');
  act(() => { ctrl.run(); });
  expect(ctrl.status).toBe('running');

  await flush();
  expect(ctrl.status).toBe('done');
  expect(ctrl.analysis?.levelId).toBe(9100);
  expect(ctrl.analysis?.solvable).toBe(true);
  expect(ctrl.runId).toBe(1);
  expect(ctrl.stale).toBe(false);

  // A different StudioLevel reference → the stored analysis no longer matches.
  const edited = paintCell(level, 0, 0, 'blue');
  act(() => { root.update(createElement(Probe, { level: edited })); });
  expect(ctrl.analysis).toBeNull();
  expect(ctrl.stale).toBe(true);
  act(() => root.unmount());
}, 30_000);

test('cancel during a run ends in "cancelled" with no analysis', async () => {
  const level = filledLevel(9102, 5);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });
  act(() => { ctrl.run(); });
  act(() => { ctrl.cancel(); });
  await flush();
  expect(ctrl.status).toBe('cancelled');
  expect(ctrl.analysis).toBeNull();
  act(() => root.unmount());
}, 30_000);

test('runBatch analyses a set of levels and reports completion', async () => {
  const level = filledLevel(9103, 3);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });

  const defs = [toLevelDefinition(filledLevel(9104, 3)), toLevelDefinition(filledLevel(9105, 4))];
  act(() => { ctrl.runBatch(defs); });
  expect(ctrl.batchStatus).toBe('running');
  await flush();
  expect(ctrl.batchStatus).toBe('done');
  expect(ctrl.batch?.rows.map((r) => r.levelId)).toEqual([9104, 9105]);
  expect(ctrl.batch?.complete).toBe(true);
  act(() => root.unmount());
}, 30_000);
