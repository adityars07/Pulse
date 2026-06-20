import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ILlmProvider,
  LlmStreamResult,
  ConversationTurn,
  StreamCompletionOptions,
} from './llm-provider.interface';

/**
 * OpenAI LLM provider.
 * Handles both chat completions (GPT-4o) and embeddings
 * (text-embedding-3-small).  All other providers delegate
 * embed calls back to this one to keep vector-space consistency.
 */
@Injectable()
export class OpenAIProvider implements ILlmProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL', 'gpt-4o');
    this.embeddingModel = this.configService.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }

  async streamCompletion(
    systemPrompt: string,
    userMessage: string,
    history: ConversationTurn[] = [],
    options: StreamCompletionOptions = {},
  ): Promise<LlmStreamResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userMessage },
    ];

    const oaiStream = await this.client.chat.completions.create({
      model: this.chatModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 1024,
    });

    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const textStream = async function* () {
      for await (const chunk of oaiStream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }
    };

    const modelName = this.chatModel;
    return {
      stream: textStream(),
      getUsage: async () => usage,
      providerName: this.providerName,
      modelName,
    };
  }
}
