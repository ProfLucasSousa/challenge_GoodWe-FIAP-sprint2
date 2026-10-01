import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { DeterministicAssistant, type AssistantAnswer } from './deterministic-assistant';
import { IntelligenceContextService } from './intelligence-context.service';

@Injectable()
export class AssistantService {
  constructor(
    private readonly context: IntelligenceContextService,
    private readonly deterministic: DeterministicAssistant,
  ) {}

  async query(actor: AuthenticatedUser, question: string): Promise<AssistantAnswer> {
    const authorizedContext = await this.context.forManager(actor);
    return this.deterministic.answer(question, authorizedContext);
  }
}
