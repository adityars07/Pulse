import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../observability/audit-log.service';

@Controller('tenant')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get(['me', 'current'])
  async getCurrent(@CurrentUser() user: any) {
    return this.tenantService.findById(user.tenantId);
  }

  @Get('current/stats')
  async getStats(@CurrentUser() user: any) {
    return this.tenantService.getStats(user.tenantId);
  }

  @Patch(['me', 'current/settings'])
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateSettings(
    @CurrentUser() user: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const settings = body.settings || body;
    const result = await this.tenantService.updateSettings(user.tenantId, settings);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'SETTINGS_UPDATE',
      details: `Updated tenant settings: ${JSON.stringify(settings)}`,
      ipAddress: req.ip,
    });
    return result;
  }
}
