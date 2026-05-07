import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extract tenant ID from the request.
 * Tenant routes should always provide a tenant-scoped JWT, so null indicates
 * a misconfigured or unauthenticated request.
 *
 * @example
 * ```typescript
 * @Get('metrics')
 * async getMetrics(@TenantId() tenantId: string) {
 *   return this.metricsService.findAll(tenantId);
 * }
 * ```
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId || null;
  },
);

/**
 * Extract user ID from JWT payload
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.sub || request.user?.id;
  },
);

/**
 * Extract IP address from the request
 */
export const IpAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.ip || request.connection?.remoteAddress || "unknown";
  },
);

/**
 * Extract User-Agent from the request headers
 */
export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers?.["user-agent"] || "unknown";
  },
);
