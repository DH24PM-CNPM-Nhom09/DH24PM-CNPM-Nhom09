import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Chuan hoa format loi tra ve cho toan bo API, kem traceId de DevOps
 * (Vo Truong Hai, Nguyen Thanh Luan) gan vao he thong log/monitoring.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Loi he thong khong xac dinh';

    const traceId = (request.headers['x-trace-id'] as string) ?? crypto.randomUUID();

    this.logger.error(
      JSON.stringify({ traceId, path: request.url, method: request.method, status, message }),
    );

    response.status(status).json({
      statusCode: status,
      traceId,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
