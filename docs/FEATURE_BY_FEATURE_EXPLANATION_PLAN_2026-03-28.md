# Feature-by-Feature Explanation Plan (2026-03-28)

Purpose: create a clear, reusable plan for explaining InductLite feature by feature to someone who does not know the product, while also preparing the ground for screenshots and later tutorial videos.

This plan is intentionally written in product language, not developer language.

Related documents:

- [APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md](./APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md)
- [APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md](./APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md)
- [EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md](./EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md)

## What We Are Building

We are building a feature explanation pack in 3 layers:

1. Plain-language feature guide
2. Screenshot-backed walkthroughs
3. Later tutorial videos

The goal is that a third person can:

- understand what the app is
- understand what each feature does
- understand who uses it
- understand why it matters
- see what the feature looks like
- follow the workflow step by step

## Output We Want At The End

### 1. App overview

A simple explanation of:

- what InductLite is
- who it is for
- what business problem it solves
- how the public side and admin side fit together

### 2. Feature-by-feature handbook

For each major feature:

- feature name
- what it does
- who uses it
- when they use it
- why it matters
- simple real-world example

### 3. Screenshot walkthrough pack

For each feature or feature group:

- starting screen
- key actions
- result state
- important statuses/messages

### 4. Tutorial videos later

After screenshots are complete:

- one video per feature group, or
- one video per feature if needed

## Recommended Build Order

We should do this in an order that makes sense to someone learning the product for the first time.

### Phase 1. Product overview and public journey

Explain first:

1. Homepage
2. Login
3. Public sign-in flow

Why first:

- this explains what the product is
- this is the clearest "front door" story
- it helps a third person understand the rest of the admin features

### Phase 2. Operations

Explain next:

1. Dashboard
2. Sites
3. Pre-Registrations
4. Deliveries
5. Resources
6. Live Register
7. Command Mode
8. Sign-In History
9. Audit Analytics
10. Exports

Why next:

- this is the operator workflow core
- it shows how daily site operations are managed

### Phase 3. Safety & Compliance

Explain next:

1. Hazard Register
2. Incidents
3. Action Register
4. Inspections
5. Escalations
6. Permit-to-Work
7. Safety Forms
8. Approvals
9. Communications Hub

Why next:

- this shows how the product handles real-world site safety and compliance control

### Phase 4. Contractors & Content

Explain next:

1. Contractors
2. Templates
3. Risk Passport
4. Competency
5. Trust Graph
6. Benchmarks

Why next:

- this explains contractor readiness, content governance, risk, and scoring

### Phase 5. Integrations & Advanced

Explain next:

1. Webhooks
2. Teams/Slack
3. Procore Connector
4. Prequalification Exchange
5. Mobile Ops
6. Native Runtime
7. Access Ops
8. Evidence Packs
9. Policy Simulator

Why next:

- these are powerful but easier to understand after the operational core is clear

### Phase 6. Administration

Explain last:

1. Users
2. Audit Log
3. Settings
4. Plan Configurator

Why last:

- these are control and governance features rather than first-use journey features

## What Each Feature Entry Should Include

Every feature entry should follow the same format:

1. Feature name
2. Plain-language description
3. Who uses it
4. Main use case
5. Why it matters
6. Typical workflow
7. What the user sees on the screen
8. What success looks like
9. Important notes or limitations

## Screenshot Plan

For each feature or feature group, capture:

1. Landing state
2. Main interaction state
3. Completed or result state
4. Any important queue/status/history state if that feature uses one

When useful, include:

5. Empty state
6. Permission-limited state
7. Error state

## Video Plan

Video comes after the screenshot pack is stable.

Recommended order:

1. Public journey video
2. Operations video
3. Safety & Compliance video
4. Contractors & Content video
5. Integrations & Advanced video
6. Administration video

This is better than trying to make dozens of tiny videos immediately.

## Suggested Working Sequence For Us

### Step 1

Write the plain-language product overview.

### Step 2

Write the feature handbook feature by feature in the phase order above.

### Step 3

Capture screenshots aligned to each written section.

### Step 4

Assemble grouped tutorial videos from the screenshot set.

## Deferred Follow-Up We Must Remember

After the feature-by-feature explanation pack is complete, come back to:

- [EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md](./EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md)

Specifically:

1. real Procore sandbox certification
2. real iOS/Android wrapper/device certification

Those are deferred, not forgotten.

## What I Should Do Next

The next concrete deliverable should be:

1. a plain-language app overview
2. then the Phase 1 feature explanations:
   - homepage
   - login
   - public sign-in flow

