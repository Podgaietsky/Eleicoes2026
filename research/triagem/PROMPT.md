Você faz a TRIAGEM de candidatos a deputado (federal e estadual) em Santa Catarina, eleições de 2026 (1º turno em 04/10/2026), segundo os critérios de UM ELEITOR. Não é recomendação sua: é medir aderência aos critérios dele, com evidência.

CRITÉRIOS DO ELEITOR (palavras dele):
"Quero candidatos que não estejam muito envolvidos em pautas morais, candidatos pragmáticos, que foquem em desenvolvimentismo mas com responsabilidade fiscal, favoreçam a indústria e a utilização de IA para aumento de eficiência do Estado. Itens correlatos também valem. Resumo: alguém que preze pelo desenvolvimento e crescimento de Santa Catarina, mas com propostas concretas e possíveis e com responsabilidade."

Traduzindo em sinais:
+ Fala de indústria, competitividade, infraestrutura/logística, energia, inovação, tecnologia, IA, governo digital, eficiência e modernização da gestão pública, desburocratização, ambiente de negócios, qualificação profissional/ensino técnico.
+ Responsabilidade fiscal: controle de gastos, qualidade do gasto, sem promessas irrealistas.
+ Propostas concretas e viáveis (com o quê, como, de onde vem o recurso), histórico de entrega (gestão pública, mandato, setor produtivo).
− Campanha centrada em pautas morais/costumes, ideológica ou de "guerra cultural".
− Só slogans, sem propostas.

LISTA: leia /home/user/Eleicoes2026/research/triagem/deputados.csv (colunas: id, urna, nome, num, cargo, partido, ocupacao, instrucao, idade, reeleicao, em2022, patrimonio, redes, ja_pesquisado). Você cobre SÓ os partidos: {PARTIDOS}.

COMO TRABALHAR (WebSearch + WebFetch, muitas buscas em português):
1. Priorize quem tem mais chance de ter informação pública: quem tenta reeleição, quem teve mandato/cargo (vereador, prefeito, secretário), quem ficou bem em 2022, quem tem site próprio na coluna redes.
2. Faça buscas temáticas cruzadas com os partidos: "candidato deputado estadual SC 2026 indústria", "inteligência artificial", "inovação", "FIESC sabatina candidatos deputado 2026", "ACATE candidatos", "FACISC", "responsabilidade fiscal", "desburocratização", nomes + "propostas".
3. Para cada candidato promissor, confirme rapidamente com 1 a 3 fontes (site oficial, notícia, entrevista, histórico de mandato). Cuidado com homônimos.
4. Não precisa avaliar todos. Quero os MELHORES achados: até 8 federais e 8 estaduais do seu grupo de partidos, ordenados por aderência.

REGRAS: só fontes que você realmente viu, nunca invente URL nem citação. Seja honesto sobre pontos que contrariam os critérios (ex.: forte pauta moral, promessas sem fonte de recurso, polêmicas).

SAÍDA: grave /home/user/Eleicoes2026/research/triagem/{ARQ}.json com:
{"grupo": "{PARTIDOS}", "candidatos": [
  {"id": "id do TSE (da planilha)", "urna": "...", "cargo": "Deputado federal|Deputado estadual", "partido": "...",
   "aderencia": 0-10, "motivo": "2-3 frases: por que se encaixa (ou não totalmente) nos critérios",
   "sinaisPositivos": ["..."], "sinaisNegativos": ["..."],
   "fontes": [{"titulo": "...", "url": "https://..."}]}
], "observacoes": "o que não deu para verificar"}
Valide com python3 -m json.tool. Responda ao final só com a lista de nomes e notas.
