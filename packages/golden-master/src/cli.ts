import path from 'node:path';
import process from 'node:process';
import { runDirectory } from './runner';

async function main(): Promise<void> {
  const dir = process.argv[2] ?? path.join('packages', 'golden-master', 'fixtures', 'synthetic');
  const report = await runDirectory(path.resolve(dir));

  if (report.total === 0) {
    console.error(`No fixtures found in ${dir}`);
    process.exitCode = 1;
    return;
  }

  for (const c of report.cases) {
    const status = c.passed ? 'PASS' : 'FAIL';
    console.log(`${status}  ${c.caseId}${c.description ? `  — ${c.description}` : ''}`);
    if (c.error) {
      console.log(`      error: ${c.error}`);
    }
    for (const failure of c.failures) {
      console.log(
        `      ${failure.path}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`,
      );
    }
  }
  console.log(`\n${report.passed}/${report.total} golden-master cases passed`);
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
