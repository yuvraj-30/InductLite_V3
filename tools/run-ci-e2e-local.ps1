[CmdletBinding()]
param(
  [switch]$PrepareOnly,
  [switch]$SkipInstall,
  [switch]$SkipBrowsers,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot "apps/web"
$composeFile = Join-Path $repoRoot "docker-compose.dev.yml"
$baseUrl = "http://localhost:3000"
$dbName = "inductlite_e2e"
$dbUrl = "postgresql://postgres:postgres@localhost:5432/${dbName}?schema=public"
$testRunnerSecret = if ($env:TEST_RUNNER_SECRET_KEY) {
  $env:TEST_RUNNER_SECRET_KEY
} else {
  "e2e-test-runner-secret-3b0f2cbf5de0416ebf958e8d"
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not available in PATH."
  }
}

function Set-ProcessEnv {
  param([Parameter(Mandatory = $true)][hashtable]$Values)

  $saved = @{}
  foreach ($entry in $Values.GetEnumerator()) {
    $current = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    $saved[$entry.Key] = @{
      Exists = $null -ne $current
      Value = $current
    }
    Set-Item -Path ("Env:{0}" -f $entry.Key) -Value ([string]$entry.Value)
  }

  return $saved
}

function Restore-ProcessEnv {
  param([Parameter(Mandatory = $true)][hashtable]$Saved)

  foreach ($entry in $Saved.GetEnumerator()) {
    if ($entry.Value.Exists) {
      Set-Item -Path ("Env:{0}" -f $entry.Key) -Value ([string]$entry.Value.Value)
    } else {
      Remove-Item -Path ("Env:{0}" -f $entry.Key) -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [string]$WorkingDirectory = $repoRoot,
    [hashtable]$EnvOverrides = @{}
  )

  Write-Host ""
  Write-Host "==> $Description"

  $savedEnv = Set-ProcessEnv $EnvOverrides
  Push-Location $WorkingDirectory
  try {
    $global:LASTEXITCODE = 0
    & $Action
    if ($LASTEXITCODE -ne 0) {
      throw "$Description failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
    Restore-ProcessEnv $savedEnv
  }
}

function New-CiEnv {
  param([Parameter(Mandatory = $true)][string]$NodeEnv)

  return @{
    BASE_URL = $baseUrl
    NEXT_PUBLIC_APP_URL = $baseUrl
    NEXT_TELEMETRY_DISABLED = "1"
    NODE_ENV = $NodeEnv
    CI = "true"
    DATABASE_URL = $dbUrl
    DATABASE_DIRECT_URL = $dbUrl
    ALLOW_TEST_RUNNER = "1"
    TEST_RUNNER_SECRET_KEY = $testRunnerSecret
    TRUST_PROXY = "1"
    JWT_SECRET = "test-secret-value-123"
    SESSION_SECRET = "ci-test-secret-at-least-32-characters-long"
    SIGN_OUT_TOKEN_SECRET = "ci-test-signout-secret-at-least-32-characters"
    CRON_SECRET = "ci-test-cron-secret-at-least-16"
    DATA_ENCRYPTION_KEY = "ci-test-data-encryption-key-at-least-32-characters"
    MAGIC_LINK_SECRET = "ci-magic-link-secret"
    RESEND_API_KEY = "ci-resend-key"
    RESEND_FROM = "ci@example.com"
    SESSION_COOKIE_SECURE = "0"
    PLAYWRIGHT_BROWSERS_PATH = "0"
    E2E_RETRIES = "0"
    UPSTASH_REDIS_REST_URL = ""
    UPSTASH_REDIS_REST_TOKEN = ""
    RATE_LIMIT_TELEMETRY_URL = ""
    RATE_LIMIT_ANALYTICS = "0"
  }
}

function Get-HttpResult {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [ValidateSet("GET", "POST", "DELETE")][string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  $params = @{
    Uri = $Uri
    Method = $Method
    Headers = $Headers
    TimeoutSec = 5
    UseBasicParsing = $true
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
    $params.ContentType = "application/json"
  }

  try {
    $response = Invoke-WebRequest @params
    return @{
      Status = [int]$response.StatusCode
      Body = [string]$response.Content
    }
  } catch {
    $status = -1
    $body = $_.Exception.Message
    $response = $_.Exception.Response
    if ($null -ne $response) {
      try {
        $status = [int]$response.StatusCode
      } catch {
        try {
          $status = [int]$response.StatusCode.value__
        } catch {
          $status = -1
        }
      }

      try {
        $stream = $response.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          try {
            $body = $reader.ReadToEnd()
          } finally {
            $reader.Dispose()
          }
        }
      } catch {
        $body = $_.Exception.Message
      }
    }

    return @{
      Status = $status
      Body = [string]$body
    }
  }
}

function Wait-ForHttpStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][int[]]$OkStatuses,
    [ValidateSet("GET", "POST", "DELETE")][string]$Method = "GET",
    [int]$TimeoutSeconds = 60,
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [string]$Description = $Uri,
    [System.Diagnostics.Process]$Process = $null
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastStatus = -1
  $lastBody = ""

  while ((Get-Date) -lt $deadline) {
    if ($null -ne $Process -and $Process.HasExited) {
      throw "Standalone server exited before $Description was ready (exitCode=$($Process.ExitCode))."
    }

    $result = Get-HttpResult -Uri $Uri -Method $Method -Headers $Headers -Body $Body
    $lastStatus = $result.Status
    $lastBody = $result.Body

    if ($OkStatuses -contains $result.Status) {
      return $result
    }

    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for $Description (lastStatus=$lastStatus, lastBody=$lastBody)."
}

function Wait-ForRuntimeRoute {
  param([Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process)

  $headers = @{ "x-test-secret" = $testRunnerSecret }
  $deadline = (Get-Date).AddSeconds(60)
  $lastStatus = -1
  $lastBody = ""

  while ((Get-Date) -lt $deadline) {
    if ($Process.HasExited) {
      throw "Standalone server exited before /api/test/runtime was ready (exitCode=$($Process.ExitCode))."
    }

    $result = Get-HttpResult -Uri "$baseUrl/api/test/runtime" -Headers $headers
    $lastStatus = $result.Status
    $lastBody = $result.Body

    if ($result.Status -eq 200) {
      try {
        $payload = $result.Body | ConvertFrom-Json
      } catch {
        $payload = $null
      }

      if (
        $null -ne $payload -and
        $payload.allowTestRunner -eq $true -and
        $payload.ciRuntime -eq $true -and
        $payload.dbPresent -eq $true
      ) {
        return $payload
      }
    }

    Start-Sleep -Milliseconds 500
  }

  throw "Timed out warming /api/test/runtime (lastStatus=$lastStatus, lastBody=$lastBody)."
}

function Get-ServerFailureDetails {
  param(
    [Parameter(Mandatory = $true)][string]$StdoutLog,
    [Parameter(Mandatory = $true)][string]$StderrLog
  )

  $parts = @()
  if (Test-Path $StdoutLog) {
    $parts += "stdout:"
    $parts += (Get-Content -Path $StdoutLog -Tail 40)
  }
  if (Test-Path $StderrLog) {
    $parts += "stderr:"
    $parts += (Get-Content -Path $StderrLog -Tail 40)
  }

  return ($parts -join [Environment]::NewLine)
}

function Ensure-PostgresContainer {
  $containerId = ""

  if (Test-Path $composeFile) {
    $containerId = ([string](& docker compose -f $composeFile ps -q db 2>$null | Select-Object -First 1)).Trim()
    if (-not $containerId) {
      Invoke-Step -Description "Start local Postgres via docker-compose.dev.yml" -WorkingDirectory $repoRoot -Action {
        docker compose -f $composeFile up -d db
      }
      $containerId = ([string](& docker compose -f $composeFile ps -q db | Select-Object -First 1)).Trim()
    }
  }

  if (-not $containerId) {
    $containerId = ([string](& docker ps --filter "ancestor=postgres:16-alpine" --format "{{.ID}}" | Select-Object -First 1)).Trim()
  }

  if (-not $containerId) {
    throw "No Postgres 16 container is running. Start Docker Desktop and rerun."
  }

  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    & docker exec $containerId pg_isready -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) {
      return $containerId
    }
    Start-Sleep -Seconds 2
  }

  throw "Postgres container '$containerId' did not become ready in time."
}

function Ensure-DatabaseExists {
  param([Parameter(Mandatory = $true)][string]$ContainerId)

  $exists = ([string](& docker exec $ContainerId psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName';" | Select-Object -First 1)).Trim()
  if ($exists -eq "1") {
    return
  }

  Invoke-Step -Description "Create $dbName database" -WorkingDirectory $repoRoot -Action {
    docker exec $ContainerId psql -U postgres -d postgres -c "CREATE DATABASE $dbName;"
  }
}

function Stop-NodeServerOnPort3000 {
  $lines = @(netstat -ano | Select-String -Pattern "^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$")
  foreach ($line in $lines) {
    $match = [regex]::Match($line.Line, "LISTENING\s+(\d+)\s*$")
    if (-not $match.Success) {
      continue
    }

    $processId = [int]$match.Groups[1].Value
    if ($processId -le 0) {
      continue
    }

    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $proc) {
      continue
    }

    if ($proc.ProcessName -ne "node") {
      throw "Port 3000 is already in use by PID $processId ($($proc.ProcessName)). Stop it before running local CI E2E."
    }

    Stop-Process -Id $processId -Force -ErrorAction Stop
    Start-Sleep -Seconds 2
  }
}

function Remove-StaleStandaloneOutput {
  $standaloneDir = Join-Path $webDir ".next/standalone"
  if (-not (Test-Path $standaloneDir)) {
    return
  }

  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Remove-Item -Path $standaloneDir -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($attempt -eq 5) {
        throw
      }
      Start-Sleep -Seconds 2
    }
  }
}

function Start-StandaloneServer {
  $stdoutLog = Join-Path $webDir ".tmp_ci_e2e_server.out.log"
  $stderrLog = Join-Path $webDir ".tmp_ci_e2e_server.err.log"
  $candidatePaths = @(
    (Join-Path $webDir ".next/standalone/server.js"),
    (Join-Path $webDir ".next/standalone/apps/web/server.js")
  )

  Remove-Item -Path $stdoutLog -ErrorAction SilentlyContinue
  Remove-Item -Path $stderrLog -ErrorAction SilentlyContinue

  $serverPath = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $serverPath) {
    throw "Unable to resolve standalone server entrypoint."
  }

  Push-Location $webDir
  try {
    & node .\scripts\start-standalone.js --prepare-only
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to prepare standalone static/public assets."
    }
  } finally {
    Pop-Location
  }

  $serverEnv = New-CiEnv -NodeEnv "test"
  $serverEnv.PORT = "3000"
  $serverEnv.HOSTNAME = "0.0.0.0"

  $savedEnv = Set-ProcessEnv $serverEnv
  try {
    $process = Start-Process -FilePath "node" `
      -ArgumentList @($serverPath) `
      -WorkingDirectory $webDir `
      -RedirectStandardOutput $stdoutLog `
      -RedirectStandardError $stderrLog `
      -PassThru
  } finally {
    Restore-ProcessEnv $savedEnv
  }

  return [pscustomobject]@{
    Process = $process
    StdoutLog = $stdoutLog
    StderrLog = $stderrLog
  }
}

function Stop-StandaloneServer {
  param([Parameter(Mandatory = $true)]$Server)

  if ($null -ne $Server.Process -and -not $Server.Process.HasExited) {
    Stop-Process -Id $Server.Process.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

Require-Command -Name "node"
Require-Command -Name "npm"
Require-Command -Name "docker"

$dbContainer = Ensure-PostgresContainer
Ensure-DatabaseExists -ContainerId $dbContainer
$ciTestEnv = New-CiEnv -NodeEnv "test"
$ciProdEnv = New-CiEnv -NodeEnv "production"
$sharedServerEnv = New-CiEnv -NodeEnv "test"
$sharedServerEnv.E2E_USE_SHARED_SERVER = "1"

Stop-NodeServerOnPort3000

if (-not $SkipInstall) {
  Invoke-Step -Description "Install workspace dependencies" -WorkingDirectory $repoRoot -Action {
    npm ci
  }
}

if (-not $SkipBrowsers) {
  Invoke-Step -Description "Install Playwright browsers" -WorkingDirectory $webDir -EnvOverrides @{ PLAYWRIGHT_BROWSERS_PATH = "0" } -Action {
    npx playwright install chromium
  }
}

Invoke-Step -Description "Prisma generate" -WorkingDirectory $repoRoot -EnvOverrides $ciTestEnv -Action {
  npm run db:generate
}

Invoke-Step -Description "Prisma validate" -WorkingDirectory $repoRoot -EnvOverrides $ciTestEnv -Action {
  npm run -w apps/web prisma:validate
}

Invoke-Step -Description "Prisma format check" -WorkingDirectory $repoRoot -EnvOverrides $ciTestEnv -Action {
  npm run -w apps/web prisma:format:check
}

Invoke-Step -Description "Migrate DB" -WorkingDirectory $repoRoot -EnvOverrides $ciTestEnv -Action {
  npm run -w apps/web db:migrate
}

Invoke-Step -Description "Seed DB" -WorkingDirectory $repoRoot -EnvOverrides $ciTestEnv -Action {
  npm run -w apps/web db:seed
}

if (-not $SkipBuild) {
  Remove-StaleStandaloneOutput
  Invoke-Step -Description "Build standalone app" -WorkingDirectory $repoRoot -EnvOverrides $ciProdEnv -Action {
    npm run -w apps/web build
  }
}

$server = $null

try {
  Write-Host ""
  Write-Host "==> Start standalone server"
  $server = Start-StandaloneServer

  Wait-ForHttpStatus -Uri "$baseUrl/health" -OkStatuses @(200) -TimeoutSeconds 120 -Description "/health" -Process $server.Process | Out-Null
  Wait-ForRuntimeRoute -Process $server.Process | Out-Null
  Wait-ForHttpStatus -Uri "$baseUrl/api/test/clear-rate-limit" `
    -Method "POST" `
    -Headers @{ "x-test-secret" = $testRunnerSecret } `
    -OkStatuses @(200) `
    -TimeoutSeconds 60 `
    -Description "/api/test/clear-rate-limit" `
    -Process $server.Process | Out-Null

  if ($PrepareOnly) {
    Write-Host ""
    Write-Host "Local CI E2E preflight passed."
    return
  }

  Invoke-Step -Description "Run E2E smoke" -WorkingDirectory $webDir -EnvOverrides $sharedServerEnv -Action {
    npm run test:e2e:smoke
  }

  Write-Host ""
  Write-Host "Local CI smoke workflow completed successfully."
} catch {
  if ($null -ne $server) {
    $details = Get-ServerFailureDetails -StdoutLog $server.StdoutLog -StderrLog $server.StderrLog
    if ($details) {
      throw ($_.Exception.Message + [Environment]::NewLine + $details)
    }
  }

  throw
} finally {
  if ($null -ne $server) {
    Stop-StandaloneServer -Server $server
  }
}
