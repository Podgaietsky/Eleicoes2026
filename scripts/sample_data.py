#!/usr/bin/env python3
"""Gera dados FICTÍCIOS só para testar o site localmente (data/sample.json).
Nunca publicar: os nomes são "Exemplo NNN" e os valores são aleatórios."""
import json
import random
from pathlib import Path

random.seed(7)
ROOT = Path(__file__).resolve().parent.parent
PARTIDOS = ["PL", "MDB", "PSD", "PT", "UNIÃO", "PP", "NOVO", "REPUBLICANOS", "PSB", "PDT", "PSOL",
            "PODE", "CIDADANIA", "PV", "PCdoB", "REDE", "AVANTE", "SOLIDARIEDADE", "MOBILIZA", "DC", "PRD"]
OCUP = ["Empresário", "Advogado", "Médico", "Professor de Ensino Médio", "Agricultor", "Deputado",
        "Vereador", "Policial Militar", "Engenheiro", "Comerciante", "Servidor Público Estadual",
        "Administrador", "Aposentado (Exceto Servidor Público)", "Jornalista e Redator", "Dona de Casa",
        "Estudante, Bolsista, Estagiário e Assemelhados", "Outros"]
INSTR = ["Lê e escreve", "Fundamental incompleto", "Fundamental completo", "Médio incompleto",
         "Médio completo", "Superior incompleto", "Superior completo"]
CARGOS = [("Governador", 0, 7), ("Vice-governador", 1, 7), ("Senador", 2, 9),
          ("1º suplente (Senado)", 3, 9), ("2º suplente (Senado)", 4, 9),
          ("Deputado federal", 5, 260), ("Deputado estadual", 6, 520)]
GRUPOS = ["Imóveis", "Veículos", "Aplicações e investimentos", "Participações societárias",
          "Dinheiro em espécie", "Créditos e outros"]
SIT = ["Deferida"] * 40 + ["Indeferida", "Sub judice / recurso", "Aguardando julgamento", "Renúncia / cancelada"]

out = []
i = 0
for cargo, ordem, n in CARGOS:
    for _ in range(n):
        i += 1
        p = random.choice(PARTIDOS)
        idade = max(21, min(85, int(random.gauss(49, 11))))
        tot = 0 if random.random() < .18 else round(10 ** random.uniform(3.5, 7.6), 2)
        grupos, bens = {}, []
        rest = tot
        for g in random.sample(GRUPOS, random.randint(1, 4)):
            v = round(rest * random.uniform(.3, .8), 2) if g != "Créditos e outros" else round(rest, 2)
            rest -= v
            if v > 0:
                grupos[g] = grupos.get(g, 0) + v
                bens.append({"g": g, "t": g, "d": f"Bem fictício de exemplo ({g.lower()})", "v": v})
        if rest > 0 and bens:
            bens[0]["v"] += rest
            grupos[bens[0]["g"]] += rest
        sit = random.choice(SIT)
        rec = {
            "id": f"9{i:08d}", "urna": f"Exemplo {i:03d}", "nome": f"Pessoa Fictícia Número {i:03d}",
            "num": str(random.randint(10, 99) if ordem in (0, 1) else random.randint(100, 99999)),
            "cargo": cargo, "cargoOrd": ordem, "partido": p, "partidoNome": f"Partido {p}",
            "federacao": "Federação Exemplo" if p in ("PT", "PCdoB", "PV") else None,
            "coligacao": None, "coligComp": None, "situacao": sit, "situacaoDet": sit,
            "nasc": f"{2026-idade}-05-10", "idade": idade,
            "genero": "Feminino" if random.random() < .34 else "Masculino",
            "raca": random.choices(["Branca", "Parda", "Preta", "Amarela", "Indígena"], [80, 13, 5, 1, 1])[0],
            "instrucao": random.choices(INSTR, [1, 3, 4, 2, 22, 10, 58])[0],
            "estadoCivil": random.choice(["Casado(a)", "Solteiro(a)", "Divorciado(a)"]),
            "ocupacao": random.choice(OCUP), "natural": "Cidade Exemplo / SC",
            "reeleicao": random.random() < .08, "email": None, "limiteGastos": None,
            "patrimonio": round(tot, 2), "bensGrupos": grupos, "bens": bens,
            "redes": ["https://example.com/perfil"] if random.random() < .6 else [], "eleicaoCod": "0",
        }
        rec["instrucaoOrd"] = INSTR.index(rec["instrucao"])
        if random.random() < .3:
            rec["h2022"] = {"cargo": random.choice(["Deputado Estadual", "Deputado Federal"]), "partido": p,
                            "resultado": random.choice(["Eleito por QP", "Suplente", "Não Eleito"]),
                            "patrimonio": round(tot * random.uniform(.4, 1.1), 2)}
        out.append(rec)

meta = {"uf": "SC", "ano": 2026, "dataEleicao": "2026-10-04", "geradoTSE": "", "extraidoEm": "2026-10-03",
        "total": len(out), "fonte": "DADOS FICTÍCIOS DE TESTE", "fotos": False, "historico2022": True,
        "amostra": True}
(ROOT / "data" / "sample.json").write_text(json.dumps({"meta": meta, "candidatos": out}, ensure_ascii=False))
print(len(out), "registros fictícios -> data/sample.json")
