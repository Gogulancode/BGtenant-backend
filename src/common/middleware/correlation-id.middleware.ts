import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Adds a unique correlation ID to each request for distributed tracing.
 * The ID is:
 * 1. Extracted from `X-Correlation-ID` header if present (from upstream services)
 * 2. Generated as a new UUID if not present
 * 3. Added to response headers for client tracing
 * 4. Attached to request object for logging throughout the request lifecycle
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Check for existing correlation ID from upstream
    const existingId = req.headers["x-correlation-id"] as string | undefined;
    const correlationId = existingId || randomUUID();

    // Attach to request for use in services
    (req as any).correlationId = correlationId;

    // Add to response headers
    res.setHeader("X-Correlation-ID", correlationId);

    // Log if we generated a new ID
    if (!existingId) {
      this.logger.debug(`Generated correlation ID: ${correlationId}`);
    }

    next();
  }
}
