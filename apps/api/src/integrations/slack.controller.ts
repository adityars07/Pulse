import { Controller, Post, Req, Res, Param, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

@Controller('integrations/slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

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
    const signingSecret = settings.slackSigningSecret;
    const botToken = settings.slackBotToken;

    if (!signingSecret || !botToken) {
      this.logger.error(`Slack settings missing for tenant ${tenantId}`);
      throw new BadRequestException('Slack integration not configured');
    }

    // 2. Validate Slack signature
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const rawBody = req.rawBody;

    if (!signature || !timestamp || !rawBody) {
      this.logger.warn('Signature headers or rawBody missing');
      throw new BadRequestException('Missing signature headers');
    }

    const isVerified = this.verifySlackSignature(signingSecret, rawBody, timestamp, signature);
    if (!isVerified) {
      this.logger.warn('Slack signature verification failed');
      throw new BadRequestException('Invalid signature');
    }

    const body = req.body;

    // 3. Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Acknowledge the event immediately to Slack (must respond within 3 seconds)
    res.status(200).send();

    // 4. Handle event callbacks
    if (body.type === 'event_callback' && body.event) {
      const event = body.event;

      // Ignore messages from bots to prevent infinite loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return;
      }

      if (event.type === 'message' && event.text) {
        // Map external thread ID to Conversation.sessionId
        // If it's a thread message, event.thread_ts is present.
        // Otherwise, use event.ts as the thread identifier so replies map to it.
        const channelId = event.channel;
        const threadTs = event.thread_ts || event.ts;
        const sessionId = `slack:${channelId}:${threadTs}`;

        this.logger.log(`Processing Slack message for tenant ${tenantId}, session ${sessionId}`);

        try {
          // Process message
          const chatResult = await this.chatService.processMessage(
            tenantId,
            sessionId,
            event.text,
          );

          // Consume stream to trigger full processing & db save
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const chunk of chatResult.stream) {
            // No-op: we just consume the stream to let the AI process
          }

          // Fetch final result
          const completion = await chatResult.onComplete();

          // Format rich block/markdown layout back to Slack
          await this.postToSlack(botToken, channelId, threadTs, completion.fullResponse, completion.citations);
        } catch (err) {
          this.logger.error(`Error processing Slack message: ${err}`);
        }
      }
    }
  }

  private verifySlackSignature(
    signingSecret: string,
    rawBody: Buffer,
    timestamp: string,
    signature: string,
  ): boolean {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp, 10) < fiveMinutesAgo) {
      return false;
    }

    const baseString = `v0:${timestamp}:${rawBody.toString('utf8')}`;
    const hmac = crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');

    const calculatedSignature = `v0=${hmac}`;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSignature),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  private async postToSlack(
    botToken: string,
    channel: string,
    threadTs: string,
    text: string,
    citations: any[],
  ) {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      },
    ];

    if (citations && citations.length > 0) {
      const uniqueSources = Array.from(new Set(citations.map((c: any) => c.sourceName)));
      if (uniqueSources.length > 0) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📖 *Sources:* ${uniqueSources.join(', ')}`,
            },
          ],
        });
      }
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⚡ *Answered by GroundedDesk AI*',
        },
      ],
    });

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel,
        thread_ts: threadTs,
        blocks,
        text, // fallback
      }),
    });

    const resJson = await response.json() as any;
    if (!response.ok || !resJson.ok) {
      this.logger.error(`Slack postMessage failed: ${JSON.stringify(resJson)}`);
    }
  }
}
