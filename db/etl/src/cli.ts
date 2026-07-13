import process from 'node:process';

/**
 * ETL job registry. Concrete jobs are added per entity as the M1-M5 phases
 * are implemented (they need the D-02 schema inventory to define source
 * queries). The framework (runner, id-map, run-log, reconciliation) is
 * complete and tested; see db/etl/test/.
 */
const REGISTERED_JOBS: string[] = [];

function main(): void {
  if (REGISTERED_JOBS.length === 0) {
    console.log('No ETL jobs registered yet.');
    console.log('Jobs are added per entity once the D-02 legacy schema inventory lands');
    console.log('(run `npm run legacy:extract -- schema` against the Dev DB first).');
    return;
  }
  console.log(`Registered jobs: ${REGISTERED_JOBS.join(', ')}`);
}

main();
process.exitCode = 0;
