import { describe, expect, it } from 'vitest';
import { reconcile, reconciliationReport } from '../src';

describe('reconcile', () => {
  it('passes when counts match, accounting for expected skips', () => {
    const results = reconcile([
      { entity: 'users', sourceCount: 100, targetCount: 100 },
      { entity: 'orders', sourceCount: 100, targetCount: 95, expectedSkips: 5 },
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('fails on count mismatch or checksum mismatch', () => {
    const results = reconcile([
      { entity: 'users', sourceCount: 100, targetCount: 99 },
      {
        entity: 'scores',
        sourceCount: 10,
        targetCount: 10,
        sourceChecksum: 'aaa',
        targetChecksum: 'bbb',
      },
    ]);
    expect(results[0]).toMatchObject({ countsMatch: false, ok: false });
    expect(results[1]).toMatchObject({ countsMatch: true, checksumsMatch: false, ok: false });
  });

  it('treats missing checksums as not-applicable, not failing', () => {
    const [result] = reconcile([{ entity: 'users', sourceCount: 1, targetCount: 1 }]);
    expect(result!.checksumsMatch).toBeNull();
    expect(result!.ok).toBe(true);
  });
});

describe('reconciliationReport', () => {
  it('renders a markdown report with a pass/fail summary', () => {
    const report = reconciliationReport(
      reconcile([
        { entity: 'users', sourceCount: 2, targetCount: 2 },
        { entity: 'orders', sourceCount: 3, targetCount: 1 },
      ]),
      'run-42',
    );
    expect(report).toContain('Run: run-42');
    expect(report).toContain('| users | 2 | 2 | 0 | match | n/a | ✅ |');
    expect(report).toContain('| orders | 3 | 1 | 0 | MISMATCH | n/a | ❌ |');
    expect(report).toContain('1/2 entities FAILED reconciliation: orders');
  });
});
