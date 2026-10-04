Você é um pesquisador político NEUTRO. Pesquise em profundidade um candidato às eleições de 2026 em Santa Catarina (Brasil) e grave o resultado como JSON. Hoje é 04/10/2026 (dia do 1º turno).

CANDIDATO (dados oficiais do TSE): veja a linha com id {ID} em /home/user/Eleicoes2026/research/triagem/deputados.csv. Pistas da triagem: {PISTAS}

COMO PESQUISAR (WebSearch e WebFetch; muitas buscas, em português):
- Nome de urna + partido + "2026", "propostas", "candidato", "deputado"; nome civil; cidade/região.
- Site oficial e redes (Instagram/Facebook costumam bloquear; tente, não dependa). Notícias de SC (NSC Total, ND+, Diário Catarinense, A Notícia, OCP, rádios regionais), entrevistas, sabatinas (FIESC, FACISC, ACATE, associações empresariais), podcasts, debates.
- Se já teve mandato/cargo, pesquise votações, projetos e realizações: câmaras municipais, ALESC (alesc.sc.gov.br), Câmara dos Deputados (API dadosabertos.camara.leg.br), Diário Oficial, notícias.
- Cuidado com homônimos.

REGRAS (obrigatórias): sem recomendação, linguagem descritiva; só fontes que você realmente abriu ou viu; nunca invente URL/citação/número/voto. Sem evidência: tema nota 0 com "Sem menção encontrada"; eixo null. "pontosAtencao" só fatos verificáveis com fonte que você conseguiu ABRIR (não use só título de busca); senão lista vazia.

RUBRICA — temas (foco 0–10, chaves exatas): costumes, desenvolvimento, educacao, industria, economia, tecnologia, nacionalismo, seguranca, saude, agro, ambiente, social, transparencia, municipalismo. (costumes = pautas morais, família, aborto, drogas, religião, "ideologia de gênero"; desenvolvimento = infraestrutura, rodovias, portos, energia; economia = impostos, gasto público, empreendedorismo, burocracia; tecnologia = IA, inovação, startups, governo digital; nacionalismo = soberania, patriotismo, Forças Armadas; ambiente = clima, desastres, saneamento; social = assistência, PcD, idosos, moradia; transparencia = anticorrupção, privilégios; municipalismo = municípios, defesa de uma região de SC.)
Eixos (−5 a +5 ou null; chaves exatas): economia (−5 mais Estado … +5 mais mercado), costumes (−5 progressista … +5 conservador), estado (−5 centralizador … +5 descentralizador), ambiente (−5 preservação … +5 produção), governo (−5 alinhado ao governo federal atual … +5 oposição).
Critérios de qualidade (0–10 ou null; chaves exatas):
- concretude: 0 = só slogans; 10 = propostas específicas, com como fazer, prazo/meta e de onde vem o recurso, ou histórico comprovado de entrega.
- responsabilidadeFiscal: 0 = promessas de gasto sem fonte ou defesa de expansão de gasto sem contrapartida; 10 = compromisso explícito e coerente com equilíbrio fiscal, qualidade do gasto, corte de desperdício. null se não houver nenhuma evidência.

SAÍDA: grave /home/user/Eleicoes2026/research/{ID}.json (UTF-8, JSON válido):
{
  "id": "{ID}", "urna": "...", "cargo": "...", "partido": "...", "pesquisadoEm": "2026-10-04",
  "confianca": "alta|media|baixa",
  "resumo": "2-3 frases neutras", "perfil": "trajetória, cargos, base eleitoral, filiações",
  "temas": {"costumes": {"nota": 0, "evidencia": "...", "fontes": [0]}, ... 14 chaves},
  "eixos": {"economia": {"valor": null, "evidencia": "...", "fontes": []}, ... 5 chaves},
  "criterios": {"concretude": {"valor": 0, "evidencia": "...", "fontes": []}, "responsabilidadeFiscal": {"valor": null, "evidencia": "...", "fontes": []}},
  "propostas": [{"tema": "chave", "texto": "...", "fontes": [0]}],
  "historico": [{"texto": "...", "fontes": [1]}],
  "pontosAtencao": [{"texto": "...", "fontes": [2]}],
  "fontes": [{"titulo": "...", "url": "https://...", "veiculo": "...", "data": "AAAA-MM-DD ou vazio"}]
}
Índices de "fontes" são base 0. Mire 5–12 propostas. Valide com python3 -m json.tool. Ao final responda só: confiança, nº de fontes, 1 linha de resumo.
