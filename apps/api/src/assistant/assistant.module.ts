import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { DeterministicAssistant } from './deterministic-assistant';
import { IntelligenceContextService } from './intelligence-context.service';

@Module({
  imports: [IntelligenceModule],
  controllers: [AssistantController],
  providers: [AssistantService, IntelligenceContextService, DeterministicAssistant],
})
export class AssistantModule {}
