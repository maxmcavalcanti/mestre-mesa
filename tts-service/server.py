"""Mestre TTS Service: FastAPI + F5-TTS PT-BR finetune com cache em disco."""
import hashlib
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import static_ffmpeg
static_ffmpeg.add_paths()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REPO_TTS = "Tharyck/multispeaker-ptbr-f5tts"
HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
AUDIO_DIR = REPO_ROOT / "data" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

REFS_BASE = {
    "masc": HERE / "refs" / "masc",
    "fem":  HERE / "refs" / "fem",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tts")

model = None
ref_texts: dict[str, str] = {}


def carregar():
    global model, ref_texts
    from huggingface_hub import hf_hub_download
    from f5_tts.api import F5TTS

    log.info("baixando ckpt + vocab do %s", REPO_TTS)
    ckpt = hf_hub_download(REPO_TTS, "model_last.safetensors")
    vocab = hf_hub_download(REPO_TTS, "vocab.txt")

    log.info("carregando F5TTS (cuda)")
    model = F5TTS(
        model="F5TTS_v1_Base",
        ckpt_file=ckpt,
        vocab_file=vocab,
        device="cuda",
    )

    for voz, base in REFS_BASE.items():
        ref_texts[voz] = base.with_suffix(".txt").read_text(encoding="utf-8").strip()
    log.info("pronto. vozes=%s", list(REFS_BASE.keys()))


def cache_key(voz: str, texto: str) -> str:
    return hashlib.sha1(f"{voz}|{texto}".encode("utf-8")).hexdigest()


class TtsReq(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str = Field(..., pattern="^(masc|fem)$")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    carregar()
    yield


app = FastAPI(title="Mestre TTS", lifespan=lifespan)


@app.get("/healthz")
def healthz():
    return {"ok": model is not None, "vozes": list(REFS_BASE.keys())}


@app.post("/tts")
def tts(req: TtsReq):
    key = cache_key(req.voice, req.text)
    out_path = AUDIO_DIR / f"{key}.wav"
    if out_path.exists():
        log.info("cache hit %s voz=%s", key[:8], req.voice)
        return {"hash": key, "filename": out_path.name, "cached": True}

    log.info("gerando %s voz=%s len=%d", key[:8], req.voice, len(req.text))
    ref_wav = str(REFS_BASE[req.voice].with_suffix(".wav"))
    try:
        model.infer(
            ref_file=ref_wav,
            ref_text=ref_texts[req.voice],
            gen_text=req.text,
            file_wave=str(out_path),
        )
    except Exception as e:
        log.exception("falha gerando audio")
        raise HTTPException(500, str(e))
    return {"hash": key, "filename": out_path.name, "cached": False}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_config=None)
