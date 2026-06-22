jest.mock('langfuse', () => {
  return {
    Langfuse: jest.fn().mockImplementation(() => ({
      trace: jest.fn(),
      flushAsync: jest.fn(),
    })),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { SlackController } from './slack.controller';
import { DiscordController } from './discord.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import * as crypto from 'crypto';

describe('Integrations Controllers', () => {
  let slackController: SlackController;
  let discordController: DiscordController;
  let prisma: PrismaService;
  let chatService: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackController, DiscordController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ChatService,
          useValue: {
            processMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    slackController = module.get<SlackController>(SlackController);
    discordController = module.get<DiscordController>(DiscordController);
    prisma = module.get<PrismaService>(PrismaService);
    chatService = module.get<ChatService>(ChatService);
  });

  describe('SlackController', () => {
    it('should return challenge for url_verification', async () => {
      const mockTenant = {
        id: 'tenant-1',
        settings: {
          slackSigningSecret: 'secret',
          slackBotToken: 'xoxb-token',
        },
      };
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockTenant as any);

      // Generate a mock signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const rawBodyText = JSON.stringify({
        type: 'url_verification',
        challenge: 'test-challenge',
      });
      const rawBody = Buffer.from(rawBodyText);
      const baseString = `v0:${timestamp}:${rawBodyText}`;
      const signature = 'v0=' + crypto.createHmac('sha256', 'secret').update(baseString).digest('hex');

      const reqMock = {
        headers: {
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        rawBody,
        body: JSON.parse(rawBodyText),
      } as any;

      const resMock = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      await slackController.handleWebhook('tenant-1', reqMock, resMock);
      expect(resMock.json).toHaveBeenCalledWith({ challenge: 'test-challenge' });
    });
  });

  describe('DiscordController', () => {
    it('should return PONG for ping interaction', async () => {
      const mockTenant = {
        id: 'tenant-1',
        settings: {
          discordPublicKey: '0000000000000000000000000000000000000000000000000000000000000000', // Mock key
        },
      };
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockTenant as any);

      // Since mock Ed25519 signature is hard to compute without private key, we mock verifyDiscordSignature
      jest.spyOn(discordController as any, 'verifyDiscordSignature').mockReturnValue(true);

      const reqMock = {
        headers: {
          'x-signature-ed25519': 'mock-sig',
          'x-signature-timestamp': 'mock-time',
        },
        rawBody: Buffer.from('{"type":1}'),
        body: { type: 1 },
      } as any;

      const resMock = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      await discordController.handleWebhook('tenant-1', reqMock, resMock);
      expect(resMock.json).toHaveBeenCalledWith({ type: 1 });
    });
  });
});
