import { spawnSync } from 'node:child_process';

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

const dockerCheck = spawnSync('docker', ['info'], { stdio: 'ignore' });
const hasDocker = dockerCheck.status === 0;

if (!hasDocker) {
  console.warn('[integration] Docker runtime unavailable; running non-container integration subset.');
  process.exit(
    run('npx', [
      'vitest',
      'run',
      '--config',
      'vitest.integration.config.ts',
      'tests/integration/rbac-matrix.test.ts',
    ]),
  );
}

process.exit(run('npx', ['vitest', 'run', '--config', 'vitest.integration.config.ts']));
