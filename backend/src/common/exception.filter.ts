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
/** Tên cột thường gặp -> tên mục trên giao diện */
const FIELD_VI: Record<string, string> = {
  full_name: "Họ và tên",
  batch_name: "Tên đợt",
  legal_basis: "Căn cứ pháp lý",
  major_name: "Tên ngành",
  title: "Tiêu đề",
  committee_name: "Tên tiểu ban",
  location_or_link: "Địa điểm / đường dẫn",
  id_issue_place: "Nơi cấp CCCD",
  birthplace: "Nơi sinh",
  institution_name: "Tên cơ sở đào tạo",
  reason: "Lý do",
  note: "Ghi chú",
};

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
      // P2000: giá trị dài hơn cột trong CSDL (VD họ tên > 255 ký tự) — lỗi do dữ liệu nhập, không phải sự cố hệ thống
      if (exception.code === "P2000") {
        const col = String((exception.meta as { column_name?: string } | undefined)?.column_name ?? "").replace(/[`'"]/g, "");
        return send(400, "VALUE_TOO_LONG", `Nội dung nhập quá dài${col && FIELD_VI[col] ? ` ở mục "${FIELD_VI[col]}"` : ""}. Vui lòng rút gọn rồi thử lại.`);
      }
    }
    // Câu SQL viết tay ($queryRaw / $executeRaw) báo lỗi quá dài bằng thông điệp gốc của MySQL / MariaDB
    if (/Data too long for column|code: 1406\b|\b22001\b/i.test(raw)) {
      return send(400, "VALUE_TOO_LONG", "Nội dung nhập quá dài. Vui lòng rút gọn rồi thử lại.");
    }
    if (/CONSTRAINT `[^`]+` failed|check constraint/i.test(raw)) {
      return send(400, "CONSTRAINT_VIOLATION", "Dữ liệu không thỏa ràng buộc của hệ thống (giá trị ngoài phạm vi cho phép).");
    }

    this.logger.error(raw, exception instanceof Error ? exception.stack : undefined);
    return send(500, "INTERNAL_ERROR", "Hệ thống đang gặp sự cố, vui lòng thử lại sau.");
  }
}
