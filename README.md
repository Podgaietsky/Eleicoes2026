# Candidatos SC 2026

Painel com os dados oficiais do TSE de todos os candidatos de Santa Catarina nas eleições de 2026
(Governador, Senado, Deputado Federal e Deputado Estadual). Ele organiza os dados para comparação
e não recomenda nenhum candidato.

## Como gerar

```bash
python3 scripts/fetch_tse.py     # baixa os ZIPs do TSE para data/raw/ (precisa de acesso a cdn.tse.jus.br)
python3 scripts/build_data.py    # gera data/candidatos_sc_2026.json
python3 scripts/build_site.py    # gera dist/index.html (página única, publicada como Artifact)
```

Para testar o site sem os dados reais: `python3 scripts/sample_data.py && python3 scripts/build_site.py --sample --out dist/sample.html`
(gera dados fictícios, marcados com uma faixa amarela no topo).

## Estrutura

- `scripts/`: download, normalização dos dados e montagem do site
- `site/`: HTML, CSS e JS do painel (sem dependências)
- `data/`: JSON final versionado (os arquivos brutos ficam fora do git)
- `research/`: análises de propostas dos candidatos escolhidos (uma por arquivo JSON)
