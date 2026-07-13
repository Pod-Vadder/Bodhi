import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, UseGuards, Req } from '@nestjs/common';
import { startAttemptSchema, submitAnswerSchema } from '@bodhi/shared-validators';
import { z } from 'zod';
import { AttemptService } from './attempt.service';
import { JwtAuthGuard, Roles, RolesGuard, type AuthenticatedRequest } from '../auth/guards';
import { ZodValidationPipe } from '../zod.pipe';
import { ATTEMPT_SERVICE } from '../di-tokens';

const startBodySchema = startAttemptSchema.extend({ candidateId: z.string().uuid() });
const answerBodySchema = submitAnswerSchema.omit({ attemptId: true });

@Controller('attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestEngineController {
  constructor(@Inject(ATTEMPT_SERVICE) private readonly attempts: AttemptService) {}

  @Post()
  @Roles('candidate', 'admin')
  async start(
    @Body(new ZodValidationPipe(startBodySchema)) body: z.infer<typeof startBodySchema>,
    @Req() _req: AuthenticatedRequest,
  ) {
    const attempt = await this.attempts.startAttempt(body.candidateId, body.assessmentId);
    return { id: attempt.id, attemptNumber: attempt.attemptNumber, status: attempt.status };
  }

  @Get(':id/current-module')
  @Roles('candidate', 'admin')
  async currentModule(@Param('id') id: string) {
    const view = await this.attempts.currentModule(id);
    return {
      moduleId: view.module.id,
      sequence: view.module.sequence,
      durationSeconds: view.module.durationSeconds,
      status: view.progress.status,
      timeLeftMs: view.timeLeftMs,
    };
  }

  @Get(':id/questions')
  @Roles('candidate', 'admin')
  questions(@Param('id') id: string) {
    return this.attempts.questionsForCurrentModule(id);
  }

  @Put(':id/answers')
  @HttpCode(204)
  @Roles('candidate', 'admin')
  async answer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(answerBodySchema)) body: z.infer<typeof answerBodySchema>,
  ) {
    await this.attempts.saveAnswer(id, body.questionId, body.optionId);
  }

  @Post(':id/submit-module')
  @Roles('candidate', 'admin')
  submit(@Param('id') id: string) {
    return this.attempts.submitCurrentModule(id);
  }

  @Get(':id/timer')
  @Roles('candidate', 'admin')
  async timer(@Param('id') id: string) {
    return { timeLeftMs: await this.attempts.timeLeftMs(id) };
  }
}
