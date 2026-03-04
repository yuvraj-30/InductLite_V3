# NZ Standard-Plan Parity Check (as of 2026-02-28)

## Purpose
- Verify whether InductLite currently covers features commonly included in competitor "standard"/entry pricing plans.
- This is the pre-check before drafting final `Standard / Plus / Pro` packaging.

## Scope definition
- Pricing band focus: approximately `NZD 69-119 / site / month`.
- Plans used as references in/near this band:
  - SwipedOn `Standard` (`USD 55`, annual; roughly in-band after FX).
  - Sine `Core Small` (`NZD 89` starting).
  - EVA `Business` (`NZD 100`) and EVA `Core` (`NZD 50`, below band but common baseline reference).
  - WorkSite `Silver/Gold` (`NZD 75/100`, plus setup).

## Parity Matrix (Entry/Standard Plans vs InductLite Current)

| Feature seen in entry/standard plans | Competitor evidence | InductLite current status | Parity result |
| --- | --- | --- | --- |
| QR/kiosk check-in flow | SwipedOn Standard, Sine Small, EVA Core | Complete | Match |
| Digital induction forms/questions | EVA Business (induction), WorkSite plans | Complete | Match |
| Digital agreements / signature capture | SwipedOn Standard (digital agreements) | Complete | Match |
| Offline-capable site operation | Sine positioning, Site App Pro market norm, ThinkSafe norm | Complete | Match |
| Badge/label printing | SwipedOn Standard, Sine plan feature lists | Complete for Standard baseline (A4/thermal profiles + print audit evidence) | Match |
| Location-verified check-in (audit mode) | Sine Small, EVA Construction | Complete for Standard baseline (capture + radius evaluation + reporting) | Match |
| Strict geofence deny/override mode | Sine Small geofence automation | Implemented as policy-gated add-on (`OVERRIDE`/`DENY`), not part of Standard default | Intentional non-standard add-on |
| Roll-call emergency operations | Sine Small (roll calls) | Complete for Standard baseline (event lifecycle + accounted/missing + CSV export) | Match |
| Directory sync / SSO depth (AD/Entra/SAML) | EVA Business (AD sync), Sine Medium (Entra/SAML) | Complete baseline (OIDC + Entra SSO, role mapping, auto-provisioning, directory sync API/token rotation) | Match |
| Host notification workflows | Sine Small host notifications, SwipedOn feature table | Complete for Standard baseline (arrival email + dashboard arrival alerts + host targeting) | Match |

## Direct answer
- You now provide the core competitor-standard entry features for Standard baseline parity.
- No remaining baseline parity gap in this matrix.

## What you already do well (standard-tier parity strengths)
1. QR/public-link sign-in.
2. Configurable induction questions.
3. E-signature capture.
4. Offline sign-in queue/sync.
5. Compliance-oriented export/audit foundation.
6. Badge printing with audit evidence.
7. Roll-call emergency event lifecycle with exports.
8. Host-targeted arrival notifications.
9. Location verification in audit mode.

## Recommended "parity-first" sequence (low recurring cost first)
1. Maintain parity features as mandatory Standard defaults.
2. Keep strict geofence/SMS/hardware as explicit add-ons with quotas.
3. Treat advanced enterprise provider variants (for example custom SAML metadata workflows) as optional post-parity expansion.

## Sources
- SwipedOn pricing and plan comparison: https://www.swipedon.com/pricing, https://www.swipedon.com/plan-comparison
- Sine plans: https://www.sine.co/plans/
- EVA pricing: https://www.evacheckin.com/pricing
- WorkSite pricing: https://www.worksite.nz/pricing-2/
- InductLite implementation status evidence:
  - [NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md](NZ_COMPETITOR_FEATURE_MATRIX_2026-02-28.md)
  - [NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md](NZ_COMPETITOR_EVIDENCE_NOTES_2026-02-28.md)
