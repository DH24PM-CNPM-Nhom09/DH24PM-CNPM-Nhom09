import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/auth";
import { PrismaService } from "../../prisma/prisma.service";

/** Healthcheck cho DevOps (docker-compose gọi GET /health) */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", database: "up", time: new Date().toISOString() };
  }
}
