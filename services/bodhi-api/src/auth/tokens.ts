import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@bodhi/shared-types';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

/** '15m' | '7d' | '30s' | '12h' -> milliseconds. */
export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) throw new Error(`Invalid TTL '${ttl}' — expected e.g. 15m, 7d`);
  const value = Number(match[1]);
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
}

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly accessTtl: string,
    private readonly refreshTtl: string,
  ) {}

  get refreshTtlMs(): number {
    return parseTtlMs(this.refreshTtl);
  }

  signAccessToken(payload: AccessTokenPayload, nowMs: number): string {
    const expSeconds = Math.floor((nowMs + parseTtlMs(this.accessTtl)) / 1000);
    return jwt.sign({ ...payload, exp: expSeconds }, this.secret, { algorithm: 'HS256' });
  }

  verifyAccessToken(token: string, nowMs?: number): AccessTokenPayload {
    const decoded = jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
      ...(nowMs !== undefined ? { clockTimestamp: Math.floor(nowMs / 1000) } : {}),
    });
    if (typeof decoded === 'string') throw new Error('Unexpected token payload');
    return decoded as unknown as AccessTokenPayload;
  }

  /** Opaque refresh token; only its SHA-256 hash is ever persisted. */
  newRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
