import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/exception.filter";
import { authRateLimit, securityHeaders } from "./common/security";
import { normalizeDatabaseUrl } from "./common/db-url";
import { PrismaService } from "./prisma/prisma.service";

// Chuỗi kết nối kiểu Aiven (?ssl-mode=REQUIRED) -> tham số Prisma hiểu được, trước khi Prisma khởi tạo
normalizeDatabaseUrl();

// Phòng hờ: nếu có BigInt lọt ra ngoài mapper thì vẫn trả JSON được
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<import("@nestjs/platform-express").NestExpressApplication>(AppModule, { bodyParser: true });
  // Sau proxy (Render, Nginx): lấy đúng IP người dùng và nhận biết HTTPS
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use("/api/v1/auth", authRateLimit(app.get(PrismaService)));
  // Mọi API nằm dưới /api/v1, riêng /health để ngoài cho healthcheck của DevOps
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: false, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  app.useGlobalFilters(new ApiExceptionFilter());
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  if (String(process.env.DEV_AUTH_BYPASS ?? "").toLowerCase() === "true")
    Logger.warn(
      process.env.GOOGLE_CLIENT_ID
        ? "DEV_AUTH_BYPASS=true nhưng đã có GOOGLE_CLIENT_ID: đăng nhập Google giả bị TẮT, chỉ còn hiện mã OTP khi chưa cấu hình email. Máy chủ thật hãy đặt DEV_AUTH_BYPASS=false."
        : "DEV_AUTH_BYPASS=true: cho phép đăng nhập Google giả (dev:<email>) — CHỈ dùng trên máy cá nhân, không bao giờ bật trên máy chủ thật.",
      "Security",
    );
  Logger.log(`Backend chạy tại http://localhost:${port}/api/v1 (healthcheck: /health)`, "Bootstrap");
}
bootstrap();
