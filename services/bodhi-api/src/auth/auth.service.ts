import type { UserRole } from '@bodhi/shared-types';
import {
  AccountDisabledError,
  EmailInUseError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from './errors';
import type { AuditSink, Clock, RefreshTokenStore, UserRecord, UserRepo } from './ports';
import type { PasswordHasher } from './password';
import { TokenService } from './tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export class AuthService {
  constructor(
    private readonly users: UserRepo,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly audit: AuditSink,
    private readonly clock: Clock,
  ) {}

  async register(input: RegisterInput): Promise<UserRecord> {
    const email = input.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new EmailInUseError(email);
    }
    const user = await this.users.create({
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: input.role ?? 'candidate',
      fullName: input.fullName,
    });
    await this.audit.record({ actorId: user.id, action: 'auth.register', entity: 'user', entityId: user.id });
    return user;
  }

  async login(email: string, password: string): Promise<TokenPair & { user: UserRecord }> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user || !(await this.hasher.verify(password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    if (!user.isActive) throw new AccountDisabledError();

    const pair = await this.issuePair(user);
    await this.audit.record({ actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id });
    return { ...pair, user };
  }

  /** Rotation: the presented refresh token is revoked and a fresh pair issued. A revoked/unknown token is rejected. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = this.clock.now();
    const hash = TokenService.hashToken(refreshToken);
    const found = await this.refreshTokens.findValid(hash, now);
    if (!found) throw new InvalidRefreshTokenError();

    const user = await this.users.findById(found.userId);
    if (!user || !user.isActive) throw new InvalidRefreshTokenError();

    await this.refreshTokens.revoke(hash);
    const pair = await this.issuePair(user);
    await this.audit.record({ actorId: user.id, action: 'auth.refresh', entity: 'user', entityId: user.id });
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(TokenService.hashToken(refreshToken));
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.record({ actorId: userId, action: 'auth.logout_everywhere', entity: 'user', entityId: userId });
  }

  private async issuePair(user: UserRecord): Promise<TokenPair> {
    const now = this.clock.now();
    const accessToken = this.tokens.signAccessToken(
      { sub: user.id, role: user.role, email: user.email },
      now.getTime(),
    );
    const refreshToken = this.tokens.newRefreshToken();
    await this.refreshTokens.save(
      user.id,
      TokenService.hashToken(refreshToken),
      new Date(now.getTime() + this.tokens.refreshTtlMs),
    );
    return { accessToken, refreshToken };
  }
}
