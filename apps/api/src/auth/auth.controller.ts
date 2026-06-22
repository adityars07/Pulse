import { Controller, Post, Body, Get, Delete, Param, UseGuards, Req, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from './decorators/current-user.decorator';
import { TenantAwarePrismaService } from '../prisma/tenant-aware-prisma.service';
import { AuditLogService } from '../observability/audit-log.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantAwarePrisma: TenantAwarePrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        tenantId: user.tenantId,
      },
      tenant: user.tenant,
    };
  }

  // --- API Keys ---

  @Post('api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async createApiKey(
    @CurrentUser() user: any,
    @Body('name') name: string,
    @Req() req: any,
  ) {
    const result = await this.authService.generateApiKey(user.tenantId, name);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'API_KEY_CREATE',
      details: `Created API key: ${name} (Prefix: ${result.keyPrefix})`,
      ipAddress: req.ip,
    });
    return result;
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async getApiKeys() {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async deleteApiKey(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    // Get the API key details before deleting for audit trail logs
    let keyName = id;
    let keyPrefix = '';
    try {
      const apiKey = await this.tenantAwarePrisma.withTenantScope(async (prisma) => {
        return prisma.apiKey.findUnique({ where: { id } });
      });
      if (apiKey) {
        keyName = apiKey.name;
        keyPrefix = apiKey.keyPrefix;
      }
    } catch (e) {
      // Ignore
    }

    const result = await this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.apiKey.delete({
        where: { id },
      });
    });

    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'API_KEY_REVOKE',
      details: `Revoked API key: ${keyName} (Prefix: ${keyPrefix})`,
      ipAddress: req.ip,
    });

    return result;
  }

  // --- Team Management ---

  @Get('team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async getTeam(@CurrentUser() user: any) {
    return this.authService.listTeamMembers(user.tenantId);
  }

  @Post('team/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async inviteTeamMember(
    @CurrentUser() user: any,
    @Body() body: { email: string; name?: string; role: UserRole; password?: string },
    @Req() req: any,
  ) {
    const result = await this.authService.inviteTeamMember(user.tenantId, body);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'MEMBER_INVITE',
      details: `Invited/Created team member: ${body.email} with role ${body.role}`,
      ipAddress: req.ip,
    });
    return result;
  }

  @Patch('team/members/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateMemberRole(
    @CurrentUser() user: any,
    @Param('id') targetUserId: string,
    @Body('role') role: UserRole,
    @Req() req: any,
  ) {
    const result = await this.authService.updateMemberRole(user.tenantId, user.id, targetUserId, role);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'ROLE_UPDATE',
      details: `Updated role of member ${result.email} to ${role}`,
      ipAddress: req.ip,
    });
    return result;
  }

  @Delete('team/members/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async removeTeamMember(
    @CurrentUser() user: any,
    @Param('id') targetUserId: string,
    @Req() req: any,
  ) {
    // Get target user email first
    let targetEmail = targetUserId;
    try {
      const target = await this.tenantAwarePrisma.withTenantScope(async (prisma) => {
        return prisma.user.findUnique({ where: { id: targetUserId } });
      });
      if (target) {
        targetEmail = target.email;
      }
    } catch (e) {
      // Ignore
    }

    const result = await this.authService.removeTeamMember(user.tenantId, user.id, targetUserId);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'MEMBER_REMOVE',
      details: `Removed team member: ${targetEmail}`,
      ipAddress: req.ip,
    });
    return result;
  }
}
