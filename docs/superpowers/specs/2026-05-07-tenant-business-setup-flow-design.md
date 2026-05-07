# Tenant Business Setup Flow Design

## Goal
Make the first tenant experience feel like a guided business accountability setup rather than disconnected forms, and align the profile/business identity data with the client workbook.

## Scope
This slice improves onboarding steps 1 and 2 and the matching backend contracts. It does not implement binary media upload yet; logo/profile image upload remains a later media-storage slice.

## User Flow
1. The user registers or logs in.
2. Step 1 captures personal context and business challenges:
   - age, gender, marital status
   - business description
   - social handles
   - pain points
3. Step 2 captures business identity:
   - company/business name
   - company type and registered status
   - product/service/business model
   - B2B/B2C customer type
   - industry and optional other industry
   - years in business, turnover band, employee range
   - website, USP, keywords, and a small product/service catalog
4. Saved data is returned using backend field names so onboarding can prefill reliably.

## Backend Design
Extend `BusinessIdentity` with explicit workbook-aligned fields:
- `customerType`: B2B, B2C, or BOTH
- `registrationStatus`: REGISTERED, UNREGISTERED, or IN_PROGRESS
- `offeringType`: PRODUCT, SERVICE, or BOTH
- `offerings`: JSON array of product/service names

Update onboarding profile DTO/service to persist `painPoints`.

## Frontend Design
Update onboarding Step 2 to submit backend-aligned fields instead of legacy names. The form should remain compact, but it must ask the questions in the order an owner understands: name, who they sell to, what they sell, then operating details.

## Validation
- Backend build passes.
- Prisma schema validates.
- Onboarding service tests cover pain point persistence and business identity upsert mapping.
- Frontend build passes.
