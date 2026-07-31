import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { assessments, candidates, type Db } from '@bodhi/db';
import type { Env } from '@bodhi/shared-config';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards';
import { DB, ENV } from '../di-tokens';
import { DevSeedService, type DevSeedContext } from './dev-seed.service';

const htmlPath = fileURLToPath(new URL('../../public/dev-ui.html', import.meta.url));

/** Development-only test player; returns 404 in production. */
@Controller('dev')
export class DevUiController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db | null,
    @Inject(DevSeedService) private readonly devSeed: DevSeedService,
  ) {}

  private guardDevOnly(): void {
    if (this.env.NODE_ENV === 'production') throw new NotFoundException();
  }

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  page(): string {
    this.guardDevOnly();
    return readFileSync(htmlPath, 'utf8');
  }

  /**
   * Context the player needs. With Postgres this reads the caller's candidate
   * row and active assessments; in memory mode it returns the boot-time seed.
   */
  @Get('context')
  @UseGuards(JwtAuthGuard)
  async context(@Req() req: AuthenticatedRequest): Promise<DevSeedContext> {
    this.guardDevOnly();
    if (!this.db) return this.devSeed.getContext();

    const candidateRows = await this.db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.userId, req.user!.sub))
      .limit(1);
    const assessmentRows = await this.db
      .select({ id: assessments.id, code: assessments.code, name: assessments.name })
      .from(assessments)
      .where(eq(assessments.isActive, true));
    return { candidateId: candidateRows[0]?.id ?? null, assessments: assessmentRows };
  }
}
