import { randomUUID } from 'node:crypto';
import type {
  AuditEntry,
  AuditSink,
  CreateUserInput,
  RefreshTokenStore,
  UserRecord,
  UserRepo,
} from './ports';

/** In-memory persistence for tests and DB-less dev mode (PERSISTENCE=memory). */
export class InMemoryUserRepo implements UserRepo {
  private readonly byId = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.byId.values()].find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = { id: randomUUID(), isActive: true, ...input };
    this.byId.set(user.id, user);
    return user;
  }

  /** Test helper. */
  setActive(id: string, isActive: boolean): void {
    const user = this.byId.get(id);
    if (user) user.isActive = isActive;
  }
}

interface StoredRefreshToken {
  userId: string;
  expiresAt: Date;
  revoked: boolean;
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly byHash = new Map<string, StoredRefreshToken>();

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.byHash.set(tokenHash, { userId, expiresAt, revoked: false });
  }

  async findValid(tokenHash: string, now: Date): Promise<{ userId: string } | null> {
    const stored = this.byHash.get(tokenHash);
    if (!stored || stored.revoked || stored.expiresAt <= now) return null;
    return { userId: stored.userId };
  }

  async revoke(tokenHash: string): Promise<void> {
    const stored = this.byHash.get(tokenHash);
    if (stored) stored.revoked = true;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const stored of this.byHash.values()) {
      if (stored.userId === userId) stored.revoked = true;
    }
  }
}

export class InMemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class FixedClock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(date: Date): void {
    this.current = date;
  }
}
