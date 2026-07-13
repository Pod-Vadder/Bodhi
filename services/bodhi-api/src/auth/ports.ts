import type { UserRole } from '@bodhi/shared-types';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string | null;
  isActive: boolean;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string | null;
}

export interface UserRepo {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
}

export interface RefreshTokenStore {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Returns the owning user only when the token exists, is unrevoked, and unexpired at `now`. */
  findValid(tokenHash: string, now: Date): Promise<{ userId: string } | null>;
  revoke(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const SYSTEM_CLOCK: Clock = { now: () => new Date() };
