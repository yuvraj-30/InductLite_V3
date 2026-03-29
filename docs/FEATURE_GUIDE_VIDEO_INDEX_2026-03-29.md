# InductLite Feature Guide Video Index (2026-03-29)

Purpose: provide a single place to open the screenshot-backed tutorial videos generated from the feature guide pack.

These videos are:

- screenshot-backed
- caption-led
- silent by design
- grouped by product phase

They work best alongside:

- [FEATURE_GUIDE_INDEX_2026-03-28.md](./FEATURE_GUIDE_INDEX_2026-03-28.md)
- [FEATURE_GUIDE_DEMO_SCRIPT_2026-03-29.md](./FEATURE_GUIDE_DEMO_SCRIPT_2026-03-29.md)

## Videos

1. [Full Product Tour](./videos/feature-guide/2026-03-29/00-full-product-tour.mp4)
2. [Phase 1: Public Journey](./videos/feature-guide/2026-03-29/01-public-journey.mp4)
3. [Phase 2: Operations](./videos/feature-guide/2026-03-29/02-operations.mp4)
4. [Phase 3: Safety & Compliance](./videos/feature-guide/2026-03-29/03-safety-compliance.mp4)
5. [Phase 4: Contractors & Content](./videos/feature-guide/2026-03-29/04-contractors-content.mp4)
6. [Phase 5: Integrations & Advanced](./videos/feature-guide/2026-03-29/05-integrations-advanced.mp4)
7. [Phase 6: Administration](./videos/feature-guide/2026-03-29/06-administration.mp4)

## What Each Video Covers

- `Full Product Tour`: one combined walkthrough of the whole product from public entry to administration
- `Public Journey`: homepage, login, public sign-in flow
- `Operations`: dashboard, sites, preregistrations, deliveries, resources, live register, command mode, history, analytics, exports
- `Safety & Compliance`: hazards, incidents, actions, inspections, escalations, permits, forms, approvals, communications
- `Contractors & Content`: contractors, templates, risk passport, competency, trust graph, benchmarks
- `Integrations & Advanced`: webhooks, channels, Procore, prequalification exchange, mobile, native runtime, access ops, evidence, policy simulator
- `Administration`: users, audit log, settings, plan configurator

## Regenerating The Videos

The generator script is:

- [generate_feature_guide_videos.py](../scripts/generate_feature_guide_videos.py)

Run it from the repo root with:

```powershell
python scripts/generate_feature_guide_videos.py
```

## Deferred Reminder

The videos reflect the current locally certified product state.

The remaining later external-proof follow-up is still:

1. real Procore sandbox certification
2. real iOS/Android wrapper or device certification
