import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCandidateBindings,
  evaluateRules,
  runCsr,
  scoreAptitude,
  scoreInterests,
  scoreMbti,
  selectPersonalitySet,
  DEFAULT_INTEREST_BANDS,
  DEFAULT_STEN_CLASSIFICATION,
  type AptitudeScore,
  type InterestScore,
  type MbtiResult,
} from '@bodhi/scoring-engine';
import { goldenCaseSchema, type CaseFailure, type CaseReport, type GoldenCase, type SuiteReport } from './types';

function numbersMatch(expected: number, actual: number, tolerance: number): boolean {
  return Math.abs(expected - actual) <= tolerance;
}

export function runCase(raw: unknown): CaseReport {
  let goldenCase: GoldenCase;
  try {
    goldenCase = goldenCaseSchema.parse(raw);
  } catch (error) {
    const id =
      typeof raw === 'object' && raw !== null && 'id' in raw ? String(raw.id) : '<unknown>';
    return {
      caseId: id,
      passed: false,
      failures: [],
      error: `Invalid fixture: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const failures: CaseFailure[] = [];
  const { tolerance, candidate, referenceData, input, expected } = goldenCase;

  try {
    let aptitudeScores: AptitudeScore[] = [];
    if (input.aptitude && referenceData.stenTable) {
      if (candidate.age === undefined) {
        throw new Error('candidate.age is required for aptitude scoring');
      }
      aptitudeScores = scoreAptitude(
        referenceData.stenTable,
        input.aptitude,
        candidate.age,
        referenceData.stenClassification ?? DEFAULT_STEN_CLASSIFICATION,
      );
    }

    let interestScores: InterestScore[] = [];
    if (input.interests) {
      interestScores = scoreInterests(
        input.interests,
        referenceData.interestFormula ?? {},
        referenceData.interestBands ?? DEFAULT_INTEREST_BANDS,
      );
    }

    let mbtiResult: MbtiResult | undefined;
    if (input.mbti) {
      mbtiResult = scoreMbti(input.mbti);
    }

    for (const exp of expected.aptitude ?? []) {
      const actual = aptitudeScores.find((s) => s.scale === exp.scale);
      if (!actual) {
        failures.push({ path: `aptitude.${exp.scale}`, expected: exp, actual: undefined });
        continue;
      }
      if (exp.sten !== undefined && exp.sten !== actual.sten) {
        failures.push({ path: `aptitude.${exp.scale}.sten`, expected: exp.sten, actual: actual.sten });
      }
      if (exp.classification !== undefined && exp.classification !== actual.classification) {
        failures.push({
          path: `aptitude.${exp.scale}.classification`,
          expected: exp.classification,
          actual: actual.classification,
        });
      }
    }

    for (const exp of expected.interests ?? []) {
      const actual = interestScores.find((s) => s.scale === exp.scale);
      if (!actual) {
        failures.push({ path: `interests.${exp.scale}`, expected: exp, actual: undefined });
        continue;
      }
      if (exp.score !== undefined && !numbersMatch(exp.score, actual.score, tolerance)) {
        failures.push({ path: `interests.${exp.scale}.score`, expected: exp.score, actual: actual.score });
      }
      if (exp.classification !== undefined && exp.classification !== actual.classification) {
        failures.push({
          path: `interests.${exp.scale}.classification`,
          expected: exp.classification,
          actual: actual.classification,
        });
      }
    }

    if (expected.mbtiType !== undefined) {
      const actualType = mbtiResult?.type;
      if (actualType !== expected.mbtiType) {
        failures.push({ path: 'mbti.type', expected: expected.mbtiType, actual: actualType });
      }
    }

    if (expected.personalitySet !== undefined) {
      let actualSet: string | undefined;
      if (mbtiResult && referenceData.personalitySets) {
        actualSet = selectPersonalitySet(mbtiResult.type, referenceData.personalitySets).id;
      }
      if (actualSet !== expected.personalitySet) {
        failures.push({ path: 'personalitySet', expected: expected.personalitySet, actual: actualSet });
      }
    }

    const bindings = buildCandidateBindings({
      age: candidate.age,
      gender: candidate.gender,
      aptitude: aptitudeScores,
      interests: interestScores,
      mbti: mbtiResult,
      extra: input.extraContext,
    });

    if (referenceData.careers && (expected.csr || expected.ineligibleCareers)) {
      const { results, rankedByCategory } = runCsr(referenceData.careers, bindings);

      for (const [category, expectedRanking] of Object.entries(expected.csr ?? {})) {
        const actualRanking = rankedByCategory[category] ?? [];
        for (const exp of expectedRanking) {
          const actual = actualRanking.find((c) => c.code === exp.code);
          if (!actual) {
            failures.push({ path: `csr.${category}.${exp.code}`, expected: exp, actual: undefined });
            continue;
          }
          if (exp.rank !== undefined && exp.rank !== actual.rank) {
            failures.push({ path: `csr.${category}.${exp.code}.rank`, expected: exp.rank, actual: actual.rank });
          }
          if (
            exp.correctedTotal !== undefined &&
            !numbersMatch(exp.correctedTotal, actual.correctedTotal, tolerance)
          ) {
            failures.push({
              path: `csr.${category}.${exp.code}.correctedTotal`,
              expected: exp.correctedTotal,
              actual: actual.correctedTotal,
            });
          }
        }
      }

      for (const code of expected.ineligibleCareers ?? []) {
        const actual = results.find((r) => r.code === code);
        if (!actual || actual.eligible) {
          failures.push({
            path: `csr.ineligible.${code}`,
            expected: 'ineligible',
            actual: actual ? 'eligible' : 'missing',
          });
        }
      }
    }

    if (expected.ruleMatches !== undefined) {
      const matches = referenceData.rules ? evaluateRules(referenceData.rules, bindings) : [];
      const actualIds = matches.map((m) => m.id);
      if (JSON.stringify(actualIds) !== JSON.stringify(expected.ruleMatches)) {
        failures.push({ path: 'ruleMatches', expected: expected.ruleMatches, actual: actualIds });
      }
    }
  } catch (error) {
    return {
      caseId: goldenCase.id,
      description: goldenCase.description,
      passed: false,
      failures,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    caseId: goldenCase.id,
    description: goldenCase.description,
    passed: failures.length === 0,
    failures,
  };
}

export async function runDirectory(dir: string): Promise<SuiteReport> {
  const entries = await readdir(dir);
  const files = entries.filter((f) => f.endsWith('.json')).sort();
  const cases: CaseReport[] = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown;
    cases.push(runCase(raw));
  }
  const passed = cases.filter((c) => c.passed).length;
  return { total: cases.length, passed, failed: cases.length - passed, cases };
}
