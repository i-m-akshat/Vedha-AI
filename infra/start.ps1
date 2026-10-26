# ResuMate / Vedha AI — Container Startup Script (Native Windows Podman)
[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$Rebuild,
    [switch]$NoProxy
)

$ErrorActionPreference = "Stop"

Write-Host "=== ResuMate / Vedha AI Startup Orchestrator ===" -ForegroundColor Cyan

# 1. Ensure Podman machine is running
$existingMachines = podman machine list --format "{{.Name}}" 2>$null
if ($existingMachines -notmatch "podman-machine-default") {
    Write-Host "Podman machine 'podman-machine-default' does not exist. Initializing..." -ForegroundColor Yellow
    podman machine init podman-machine-default
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to initialize podman-machine-default. Please check Podman installation."
    }
}

$runningMachines = podman machine list --format "{{if .Running}}{{.Name}}{{end}}" 2>$null
if ($runningMachines -notmatch "podman-machine-default") {
    Write-Host "Starting podman-machine-default..." -ForegroundColor Yellow
    $startOutput = podman machine start podman-machine-default 2>&1
    if ($LASTEXITCODE -ne 0 -and $startOutput -notmatch "already running") {
        throw "Unable to start podman-machine-default: $startOutput"
    }
}

# 2. Check if required application images exist
$existingImages = podman images --format "{{.Repository}}:{{.Tag}}" 2>$null
$requiredImages = @(
    "localhost/infra-backend:latest",
    "localhost/infra-frontend:latest",
    "localhost/infra-worker:latest"
)

$missingImages = $requiredImages | Where-Object { $existingImages -notcontains $_ }

$needsBuild = ($missingImages.Count -gt 0) -or $Build -or $Rebuild

$orchestratorParams = @{}
if ($NoProxy) { $orchestratorParams["NoProxy"] = $true }

if ($needsBuild) {
    if ($missingImages.Count -gt 0 -and -not ($Build -or $Rebuild)) {
        Write-Host "Missing container images detected ($($missingImages -join ', ')). Triggering build..." -ForegroundColor Yellow
    } else {
        Write-Host "Rebuild requested. Triggering full build..." -ForegroundColor Cyan
    }
    & "$PSScriptRoot\build_and_start.ps1" @orchestratorParams
} else {
    Write-Host "All required container images exist. Starting containers without rebuilding..." -ForegroundColor Green
    $orchestratorParams["SkipBuild"] = $true
    & "$PSScriptRoot\build_and_start.ps1" @orchestratorParams
}
