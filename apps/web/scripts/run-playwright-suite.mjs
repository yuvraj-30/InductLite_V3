import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'smoke';

const suites = {
  smoke: ['e2e/public-signin.spec.ts', 'e2e/admin-auth.spec.ts', 'e2e/csrf-security.spec.ts', '--project=chromium', '--workers=1'],
  full: ['e2e', '--project=chromium', '--project=firefox', '--project=webkit', '--workers=8', '--reporter=line', '--grep-invert', 'Visual Regression|Kiosk Mode|Accessibility Checks|Admin Export UI & Processing|VRT -'],
  fullAll: ['e2e', '--project=chromium', '--project=firefox', '--project=webkit', '--workers=1', '--reporter=line'],
  visual: ['e2e/visual-regression.spec.ts'],
};

function hasBrowser() {
  const r = spawnSync('npx', ['playwright', 'install', '--dry-run'], { encoding: 'utf8' });
  return r.status === 0;
}

const missingEnv = [];
for (const key of ['DATABASE_URL', 'NEXT_PUBLIC_APP_URL']) {
  if (!process.env[key]) missingEnv.push(key);
}

if (missingEnv.length > 0 || !hasBrowser()) {
  console.warn(`[e2e:${mode}] Skipping Playwright suite due to missing prerequisites (${missingEnv.join(', ') || 'browser binaries'}).`);
  process.exit(0);
}

const args = ['playwright', 'test', ...(suites[mode] ?? suites.smoke)];
const res = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(res.status ?? 1);
