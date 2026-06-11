# Setup Modern TTS with edge-tts
# This script installs Python (if needed) and edge-tts for modern neural voices

Write-Host "`n=== Modern TTS Voice Setup ===" -ForegroundColor Cyan

# Check if Python is installed
$pythonInstalled = $false
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pythonInstalled = $true
        Write-Host "[OK] Python is installed: $pythonVersion" -ForegroundColor Green
    }
} catch {
    $pythonInstalled = $false
}

if (-not $pythonInstalled) {
    Write-Host "`n[SETUP REQUIRED] Python is not installed." -ForegroundColor Yellow
    Write-Host "`nOption 1 (Recommended): Install from Microsoft Store" -ForegroundColor Cyan
    Write-Host "  1. Press Win + S and search 'Python'"
    Write-Host "  2. Click 'Python 3.12' (or latest version)"
    Write-Host "  3. Click 'Get' or 'Install'"
    Write-Host "`nOption 2: Install from python.org" -ForegroundColor Cyan
    Write-Host "  Visit: https://www.python.org/downloads/"
    Write-Host "`nAfter installing Python, run this script again." -ForegroundColor Yellow
    Read-Host "`nPress Enter to exit"
    exit 1
}

# Install edge-tts
Write-Host "`nInstalling edge-tts..." -ForegroundColor Cyan
python -m pip install --upgrade pip --quiet
python -m pip install edge-tts --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] edge-tts installed successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to install edge-tts" -ForegroundColor Red
    exit 1
}

# Test installation
Write-Host "`nTesting edge-tts..." -ForegroundColor Cyan
$testOutput = python -m edge_tts --list-voices 2>&1 | Select-String "en-GB-LibbyNeural" -Quiet
if ($testOutput) {
    Write-Host "[OK] Modern British voices are available!" -ForegroundColor Green
    Write-Host "`nAvailable British Female Voices:" -ForegroundColor Cyan
    Write-Host "  - en-GB-LibbyNeural (bright, friendly)" -ForegroundColor White
    Write-Host "  - en-GB-MaisieNeural (warm, professional)" -ForegroundColor White
    Write-Host "  - en-GB-SoniaNeural (sophisticated)" -ForegroundColor White
    Write-Host "`n[SUCCESS] Setup complete! You can now use notify-complete-modern.ps1" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Could not verify voices" -ForegroundColor Yellow
}

Read-Host "`nPress Enter to exit"
