# API Documentation

This folder contains the OpenAPI/Swagger specifications and API documentation for the BG Accountability Tenant Backend.

## Files

| File | Description |
|------|-------------|
| `tenant-openapi.json` | OpenAPI 3.0 specification (machine-readable) |
| `API_OVERVIEW.md` | High-level API overview and conventions |
| `TENANT_API_GUIDE.md` | Detailed endpoint documentation for developers |
| `ROLES_MATRIX.md` | Role-based access control reference |
| `ONBOARDING_SYSTEM.md` | Comprehensive onboarding system documentation |

## Regenerating the OpenAPI Spec

To regenerate the OpenAPI specification after making changes to the API:

```bash
# From the project root
npm run generate:openapi
```

This will:
1. Bootstrap the NestJS application
2. Extract all Swagger decorators and DTOs
3. Output the spec to `docs/tenant-openapi.json`

## Using the Spec

### Swagger UI (Development)
When running the backend locally, visit:
```
http://localhost:3002/api/docs
```

### Import into Tools
The `tenant-openapi.json` file can be imported into:
- **Postman**: Import → OpenAPI
- **Insomnia**: Import/Export → Import Data → From File
- **Stoplight Studio**: Open file
- **Swagger Editor**: File → Import File

### Flutter/Mobile Development
Use the spec with code generators:
```bash
# Using openapi-generator
openapi-generator generate -i docs/tenant-openapi.json -g dart -o ../mobile/lib/api

# Using swagger_parser (Dart)
dart run swagger_parser:generate -i docs/tenant-openapi.json
```

## API Versioning

- **Current Version**: `1.0.0`
- **Base Path**: `/api/v1`
- **Breaking changes** require version bump

## Changelog

### v1.0.0 (2025-11-30)
- Initial stable API release
- Core modules: Auth, User, Dashboard, Business, Metrics, Outcomes, Reviews, Sales, Activities, Insights, Settings
- MFA support (TOTP)
- Session management
- Multi-tenant isolation
- **Comprehensive 8-step onboarding system** with:
  - Profile setup (Step 1)
  - Business Identity (Step 2)
  - Sales Planning with monthly contribution validation (Step 3)
  - Activity Configuration (Step 4)
  - Sales Cycle Setup (Step 5)
  - Achievement Stages (Step 6)
  - Subscription Selection (Step 7)
  - Completion with subscription activation (Step 8)

## Contact

For API questions or issues:
- Email: support@bridgegaps.app
- GitHub: [Repository Issues]
