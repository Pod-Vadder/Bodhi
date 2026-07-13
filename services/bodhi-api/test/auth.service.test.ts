import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { BcryptHasher } from '../src/auth/password';
import { TokenService, parseTtlMs } from '../src/auth/tokens';
import {
  FixedClock,
  InMemoryAuditSink,
  InMemoryRefreshTokenStore,
  InMemoryUserRepo,
} from '../src/auth/memory-adapters';
import {
  AccountDisabledError,
  EmailInUseError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../src/auth/errors';

describe('parseTtlMs', () => {
  it('parses the platform TTL formats', () => {
    expect(parseTtlMs('15m')).toBe(15 * 60_000);
    expect(parseTtlMs('7d')).toBe(7 * 86_400_000);
    expect(parseTtlMs('30s')).toBe(30_000);
    expect(parseTtlMs('12h')).toBe(12 * 3_600_000);
    expect(() => parseTtlMs('soon')).toThrow(/Invalid TTL/);
  });
});

describe('AuthService', () => {
  let users: InMemoryUserRepo;
  let refreshStore: InMemoryRefreshTokenStore;
  let audit: InMemoryAuditSink;
  let clock: FixedClock;
  let tokens: TokenService;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepo();
    refreshStore = new InMemoryRefreshTokenStore();
    audit = new InMemoryAuditSink();
    clock = new FixedClock(new Date('2026-07-13T10:00:00Z'));
    tokens = new TokenService('test-secret', '15m', '7d');
    // Cost 4 keeps the suite fast; production cost comes from BCRYPT_ROUNDS (12).
    service = new AuthService(users, refreshStore, new BcryptHasher(4), tokens, audit, clock);
  });

  const register = () =>
    service.register({ email: 'User@Example.com', password: 'correct-horse', fullName: 'A User' });

  it('registers with a lowercased email and hashed password', async () => {
    const user = await register();
    expect(user.email).toBe('user@example.com');
    expect(user.passwordHash).not.toContain('correct-horse');
    expect(user.role).toBe('candidate');
    expect(audit.entries.at(-1)?.action).toBe('auth.register');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await register();
    await expect(
      service.register({ email: 'USER@example.com', password: 'x'.repeat(10), fullName: 'B' }),
    ).rejects.toThrow(EmailInUseError);
  });

  it('logs in with valid credentials and issues a verifiable access token', async () => {
    await register();
    const result = await service.login('user@example.com', 'correct-horse');
    const payload = tokens.verifyAccessToken(result.accessToken, clock.now().getTime());
    expect(payload.sub).toBe(result.user.id);
    expect(payload.role).toBe('candidate');
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects wrong passwords and unknown users identically', async () => {
    await register();
    await expect(service.login('user@example.com', 'wrong')).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects disabled accounts', async () => {
    const user = await register();
    users.setActive(user.id, false);
    await expect(service.login('user@example.com', 'correct-horse')).rejects.toThrow(
      AccountDisabledError,
    );
  });

  it('rotates refresh tokens: the old token is dead after refresh', async () => {
    await register();
    const { refreshToken } = await service.login('user@example.com', 'correct-horse');

    const pair = await service.refresh(refreshToken);
    expect(pair.refreshToken).not.toBe(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    await expect(service.refresh(pair.refreshToken)).resolves.toBeTruthy();
  });

  it('rejects expired refresh tokens', async () => {
    await register();
    const { refreshToken } = await service.login('user@example.com', 'correct-horse');
    clock.advanceMs(parseTtlMs('7d') + 1);
    await expect(service.refresh(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('logout revokes the presented token; logoutEverywhere revokes all sessions', async () => {
    await register();
    const s1 = await service.login('user@example.com', 'correct-horse');
    const s2 = await service.login('user@example.com', 'correct-horse');

    await service.logout(s1.refreshToken);
    await expect(service.refresh(s1.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    const rotated = await service.refresh(s2.refreshToken);

    await service.logoutEverywhere(s2.user.id);
    await expect(service.refresh(rotated.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('access tokens expire after the access TTL', async () => {
    await register();
    const { accessToken } = await service.login('user@example.com', 'correct-horse');
    const issuedAtMs = clock.now().getTime();

    expect(() => tokens.verifyAccessToken(accessToken, issuedAtMs)).not.toThrow();
    expect(() =>
      tokens.verifyAccessToken(accessToken, issuedAtMs + parseTtlMs('15m') - 1_000),
    ).not.toThrow();
    expect(() =>
      tokens.verifyAccessToken(accessToken, issuedAtMs + parseTtlMs('15m') + 60_000),
    ).toThrow(/expired/);
  });
});
