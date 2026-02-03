# InductLite — Cost‑Conscious Product & Architecture Plan

_Status: This document summarizes the competitor feature map, costed architecture recommendations, budget compliance checks, guardrails and prioritized roadmap for InductLite. This aligns with the hard NZD monthly budgets and you selected: Option A (schema‑per‑worker for CI + runId namespacing)._ ✅

---

## 1) Competitor Feature Map (grounded) 📋

> Entries are drawn from competitor public pages you provided.

| Competitor   | Observed capability (public pages)              | MVP / Nice‑to‑Have / Avoid | Complexity | Cost impact | Recommendation                              |
| ------------ | ----------------------------------------------- | -------------------------: | ---------: | ----------: | ------------------------------------------- |
| SignOnSite   | QR/site sign‑in, induction templates, reporting |                        MVP |        Low |         Low | Adapt (UX patterns for QR/kiosk)            |
| SiteDocs     | Document library + compliance PDFs              |       Nice‑to‑Have (light) |        Med |      Medium | Adapt (limit storage/retention)             |
| HammerTech   | Site induction + audits + SSO integrations      |          Nice (enterprise) |       High |        High | Out of Scope (Cost) for MVP; consider later |
| SaferMe      | QR-enabled inductions + team check-ins          |                        MVP |        Low |         Low | Adopt (QR + lightweight team reports)       |
| Sitemate     | Mobile-focused site apps + forms                |                       Nice |        Med |      Medium | Adapt (PWA-lite, not native)                |
| EVA Check‑in | Visitor management, QR check-ins                |                        MVP |        Low |         Low | Adopt (visitor flows & tokenized sign-out)  |
| SiteConnect  | Visitor management + contractor tracking        |                 MVP / Nice |        Med |      Medium | Adapt (limited attendance exports)          |

> Note: I can produce a 1‑page UX mock of recommended QR & kiosk flows on request.

---

## 2) Costed Architecture Recommendations (practical, budget-aware) 🔧

**High‑level stack (keeps within bootstrapped budgets):**

- App: Next.js App Router + Server Actions (single app instance; minimal autoscale).
- DB: Single managed Postgres primary (single region). Use schema‑per‑worker for tests only.
- Queue: pg‑boss on the same Postgres instance.
- Storage: S3‑compatible (Backblaze B2 / DO Spaces for cost savings; fallback S3).
- Rate limiting: Postgres counters (MVP); add Redis/Upstash at Growth if needed.
- Background workers: small worker instances (Docker on Render / DO).
- Logging/audit: structured logs to files + periodic upload to S3 with short retention.

For each item: Why · Cost impact · Cheaper fallback

### DB schema / queries impact

- **What:** Single Postgres primary; enforce `company_id` on all queries; DB constraints and optional RLS for premium.
- **Why:** Low cost, strong app-layer control.
- **Cost impact:** Low.
- **Cheaper fallback:** N/A (required security invariant).

### Job queue / exports

- **What:** Use pg‑boss to stream CSV/PDF to S3 in chunks; cap concurrency; stream to S3 to avoid memory pressure.
- **Why:** No extra infra; keeps costs low.
- **Cost impact:** Low–Medium (CPU for exports).
- **Cheaper fallback:** Enforce per‑company export limits and off‑peak scheduling.

### Storage + retention defaults

- **What:** Default retention: files 90d, exports 30d; max upload 5MB.
- **Why:** Controls storage costs and risk.
- **Cost impact:** Low.
- **Cheaper fallback:** Make longer retention a paid feature.

### Logging + audit defaults

- **What:** Critical audit events in a DB (90d); app logs rotated and stored to S3 (30d); cheap aggregators optional.
- **Why:** Compliance and lightweight ops; no expensive SIEM.
- **Cost impact:** Low.
- **Cheaper fallback:** Shorter retention (e.g., 14d).

### Rate limiting approach

- **What:** Postgres sliding windows keyed by `runId`/`clientKey` and IP; optionally add Redis later.
- **Why:** Avoids extra service cost initially; still reliable.
- **Cost impact:** Low to start; Medium if Redis used.
- **Cheaper fallback:** Lower QPS and per‑company throttles.

### Tenant isolation enforcement mechanism

- **What:** Application-level mandatory `company_id` param, DB constraints, unique indices, optional RLS for strict auditing.
- **Why:** Security invariant; avoids per-tenant DBs.
- **Cost impact:** Low.
- **Cheaper fallback:** None — required.

---

## 3) Budget Compliance Check (numbers & mitigations) 💰

Assumptions: light usage; approximate pricing.

### A) MVP (0–10 companies, <2k sign-ins/month): target ≤ NZD 150/mo

- **Expected cost drivers:** Postgres (NZD 30–70), App+worker (NZD 40–80), Storage (NZD 0–5), Bandwidth (NZD 0–10), CI (NZD 0–20).
- **Risks:** spikes, heavy attachments, SMS costs.
- **Mitigations:** cap storage, throttle exports, batch heavy jobs.

### B) Early (10–50 companies, <20k sign-ins/month): target ≤ NZD 500/mo

- **Expected cost drivers:** Postgres (NZD 80–150), App fleet (NZD 120–250), Storage (NZD 10–50), Optional Redis (NZD 5–40), Email/SMS (variable).
- **Risks:** export frequency, attachments.
- **Mitigations:** quotas, retention, monitoring.

### C) Growth (50–200 companies, <150k sign-ins/month): target ≤ NZD 2,000/mo

- **Expected cost drivers:** Postgres HA (NZD 300–700), App fleet (NZD 700–1,200), Storage (NZD 100–300), Redis (NZD 50–300), Email/SMS variable.
- **Risks:** spikes, egress for exports.
- **Mitigations:** tiered pricing, off‑peak exports, throttles.

> **If any feature would push costs beyond these targets, mark it “Out of Scope (Cost)” and propose a cheaper path.**

---

## 4) Guardrails (hard limits to implement in code) 🛡️

Implement as env defaults and DB overrides with auditing:

- Max upload file size: **5 MB** (configurable per tier). ⚠️
- Max retention days: **files 90d**, **exports 30d**. ⚠️
- Max export size: **50k rows OR 100 MB** (larger exports chunked or premium). ⚠️
- Max exports/day/company: **5** (default). ⚠️
- Sign‑in throttle per site: **30 sign-ins/min/IP** and **200/min/site**. ⚠️
- SMS/email cap: **100 messages/month free**, overage paid. ⚠️
- Kill switches: admin toggles to disable exports, VRT uploads, heavy jobs. ✅

---

## 5) Final Recommendations — Prioritized (P0 / P1 / P2) 🔥

**P0 (Must do now)**

- Enforce `company_id` in repository + tests ✅
- Storage & retention guardrails (5MB, 90d) ✅
- Limit export concurrency & size; queue long jobs off‑peak ✅
- Postgres + pg‑boss + audit log with retention ✅

**P1 (Next, high ROI)**

- Add `runId` namespacing and `workerUser` clientKey propagation (finish globally) ✅
- **Schema‑per‑worker for CI** (tests only) — Option A (fast win) ⚡
- Postgres-based rate limiting fallback ✅

**P2 (Later / optional)**

- Per‑worker Testcontainers for enterprise CI — **Out of Scope (Cost)** until growth.
- RLS + hardened tenant features (on for high-security tenants) — medium complexity.
- Advanced observability (paid SIEM) — **Out of Scope (Cost)** until needed.

---

## Quick actionable plan (next steps)

- **You selected Option A**: Implement **schema‑per‑worker CI** + finalize global `runId` namespacing for rate-limit keys and tests. Estimated **2–3 days** + CI tuning.

---

_Documented by the InductLite Architecture & FinOps team. Keep this file for reference and update as the product evolves._
