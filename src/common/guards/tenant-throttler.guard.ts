import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerRequest,
} from "@nestjs/throttler";
import { TenantRateLimitService } from "../rate-limit/tenant-rate-limit.service";

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly tenantRateLimitService: TenantRateLimitService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return this.tenantRateLimitService.buildTracker(req);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const tenantId = this.tenantRateLimitService.extractTenantId(
      requestProps.context.switchToHttp().getRequest(),
    );
    if (tenantId) {
      requestProps.limit =
        await this.tenantRateLimitService.getLimitForTenant(tenantId);
    }
    return super.handleRequest(requestProps);
  }
}
