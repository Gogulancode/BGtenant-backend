import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "@prisma/client";

/**
 * User context extracted from JWT token.
 * This interface represents the authenticated user's identity and permissions.
 */
export interface UserContext {
  /** User's unique identifier */
  userId: string;
  /** User's email address */
  email: string;
  /** User's role within their tenant */
  role: Role;
  /** Tenant ID the user belongs to (null for system-level access) */
  tenantId: string | null;
}

/**
 * Parameter decorator that extracts the authenticated user from the request.
 * The user is populated by the JWT strategy after token validation.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * async getProfile(@CurrentUser() user: UserContext) {
 *   return this.userService.findById(user.userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserContext;
  },
);
