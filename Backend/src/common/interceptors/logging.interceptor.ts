import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Log dang JSON (co traceId) cho tung request - dung chung format voi
 * HttpExceptionFilter de DevOps de dang gom log vao he thong giam sat.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() =>
        this.logger.log(
          JSON.stringify({ method, url, durationMs: Date.now() - start, status: 'OK' }),
        ),
      ),
    );
  }
}
