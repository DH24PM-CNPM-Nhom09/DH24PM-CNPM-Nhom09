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
  /**
   * Chỉ gửi email tới tài khoản đã chứng minh sở hữu email (nhập đúng mã đăng ký / đăng nhập Google thật).
   * Bật khi có dữ liệu mẫu (DEV_AUTH_BYPASS hoặc SEED_DEMO=true): địa chỉ trong dữ liệu mẫu là bịa,
   * không bao giờ được nhận email thật.
   */
  verifiedEmailOnly: () =>
    String(process.env.DEV_AUTH_BYPASS ?? "").toLowerCase() === "true" || String(process.env.SEED_DEMO ?? "").toLowerCase() === "true",
};

@Global()
@Module({ providers: [SystemConfigService], exports: [SystemConfigService] })
export class SystemConfigModule {}
