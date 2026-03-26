import { HttpException, HttpStatus } from '@nestjs/common';

type ValidationErrorItem = {
  field?: string;
  message: string;
  code?: string;
};

export class ValidationException extends HttpException {
  constructor(message: string, errors: ValidationErrorItem[] = []) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Validation Error',
        error_type: 'ValidationError',
        code: 'VALIDATION_FAILED',
        errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.NOT_FOUND, message, error: 'Not Found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ExternalServiceException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message,
        error: 'External Service Error',
        error_type: 'ExternalServiceError',
        code: 'EXTERNAL_SERVICE_FAILURE',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class ExternalServiceTimeoutException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.GATEWAY_TIMEOUT,
        message,
        error: 'Timeout Error',
        error_type: 'TimeoutError',
        code: 'EXTERNAL_SERVICE_TIMEOUT',
      },
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }
}
