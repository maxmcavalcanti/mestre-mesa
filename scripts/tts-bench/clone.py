"""Testa voice cloning XTTS-v2 com referencia PT contra o texto problematico."""
import os
os.environ["COQUI_TOS_AGREED"] = "1"

import time
from pathlib import Path

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)

SENTENCES = [
    "O guerreiro avança pela floresta sombria, espada em punho.",
    "Uma criatura de olhos vermelhos surge entre as árvores, rugindo um desafio gutural que ecoa pelas montanhas distantes.",
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens.",
]


def main():
    import numpy as np
    import torch
    from TTS.api import TTS
    import soundfile as sf

    ref = Path(__file__).parent / "refs" / "ref_01_coqui_pt.wav"
    if not ref.exists():
        raise SystemExit(f"Referencia nao encontrada: {ref}")

    print(f"Referencia: {ref.name}")
    print("Carregando XTTS-v2...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
    sr = tts.synthesizer.output_sample_rate
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    # 1) Texto inteiro com cloning
    out_path = out_dir / "clone_01_completo.wav"
    t0 = time.perf_counter()
    tts.tts_to_file(
        text=TEXT,
        file_path=str(out_path),
        language="pt",
        speaker_wav=str(ref),
    )
    print(f"  clone_01_completo: {time.perf_counter() - t0:.1f}s -> {out_path.name}")

    # 2) Per-sentence com cloning
    chunks = []
    silence = np.zeros(int(sr * 0.35), dtype=np.float32)
    t0 = time.perf_counter()
    for s in SENTENCES:
        wav = tts.tts(text=s, language="pt", speaker_wav=str(ref))
        chunks.append(np.asarray(wav, dtype=np.float32))
        chunks.append(silence)
    combined = np.concatenate(chunks[:-1])
    out_path = out_dir / "clone_02_per_sentence.wav"
    sf.write(str(out_path), combined, sr)
    print(f"  clone_02_per_sentence: {time.perf_counter() - t0:.1f}s -> {out_path.name}")

    print()
    print(f"WAVs em {out_dir}")
    print("Ouve clone_01 e clone_02 e diz se a alucinacao some.")
    print("Observacao: o sample PT do XTTS pode ser sotaque europeu — primeiro confirma se")
    print("a alucinacao some; sotaque brasileiro a gente resolve depois c/ outra referencia.")


if __name__ == "__main__":
    main()
