import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAwarePrismaService } from '../prisma/tenant-aware-prisma.service';
import { ConversationStatus } from '@prisma/client';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly tenantAwarePrisma: TenantAwarePrismaService) {}

  /**
   * List all conversations for the active tenant.
   */
  @Get()
  async getConversations() {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.conversation.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  }

  /**
   * Get detail for a single conversation.
   */
  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.conversation.findUniqueOrThrow({
        where: { id },
      });
    });
  }

  /**
   * Get all messages for a conversation.
   */
  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.message.findMany({
        where: { conversationId: id },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  }

  /**
   * Update conversation status (ACTIVE, RESOLVED, ESCALATED).
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ConversationStatus,
  ) {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.conversation.update({
        where: { id },
        data: { status },
      });
    });
  }
}
