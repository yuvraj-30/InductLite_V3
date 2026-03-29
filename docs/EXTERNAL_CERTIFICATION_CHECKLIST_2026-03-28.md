# External Certification Checklist (2026-03-28)

Purpose: define the exact setup and execution steps needed to move from "locally certified" to "externally proven" for the two features that still benefit from real partner/runtime validation:

- `/admin/integrations/procore`
- `/admin/mobile/native`

This document does not replace the local certification pass. It builds on it.

Related documents:

- [APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md](./APP_TOUR_E2E_CERTIFICATION_PASS_2026-03-28.md)
- [APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md](./APP_TOUR_FEATURE_EXECUTION_MAP_2026-03-28.md)
- [APP_TOUR_ERROR_LOG_2026-03-28.md](./APP_TOUR_ERROR_LOG_2026-03-28.md)

## What "external certification" means

Local certification proves our app logic works in our controlled environment.

External certification means proving the same workflow works when the other side is real:

- a real Procore sandbox or partner acceptance endpoint
- a real iOS/Android wrapper build running on a real device or emulator lane

This is the difference between:

- "our side behaves correctly"
- and
- "the full ecosystem behaves correctly"

## 1. Procore Sandbox Certification

### Goal

Prove that the Procore connector works against a real Procore-compatible sandbox or approved partner acceptance endpoint, not just our local receiver.

### Minimum prerequisites

You need all of these:

1. A real Procore sandbox account or approved test endpoint
2. A test project in that sandbox
3. A known inbound authentication/token contract
4. A safe test company/site in InductLite
5. At least one contractor identity we can map by:
   - email, or
   - contractor name
6. A test operator with access to:
   - `/admin/integrations/procore`
   - `/admin/permits`
   - `/admin/prequalification-exchange`
   - `/admin/webhooks`

### What to configure

In `/admin/integrations/procore`:

1. Select the test site
2. Set:
   - Endpoint URL
   - Project ID
   - Outbound auth token
   - Inbound shared secret
3. Enable:
   - Include sign-in snapshots
   - Include permit snapshots
4. Save connector

### Outbound certification steps

1. Create or confirm at least one recent sign-in for the selected site
2. Create or confirm at least one permit request for the selected site
3. Click `Queue <site>` in the Procore connector page
4. Run the webhook worker if needed
5. Verify that the real Procore sandbox/test endpoint received:
   - `procore.signins.snapshot`
   - `procore.permits.snapshot`
6. Verify the remote endpoint accepted the payload instead of only receiving it

### Inbound certification steps

1. Prepare a real inbound payload from the sandbox or a sandbox-shaped payload accepted by the partner test endpoint
2. Send it to:
   - `POST /api/integrations/procore/workers`
3. Use the configured inbound bearer/shared secret
4. Verify the response reports:
   - `success: true`
   - expected `received`
   - expected `applied`
   - expected `unmatched`
5. Verify in InductLite that the contractor prequalification/readiness state updated correctly

### Pass criteria

Mark Procore externally certified only when all are true:

1. Connector settings save correctly
2. Outbound snapshots are accepted by the real sandbox/test endpoint
3. Inbound worker accepts a real sandbox-compatible payload
4. Mapped contractor prequalification appears correctly in the app
5. Audit / webhook activity reflects the round trip clearly
6. No manual DB repair or route patching is needed

### Evidence to capture

Capture all of these:

1. Screenshot of connector settings
2. Screenshot of queue + sync activity
3. Receiver/sandbox acceptance proof
4. Screenshot of updated contractor prequalification in InductLite
5. Screenshot of related webhook/audit activity
6. Exact payload sample used for certification

### If this fails

Common failure buckets:

1. Auth mismatch
2. Header/format mismatch
3. Project/site ID mismatch
4. Contractor mapping mismatch
5. Sandbox acceptance rules differ from local assumptions

If it fails, log:

- exact endpoint
- exact response code
- exact payload class
- whether outbound or inbound failed

## 2. Native Mobile Runtime Certification

### Goal

Prove that the native mobile runtime flow works on a real iOS/Android wrapper or test build, not only through simulated API calls from the browser.

### Minimum prerequisites

You need all of these:

1. A buildable native wrapper or mobile container
2. At least one test device or reliable emulator lane
3. A test tenant/site with:
   - `PWA_PUSH_V1`
   - `MOBILE_OFFLINE_ASSIST_V1`
   - `GEOFENCE_ENFORCEMENT`
   - `NATIVE_MOBILE_RUNTIME_V1`
4. A site policy mode you want to validate:
   - `OFF`
   - `ASSIST`
   - `AUTO`
5. A reachable app backend
6. A test operator who can view:
   - `/admin/mobile`
   - `/admin/mobile/native`
   - `/admin/live-register`
   - `/admin/history`

### What to test

#### A. Device registration and enrollment

1. Install/open the wrapper app on the device
2. Register or restore the device subscription
3. Confirm the device appears in `/admin/mobile`
4. Issue an enrollment token using the real app flow
5. Confirm the device successfully enrolls

#### B. Bootstrap and heartbeat

1. Launch the app after enrollment
2. Confirm bootstrap succeeds
3. Confirm heartbeat succeeds
4. Verify runtime metadata updates in `/admin/mobile`
   - platform
   - app version
   - OS version
   - channel
   - last seen

#### C. Geofence event behavior

Run this for the policy mode being tested:

1. Generate or simulate an `ENTRY` event
2. Generate or simulate an `EXIT` event
3. Confirm the correct behavior:
   - `OFF`: records/noops without automatic sign-in
   - `ASSIST`: creates hints/prompts
   - `AUTO`: creates automatic check-in or check-out when allowed
4. Confirm duplicates are deduplicated
5. Confirm replay works for delayed events

#### D. Background/runtime behavior

1. Put the app in background
2. Bring it back
3. Confirm token/runtime/session still behave correctly
4. If supported, test delayed event replay after reconnect

### Pass criteria

Mark native mobile externally certified only when all are true:

1. Device shows up in `/admin/mobile`
2. Enrollment token flow works from a real device/runtime
3. Bootstrap succeeds
4. Heartbeat updates the runtime state
5. Geofence events behave correctly for the tested policy mode
6. Replay/deduplication behave correctly
7. The resulting admin surfaces reflect the device activity correctly

### Evidence to capture

Capture all of these:

1. Screenshot/video of device enrollment
2. Screenshot of `/admin/mobile` device row
3. Screenshot/video of runtime bootstrap/heartbeat state
4. Screenshot/video of geofence result
5. Screenshot of resulting admin surface:
   - hint
   - sign-in
   - sign-out
   - history row
6. Runtime logs if available

### If this fails

Common failure buckets:

1. OS permission issues
2. background execution limits
3. wrapper/app lifecycle issues
4. token rotation/version mismatch
5. site entitlement mismatch
6. policy mode mismatch

If it fails, log:

- device type
- OS version
- app version
- wrapper channel
- exact failing API stage
- whether the failure is reproducible

## Recommended test order

1. Procore outbound
2. Procore inbound
3. Native device registration
4. Native enrollment
5. Native bootstrap
6. Native heartbeat
7. Native geofence event
8. Native replay/deduplication

## Fastest way to unblock these externally

### For Procore

Ask for:

1. a sandbox URL
2. auth details
3. a test project ID
4. one sample accepted payload contract

### For native mobile

Ask for:

1. one installable test build
2. one test device or emulator
3. confirmation of expected policy mode for the test site
4. runtime logs if the wrapper provides them

## Final note

We do not need these external steps to say the features work locally.

We only need them if we want to say:

- "this is proven against the real partner/runtime too"

