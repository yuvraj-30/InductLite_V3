# External Certification Request Pack (2026-03-29)

Purpose: give you ready-to-send requests and a practical setup checklist for the two external-proof items we still need beyond local certification.

This document is for:

- internal team requests
- vendor or partner requests
- implementation handoff
- scheduling the final acceptance pass later

Related documents:

- [EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md](./EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md)
- [APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md](./APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md)

---

## 1. Current Honest Status

What is already done:

- the app is fully locally certified
- Procore works in our local-safe partner loop
- native mobile runtime works in our local simulated device loop

What is still needed later:

1. real Procore sandbox or partner acceptance endpoint
2. real iOS or Android wrapper build and device lane

These are not app-logic blockers now. They are external-proof dependencies.

---

## 2. Procore Sandbox Ask

### Short message you can send

> We have completed local certification of the InductLite Procore connector and now need a real sandbox or partner acceptance environment for external verification.  
> Please provide:  
> 1. sandbox endpoint URL  
> 2. auth or token contract  
> 3. test project ID  
> 4. expected inbound and outbound payload requirements  
> 5. one approved test window for certification  
> We already have the local connector flow working, so this is for final partner-side acceptance proof rather than initial development.

### What we need back

1. sandbox base URL
2. outbound auth token or key
3. inbound secret or accepted auth method
4. project ID
5. any required headers
6. sample accepted payload
7. contact person for troubleshooting during the test window

### What we will do once we have it

1. configure `/admin/integrations/procore`
2. queue outbound sync
3. verify sandbox acceptance of sign-in and permit snapshots
4. send inbound contractor profile payload
5. verify the resulting contractor readiness update in the app

---

## 3. Native Mobile Ask

### Short message you can send

> We have completed local API-level certification for the InductLite native mobile runtime and now need a real device lane for external validation.  
> Please provide:  
> 1. installable iOS or Android test build  
> 2. one physical device or stable emulator lane  
> 3. build channel or version details  
> 4. runtime logging access if available  
> 5. confirmation of the site and policy mode we should validate  
> We already have the backend and runtime flow working locally, so this is for final wrapper and device proof.

### What we need back

1. test build or distribution link
2. target platform
3. device details or emulator access
4. runtime log access
5. site and policy mode to validate
6. test window

### What we will do once we have it

1. install the build
2. enroll the device
3. confirm bootstrap and heartbeat
4. trigger entry and exit events
5. verify the resulting admin-side behavior
6. verify replay and deduplication

---

## 4. Internal Scheduling Checklist

Before running the final external proof:

1. confirm local build is green
2. confirm seeded tenant and feature flags match the intended test case
3. confirm screenshots or recordings will be captured
4. confirm the right operator accounts exist
5. confirm the test window is reserved

## 5. Evidence We Should Save Later

For both Procore and native mobile:

1. screenshots of the configuration page
2. screenshots of the resulting admin-side records
3. raw request and response proof where safe
4. a short written pass or fail note
5. any runtime logs

## 6. Decision Rule

Once these external dependencies are available, we should not redesign anything first.

We should simply:

1. run the checklist in [EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md](./EXTERNAL_CERTIFICATION_CHECKLIST_2026-03-28.md)
2. capture evidence
3. record the result in the certification docs
