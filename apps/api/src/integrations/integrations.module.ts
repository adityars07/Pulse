import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller';
import { DiscordController } from './discord.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [SlackController, DiscordController],
})
export class IntegrationsModule {}
