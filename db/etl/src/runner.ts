import type { EtlJob, EtlStats, IdMapPort, RowError, RunLogPort } from './framework';

export interface RunOptions {
  runId: string;
  batchSize?: number;
  /** Abort the run when the error count crosses this threshold (default 100). */
  maxErrors?: number;
}

export async function runJob<TSource, TTarget>(
  job: EtlJob<TSource, TTarget>,
  idMap: IdMapPort,
  runLog: RunLogPort,
  options: RunOptions,
): Promise<EtlStats> {
  const batchSize = options.batchSize ?? 500;
  const maxErrors = options.maxErrors ?? 100;
  const startedAt = new Date();

  const stats: EtlStats = {
    entity: job.entity,
    read: 0,
    transformed: 0,
    skipped: 0,
    loaded: 0,
    errors: [],
  };

  await runLog.write({
    runId: options.runId,
    phase: job.phase,
    entity: job.entity,
    status: 'running',
    startedAt,
  });

  let batch: TTarget[] = [];
  let batchLegacyIds: number[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    try {
      const newIds = await job.load(batch);
      if (newIds.length !== batch.length) {
        throw new Error(
          `load returned ${newIds.length} ids for a batch of ${batch.length} rows`,
        );
      }
      for (let i = 0; i < newIds.length; i += 1) {
        await idMap.put(job.entity, batchLegacyIds[i]!, newIds[i]!);
      }
      stats.loaded += batch.length;
    } catch (error) {
      stats.errors.push({
        legacyId: batchLegacyIds[0] ?? null,
        stage: 'load',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    batch = [];
    batchLegacyIds = [];
  };

  const recordError = (error: RowError): boolean => {
    stats.errors.push(error);
    return stats.errors.length >= maxErrors;
  };

  try {
    for await (const row of job.extract()) {
      stats.read += 1;
      const legacyId = job.legacyIdOf(row);

      // Idempotent re-runs: rows already mapped are skipped, not duplicated.
      if (await idMap.get(job.entity, legacyId)) {
        stats.skipped += 1;
        continue;
      }

      let target: TTarget | null;
      try {
        target = job.transform(row);
      } catch (error) {
        if (
          recordError({
            legacyId,
            stage: 'transform',
            message: error instanceof Error ? error.message : String(error),
          })
        ) {
          break;
        }
        continue;
      }
      if (target === null) {
        stats.skipped += 1;
        continue;
      }

      stats.transformed += 1;
      batch.push(target);
      batchLegacyIds.push(legacyId);
      if (batch.length >= batchSize) await flush();
    }
    await flush();

    await runLog.write({
      runId: options.runId,
      phase: job.phase,
      entity: job.entity,
      status: stats.errors.length === 0 ? 'succeeded' : 'failed',
      startedAt,
      finishedAt: new Date(),
      detail: {
        read: stats.read,
        transformed: stats.transformed,
        skipped: stats.skipped,
        loaded: stats.loaded,
        errorCount: stats.errors.length,
        errorSample: stats.errors.slice(0, 10),
      },
    });
  } catch (error) {
    await runLog.write({
      runId: options.runId,
      phase: job.phase,
      entity: job.entity,
      status: 'failed',
      startedAt,
      finishedAt: new Date(),
      detail: { fatal: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }

  return stats;
}
