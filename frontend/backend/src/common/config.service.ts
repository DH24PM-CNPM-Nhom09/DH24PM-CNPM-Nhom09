import { Global, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Đọc bảng system_config (có giá trị mặc định nếu chưa cấu hình) */
@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async int(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.system_config.findUnique({ where: { config_key: key } });
    const n = Number(row?.config_value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  async text(key: string, fallback = ""): Promise<string> {
    const row = await this.prisma.system_config.findUnique({ where: { config_key: key } });
    return row?.config_value?.trim() || fallback;
  }
}

export const env = {
  devBypass: () => String(process.env.DEV_AUTH_BYPASS ?? "").toLowerCase() === "true",
  googleClientId: () => process.env.GOOGLE_CLIENT_ID ?? "",
  uploadDir: () => process.env.UPLOAD_DIR || "./uploads",
};

@Global()
@Module({ providers: [SystemConfigService], exports: [SystemConfigService] })
export class SystemConfigModule {}
