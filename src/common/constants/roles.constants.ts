import { Role } from "@prisma/client";

/**
 * Common role groupings reused across guards/decorators.
 */
export const TENANT_MEMBER_ROLES: readonly Role[] = [
  Role.TENANT_ADMIN,
  Role.MANAGER,
  Role.STAFF,
  Role.VIEWER,
];

export const TENANT_LEADERSHIP_ROLES: readonly Role[] = [
  Role.TENANT_ADMIN,
  Role.MANAGER,
];

export const TENANT_CONTRIBUTOR_ROLES: readonly Role[] = [
  Role.TENANT_ADMIN,
  Role.MANAGER,
  Role.STAFF,
];
