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
import { AgentModule } from '../agent/agent.module';
import { BillingModule } from '../billing/billing.module';
import { ChatController } from './chat.controller';
import { CopilotService } from './copilot.service';

@Module({
  imports: [KnowledgeModule, AuthModule, GuardrailModule, AgentModule, BillingModule],
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
    CopilotService,
  ],
  exports: [ChatService, RetrievalService, LlmService, CopilotService],
})
export class ChatModule {}
