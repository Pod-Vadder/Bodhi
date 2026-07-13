import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConnectionPool } from 'mssql';
import { OUTPUT_ROOT } from './config';

/**
 * D-04: scoring reference data. Table names below are the expected legacy
 * candidates; adjust REFERENCE_TABLES after the D-02 inventory confirms the
 * real names — unknown tables are reported and skipped, not fatal.
 * Every table listed here feeds golden-master fixtures and the target seed.
 */
export const REFERENCE_TABLES = [
  'StenScores',
  'StenLookup',
  'AgeBands',
  'InterestScales',
  'PersonalityTypes',
  'PersonalitySets',
  'Careers',
  'CareerCategories',
  'CareerCriteria',
  'CareerCorrections',
  'Questions',
  'QuestionOptions',
  'ExpressionRules',
];

export interface ReferenceExtractResult {
  table: string;
  status: 'exported' | 'missing' | 'error';
  rows?: number;
  error?: string;
}

export async function extractReferenceData(
  pool: ConnectionPool,
  tables: string[] = REFERENCE_TABLES,
): Promise<ReferenceExtractResult[]> {
  const dir = path.join(OUTPUT_ROOT, 'reference');
  await mkdir(dir, { recursive: true });

  const results: ReferenceExtractResult[] = [];
  for (const table of tables) {
    if (!/^[A-Za-z0-9_.]+$/.test(table)) {
      results.push({ table, status: 'error', error: 'Invalid table name' });
      continue;
    }
    try {
      const exists = await pool
        .request()
        .input('table', table)
        .query(`SELECT OBJECT_ID(@table, 'U') AS id`);
      if (!exists.recordset[0]?.id) {
        results.push({ table, status: 'missing' });
        continue;
      }
      const data = await pool.request().query(`SELECT * FROM [${table.replace(/\./g, '].[')}]`);
      await writeFile(
        path.join(dir, `${table}.json`),
        JSON.stringify(data.recordset, null, 2),
      );
      results.push({ table, status: 'exported', rows: data.recordset.length });
    } catch (error) {
      results.push({
        table,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  await writeFile(path.join(dir, '_extract-report.json'), JSON.stringify(results, null, 2));
  return results;
}
