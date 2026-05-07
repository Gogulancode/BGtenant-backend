import { ForbiddenException } from "@nestjs/common";

/**
 * Ensures tenant-scoped endpoints have a valid tenant context.
 * Throws a ForbiddenException when tenantId is missing (e.g., super admin token on tenant route).
 */
export const assertTenantContext = (tenantId?: string | null): string => {
  if (!tenantId) {
    throw new ForbiddenException(
      "Tenant context is required for this operation",
    );
  }
  return tenantId;
};
