/** Maps legacy integer PKs to target UUIDs; backed by migration.id_map in Postgres. */
export interface IdMapPort {
  get(entity: string, legacyId: number): Promise<string | null>;
  put(entity: string, legacyId: number, newId: string): Promise<void>;
}

export interface RunLogEntry {
  runId: string;
  phase: string;
  entity: string;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  detail?: Record<string, unknown>;
}

export interface RunLogPort {
  write(entry: RunLogEntry): Promise<void>;
}

export interface RowError {
  legacyId: number | null;
  stage: 'transform' | 'load';
  message: string;
}

export interface EtlStats {
  entity: string;
  read: number;
  transformed: number;
  skipped: number;
  loaded: number;
  errors: RowError[];
}

/**
 * One migration job per legacy entity. `extract` streams source rows,
 * `transform` maps one row to the target shape (null = intentional skip),
 * `load` persists a batch and returns the assigned target IDs so the
 * runner can record legacy->new mappings.
 */
export interface EtlJob<TSource, TTarget> {
  entity: string;
  /** Migration phase M1-M5 this job belongs to. */
  phase: string;
  legacyIdOf(row: TSource): number;
  extract(): AsyncIterable<TSource>;
  transform(row: TSource): TTarget | null;
  load(batch: TTarget[]): Promise<string[]>;
}
