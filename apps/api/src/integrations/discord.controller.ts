import { Controller, Post, Req, Res, Param, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

@Controller('integrations/discord')
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  @Post('webhook/:tenantId')
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ) {
    // 1. Fetch tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      this.logger.error(`Tenant ${tenantId} not found`);
      throw new NotFoundException('Tenant not found');
    }

    const settings = (tenant.settings as any) || {};
    const publicKeyHex = settings.discordPublicKey;

    if (!publicKeyHex) {
      this.logger.error(`Discord settings missing for tenant ${tenantId}`);
      throw new BadRequestException('Discord integration not configured');
    }

    // 2. Validate Discord signature
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const rawBody = req.rawBody;

    if (!signature || !timestamp || !rawBody) {
      this.logger.warn('Discord signature or timestamp header missing');
      throw new BadRequestException('Missing signature headers');
    }

    const isVerified = this.verifyDiscordSignature(publicKeyHex, rawBody, timestamp, signature);
    if (!isVerified) {
      this.logger.warn('Discord signature verification failed');
      throw new BadRequestException('Invalid signature');
    }

    const body = req.body;

    // 3. Handle Discord Interaction PING (type 1)
    if (body.type === 1) {
      return res.json({ type: 1 });
    }

    // 4. Handle Slash Command Interaction (type 2)
    if (body.type === 2) {
      const commandName = body.data?.name;

      if (commandName === 'ask') {
        const options = body.data?.options || [];
        const questionOption = options.find((opt: any) => opt.name === 'question');
        const question = questionOption?.value;

        if (!question) {
          return res.json({
            type: 4,
            data: { content: 'Please provide a question option.' },
          });
        }

        // Return a deferred message immediately to prevent 3-second timeout
        res.json({ type: 5 });

        // Run RAG pipeline and follow up asynchronously
        const channelId = body.channel_id || 'unknown';
        const sessionId = `discord:${channelId}`;
        const applicationId = body.application_id;
        const interactionToken = body.token;

        // Perform processing in background
        Promise.resolve().then(async () => {
          try {
            const chatResult = await this.chatService.processMessage(
              tenantId,
              sessionId,
              question,
            );

            // Consume stream
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const chunk of chatResult.stream) {
              // No-op: consume stream
            }

            // Fetch final completion
            const completion = await chatResult.onComplete();

            // Send follow-up back to Discord
            await this.sendFollowUp(
              applicationId,
              interactionToken,
              completion.fullResponse,
              completion.citations,
            );
          } catch (err) {
            this.logger.error(`Error processing Discord slash command: ${err}`);
            // Report error to channel
            await this.sendFollowUp(
              applicationId,
              interactionToken,
              `⚠️ An error occurred while processing your request: ${(err as Error).message}`,
              [],
            );
          }
        });
        return;
      }
    }

    // Return no-op response for unhandled events
    return res.json({ type: 4, data: { content: 'Unhandled interaction.' } });
  }

  private verifyDiscordSignature(
    publicKeyHex: string,
    rawBody: Buffer,
    timestamp: string,
    signatureHex: string,
  ): boolean {
    try {
      const signature = Buffer.from(signatureHex, 'hex');
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf8'),
        rawBody,
      ]);
      const publicKey = crypto.createPublicKey({
        key: Buffer.concat([
          Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]),
          Buffer.from(publicKeyHex, 'hex'),
        ]),
        format: 'der',
        type: 'spki',
      });
      return crypto.verify(
        null,
        message,
        publicKey,
        signature,
      );
    } catch (err) {
      return false;
    }
  }

  private async sendFollowUp(
    applicationId: string,
    token: string,
    text: string,
    citations: any[],
  ) {
    const embeds: any[] = [
      {
        title: 'GroundedDesk AI Assistant',
        description: text,
        color: 6516977, // #6366f1
        footer: {
          text: 'Answered by GroundedDesk AI',
        },
      },
    ];

    if (citations && citations.length > 0) {
      const uniqueSources = Array.from(new Set(citations.map((c: any) => c.sourceName)));
      if (uniqueSources.length > 0) {
        embeds[0].fields = [
          {
            name: 'Sources',
            value: uniqueSources.join(', '),
          },
        ];
      }
    }

    const response = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Discord follow-up failed: ${response.status} - ${errText}`);
    }
  }
}
