import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { AssistantService } from './assistant.service';
import type { DeterministicAssistant } from './deterministic-assistant';
import type { IntelligenceContextService } from './intelligence-context.service';

describe('AssistantService', () => {
  it('passes only the authorized aggregate context to the responder', async () => {
    const actor: AuthenticatedUser = {
      sub: 'manager',
      email: 'manager@example.invalid',
      role: 'MANAGER',
      unitId: 'unit',
    };
    const aggregateContext = { scope: { type: 'UNIT' } };
    const context = {
      forManager: jest.fn().mockResolvedValue(aggregateContext),
    } as unknown as IntelligenceContextService;
    const deterministic = {
      answer: jest.fn().mockReturnValue({ answer: 'Resposta', sources: [] }),
    } as unknown as DeterministicAssistant;
    const service = new AssistantService(context, deterministic);

    await service.query(actor, 'Qual o pico?');

    expect(context.forManager).toHaveBeenCalledWith(actor);
    expect(deterministic.answer).toHaveBeenCalledWith('Qual o pico?', aggregateContext);
  });
});
