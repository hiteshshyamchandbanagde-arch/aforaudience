# sync-repo.ps1 — bring local qa + main in sync with origin, safely.
# Usage: cd into the aforaudience repo, then: .\sync-repo.ps1

function Say  ($m) { Write-Host "→ $m" -ForegroundColor Cyan }
function Ok   ($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "! $m" -ForegroundColor Yellow }
function Fail ($m) { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }

# --- Sanity ---
if (-not (Test-Path .git)) { Fail "Not a git repo. cd into the aforaudience repo first." }

$startBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $startBranch) { Fail "Could not read current branch." }

$isDirty = -not [string]::IsNullOrWhiteSpace((git status --porcelain))
Say "Starting on: $startBranch  |  dirty: $isDirty"

# --- Stash if dirty ---
$stashed = $false
if ($isDirty) {
    $label = "sync-safety-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Warn "Uncommitted changes present — stashing as '$label'"
    git stash push -u -m $label | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "Stash failed — bailing to keep your work safe." }
    $stashed = $true
}

# --- Fetch everything, prune dead remote branches ---
Say "Fetching all remotes and pruning..."
git fetch --all --prune --tags 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch failed. Network? Auth?" }
Ok "Fetched"

# --- Sync qa + main (fast-forward only) ---
foreach ($branch in @('qa','main')) {
    if ($startBranch -eq $branch) {
        Say "Fast-forwarding current branch $branch"
        git pull --ff-only origin $branch
        if ($LASTEXITCODE -eq 0) { Ok "$branch up to date" }
        else { Warn "$branch pull failed — local likely diverged. Resolve manually." }
    } else {
        Say "Fast-forwarding $branch (not checked out)"
        git fetch origin "${branch}:${branch}" 2>$null
        if ($LASTEXITCODE -eq 0) { Ok "$branch up to date" }
        else { Warn "$branch could not be fast-forwarded (diverged or missing). Skipping." }
    }
}

# --- Restore stash if we stashed ---
if ($stashed) {
    Say "Restoring stashed changes..."
    git stash pop
    if ($LASTEXITCODE -eq 0) { Ok "Stash restored" }
    else { Warn "Stash pop had conflicts — check 'git status' and 'git stash list'." }
}

# --- Summary ---
Write-Host ""
Say "Final state:"
git log --oneline --graph --decorate --all -n 12
Write-Host ""
git status --short --branch