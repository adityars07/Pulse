import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { RetrievalService } from './retrieval.service';
import { LlmService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AuthModule } from '../auth/auth.module';
import { GuardrailModule } from '../guardrail/guardrail.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [KnowledgeModule, AuthModule, GuardrailModule],
  controllers: [ChatController],
  providers: [
    // LLM providers (order matters: AnthropicProvider depends on OpenAIProvider)
    OpenAIProvider,
    AnthropicProvider,
    // Orchestrator and services
    LlmService,
    RetrievalService,
    ChatService,
    ChatGateway,
  ],
  exports: [ChatService, RetrievalService, LlmService],
})
export class ChatModule {}
