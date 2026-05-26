"""Bench MeloTTS PT-BR: confirma ausencia de alucinacao em 3 rodadas do mesmo texto."""
import time
from pathlib import Path

TEXT = (
    "O guerreiro avança pela floresta sombria, espada em punho. "
    "Uma criatura de olhos vermelhos surge entre as árvores, "
    "rugindo um desafio gutural que ecoa pelas montanhas distantes. "
    "O ar pesa com cheiro de fumaça e algo mais antigo, esquecido pelos homens."
)


def main():
    import soundfile as sf
    from melo.api import TTS

    print("Carregando MeloTTS PT (1a vez baixa ~200MB do HF)...")
    t0 = time.perf_counter()
    model = TTS(language="PT", device="cuda:0")
    print(f"Carregou em {time.perf_counter() - t0:.1f}s")

    speaker_ids = model.hps.data.spk2id
    print(f"Speakers disponiveis: {list(speaker_ids.keys())}")
    spk_id = list(speaker_ids.values())[0]
    print()

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)

    rtfs = []
    for i in range(3):
        out_path = out_dir / f"melo_run_{i + 1}.wav"
        t0 = time.perf_counter()
        model.tts_to_file(TEXT, spk_id, str(out_path), speed=1.0)
        gen_time = time.perf_counter() - t0

        audio, sr = sf.read(str(out_path))
        audio_dur = len(audio) / sr
        rtf = gen_time / audio_dur
        rtfs.append(rtf)
        print(f"  run {i + 1}: gen={gen_time:.2f}s, audio={audio_dur:.2f}s, RTF={rtf:.3f}")

    median = sorted(rtfs)[len(rtfs) // 2]
    print()
    print(f"=== RTF mediana: {median:.3f} ===")
    if median < 0.3:
        print("Veredito GREEN: folga grande, pode streamar paralelo ao LLM.")
    elif median < 1.0:
        print("Veredito YELLOW: mais rapido que tempo real.")
    else:
        print("Veredito RED.")
    print()
    print(f"WAVs em {out_dir}")
    print("Ouve melo_run_1/2/3.wav: confere se (a) NAO tem 'ponto ponto' em nenhuma e (b) qualidade do timbre te agrada.")


if __name__ == "__main__":
    main()
