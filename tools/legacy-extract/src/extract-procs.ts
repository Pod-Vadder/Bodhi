import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConnectionPool } from 'mssql';
import { OUTPUT_ROOT } from './config';

export interface ProcInfo {
  schema: string;
  name: string;
  created: string;
  modified: string;
  lines: number;
  /** Heuristic flags to prioritise FLFS reading: which scoring artefacts the body references. */
  flags: string[];
}

const FLAG_PATTERNS: Array<[string, RegExp]> = [
  ['sten', /sten/i],
  ['interest', /interest/i],
  ['personality', /personality|mbti/i],
  ['csr', /suitab|career/i],
  ['ncalc-expression', /expression|formula|ncalc/i],
  ['payment', /payment|ccavenue|razorpay/i],
  ['dynamic-sql', /exec\s*\(|sp_executesql/i],
];

export function classifyProcBody(body: string): string[] {
  return FLAG_PATTERNS.filter(([, pattern]) => pattern.test(body)).map(([flag]) => flag);
}

/** D-03: dump every stored procedure body to db/legacy/procs/ plus a prioritised inventory. */
export async function extractProcs(pool: ConnectionPool): Promise<ProcInfo[]> {
  const result = await pool.request().query(`
    SELECT s.name AS schema_name, p.name AS proc_name, m.definition,
           p.create_date, p.modify_date
    FROM sys.procedures p
    JOIN sys.schemas s ON p.schema_id = s.schema_id
    JOIN sys.sql_modules m ON p.object_id = m.object_id
    ORDER BY s.name, p.name`);

  const dir = path.join(OUTPUT_ROOT, 'procs');
  await mkdir(dir, { recursive: true });

  const inventory: ProcInfo[] = [];
  for (const row of result.recordset) {
    const body: string = row.definition ?? '';
    const fileName = `${row.schema_name}.${row.proc_name}.sql`;
    await writeFile(path.join(dir, fileName), body);
    inventory.push({
      schema: row.schema_name,
      name: row.proc_name,
      created: new Date(row.create_date).toISOString(),
      modified: new Date(row.modify_date).toISOString(),
      lines: body.split('\n').length,
      flags: classifyProcBody(body),
    });
  }
  await writeFile(path.join(dir, 'inventory.json'), JSON.stringify(inventory, null, 2));
  return inventory;
}
