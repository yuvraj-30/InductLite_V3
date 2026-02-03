# Applitools Visual Regression Setup

## Prerequisites

1. **Applitools Account**: Sign up at https://applitools.com
2. **API Key**: Get your API key from Applitools dashboard

## Installation

```bash
cd apps/web
npm install @applitools/eyes-playwright
```

## Configuration

### Environment Variables

```bash
# Required
export APPLITOOLS_API_KEY="your-api-key-here"

# Optional - for CI batching
export APPLITOOLS_BATCH_ID="build-${BUILD_NUMBER}"
```

### GitHub Actions Setup

Add to `.github/workflows/ci.yml`:

```yaml
visual-regression:
  runs-on: ubuntu-latest
  needs: [build]
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4

    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Run visual tests
      env:
        APPLITOOLS_API_KEY: ${{ secrets.APPLITOOLS_API_KEY }}
        APPLITOOLS_BATCH_ID: ${{ github.run_id }}
        CI: true
      run: |
        cd apps/web
        npm run test:visual
```

## Usage

### Running Visual Tests

```bash
# Local (single browser)
npm run test:visual

# CI (cross-browser via Ultrafast Grid)
CI=true npm run test:visual
```

### Test Structure

Visual tests are in `e2e/visual-regression.spec.ts`:

1. **Login Page** - Captures login form baseline
2. **Public Sign-In** - Captures visitor kiosk screens
3. **Admin Dashboard** - Captures authenticated admin views

### Adding New Visual Tests

```typescript
import { test, expect, Target } from "./visual-regression.spec";

test.describe("Visual Regression - New Feature", () => {
  test.skip(!process.env.APPLITOOLS_API_KEY, "APPLITOOLS_API_KEY not set");

  test("new page matches baseline", async ({ page, eyes }) => {
    await eyes.open(page, "InductLite", "New Page Test");
    await page.goto("/new-page");

    // Full page
    await eyes.check("New Page", Target.window().fully());

    // Specific element
    await eyes.check("Header", Target.region(page.locator("header")));

    await eyes.close();
  });
});
```

## Baseline Management

1. **First Run**: Creates baseline screenshots
2. **Subsequent Runs**: Compares against baseline
3. **Differences**: Review in Applitools dashboard
4. **Accept/Reject**: Update baseline or fix regression

## Security Considerations

- API key should be stored in GitHub Secrets, not committed
- Visual tests may capture sensitive data - review baselines
- Consider masking sensitive fields in screenshots

## Troubleshooting

### Tests Skip with "APPLITOOLS_API_KEY not set"

- Ensure environment variable is set
- Check GitHub Secrets configuration

### Baseline Mismatch

- Dynamic content (timestamps) may cause false positives
- Use `Target.window().fully().ignoreDisplacements()` for dynamic layouts

### Timeout Issues

- Increase `eyes.setMatchTimeout(10000)` for slow pages
- Ensure page is fully loaded before `eyes.check()`
