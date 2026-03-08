# Mobile Credentials Placeholders

This folder intentionally contains non-secret placeholder files so the iOS/Android
pipeline is complete before real account credentials are available.

Replace these placeholders with real credentials before production app-store release.

## Files

- `android/play-service-account.placeholder.json`
  - Replace with a real Google Play service account JSON key file.
  - Update `eas.json > submit.production.android.serviceAccountKeyPath` if you use a different file name.
- `ios/appstore-connect-api-key.placeholder.txt`
  - Replace with your real App Store Connect API key metadata and key location.
  - Keep the actual `.p8` key outside git.

## Security

- Never commit real API keys, `.p8` certificates, keystores, or service account credentials.
- Use EAS secrets or CI secret storage for production.
