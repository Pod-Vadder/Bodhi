/** Low / Medium / High classification used across aptitude and interest scoring. */
export type Classification = 'L' | 'M' | 'H';

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoringError';
  }
}
