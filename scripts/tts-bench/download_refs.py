"""Pega sample PT do repositorio oficial XTTS-v2 + fallbacks pra outras fontes."""
from pathlib import Path
from huggingface_hub import hf_hub_download, list_repo_files

out_dir = Path(__file__).parent / "refs"
out_dir.mkdir(exist_ok=True)

CANDIDATES = [
    # (repo_id, filename, save_as, repo_type)
    ("coqui/XTTS-v2", "samples/pt_sample.wav", "ref_01_coqui_pt.wav", "model"),
    ("coqui/XTTS-v2", "samples/pt-pt-sample.wav", "ref_02_coqui_pt_alt.wav", "model"),
]

# Lista arquivos disponiveis no repo coqui/XTTS-v2 pra entender o que tem
print("Listando samples disponiveis em coqui/XTTS-v2 ...")
try:
    files = list_repo_files("coqui/XTTS-v2", repo_type="model")
    samples = [f for f in files if "sample" in f.lower() or "/samples/" in f.lower()]
    for f in samples:
        print(f"  - {f}")
    print()
except Exception as e:
    print(f"(falhou listar: {e})\n")

# Baixa o que conseguir
saved = 0
for repo, fname, savename, rtype in CANDIDATES:
    try:
        local = hf_hub_download(repo_id=repo, filename=fname, repo_type=rtype)
        target = out_dir / savename
        import shutil
        shutil.copy(local, target)
        print(f"OK: {savename} <- {repo}/{fname}")
        saved += 1
    except Exception as e:
        print(f"FAIL {savename}: {e.__class__.__name__}: {str(e)[:120]}")

print(f"\n{saved} samples baixados em {out_dir}")
