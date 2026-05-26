import os
os.environ["COQUI_TOS_AGREED"] = "1"

import time
from pathlib import Path

# Texto exato do bench — a 2a sentenca (longa, terminando em "distantes.") e a
# que estava disparando alucinacao de "ponto ponto" na Ana Florence.
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

SPEAKER = "Ana Florence"


def main():
    import numpy as np
    import torch
    from TTS.api import TTS
    import soundfile as sf

    print("Carregando XTTS-v2...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
    sr = tts.synthesizer.output_sample_rate
    print(f"Sample rate: {sr}")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    def gen_full(name, **kwargs):
        out_path = out_dir / f"param_{name}.wav"
        t0 = time.perf_counter()
        tts.tts_to_file(
            text=TEXT,
            file_path=str(out_path),
            language="pt",
            speaker=SPEAKER,
            **kwargs,
        )
        print(f"  {name}: {time.perf_counter() - t0:.1f}s -> {out_path.name}")

    def gen_per_sentence(name, **kwargs):
        out_path = out_dir / f"param_{name}.wav"
        chunks = []
        silence = np.zeros(int(sr * 0.35), dtype=np.float32)
        t0 = time.perf_counter()
        for s in SENTENCES:
            wav = tts.tts(text=s, language="pt", speaker=SPEAKER, **kwargs)
            arr = np.asarray(wav, dtype=np.float32)
            chunks.append(arr)
            chunks.append(silence)
        combined = np.concatenate(chunks[:-1])  # remove ultimo silencio
        sf.write(str(out_path), combined, sr)
        print(f"  {name}: {time.perf_counter() - t0:.1f}s -> {out_path.name}")

    gen_full("01_default")
    gen_full("02_temp05", temperature=0.5)
    gen_full("03_reppen10", repetition_penalty=10.0)
    gen_full("04_temp05_reppen10", temperature=0.5, repetition_penalty=10.0)
    gen_per_sentence("05_per_sentence_default")

    print()
    print(f"WAVs em: {out_dir}")
    print("Ouve param_01 ate param_05 e me diz quais NAO disparam 'ponto ponto'.")


if __name__ == "__main__":
    main()
