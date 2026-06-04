# Setup AudioCraft venv for RTSBrowser audio generation (Windows).
# Run from: features/audio/tools/audiocraft
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Creating venv (if missing)..."
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$py = ".\.venv\Scripts\python.exe"
$pip = "$py -m pip"

Write-Host "Upgrading pip..."
Invoke-Expression "$pip install -U pip setuptools wheel"

Write-Host "Installing PyTorch 2.1 (CUDA 12.1)..."
Invoke-Expression "$pip install torch==2.1.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu121"

Write-Host "Installing PyAV wheel (avoid source build on Windows)..."
Invoke-Expression "$pip install `"av>=12.0`" --only-binary :all:"

Write-Host "Installing AudioCraft dependencies..."
Invoke-Expression "$pip install -r requirements-windows.txt"

Write-Host "Installing audiocraft (no-deps — av version pinned above)..."
Invoke-Expression "$pip install audiocraft==1.3.0 --no-deps"

Write-Host ""
Write-Host "Verifying import..."
& $py -c "from audiocraft.models import AudioGen, MusicGen; print('audiocraft OK')"

Write-Host ""
Write-Host "Checking ffmpeg (required to write WAV files)..."
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    Write-Warning "ffmpeg not on PATH. Install: winget install --id Gyan.FFmpeg -e"
    Write-Warning "Restart the terminal after installing ffmpeg."
} else {
    Write-Host "ffmpeg: $($ffmpeg.Source)"
}

Write-Host ""
Write-Host "Setup complete. Next:"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  python generate.py --id ui.click"
