# NZ Market Competitor Analysis + Cost-Constrained Product Recommendations (2026)

## Scope and method

This document compares InductLite against likely NZ/AU competitors in construction site sign-in + induction workflows and proposes improvements that fit the hard FinOps guardrails.

### Evidence sources used
- Existing competitor map and prioritization in [INDUCTLITE_COSTED_PLAN.md](INDUCTLITE_COSTED_PLAN.md).
- Cost/security constraints in [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md).
- Current implemented capabilities in application code under `apps/web/src/**` and schema under `apps/web/prisma/schema.prisma`.

### Important limitation
Live web retrieval from this environment returned HTTP 403 for external sites during this analysis, so competitor capability claims are grounded in the existing repository evidence and marked accordingly.

---

## 1) NZ market snapshot (practical view)

For NZ construction and maintenance SMBs, the buying criteria are usually:
1. **Fast onsite adoption** (QR + kiosk + minimal training)
2. **Compliance confidence** (audit trails, records export, incident-readiness)
3. **Low operational overhead** (simple setup, low cost, no enterprise bloat)
4. **Mobile reliability** (works in imperfect connectivity and on older phones)

InductLite already aligns strongly with these priorities (QR public flow, tenant isolation, exports, audit capability, and aggressive cost guardrails).

---

## 2) Competitor comparison (NZ-relevant)

> Confidence note: competitor details below are sourced from existing project documentation, not newly fetched external pages in this run.

| Competitor | Positioning signal | Typical strengths | Risk to InductLite | Fit with InductLite cost model |
|---|---|---|---|---|
| SignOnSite | QR/site sign-in + inductions + reporting | polished kiosk/sign-in UX, mature reporting | Medium (feature parity pressure) | Good reference for UX patterns |
| Site App Pro | Site inductions + compliance workflows | broad compliance modules, NZ familiarity | Medium-High (brand/feature depth) | Partial (copy lightweight subset only) |
| HammerTech | enterprise induction + audits + integrations | deep enterprise controls/integrations | Low for SMB, High for enterprise segment | Poor for MVP (too expensive/complex) |
| 1Breadcrumb / similar | contractor/visitor coordination | collaboration features + field workflows | Medium | Moderate if built incrementally |

Source baseline for this table: [INDUCTLITE_COSTED_PLAN.md](INDUCTLITE_COSTED_PLAN.md).

---

## 3) Current InductLite strengths (defensible today)

1. **Security + tenancy by construction**
   - Scoped data access and tenant model protections are implemented in core data access patterns.
2. **Abuse controls built in**
   - Public sign-in/login/sign-out rate-limiting with stable client keys is already present.
3. **Cost-aware export architecture**
   - Queue-backed export processing and strong caps are designed to avoid runaway compute/storage costs.
4. **Operational guardrails**
   - Feature flags, retention controls, and hard limits are explicitly documented and enforced.

Primary evidence: [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md), [INDUCTLITE_COSTED_PLAN.md](INDUCTLITE_COSTED_PLAN.md), and `apps/web/src/lib/**`.

---

## 4) Where competitors can still beat InductLite

1. **Field UX polish**: guided kiosk modes, ultra-low-friction repeat sign-in, stronger multilingual and accessibility-first defaults.
2. **Compliance packaging**: templates, automated reminders, and out-of-the-box regulator/customer-ready reports.
3. **Enterprise hooks** (for upmarket deals): SSO/SCIM/integration depth.

Recommendation: keep SMB-first and avoid enterprise-heavy features until paid demand appears.

---

## 5) Recommended feature roadmap within cost constraints

## P0 (next 4–8 weeks): high impact, low cost

### A) "Fast Repeat Sign-In" lane (returning contractor shortcut)
- **What:** Let known contractors re-sign-in in fewer taps with prefilled profile + explicit confirmation.
- **Why (market):** Competes with polished field UX from SignOnSite/Site App Pro.
- **Cost impact:** Low (extra reads/writes only).
- **Security impact:** Keep tenant scoping + token validation + audit logs for every shortcut flow.
- **Guardrails:** respect public rate limits and no raw SQL.
- **Cheaper fallback:** auto-focus + UX optimizations only, without persistence changes.

### B) Compliance Pack v1 (export presets)
- **What:** One-click export presets: "Daily attendance", "Contractor induction completion", "Site audit trail".
- **Why (market):** Makes reporting parity easier without new infrastructure.
- **Cost impact:** Low-Med (existing export pipeline reuse).
- **Security impact:** unchanged if existing export permission checks remain.
- **Guardrails:** `MAX_EXPORT_ROWS`, `MAX_EXPORT_BYTES`, daily quotas, concurrency caps.
- **Cheaper fallback:** pre-saved filtered views before adding new export templates.

### C) SMS-free reminder engine (email + in-app only)
- **What:** Scheduled reminders for incomplete inductions and expiring docs via existing job pipeline.
- **Why (market):** Delivers perceived sophistication cheaply.
- **Cost impact:** Low if email volume capped; no SMS spend.
- **Security impact:** ensure no sensitive details in email payloads.
- **Guardrails:** keep `SMS_ENABLED=false`; enforce monthly email caps by company.
- **Cheaper fallback:** manual reminder queue UI, no scheduler.

## P1 (8–16 weeks): differentiation for NZ SMB segment

### D) Offline-resilient public sign-in (graceful degraded mode)
- **What:** local queued submissions in browser for transient outages; sync on reconnect.
- **Why:** NZ field sites often have spotty connectivity.
- **Cost impact:** Low infra cost (client-side buffering), moderate engineering complexity.
- **Security impact:** signed payload integrity and expiry checks required on sync.
- **Guardrails:** strict payload size limits; replay prevention.
- **Cheaper fallback:** autosave draft in browser + clear retry UX, no full offline queue.

### E) Site safety briefing acknowledgment block
- **What:** attach daily/site briefing notes and require acknowledgment at sign-in.
- **Why:** adds compliance value without enterprise overhead.
- **Cost impact:** Low (small text records).
- **Security impact:** auditable acknowledgment entries per contractor and site.
- **Guardrails:** retain under audit retention policy.
- **Cheaper fallback:** static message-only banner + audit event.

### F) Lightweight subcontractor portal
- **What:** subcontractor admins can view only their workers' status and induction completion.
- **Why:** key buying signal vs generic visitor apps.
- **Cost impact:** Medium (new RBAC surface).
- **Security impact:** highest risk; must preserve strict tenant + party scoping.
- **Guardrails:** enforce permission checks + cross-tenant/IDOR tests.
- **Cheaper fallback:** scheduled subcontractor PDF/email reports instead of portal.

## P2 (defer unless revenue justifies)

### G) SSO/SAML
- **Why defer:** enterprise-only demand, support burden, higher ongoing costs.
- **Fallback:** magic link + role controls (already aligned with low-cost model).

### H) Deep third-party integrations
- **Why defer:** expensive support matrix and brittle maintenance.
- **Fallback:** robust CSV import/export contracts.

---

## 6) Prioritized backlog with effort vs cost

| Feature | Customer impact | Build effort | Infra cost risk | Recommendation |
|---|---:|---:|---:|---|
| Fast Repeat Sign-In | High | Low-Med | Low | Do now |
| Compliance Pack v1 exports | High | Low | Low-Med | Do now |
| Email/in-app reminders | Med-High | Med | Low | Do now |
| Offline-resilient sign-in | High | Med-High | Low | Pilot at 1-2 customers |
| Safety briefing acknowledgment | Medium | Low | Low | Do now |
| Subcontractor portal lite | High | High | Medium | Prototype only |
| SSO/SAML | Medium (for SMB) | High | Medium-High | Defer |
| Deep integrations | Medium | High | High | Defer |

---

## 7) Pricing/packaging suggestions (cost-safe)

- **Starter (default):** core sign-in + inductions + basic exports + strict quotas.
- **Growth:** higher export quotas, reminder automations, advanced reporting presets.
- **Pro (optional):** subcontractor visibility and premium support.

This aligns with hard budget envelopes in [ARCHITECTURE_GUARDRAILS.md](../ARCHITECTURE_GUARDRAILS.md).

---

## 8) What to implement first (recommended sequence)

1. Fast Repeat Sign-In lane
2. Compliance Pack v1 export presets
3. Email/in-app reminders with hard per-company caps
4. Safety briefing acknowledgment
5. Offline-resilient sign-in pilot

This order maximizes visible market value while keeping implementation and operational cost inside current guardrails.
