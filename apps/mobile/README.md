# InductLite Native Mobile App (iOS + Android)

This is an Expo-managed native app shell for iOS and Android.

The app is production-structured and placeholder-driven so you can:

1. run locally now, and
2. later replace only credentials/account IDs/store metadata.

## What Is Already Implemented

- Secure enrollment token storage (`expo-secure-store`).
- Mobile API client wiring:
  - `POST /api/mobile/geofence-events`
  - `POST /api/mobile/geofence-events/replay`
  - `POST /api/mobile/heartbeat`
- Background geofence task registration and queue replay.
- Device runtime payload (platform/app version/OS/channel).
- Runtime config via `app.config.ts` + `.env` placeholders.
- EAS build/submit config with placeholder credentials.
- Release readiness validation (`npm run -w apps/mobile release:check`) that
  blocks production builds when placeholders are still present.

## Placeholder Files To Replace Later

- `.env.example` -> copy to `.env` and replace values.
- `credentials/android/play-service-account.placeholder.json`
- `credentials/ios/appstore-connect-api-key.placeholder.txt`
- `eas.json` (`submit.production` IDs and paths)

## Local Development

```bash
# from repo root
npm install
npm run -w apps/mobile typecheck
npm run -w apps/mobile start
```

Open in simulator/device:

- iOS: `npm run -w apps/mobile ios`
- Android: `npm run -w apps/mobile android`

## Build Pipelines

```bash
# Validate production credentials/config first
npm run -w apps/mobile release:check

# iOS production build (after replacing placeholders)
npm run -w apps/mobile build:ios

# Android production build (after replacing placeholders)
npm run -w apps/mobile build:android

# Strict ready-only variants (run validation + build)
npm run -w apps/mobile build:ios:ready
npm run -w apps/mobile build:android:ready
```

## Notes

- Real Apple/Google credentials must be kept in secure secret storage, not git.
- The app is intentionally thin and reuses backend APIs already present in `apps/web`.
