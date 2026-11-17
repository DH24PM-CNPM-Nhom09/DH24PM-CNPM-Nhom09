import type { NextFunction, Request, Response } from "express";
import type { PrismaService } from "../prisma/prisma.service";
import { bumpCounter } from "./counter";

/**
 * Lớp bảo vệ cơ bản không cần thư viện ngoài:
 *  - Header an toàn (chống nhúng iframe, đoán kiểu tệp, lộ thông tin máy chủ; HSTS khi chạy HTTPS).
 *  - Giới hạn số lần gọi API đăng nhập / đăng ký / quên mật khẩu theo địa chỉ IP
 *    (chặn dò mật khẩu hàng loạt; tài khoản vẫn có khóa riêng khi sai 5 lần).
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}

const WINDOW_MS = 10 * 60_000;
/** Dự phòng khi CSDL lỗi: đếm tạm trong bộ nhớ */
const memHits = new Map<string, { n: number; reset: number }>();

function memBump(key: string, now: number) {
  const h = memHits.get(key);
  if (!h || h.reset < now) {
    memHits.set(key, { n: 1, reset: now + WINDOW_MS });
    return { hits: 1, resetAt: now + WINDOW_MS };
  }
  h.n++;
  if (memHits.size > 50_000) for (const [k, v] of memHits) if (v.reset < now) memHits.delete(k);
  return { hits: h.n, resetAt: h.reset };
}

/**
 * Giới hạn số lần gọi API xác thực (POST) theo IP + đường dẫn trong 10 phút.
 * Đếm trong bảng security_counter (migration v14) nên không bị xóa khi backend ngủ / khởi động lại.
 */
export function authRateLimit(prisma: PrismaService, max = Number(process.env.AUTH_RATE_LIMIT ?? 60)) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || max <= 0) return next();
    const key = `rl:${req.ip}|${req.path}`;
    const now = Date.now();
    void bumpCounter(prisma, key, WINDOW_MS)
      .then((r) => ({ hits: r.hits, resetAt: r.resetAt.getTime() }))
      .catch(() => memBump(key, now))
      .then(({ hits, resetAt }) => {
        if (hits > max) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
          res.status(429).json({ error_code: "TOO_MANY_REQUESTS", message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút." });
          return;
        }
        next();
      });
  };
}
