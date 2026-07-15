/**
 * Seeds a runnable local demo: one candidate login and one two-module
 * assessment with questions. Idempotent — safe to re-run. Prints the IDs
 * and credentials needed to drive the API.
 *
 *   docker compose up -d postgres redis   (or native services)
 *   npx tsx services/bodhi-api/scripts/seed-demo.ts
 *   PERSISTENCE=postgres npm run api:dev
 */
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
  assessmentModules,
  assessments,
  candidates,
  createDb,
  questionOptions,
  questions,
  questionSets,
  runMigrations,
  users,
} from '@bodhi/db';

const DEMO_EMAIL = 'demo.candidate@bodhi.local';
const DEMO_PASSWORD = 'demo-pass-123';

const { db, pool } = createDb(
  process.env.DATABASE_URL ?? 'postgres://bodhi:bodhi@localhost:5432/bodhi',
);
await runMigrations(db, fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)));

let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
if (!user) {
  [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      role: 'candidate',
      fullName: 'Demo Candidate',
    })
    .returning();
}

let [candidateRow] = await db.select().from(candidates).where(eq(candidates.userId, user!.id));
if (!candidateRow) {
  [candidateRow] = await db
    .insert(candidates)
    .values({ userId: user!.id, dateOfBirth: '2009-05-01', gender: 'F' })
    .returning();
}

let [assessment] = await db.select().from(assessments).where(eq(assessments.code, 'DEMO-A1'));
if (!assessment) {
  [assessment] = await db
    .insert(assessments)
    .values({ code: 'DEMO-A1', name: 'Demo Career Assessment' })
    .returning();

  const moduleSpecs = [
    { code: 'DEMO-APT', name: 'Aptitude (demo)', kind: 'aptitude', durationSeconds: 300 },
    { code: 'DEMO-INT', name: 'Interest (demo)', kind: 'interest', durationSeconds: 180 },
  ];
  let sequence = 0;
  for (const spec of moduleSpecs) {
    sequence += 1;
    const [set] = await db
      .insert(questionSets)
      .values({ code: spec.code, name: spec.name, kind: spec.kind })
      .returning();
    for (let i = 1; i <= 4; i += 1) {
      const [q] = await db
        .insert(questions)
        .values({ questionSetId: set!.id, text: `${spec.name} — question ${i}?`, orderIndex: i })
        .returning();
      await db.insert(questionOptions).values([
        { questionId: q!.id, label: 'Agree', value: 1, orderIndex: 1 },
        { questionId: q!.id, label: 'Neutral', value: 0, orderIndex: 2 },
        { questionId: q!.id, label: 'Disagree', value: -1, orderIndex: 3 },
      ]);
    }
    await db.insert(assessmentModules).values({
      assessmentId: assessment!.id,
      questionSetId: set!.id,
      sequence,
      durationSeconds: spec.durationSeconds,
    });
  }
}

console.log(
  JSON.stringify(
    {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      candidateId: candidateRow!.id,
      assessmentId: assessment!.id,
    },
    null,
    2,
  ),
);
await pool.end();
