import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

/**
 * Mọi lỗi đều trả về { error_code, message, detail? } để frontend xử lý thống nhất.
 * - Lỗi nghiệp vụ (AppError) / HttpException: giữ nguyên.
 * - Lỗi từ trigger (SIGNAL SQLSTATE '45000'): trả 400 với đúng câu thông báo của trigger.
 * - Vi phạm UNIQUE / FK / CHECK: đổi sang câu tiếng Việt dễ hiểu.
 * - Lỗi khác: 500, không lộ chi tiết kỹ thuật ra ngoài.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("API");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const send = (status: number, error_code: string, message: string) => res.status(status).json({ error_code, message });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown> | string;
      if (typeof body === "object" && body && "error_code" in body) return res.status(status).json(body);
      if (status === HttpStatus.NOT_FOUND) return send(status, "NOT_FOUND", "Không tìm thấy đường dẫn API.");
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) return send(status, "FILE_TOO_LARGE", "Tệp vượt quá dung lượng cho phép (5MB).");
      const message = typeof body === "string" ? body : Array.isArray(body?.message) ? body.message.join(" ") : String(body?.message ?? "Yêu cầu không hợp lệ.");
      return send(status, status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST", message);
    }

    const raw = exception instanceof Error ? exception.message : String(exception);

    // Trigger của CSDL báo lỗi nghiệp vụ bằng SIGNAL SQLSTATE '45000'
    // (MariaDB error 1644 = ER_SIGNAL_EXCEPTION). Prisma bọc lỗi dạng: message: "…", state: "45000"
    const signal = raw.match(/message: "([^"]+)", state: "45000"/) ?? raw.match(/code: 1644, message: "([^"]+)"/);
    if (signal) return send(400, "DB_RULE_VIOLATION", signal[1].trim());

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") return send(409, "DUPLICATE", "Dữ liệu bị trùng với bản ghi đã có.");
      if (exception.code === "P2003") return send(400, "INVALID_REFERENCE", "Dữ liệu tham chiếu không tồn tại.");
      if (exception.code === "P2025") return send(404, "NOT_FOUND", "Không tìm thấy dữ liệu.");
    }
    if (/CONSTRAINT `[^`]+` failed|check constraint/i.test(raw)) {
      return send(400, "CONSTRAINT_VIOLATION", "Dữ liệu không thỏa ràng buộc của hệ thống (giá trị ngoài phạm vi cho phép).");
    }

    this.logger.error(raw, exception instanceof Error ? exception.stack : undefined);
    return send(500, "INTERNAL_ERROR", "Hệ thống đang gặp sự cố, vui lòng thử lại sau.");
  }
}
