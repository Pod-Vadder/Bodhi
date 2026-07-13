import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(200),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(['M', 'F', 'O']),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const startAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
});
export type StartAttemptInput = z.infer<typeof startAttemptSchema>;

/** Autosaved answer; optionId is null when the candidate clears a response. */
export const submitAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid().nullable(),
  clientTimestamp: z.coerce.date(),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
