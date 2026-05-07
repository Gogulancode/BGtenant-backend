import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

/**
 * Applies standard authentication/error responses for tenant-scoped controllers.
 */
export function ApiTenantAuth() {
  return applyDecorators(
    ApiBearerAuth("JWT-auth"),
    ApiUnauthorizedResponse({
      description: "Unauthorized – missing or invalid JWT",
    }),
    ApiForbiddenResponse({
      description: "Forbidden – insufficient role or tenant scope",
    }),
    ApiBadRequestResponse({
      description:
        "Bad Request – validation failed for payload or query parameters",
    }),
  );
}
