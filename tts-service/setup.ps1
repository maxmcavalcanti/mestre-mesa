$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv nao encontrado no PATH. Instale https://docs.astral.sh/uv/"
}

if (-not (Test-Path .venv)) {
    Write-Host "Criando venv (Python 3.11)..."
    uv venv --python 3.11
}

$py = ".\.venv\Scripts\python.exe"

Write-Host "Instalando torch + torchaudio (CUDA 12.1)..."
uv pip install torch torchaudio --python $py --index-url https://download.pytorch.org/whl/cu121

Write-Host "Instalando f5-tts, fastapi, uvicorn, static-ffmpeg..."
uv pip install --python $py f5-tts fastapi "uvicorn[standard]" static-ffmpeg

# torchcodec entra transitivamente mas falha em carregar libs no Windows sem
# ffmpeg shared instalado e nao precisamos dele (passamos ref_text explicito,
# Whisper ASR nao roda). Remover pra evitar crash no startup.
Write-Host "Removendo torchcodec (incompatibilidade Windows)..."
uv pip uninstall torchcodec --python $py 2>&1 | Out-Null

# pyarrow >= 20 crashea no Windows com numpy 2.x (access violation ao carregar DLL).
# datasets (puxado por f5-tts) precisa do pyarrow, entao pin numa versao estavel.
Write-Host "Pinando pyarrow<20 (workaround crash Windows)..."
uv pip install --python $py "pyarrow<20"

Write-Host "Pre-baixando ckpt + vocab do finetune PT-BR (~1.3GB)..."
& $py -c "from huggingface_hub import hf_hub_download; hf_hub_download('Tharyck/multispeaker-ptbr-f5tts', 'model_last.safetensors'); hf_hub_download('Tharyck/multispeaker-ptbr-f5tts', 'vocab.txt')"

Write-Host ""
Write-Host "Setup OK. Pra rodar manualmente:"
Write-Host "  .\.venv\Scripts\python.exe .\server.py"
Write-Host "Healthz: http://127.0.0.1:8001/healthz"
