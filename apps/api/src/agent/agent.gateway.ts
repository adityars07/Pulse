import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwarePrismaService } from '../prisma/tenant-aware-prisma.service';
import { AuthService } from '../auth/auth.service';
import { MessageRole, ConversationStatus } from '@prisma/client';

interface AgentSocket extends Socket {
  tenantId?: string;
  agentId?: string;
  agentName?: string;
}

/**
 * AgentGateway — /agent Socket.io namespace.
 *
 * Human support agents connect here using a JWT bearer token (from the
 * admin dashboard session).  When an agent joins a conversation room,
 * they receive all future customer messages in real-time and can reply
 * directly — bypassing the RAG pipeline entirely.
 *
 * Events emitted to agent:
 *   joined          — confirmation the agent joined successfully
 *   customer-message — incoming message from the widget
 *   conversation-history — full history on join
 *
 * Events from agent:
 *   join            — join a conversation room by conversationId
 *   agent-message   — send a reply to the customer
 *   resolve         — mark conversation RESOLVED
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/agent',
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly tenantAwarePrisma: TenantAwarePrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async handleConnection(client: AgentSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.emit('error', { code: 'AUTH_REQUIRED', message: 'JWT token required' });
        client.disconnect();
        return;
      }

      // Validate JWT and resolve the user + tenant
      const payload = await this.authService.verifyToken(token);
      client.tenantId = payload.tenantId;
      client.agentId = payload.sub;
      client.agentName = payload.name || payload.email || 'Agent';

      this.logger.log(`Agent ${client.agentName} (${client.agentId}) connected`);
      client.emit('connected', { agentId: client.agentId, agentName: client.agentName });
    } catch (err) {
      this.logger.warn(`Agent auth failed: ${err}`);
      client.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AgentSocket) {
    this.logger.log(`Agent ${client.agentId} disconnected`);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Agent joins a specific conversation room.
   * - Marks the conversation as ESCALATED (if not already)
   * - Sets assignedAgentId
   * - Sends the full conversation history back to the agent
   * - Notifies the chat namespace so the widget knows an agent joined
   */
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AgentSocket,
  ) {
    if (!client.tenantId || !client.agentId) {
      throw new WsException('Not authenticated');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: data.conversationId, tenantId: client.tenantId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      client.emit('error', { code: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    // Join the Socket.io room (shared with ChatGateway room)
    await client.join(`conv:${data.conversationId}`);

    // Update conversation — assign agent and escalate status
    await this.tenantAwarePrisma.withExplicitTenant(client.tenantId, async (prisma) => {
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: {
          status: ConversationStatus.ESCALATED,
          assignedAgentId: client.agentId,
        },
      });
    });

    // Send history to the joining agent
    client.emit('conversation-history', {
      conversationId: data.conversationId,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });

    // Notify the widget that an agent has joined
    this.server
      .to(`conv:${data.conversationId}`)
      .emit('agent-joined', { agentName: client.agentName });

    this.logger.log(`Agent ${client.agentName} joined conversation ${data.conversationId}`);
    client.emit('joined', { conversationId: data.conversationId });
  }

  /**
   * Agent sends a message to the customer.
   * Saved as MessageRole.AGENT and forwarded to the widget via chat room.
   */
  @SubscribeMessage('agent-message')
  async handleAgentMessage(
    @MessageBody() data: { conversationId: string; text: string },
    @ConnectedSocket() client: AgentSocket,
  ) {
    if (!client.tenantId || !client.agentId) {
      throw new WsException('Not authenticated');
    }

    if (!data?.text?.trim()) {
      client.emit('error', { code: 'EMPTY_MESSAGE', message: 'Message cannot be empty' });
      return;
    }

    // Persist the agent's message
    const message = await this.tenantAwarePrisma.withExplicitTenant(
      client.tenantId,
      async (prisma) => {
        return prisma.message.create({
          data: {
            conversationId: data.conversationId,
            tenantId: client.tenantId!,
            role: MessageRole.AGENT,
            content: data.text,
          },
        });
      },
    );

    // Broadcast to the entire room (widget + all agents in room)
    this.server.to(`conv:${data.conversationId}`).emit('agent-message', {
      messageId: message.id,
      agentName: client.agentName,
      text: data.text,
      createdAt: message.createdAt,
    });
  }

  /**
   * Agent resolves the conversation.
   */
  @SubscribeMessage('resolve')
  async handleResolve(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AgentSocket,
  ) {
    if (!client.tenantId) throw new WsException('Not authenticated');

    await this.tenantAwarePrisma.withExplicitTenant(client.tenantId, async (prisma) => {
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { status: ConversationStatus.RESOLVED },
      });
    });

    this.server
      .to(`conv:${data.conversationId}`)
      .emit('conversation-resolved', { conversationId: data.conversationId });

    this.logger.log(`Agent ${client.agentName} resolved conversation ${data.conversationId}`);
  }

  // ---------------------------------------------------------------------------
  // Public method called by ChatGateway to fan out customer messages
  // ---------------------------------------------------------------------------

  /**
   * Forward a customer message to any agents in the conversation room.
   * Called by ChatService when a conversation is ESCALATED.
   */
  broadcastCustomerMessage(conversationId: string, text: string) {
    this.server.to(`conv:${conversationId}`).emit('customer-message', {
      conversationId,
      text,
      createdAt: new Date(),
    });
  }
}
