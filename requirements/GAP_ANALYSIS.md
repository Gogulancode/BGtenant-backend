# BG App - Requirements Gap Analysis

> Comparing `BGAppWireframe.xlsx` requirements against current implementation
> Generated: January 4, 2026

---

## Summary

| Sheet | Completion | Notes |
|-------|------------|-------|
| User Profile | 🟡 70% | Missing: Profile pic upload, Social media handles UI, One-pager, Pain points survey |
| Sales Planning | ✅ 90% | 3-year trend, projections, ASP, conversion ratio - all done |
| Development Activities | ✅ 85% | Categories exist, templates exist, weekly targets done |
| Sales Tracker | ✅ 95% | Monthly tracking complete with ASP, orders, actual vs target |
| Sales Cycle | ✅ 100% | Customizable stages implemented |
| Visual | 🟡 60% | Charts done, Red/Green flags done, Missing: community connection, tutorials |
| Commercial | 🔴 20% | Subscription model exists, but no payment integration, no trial period logic |
| Target Achievement Stages | ✅ 100% | Steps 0.1-1.0 fully implemented as Bronze/Silver/Gold/Platinum |

**Overall Completion: ~75%**

---

## Detailed Gap Analysis by Sheet

---

### Sheet 1: User Profile

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| Age | ✅ Done | `User.age` field in schema, collected in onboarding |
| Gender | ✅ Done | `User.gender` enum (MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY) |
| Marital Status | ✅ Done | `User.maritalStatus` enum |
| Business Name | ✅ Done | `Tenant.name` - business name at tenant level |
| Business Category | ✅ Done | `User.businessType` (Solopreneur, Startup, MSME) |
| Profile Pic | ❌ Missing | No image upload/storage implemented |
| Social media handles | 🟡 Partial | `User.socialLinks` JSON field exists, no UI to edit |
| Product or Services | ✅ Done | `BusinessSnapshot.productOrService` (PRODUCT/SERVICE/BOTH) |
| B2B or B2C | ✅ Done | `BusinessSnapshot.businessModel` (B2B/B2C/BOTH) |
| Appx Sales Turnover | ✅ Done | `BusinessSnapshot.annualTurnover` |
| Business Age | ❌ Missing | Not captured in schema |
| Registered (Business) | ❌ Missing | Business registration status not tracked |
| Keywords for business | ❌ Missing | No keyword/tag system |
| Logo | ❌ Missing | No logo upload for business |
| USP | ❌ Missing | No USP field |
| One pager profile | ❌ Missing | No one-pager generation |
| **Pain Points Section:** | | |
| Getting new customers | ❌ Missing | Not captured |
| Pricing | ❌ Missing | Not captured |
| Negotiating with client | ❌ Missing | Not captured |
| Getting referrals | ❌ Missing | Not captured |
| Retaining existing customers | ❌ Missing | Not captured |
| Executing plans | ❌ Missing | Not captured |

**Gap Actions:**
1. Add profile picture upload (S3/Cloudinary integration)
2. Add social media handles edit UI in Settings
3. Add "Business Age" field
4. Add "Pain Points" survey in onboarding or profile
5. Add USP and Keywords fields

---

### Sheet 2: Sales Planning

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| 3 years trend (n-2, n-1, n) | ✅ Done | `SalesPlan.revenueYear1`, `revenueYear2`, `revenueYear3` |
| Current year revenue | ✅ Done | `SalesPlan.revenueYear3` |
| Projection (Annual Target) | ✅ Done | `SalesPlan.targetRevenue` |
| Quarterly breakdown (AMJ, JAS, OND, JFM) | ✅ Done | `SalesPlanning.q1-q4` with percentage splits |
| Monthly breakdown | ✅ Done | `GET /api/v1/sales/targets/monthly` - all 12 months |
| Weekly breakdown | ✅ Done | `GET /api/v1/sales/targets/weekly` - all 52 weeks |
| ASP / ATS (Average Ticket Size) | ✅ Done | `SalesPlan.averageTicketSize` |
| Conversion Ratio | ✅ Done | `SalesPlan.conversionRate` (percentage) |
| No of enquiries/leads | ✅ Done | Calculated from target ÷ ASP ÷ conversion rate |
| Customer Frequency (70:30 Existing vs New) | 🟡 Partial | `revenueFromExisting`, `revenueFromNewClients` fields exist |

**Gap Actions:**
1. Add UI for 70:30 existing vs new customer split (data captured, just needs visibility)

---

### Sheet 3: Development Activities

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| **Products Category:** | | |
| Creating weekly social media content | ✅ Template | ActivityTemplate exists |
| Creating monthly ad campaign | ✅ Template | Can be added as template |
| Creating delight for existing clients | ✅ Template | Can be added as template |
| Participating in Exhibitions | ❌ Missing | Not in current templates |
| Creating communities | ❌ Missing | No community feature |
| Reconnecting with 2 past clients/week | ✅ Template | "Client check-in calls" template exists |
| **Services Category:** | | |
| Creating Educative Bite Sized Workshops | ❌ Missing | Not in templates |
| **Weekly Target System** | ✅ Done | `ActivityConfiguration.weeklyTarget` |
| **Category Selection** | ✅ Done | Sales, Marketing, Product Dev, Networking, Operations |

**Gap Actions:**
1. Add more activity templates: Exhibitions, Workshops, Communities
2. Consider separate "Products" vs "Services" activity grouping

---

### Sheet 4: Sales Tracker

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| Monthly sales tracker (12 months) | ✅ Done | `SalesTracking` model with `month` field (YYYY-MM) |
| Target per month | ✅ Done | `SalesTracking.target` |
| Actual per month | ✅ Done | `SalesTracking.actual` |
| MTD (Month to Date) | ✅ Done | `SalesTracking.mtd` |
| YTD (Year to Date) | ✅ Done | `SalesTracking.ytd` |
| Orders count | ✅ Done | `SalesTracking.orders` |
| ASP | ✅ Done | `SalesTracking.asp` |
| Profit | ✅ Done | `SalesTracking.profit` |
| Expenses | ✅ Done | `SalesTracking.expenses` |

**Status: COMPLETE ✅**

---

### Sheet 5: Sales Cycle

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| Customizable stages | ✅ Done | `SalesCycleStage` model with name, order, color, probability |
| Default stages | ✅ Done | Lead → Qualified → Proposal → Negotiation → Closed |
| Visual pipeline | 🟡 Partial | Stages configured, no Kanban board view |

**Gap Actions:**
1. Add Kanban-style deal board showing deals by stage (nice-to-have)

---

### Sheet 6: Visual

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| Graphical representation of target vs achievement | ✅ Done | Line charts, bar charts on Dashboard |
| Graphical representation of input activities | ✅ Done | Pie charts on Insights page |
| Red flags if none has been done | ✅ Done | Flag system (Red <40%, Yellow 40-69%, Green ≥70%) |
| Green flags / wows if in place | ✅ Done | Flag system implemented |
| Connecting all users to single community | ❌ Missing | No community feature |
| Pre-recorded tutorials on usage | ❌ Missing | No tutorial/onboarding videos |

**Gap Actions:**
1. Add community feature (forum/discussion board)
2. Add tutorial videos or interactive walkthrough

---

### Sheet 7: Commercial

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| 999 for a year | 🟡 Partial | Subscription model exists, pricing not configured |
| 1st month complimentary | ❌ Missing | No trial period logic implemented |
| Payment starts post 30 days | ❌ Missing | No payment gateway integration |
| Google Calendar integration | ❌ Missing | Not implemented |

**Gap Actions:**
1. Implement 30-day trial period with `trialEndsAt` field (exists in schema)
2. Integrate Stripe for payment processing
3. Add Google Calendar OAuth and sync

---

### Sheet 8: Target Achievement Stages

| Requirement | Status | Implementation Details |
|-------------|--------|------------------------|
| 0.1 Define USP | ❌ Missing | No USP field/step |
| 0.2 Define Menu Card | ❌ Missing | Not implemented |
| 0.3 Define Packages Combo offers | ❌ Missing | Not implemented |
| 0.4 Define Customer segment | 🟡 Partial | B2B/B2C exists, no detailed segmentation |
| 0.5 Reconnecting with existing customer | ✅ Done | Activity templates cover this |
| 0.6 Creating monthly offers | ❌ Missing | Not implemented |
| 0.7 Investing in Google ad | ❌ Missing | No ad tracking |
| 0.8 Creating retention customer delight | ✅ Activity | Can be tracked as activity |
| 0.9 Investing in FB/Insta ad | ❌ Missing | No ad spend tracking |
| 1.0 Creating customer communities | ❌ Missing | No community feature |

**Note:** The current implementation uses **revenue-based stages** (Bronze 25%, Silver 50%, Gold 75%, Platinum 100%) rather than the **activity-based milestones** in the spec.

**Gap Actions:**
1. Consider adding an "Onboarding Checklist" for business setup (USP, Menu Card, Packages, etc.)
2. Add ad spend tracking (Google Ads, FB/Insta)
3. The revenue-based achievement stages are good, but the activity milestones could be added as a separate "Business Setup Progress" feature

---

### Sheets 9 & 10: Navigation/Options

These sheets appear to be website structure and option lists, not direct app requirements.

---

## Priority Gap List (Recommended Order)

### ✅ Implemented (January 4, 2026)
1. **Social Media Links UI** - Edit in Settings page ✅
2. **30-day Trial Banner** - Shows days remaining when on TRIAL status ✅
3. **Pain Points Survey** - 6 checkboxes in Settings page ✅
4. **USP Field** - In Business Setup Checklist ✅
5. **Business Setup Checklist** - 4 steps (USP, Menu Card, Packages, Customer Segment) ✅
6. **Keywords Field** - Added to BusinessIdentity schema ✅
7. **Business Age Field** - Added to BusinessIdentity schema ✅

### Remaining Gaps (From Excel Only)

#### User Profile Sheet:
| Gap | Status | Notes |
|-----|--------|-------|
| Profile Picture | ⏸️ Deferred | Not required now |
| USP (Unique Selling Proposition) | ✅ Done | In Business Setup Checklist |
| Pain Points Survey | ✅ Done | 6 checkboxes in Settings |
| Business Age | ✅ Done | Added to BusinessIdentity schema |
| Logo | ⏸️ Deferred | Not required now |
| Keywords for business | ✅ Done | Added to BusinessIdentity schema |

#### Visual Sheet:
| Gap | Status | Notes |
|-----|--------|-------|
| Pre-recorded tutorials on usage | ⏸️ Deferred | Not required now |

#### Target Achievement Stages Sheet:
| Gap | Status | Notes |
|-----|--------|-------|
| Define USP (Step 0.1) | ✅ Done | In Business Setup Checklist |
| Define Menu Card (Step 0.2) | ✅ Done | In Business Setup Checklist |
| Define Packages/Combo offers (Step 0.3) | ✅ Done | In Business Setup Checklist |
| Define Customer segment (Step 0.4) | ✅ Done | In Business Setup Checklist |

### NOT Gaps (Misinterpreted):
- ~~Community Feature~~ - This was "activity suggestion" not app feature
- ~~Ad Spend Tracking~~ - This was "activity suggestion" not app feature

---

## Files to Modify for Gaps

| Gap | Backend Files | Frontend Files |
|-----|---------------|----------------|
| Profile Pic | `user.service.ts`, `user.controller.ts` | `Settings.tsx` |
| Social Links UI | - | `Settings.tsx` |
| Trial Period | `subscription.service.ts`, `auth.service.ts` | `Dashboard.tsx` (banner) |
| Google Calendar | New `calendar.module.ts` | New `CalendarSync.tsx` |
| Pain Points | `update-profile.dto.ts`, schema | Onboarding step or Settings |
| Tutorials | - | New `Help.tsx` or modal |

---

## Conclusion

The core business logic (Sales Planning, Tracking, Activities, Insights) is **well implemented**. The main gaps are:
- **User profile enrichment** (pain points, social links UI, profile pic)
- **Payment/Trial integration** (Stripe, 30-day trial)
- **Integrations** (Google Calendar)
- **Community features** (not started)

Estimated effort to close all gaps: **2-3 weeks** of focused development.
