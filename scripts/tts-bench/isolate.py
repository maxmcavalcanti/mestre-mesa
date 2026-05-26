"""Isola a sentenca problematica e varia so a terminacao."""
import os
os.environ["COQUI_TOS_AGREED"] = "1"

import time
from pathlib import Path

# A sentenca que estava disparando "ponto ponto"
BASE = "Uma criatura de olhos vermelhos surge entre as árvores, rugindo um desafio gutural que ecoa pelas montanhas distantes"

VARIANTS = {
    "iso_01_com_ponto":      BASE + ".",
    "iso_02_sem_ponto":      BASE,
    "iso_03_exclamacao":     BASE + "!",
    "iso_04_continua":       BASE + " e tudo silencia.",
    "iso_05_so_metade":      "Uma criatura de olhos vermelhos surge entre as árvores.",
}

SPEAKER = "Ana Florence"


def main():
    import torch
    from TTS.api import TTS

    print("Carregando XTTS-v2...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    # Dump dos bytes pra excluir hipotese de encoding errado no source
    print("=== bytes da sentenca base (deve ter UTF-8 c3 a1 pra 'a' acentuado) ===")
    print(BASE.encode("utf-8")[:60].hex())
    print(f"len chars: {len(BASE)}, len bytes UTF-8: {len(BASE.encode('utf-8'))}")
    print()

    for name, text in VARIANTS.items():
        out_path = out_dir / f"{name}.wav"
        t0 = time.perf_counter()
        tts.tts_to_file(
            text=text,
            file_path=str(out_path),
            language="pt",
            speaker=SPEAKER,
        )
        print(f"  {name}: {time.perf_counter() - t0:.1f}s")

    print()
    print(f"WAVs em {out_dir}")
    print("Ouve iso_01 a iso_05 e me diz quais NAO disparam 'ponto ponto'.")


if __name__ == "__main__":
    main()
