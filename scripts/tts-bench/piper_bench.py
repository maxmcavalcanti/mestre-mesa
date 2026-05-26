"""Bench Piper PT-BR: gera mesmo texto 3x pra confirmar determinismo + ausencia de alucinacao."""
import time
import wave
from pathlib import Path
from huggingface_hub import hf_hub_download

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)


def download_voice(name="pt_BR-faber-medium"):
    base = f"pt/pt_BR/faber/medium/{name}"
    model = hf_hub_download(repo_id="rhasspy/piper-voices", filename=f"{base}.onnx")
    config = hf_hub_download(repo_id="rhasspy/piper-voices", filename=f"{base}.onnx.json")
    return model, config


def main():
    from piper import PiperVoice

    print("Baixando modelo pt_BR-faber-medium do HF...")
    model_path, _ = download_voice()
    print(f"Modelo: {model_path}")

    print("Carregando Piper voice...")
    t0 = time.perf_counter()
    voice = PiperVoice.load(model_path)
    print(f"Carregou em {time.perf_counter() - t0:.2f}s")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    rtfs = []
    for i in range(3):
        out_path = out_dir / f"piper_run_{i + 1}.wav"
        t0 = time.perf_counter()
        with wave.open(str(out_path), "wb") as wav:
            voice.synthesize_wav(TEXT, wav)
        gen_time = time.perf_counter() - t0

        with wave.open(str(out_path), "rb") as wav:
            frames = wav.getnframes()
            sr = wav.getframerate()
        audio_dur = frames / sr
        rtf = gen_time / audio_dur
        rtfs.append(rtf)
        print(f"  run {i + 1}: gen={gen_time:.2f}s, audio={audio_dur:.2f}s, RTF={rtf:.4f}")

    median = sorted(rtfs)[len(rtfs) // 2]
    print()
    print(f"=== RTF mediana: {median:.4f} ===")
    if median < 0.3:
        print("Veredito GREEN: folga enorme, streaming paralelo trivial.")
    elif median < 1.0:
        print("Veredito YELLOW.")
    else:
        print("Veredito RED.")
    print()
    print(f"WAVs em {out_dir}")
    print("Ouve piper_run_1/2/3.wav: confere (a) sem 'ponto ponto', (b) determinismo (3 iguais), (c) qualidade do timbre.")


if __name__ == "__main__":
    main()
