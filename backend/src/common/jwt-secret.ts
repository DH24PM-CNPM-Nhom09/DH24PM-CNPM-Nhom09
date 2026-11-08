import { randomBytes } from "crypto";
import { Logger } from "@nestjs/common";

/**
 * Các chuỗi mẫu từng nằm trong .env.example / tài liệu. Ai cũng đọc được trên GitHub,
 * nên dùng chúng làm JWT_SECRET thì người ngoài tự ký được token (kể cả token quản trị).
 */
const PUBLIC_SAMPLES = new Set([
  "thay-bang-chuoi-ngau-nhien-that-dai-it-nhat-32-ky-tu",
  "doi-chuoi-nay-thanh-chuoi-bi-mat-dai",
  "doi-chuoi-nay-thanh-chuoi-bi-mat-dai-it-nhat-32-ky-tu",
]);

let cached: string | null = null;

/**
 * Khóa ký phiên đăng nhập.
 *  - Thiếu hoặc ngắn hơn 16 ký tự: báo lỗi, không chạy (16–31 ký tự: chạy nhưng cảnh báo nên dài hơn).
 *  - Còn để chuỗi mẫu công khai: KHÔNG dùng chuỗi đó mà tự sinh khóa ngẫu nhiên cho lần chạy này
 *    (máy cá nhân vẫn chạy được, chỉ là khởi động lại thì phải đăng nhập lại) và cảnh báo rõ.
 */
export function jwtSecret(): string {
  if (cached) return cached;
  const secret = (process.env.JWT_SECRET ?? "").trim();
  if (PUBLIC_SAMPLES.has(secret)) {
    new Logger("Security").warn(
      "JWT_SECRET đang là chuỗi mẫu công khai trong .env.example — đã thay bằng khóa ngẫu nhiên tạm thời. " +
        "Đặt JWT_SECRET là chuỗi ngẫu nhiên của riêng máy chủ (ví dụ: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\").",
    );
    cached = randomBytes(48).toString("hex");
    return cached;
  }
  if (secret.length < 16) throw new Error("JWT_SECRET chưa được cấu hình (cần chuỗi ngẫu nhiên ít nhất 16 ký tự, nên từ 32 ký tự) trong file .env");
  if (secret.length < 32) new Logger("Security").warn("JWT_SECRET ngắn hơn 32 ký tự — nên đổi sang chuỗi ngẫu nhiên dài hơn.");
  cached = secret;
  return cached;
}
