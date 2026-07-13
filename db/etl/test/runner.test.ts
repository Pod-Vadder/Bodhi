import { describe, expect, it } from 'vitest';
import { runJob, type EtlJob } from '../src';
import { InMemoryIdMap, InMemoryRunLog } from '../src/memory';

interface LegacyUser {
  UserId: number;
  Email: string | null;
  Name: string;
}

interface TargetUser {
  email: string;
  fullName: string;
}

function makeJob(rows: LegacyUser[], loadIds?: (batch: TargetUser[]) => string[]): EtlJob<LegacyUser, TargetUser> {
  return {
    entity: 'users',
    phase: 'M1',
    legacyIdOf: (row) => row.UserId,
    async *extract() {
      yield* rows;
    },
    transform(row) {
      if (!row.Email) return null;
      if (row.Email === 'boom') throw new Error('bad email');
      return { email: row.Email.toLowerCase(), fullName: row.Name };
    },
    async load(batch) {
      return loadIds ? loadIds(batch) : batch.map((_, i) => `uuid-${i}-${batch[i]!.email}`);
    },
  };
}

const rows: LegacyUser[] = [
  { UserId: 1, Email: 'A@x.com', Name: 'A' },
  { UserId: 2, Email: null, Name: 'B' },
  { UserId: 3, Email: 'boom', Name: 'C' },
  { UserId: 4, Email: 'D@x.com', Name: 'D' },
];

describe('runJob', () => {
  it('extracts, transforms, loads in batches, and maps legacy ids', async () => {
    const idMap = new InMemoryIdMap();
    const runLog = new InMemoryRunLog();
    const stats = await runJob(makeJob(rows), idMap, runLog, { runId: 'r1', batchSize: 1 });

    expect(stats).toMatchObject({ read: 4, transformed: 2, skipped: 1, loaded: 2 });
    expect(stats.errors).toHaveLength(1);
    expect(stats.errors[0]).toMatchObject({ legacyId: 3, stage: 'transform' });

    expect(await idMap.get('users', 1)).toContain('a@x.com');
    expect(await idMap.get('users', 4)).toContain('d@x.com');
    expect(await idMap.get('users', 2)).toBeNull();

    expect(runLog.entries[0]).toMatchObject({ status: 'running', entity: 'users' });
    expect(runLog.entries.at(-1)).toMatchObject({ status: 'failed' });
  });

  it('is idempotent: already-mapped rows are skipped on re-run', async () => {
    const idMap = new InMemoryIdMap();
    const runLog = new InMemoryRunLog();
    const clean = rows.filter((r) => r.Email && r.Email !== 'boom');

    await runJob(makeJob(clean), idMap, runLog, { runId: 'r1' });
    const second = await runJob(makeJob(clean), idMap, runLog, { runId: 'r2' });

    expect(second).toMatchObject({ read: 2, skipped: 2, loaded: 0 });
    expect(idMap.size).toBe(2);
    expect(runLog.entries.at(-1)).toMatchObject({ runId: 'r2', status: 'succeeded' });
  });

  it('records a load-stage error without aborting the run', async () => {
    const idMap = new InMemoryIdMap();
    const runLog = new InMemoryRunLog();
    const job = makeJob(rows.filter((r) => r.Email && r.Email !== 'boom'), () => {
      throw new Error('constraint violation');
    });
    const stats = await runJob(job, idMap, runLog, { runId: 'r1' });
    expect(stats.loaded).toBe(0);
    expect(stats.errors[0]).toMatchObject({ stage: 'load' });
    expect(idMap.size).toBe(0);
  });

  it('rejects a load that returns a mismatched id count', async () => {
    const idMap = new InMemoryIdMap();
    const runLog = new InMemoryRunLog();
    const job = makeJob(
      rows.filter((r) => r.Email && r.Email !== 'boom'),
      () => ['only-one'],
    );
    const stats = await runJob(job, idMap, runLog, { runId: 'r1' });
    expect(stats.errors[0]!.message).toMatch(/returned 1 ids for a batch of 2/);
  });

  it('stops when maxErrors is reached', async () => {
    const many: LegacyUser[] = Array.from({ length: 10 }, (_, i) => ({
      UserId: i + 1,
      Email: 'boom',
      Name: `U${i}`,
    }));
    const stats = await runJob(makeJob(many), new InMemoryIdMap(), new InMemoryRunLog(), {
      runId: 'r1',
      maxErrors: 3,
    });
    expect(stats.errors).toHaveLength(3);
    expect(stats.read).toBe(3);
  });
});
