"""F5-TTS com finetune PT-BR (Tharyck/multispeaker-ptbr-f5tts)."""
import time
from pathlib import Path

import static_ffmpeg
static_ffmpeg.add_paths()

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)

REPO = "Tharyck/multispeaker-ptbr-f5tts"


def main():
    from huggingface_hub import hf_hub_download
    from f5_tts.api import F5TTS

    print(f"Baixando finetune PT-BR de {REPO}...")
    ckpt = hf_hub_download(REPO, "model_last.safetensors")
    vocab = hf_hub_download(REPO, "vocab.txt")
    ref_wav_m = hf_hub_download(REPO, "audio_ref/M010-0323.wav")
    ref_txt_m = hf_hub_download(REPO, "audio_ref/M010-0323.txt")
    ref_wav_f = hf_hub_download(REPO, "audio_ref/F034-0960.wav")
    ref_txt_f = hf_hub_download(REPO, "audio_ref/F034-0960.txt")

    refs = [
        ("masc", ref_wav_m, Path(ref_txt_m).read_text(encoding="utf-8").strip()),
        ("fem", ref_wav_f, Path(ref_txt_f).read_text(encoding="utf-8").strip()),
    ]
    for label, wav, txt in refs:
        print(f"  ref {label}: '{txt[:80]}'")
    print()

    print("Carregando F5-TTS com finetune PT-BR...")
    t0 = time.perf_counter()
    f5 = F5TTS(
        model="F5TTS_v1_Base",
        ckpt_file=ckpt,
        vocab_file=vocab,
        device="cuda",
    )
    print(f"Carregou em {time.perf_counter() - t0:.1f}s")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    for label, ref_wav, ref_text in refs:
        for i in range(2):  # 2 runs por voz pra avaliar consistencia
            out_path = out_dir / f"f5ptbr_{label}_run{i + 1}.wav"
            t0 = time.perf_counter()
            audio, sr, _ = f5.infer(
                ref_file=ref_wav,
                ref_text=ref_text,
                gen_text=TEXT,
                file_wave=str(out_path),
            )
            gen_time = time.perf_counter() - t0
            dur = len(audio) / sr
            print(f"  {label} run{i + 1}: gen={gen_time:.1f}s, audio={dur:.1f}s, RTF={gen_time / dur:.3f}")

    print()
    print(f"WAVs em {out_dir}")
    print("Compara f5ptbr_masc_* e f5ptbr_fem_*:")
    print("  - finalmente soa PT-BR de verdade?")
    print("  - tem 'ponto ponto'?")
    print("  - expressividade convence?")


if __name__ == "__main__":
    main()
