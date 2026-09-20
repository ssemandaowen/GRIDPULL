# ==============================================================================
# GridPull CLI — Windows PowerShell Installer & Runtime Setup
# Enterprise-grade installer for PowerShell, CMD, and Windows Terminal
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$SkipDependencies,
    [switch]$GlobalPath,
    [string]$CustomInstallDir = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Step, [string]$Title)
    Write-Host ""
    Write-Host "[$Step] $Title" -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✔ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ $Message" -ForegroundColor Cyan
}

function Write-WarningMsg {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Write-ErrMsg {
    param([string]$Message)
    Write-Host "  ✖ $Message" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "  GridPull CLI — Windows Setup & Environment Configuration" -ForegroundColor Cyan
Write-Host "  Native high-performance terminal stream processing engine" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor DarkGray

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# ------------------------------------------------------------------------------
# Step 1: Verify System Runtimes
# ------------------------------------------------------------------------------
Write-Step "1/5" "Inspecting System Runtimes..."

# Check Node.js
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    $NodeVersion = & node -v
    Write-Success "Node.js detected: $NodeVersion ($($NodeCmd.Source))"
} else {
    Write-ErrMsg "Node.js (v18+) is required but not found in PATH."
    Write-Host "     Please install Node.js from https://nodejs.org or via 'winget install OpenJS.NodeJS'" -ForegroundColor Yellow
    exit 1
}

# Check Python
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    $PythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}

if ($PythonCmd) {
    $PyVersion = & $PythonCmd.Name --version 2>&1
    Write-Success "Python runtime detected: $PyVersion"
} else {
    Write-WarningMsg "Python 3 was not found in PATH. yt-dlp binary might require standalone executable."
}

# Check FFmpeg
$FfmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($FfmpegCmd) {
    $FfVersion = (& ffmpeg -version 2>&1 | Select-Object -First 1)
    Write-Success "FFmpeg media transcoder detected: $($FfVersion.Substring(0, [Math]::Min(42, $FfVersion.Length)))"
} else {
    Write-WarningMsg "FFmpeg not detected in PATH. Audio transcoding/merging may be limited."
    Write-Host "     Install via 'winget install Gyan.FFmpeg' or 'choco install ffmpeg'" -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Step 2: Verify yt-dlp Subsystem
# ------------------------------------------------------------------------------
Write-Step "2/5" "Verifying Stream Processing Engine (yt-dlp)..."

$PythonDir = Join-Path $ScriptDir "python"
if (-not (Test-Path $PythonDir)) {
    New-Item -ItemType Directory -Path $PythonDir -Force | Out-Null
}

$YtDlpExe = Join-Path $PythonDir "yt-dlp.exe"
$YtDlpPy = Join-Path $PythonDir "yt-dlp"

if ((Test-Path $YtDlpExe) -or (Test-Path $YtDlpPy)) {
    Write-Success "Managed stream engine binary located in ./python/"
} else {
    Write-Info "Downloading official standalone yt-dlp.exe..."
    try {
        $DownloadUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $YtDlpExe -UseBasicParsing
        Write-Success "yt-dlp.exe installed to $YtDlpExe"
    } catch {
        Write-WarningMsg "Could not download yt-dlp.exe automatically ($($_.Exception.Message))."
        Write-Host "     GridPull will fall back to system PATH yt-dlp if installed." -ForegroundColor Gray
    }
}

# ------------------------------------------------------------------------------
# Step 3: Install Node Dependencies
# ------------------------------------------------------------------------------
Write-Step "3/5" "Installing Node Dependencies & Ink React Engine..."

try {
    & npm install --no-audit --no-fund --quiet
    Write-Success "NPM dependencies and UI runtime verified."
} catch {
    Write-ErrMsg "Failed to run 'npm install'. Please check internet connectivity and permissions."
    exit 1
}

# ------------------------------------------------------------------------------
# Step 4: Create Windows Command Wrappers
# ------------------------------------------------------------------------------
Write-Step "4/5" "Configuring Windows Shell Command Wrappers..."

$BinDir = Join-Path $ScriptDir "bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

$LauncherPath = Join-Path $BinDir "gridpull.js"

# 1. Create gridpull.cmd (for CMD / PowerShell)
$CmdWrapperPath = Join-Path $BinDir "gridpull.cmd"
$CmdContent = @"
@ECHO OFF
SETLOCAL
SET "PROJECT_ROOT=$ScriptDir"
SET "LAUNCHER=%PROJECT_ROOT%\bin\gridpull.js"
node "%LAUNCHER%" %*
"@
[System.IO.File]::WriteAllText($CmdWrapperPath, $CmdContent, [System.Text.Encoding]::ASCII)
Write-Success "Created Windows CMD wrapper: $CmdWrapperPath"

# 2. Create gridpull.ps1 (for native PowerShell)
$Ps1WrapperPath = Join-Path $BinDir "gridpull.ps1"
$Ps1Content = @"
# GridPull Native PowerShell Launcher
param([Parameter(ValueFromRemainingArguments = `$true)]`$Args)
`$ProjectRoot = "$ScriptDir"
`$Launcher = Join-Path `$ProjectRoot "bin\gridpull.js"
& node `$Launcher @Args
"@
[System.IO.File]::WriteAllText($Ps1WrapperPath, $Ps1Content, [System.Text.Encoding]::UTF8)
Write-Success "Created PowerShell wrapper: $Ps1WrapperPath"

# ------------------------------------------------------------------------------
# Step 5: Configure Environment Path & Shell Aliases
# ------------------------------------------------------------------------------
Write-Step "5/5" "Configuring Windows PATH and User Environment..."

$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$BinDirNormalized = $BinDir.TrimEnd('\')

if ($CurrentPath -split ';' -contains $BinDirNormalized) {
    Write-Success "Target bin directory is already present in User PATH."
} else {
    try {
        $NewPath = "$CurrentPath;$BinDirNormalized".Trim(';')
        [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
        $env:Path = "$env:Path;$BinDirNormalized"
        Write-Success "Added '$BinDirNormalized' to User PATH environment variable."
    } catch {
        Write-WarningMsg "Unable to automatically modify User PATH: $($_.Exception.Message)"
    }
}

# Also configure PowerShell $PROFILE function for instant session access
if ($PROFILE) {
    try {
        $ProfileDir = Split-Path -Parent $PROFILE
        if (-not (Test-Path $ProfileDir)) {
            New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
        }

        $AliasBlock = "`n# GridPull CLI Alias`nfunction gridpull { & `"$Ps1WrapperPath`" @args }`n"
        
        $ExistingProfile = ""
        if (Test-Path $PROFILE) {
            $ExistingProfile = Get-Content $PROFILE -Raw
        }

        if (-not ($ExistingProfile -match "function gridpull")) {
            Add-Content -Path $PROFILE -Value $AliasBlock
            Write-Success "Added 'gridpull' function to PowerShell profile: $PROFILE"
        } else {
            Write-Success "PowerShell profile already contains 'gridpull' alias."
        }
    } catch {
        Write-Info "Skipped profile configuration ($($_.Exception.Message))."
    }
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host "  ✔ INSTALLATION & SETUP COMPLETE" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  GridPull CLI is configured and ready for use in Windows Terminal, PowerShell, or CMD!" -ForegroundColor White
Write-Host ""
Write-Host "  Usage:" -ForegroundColor White
Write-Host "    gridpull                 # Launch Google-style Interactive Terminal TUI" -ForegroundColor Cyan
Write-Host "    gridpull --help          # Display all supported commands and arguments" -ForegroundColor Cyan
Write-Host "    gridpull deps            # Check runtime and engine diagnostics" -ForegroundColor Cyan
Write-Host "    gridpull <url>           # Fast single or batch URL probe" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Note: If 'gridpull' is not recognized immediately in existing shells, restart your terminal." -ForegroundColor Gray
Write-Host ""
