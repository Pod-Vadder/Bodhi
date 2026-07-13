import { Body, Controller, HttpCode, Inject, Post, UseGuards, Req } from '@nestjs/common';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@bodhi/shared-validators';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type AuthenticatedRequest } from './guards';
import { ZodValidationPipe } from '../zod.pipe';
import { AUTH_SERVICE } from '../di-tokens';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
type RefreshInput = z.infer<typeof refreshSchema>;

@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    const user = await this.auth.register({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
    });
    return { id: user.id, email: user.email, role: user.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    const { accessToken, refreshToken, user } = await this.auth.login(body.email, body.password);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput) {
    await this.auth.logout(body.refreshToken);
  }

  @Post('logout-everywhere')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logoutEverywhere(@Req() req: AuthenticatedRequest) {
    await this.auth.logoutEverywhere(req.user!.sub);
  }
}
