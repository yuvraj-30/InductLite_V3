🤖 Master Instructions for AI Developer: InductLite_V3 Feature Implementation
Role: You are a Senior Full-Stack Engineer and Architect specializing in Next.js 16 (App Router), TypeScript, Prisma, and TurboRepo.
Objective: Implement a series of enterprise-grade features, security hardening, and optimizations for the InductLite_V3 repository.
Strict Constraint: All implementations must use Zero-Cost solutions (Free Tier services or Open Source libraries). Do not suggest paid services (e.g., Twilio, AWS Lambda, Auth0).

🏗️ Phase 1: Infrastructure & Configuration Hardening
1.1 Database Connection Pooling
Context: We use Neon Postgres in a serverless environment (Render).

Action: Modify apps/web/prisma/schema.prisma.

Instruction: Ensure the url environment variable points to the Neon Pooler Endpoint (port 6543) for the deployed app. Use directUrl specifically for migrations.

Goal: Prevent "Max Connections" errors during load spikes.

1.2 Cron Job Security Defense-in-Depth
Context: Cron jobs currently use CRON_SECRET.

Action: Update apps/web/src/lib/cron.ts.

Instruction: Implement an IP Allowlist check in addition to the secret check. Only accept requests from GitHub Actions IP ranges or Render’s internal IPs if detectable.

1.3 Secrets & Session Rotation
Context: Using iron-session for stateless auth.

Action: Update apps/web/src/lib/auth/session-config.ts.

Instruction:

Refactor password (secret) to accept an array of keys to allow zero-downtime rotation.

Ensure cookieOptions.secure is strictly set to true when NODE_ENV === 'production'.

🛡️ Phase 2: Security & Authentication System
2.1 Multi-Factor Authentication (MFA)
Library: otplib (Free).

Action: Enhance the Admin Login flow.

Instruction:

Add a totpSecret column to the User table (encrypted).

Update the login flow: After email/password validation, prompt for a 6-digit TOTP code if MFA is enabled.

2.2 Magic Link Login (Passwordless)
Action: Create a passwordless entry for Contractors.

Instruction:

Create a MagicLinkToken table in Prisma.

Flow: Generate crypto-secure token -> Hash & Save -> Email link (/verify?token=xyz) using Resend.

2.3 Role-Based Access Control (RBAC) - Site Managers
Action: Introduce a middle-tier role.

Instruction:

Update Prisma Role enum to include SITE_MANAGER.

Add a sitesManaged relation to the User table.

Update apps/web/src/lib/auth/guards.ts to allow Site Managers access ONLY to their assigned sites.

Strict Rule: Site Managers must not have access to global Audit Logs or Template deletion.

🚀 Phase 3: Core Feature Implementation
3.1 Email Notifications
Service: Resend (Free Tier).

Instruction:

Integrate Resend SDK.

Create a background queue (using the existing Scheduler API pattern) to send emails asynchronously.

Triggers: Send email to Admin on "Red Flag" answers; Send PDF certificate to Contractor on completion.

3.2 QR Code Generation
Library: qrcode.react (Client-side generation).

Instruction:

In the Admin Dashboard (/admin/sites/[id]), add a "Print Gate Poster" button.

Generate a QR code pointing to the specific site's induction URL (/s/[slug]).

3.3 Conditional Logic ("Skip Logic")
Action: Update the Form Builder.

Instruction:

Add a logic JSON field to the Question Prisma model.

Update question-builder.tsx to read this logic (e.g., if answer == 'No', skip next 2 questions).

3.4 Webhooks & Turnstile Integration
Action: Allow external systems to know when a worker is inducted.

Instruction:

Add a webhooks field (JSON) to the Site model.

When an induction is passed, fire a POST request using native fetch to the configured URL.

3.5 Version Control for Safety Content
Context: Safety rules change, requiring re-induction.

Action: Add Expiry Logic.

Instruction:

Add a forceReinduction boolean to the Template update action.

Logic: If checked, query all Active inductions for that site, mark as EXPIRED, and trigger an email notification via Resend.

3.6 Weekly "Monday Morning" Digest
Action: Automated Reporting.

Instruction:

Create a new API route api/cron/digest.

Logic: Query stats (Inductions last 7 days, Red Flags detected, Licenses expiring soon).

Output: Render a simple HTML email and send via Resend to all Admins.

Schedule: Update GitHub Actions cron to trigger this every Monday at 8:00 AM.

3.7 "Red Flag" Instant Alerts
Action: Real-time Safety Warnings.

Instruction:

Add a redFlag boolean to the Question model.

Logic: During submission processing, if a user answers "YES" to a Red Flag question, immediately queue a high-priority email to the assigned Site Manager.

Constraint: Do NOT use SMS. Use Email (Resend) only.

🎨 Phase 4: Frontend, UX & Accessibility
4.1 Digital Signatures (Legal Compliance)
Library: react-signature-canvas.

Instruction:

Add a "Sign Off" step to the induction wizard.

On submit, convert canvas to Base64 PNG.

Upload to R2 (using existing storage logic) and save the URL in the Induction table.

4.2 "Kiosk Mode" (Site Operations)
Action: specialized view for shared tablets.

Instruction:

Create a route /s/[slug]/kiosk.

Logic:

Auto-refresh page 10 seconds after success/failure (using setTimeout).

Hard disable autocomplete (autoComplete="off") on all inputs to prevent data leakage.

Hide the "Logout" button.

4.3 Offline Support (PWA)
Library: next-pwa.

Instruction:

Configure next.config.js to cache static assets.

Implement localStorage persistence for induction forms so data is saved on every keystroke.

4.4 Optimistic UI
Context: React 19 / Next.js 16.

Instruction:

Refactor Admin actions (Archive Site, Delete Template) to use the useOptimistic hook.

Ensure the UI updates instantly before the server response confirms the action.

4.5 Accessibility (A11y) Testing
Library: axe-playwright.

Instruction:

Update e2e tests to inject axe-core.

Fail the build if critical accessibility violations (keyboard traps, missing aria-labels) are detected.

🔍 Phase 5: SEO & Safety
5.1 SEO Pack
Instruction:

Add apps/web/src/app/sitemap.ts to dynamically generate routes for public sites.

Implement generateMetadata in src/app/s/[slug]/page.tsx for dynamic OpenGraph images and titles.

5.2 File Upload Safety (Zero-Cost Virus Check)
Library: file-type.

Instruction:

In the upload API route, read the file header/magic numbers before saving.

Reject files where the extension (e.g., .pdf) does not match the actual MIME type (e.g., .exe).

🧪 Phase 6: Quality Assurance
6.1 Load Testing
Tool: k6 (Open Source).

Instruction:

Create a script to simulate 100 concurrent users submitting inductions.

Add a GitHub Action to run this against a staging environment periodically.

✅ Authorized Actions (Permissions)
Schema Updates: You are authorized to modify apps/web/prisma/schema.prisma and generate migrations (e.g., npx prisma migrate dev) as required for new features (e.g., adding MagicLinkToken, Signature, Logic, Webhooks).

Environment Variables: You are authorized to add necessary Environment Variables to .env (and .env.example) to support new integrations (e.g., RESEND_API_KEY, NEXT_PUBLIC_APP_URL).

Dependency Installation: You are authorized to install the specific Zero-Cost libraries listed in these phases (e.g., resend, otplib, qrcode.react).

🚫 Critical "Don't" List (Guardrails)
NO Paid Services: Do not use Twilio, SendGrid, AWS Lambda, or Auth0. Use the specified free alternatives.

NO SMS: Use Email or PWA Push Notifications instead.

NO Raw Prisma Queries: You must use the ScopedDB client (src/lib/db/scoped-db.ts) for all feature work to prevent data leaks.

NO Class Components: Use React Functional Components and Hooks only.

## 9) Context Caching Strategy (REQUIRED)

To maintain Zero-Cost compliance and minimize token usage, the following files are considered **Cached Context**. You must assume these files are loaded into your memory. Do not request to `read_file` them unless you suspect they have changed during the current session.

**Cached Files:**

1. `docs/AI_MASTER_PLAN.md` (The Feature Implementation Plan)
2. `ARCHITECTURE_GUARDRAILS.md` (Security & Cost Rules)
3. `apps/web/prisma/schema.prisma` (Database Schema)
4. `apps/web/package.json` (Dependencies)

**Instruction:** When initializing a task, I will pin these files. You will ingest them once. For all subsequent turns, rely on your cached understanding of the DB schema and Architecture constraints to avoid unnecessary token consumption.

## 5. CI/CD Protocol (GitHub CLI)

You have access to the `gh` CLI. You must use it to verify remote stability.

**The "Watch & Fix" Loop:**
After pushing any code:

1. **Trigger:** `gh run watch` to tail the workflow.
2. **Investigate:** If it fails, strictly use `gh run view --log-failed` to diagnose the _remote_ environment (which may differ from local).
3. **Resolution:** Fix the error -> Commit -> Push -> Watch again.
4. **Merge:** Only merge (`gh pr merge --squash`) when the remote run is Green.

## 🚀 Phase 7: Enterprise Competitor Features (Zero-Cost)

### 7.1 Photo Verification (Anti-Buddy Punching)
- **Context:** Verify who is actually signing in.
- **Action:** Add `photo_url` to `SignInRecord`.
- **UI:** Add Camera step to induction wizard using HTML5 `getUserMedia`.
- **Storage:** Upload compressed JPG to S3/R2.

### 7.2 GPS Geofence Check
- **Context:** Ensure users are physically on-site.
- **Action:** Add `latitude` and `longitude` to `Site` model.
- **Logic:** On Client Sign-in, capture `navigator.geolocation`. Calculate distance using Haversine formula.
- **Constraint:** Do NOT use Google Maps API (Cost). Use client-side math.

### 7.3 Emergency Push Alerts
- **Context:** Evacuation warnings without SMS costs.
- **Action:** Store `PushSubscription` JSON in `SignInRecord`.
- **Logic:** Admin clicks "Evacuate". Server loops through active sign-ins and sends Web Push payload.
