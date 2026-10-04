/* Aba "Propostas": análise das propostas dos candidatos pesquisados */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem("sc26:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sc26:" + k, JSON.stringify(v)); } catch { /* sem storage */ } },
};
const SHORT = { costumes: "Costumes", desenvolvimento: "Infraestrutura", educacao: "Educação", industria: "Indústria", economia: "Economia", tecnologia: "Tecnologia/IA", nacionalismo: "Nacionalismo", seguranca: "Segurança", saude: "Saúde", agro: "Agro", ambiente: "Ambiente", social: "Social", transparencia: "Transparência", municipalismo: "Municípios" };
const CONF = { alta: "Muita informação pública", media: "Informação pública moderada", baixa: "Pouca informação pública" };

window.renderResearchView = function (root, ctx) {
  const { BY_ID, RESEARCH, openCandidate, avatar, esc, S } = ctx;
  const RUB = RESEARCH.rubrica || { temas: [], eixos: [] };
  const TEMAS = RUB.temas, EIXOS = RUB.eixos;
  const list = Object.values(RESEARCH.candidatos)
    .map(r => ({ r, c: BY_ID.get(r.id) })).filter(x => x.c)
    .sort((a, b) => a.c.cargoOrd - b.c.cargoOrd || a.c.urna.localeCompare(b.c.urna, "pt"));
  const st = S.rs || (S.rs = {
    sortTema: null, ax: store.get("rsAx", ["economia", "costumes"]), focus: S.researchFocus || list[0]?.r.id,
    pesos: store.get("rsPesos", {}), pref: store.get("rsPref", {}), cargo: "",
  });
  if (S.researchFocus) { st.focus = S.researchFocus; S.researchFocus = null; }
  const tip = $("#tip");
  const showTip = (e, html) => {
    tip.innerHTML = html; tip.classList.add("on");
    const r = tip.getBoundingClientRect(); let x = e.clientX + 12, y = e.clientY + 12;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 12;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  };
  const hideTip = () => tip.classList.remove("on");
  const nota = (r, k) => r.temas?.[k]?.nota ?? 0;
  const eixo = (r, k) => { const v = r.eixos?.[k]?.valor; return typeof v === "number" ? v : null; };
  const cargos = [...new Set(list.map(x => x.c.cargo))];
  const shown = list.filter(x => !st.cargo || x.c.cargo === st.cargo);

  // ------------------------------------------------ mapa de calor
  let rows = [...shown];
  if (st.sortTema) rows.sort((a, b) => nota(b.r, st.sortTema) - nota(a.r, st.sortTema) || a.c.urna.localeCompare(b.c.urna, "pt"));
  const cell = (r, t) => {
    const v = nota(r, t.k);
    const p = Math.round(v * 9);
    return `<td class="hm-c" data-id="${esc(r.id)}" data-t="${t.k}" style="--p:${p}%" ${v >= 6 ? 'data-dark="1"' : ""}><span>${v || "·"}</span></td>`;
  };
  const heat = `
    <div class="table-wrap hm-wrap"><table class="hm">
      <thead><tr><th class="hm-name" scope="col">Candidato</th>${TEMAS.map(t => `<th scope="col" class="hm-h ${st.sortTema === t.k ? "on" : ""}" data-sort="${t.k}" title="${esc(t.nome)}: ${esc(t.desc)}. Clique para ordenar."><span>${esc(t.nome)}</span></th>`).join("")}</tr></thead>
      <tbody>${rows.map(({ r, c }) => `<tr><th scope="row" class="hm-name"><button type="button" class="hm-who" data-focus="${esc(r.id)}">${avatar(c)}<span><b>${esc(c.urna)}</b><small>${esc(c.cargo.replace("Deputado ", "Dep. "))} · ${esc(c.partido)}${TEMAS.every(t => !nota(r, t.k)) ? " · sem dados públicos" : ""}</small></span></button></th>${TEMAS.map(t => cell(r, t)).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <div class="hm-legend"><span>0</span><i></i><span>10</span><span class="sub">Foco: quanto espaço o tema ocupa no discurso e nas propostas. Clique no nome de um tema para ordenar; passe o mouse numa célula para ver a evidência.</span></div>`;

  // ------------------------------------------------ dispersão de posicionamento
  const [ax, ay] = st.ax;
  const EX = Object.fromEntries(EIXOS.map(e => [e.k, e]));
  const pts = shown.map(x => ({ ...x, vx: eixo(x.r, ax), vy: eixo(x.r, ay) }));
  const plotted = pts.filter(p => p.vx != null && p.vy != null);
  const missing = pts.filter(p => p.vx == null || p.vy == null);
  const W = 520, H = 420, PAD = 46;
  const sx = v => PAD + (v + 5) / 10 * (W - 2 * PAD), sy = v => H - PAD - (v + 5) / 10 * (H - 2 * PAD);
  // espalha pontos coincidentes
  const seen = {};
  const scatter = `<svg viewBox="0 0 ${W} ${H}" class="sc" role="img" aria-label="Posicionamento">
      <rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${H - 2 * PAD}" class="sc-bg"/>
      ${[-5, -2.5, 0, 2.5, 5].map(v => `<line class="${v ? "sc-g" : "sc-0"}" x1="${sx(v)}" x2="${sx(v)}" y1="${PAD}" y2="${H - PAD}"/><line class="${v ? "sc-g" : "sc-0"}" y1="${sy(v)}" y2="${sy(v)}" x1="${PAD}" x2="${W - PAD}"/>`).join("")}
      <text class="sc-ax" x="${PAD}" y="${H - PAD + 18}">← ${esc(EX[ax].neg)}</text>
      <text class="sc-ax" x="${W - PAD}" y="${H - PAD + 18}" text-anchor="end">${esc(EX[ax].pos)} →</text>
      <text class="sc-ax" x="${PAD - 10}" y="${H - PAD}" transform="rotate(-90 ${PAD - 10} ${H - PAD})">← ${esc(EX[ay].neg)}</text>
      <text class="sc-ax" x="${PAD - 10}" y="${PAD}" transform="rotate(-90 ${PAD - 10} ${PAD})" text-anchor="end">${esc(EX[ay].pos)} →</text>
      ${plotted.map(p => {
        const key = p.vx + "," + p.vy; const n = seen[key] = (seen[key] || 0) + 1;
        const ang = (n - 1) * 2.1, rad = n > 1 ? 9 : 0;
        const x = sx(p.vx) + Math.cos(ang) * rad, y = sy(p.vy) + Math.sin(ang) * rad;
        return `<g class="sc-p" data-id="${esc(p.r.id)}" tabindex="0"><circle cx="${x}" cy="${y}" r="7"/><text x="${x + 10}" y="${y + 4}">${esc(p.c.urna)}</text></g>`;
      }).join("")}
    </svg>`;
  const axSel = (i) => `<select class="select" id="rs-ax${i}" aria-label="Eixo ${i ? "vertical" : "horizontal"}">${EIXOS.map(e => `<option value="${e.k}" ${st.ax[i] === e.k ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select>`;

  // ------------------------------------------------ calculadora de afinidade
  const pesoAtivo = TEMAS.some(t => (st.pesos[t.k] || 0) > 0) || EIXOS.some(e => st.pref[e.k] != null && st.pref[e.k] !== "");
  function score(r) {
    let wsum = 0, acc = 0;
    for (const t of TEMAS) { const w = st.pesos[t.k] || 0; if (w) { wsum += w; acc += w * nota(r, t.k) / 10; } }
    const foco = wsum ? acc / wsum : null;
    let n = 0, d = 0;
    for (const e of EIXOS) {
      const p = st.pref[e.k]; if (p == null || p === "") continue;
      const v = eixo(r, e.k); if (v == null) continue;
      n++; d += 1 - Math.abs(+p - v) / 10;
    }
    const pos = n ? d / n : null;
    const parts = [foco, pos].filter(v => v != null);
    return { total: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null, foco, pos, nEixos: n };
  }
  const ranked = shown.map(x => ({ ...x, s: score(x.r) })).sort((a, b) => (b.s.total ?? -1) - (a.s.total ?? -1));
  const calc = `
    <div class="aff">
      <div class="aff-in">
        <h4>1. Quanto cada tema importa para você?</h4>
        <div class="aff-grid">${TEMAS.map(t => `<label class="aff-row" title="${esc(t.desc)}"><span>${esc(t.nome)}</span>
          <span class="seg sm" role="group">${[0, 1, 2, 3].map(w => `<button type="button" data-w="${t.k}:${w}" aria-pressed="${(st.pesos[t.k] || 0) === w}">${["—", "1", "2", "3"][w]}</button>`).join("")}</span></label>`).join("")}</div>
        <h4>2. Onde você se posiciona? <small>(opcional)</small></h4>
        <div class="aff-grid">${EIXOS.map(e => `<div class="aff-row aff-ax"><span>${esc(e.nome)}</span>
          <select class="select sm" data-pref="${e.k}" aria-label="${esc(e.nome)}"><option value="">Indiferente</option>
          ${[-5, -3, -1, 0, 1, 3, 5].map(v => `<option value="${v}" ${String(st.pref[e.k]) === String(v) ? "selected" : ""}>${v < 0 ? `${esc(e.neg)} (${v})` : v > 0 ? `${esc(e.pos)} (+${v})` : "Centro (0)"}</option>`).join("")}</select></div>`).join("")}</div>
        <button type="button" class="btn sm ghost" id="aff-reset">Zerar respostas</button>
      </div>
      <div class="aff-out">
        <h4>Alinhamento com as suas respostas</h4>
        ${pesoAtivo ? `<div class="aff-bars">${ranked.map(({ r, c, s }) => `
          <button type="button" class="aff-bar" data-focus="${esc(r.id)}">
            <span class="lab">${esc(c.urna)} <small>${esc(c.partido)}</small></span>
            <span class="track"><span class="fill" style="width:${s.total == null ? 0 : Math.round(s.total * 100)}%"></span></span>
            <span class="val">${s.total == null ? "—" : Math.round(s.total * 100) + "%"}</span>
          </button>`).join("")}</div>
          <p class="hint">O percentual combina (a) quanto cada candidato fala dos temas que você marcou, ponderado pelos seus pesos, e (b) a distância entre a sua posição e a dele nos eixos que você escolheu. Eixos sem informação sobre o candidato são ignorados. É um resultado das suas respostas e das notas da pesquisa; não é uma recomendação.</p>`
          : `<div class="empty" style="padding:24px 8px"><h3>Responda ao lado</h3><p>Dê um peso aos temas que mais importam para você e, se quiser, marque sua posição nos eixos. O painel mostra o quanto cada candidato pesquisado se aproxima das suas respostas.</p></div>`}
      </div>
    </div>`;

  // ------------------------------------------------ ficha detalhada
  const fx = list.find(x => x.r.id === st.focus) || list[0];
  const src = (r, idx) => (idx || []).filter(i => r.fontes?.[i]).map(i => `<a class="src" href="${esc(r.fontes[i].url)}" target="_blank" rel="noopener" title="${esc(r.fontes[i].titulo || r.fontes[i].url)}">${i + 1}</a>`).join("");
  function radar(r) {
    const N = TEMAS.length, R = 112, cx = 170, cy = 150;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * R * v / 10, cy + Math.sin(a) * R * v / 10]; };
    const ring = v => TEMAS.map((_, i) => pt(i, v).join(",")).join(" ");
    return `<svg viewBox="0 0 340 300" class="radar" role="img" aria-label="Foco por tema">
      ${[2.5, 5, 7.5, 10].map(v => `<polygon class="rd-g" points="${ring(v)}"/>`).join("")}
      ${TEMAS.map((t, i) => { const [x, y] = pt(i, 10); const [lx, ly] = pt(i, 12.6); return `<line class="rd-g" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="rd-l" x="${lx}" y="${ly + 3}" text-anchor="${lx < cx - 8 ? "end" : lx > cx + 8 ? "start" : "middle"}">${esc(SHORT[t.k] || t.nome)}</text>`; }).join("")}
      <polygon class="rd-a" points="${TEMAS.map((t, i) => pt(i, nota(r, t.k)).join(",")).join(" ")}"/>
      ${TEMAS.map((t, i) => { const [x, y] = pt(i, nota(r, t.k)); return nota(r, t.k) ? `<circle class="rd-d" cx="${x}" cy="${y}" r="3"/>` : ""; }).join("")}
    </svg>`;
  }
  function detail({ r, c }) {
    const top = [...TEMAS].sort((a, b) => nota(r, b.k) - nota(r, a.k)).filter(t => nota(r, t.k) > 0);
    const byTema = Object.fromEntries(TEMAS.map(t => [t.k, t.nome]));
    return `
      <div class="rd-head">${avatar(c, "lg")}
        <div class="t"><span class="eyebrow">${esc(c.cargo)} · ${esc(c.partido)} · <span class="urna">${esc(c.num)}</span></span>
          <h3>${esc(c.urna)}</h3>
          <div class="row"><span class="badge conf-${esc(r.confianca)}" title="${esc(CONF[r.confianca] || "")}">Confiança ${esc(r.confianca || "—")}</span>
            <span class="badge">${(r.fontes || []).length} fontes</span><span class="badge">Pesquisado em ${esc((r.pesquisadoEm || "").split("-").reverse().join("/"))}</span></div></div>
        <button class="btn sm" type="button" data-open="${esc(c.id)}">Dados do TSE</button>
      </div>
      <p class="rd-sum">${esc(r.resumo || "")}</p>
      ${!top.length ? `<div class="notice"><span class="ico">i</span><div><b>Pouca informação pública.</b> A pesquisa não encontrou propostas ou declarações deste candidato em sites, imprensa ou entrevistas acessíveis. Por isso os temas ficam sem nota e os eixos em branco. Isso não diz nada sobre as posições dele; só que elas não estão publicadas em fontes encontradas. As redes sociais pessoais podem ter mais informação.</div></div>` : ""}
      ${r.perfil ? `<details class="rd-sec" open><summary>Trajetória</summary><p>${esc(r.perfil)}</p></details>` : ""}
      <div class="rd-cols">
        <div class="rd-col">
          <h4>Foco por tema</h4>${top.length ? radar(r) : ""}
          <div class="rd-top">${top.slice(0, 14).map(t => `<div class="rd-t" title="${esc(r.temas[t.k]?.evidencia || "")}"><span>${esc(t.nome)}</span><span class="bar"><i style="width:${nota(r, t.k) * 10}%"></i></span><b>${nota(r, t.k)}</b></div>`).join("") || `<p class="hint">Nenhum tema com evidência suficiente.</p>`}</div>
        </div>
        <div class="rd-col">
          <h4>Posicionamento</h4>
          <div class="pos">${EIXOS.map(e => { const v = eixo(r, e.k); const ev = r.eixos?.[e.k];
            return `<div class="pos-r"><div class="pos-l"><span>${esc(e.neg)}</span><b>${esc(e.nome)}</b><span>${esc(e.pos)}</span></div>
              <div class="pos-t">${v == null ? `<span class="pos-na">Sem informação suficiente</span>` : `<i class="pos-m" style="left:${(v + 5) * 10}%"></i>`}</div>
              ${ev?.evidencia && !(v == null && /^sem /i.test(ev.evidencia)) ? `<p class="pos-e">${v == null ? "" : `<b>${v > 0 ? "+" : ""}${v}</b> · `}${esc(ev.evidencia)} ${src(r, ev.fontes)}</p>` : ""}</div>`; }).join("")}</div>
        </div>
      </div>
      ${(r.propostas || []).length ? `<div class="rd-sec"><h4>Propostas</h4><ul class="rd-list">${r.propostas.map(p => `<li><span class="chip-t">${esc(byTema[p.tema] || p.tema || "Geral")}</span> ${esc(p.texto)} ${src(r, p.fontes)}</li>`).join("")}</ul></div>` : ""}
      ${(r.historico || []).length ? `<div class="rd-sec"><h4>Histórico e atuação</h4><ul class="rd-list">${r.historico.map(h => `<li>${esc(h.texto)} ${src(r, h.fontes)}</li>`).join("")}</ul></div>` : ""}
      ${(r.pontosAtencao || []).length ? `<div class="rd-sec"><h4>Pontos de atenção</h4><p class="hint">Fatos públicos verificáveis encontrados na pesquisa, com fonte. Leia a fonte antes de tirar conclusões.</p><ul class="rd-list">${r.pontosAtencao.map(h => `<li>${esc(h.texto)} ${src(r, h.fontes)}</li>`).join("")}</ul></div>` : ""}
      <details class="rd-sec"><summary>Evidência de cada tema</summary><ul class="rd-list">${TEMAS.map(t => `<li><b>${esc(t.nome)} (${nota(r, t.k)})</b>: ${esc(r.temas?.[t.k]?.evidencia || "—")} ${src(r, r.temas?.[t.k]?.fontes)}</li>`).join("")}</ul></details>
      <details class="rd-sec"><summary>Fontes (${(r.fontes || []).length})</summary><ol class="rd-src">${(r.fontes || []).map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo || f.url)}</a> <span>${esc(f.veiculo || "")}${f.data ? " · " + esc(f.data.split("-").reverse().join("/")) : ""}</span></li>`).join("")}</ol></details>`;
  }

  root.innerHTML = `
    <div class="section-h"><h2>Propostas e posicionamento</h2><span class="sub">${list.length} candidatos pesquisados em fontes públicas. Toda nota tem evidência e fonte.</span></div>
    <details class="notice rs-method"><summary><b>Como ler esta análise</b></summary><p>${esc(RUB.metodologia || "")}</p></details>
    ${cargos.length > 1 ? `<div class="cargo-strip" role="group" aria-label="Recorte por cargo"><button class="chip" type="button" data-rc="" aria-pressed="${!st.cargo}">Todos</button>${cargos.map(k => `<button class="chip" type="button" data-rc="${esc(k)}" aria-pressed="${st.cargo === k}">${esc(k)}</button>`).join("")}</div>` : ""}
    <div class="card panel"><h3>Foco temático</h3><p class="hint">Notas de 0 a 10 por tema.</p>${heat}</div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card panel"><h3>Mapa de posicionamento</h3><p class="hint">Escolha dois eixos. Cada ponto é um candidato; só aparecem os que têm informação nos dois eixos.</p>
        <div class="toolbar">${axSel(0)}<span>×</span>${axSel(1)}</div>
        <div class="sc-wrap">${scatter}</div>
        ${missing.length ? `<p class="hint">Sem informação suficiente nesses eixos: ${missing.map(p => esc(p.c.urna)).join(", ")}.</p>` : ""}
      </div>
      <div class="card panel"><h3>Calculadora de afinidade</h3><p class="hint">Você define o que importa; o painel só faz a conta.</p>${calc}</div>
    </div>
    <div class="card panel rd" id="rs-detail" style="margin-top:16px">
      <div class="rd-pick" role="tablist" aria-label="Candidato">${list.map(({ r, c }) => `<button type="button" class="chip" data-focus="${esc(r.id)}" aria-pressed="${r.id === fx?.r.id}">${esc(c.urna)}</button>`).join("")}</div>
      ${fx ? detail(fx) : ""}
    </div>`;

  // eventos
  $$("[data-rc]", root).forEach(b => b.addEventListener("click", () => { st.cargo = b.dataset.rc; window.renderResearchView(root, ctx); }));
  $$("[data-sort]", root).forEach(h => h.addEventListener("click", () => { st.sortTema = st.sortTema === h.dataset.sort ? null : h.dataset.sort; window.renderResearchView(root, ctx); }));
  $$(".hm-c", root).forEach(td => {
    td.addEventListener("mousemove", e => {
      const r = RESEARCH.candidatos[td.dataset.id], t = TEMAS.find(x => x.k === td.dataset.t), c = BY_ID.get(td.dataset.id);
      showTip(e, `<b>${esc(c.urna)} · ${esc(t.nome)}: ${nota(r, t.k)}</b><br>${esc(r.temas?.[t.k]?.evidencia || "Sem menção encontrada")}`);
    });
    td.addEventListener("mouseleave", hideTip);
    td.addEventListener("click", () => { hideTip(); st.focus = td.dataset.id; window.renderResearchView(root, ctx); $("#rs-detail").scrollIntoView({ behavior: "smooth", block: "start" }); });
  });
  $$("[data-focus]", root).forEach(b => b.addEventListener("click", () => {
    const fromList = !b.closest(".rd-pick");
    st.focus = b.dataset.focus; window.renderResearchView(root, ctx);
    if (fromList) $("#rs-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  $$(".sc-p", root).forEach(g => {
    const r = RESEARCH.candidatos[g.dataset.id];
    g.addEventListener("mousemove", e => showTip(e, `<b>${esc(BY_ID.get(g.dataset.id).urna)}</b><br>${esc(EX[ax].nome)}: ${eixo(r, ax)} · ${esc(EX[ay].nome)}: ${eixo(r, ay)}`));
    g.addEventListener("mouseleave", hideTip);
    g.addEventListener("click", () => { hideTip(); st.focus = g.dataset.id; window.renderResearchView(root, ctx); $("#rs-detail").scrollIntoView({ behavior: "smooth", block: "start" }); });
  });
  [0, 1].forEach(i => $("#rs-ax" + i, root)?.addEventListener("change", e => { st.ax[i] = e.target.value; store.set("rsAx", st.ax); window.renderResearchView(root, ctx); }));
  $$("[data-w]", root).forEach(b => b.addEventListener("click", () => { const [k, w] = b.dataset.w.split(":"); st.pesos[k] = +w; store.set("rsPesos", st.pesos); window.renderResearchView(root, ctx); }));
  $$("[data-pref]", root).forEach(s => s.addEventListener("change", () => { st.pref[s.dataset.pref] = s.value === "" ? null : +s.value; store.set("rsPref", st.pref); window.renderResearchView(root, ctx); }));
  $("#aff-reset", root)?.addEventListener("click", () => { st.pesos = {}; st.pref = {}; store.set("rsPesos", {}); store.set("rsPref", {}); window.renderResearchView(root, ctx); });
  $$("[data-open]", root).forEach(b => b.addEventListener("click", () => openCandidate(b.dataset.open)));
};
})();
