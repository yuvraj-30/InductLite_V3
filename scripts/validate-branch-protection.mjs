const repository = process.env.GITHUB_REPOSITORY?.trim();
const token =
  process.env.BRANCH_PROTECTION_TOKEN?.trim() ||
  process.env.GITHUB_TOKEN?.trim();

if (!repository) {
  console.error(
    "GITHUB_REPOSITORY is required (expected owner/repo for branch protection validation).",
  );
  process.exit(1);
}

if (!token) {
  console.error(
    "BRANCH_PROTECTION_TOKEN or GITHUB_TOKEN is required to validate branch protection.",
  );
  process.exit(1);
}

const [owner, repo] = repository.split("/", 2);
if (!owner || !repo) {
  console.error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  process.exit(1);
}

const branches = (process.env.BRANCH_PROTECTION_BRANCHES || "main,develop")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const requiredContexts = (
  process.env.BRANCH_PROTECTION_REQUIRED_CONTEXTS ||
  [
    "guardrails-lint",
    "policy-check",
    "guardrails-tests",
    "parity-gate",
    "Lint Typecheck Unit",
    "Integration tests (apps/web)",
    "E2E smoke (chromium)",
  ].join(",")
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

async function githubApi(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "inductlite-branch-protection-validator",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API ${path} failed with ${response.status}: ${body.slice(0, 400)}`,
    );
  }

  return response.json();
}

function getConfiguredContexts(protection) {
  const contexts = new Set();

  for (const context of protection?.required_status_checks?.contexts ?? []) {
    contexts.add(context);
  }

  for (const check of protection?.required_status_checks?.checks ?? []) {
    if (check?.context) {
      contexts.add(check.context);
    }
  }

  return contexts;
}

const failures = [];

for (const branch of branches) {
  try {
    const branchInfo = await githubApi(
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    );
    if (!branchInfo.protected) {
      failures.push(`${branch}: branch exists but is not protected`);
      continue;
    }

    const protection = await githubApi(
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
    );
    const configuredContexts = getConfiguredContexts(protection);

    for (const context of requiredContexts) {
      if (!configuredContexts.has(context)) {
        failures.push(`${branch}: missing required status check "${context}"`);
      }
    }

    if (!protection.enforce_admins?.enabled) {
      failures.push(`${branch}: enforce_admins must be enabled`);
    }

    if (
      (protection.required_pull_request_reviews?.required_approving_review_count ??
        0) < 1
    ) {
      failures.push(
        `${branch}: at least one approving review is required before merge`,
      );
    }

    if (!protection.required_pull_request_reviews?.dismiss_stale_reviews) {
      failures.push(`${branch}: stale approvals must be dismissed`);
    }

    if (!protection.required_conversation_resolution?.enabled) {
      failures.push(`${branch}: conversation resolution must be enabled`);
    }

    if (protection.allow_force_pushes?.enabled) {
      failures.push(`${branch}: force pushes must remain disabled`);
    }

    if (protection.allow_deletions?.enabled) {
      failures.push(`${branch}: branch deletions must remain disabled`);
    }
  } catch (error) {
    failures.push(
      `${branch}: validation failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

if (failures.length > 0) {
  console.error("Branch protection validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      repository,
      branches,
      requiredContexts,
      status: "ok",
    },
    null,
    2,
  ),
);
