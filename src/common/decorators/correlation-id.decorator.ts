import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extracts the correlation ID from the request.
 * Usage: @CorrelationId() correlationId: string
 */
export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.correlationId || "unknown";
  },
);
