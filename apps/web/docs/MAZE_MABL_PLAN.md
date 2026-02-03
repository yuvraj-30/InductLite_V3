# Maze Analytics & mabl Testing Plan

## Overview

This document outlines the integration plans for:

- **Maze** - User research and usability testing analytics
- **mabl** - Intelligent test automation with AI-powered maintenance

## Maze Integration Plan

### Purpose

Track user behavior and gather insights on the public sign-in kiosk experience to identify UX friction points.

### Key Flows to Instrument

#### 1. Public Sign-In Flow

- **Entry Point**: QR code scan → `/s/{slug}`
- **Critical Steps**:
  1. Landing page load time
  2. Form field completion rate
  3. Validation error frequency
  4. Induction question completion time
  5. Sign-out link interaction

#### 2. Self-Service Sign-Out

- **Entry Point**: Sign-out link from SMS/email
- **Critical Steps**:
  1. Link click-through rate
  2. Phone verification success rate
  3. Confirmation page reach

### Maze Clip Configuration

```javascript
// Add to public pages (sign-in, sign-out)
window.mazeUniversalSnippetApiKey = "MAZE_API_KEY";

// Track custom events
window.maze?.track("sign_in_started", {
  site_slug: slug,
  visitor_type: visitorType,
});

window.maze?.track("induction_completed", {
  duration_seconds: inductionDuration,
  questions_count: questionCount,
});

window.maze?.track("sign_out_completed", {
  method: "self_service", // or "admin"
});
```

### Heatmap Targets

- Sign-in form (mobile & desktop)
- Induction question pages
- Confirmation/success screens

### A/B Test Candidates

1. Form layout (single page vs multi-step)
2. Progress indicator styles
3. CTA button copy ("Continue" vs "Next" vs "Submit")

---

## mabl Integration Plan

### Purpose

Automated regression testing with AI-powered test maintenance. mabl reduces test flakiness and adapts to minor UI changes.

### Test Coverage Areas

#### Critical Path Tests

| Test Name             | Flow                        | Priority |
| --------------------- | --------------------------- | -------- |
| Happy Path Sign-In    | Full sign-in with induction | P0       |
| Admin Login           | Login → Dashboard access    | P0       |
| Sign-Out Self-Service | Token-based sign-out        | P0       |
| Site Management       | Create/Edit/Deactivate site | P1       |
| Template Management   | Create/Publish template     | P1       |
| History Search        | Filter and export history   | P1       |
| Rate Limit Trigger    | Brute force prevention      | P2       |

#### Accessibility Tests

- Keyboard navigation through forms
- Screen reader compatibility
- Color contrast validation
- Focus indicator visibility

### mabl Configuration

#### Environment Setup

```yaml
# mabl-config.yml
application:
  name: InductLite
  url: https://staging.inductlite.com

environments:
  - name: staging
    url: https://staging.inductlite.com
  - name: production
    url: https://app.inductlite.com

credentials:
  - name: admin_user
    email: "${MABL_ADMIN_EMAIL}"
    password: "${MABL_ADMIN_PASSWORD}"
```

#### Test Plans

**Smoke Test Suite** (Run on every deploy)

- Login functionality
- Public sign-in page loads
- Critical API endpoints respond

**Regression Suite** (Run nightly)

- Full sign-in/sign-out flows
- Admin CRUD operations
- Cross-browser compatibility

**Accessibility Suite** (Run weekly)

- WCAG 2.1 AA compliance checks
- Keyboard-only navigation
- Screen reader announcements

### API Testing

mabl can also test API endpoints:

```javascript
// Test tenant isolation
describe("API Security", () => {
  it("should not return other tenant's data", async () => {
    const response = await api.get("/api/admin/sites", {
      headers: { Cookie: tenantACookie },
    });

    // Verify no tenant B sites in response
    assert.notInclude(response.data, tenantBSiteId);
  });
});
```

### CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/mabl.yml
name: mabl Tests

on:
  deployment_status:
    types: [success]

jobs:
  mabl-tests:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Run mabl tests
        uses: mablhq/github-run-tests-action@v1
        with:
          api-key: ${{ secrets.MABL_API_KEY }}
          application-id: ${{ secrets.MABL_APP_ID }}
          environment-id: ${{ secrets.MABL_ENV_ID }}
          plan-labels: smoke
```

### Alert Configuration

| Condition                     | Alert Channel      | Severity |
| ----------------------------- | ------------------ | -------- |
| Test failure                  | Slack #engineering | Warning  |
| 3+ consecutive failures       | PagerDuty          | Critical |
| Visual regression detected    | Slack #design      | Info     |
| Performance degradation > 20% | Slack #engineering | Warning  |

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)

- [ ] Set up Maze account and obtain API key
- [ ] Set up mabl account and create application
- [ ] Add Maze snippet to public pages
- [ ] Create first mabl test (happy path sign-in)

### Phase 2: Core Coverage (Week 3-4)

- [ ] Implement all P0 mabl tests
- [ ] Configure Maze funnels for sign-in flow
- [ ] Set up CI/CD integration for mabl
- [ ] Create baseline heatmaps in Maze

### Phase 3: Expansion (Week 5-6)

- [ ] Add P1 mabl tests
- [ ] Configure Maze session recordings
- [ ] Set up cross-environment testing
- [ ] Establish alerting workflows

### Phase 4: Optimization (Ongoing)

- [ ] Review mabl test reliability
- [ ] Analyze Maze insights monthly
- [ ] Iterate on A/B tests based on data
- [ ] Expand test coverage for new features

---

## Security Considerations

### Maze

- Mask sensitive fields (phone, email) in recordings
- Exclude admin pages from tracking
- Review session recordings for accidental data exposure

### mabl

- Store credentials in mabl's secure credential manager
- Use test accounts, not production user data
- Restrict mabl API key permissions
- Enable IP allowlisting for mabl runners

### Data Retention

- Maze: 90 days for session recordings
- mabl: 30 days for test artifacts
- Neither should store PII long-term

---

## Metrics & KPIs

### Maze Metrics

- Sign-in completion rate (target: >95%)
- Average sign-in time (target: <60 seconds)
- Form abandonment rate (target: <5%)
- Error encounter rate (target: <10%)

### mabl Metrics

- Test pass rate (target: >99%)
- Test execution time (target: <5 minutes for smoke)
- False positive rate (target: <1%)
- Time to detect regression (target: <30 minutes)

---

## Contacts & Resources

| Service | Dashboard                 | Documentation         |
| ------- | ------------------------- | --------------------- |
| Maze    | https://maze.co/dashboard | https://help.maze.co  |
| mabl    | https://app.mabl.com      | https://help.mabl.com |

For API keys and access, contact the engineering lead.
