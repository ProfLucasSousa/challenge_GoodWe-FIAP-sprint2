import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { AssistantService } from './assistant.service';

class AssistantQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}

@ApiBearerAuth()
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Roles('ADMIN', 'MANAGER')
  @Post('query')
  query(@CurrentUser() actor: AuthenticatedUser, @Body() input: AssistantQueryDto) {
    return this.assistant.query(actor, input.question);
  }
}
