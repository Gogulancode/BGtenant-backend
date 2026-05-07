import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Standardized error response format across all API endpoints.
 */
export interface StandardErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

/**
 * Maps HTTP status codes to standardized error codes.
 */
const STATUS_TO_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "An unexpected error occurred";
    let details: unknown = undefined;
    let code = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Handle validation errors (class-validator returns array of messages)
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message[0] as string;
          details = responseObj.message;
        } else {
          message = (responseObj.message as string) || message;
        }

        // Preserve any additional details from the exception
        if (responseObj.details) {
          details = responseObj.details;
        }
      }

      code = STATUS_TO_CODE[status] || `HTTP_${status}`;
    } else if (exception instanceof Error) {
      // Handle Prisma errors
      if (exception.message.includes("Foreign key constraint")) {
        status = HttpStatus.BAD_REQUEST;
        message = "Referenced resource does not exist";
        code = "FOREIGN_KEY_VIOLATION";
      } else if (exception.message.includes("Unique constraint")) {
        status = HttpStatus.CONFLICT;
        message = "Resource already exists";
        code = "DUPLICATE_ENTRY";
      } else {
        message = exception.message;
        code = "INTERNAL_ERROR";
      }

      // Mask internal errors in production
      if (process.env.NODE_ENV === "production" && status === 500) {
        message = "An unexpected error occurred";
        details = undefined;
      }
    }

    const errorResponse: StandardErrorResponse = {
      success: false,
      message,
      code,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log error details
    this.logger.error(
      `${request.method} ${request.url} - ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }
}

// Keep backward compatibility alias
export { HttpExceptionFilter as AllExceptionsFilter };
