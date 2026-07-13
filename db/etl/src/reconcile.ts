/**
 * Post-load reconciliation (the migration plan's per-phase exit gate):
 * compares source vs target row counts and optional per-entity checksums,
 * and renders a sign-off report.
 */
export interface ReconcileInput {
  entity: string;
  sourceCount: number;
  targetCount: number;
  /** Rows intentionally skipped by transform rules; counted as accounted-for. */
  expectedSkips?: number;
  sourceChecksum?: string;
  targetChecksum?: string;
}

export interface ReconcileResult extends ReconcileInput {
  countsMatch: boolean;
  checksumsMatch: boolean | null;
  ok: boolean;
}

export function reconcile(inputs: ReconcileInput[]): ReconcileResult[] {
  return inputs.map((input) => {
    const countsMatch = input.sourceCount === input.targetCount + (input.expectedSkips ?? 0);
    const checksumsMatch =
      input.sourceChecksum !== undefined && input.targetChecksum !== undefined
        ? input.sourceChecksum === input.targetChecksum
        : null;
    return { ...input, countsMatch, checksumsMatch, ok: countsMatch && checksumsMatch !== false };
  });
}

export function reconciliationReport(results: ReconcileResult[], runId: string): string {
  const lines = [
    `# Migration reconciliation report`,
    ``,
    `Run: ${runId}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `| Entity | Source | Target | Skips | Counts | Checksum | OK |`,
    `|---|---:|---:|---:|---|---|---|`,
  ];
  for (const r of results) {
    const checksum = r.checksumsMatch === null ? 'n/a' : r.checksumsMatch ? 'match' : 'MISMATCH';
    lines.push(
      `| ${r.entity} | ${r.sourceCount} | ${r.targetCount} | ${r.expectedSkips ?? 0} | ${r.countsMatch ? 'match' : 'MISMATCH'} | ${checksum} | ${r.ok ? '✅' : '❌'} |`,
    );
  }
  const failed = results.filter((r) => !r.ok);
  lines.push(
    ``,
    failed.length === 0
      ? `All ${results.length} entities reconciled.`
      : `${failed.length}/${results.length} entities FAILED reconciliation: ${failed.map((f) => f.entity).join(', ')}`,
  );
  return lines.join('\n') + '\n';
}
