import { ScoringError, type Classification } from '../types';

/**
 * One row of the legacy sten conversion table: a raw-score range maps to a
 * sten (1-10) for a given aptitude scale and age band. The real table is
 * reference data extracted from the legacy DB (D-04); the engine only
 * implements the lookup.
 */
export interface StenBand {
  scale: string;
  ageMin: number;
  ageMax: number;
  rawMin: number;
  rawMax: number;
  sten: number;
}

/** Inclusive sten ranges for L/M/H. Values are reference data; these defaults are placeholders pending D-04. */
export interface StenClassificationBands {
  low: [number, number];
  medium: [number, number];
  high: [number, number];
}

export const DEFAULT_STEN_CLASSIFICATION: StenClassificationBands = {
  low: [1, 3],
  medium: [4, 7],
  high: [8, 10],
};

export interface AptitudeInput {
  scale: string;
  raw: number;
}

export interface AptitudeScore {
  scale: string;
  raw: number;
  sten: number;
  classification: Classification;
}

export function lookupSten(table: StenBand[], scale: string, age: number, raw: number): number {
  const scaleUpper = scale.toUpperCase();
  const matches = table.filter(
    (b) =>
      b.scale.toUpperCase() === scaleUpper &&
      age >= b.ageMin &&
      age <= b.ageMax &&
      raw >= b.rawMin &&
      raw <= b.rawMax,
  );
  if (matches.length === 0) {
    throw new ScoringError(`No sten band for scale=${scale}, age=${age}, raw=${raw}`);
  }
  const stens = new Set(matches.map((m) => m.sten));
  if (stens.size > 1) {
    throw new ScoringError(
      `Ambiguous sten bands for scale=${scale}, age=${age}, raw=${raw}: ${[...stens].join(', ')}`,
    );
  }
  return matches[0]!.sten;
}

export function classifySten(
  sten: number,
  bands: StenClassificationBands = DEFAULT_STEN_CLASSIFICATION,
): Classification {
  if (sten >= bands.low[0] && sten <= bands.low[1]) return 'L';
  if (sten >= bands.medium[0] && sten <= bands.medium[1]) return 'M';
  if (sten >= bands.high[0] && sten <= bands.high[1]) return 'H';
  throw new ScoringError(`Sten ${sten} falls outside every classification band`);
}

export function scoreAptitude(
  table: StenBand[],
  inputs: AptitudeInput[],
  age: number,
  bands: StenClassificationBands = DEFAULT_STEN_CLASSIFICATION,
): AptitudeScore[] {
  return inputs.map(({ scale, raw }) => {
    const sten = lookupSten(table, scale, age, raw);
    return { scale, raw, sten, classification: classifySten(sten, bands) };
  });
}
