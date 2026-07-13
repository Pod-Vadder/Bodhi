import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCase, runDirectory } from '../src/runner';

const fixturesDir = fileURLToPath(new URL('../fixtures/synthetic', import.meta.url));

describe('golden-master harness', () => {
  it('passes every synthetic fixture', async () => {
    const report = await runDirectory(fixturesDir);
    expect(report.total).toBeGreaterThanOrEqual(2);
    for (const c of report.cases) {
      expect.soft(c.error, `${c.caseId} error`).toBeUndefined();
      expect
        .soft(c.failures, `${c.caseId} diffs: ${JSON.stringify(c.failures, null, 2)}`)
        .toEqual([]);
    }
    expect(report.failed).toBe(0);
  });

  it('reports a diff when an expectation is wrong', () => {
    const report = runCase({
      id: 'NEG-001',
      candidate: { age: 16 },
      referenceData: {
        stenTable: [
          { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 0, rawMax: 30, sten: 5 },
        ],
      },
      input: { aptitude: [{ scale: 'WS1', raw: 10 }] },
      expected: { aptitude: [{ scale: 'WS1', sten: 9 }] },
    });
    expect(report.passed).toBe(false);
    expect(report.failures).toEqual([
      { path: 'aptitude.WS1.sten', expected: 9, actual: 5 },
    ]);
  });

  it('surfaces engine errors instead of crashing the suite', () => {
    const report = runCase({
      id: 'NEG-002',
      candidate: { age: 99 },
      referenceData: {
        stenTable: [
          { scale: 'WS1', ageMin: 16, ageMax: 18, rawMin: 0, rawMax: 30, sten: 5 },
        ],
      },
      input: { aptitude: [{ scale: 'WS1', raw: 10 }] },
      expected: { aptitude: [{ scale: 'WS1', sten: 5 }] },
    });
    expect(report.passed).toBe(false);
    expect(report.error).toMatch(/No sten band/);
  });

  it('rejects malformed fixtures with a readable error', () => {
    const report = runCase({ id: 'NEG-003', tolerance: 'not-a-number' });
    expect(report.passed).toBe(false);
    expect(report.error).toMatch(/Invalid fixture/);
  });
});
