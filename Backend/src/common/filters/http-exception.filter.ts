import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/** Chuẩn lỗi Frontend: { error_code, message, detail? } */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error_code = 'UNKNOWN';
    let message = 'Đã có lỗi xảy ra';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error_code = HttpStatus[status] ?? 'ERROR';
      } else if (typeof body === 'object' && body) {
        const o = body as Record<string, unknown>;
        error_code = String(o.error_code ?? o.code ?? HttpStatus[status] ?? 'ERROR');
        if (Array.isArray(o.message)) {
          message = (o.message as string[]).join(', ');
        } else {
          message = String(o.message ?? message);
        }
        detail = o.detail != null ? String(o.detail) : undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    res.status(status).json({
      error_code,
      message,
      ...(detail ? { detail } : {}),
    });
  }
}
