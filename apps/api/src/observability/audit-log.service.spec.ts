import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should log a security event', async () => {
    const createSpy = jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'log-1' } as any);
    const result = await service.log({
      tenantId: 'tenant-1',
      userId: 'user-1',
      userEmail: 'admin@company.com',
      action: 'API_KEY_CREATE',
      details: 'Created API key',
      ipAddress: '127.0.0.1',
    });

    expect(result).toEqual({ id: 'log-1' });
    expect(createSpy).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'admin@company.com',
        action: 'API_KEY_CREATE',
        details: 'Created API key',
        ipAddress: '127.0.0.1',
      },
    });
  });

  it('should fetch audit logs for a tenant', async () => {
    const logsMock = [
      { id: 'log-1', action: 'API_KEY_CREATE', createdAt: new Date() },
    ];
    const findManySpy = jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue(logsMock as any);

    const result = await service.getLogs('tenant-1', 10, 0);
    expect(result).toEqual(logsMock);
    expect(findManySpy).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 0,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  });
});
