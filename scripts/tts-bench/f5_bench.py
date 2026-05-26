"""Bench F5-TTS PT-BR via voice cloning na referencia que ja temos."""
import time
from pathlib import Path

# Disponibiliza ffmpeg/ffprobe portateis no PATH (pydub precisa)
import static_ffmpeg
static_ffmpeg.add_paths()

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)


def main():
    import soundfile as sf
    from f5_tts.api import F5TTS

    ref = Path(__file__).parent / "refs" / "ref_01_coqui_pt.wav"
    if not ref.exists():
        raise SystemExit(f"Referencia nao encontrada: {ref}")

    print("Carregando F5TTS_v1_Base (1a vez baixa modelos: F5 + vocos + whisper p/ ASR)...")
    t0 = time.perf_counter()
    f5 = F5TTS(model="F5TTS_v1_Base", device="cuda")
    print(f"Carregou em {time.perf_counter() - t0:.1f}s")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    rtfs = []
    for i in range(3):
        out_path = out_dir / f"f5_run_{i + 1}.wav"
        t0 = time.perf_counter()
        audio, sr, _ = f5.infer(
            ref_file=str(ref),
            ref_text="",  # auto-transcribe via Whisper
            gen_text=TEXT,
            file_wave=str(out_path),
        )
        gen_time = time.perf_counter() - t0

        dur = len(audio) / sr
        rtf = gen_time / dur
        rtfs.append(rtf)
        print(f"  run {i + 1}: gen={gen_time:.2f}s, audio={dur:.2f}s, RTF={rtf:.3f}")

    median = sorted(rtfs)[len(rtfs) // 2]
    print()
    print(f"=== RTF mediana: {median:.3f} ===")
    if median < 0.3:
        print("Veredito GREEN.")
    elif median < 1.0:
        print("Veredito YELLOW.")
    else:
        print("Veredito RED.")
    print()
    print(f"WAVs em {out_dir}")
    print("Compara f5_run_1/2/3.wav:")
    print("  - som 'ponto ponto'? (F5 e flow-matching, deveria nao alucinar)")
    print("  - 3 runs identicas? (flow matching pode ser estocastico, mas menos)")
    print("  - timbre + expressividade?")


if __name__ == "__main__":
    main()
