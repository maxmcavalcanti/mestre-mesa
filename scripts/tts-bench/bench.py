import os
os.environ["COQUI_TOS_AGREED"] = "1"

import sys
import time
from pathlib import Path

SAMPLE_PT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)

SPEAKERS = [
    "Claribel Dervla",
    "Ana Florence",
    "Sofia Hellen",
    "Tammie Ema",
    "Damjan Chapman",
]


def main():
    import torch
    from TTS.api import TTS
    import soundfile as sf

    if not torch.cuda.is_available():
        print("ERRO: torch sem CUDA disponivel. Refaca setup.ps1.")
        sys.exit(1)

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print()

    print("Carregando XTTS-v2...")
    t0 = time.perf_counter()
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
    print(f"Carregou em {time.perf_counter() - t0:.1f}s")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    for spk in SPEAKERS:
        safe_name = spk.replace(" ", "_").lower()
        out_path = out_dir / f"speaker_{safe_name}.wav"
        t0 = time.perf_counter()
        try:
            tts.tts_to_file(
                text=SAMPLE_PT,
                file_path=str(out_path),
                language="pt",
                speaker=spk,
            )
        except Exception as e:
            print(f"  {spk}: FALHOU ({e.__class__.__name__}: {e})")
            continue
        gen_time = time.perf_counter() - t0

        audio, sr = sf.read(str(out_path))
        audio_dur = len(audio) / sr
        rtf = gen_time / audio_dur
        print(f"  {spk}: gen={gen_time:.1f}s, audio={audio_dur:.1f}s, RTF={rtf:.2f} -> {out_path.name}")

    print()
    print(f"WAVs em: {out_dir}")
    print("Ouve cada speaker_*.wav e me diz qual soa melhor (ou se nenhum convence).")


if __name__ == "__main__":
    main()
