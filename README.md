# Bodhi Re-platform Monorepo

Target-stack rebuild of the Bodhi career-assessment platform (legacy ASP.NET WebForms/MVC + SQL Server → TypeScript monorepo + Postgres), following the BRD functional spec and the migration implementation plan v1.1.

## Layout

| Path | Package | Status |
|---|---|---|
| `packages/scoring-engine` | `@bodhi/scoring-engine` — pure, I/O-free port of all legacy scoring: sten/aptitude, interest, MBTI, CSR pipeline, wide-condition rules, sandboxed expression evaluator (NCalc replacement) | **Built, unit-tested** |
| `packages/golden-master` | `@bodhi/golden-master` — fidelity harness + fixture format; ships with synthetic fixtures | **Built** (real fixtures land with D-04/D-07 data) |
| `packages/db` | `@bodhi/db` — Drizzle schema v1: `core`, `candidate`, `question_bank`, `assessment`, `commerce`, `counseling`, `billing`, `files`, `audit`, `migration` Postgres schemas; UUID v7 PKs; `legacy_id` traceability everywhere | **Built** |
| `packages/shared-config` | Validated env contract (timer policy, payment gateway, JWT TTLs, attempt limit) | **Built** |
| `packages/shared-types` / `packages/shared-validators` | Cross-cutting domain types and zod request schemas | **Built** |
| `services/bodhi-api` | NestJS API — **auth** (JWT 15m/7d + rotation, bcrypt, RBAC guards, audit sink) and **test-engine core** (server-authoritative timer with D-27 policies, BR-12 attempt lock, BR-13 module sequencing, seeded question randomization, autosave) over framework-free domain services with in-memory adapters; Drizzle/Redis adapters land with P1 DB wiring | **Built, unit-tested, boots** |
| `tools/legacy-extract` | D-02/D-03/D-04 extraction CLI (schema inventory, SP dump with FLFS-priority flags, reference-data export) — run against the legacy Dev SQL Server | **Built** (needs Dev DB access to run) |
| `db/etl` | M1–M5 ETL framework: batched runner with idempotent legacy-ID mapping, run log, reconciliation reporter | **Built, unit-tested** (per-entity jobs land after D-02) |
| `apps/bodhi-web` | Next.js portals | P2 placeholder |

## Quickstart

```bash
npm install
docker compose up -d        # postgres, redis, minio, mailpit
npm run typecheck
npm test                    # unit tests
npm run coverage            # with the ≥90% scoring-engine gate
npm run gm                  # golden-master run over synthetic fixtures
npm run db:generate         # emit SQL migrations from the Drizzle schema
npm run api:dev             # boot the API (in-memory persistence, port 3001)
npm run etl                 # ETL job registry (jobs land after D-02)
npm run legacy:extract -- all   # run against the legacy Dev DB (needs LEGACY_SQLSERVER_* env)
```

## Scoring engine

Everything is **data-driven**: the engine implements the legacy algorithms; sten tables, L/M/H cut-offs, P1–P5 set membership, career definitions, and wide rules are reference data injected at call time. Defaults marked *placeholder* are pending the D-04 reference-data extraction from the legacy Dev DB.

- **Aptitude** — raw → sten via age-banded lookup table → L/M/H classification.
- **Interest** — `(sum of responses / 15) × 10`, then banded L/M/H.
- **MBTI** — per-dichotomy counts; ties resolve to the second letter (I/N/F/P); P1–P5 personality-set selection by type membership.
- **CSR** — eligibility filter (≤5 criteria) → aptitude/interest/personality fit expressions → weighted base total → conditional correction deltas → corrected total → per-category ranking (deterministic tie-break by career code).
- **Wide rules** — generalized EMQ/RF/SE condition rows: `when` expression → result payload, priority-ordered, first/all modes.
- **Expression evaluator** — safe replacement for NCalc: no `eval`, whitelisted functions (`ABS MIN MAX ROUND FLOOR CEIL IF IN BETWEEN`), case-insensitive identifiers covering all legacy token classes (`WS1-10`, `OC1-26`, `I001-I108`, `P001-P072`, MBTI letters, `AGE`, `GENDER`), strict type errors, clear syntax/eval diagnostics.

## Golden-master harness

`packages/golden-master/fixtures/` holds JSON cases: candidate demographics + raw answers + reference data + expected outputs. The runner replays them through the engine and diffs with numeric tolerance. When the legacy reference dump (D-04) and the 18 legacy report samples (D-07) arrive, drop them in as fixtures — zero harness rework. Until then, synthetic fixtures keep the pipeline exercised in CI.

## Pinned decisions

- **D-27 timer policy**: server-authoritative, `keep-running` across disconnects with a 45 s reconnect grace (configurable: `TIMER_DISCONNECT_POLICY`, `TIMER_RECONNECT_GRACE_SECONDS`).
- **D-09 payments**: CCAvenue is the build target behind the payment adapter; Razorpay is a swap-later implementation (`PAYMENT_GATEWAY`).
- **BR-12**: attempt lock at 3 (`MAX_ATTEMPTS_PER_ASSESSMENT`).
- **Auth contract**: JWT access 15 m / refresh 7 d, bcrypt cost 12.

## Blocked on external inputs

- **D-02/D-03/D-04** — legacy Dev DB schema/SP/reference-data extraction (scripts to be run against the Dev server; output lands in `db/`).
- **FLFS (P0.5)** — requires the legacy SVN source upload; gates portal feature work (P2–P6).
- **Golden-master certification** — needs real reference data + legacy answer rows; the harness is ready for them.
