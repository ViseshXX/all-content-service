import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Best-effort details about the raw exception for diagnostics
    const rawError: any = exception as any;
    const errName = rawError?.name || 'Error';
    const errMessage = rawError?.message || 'Unhandled exception';
    const errStack = rawError?.stack;

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Something went wrong. Please try again later.';
    let error = 'Internal Server Error';
    let errorType = 'SystemError';
    let code = statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED';
    let errors: any[] = [];

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;
        message = Array.isArray(res.message) ? res.message.join(', ') : res.message || message;
        error = res.error || error;
        errorType = res.error_type || error.replace(/\s+/g, '');
        code = res.code || code;
        errors = Array.isArray(res.errors) ? res.errors : [];
      }
    }

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['request_id'] as string) ||
      randomUUID();
    const timestamp = new Date().toISOString();

    // Log raw error stack first (helps quickly pinpoint source)
    if (errStack) {
      this.logger.error(errStack);
    } else {
      this.logger.error(`${errName}: ${errMessage}`);
    }

    this.logger.error(
      JSON.stringify({
        timestamp,
        method: request.method,
        path: request.url,
        request_id: requestId,
        statusCode,
        message,
        error,
        error_type: errorType,
        code,
        errors,
        exception: {
          name: errName,
          message: errMessage,
        },
      }),
    );

    response.status(statusCode).send({
      success: false,
      message,
      error_type: errorType,
      timestamp,
      request_id: requestId,
      errors,
      code,
    });
  }
}
