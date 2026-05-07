import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

/**
 * Guard that restricts access to SUPER_ADMIN role only.
 * Used for platform-level operations like tenant management.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Access denied. This endpoint requires SUPER_ADMIN privileges.",
      );
    }

    // SUPER_ADMIN should not have a tenantId
    if (user.tenantId) {
      throw new ForbiddenException(
        "Access denied. Platform admins should not be associated with a tenant.",
      );
    }

    return true;
  }
}
