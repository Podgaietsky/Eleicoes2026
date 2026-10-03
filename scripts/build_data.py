#!/usr/bin/env python3
"""Lê os ZIPs do TSE em data/raw/ e gera data/candidatos_sc_2026.json.

Um registro por candidato, com dados pessoais, partido, bens declarados agrupados
por categoria, redes sociais e, quando houver, o que declarou na eleição de 2022.

    python3 scripts/build_data.py [--uf SC]
"""
import argparse
import base64
import csv
import io
import json
import re
import sys
import unicodedata
import zipfile
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
ELEICAO = date(2026, 10, 4)
NULLS = {"", "#NULO#", "#NULO", "#NE#", "#NE", "-1", "-3", "-4", "NÃO DIVULGÁVEL"}

csv.field_size_limit(sys.maxsize)


# ---------------------------------------------------------------- leitura

def read_zip_csv(zip_name, uf, prefer_suffix=None):
    """Lê o CSV da UF dentro do ZIP do TSE. Retorna lista de dicts (ou [] se não existir)."""
    path = RAW / zip_name
    if not path.exists():
        return []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith((".csv", ".txt"))]
        pick = [n for n in names if re.search(rf"_{uf}\.(csv|txt)$", n, re.I)]
        if not pick and prefer_suffix:
            pick = [n for n in names if prefer_suffix in n]
        if not pick:
            pick = [n for n in names if "BRASIL" in n.upper()] or names
        rows = []
        for name in pick:
            raw = z.read(name)
            text = raw.decode("latin-1")
            reader = csv.DictReader(io.StringIO(text), delimiter=";")
            for r in reader:
                if "SG_UF" in r and r["SG_UF"] not in (uf, None) and len(pick) > 1:
                    continue
                rows.append(r)
        # quando o arquivo é nacional, filtra pela UF
        if rows and "SG_UF" in rows[0]:
            rows = [r for r in rows if r.get("SG_UF") == uf]
        return rows


def clean(v):
    if v is None:
        return None
    v = v.strip()
    return None if v.upper() in NULLS else v


def first(r, *keys):
    for k in keys:
        v = clean(r.get(k))
        if v is not None:
            return v
    return None


def money(v):
    v = clean(v)
    if v is None:
        return 0.0
    v = v.replace(".", "").replace(",", ".") if "," in v else v
    try:
        return float(v)
    except ValueError:
        return 0.0


def parse_date(v):
    v = clean(v)
    if not v:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None


def age_at(born, when=ELEICAO):
    if not born:
        return None
    return when.year - born.year - ((when.month, when.day) < (born.month, born.day))


SMALL = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "ou", "com", "para"}
KEEP_UPPER = {"II", "III", "IV", "SC", "TI", "PM", "BM", "MDB", "PT", "PL", "PSD", "PP"}


def title(s):
    if not s:
        return s
    out = []
    for i, w in enumerate(s.lower().split()):
        if w.upper() in KEEP_UPPER:
            out.append(w.upper())
        elif i > 0 and w in SMALL:
            out.append(w)
        else:
            out.append("-".join(p[:1].upper() + p[1:] for p in w.split("-")))
    return " ".join(out)


def norm_key(name, born):
    n = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().upper()
    n = re.sub(r"[^A-Z ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return f"{n}|{born.isoformat() if born else ''}"


# ---------------------------------------------------------------- classificações

CARGO_ORDEM = ["GOVERNADOR", "VICE-GOVERNADOR", "SENADOR", "1º SUPLENTE", "2º SUPLENTE",
               "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]
CARGO_LABEL = {
    "GOVERNADOR": "Governador", "VICE-GOVERNADOR": "Vice-governador", "SENADOR": "Senador",
    "1º SUPLENTE": "1º suplente (Senado)", "2º SUPLENTE": "2º suplente (Senado)",
    "1º SUPLENTE SENADOR": "1º suplente (Senado)", "2º SUPLENTE SENADOR": "2º suplente (Senado)",
    "DEPUTADO FEDERAL": "Deputado federal", "DEPUTADO ESTADUAL": "Deputado estadual",
}

INSTRUCAO_ORDEM = ["LÊ E ESCREVE", "ENSINO FUNDAMENTAL INCOMPLETO", "ENSINO FUNDAMENTAL COMPLETO",
                   "ENSINO MÉDIO INCOMPLETO", "ENSINO MÉDIO COMPLETO", "SUPERIOR INCOMPLETO",
                   "SUPERIOR COMPLETO"]
INSTRUCAO_LABEL = {
    "LÊ E ESCREVE": "Lê e escreve", "ENSINO FUNDAMENTAL INCOMPLETO": "Fundamental incompleto",
    "ENSINO FUNDAMENTAL COMPLETO": "Fundamental completo",
    "ENSINO MÉDIO INCOMPLETO": "Médio incompleto", "ENSINO MÉDIO COMPLETO": "Médio completo",
    "SUPERIOR INCOMPLETO": "Superior incompleto", "SUPERIOR COMPLETO": "Superior completo",
}

BEM_GRUPOS = [
    ("Imóveis", r"im[óo]ve|casa|apartamento|terreno|pr[ée]dio|sala|loja|galp[ãa]o|terra nua|"
                r"constru[çc][ãa]o|benfeitoria|rural|ch[áa]cara|s[íi]tio|fazenda|garagem|box"),
    ("Veículos", r"ve[íi]culo|autom[óo]vel|aeronave|embarca[çc]|motocicleta|caminh|trator|barco|lancha"),
    ("Participações societárias", r"quota|cota|participa[çc][ãa]o societ|a[çc][õo]es|empresa|capital"),
    ("Aplicações e investimentos", r"aplica[çc]|poupan|dep[óo]sito|fundo|renda fixa|t[íi]tulo|"
                                   r"previd|vgbl|pgbl|cripto|ouro|investimento|cdb|lci|lca|tesouro|conta corrente"),
    ("Dinheiro em espécie", r"esp[ée]cie|dinheiro"),
    ("Créditos e outros", r"."),
]


def bem_grupo(tipo, desc):
    t = (tipo or "").lower()
    for nome, rx in BEM_GRUPOS:
        if re.search(rx, t):
            return nome
    d = (desc or "").lower()
    for nome, rx in BEM_GRUPOS[:-1]:
        if re.search(rx, d):
            return nome
    return "Créditos e outros"


def situacao(r):
    raw = first(r, "DS_DETALHE_SITUACAO_CAND", "DS_SITUACAO_JULGAMENTO", "DS_SITUACAO_CANDIDATO_PLEITO",
                "DS_SITUACAO_CANDIDATURA") or "Não informado"
    u = raw.upper()
    if "INDEFERIDO COM RECURSO" in u or "RECURSO" in u or "PENDENTE" in u or "SUB JUDICE" in u:
        grp = "Sub judice / recurso"
    elif u.startswith("DEFERIDO"):
        grp = "Deferida"
    elif "INDEFERIDO" in u or "CASSADO" in u or "INAPTO" in u or "NÃO CONHECIMENTO" in u:
        grp = "Indeferida"
    elif "RENÚNCIA" in u or "FALECIDO" in u or "CANCELADO" in u or "DESIST" in u:
        grp = "Renúncia / cancelada"
    elif "APTO" in u:
        grp = "Deferida"
    else:
        grp = "Aguardando julgamento"
    return grp, title(raw)


# ---------------------------------------------------------------- fotos

def load_photos(uf, size=96):
    path = RAW / f"foto_cand2026_{uf}_div.zip"
    if not path.exists():
        return {}
    try:
        from PIL import Image
    except ImportError:
        print("Pillow não instalado; pulando fotos")
        return {}
    photos = {}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            m = re.search(r"F[A-Z]{2}(\d+)_div\.(jpe?g|png)$", name, re.I) or re.search(r"(\d{6,})", name)
            if not m:
                continue
            try:
                im = Image.open(io.BytesIO(z.read(name))).convert("RGB")
                w, h = im.size
                side = min(w, h)
                top = max(0, int((h - side) * 0.25))
                im = im.crop(((w - side) // 2, top, (w - side) // 2 + side, top + side)).resize((size, size))
                buf = io.BytesIO()
                im.save(buf, "WEBP", quality=62, method=6)
                photos[m.group(1)] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
            except Exception:  # noqa: BLE001
                continue
    return photos


# ---------------------------------------------------------------- 2022

def load_2022(uf):
    cands = read_zip_csv("consulta_cand_2022.zip", uf)
    bens = read_zip_csv("bem_candidato_2022.zip", uf)
    if not cands:
        return {}
    pat = defaultdict(float)
    for b in bens:
        pat[b.get("SQ_CANDIDATO")] += money(b.get("VR_BEM_CANDIDATO"))
    hist = {}
    for r in cands:
        if r.get("NR_TURNO") not in (None, "1"):
            continue
        born = parse_date(r.get("DT_NASCIMENTO"))
        key = norm_key(r.get("NM_CANDIDATO"), born)
        hist[key] = {
            "cargo": title(first(r, "DS_CARGO")),
            "partido": first(r, "SG_PARTIDO"),
            "resultado": title(first(r, "DS_SIT_TOT_TURNO") or ""),
            "patrimonio": round(pat.get(r.get("SQ_CANDIDATO"), 0.0), 2),
        }
    # resultado do 2º turno, se houver
    for r in cands:
        if r.get("NR_TURNO") == "2":
            key = norm_key(r.get("NM_CANDIDATO"), parse_date(r.get("DT_NASCIMENTO")))
            if key in hist and first(r, "DS_SIT_TOT_TURNO"):
                hist[key]["resultado"] = title(first(r, "DS_SIT_TOT_TURNO"))
    return hist


# ---------------------------------------------------------------- principal

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uf", default="SC")
    args = ap.parse_args()
    uf = args.uf

    cands = read_zip_csv("consulta_cand_2026.zip", uf)
    if not cands:
        sys.exit("consulta_cand_2026.zip não encontrado ou sem dados da UF. Rode scripts/fetch_tse.py.")
    comp = {r["SQ_CANDIDATO"]: r for r in read_zip_csv("consulta_cand_complementar_2026.zip", uf)}
    bens_rows = read_zip_csv("bem_candidato_2026.zip", uf)
    redes_rows = read_zip_csv("rede_social_candidato_2026.zip", uf)
    hist = load_2022(uf)
    photos = load_photos(uf)

    bens = defaultdict(list)
    for b in bens_rows:
        bens[b.get("SQ_CANDIDATO")].append(b)
    redes = defaultdict(list)
    for r in redes_rows:
        url = clean(r.get("DS_URL"))
        if url:
            redes[r.get("SQ_CANDIDATO")].append(url)

    # mantém só o registro mais recente por candidato (o arquivo pode ter 1º e 2º turno)
    by_sq = {}
    for r in cands:
        sq = r.get("SQ_CANDIDATO")
        if sq not in by_sq or (r.get("NR_TURNO") or "1") < (by_sq[sq].get("NR_TURNO") or "1"):
            by_sq[sq] = r

    out = []
    for sq, r in by_sq.items():
        c = {**r, **{k: v for k, v in comp.get(sq, {}).items() if clean(v) is not None}}
        cargo_raw = (first(c, "DS_CARGO") or "").upper()
        born = parse_date(c.get("DT_NASCIMENTO"))
        idade = age_at(born)
        if idade is None:
            try:
                idade = int(first(c, "NR_IDADE_DATA_POSSE"))
            except (TypeError, ValueError):
                idade = None

        itens = []
        grupos = defaultdict(float)
        for b in sorted(bens.get(sq, []), key=lambda b: -money(b.get("VR_BEM_CANDIDATO"))):
            v = money(b.get("VR_BEM_CANDIDATO"))
            tipo = first(b, "DS_TIPO_BEM_CANDIDATO") or ""
            desc = first(b, "DS_BEM_CANDIDATO") or ""
            g = bem_grupo(tipo, desc)
            grupos[g] += v
            itens.append({"g": g, "t": title(tipo), "d": desc[:220], "v": round(v, 2)})
        total = round(sum(grupos.values()), 2)

        sit_grp, sit_det = situacao(c)
        fed = first(c, "NM_FEDERACAO")
        sg_fed = first(c, "SG_FEDERACAO")
        nome = first(c, "NM_CANDIDATO") or ""
        rec = {
            "id": sq,
            "urna": title(first(c, "NM_URNA_CANDIDATO") or nome),
            "nome": title(first(c, "NM_SOCIAL_CANDIDATO") or nome),
            "num": first(c, "NR_CANDIDATO"),
            "cargo": CARGO_LABEL.get(cargo_raw, title(cargo_raw)),
            "cargoOrd": CARGO_ORDEM.index(cargo_raw) if cargo_raw in CARGO_ORDEM else 9,
            "partido": first(c, "SG_PARTIDO"),
            "partidoNome": title(first(c, "NM_PARTIDO")),
            "federacao": (sg_fed or title(fed)) if fed else None,
            "coligacao": title(first(c, "NM_COLIGACAO")),
            "coligComp": first(c, "DS_COMPOSICAO_COLIGACAO", "DS_COMPOSICAO_FEDERACAO"),
            "situacao": sit_grp,
            "situacaoDet": sit_det,
            "nasc": born.isoformat() if born else None,
            "idade": idade,
            "genero": title(first(c, "DS_GENERO")),
            "raca": title(first(c, "DS_COR_RACA")),
            "instrucao": INSTRUCAO_LABEL.get((first(c, "DS_GRAU_INSTRUCAO") or "").upper(),
                                             title(first(c, "DS_GRAU_INSTRUCAO"))),
            "instrucaoOrd": INSTRUCAO_ORDEM.index((first(c, "DS_GRAU_INSTRUCAO") or "").upper())
                if (first(c, "DS_GRAU_INSTRUCAO") or "").upper() in INSTRUCAO_ORDEM else -1,
            "estadoCivil": title(first(c, "DS_ESTADO_CIVIL")),
            "ocupacao": title(first(c, "DS_OCUPACAO")),
            "natural": " / ".join(x for x in [title(first(c, "NM_MUNICIPIO_NASCIMENTO")),
                                                first(c, "SG_UF_NASCIMENTO")] if x) or None,
            "reeleicao": (first(c, "ST_REELEICAO") or "").upper() == "S",
            "email": (first(c, "DS_EMAIL", "NM_EMAIL") or "").lower() or None,
            "limiteGastos": money(first(c, "VR_DESPESA_MAX_CAMPANHA")) or None,
            "patrimonio": total,
            "bensGrupos": {k: round(v, 2) for k, v in sorted(grupos.items(), key=lambda kv: -kv[1])},
            "bens": itens,
            "redes": redes.get(sq, []),
            "eleicaoCod": first(c, "CD_ELEICAO"),
        }
        h = hist.get(norm_key(nome, born))
        if h:
            rec["h2022"] = h
        if sq in photos:
            rec["foto"] = photos[sq]
        out.append(rec)

    out.sort(key=lambda x: (x["cargoOrd"], x["partido"] or "", x["urna"]))
    gerado = first(cands[0], "DT_GERACAO") or ""
    meta = {
        "uf": uf,
        "ano": 2026,
        "dataEleicao": ELEICAO.isoformat(),
        "geradoTSE": gerado,
        "extraidoEm": date.today().isoformat(),
        "total": len(out),
        "fonte": "TSE — Portal de Dados Abertos (consulta_cand, bem_candidato, rede_social_candidato)",
        "fotos": bool(photos),
        "historico2022": bool(hist),
    }
    OUT.mkdir(exist_ok=True)
    dest = OUT / f"candidatos_{uf.lower()}_2026.json"
    dest.write_text(json.dumps({"meta": meta, "candidatos": out}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out)} candidatos -> {dest.relative_to(ROOT)}")
    cont = defaultdict(int)
    for c in out:
        cont[c["cargo"]] += 1
    for k, v in sorted(cont.items(), key=lambda kv: -kv[1]):
        print(f"  {k:26s} {v}")
    print(f"  com bens: {sum(1 for c in out if c['bens'])} | com foto: {sum(1 for c in out if 'foto' in c)}"
          f" | com 2022: {sum(1 for c in out if 'h2022' in c)}")


if __name__ == "__main__":
    main()
