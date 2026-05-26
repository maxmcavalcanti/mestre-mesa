"""Lista vozes PT-BR do Piper e testa edresson + variacoes de prosodia no faber."""
import time
import wave
from pathlib import Path
from huggingface_hub import hf_hub_download, list_repo_files

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)


def main():
    from piper import PiperVoice, SynthesisConfig

    print("Listando vozes PT-BR no repo rhasspy/piper-voices...")
    files = list_repo_files("rhasspy/piper-voices")
    pt_voices = sorted(set(
        f.rsplit("/", 1)[0]
        for f in files
        if f.startswith("pt/pt_BR/") and f.endswith(".onnx")
    ))
    for v in pt_voices:
        print(f"  - {v}")
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    # 1) Testa todas as vozes PT-BR disponiveis com defaults
    for path in pt_voices:
        name = path.replace("pt/pt_BR/", "").replace("/", "-")
        onnx_name = path.split("/")[-1] if False else None
        # Os arquivos sao "pt_BR-<speaker>-<quality>.onnx" dentro do dir
        # listamos pra pegar o nome real
        onnx_files = [f for f in files if f.startswith(path + "/") and f.endswith(".onnx")]
        if not onnx_files:
            continue
        model_remote = onnx_files[0]
        try:
            model_local = hf_hub_download(repo_id="rhasspy/piper-voices", filename=model_remote)
            hf_hub_download(repo_id="rhasspy/piper-voices", filename=model_remote + ".json")
        except Exception as e:
            print(f"  pulando {name}: {e.__class__.__name__}")
            continue

        voice = PiperVoice.load(model_local)
        out = out_dir / f"piper_voice_{name}.wav"
        t0 = time.perf_counter()
        with wave.open(str(out), "wb") as wav:
            voice.synthesize_wav(TEXT, wav)
        print(f"  voz {name}: {time.perf_counter() - t0:.2f}s -> {out.name}")

    print()

    # 2) Variacoes de prosodia na faber-medium
    print("Variacoes de prosodia no pt_BR-faber-medium:")
    faber_path = hf_hub_download(
        repo_id="rhasspy/piper-voices",
        filename="pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx",
    )
    voice = PiperVoice.load(faber_path)

    presets = {
        # length_scale: 1.0 default, <1 = mais rapido, >1 = mais devagar
        # noise_scale: variabilidade do timbre (default 0.667)
        # noise_w_scale: variabilidade da duracao de cada fonema (default 0.8)
        "faber_slow":          dict(length_scale=1.20),
        "faber_fast":          dict(length_scale=0.85),
        "faber_more_variance": dict(noise_scale=1.0, noise_w_scale=1.2),
        "faber_dramatic":      dict(length_scale=1.15, noise_scale=0.9, noise_w_scale=1.0),
    }
    for name, cfg in presets.items():
        out = out_dir / f"piper_{name}.wav"
        syn_cfg = SynthesisConfig(**cfg)
        t0 = time.perf_counter()
        with wave.open(str(out), "wb") as wav:
            voice.synthesize_wav(TEXT, wav, syn_config=syn_cfg)
        print(f"  {name} ({cfg}): {time.perf_counter() - t0:.2f}s -> {out.name}")

    print()
    print(f"WAVs em {out_dir}")
    print("Compara:")
    print("  - piper_voice_*.wav: vozes alternativas")
    print("  - piper_faber_*.wav: variacoes de prosodia da faber")


if __name__ == "__main__":
    main()
