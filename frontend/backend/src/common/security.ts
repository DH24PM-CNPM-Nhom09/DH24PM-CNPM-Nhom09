import type { NextFunction, Request, Response } from "express";

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
const hits = new Map<string, { n: number; reset: number }>();

export function authRateLimit(max = Number(process.env.AUTH_RATE_LIMIT ?? 60)) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST" || max <= 0) return next();
    const key = `${req.ip}|${req.path}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + WINDOW_MS });
    else if (++h.n > max) {
      res.setHeader("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
      res.status(429).json({ error_code: "TOO_MANY_REQUESTS", message: "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút." });
      return;
    }
    if (hits.size > 50_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}
