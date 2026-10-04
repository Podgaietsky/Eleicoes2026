#!/usr/bin/env python3
"""Baixa os arquivos de dados abertos do TSE necessários para o dashboard de SC.

Os ZIPs ficam em data/raw/ (ignorado pelo git). Rodar de novo só baixa o que falta;
use --force para baixar tudo outra vez.

    python3 scripts/fetch_tse.py [--uf SC] [--force]
"""
import argparse
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"
FOTOS = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes{ano}/fotos"

# nome local -> lista de URLs candidatas (a primeira que responder vence)
def sources(uf):
    return {
        "consulta_cand_2026.zip": [f"{CDN}/consulta_cand/consulta_cand_2026.zip"],
        "consulta_cand_complementar_2026.zip": [
            f"{CDN}/consulta_cand_complementar/consulta_cand_complementar_2026.zip"],
        "bem_candidato_2026.zip": [f"{CDN}/bem_candidato/bem_candidato_2026.zip"],
        "rede_social_candidato_2026.zip": [
            f"{CDN}/consulta_cand/rede_social_candidato_2026.zip"],
        # propostas de governo (PDFs dos majoritários; usadas na pesquisa de propostas)
        f"proposta_governo_2026_{uf}.zip": [f"{CDN}/proposta_governo/proposta_governo_2026_{uf}.zip"],
        # 2022: para histórico (resultado e patrimônio declarado na eleição anterior)
        "consulta_cand_2022.zip": [f"{CDN}/consulta_cand/consulta_cand_2022.zip"],
        "bem_candidato_2022.zip": [f"{CDN}/bem_candidato/bem_candidato_2022.zip"],
        # fotos (opcional; usadas como miniaturas)
        f"foto_cand2026_{uf}_div.zip": [
            f"{FOTOS.format(ano=2026)}/foto_cand2026_{uf}_div.zip",
            f"{FOTOS.format(ano=2026)}/foto_cand2026_{uf}.zip"],
    }

OPTIONAL = {"consulta_cand_complementar_2026.zip", "rede_social_candidato_2026.zip",
            "consulta_cand_2022.zip", "bem_candidato_2022.zip"}
OPTIONAL_PREFIX = ("foto_", "proposta_")


def download(url, dest):
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "eleicoes2026-sc/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        got = 0
        while chunk := r.read(1 << 20):
            f.write(chunk)
            got += len(chunk)
            if total:
                print(f"\r  {got/1e6:7.1f} / {total/1e6:.1f} MB", end="", flush=True)
    print()
    tmp.rename(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uf", default="SC")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    failed = []
    for name, urls in sources(args.uf).items():
        dest = RAW / name
        if dest.exists() and not args.force:
            print(f"ok (cache) {name}")
            continue
        for url in urls:
            ok = False
            for attempt in range(4):
                try:
                    print(f"baixando {url}")
                    download(url, dest)
                    ok = True
                    break
                except Exception as e:  # noqa: BLE001
                    print(f"  falhou ({e})")
                    if "404" in str(e) or "403" in str(e):
                        break
                    time.sleep(2 ** (attempt + 1))
            if ok:
                break
        else:
            failed.append(name)

    missing_required = [n for n in failed if n not in OPTIONAL and not n.startswith(OPTIONAL_PREFIX)]
    if failed:
        print("\nNão baixados:", ", ".join(failed))
    if missing_required:
        sys.exit(1)


if __name__ == "__main__":
    main()
