$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host "Criando venv (Python 3.11 via uv)..."
    uv venv --python 3.11
}

Write-Host "Instalando torch + CUDA 12.1 (wheel separada)..."
uv pip install torch --python .venv\Scripts\python.exe --index-url https://download.pytorch.org/whl/cu121

Write-Host "Instalando coqui-tts e soundfile..."
uv pip install coqui-tts soundfile --python .venv\Scripts\python.exe

Write-Host ""
Write-Host "Pronto. Rode: .\.venv\Scripts\python.exe bench.py"
