import { describe, expect, it } from 'vitest';
import { registerSchema, submitAnswerSchema } from '../src';

describe('shared validators', () => {
  it('accepts a valid registration', () => {
    const parsed = registerSchema.parse({
      email: 'candidate@example.com',
      password: 'correct-horse',
      fullName: 'A Candidate',
      dateOfBirth: '2009-05-01',
      gender: 'F',
    });
    expect(parsed.dateOfBirth).toBeInstanceOf(Date);
  });

  it('rejects weak passwords and bad genders', () => {
    expect(() =>
      registerSchema.parse({
        email: 'a@b.c',
        password: 'short',
        fullName: 'X',
        dateOfBirth: '2009-05-01',
        gender: 'F',
      }),
    ).toThrow();
    expect(() =>
      registerSchema.parse({
        email: 'a@b.c',
        password: 'long-enough',
        fullName: 'X',
        dateOfBirth: '2009-05-01',
        gender: 'Q',
      }),
    ).toThrow();
  });

  it('allows clearing an answer with a null optionId', () => {
    const parsed = submitAnswerSchema.parse({
      attemptId: '0190e3a0-1111-7000-8000-000000000000',
      questionId: '0190e3a0-2222-7000-8000-000000000000',
      optionId: null,
      clientTimestamp: '2026-07-13T10:00:00Z',
    });
    expect(parsed.optionId).toBeNull();
  });
});
