# Tenant Sales Planning Calculator Design

## Goal
Turn the workbook sales formulas into an owner-friendly planning calculator that explains how annual targets translate into monthly orders, leads, and existing/new customer contribution.

## User Flow
Step 3 of onboarding becomes a guided calculator:

1. **Revenue Target**
   - Past 3 financial years
   - Current annual sales target
   - Monthly distribution percentages and monthly revenue targets

2. **Average Sale Calculator**
   - Average ticket size / average transaction size
   - Monthly target divided by ticket size produces expected order targets

3. **Conversion Calculator**
   - Conversion ratio percentage
   - Order target divided by conversion ratio produces expected lead targets

4. **Customer Contribution**
   - Existing customer contribution percentage
   - New customer contribution percentage
   - Both must total 100%
   - Annual target is split into existing and new customer target values

## Backend Design
Extend `SalesPlan` with:
- `averageTicketSize`
- `conversionRatio`
- `existingCustomerContribution`
- `newCustomerContribution`
- `monthlyOrderTargets`
- `monthlyLeadTargets`
- `existingCustomerTarget`
- `newCustomerTarget`

The backend calculates derived fields. It stores the user assumptions and calculated outputs together so dashboards and reports can reuse them without reimplementing formulas.

## Frontend Design
Step 3 shows live calculations while the user types. The copy should explain the business meaning, not the formula mechanics. The UI should preserve the current monthly distribution table and add summary cards for annual orders, annual leads, existing customer target, and new customer target.

## Validation
- Monthly contribution must have exactly 12 values and sum to 100.
- Customer contribution must sum to 100.
- Average ticket size must be greater than zero.
- Conversion ratio must be greater than zero and at most 100.

## Out of Scope
No charts in this slice. No changes to the main Sales page yet; this slice focuses on onboarding calculator data capture and persistence.
