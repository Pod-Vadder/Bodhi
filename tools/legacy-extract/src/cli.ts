import process from 'node:process';
import mssql from 'mssql';
import { legacyDbConfig } from './config';
import { extractSchema, writeSchemaOutputs } from './extract-schema';
import { extractProcs } from './extract-procs';
import { extractReferenceData } from './extract-reference';

const USAGE = `Usage: npm run legacy:extract -- <schema|procs|reference|all>

Requires LEGACY_SQLSERVER_{HOST,USER,PASSWORD,DATABASE} in the environment.
Output is written under db/legacy/.`;

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (!mode || !['schema', 'procs', 'reference', 'all'].includes(mode)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const pool = await mssql.connect(legacyDbConfig());
  try {
    if (mode === 'schema' || mode === 'all') {
      const inventory = await extractSchema(pool);
      await writeSchemaOutputs(inventory);
      console.log(`schema: ${inventory.length} tables -> db/legacy/schema/`);
    }
    if (mode === 'procs' || mode === 'all') {
      const procs = await extractProcs(pool);
      const flagged = procs.filter((p) => p.flags.length > 0).length;
      console.log(`procs: ${procs.length} dumped (${flagged} flagged for FLFS priority) -> db/legacy/procs/`);
    }
    if (mode === 'reference' || mode === 'all') {
      const results = await extractReferenceData(pool);
      for (const r of results) {
        console.log(`reference: ${r.table} — ${r.status}${r.rows !== undefined ? ` (${r.rows} rows)` : ''}${r.error ? ` (${r.error})` : ''}`);
      }
    }
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
