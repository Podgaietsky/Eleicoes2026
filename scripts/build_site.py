#!/usr/bin/env python3
"""Junta site/ + dados num único arquivo dist/index.html (o que é publicado).

    python3 scripts/build_site.py            # usa data/candidatos_sc_2026.json
    python3 scripts/build_site.py --sample   # usa data/sample.json (dados fictícios, só teste)
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--out", default="dist/index.html")
    args = ap.parse_args()

    data_path = ROOT / "data" / ("sample.json" if args.sample else "candidatos_sc_2026.json")
    data = json.loads(data_path.read_text())
    research_dir = ROOT / "research"
    research = {}
    for p in sorted(research_dir.glob("*.json")):
        r = json.loads(p.read_text())
        if r.get("id"):
            research[r["id"]] = r
    meta_path = research_dir / "rubrica.json"
    rubric = json.loads(meta_path.read_text()) if meta_path.exists() else None

    html = (ROOT / "site" / "index.html").read_text()
    css = (ROOT / "site" / "styles.css").read_text()
    js = (ROOT / "site" / "app.js").read_text()
    research_js = ROOT / "site" / "research.js"

    def safe(obj):
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    data_js = f"window.DATA={safe(data)};"
    if research:
        data_js += f"window.RESEARCH={safe({'rubrica': rubric, 'candidatos': research})};"
    if research and research_js.exists():
        js = research_js.read_text() + "\n" + js

    out = html.replace("/*__CSS__*/", css).replace("/*__DATA__*/", data_js).replace("/*__JS__*/", js)
    dest = ROOT / args.out
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    print(f"{dest.relative_to(ROOT)}: {len(out)/1e6:.2f} MB, {len(data['candidatos'])} candidatos,"
          f" {len(research)} pesquisados")


if __name__ == "__main__":
    main()
