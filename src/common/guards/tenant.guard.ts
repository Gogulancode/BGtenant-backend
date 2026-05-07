import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Guard to ensure user belongs to a tenant account
 * Used to protect tenant-scoped endpoints from platform-only users
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * @Controller('metrics')
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // All tenant users MUST have a tenantId
    if (!user.tenantId) {
      throw new ForbiddenException("User does not belong to any tenant");
    }

    return true;
  }
}
