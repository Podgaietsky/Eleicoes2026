/* Candidatos SC 2026 — app (JS puro, sem dependências) */
(() => {
"use strict";

const DATA = window.DATA || { meta: {}, candidatos: [] };
const META = DATA.meta;
const ALL = DATA.candidatos;
const RESEARCH = window.RESEARCH || null;
const BY_ID = new Map(ALL.map(c => [c.id, c]));
if (window.FOTOS) for (const c of ALL) if (window.FOTOS[c.id]) c.foto = window.FOTOS[c.id];

// ------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem("sc26:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sc26:" + k, JSON.stringify(v)); } catch { /* sem storage */ } },
};
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function money(v) {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return "R$ " + nf1.format(v / 1e9) + " bi";
  if (a >= 1e6) return "R$ " + nf1.format(v / 1e6) + " mi";
  if (a >= 1e3) return "R$ " + nf0.format(v / 1e3) + " mil";
  return brl.format(v);
}
const pct = (a, b) => b ? nf0.format(100 * a / b) + "%" : "—";
function median(arr) {
  const a = arr.filter(v => v != null && !Number.isNaN(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const initials = n => String(n || "?").split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const avatar = (c, cls = "") => `<span class="av ${cls}" aria-hidden="true">${c.foto ? `<img src="${c.foto}" alt="" loading="lazy">` : esc(initials(c.urna))}</span>`;
const stKey = s => (s || "").split(/[\s/]/)[0];
const statusBadge = c => `<span class="badge st-${esc(stKey(c.situacao))}" title="${esc(c.situacaoDet || c.situacao)}"><span class="dot"></span>${esc(c.situacao || "—")}</span>`;
const plural = (n, s, p) => `${nf0.format(n)} ${n === 1 ? s : p}`;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200);
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
  catch { return false; }
}

// tooltip
const tip = $("#tip");
function showTip(e, html) {
  tip.innerHTML = html; tip.classList.add("on");
  const pad = 12, r = tip.getBoundingClientRect();
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => tip.classList.remove("on");

// ------------------------------------------------------------ dimensões
const CARGOS = [...new Map(ALL.map(c => [c.cargo, c.cargoOrd])).entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
const INSTR = [...new Map(ALL.map(c => [c.instrucao, c.instrucaoOrd])).entries()].filter(e => e[0]).sort((a, b) => a[1] - b[1]).map(e => e[0]);
const HAS_FED = ALL.some(c => c.federacao);
const HAS_2022 = ALL.some(c => c.h2022);

const FACETS = [
  { k: "cargo", label: "Cargo", get: c => c.cargo, ui: "chips", order: CARGOS },
  { k: "partido", label: "Partido", get: c => c.partido, ui: "list", search: true },
  ...(HAS_FED ? [{ k: "federacao", label: "Federação", get: c => c.federacao || "Sem federação", ui: "list" }] : []),
  { k: "ocupacao", label: "Ocupação declarada", get: c => c.ocupacao, ui: "list", search: true },
  { k: "instrucao", label: "Formação", get: c => c.instrucao, ui: "list", order: INSTR },
  { k: "genero", label: "Gênero", get: c => c.genero, ui: "chips" },
  { k: "raca", label: "Cor/raça (autodeclarada)", get: c => c.raca, ui: "chips" },
  { k: "situacao", label: "Situação da candidatura", get: c => c.situacao, ui: "chips" },
];
const FK = Object.fromEntries(FACETS.map(f => [f.k, f]));

const PAT_EDGES = [0, 1, 1e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7, 5e7, Infinity];
const PAT_LABELS = ["R$ 0", "R$ 1", "10 mil", "50 mil", "100 mil", "250 mil", "500 mil", "1 mi", "2,5 mi", "5 mi", "10 mi", "50 mi", "máx."];
const PAT_SHORT = ["0", "1", "10mil", "50mil", "100mil", "250mil", "500mil", "1mi", "2,5mi", "5mi", "10mi", "50mi+"];
const patBucket = v => { for (let i = PAT_EDGES.length - 2; i >= 0; i--) if (v >= PAT_EDGES[i]) return i; return 0; };
const AGES = ALL.map(c => c.idade).filter(v => v != null);
const AGE_MIN = AGES.length ? Math.min(...AGES) : 18;
const AGE_MAX = AGES.length ? Math.max(...AGES) : 90;

// ------------------------------------------------------------ estado
const emptyFilters = () => ({
  ...Object.fromEntries(FACETS.map(f => [f.k, []])),
  idade: [AGE_MIN, AGE_MAX], pat: [0, PAT_EDGES.length - 1],
  reeleicao: false, h2022: false, semBens: false,
});
const S = {
  view: "panorama",
  q: "",
  sort: store.get("sort", "cargoOrd:asc"),
  mode: store.get("mode", innerWidth < 700 ? "cards" : "table"),
  limit: 60,
  f: Object.assign(emptyFilters(), store.get("filters", {})),
  open: { cargo: true, partido: true, instrucao: true, idade: true, pat: true },
  panoCargo: null,
  partyCargo: null,
  partySort: ["n", "desc"],
};
// sanity: remove valores salvos que não existem mais
for (const f of FACETS) S.f[f.k] = (S.f[f.k] || []).filter(v => ALL.some(c => f.get(c) === v));
let starred = new Set(store.get("starred", []).filter(id => BY_ID.has(id)));
let compare = store.get("compare", []).filter(id => BY_ID.has(id)).slice(0, 4);
const saveFilters = () => store.set("filters", S.f);

// ------------------------------------------------------------ filtro
let qNorm = "";
function matches(c, except) {
  const f = S.f;
  for (const fc of FACETS) {
    if (fc.k === except) continue;
    const sel = f[fc.k];
    if (sel.length && !sel.includes(fc.get(c))) return false;
  }
  if (except !== "idade" && (f.idade[0] > AGE_MIN || f.idade[1] < AGE_MAX)) {
    if (c.idade == null || c.idade < f.idade[0] || c.idade > f.idade[1]) return false;
  }
  if (except !== "pat" && (f.pat[0] > 0 || f.pat[1] < PAT_EDGES.length - 1)) {
    const p = c.patrimonio || 0;
    if (p < PAT_EDGES[f.pat[0]] || p >= PAT_EDGES[f.pat[1]]) return false;
  }
  if (f.reeleicao && !c.reeleicao) return false;
  if (f.h2022 && !c.h2022) return false;
  if (f.semBens && c.bens && c.bens.length) return false;
  if (qNorm && except !== "q") {
    if (!c._s) c._s = norm([c.urna, c.nome, c.num, c.partido, c.ocupacao, c.cargo, c.federacao].join(" "));
    for (const t of qNorm.split(/\s+/)) if (t && !c._s.includes(t)) return false;
  }
  return true;
}
function activeCount() {
  const f = S.f;
  let n = FACETS.reduce((a, fc) => a + (f[fc.k].length ? 1 : 0), 0);
  if (f.idade[0] > AGE_MIN || f.idade[1] < AGE_MAX) n++;
  if (f.pat[0] > 0 || f.pat[1] < PAT_EDGES.length - 1) n++;
  if (f.reeleicao) n++; if (f.h2022) n++; if (f.semBens) n++;
  return n;
}
function sorted(list) {
  const [k, dir] = S.sort.split(":");
  const m = dir === "desc" ? -1 : 1;
  const val = c => k === "num" ? Number(c.num) || 0 : c[k];
  return [...list].sort((a, b) => {
    let va = val(a), vb = val(b);
    if (va == null && vb == null) return a.urna.localeCompare(b.urna, "pt");
    if (va == null) return 1; if (vb == null) return -1;
    const r = typeof va === "string" ? va.localeCompare(vb, "pt") : va - vb;
    return r * m || (a.cargoOrd - b.cargoOrd) || a.urna.localeCompare(b.urna, "pt");
  });
}

// ------------------------------------------------------------ navegação
const VIEWS = ["panorama", "explorar", "partidos", "comparar", "lista", "propostas", "sobre"];
if (RESEARCH) $("#tab-propostas").hidden = false;
function go(view, push = true) {
  if (!VIEWS.includes(view) || (view === "propostas" && !RESEARCH)) view = "panorama";
  S.view = view;
  for (const v of VIEWS) $("#view-" + v).hidden = v !== view;
  for (const t of $$(".tab")) t.setAttribute("aria-selected", t.dataset.view === view ? "true" : "false");
  if (push && location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  render();
  window.scrollTo({ top: 0 });
}
$$(".tab").forEach(t => t.addEventListener("click", () => go(t.dataset.view)));
addEventListener("hashchange", () => go(location.hash.slice(1), false));

function render() {
  updatePills();
  ({ panorama: renderPanorama, explorar: renderExplore, partidos: renderParties, comparar: renderCompare,
     lista: renderList, propostas: renderResearch, sobre: renderAbout })[S.view]?.();
}
function updatePills() {
  $("#pill-lista").textContent = starred.size || "";
  $("#pill-comparar").textContent = compare.length || "";
  const n = activeCount();
  $("#pill-explorar").textContent = n ? n + " filtro" + (n > 1 ? "s" : "") : "";
}

// atalho: aplicar filtro e ir para Explorar
function drill(patch) {
  S.f = Object.assign(emptyFilters(), patch);
  S.q = ""; $("#q").value = "";
  qNorm = "";
  S.limit = 60;
  saveFilters();
  go("explorar");
}

// ------------------------------------------------------------ gráficos
function hbars(rows, { max, onClick, fmt = nf0.format, active = [] } = {}) {
  const m = max ?? Math.max(1, ...rows.map(r => r.v));
  return `<div class="hbars">${rows.map((r, i) => `
    <button type="button" class="hbar ${active.includes(r.key) ? "on" : ""}" data-i="${i}" title="${esc(r.label)}: ${esc(fmt(r.v))}${r.sub ? " · " + esc(r.sub) : ""}">
      <span class="lab">${esc(r.label)}</span>
      <span class="track"><span class="fill" style="width:${(100 * r.v / m).toFixed(2)}%"></span></span>
      <span class="val">${esc(fmt(r.v))}</span>
    </button>`).join("")}</div>`;
}
function bindHbars(root, rows, onClick) {
  $$(".hbar", root).forEach(b => b.addEventListener("click", () => onClick(rows[+b.dataset.i])));
}
function countBy(list, get) {
  const m = new Map();
  for (const c of list) { const k = get(c); if (k == null || k === "") continue; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

/* histograma vertical em SVG; bins = [{label, v, tip}] */
function histogram(bins, { h = 170, xEvery = 1 } = {}) {
  const W = 560, H = h, L = 34, R = 8, T = 10, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(1, ...bins.map(b => b.v));
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const y = v => T + ih - (v / top) * ih;
  const bw = iw / bins.length;
  const gap = Math.min(2, bw * .15);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for (let v = 0; v <= top; v += step) {
    s += `<line class="${v ? "grid" : "base"}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    s += `<text class="ax" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${nf0.format(v)}</text>`;
  }
  bins.forEach((b, i) => {
    const x = L + i * bw + gap / 2, w = Math.max(1, bw - gap), yy = y(b.v), hh = T + ih - yy;
    if (b.v > 0) {
      const r = Math.min(4, w / 2, hh);
      s += `<path class="b" data-i="${i}" d="M${x},${T + ih} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${T + ih} Z"/>`;
    }
    s += `<rect class="hit" data-i="${i}" x="${L + i * bw}" y="${T}" width="${bw}" height="${ih + B}"/>`;
    if (i % xEvery === 0) s += `<text class="ax" x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  return s + "</svg>";
}
function niceStep(raw) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function bindHist(root, bins, onClick) {
  const svg = $("svg", root);
  if (!svg) return;
  const hl = i => $$(".b", svg).forEach(p => p.classList.toggle("hl", p.dataset.i === String(i)));
  $$(".hit", svg).forEach(r => {
    const b = bins[+r.dataset.i];
    r.addEventListener("mousemove", e => { hl(r.dataset.i); showTip(e, b.tip); });
    r.addEventListener("mouseleave", () => { hl(-1); hideTip(); });
    if (onClick) r.addEventListener("click", () => { hideTip(); onClick(b, +r.dataset.i); });
  });
}

// ------------------------------------------------------------ PANORAMA
function renderPanorama() {
  const root = $("#view-panorama");
  const list = S.panoCargo ? ALL.filter(c => c.cargo === S.panoCargo) : ALL;
  const base = S.panoCargo ? { cargo: [S.panoCargo] } : {};
  const n = list.length;
  const mulheres = list.filter(c => /fem/i.test(c.genero || "")).length;
  const idadeMed = median(list.map(c => c.idade));
  const patMed = median(list.map(c => c.patrimonio || 0));
  const patTot = list.reduce((a, c) => a + (c.patrimonio || 0), 0);
  const indef = list.filter(c => c.situacao && c.situacao !== "Deferida").length;
  const reel = list.filter(c => c.reeleicao).length;
  const sup = list.filter(c => c.instrucao === "Superior completo").length;
  const top10 = [...list].sort((a, b) => (b.patrimonio || 0) - (a.patrimonio || 0)).slice(0, 10);
  const top10sum = top10.reduce((a, c) => a + (c.patrimonio || 0), 0);
  const cargoCounts = countBy(ALL, c => c.cargo);

  const parties = [...countBy(list, c => c.partido)].sort((a, b) => b[1] - a[1]);
  const occ = [...countBy(list, c => c.ocupacao)].sort((a, b) => b[1] - a[1]);
  const instr = INSTR.map(k => ({ key: k, label: k, v: list.filter(c => c.instrucao === k).length }));
  const gen = [...countBy(list, c => c.genero)].sort((a, b) => b[1] - a[1]);
  const raca = [...countBy(list, c => c.raca)].sort((a, b) => b[1] - a[1]);

  // faixas etárias de 5 anos
  const a0 = Math.floor(AGE_MIN / 5) * 5, a1 = Math.ceil((AGE_MAX + 1) / 5) * 5;
  const ageBins = [];
  for (let a = a0; a < a1; a += 5) {
    const v = list.filter(c => c.idade >= a && c.idade < a + 5).length;
    ageBins.push({ label: String(a), v, lo: a, hi: a + 4, tip: `<b>${a}–${a + 4} anos</b><br>${plural(v, "candidato", "candidatos")}` });
  }
  const patBins = PAT_EDGES.slice(0, -1).map((e, i) => {
    const v = list.filter(c => patBucket(c.patrimonio || 0) === i).length;
    const lab = i === 0 ? "sem bens" : i === PAT_EDGES.length - 2 ? `${PAT_LABELS[i]}+` : `${PAT_LABELS[i]}–${PAT_LABELS[i + 1]}`;
    return { label: PAT_SHORT[i], v, i, tip: `<b>${esc(lab)}</b><br>${plural(v, "candidato", "candidatos")}` };
  });

  const pTop = parties.slice(0, S.allParties ? 999 : 12).map(([k, v]) => ({ key: k, label: k, v, sub: pct(v, n) }));
  const oTop = occ.slice(0, S.allOcc ? 60 : 12).map(([k, v]) => ({ key: k, label: k, v }));

  root.innerHTML = `
    ${META.amostra ? "" : ""}
    <div class="cargo-strip" role="group" aria-label="Recorte por cargo">
      <button class="chip" type="button" data-cargo="" aria-pressed="${!S.panoCargo}">Todos os cargos <span class="c">${nf0.format(ALL.length)}</span></button>
      ${CARGOS.map(c => `<button class="chip" type="button" data-cargo="${esc(c)}" aria-pressed="${S.panoCargo === c}">${esc(c)} <span class="c">${nf0.format(cargoCounts.get(c) || 0)}</span></button>`).join("")}
    </div>
    ${indef ? `<div class="notice"><span class="ico">!</span><div><b>${plural(indef, "candidatura não está deferida", "candidaturas não estão deferidas")}</b> neste recorte (indeferidas, em recurso, aguardando julgamento ou canceladas). Elas aparecem com a situação marcada na lista; confira antes de decidir. <button class="btn sm ghost" type="button" id="see-indef">Ver quais</button></div></div>` : ""}
    <div class="kpis">
      <div class="card kpi"><span class="l">Candidatos</span><span class="v">${nf0.format(n)}</span><span class="s">${plural(parties.length, "partido", "partidos")}</span></div>
      <div class="card kpi"><span class="l">Mulheres</span><span class="v">${pct(mulheres, n)}</span><span class="s">${plural(mulheres, "candidata", "candidatas")}</span></div>
      <div class="card kpi"><span class="l">Idade mediana</span><span class="v">${idadeMed == null ? "—" : nf0.format(idadeMed) + " anos"}</span><span class="s">de ${AGE_MIN} a ${AGE_MAX} anos no total</span></div>
      <div class="card kpi"><span class="l">Superior completo</span><span class="v">${pct(sup, n)}</span><span class="s">${plural(sup, "candidato", "candidatos")}</span></div>
      <div class="card kpi"><span class="l">Patrimônio mediano</span><span class="v">${money(patMed)}</span><span class="s">metade declarou menos que isso</span></div>
      <div class="card kpi"><span class="l">Patrimônio somado</span><span class="v">${money(patTot)}</span><span class="s">os 10 maiores somam ${pct(top10sum, patTot)}</span></div>
      <div class="card kpi"><span class="l">Tentam reeleição</span><span class="v">${nf0.format(reel)}</span><span class="s">${pct(reel, n)} do recorte</span></div>
    </div>

    <div class="pano-rows">
    <div class="grid-3">
      <div class="card panel" id="p-part">
        <h3>Candidatos por partido</h3><p class="hint">Clique numa barra para ver os candidatos do partido.</p>
        ${hbars(pTop)}
        ${parties.length > 12 ? `<button class="btn sm ghost more-link" type="button" id="more-parties">${S.allParties ? "Mostrar menos" : `Ver todos os ${parties.length}`}</button>` : ""}
      </div>
      <div class="card panel" id="p-occ">
        <h3>Ocupações mais comuns</h3><p class="hint">Ocupação declarada no registro da candidatura.</p>
        ${hbars(oTop)}
        ${occ.length > 12 ? `<button class="btn sm ghost more-link" type="button" id="more-occ">${S.allOcc ? "Mostrar menos" : "Ver mais ocupações"}</button>` : ""}
      </div>
      <div class="card panel" id="p-rich">
        <h3>Maiores patrimônios declarados</h3><p class="hint">Clique para abrir a ficha com a lista de bens.</p>
        <div class="toplist">${top10.map((c, i) => `
          <div class="row" data-id="${esc(c.id)}" role="button" tabindex="0">
            <span class="rk">${i + 1}</span>${avatar(c)}
            <span class="nm"><b>${esc(c.urna)}</b><span>${esc(c.cargo)} · ${esc(c.partido)}</span></span>
            <span class="v">${money(c.patrimonio)}</span>
          </div>`).join("")}</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card panel" id="p-age">
        <h3>Faixa etária</h3><p class="hint">Idade na data da eleição (04/10/2026), em faixas de 5 anos.</p>
        <div class="hist">${histogram(ageBins, { h: 200, xEvery: ageBins.length > 14 ? 2 : 1 })}</div>
      </div>
      <div class="card panel" id="p-pat">
        <h3>Patrimônio declarado</h3><p class="hint">Quantos candidatos em cada faixa (escala multiplicativa). Valores declarados pelo próprio candidato ao TSE.</p>
        <div class="hist">${histogram(patBins, { h: 200, xEvery: 1 })}</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card panel" id="p-instr">
        <h3>Formação</h3><p class="hint">Grau de instrução declarado.</p>
        ${hbars(instr.map(r => ({ ...r, sub: pct(r.v, n) })))}
      </div>
      <div class="card panel" id="p-gen">
        <h3>Gênero</h3><p class="hint">Conforme registro no TSE.</p>
        ${hbars(gen.map(([k, v]) => ({ key: k, label: k, v, sub: pct(v, n) })), { fmt: v => `${nf0.format(v)} · ${pct(v, n)}` })}
        <h3 style="margin-top:18px">Cor/raça</h3><p class="hint">Autodeclarada.</p>
        <div id="p-raca">${hbars(raca.map(([k, v]) => ({ key: k, label: k, v })), { fmt: v => `${nf0.format(v)} · ${pct(v, n)}` })}</div>
      </div>
    </div>
    </div>`;

  $$(".cargo-strip .chip", root).forEach(b => b.addEventListener("click", () => { S.panoCargo = b.dataset.cargo || null; renderPanorama(); }));
  $("#see-indef", root)?.addEventListener("click", () => drill({ ...base, situacao: [...new Set(list.map(c => c.situacao))].filter(s => s !== "Deferida") }));
  bindHbars($("#p-part", root), pTop, r => drill({ ...base, partido: [r.key] }));
  bindHbars($("#p-instr", root), instr, r => drill({ ...base, instrucao: [r.key] }));
  bindHbars($("#p-occ", root), oTop, r => drill({ ...base, ocupacao: [r.key] }));
  bindHbars($("#p-gen", root).querySelector(".hbars"), gen.map(([k]) => ({ key: k })), r => drill({ ...base, genero: [r.key] }));
  bindHbars($("#p-raca", root), raca.map(([k]) => ({ key: k })), r => drill({ ...base, raca: [r.key] }));
  bindHist($("#p-age", root), ageBins, b => drill({ ...base, idade: [Math.max(AGE_MIN, b.lo), Math.min(AGE_MAX, b.hi)] }));
  bindHist($("#p-pat", root), patBins, b => drill({ ...base, pat: [b.i, b.i + 1] }));
  $("#more-parties", root)?.addEventListener("click", () => { S.allParties = !S.allParties; renderPanorama(); });
  $("#more-occ", root)?.addEventListener("click", () => { S.allOcc = !S.allOcc; renderPanorama(); });
  bindRows(root);
}
function bindRows(root) {
  $$("[data-id].row, .toplist .row", root).forEach(r => {
    r.addEventListener("click", () => openCandidate(r.dataset.id));
    r.addEventListener("keydown", e => { if (e.key === "Enter") openCandidate(r.dataset.id); });
  });
}

// ------------------------------------------------------------ EXPLORAR
function renderFilters() {
  const body = $("#filters-body");
  const f = S.f;
  let html = "";
  for (const fc of FACETS) {
    const counts = countBy(ALL.filter(c => matches(c, fc.k)), fc.get);
    const allVals = [...new Set(ALL.map(fc.get).filter(v => v != null && v !== ""))];
    let vals = fc.order ? fc.order.filter(v => allVals.includes(v)) : allVals.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || String(a).localeCompare(b, "pt"));
    const sel = f[fc.k];
    const open = S.open[fc.k] || sel.length;
    html += `<details class="fgroup" data-k="${fc.k}" ${open ? "open" : ""}><summary>${esc(fc.label)}${sel.length ? `<span class="n">${sel.length}</span>` : ""}</summary><div class="fbody">`;
    if (fc.ui === "chips") {
      html += `<div class="chips">${vals.map(v => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${sel.includes(v)}">${esc(v)} <span class="c">${nf0.format(counts.get(v) || 0)}</span></button>`).join("")}</div>`;
    } else {
      if (fc.search) html += `<input class="fsearch" type="search" placeholder="Filtrar ${esc(fc.label.toLowerCase())}…" data-fs="${fc.k}" id="fs-${fc.k}" aria-label="Filtrar opções de ${esc(fc.label)}">`;
      html += `<div class="opts">${vals.map(v => {
        const c = counts.get(v) || 0;
        return `<label class="opt ${c ? "" : "zero"}" data-t="${esc(norm(v))}"><input type="checkbox" data-v="${esc(v)}" ${sel.includes(v) ? "checked" : ""}><span class="t" title="${esc(v)}">${esc(v)}</span><span class="c">${nf0.format(c)}</span></label>`;
      }).join("")}</div>`;
    }
    html += `</div></details>`;
  }
  // idade
  const ageList = ALL.filter(c => matches(c, "idade"));
  const ageOn = f.idade[0] > AGE_MIN || f.idade[1] < AGE_MAX;
  const aBins = []; for (let a = AGE_MIN; a <= AGE_MAX; a += 2) aBins.push([a, ageList.filter(c => c.idade >= a && c.idade < a + 2).length]);
  const aMax = Math.max(1, ...aBins.map(b => b[1]));
  html += `<details class="fgroup" data-k="idade" ${S.open.idade || ageOn ? "open" : ""}><summary>Idade${ageOn ? `<span class="n">1</span>` : ""}</summary><div class="fbody range">
    <div class="mini-hist" aria-hidden="true">${aBins.map(([a, v]) => `<i class="${a + 1 >= f.idade[0] && a <= f.idade[1] ? "in" : ""}" style="height:${(100 * v / aMax).toFixed(1)}%"></i>`).join("")}</div>
    <div class="dual"><div class="rail"></div><div class="sel" style="left:${(100 * (f.idade[0] - AGE_MIN) / (AGE_MAX - AGE_MIN || 1)).toFixed(2)}%;right:${(100 * (AGE_MAX - f.idade[1]) / (AGE_MAX - AGE_MIN || 1)).toFixed(2)}%"></div>
      <input type="range" id="age-lo" min="${AGE_MIN}" max="${AGE_MAX}" value="${f.idade[0]}" aria-label="Idade mínima">
      <input type="range" id="age-hi" min="${AGE_MIN}" max="${AGE_MAX}" value="${f.idade[1]}" aria-label="Idade máxima"></div>
    <div class="range-vals"><span>${f.idade[0]} anos</span><span>${f.idade[1]} anos</span></div></div></details>`;
  // patrimônio
  const patList = ALL.filter(c => matches(c, "pat"));
  const last = PAT_EDGES.length - 1;
  const pOn = f.pat[0] > 0 || f.pat[1] < last;
  const pBins = PAT_EDGES.slice(0, -1).map((_, i) => patList.filter(c => patBucket(c.patrimonio || 0) === i).length);
  const pMax = Math.max(1, ...pBins);
  html += `<details class="fgroup" data-k="pat" ${S.open.pat || pOn ? "open" : ""}><summary>Patrimônio declarado${pOn ? `<span class="n">1</span>` : ""}</summary><div class="fbody range">
    <div class="mini-hist" aria-hidden="true">${pBins.map((v, i) => `<i class="${i >= f.pat[0] && i < f.pat[1] ? "in" : ""}" style="height:${(100 * v / pMax).toFixed(1)}%"></i>`).join("")}</div>
    <div class="dual"><div class="rail"></div><div class="sel" style="left:${(100 * f.pat[0] / last).toFixed(2)}%;right:${(100 * (last - f.pat[1]) / last).toFixed(2)}%"></div>
      <input type="range" id="pat-lo" min="0" max="${last}" value="${f.pat[0]}" aria-label="Patrimônio mínimo">
      <input type="range" id="pat-hi" min="0" max="${last}" value="${f.pat[1]}" aria-label="Patrimônio máximo"></div>
    <div class="range-vals"><span>${PAT_LABELS[f.pat[0]]}</span><span>${f.pat[1] === last ? "sem limite" : "até " + PAT_LABELS[f.pat[1]]}</span></div></div></details>`;
  // toggles
  html += `<details class="fgroup" data-k="outros" open><summary>Outros</summary><div class="fbody">
    <label class="toggle"><span>Tenta a reeleição</span><input type="checkbox" id="t-reel" ${f.reeleicao ? "checked" : ""}></label>
    ${HAS_2022 ? `<label class="toggle"><span>Também concorreu em 2022</span><input type="checkbox" id="t-h22" ${f.h2022 ? "checked" : ""}></label>` : ""}
    <label class="toggle"><span>Não declarou bens</span><input type="checkbox" id="t-sb" ${f.semBens ? "checked" : ""}></label>
  </div></details>`;
  const keepScroll = $("#filters").scrollTop;
  const fsVals = Object.fromEntries($$("[data-fs]", body).map(i => [i.dataset.fs, i.value]));
  const focused = document.activeElement?.id;
  body.innerHTML = html;
  $("#filters").scrollTop = keepScroll;
  for (const [k, v] of Object.entries(fsVals)) { const i = $(`[data-fs="${k}"]`, body); if (i) { i.value = v; filterOpts(i); } }
  if (focused && $("#" + focused)) { const el = $("#" + focused); el.focus(); if (el.setSelectionRange && el.type === "search") el.setSelectionRange(el.value.length, el.value.length); }

  // eventos
  $$(".fgroup", body).forEach(d => d.addEventListener("toggle", () => { S.open[d.dataset.k] = d.open; }));
  $$(".fgroup .chip", body).forEach(b => b.addEventListener("click", () => toggleVal(b.closest(".fgroup").dataset.k, b.dataset.v)));
  $$(".opt input", body).forEach(i => i.addEventListener("change", () => toggleVal(i.closest(".fgroup").dataset.k, i.dataset.v)));
  $$("[data-fs]", body).forEach(i => i.addEventListener("input", () => filterOpts(i)));
  const rng = (lo, hi, key, isAge) => {
    const a = $(lo, body), b = $(hi, body);
    const upd = (final) => {
      let x = +a.value, y = +b.value;
      if (x > y) [x, y] = (document.activeElement === a) ? [y, y] : [x, x];
      if (!isAge && x === y) { if (document.activeElement === a) x = Math.max(0, y - 1); else y = Math.min(last, x + 1); }
      S.f[key] = [x, y];
      if (final) { saveFilters(); S.limit = 60; renderExplore(); }
      else {
        const box = a.closest(".fbody");
        const span = isAge ? (AGE_MAX - AGE_MIN || 1) : last, mn = isAge ? AGE_MIN : 0;
        $(".sel", box).style.left = (100 * (x - mn) / span) + "%";
        $(".sel", box).style.right = (100 * ((isAge ? AGE_MAX : last) - y) / span) + "%";
        const vals = $$(".range-vals span", box);
        vals[0].textContent = isAge ? `${x} anos` : PAT_LABELS[x];
        vals[1].textContent = isAge ? `${y} anos` : (y === last ? "sem limite" : "até " + PAT_LABELS[y]);
      }
    };
    [a, b].forEach(el => { el.addEventListener("input", () => upd(false)); el.addEventListener("change", () => upd(true)); });
  };
  rng("#age-lo", "#age-hi", "idade", true);
  rng("#pat-lo", "#pat-hi", "pat", false);
  const tg = (id, key) => $(id, body)?.addEventListener("change", e => { S.f[key] = e.target.checked; saveFilters(); S.limit = 60; renderExplore(); });
  tg("#t-reel", "reeleicao"); tg("#t-h22", "h2022"); tg("#t-sb", "semBens");
}
function filterOpts(input) {
  const t = norm(input.value);
  $$(".opt", input.parentElement).forEach(o => { o.hidden = t && !o.dataset.t.includes(t); });
}
function toggleVal(k, v) {
  const sel = S.f[k];
  const i = sel.indexOf(v);
  if (i >= 0) sel.splice(i, 1); else sel.push(v);
  saveFilters(); S.limit = 60; renderExplore();
}

function activeChips() {
  const f = S.f, chips = [];
  for (const fc of FACETS) for (const v of f[fc.k]) chips.push({ label: v, rm: () => toggleVal(fc.k, v) });
  if (f.idade[0] > AGE_MIN || f.idade[1] < AGE_MAX) chips.push({ label: `${f.idade[0]}–${f.idade[1]} anos`, rm: () => { f.idade = [AGE_MIN, AGE_MAX]; } });
  const last = PAT_EDGES.length - 1;
  if (f.pat[0] > 0 || f.pat[1] < last) chips.push({ label: `Patrimônio ${PAT_LABELS[f.pat[0]]}${f.pat[1] === last ? "+" : "–" + PAT_LABELS[f.pat[1]]}`, rm: () => { f.pat = [0, last]; } });
  if (f.reeleicao) chips.push({ label: "Reeleição", rm: () => { f.reeleicao = false; } });
  if (f.h2022) chips.push({ label: "Concorreu em 2022", rm: () => { f.h2022 = false; } });
  if (f.semBens) chips.push({ label: "Sem bens declarados", rm: () => { f.semBens = false; } });
  return chips;
}

let current = [];
function renderExplore() {
  updatePills();
  renderFilters();
  current = sorted(ALL.filter(c => matches(c)));
  const n = current.length;
  const chips = activeChips();
  $("#fcount-btn").textContent = activeCount() ? `(${activeCount()})` : "";
  const line = $("#result-line");
  line.innerHTML = `<span class="count"><b>${nf0.format(n)}</b> de ${nf0.format(ALL.length)} candidatos</span>
    ${chips.map((c, i) => `<button type="button" class="chip x" data-i="${i}" aria-label="Remover filtro ${esc(c.label)}">${esc(c.label)}</button>`).join("")}
    ${chips.length || S.q ? `<button type="button" class="btn sm ghost" id="clear-all">Limpar tudo</button>` : ""}`;
  $$(".chip.x", line).forEach(b => b.addEventListener("click", () => { const c = chips[+b.dataset.i]; c.rm(); saveFilters(); renderExplore(); }));
  $("#clear-all", line)?.addEventListener("click", () => { S.f = emptyFilters(); S.q = ""; qNorm = ""; $("#q").value = ""; saveFilters(); renderExplore(); });

  $("#sort").value = S.sort;
  $("#v-table").setAttribute("aria-pressed", S.mode === "table");
  $("#v-cards").setAttribute("aria-pressed", S.mode === "cards");

  const res = $("#results");
  if (!n) {
    res.innerHTML = `<div class="card empty"><h3>Nenhum candidato com esses filtros</h3><p>Remova algum filtro acima ou limpe a busca.</p></div>`;
    return;
  }
  const page = current.slice(0, S.limit);
  if (S.mode === "table") {
    const [sk, sd] = S.sort.split(":");
    const th = (k, label, cls = "") => `<th class="${cls}" data-sort="${k}" ${sk === k ? `aria-sort="${sd === "asc" ? "ascending" : "descending"}"` : ""} scope="col">${label}</th>`;
    res.innerHTML = `<div class="table-wrap"><table class="list"><thead><tr>
        <th aria-label="Favorito"></th>${th("urna", "Candidato")}${th("num", "Nº")}${th("cargoOrd", "Cargo")}${th("partido", "Partido")}${th("idade", "Idade", "r")}
        ${th("instrucaoOrd", "Formação", "hide-sm hide-md")}${th("ocupacao", "Ocupação", "hide-sm")}${th("patrimonio", "Patrimônio", "r")}${th("situacao", "Situação", "hide-sm")}<th aria-label="Comparar"></th>
      </tr></thead><tbody>${page.map(c => `
        <tr data-id="${esc(c.id)}">
          <td><button class="star" type="button" data-star="${esc(c.id)}" aria-pressed="${starred.has(c.id)}" aria-label="Adicionar ${esc(c.urna)} à minha lista">★</button></td>
          <td><div class="who">${avatar(c)}<span class="t"><b>${esc(c.urna)}</b><span>${esc(c.nome)}</span></span></div></td>
          <td><span class="urna">${esc(c.num)}</span></td>
          <td class="muted nw">${esc(c.cargo)}</td>
          <td><span class="badge party" title="${esc(c.partidoNome)}">${esc(c.partido)}</span></td>
          <td class="r num">${c.idade ?? "—"}</td>
          <td class="muted hide-sm hide-md clip">${esc(c.instrucao || "—")}</td>
          <td class="muted hide-sm clip" title="${esc(c.ocupacao)}">${esc(c.ocupacao || "—")}</td>
          <td class="r money">${c.bens?.length ? money(c.patrimonio) : `<span style="color:var(--ink-3)">sem bens</span>`}</td>
          <td class="hide-sm">${statusBadge(c)}</td>
          <td><button class="cmp-btn" type="button" data-cmp="${esc(c.id)}" aria-pressed="${compare.includes(c.id)}">${compare.includes(c.id) ? "✓ Comparar" : "+ Comparar"}</button></td>
        </tr>`).join("")}</tbody></table></div>`;
    $$("th[data-sort]", res).forEach(h => h.addEventListener("click", () => {
      const k = h.dataset.sort;
      const numeric = ["idade", "patrimonio", "num", "cargoOrd", "instrucaoOrd"].includes(k);
      S.sort = sk === k ? `${k}:${sd === "asc" ? "desc" : "asc"}` : `${k}:${numeric && k !== "cargoOrd" ? "desc" : "asc"}`;
      store.set("sort", S.sort); renderExplore();
    }));
  } else {
    res.innerHTML = `<div class="cards">${page.map(c => `
      <article class="card ccard" data-id="${esc(c.id)}" tabindex="0">
        <div class="hd">${avatar(c)}<div class="t"><b>${esc(c.urna)}</b><span>${esc(c.cargo)} · <span class="urna">${esc(c.num)}</span></span></div>
          <button class="star" type="button" data-star="${esc(c.id)}" aria-pressed="${starred.has(c.id)}" aria-label="Adicionar ${esc(c.urna)} à minha lista">★</button></div>
        <dl><dt>Partido</dt><dd>${esc(c.partido)}</dd><dt>Idade</dt><dd>${c.idade ?? "—"} anos</dd><dt>Formação</dt><dd>${esc(c.instrucao || "—")}</dd>
          <dt>Ocupação</dt><dd title="${esc(c.ocupacao)}">${esc(c.ocupacao || "—")}</dd><dt>Patrimônio</dt><dd class="mono">${c.bens?.length ? money(c.patrimonio) : "sem bens"}</dd></dl>
        <div class="ft">${statusBadge(c)}${c.reeleicao ? `<span class="badge re">Reeleição</span>` : ""}<span style="flex:1"></span>
          <button class="cmp-btn" type="button" data-cmp="${esc(c.id)}" aria-pressed="${compare.includes(c.id)}">${compare.includes(c.id) ? "✓ Comparar" : "+ Comparar"}</button></div>
      </article>`).join("")}</div>`;
  }
  if (n > S.limit) {
    res.insertAdjacentHTML("beforeend", `<div class="pager">Mostrando ${nf0.format(S.limit)} de ${nf0.format(n)} <button class="btn" type="button" id="more">Mostrar mais ${nf0.format(Math.min(120, n - S.limit))}</button></div>`);
    $("#more").addEventListener("click", () => { S.limit += 120; renderExplore(); });
  }
  bindItemButtons(res);
  $$("[data-id]", res).forEach(r => {
    r.addEventListener("click", e => { if (!e.target.closest("button")) openCandidate(r.dataset.id); });
    r.addEventListener("keydown", e => { if (e.key === "Enter" && e.target === r) openCandidate(r.dataset.id); });
  });
}
function bindItemButtons(root) {
  $$("[data-star]", root).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); toggleStar(b.dataset.star); b.setAttribute("aria-pressed", starred.has(b.dataset.star)); }));
  $$("[data-cmp]", root).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); toggleCompare(b.dataset.cmp);
    const on = compare.includes(b.dataset.cmp);
    b.setAttribute("aria-pressed", on); b.textContent = on ? "✓ Comparar" : "+ Comparar";
  }));
}
function toggleStar(id) {
  if (starred.has(id)) { starred.delete(id); toast("Removido da sua lista"); }
  else { starred.add(id); toast("Adicionado à sua lista ★"); }
  store.set("starred", [...starred]); updatePills();
}
function toggleCompare(id) {
  const i = compare.indexOf(id);
  if (i >= 0) compare.splice(i, 1);
  else {
    if (compare.length >= 4) { toast("Comparação aceita até 4 candidatos. Remova um primeiro."); return; }
    compare.push(id); toast(`Na comparação (${compare.length}/4)`);
  }
  store.set("compare", compare); updatePills();
}

// toolbar
let qTimer;
$("#q").addEventListener("input", e => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { S.q = e.target.value; qNorm = norm(S.q.trim()); S.limit = 60; renderExplore(); }, 120);
});
$("#sort").addEventListener("change", e => { S.sort = e.target.value; store.set("sort", S.sort); renderExplore(); });
$("#v-table").addEventListener("click", () => { S.mode = "table"; store.set("mode", "table"); renderExplore(); });
$("#v-cards").addEventListener("click", () => { S.mode = "cards"; store.set("mode", "cards"); renderExplore(); });
$("#filters-open").addEventListener("click", () => { $("#filters").classList.add("on"); $("#scrim").classList.add("on"); });
$("#filters-close").addEventListener("click", closeFilters);
function closeFilters() { $("#filters").classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); }
$("#copy-csv").addEventListener("click", async () => {
  const cols = [["Nome de urna", c => c.urna], ["Nome", c => c.nome], ["Número", c => c.num], ["Cargo", c => c.cargo], ["Partido", c => c.partido],
    ["Federação", c => c.federacao], ["Idade", c => c.idade], ["Gênero", c => c.genero], ["Cor/raça", c => c.raca], ["Formação", c => c.instrucao],
    ["Ocupação", c => c.ocupacao], ["Patrimônio (R$)", c => (c.patrimonio || 0).toFixed(2).replace(".", ",")], ["Situação", c => c.situacaoDet], ["Reeleição", c => c.reeleicao ? "Sim" : "Não"]];
  const q = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map(c => c[0]).join(";"), ...current.map(c => cols.map(([, g]) => q(g(c))).join(";"))].join("\n");
  if (!(await copyText(csv, `CSV com ${nf0.format(current.length)} linhas copiado. Cole numa planilha.`))) showCopyFallback("CSV dos resultados", csv);
});

// ------------------------------------------------------------ FICHA
const GROUP_COLORS = { "Imóveis": "var(--c1)", "Veículos": "var(--c2)", "Aplicações e investimentos": "var(--c3)", "Participações societárias": "var(--c4)", "Dinheiro em espécie": "var(--c5)", "Créditos e outros": "var(--c6)" };
function stackBar(groups, total) {
  const ent = Object.entries(groups || {}).filter(e => e[1] > 0);
  if (!ent.length || !total) return "";
  return `<div class="stack" role="img" aria-label="Composição do patrimônio">${ent.map(([g, v]) => `<i style="width:${(100 * v / total).toFixed(2)}%;background:${GROUP_COLORS[g] || "var(--c6)"}" title="${esc(g)}: ${esc(money(v))}"></i>`).join("")}</div>
    <div class="legend">${ent.map(([g, v]) => `<span><i style="background:${GROUP_COLORS[g] || "var(--c6)"}"></i>${esc(g)} · ${money(v)} (${pct(v, total)})</span>`).join("")}</div>`;
}
function tseLink() { return "https://divulgacandcontas.tse.jus.br/divulga/"; }
function netName(url) {
  const u = url.toLowerCase();
  for (const [k, n] of [["instagram", "Instagram"], ["facebook", "Facebook"], ["x.com", "X"], ["twitter", "X"], ["youtube", "YouTube"], ["tiktok", "TikTok"], ["linkedin", "LinkedIn"], ["threads", "Threads"], ["kwai", "Kwai"], ["t.me", "Telegram"], ["whatsapp", "WhatsApp"]]) if (u.includes(k)) return n;
  return "Site";
}
let lastFocus = null;
function openCandidate(id) {
  const c = BY_ID.get(id);
  if (!c) return;
  lastFocus = document.activeElement;
  const dr = $("#drawer");
  const h = c.h2022;
  const research = RESEARCH?.candidatos?.[c.id];
  const digits = String(c.num || "").split("");
  dr.innerHTML = `
    <div class="drawer-h">
      ${avatar(c, "lg")}
      <div class="t">
        <span class="eyebrow">${esc(c.cargo)}</span>
        <h2 id="dr-name">${esc(c.urna)}</h2>
        <span class="full">${esc(c.nome)}</span>
        <div class="row"><span class="urna-lg" aria-label="Número ${esc(c.num)}">${digits.map(d => `<span>${esc(d)}</span>`).join("")}</span>
          <span class="badge party" title="${esc(c.partidoNome)}">${esc(c.partido)}</span>${statusBadge(c)}${c.reeleicao ? `<span class="badge re">Tenta reeleição</span>` : ""}</div>
      </div>
      <button class="icon-btn" type="button" id="dr-close" aria-label="Fechar ficha">✕</button>
    </div>
    <div class="drawer-b">
      <div class="drawer-actions">
        <button class="btn ${starred.has(c.id) ? "" : "primary"}" type="button" id="dr-star">${starred.has(c.id) ? "★ Na minha lista" : "☆ Adicionar à minha lista"}</button>
        <button class="btn" type="button" id="dr-cmp">${compare.includes(c.id) ? "✓ Na comparação" : "+ Comparar"}</button>
        ${c.proposta ? `<a class="btn" href="${esc(c.proposta)}" target="_blank" rel="noopener">Plano de governo (PDF) ↗</a>` : ""}
      </div>
      <dl class="facts">
        <div><dt>Partido</dt><dd>${esc(c.partidoNome || c.partido)}</dd></div>
        <div><dt>Idade</dt><dd>${c.idade ?? "—"} anos${c.nasc ? ` <span style="color:var(--ink-3)">(${c.nasc.split("-").reverse().join("/")})</span>` : ""}</dd></div>
        ${c.federacao ? `<div><dt>Federação</dt><dd>${esc(c.federacao)}${c.fedComp ? ` <span style="color:var(--ink-3)">(${esc(c.fedComp)})</span>` : ""}</dd></div>` : ""}
        ${c.coligacao ? `<div class="wide"><dt>Coligação</dt><dd>${esc(c.coligacao)}${c.coligComp ? ` <span style="color:var(--ink-3)">(${esc(c.coligComp)})</span>` : ""}</dd></div>` : ""}
        <div><dt>Formação</dt><dd>${esc(c.instrucao || "—")}</dd></div>
        <div><dt>Ocupação</dt><dd>${esc(c.ocupacao || "—")}</dd></div>
        <div><dt>Gênero</dt><dd>${esc(c.genero || "—")}</dd></div>
        <div><dt>Cor/raça</dt><dd>${esc(c.raca || "—")}</dd></div>
        <div><dt>Estado civil</dt><dd>${esc(c.estadoCivil || "—")}</dd></div>
        <div><dt>Naturalidade</dt><dd>${esc(c.natural || "—")}</dd></div>
        <div class="wide"><dt>Situação da candidatura</dt><dd>${esc(c.situacaoDet || c.situacao || "—")}</dd></div>
        ${c.limiteGastos ? `<div class="wide"><dt>Limite de gastos de campanha</dt><dd>${brl.format(c.limiteGastos)}</dd></div>` : ""}
      </dl>
      ${research ? `<div><h3 class="sub-h">Propostas e posicionamento</h3><p style="margin:0 0 8px;color:var(--ink-2)">${esc(research.resumo || "")}</p><button class="btn sm" type="button" id="dr-research">Ver análise completa</button></div>` : ""}
      <div>
        <h3 class="sub-h"><span>Patrimônio declarado</span><span class="v">${c.bens?.length ? brl2.format(c.patrimonio) : "—"}</span></h3>
        ${c.bens?.length ? stackBar(c.bensGrupos, c.patrimonio) + `
          <div class="bens">${c.bens.slice(0, S.allBens ? 999 : 12).map(b => `<div class="bem"><b>${esc(b.t || b.g)}</b><span class="v">${brl2.format(b.v)}</span><span class="d">${esc(b.d)}</span></div>`).join("")}</div>
          ${c.bens.length > 12 ? `<button class="btn sm ghost" type="button" id="dr-allbens" style="margin-top:6px">${S.allBens ? "Mostrar menos" : `Ver todos os ${c.bens.length} bens`}</button>` : ""}`
          : `<p style="color:var(--ink-3);margin:0">Nenhum bem declarado ao TSE até a data da extração.</p>`}
        <p style="color:var(--ink-3);font-size:12px;margin:8px 0 0">Valores informados pelo próprio candidato, em geral pelo valor de aquisição ou o declarado no Imposto de Renda, e não pelo valor de mercado.</p>
      </div>
      ${h ? `<div><h3 class="sub-h">Eleição de 2022</h3>
        <div class="compare-h22"><span>Concorreu a <b>${esc(h.cargo)}</b> pelo ${esc(h.partido)} — <b>${esc(h.resultado || "resultado não informado")}</b></span></div>
        ${h.patrimonio != null ? `<p style="margin:6px 0 0;font-size:13px">Patrimônio declarado em 2022: <span class="mono">${money(h.patrimonio)}</span>${h.patrimonio > 0 && c.patrimonio != null ? ` → 2026: <span class="mono">${money(c.patrimonio)}</span> <span class="${c.patrimonio >= h.patrimonio ? "delta-up" : "delta-down"}">(${c.patrimonio >= h.patrimonio ? "+" : ""}${nf0.format(100 * (c.patrimonio - h.patrimonio) / h.patrimonio)}%)</span>` : ""}</p>` : ""}
        <p style="color:var(--ink-3);font-size:12px;margin:6px 0 0">Ligação feita por nome completo e data de nascimento.</p></div>` : ""}
      <div><h3 class="sub-h">Contato e redes</h3><div class="links">
        ${(c.redes || []).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(netName(u))}: ${esc(u.replace(/^https?:\/\/(www\.)?/, ""))}</a>`).join("") || `<span style="color:var(--ink-3)">Nenhuma rede social informada ao TSE.</span>`}
        ${c.email ? `<span>E-mail: <span class="mono" style="user-select:all">${esc(c.email)}</span></span>` : ""}
        ${c.proposta ? `<a href="${esc(c.proposta)}" target="_blank" rel="noopener">Plano de governo registrado no TSE (PDF) ↗</a>` : ""}
        <span>Ficha oficial: <a href="${tseLink(c)}" target="_blank" rel="noopener">DivulgaCandContas (TSE) ↗</a>, busque por “${esc(c.urna)}”.</span>
      </div></div>
    </div>`;
  dr.classList.add("on"); $("#scrim").classList.add("on");
  $("#dr-close").focus();
  $("#dr-close").addEventListener("click", closeDrawer);
  $("#dr-star").addEventListener("click", () => { toggleStar(c.id); openCandidate(c.id); refreshBehind(); });
  $("#dr-cmp").addEventListener("click", () => { toggleCompare(c.id); openCandidate(c.id); refreshBehind(); });
  $("#dr-allbens")?.addEventListener("click", () => { S.allBens = !S.allBens; openCandidate(c.id); });
  $("#dr-research")?.addEventListener("click", () => { closeDrawer(); S.researchFocus = c.id; go("propostas"); });
}
function refreshBehind() { if (["explorar", "lista", "comparar"].includes(S.view)) render(); }
function closeDrawer() {
  $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); S.allBens = false;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
$("#scrim").addEventListener("click", () => { closeDrawer(); closeFilters(); });
addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); closeFilters(); } });

function showCopyFallback(title, text) {
  const dr = $("#drawer");
  dr.innerHTML = `<div class="drawer-h"><div class="t"><h2 id="dr-name">${esc(title)}</h2><span class="full">O navegador não permitiu copiar automaticamente. Selecione o texto abaixo e copie.</span></div>
    <button class="icon-btn" type="button" id="dr-close" aria-label="Fechar">✕</button></div>
    <div class="drawer-b"><textarea class="copybox" id="copybox" style="min-height:60vh" readonly></textarea></div>`;
  $("#copybox").value = text;
  dr.classList.add("on"); $("#scrim").classList.add("on");
  $("#dr-close").addEventListener("click", closeDrawer);
  $("#copybox").focus(); $("#copybox").select();
}

// ------------------------------------------------------------ PARTIDOS
function renderParties() {
  const root = $("#view-partidos");
  const list = S.partyCargo ? ALL.filter(c => c.cargo === S.partyCargo) : ALL;
  const groups = new Map();
  for (const c of list) { if (!groups.has(c.partido)) groups.set(c.partido, []); groups.get(c.partido).push(c); }
  let rows = [...groups].map(([p, cs]) => ({
    p, nome: cs[0].partidoNome, fed: cs.find(c => c.federacao)?.federacao,
    n: cs.length,
    mulheres: cs.filter(c => /fem/i.test(c.genero || "")).length / cs.length,
    idade: median(cs.map(c => c.idade)),
    sup: cs.filter(c => c.instrucao === "Superior completo").length / cs.length,
    pat: median(cs.map(c => c.patrimonio || 0)),
    tot: cs.reduce((a, c) => a + (c.patrimonio || 0), 0),
    reel: cs.filter(c => c.reeleicao).length,
    maj: cs.filter(c => c.cargoOrd <= 2).map(c => c.urna),
  }));
  const [k, d] = S.partySort;
  rows.sort((a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k], "pt") : (a[k] ?? -1) - (b[k] ?? -1)) * (d === "desc" ? -1 : 1));
  const maxN = Math.max(1, ...rows.map(r => r.n)), maxPat = Math.max(1, ...rows.map(r => r.pat || 0));
  const cargoCounts = countBy(ALL, c => c.cargo);
  const th = (key, label, cls = "") => `<th class="${cls}" data-k="${key}" ${k === key ? `aria-sort="${d === "asc" ? "ascending" : "descending"}"` : ""} scope="col">${label}</th>`;
  root.innerHTML = `
    <div class="section-h"><h2>Perfil dos partidos</h2><span class="sub">Clique num partido para ver seus candidatos. Clique nos títulos para ordenar.</span></div>
    <div class="cargo-strip" role="group" aria-label="Recorte por cargo">
      <button class="chip" type="button" data-cargo="" aria-pressed="${!S.partyCargo}">Todos os cargos</button>
      ${CARGOS.map(c => `<button class="chip" type="button" data-cargo="${esc(c)}" aria-pressed="${S.partyCargo === c}">${esc(c)} <span class="c">${nf0.format(cargoCounts.get(c) || 0)}</span></button>`).join("")}
    </div>
    <div class="table-wrap"><table class="list"><thead><tr>
      ${th("p", "Partido")}${th("n", "Candidatos", "r")}${th("mulheres", "Mulheres", "r")}${th("idade", "Idade mediana", "r")}${th("sup", "Superior completo", "r")}${th("pat", "Patrimônio mediano", "r")}${th("tot", "Patrimônio somado", "r hide-sm")}${th("reel", "Reeleição", "r hide-sm")}<th class="hide-sm" scope="col">Governo / Senado</th>
    </tr></thead><tbody>${rows.map(r => `
      <tr data-p="${esc(r.p)}">
        <td><div class="party-cell"><b>${esc(r.p)}</b><span>${esc(r.nome || "")}${r.fed ? " · " + esc(r.fed) : ""}</span></div></td>
        <td class="r"><div class="inline-bar"><span class="num">${r.n}</span><i style="width:${(60 * r.n / maxN).toFixed(1)}px"></i></div></td>
        <td class="r num">${nf0.format(100 * r.mulheres)}%</td>
        <td class="r num">${r.idade == null ? "—" : nf0.format(r.idade)}</td>
        <td class="r num">${nf0.format(100 * r.sup)}%</td>
        <td class="r money"><div class="inline-bar"><span>${money(r.pat)}</span><i style="width:${(50 * (r.pat || 0) / maxPat).toFixed(1)}px"></i></div></td>
        <td class="r money hide-sm">${money(r.tot)}</td>
        <td class="r num hide-sm">${r.reel || "—"}</td>
        <td class="muted hide-sm">${esc(r.maj.slice(0, 3).join(", ")) || "—"}</td>
      </tr>`).join("")}</tbody></table></div>`;
  $$(".cargo-strip .chip", root).forEach(b => b.addEventListener("click", () => { S.partyCargo = b.dataset.cargo || null; renderParties(); }));
  $$("th[data-k]", root).forEach(h => h.addEventListener("click", () => {
    const key = h.dataset.k;
    S.partySort = k === key ? [key, d === "asc" ? "desc" : "asc"] : [key, key === "p" ? "asc" : "desc"];
    renderParties();
  }));
  $$("tr[data-p]", root).forEach(r => r.addEventListener("click", () => drill({ partido: [r.dataset.p], ...(S.partyCargo ? { cargo: [S.partyCargo] } : {}) })));
}

// ------------------------------------------------------------ COMPARAR
function pickerHTML(id, placeholder) {
  return `<label class="search" style="position:relative"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="${id}" type="search" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(placeholder)}"><div class="suggest" id="${id}-s" hidden></div></label>`;
}
function bindPicker(id, onPick) {
  const input = $("#" + id), box = $("#" + id + "-s");
  let items = [], act = 0;
  const draw = () => {
    const t = norm(input.value.trim());
    if (!t) { box.hidden = true; return; }
    items = ALL.filter(c => { if (!c._s) c._s = norm([c.urna, c.nome, c.num, c.partido, c.ocupacao, c.cargo].join(" ")); return t.split(/\s+/).every(w => c._s.includes(w)); }).slice(0, 8);
    act = 0;
    box.innerHTML = items.length ? items.map((c, i) => `<button type="button" data-i="${i}" class="${i === act ? "act" : ""}">${avatar(c)}<span><b>${esc(c.urna)}</b><br><span style="font-size:12px;color:var(--ink-3)">${esc(c.cargo)} · ${esc(c.partido)} · ${esc(c.num)}</span></span></button>`).join("")
      : `<div style="padding:10px;color:var(--ink-3)">Ninguém encontrado</div>`;
    box.hidden = false;
    $$("button", box).forEach(b => b.addEventListener("mousedown", e => { e.preventDefault(); onPick(items[+b.dataset.i]); }));
  };
  input.addEventListener("input", draw);
  input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 120));
  input.addEventListener("keydown", e => {
    if (box.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; $$("button", box).forEach((b, i) => b.classList.toggle("act", i === act)); }
    if (e.key === "Enter") { e.preventDefault(); onPick(items[act]); }
  });
}
function renderCompare() {
  const root = $("#view-comparar");
  const cs = compare.map(id => BY_ID.get(id)).filter(Boolean);
  const head = `<div class="section-h"><h2>Comparar candidatos</h2><span class="sub">Até 4 lado a lado. Adicione pela busca abaixo ou pelo botão “+ Comparar” na lista.</span></div>
    <div class="picker">${pickerHTML("cmp-q", "Adicionar candidato à comparação…")}
      ${cs.length ? `<button class="btn ghost" type="button" id="cmp-clear">Limpar comparação</button>` : ""}
      ${starred.size ? `<button class="btn" type="button" id="cmp-from-list">Usar minha lista (${starred.size})</button>` : ""}</div>`;
  if (!cs.length) {
    root.innerHTML = head + `<div class="card empty"><h3>Nenhum candidato na comparação</h3><p>Busque pelo nome acima, ou use “+ Comparar” na aba Explorar.</p></div>`;
  } else {
    const maxPat = Math.max(1, ...cs.map(c => c.patrimonio || 0));
    const R = RESEARCH?.candidatos || {};
    const row = (label, fn) => `<div class="cmp-row"><div>${label}</div>${cs.map(c => `<div>${fn(c)}</div>`).join("")}</div>`;
    root.innerHTML = head + `<div class="cmp-grid" style="--n:${cs.length}">
      <div class="cmp-row cmp-head"><div></div>${cs.map(c => `<div>${avatar(c, "lg")}<b>${esc(c.urna)}</b><span class="urna">${esc(c.num)}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-open="${esc(c.id)}">Ficha</button><button class="btn sm ghost" type="button" data-rm="${esc(c.id)}">Remover</button></div></div>`).join("")}</div>
      ${row("Cargo", c => esc(c.cargo))}
      ${row("Partido", c => `<span class="badge party">${esc(c.partido)}</span> ${esc(c.partidoNome || "")}`)}
      ${HAS_FED ? row("Federação / coligação", c => esc(c.federacao || c.coligacao || "—")) : ""}
      ${row("Idade", c => `${c.idade ?? "—"} anos`)}
      ${row("Gênero", c => esc(c.genero || "—"))}
      ${row("Cor/raça", c => esc(c.raca || "—"))}
      ${row("Formação", c => esc(c.instrucao || "—"))}
      ${row("Ocupação", c => esc(c.ocupacao || "—"))}
      ${row("Estado civil", c => esc(c.estadoCivil || "—"))}
      ${row("Naturalidade", c => esc(c.natural || "—"))}
      ${row("Patrimônio", c => `<span class="mono">${c.bens?.length ? money(c.patrimonio) : "sem bens"}</span><div class="cmp-bar" style="width:${(100 * (c.patrimonio || 0) / maxPat).toFixed(1)}%"></div>`)}
      ${row("Composição", c => stackBar(c.bensGrupos, c.patrimonio) || "—")}
      ${HAS_2022 ? row("Em 2022", c => c.h2022 ? `${esc(c.h2022.cargo)} (${esc(c.h2022.partido)}): <b>${esc(c.h2022.resultado || "—")}</b>` : "Não concorreu") : ""}
      ${row("Reeleição", c => c.reeleicao ? "Sim" : "Não")}
      ${row("Situação", c => statusBadge(c))}
      ${RESEARCH ? row("Resumo das propostas", c => R[c.id] ? esc(R[c.id].resumo || "") : `<span style="color:var(--ink-3)">Não pesquisado</span>`) : ""}
    </div>`;
    $$("[data-rm]", root).forEach(b => b.addEventListener("click", () => { toggleCompare(b.dataset.rm); renderCompare(); }));
    $$("[data-open]", root).forEach(b => b.addEventListener("click", () => openCandidate(b.dataset.open)));
  }
  bindPicker("cmp-q", c => { if (!compare.includes(c.id)) toggleCompare(c.id); renderCompare(); $("#cmp-q").focus(); });
  $("#cmp-clear", root)?.addEventListener("click", () => { compare = []; store.set("compare", compare); updatePills(); renderCompare(); });
  $("#cmp-from-list", root)?.addEventListener("click", () => {
    compare = [...starred].slice(0, 4); store.set("compare", compare); updatePills(); renderCompare();
    if (starred.size > 4) toast("Sua lista tem mais de 4 nomes; entraram os 4 primeiros.");
  });
}

// ------------------------------------------------------------ MINHA LISTA
function listText(cs) {
  return cs.map(c => `${c.urna} (${c.num}) — ${c.cargo}, ${c.partido} — id TSE ${c.id}`).join("\n");
}
function renderList() {
  const root = $("#view-lista");
  const cs = [...starred].map(id => BY_ID.get(id)).filter(Boolean).sort((a, b) => a.cargoOrd - b.cargoOrd || a.urna.localeCompare(b.urna, "pt"));
  root.innerHTML = `
    <div class="section-h"><h2>Minha lista</h2><span class="sub">Fica salva só neste navegador.</span></div>
    <p class="list-intro">Marque com ★ os candidatos que você quer acompanhar. Depois copie a lista e envie para o Claude na conversa: ele faz a pesquisa detalhada das propostas e do histórico de cada um, e os resultados aparecem na aba Propostas.</p>
    <div class="picker">${pickerHTML("list-q", "Adicionar candidato à lista…")}
      ${cs.length ? `<button class="btn primary" type="button" id="list-copy">Copiar lista para enviar ao Claude</button>
      <button class="btn" type="button" id="list-cmp">Comparar ${cs.length > 4 ? "os 4 primeiros" : "estes"}</button>
      <button class="btn ghost" type="button" id="list-clear">Esvaziar lista</button>` : ""}
    </div>
    ${cs.length ? `<div class="cards">${cs.map(c => `
      <article class="card ccard" data-id="${esc(c.id)}" tabindex="0">
        <div class="hd">${avatar(c)}<div class="t"><b>${esc(c.urna)}</b><span>${esc(c.cargo)} · <span class="urna">${esc(c.num)}</span></span></div>
          <button class="star" type="button" data-star="${esc(c.id)}" aria-pressed="true" aria-label="Remover ${esc(c.urna)} da lista">★</button></div>
        <dl><dt>Partido</dt><dd>${esc(c.partido)}</dd><dt>Idade</dt><dd>${c.idade ?? "—"} anos</dd><dt>Formação</dt><dd>${esc(c.instrucao || "—")}</dd>
          <dt>Ocupação</dt><dd>${esc(c.ocupacao || "—")}</dd><dt>Patrimônio</dt><dd class="mono">${c.bens?.length ? money(c.patrimonio) : "sem bens"}</dd></dl>
        <div class="ft">${statusBadge(c)}${RESEARCH?.candidatos?.[c.id] ? `<span class="badge re">Pesquisado</span>` : ""}<span style="flex:1"></span>
          <button class="cmp-btn" type="button" data-cmp="${esc(c.id)}" aria-pressed="${compare.includes(c.id)}">${compare.includes(c.id) ? "✓ Comparar" : "+ Comparar"}</button></div>
      </article>`).join("")}</div>` : `<div class="card empty"><h3>Sua lista está vazia</h3><p>Use a busca acima ou toque na ★ ao lado de qualquer candidato na aba Explorar.</p><button class="btn primary" type="button" id="list-go">Ir para Explorar</button></div>`}`;
  bindPicker("list-q", c => { if (!starred.has(c.id)) toggleStar(c.id); renderList(); $("#list-q").focus(); });
  bindItemButtons(root);
  $$("[data-star]", root).forEach(b => b.addEventListener("click", () => renderList()));
  $$("[data-id]", root).forEach(r => r.addEventListener("click", e => { if (!e.target.closest("button")) openCandidate(r.dataset.id); }));
  $("#list-go", root)?.addEventListener("click", () => go("explorar"));
  $("#list-clear", root)?.addEventListener("click", () => {
    const b = $("#list-clear", root);
    if (b.dataset.confirm) { starred.clear(); store.set("starred", []); updatePills(); renderList(); }
    else { b.dataset.confirm = "1"; b.textContent = "Clique de novo para confirmar"; setTimeout(() => { if (document.contains(b)) { delete b.dataset.confirm; b.textContent = "Esvaziar lista"; } }, 3000); }
  });
  $("#list-cmp", root)?.addEventListener("click", () => { compare = cs.slice(0, 4).map(c => c.id); store.set("compare", compare); go("comparar"); });
  $("#list-copy", root)?.addEventListener("click", async () => {
    const txt = "Quero a pesquisa detalhada de propostas destes candidatos:\n" + listText(cs);
    if (!(await copyText(txt, "Lista copiada. Cole na conversa com o Claude."))) showCopyFallback("Sua lista", txt);
  });
}

// ------------------------------------------------------------ PROPOSTAS (preenchido na fase de pesquisa)
function renderResearch() {
  const root = $("#view-propostas");
  if (window.renderResearchView) window.renderResearchView(root, { ALL, BY_ID, RESEARCH, openCandidate, avatar, esc, money, S });
  else root.innerHTML = `<div class="card empty"><h3>Pesquisa de propostas ainda não feita</h3><p>Monte sua lista e envie ao Claude.</p></div>`;
}

// ------------------------------------------------------------ SOBRE
function renderAbout() {
  const root = $("#view-sobre");
  root.innerHTML = `<div style="max-width:72ch;display:flex;flex-direction:column;gap:14px">
    <div class="section-h"><h2>Sobre os dados</h2></div>
    <p><b>Fonte.</b> ${META.amostra ? "<b>ESTA VERSÃO USA DADOS FICTÍCIOS DE TESTE.</b> " : ""}Todos os dados vêm do Portal de Dados Abertos do Tribunal Superior Eleitoral (TSE): registro de candidaturas (<span class="mono">consulta_cand_2026</span>), bens declarados (<span class="mono">bem_candidato_2026</span>) e redes sociais informadas pelos candidatos. ${META.historico2022 ? "O histórico de 2022 vem dos mesmos arquivos daquela eleição." : ""}</p>
    <p><b>Atualização.</b> Arquivo gerado pelo TSE em ${esc(META.geradoTSE || "—")}, extraído em ${esc(fmtDate(META.extraidoEm))}. A situação das candidaturas muda conforme a Justiça Eleitoral julga os registros; para o status mais recente, confira a ficha no DivulgaCandContas.</p>
    <p><b>Idade</b> é calculada na data da eleição (04/10/2026). <b>Patrimônio</b> é a soma dos bens declarados pelo próprio candidato, normalmente pelo valor de aquisição ou o informado no Imposto de Renda. Não é o valor de mercado e não desconta dívidas. Candidatos sem bens na lista podem não ter entregado a declaração ainda.</p>
    <p><b>Reeleição.</b> O TSE não publicou em 2026 o campo que indica candidatura à reeleição. Por isso o painel marca como “tenta reeleição” quem foi eleito em 2022 para o mesmo cargo, ligando os registros por nome completo e data de nascimento. Senadores eleitos em 2018 não aparecem nessa marcação.</p>
    <p><b>Ocupação, formação, gênero e cor/raça</b> são autodeclarados no registro da candidatura e aparecem como o TSE publica.</p>
    <p><b>Neutralidade.</b> Este painel não recomenda candidatos. A ordem padrão é por cargo e partido, e nenhum destaque visual favorece ninguém. As análises de propostas, quando existirem, citam as fontes de cada nota.</p>
    <p><b>Privacidade.</b> Sua lista e seus filtros ficam salvos apenas neste navegador.</p>
  </div>`;
}
function fmtDate(iso) { return iso ? iso.split("-").reverse().join("/") : "—"; }

// ------------------------------------------------------------ tema, contagem, rodapé
const THEMES = ["system", "light", "dark"];
function applyTheme(t) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  $("#theme-btn").title = { system: "Tema: automático", light: "Tema: claro", dark: "Tema: escuro" }[t];
}
let theme = store.get("theme", "system");
applyTheme(theme);
$("#theme-btn").addEventListener("click", () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; store.set("theme", theme); applyTheme(theme); toast($("#theme-btn").title); });

(function countdown() {
  const el = $("#countdown");
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const e1 = new Date(2026, 9, 4), e2 = new Date(2026, 9, 25);
  const days = d => Math.round((d - today) / 864e5);
  const d1 = days(e1), d2 = days(e2);
  el.textContent = d1 > 1 ? `1º turno em ${d1} dias · 04/10` : d1 === 1 ? "1º turno amanhã · 04/10" : d1 === 0 ? "Hoje é o 1º turno" : d2 > 0 ? `2º turno em ${d2} dias · 25/10` : d2 === 0 ? "Hoje é o 2º turno" : "Eleições 2026";
})();

if (META.amostra) $("#sample-banner").hidden = false;
$("#foot").innerHTML = `<span>Fonte: ${esc(META.fonte || "TSE")}. Extraído em ${esc(fmtDate(META.extraidoEm))}. ${nf0.format(ALL.length)} candidaturas em Santa Catarina.</span>
  <span>Este painel organiza dados públicos para ajudar na comparação e não recomenda nenhum candidato.</span>`;

// categóricas da composição de bens (slots 1–6 da paleta validada)
const css = document.createElement("style");
css.textContent = `:root{--c1:#2a78d6;--c2:#eb6834;--c3:#1baf7a;--c4:#eda100;--c5:#e87ba4;--c6:#008300}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c4:#c98500;--c5:#d55181;--c6:#008300}}
:root[data-theme="dark"]{--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c4:#c98500;--c5:#d55181;--c6:#008300}`;
document.head.appendChild(css);

go(location.hash.slice(1) || "panorama", false);
})();
