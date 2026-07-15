import { and, eq, gt, isNull } from 'drizzle-orm';
import { auditLog, refreshTokens, users, type Db } from '@bodhi/db';
import type {
  AuditEntry,
  AuditSink,
  CreateUserInput,
  RefreshTokenStore,
  UserRecord,
  UserRepo,
} from '../auth/ports';

type UserRow = typeof users.$inferSelect;

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role,
  fullName: row.fullName,
  isActive: row.isActive,
});

export class DrizzleUserRepo implements UserRepo {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const rows = await this.db.insert(users).values(input).returning();
    return toRecord(rows[0]!);
  }
}

export class DrizzleRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly db: Db) {}

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  }

  async findValid(tokenHash: string, now: Date): Promise<{ userId: string } | null> {
    const rows = await this.db
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}

export class DrizzleAuditSink implements AuditSink {
  constructor(private readonly db: Db) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      after: entry.detail,
    });
  }
}
