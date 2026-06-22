import {
  Controller,
  Post,
  Get,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KnowledgeService } from './knowledge.service';
import { AuditLogService } from '../observability/audit-log.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const result = await this.knowledgeService.uploadFile(user.tenantId, file);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'KNOWLEDGE_CREATE',
      details: `Uploaded file: ${file.originalname}`,
      ipAddress: req.ip,
    });
    return result;
  }

  @Post('crawl')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.AGENT)
  async crawlUrl(
    @CurrentUser() user: any,
    @Body('url') url: string,
    @Body('name') name: string,
    @Req() req: any,
  ) {
    const result = await this.knowledgeService.crawlUrl(user.tenantId, url, name);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'KNOWLEDGE_CREATE',
      details: `Crawled URL: ${url} (Name: ${name})`,
      ipAddress: req.ip,
    });
    return result;
  }

  @Get()
  async listSources(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.knowledgeService.listSources(user.tenantId, status);
  }

  @Get(':id')
  async getSource(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.getSource(user.tenantId, id);
  }

  @Get(':id/history')
  async getSourceHistory(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.knowledgeService.getSourceHistory(user.tenantId, id);
  }

  @Get(':id/chunks')
  async getSourceChunks(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.knowledgeService.getSourceChunks(user.tenantId, id, page, limit);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async deleteSource(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    let sourceName = id;
    try {
      const source = await this.knowledgeService.getSource(user.tenantId, id);
      if (source) {
        sourceName = source.name;
      }
    } catch (e) {
      // Ignore
    }

    const result = await this.knowledgeService.deleteSource(user.tenantId, id);
    await this.auditLog.log({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: 'KNOWLEDGE_DELETE',
      details: `Deleted knowledge source: ${sourceName} (${id})`,
      ipAddress: req.ip,
    });
    return result;
  }
}
