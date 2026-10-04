import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Lỗi nghiệp vụ theo format chung nhóm đã chốt: { error_code, message, detail? }.
 * Ném ở bất kỳ đâu trong service; ApiExceptionFilter trả về đúng format.
 */
export class AppError extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly detail?: string,
  ) {
    super({ error_code: errorCode, message, ...(detail ? { detail } : {}) }, status);
  }
}

export function fail(errorCode: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST): never {
  throw new AppError(errorCode, message, status);
}

export function notFound(message: string): never {
  return fail("NOT_FOUND", message, HttpStatus.NOT_FOUND);
}
export function forbidden(message = "Bạn không có quyền thực hiện thao tác này."): never {
  return fail("FORBIDDEN", message, HttpStatus.FORBIDDEN);
}
export function unauthorized(message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."): never {
  return fail("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
}
export function conflict(errorCode: string, message: string): never {
  return fail(errorCode, message, HttpStatus.CONFLICT);
}
