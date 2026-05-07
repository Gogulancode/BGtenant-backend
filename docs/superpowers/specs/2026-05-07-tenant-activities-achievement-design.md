# Tenant Activities & Achievement Flow Design

## Goal
After the user finishes sales planning, help them choose the weekly activities and milestone actions that can actually create the target.

## Step 4 Activity Setup
Step 4 should present client-specific activity templates instead of generic categories. Each activity carries:
- category
- priority
- weekly goal
- reminder days
- measurability
- impact
- relevance: product, service, or both

Default templates include social media content, monthly ad campaigns, customer delight/referrals, exhibitions, follow-ups, offers/promotions, retention, and community actions.

## Step 6 Achievement Stages
Step 6 keeps the existing achievement stage model, but the default stages become action-oriented milestones from the workbook:
- Foundation: USP, menu card, packages, customer segment
- Reconnect: existing customer segment
- Offers: monthly offers
- Paid growth: Google/Facebook/Instagram ads
- Retention/community: delight and customer community

These still attach to target percentages so dashboards can keep using the current progress model.

## Backend Design
Extend `ActivityConfiguration` with an `activities` JSON field. The backend stores selected activity templates and returns them for prefill. Existing booleans remain for compatibility.

## Frontend Design
Step 4 becomes a template selection and editing screen. Users can select recommended activities, see why each matters, and adjust weekly goals/reminders.

## Validation
- At least one activity must be selected.
- Weekly goals must be between 1 and 50.
- Reminder days use JavaScript weekday numbering: 0 Sunday through 6 Saturday.
- Achievement stages remain 2-10 stages with unique order values.
