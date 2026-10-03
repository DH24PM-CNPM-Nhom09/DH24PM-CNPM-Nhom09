import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * GET /health - DevOps (Vo Truong Hai, Nguyen Thanh Luan) dung endpoint nay
 * cho Docker healthcheck (xem docker-compose.yml, PR #5).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
