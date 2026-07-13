import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConnectionPool } from 'mssql';
import { OUTPUT_ROOT } from './config';

export interface ColumnInfo {
  table: string;
  column: string;
  ordinal: number;
  dataType: string;
  maxLength: number | null;
  nullable: boolean;
  default: string | null;
}

export interface TableInventory {
  schema: string;
  table: string;
  rowCount: number;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: { column: string; referencesTable: string; referencesColumn: string }[];
}

/** D-02: full table/column/PK/FK inventory plus row counts, written as JSON + a review-friendly markdown summary. */
export async function extractSchema(pool: ConnectionPool): Promise<TableInventory[]> {
  const columns = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE,
           CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`);

  const primaryKeys = await pool.request().query(`
    SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'`);

  const foreignKeys = await pool.request().query(`
    SELECT s1.name AS table_schema, t1.name AS table_name, c1.name AS column_name,
           t2.name AS ref_table, c2.name AS ref_column
    FROM sys.foreign_key_columns fkc
    JOIN sys.tables t1 ON fkc.parent_object_id = t1.object_id
    JOIN sys.schemas s1 ON t1.schema_id = s1.schema_id
    JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
    JOIN sys.tables t2 ON fkc.referenced_object_id = t2.object_id
    JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id`);

  const rowCounts = await pool.request().query(`
    SELECT s.name AS table_schema, t.name AS table_name, SUM(p.rows) AS row_count
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
    GROUP BY s.name, t.name`);

  const tables = new Map<string, TableInventory>();
  const keyOf = (schema: string, table: string) => `${schema}.${table}`;

  for (const row of rowCounts.recordset) {
    tables.set(keyOf(row.table_schema, row.table_name), {
      schema: row.table_schema,
      table: row.table_name,
      rowCount: Number(row.row_count),
      columns: [],
      primaryKey: [],
      foreignKeys: [],
    });
  }
  for (const row of columns.recordset) {
    tables.get(keyOf(row.TABLE_SCHEMA, row.TABLE_NAME))?.columns.push({
      table: row.TABLE_NAME,
      column: row.COLUMN_NAME,
      ordinal: row.ORDINAL_POSITION,
      dataType: row.DATA_TYPE,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      nullable: row.IS_NULLABLE === 'YES',
      default: row.COLUMN_DEFAULT,
    });
  }
  for (const row of primaryKeys.recordset) {
    tables.get(keyOf(row.TABLE_SCHEMA, row.TABLE_NAME))?.primaryKey.push(row.COLUMN_NAME);
  }
  for (const row of foreignKeys.recordset) {
    tables.get(keyOf(row.table_schema, row.table_name))?.foreignKeys.push({
      column: row.column_name,
      referencesTable: row.ref_table,
      referencesColumn: row.ref_column,
    });
  }
  return [...tables.values()].sort((a, b) => keyOf(a.schema, a.table).localeCompare(keyOf(b.schema, b.table)));
}

export function schemaMarkdown(inventory: TableInventory[]): string {
  const lines = ['# Legacy schema inventory (D-02)', ''];
  lines.push(`Tables: ${inventory.length}`, '');
  lines.push('| Table | Rows | Columns | PK | FKs |');
  lines.push('|---|---:|---:|---|---:|');
  for (const t of inventory) {
    lines.push(
      `| ${t.schema}.${t.table} | ${t.rowCount} | ${t.columns.length} | ${t.primaryKey.join(', ') || '—'} | ${t.foreignKeys.length} |`,
    );
  }
  return lines.join('\n') + '\n';
}

export async function writeSchemaOutputs(inventory: TableInventory[]): Promise<void> {
  const dir = path.join(OUTPUT_ROOT, 'schema');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'inventory.json'), JSON.stringify(inventory, null, 2));
  await writeFile(path.join(dir, 'inventory.md'), schemaMarkdown(inventory));
}
