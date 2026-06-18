import { Controller, Post, Body, Get, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { TenantAwarePrismaService } from '../prisma/tenant-aware-prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantAwarePrisma: TenantAwarePrismaService,
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

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(
    @CurrentUser() user: any,
    @Body('name') name: string,
  ) {
    return this.authService.generateApiKey(user.tenantId, name);
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
  @UseGuards(JwtAuthGuard)
  async deleteApiKey(@Param('id') id: string) {
    return this.tenantAwarePrisma.withTenantScope(async (prisma) => {
      return prisma.apiKey.delete({
        where: { id },
      });
    });
  }
}
