import { Module } from '@nestjs/common';
import { AgentGateway } from './agent.gateway';
import { AuthModule } from '../auth/auth.module';

// PrismaModule is @Global() — no import needed here

@Module({
  imports: [AuthModule],
  providers: [AgentGateway],
  exports: [AgentGateway],
})
export class AgentModule {}
