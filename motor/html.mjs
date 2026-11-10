// Página HTML de revisão do roteiro, antes do render:
// texto de cada cena (narração e o que aparece na tela), fontes, texto do post, avisos do
// validador e a animação rodando no navegador (o mesmo motor do vídeo, num arquivo só).
// Uso: npm run html -- projetos/<tema>/roteiro.json   ->   projetos/<tema>/saida/roteiro.html
import fs from 'node:fs';
import path from 'node:path';
import { montarTimeline, RAIZ } from './timeline.mjs';
import { validar } from './validar.mjs';

const arq = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!arq) { console.error('Uso: npm run html -- projetos/<tema>/roteiro.json'); process.exit(2); }

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
const FONTES_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&family=Montserrat:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap';

const NOMES = {
  abertura: 'Abertura', artigo: 'Texto de lei', numero: 'Número', balanca: 'Balança',
  lista: 'Lista', linha_do_tempo: 'Linha do tempo', jurisprudencia: 'Jurisprudência',
  alerta: 'Alerta', comparacao: 'Comparação', frase: 'Frase', encerramento: 'Encerramento',
};
const ROTULOS = {
  kicker: 'Selo', titulo: 'Título', destaque: 'Destaque', lei: 'Lei', artigo: 'Artigo', texto: 'Texto',
  numero: 'Número', prefixo: 'Prefixo', sufixo: 'Sufixo', unidade: 'Unidade', legenda: 'Legenda',
  esquerda: 'Lado esquerdo', direita: 'Lado direito', pende: 'Pende para', conclusao: 'Conclusão',
  itens: 'Itens', estilo: 'Estilo', etapas: 'Etapas', tribunal: 'Tribunal', referencia: 'Referência',
  trecho: 'Trecho', data: 'Data', cta: 'Chamada', apoio: 'Texto do carrossel', cubos: 'Cubos 3D',
  casas: 'Casas decimais', duracao: 'Duração mínima',
};
const INTERNOS = new Set(['tipo', 'fala', 'inicio', 'dur', 'grupos']);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function valor(v) {
  if (Array.isArray(v)) {
    return `<ul class="itens">${v.map((x) => `<li>${typeof x === 'object' ? esc([x.titulo, x.detalhe].filter(Boolean).join(' · ')) : esc(x)}</li>`).join('')}</ul>`;
  }
  if (v && typeof v === 'object') return `${esc(v.titulo || '')}${v.itens ? valor(v.itens) : ''}`;
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return esc(v);
}

function naTela(cena) {
  const linhas = Object.entries(cena).filter(([k]) => !INTERNOS.has(k));
  if (!linhas.length) return '<p class="vazio">Marca, chamada e aviso legal de <code>marca.json</code>.</p>';
  return `<dl>${linhas.map(([k, v]) => `<div><dt>${esc(ROTULOS[k] || k)}</dt><dd>${valor(v)}</dd></div>`).join('')}</dl>`;
}

/** Junta util, tres, cenas e motor num módulo só (sem imports locais). */
function motorEmbutido() {
  const web = path.join(RAIZ, 'motor', 'web');
  const partes = ['util.js', 'tres.js', 'cenas.js', 'motor.js'].map((f) => {
    let src = fs.readFileSync(path.join(web, f), 'utf8');
    src = src.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*$/gm, '');
    src = src.replace(/^export\s+(const|function|async function|class|let)\s/gm, '$1 ');
    return `// ---- ${f} ----\n${src}`;
  });
  return `import * as THREE from '${THREE_CDN}';\n${partes.join('\n')}`.replace(/<\/script/gi, '<\\/script');
}

const pasta = path.dirname(path.resolve(arq));
const out = path.join(pasta, 'saida');
fs.mkdirSync(out, { recursive: true });
const roteiro = JSON.parse(fs.readFileSync(arq, 'utf8'));
const { erros, avisos } = validar(arq);
const tl = await montarTimeline(arq, { semVoz: true });
const dataUri = (rel) => {
  if (!rel) return undefined;
  const arqImg = path.join(RAIZ, rel);
  return fs.existsSync(arqImg) ? `data:image/png;base64,${fs.readFileSync(arqImg).toString('base64')}` : undefined;
};
const tlPagina = {
  ...tl, trilhas: [], audio: null,
  marca: { ...tl.marca, logoData: dataUri(tl.marca.logo), monogramaData: dataUri(tl.marca.monograma), monogramaPapelData: dataUri(tl.marca.monograma_papel) },
};

const fontes = roteiro.fontes || [];
const pendentes = fontes.filter((f) => !f.conferido_em).length;
const post = [
  roteiro.legenda_post || '',
  (roteiro.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '),
  tl.marca.aviso || '',
].filter(Boolean).join('\n\n');

const cenasHtml = tl.cenas.map((c, i) => `
      <article class="cena" data-i="${i}" data-inicio="${c.inicio.toFixed(2)}" data-fim="${(c.inicio + c.dur).toFixed(2)}">
        <header>
          <span class="num">${i + 1}</span>
          <span class="tipo">${esc(NOMES[c.tipo] || c.tipo)}</span>
          <span class="tc">${tc(c.inicio)} – ${tc(c.inicio + c.dur)}</span>
          <button type="button" class="ver" data-t="${c.inicio.toFixed(2)}" aria-label="Assistir a cena ${i + 1}">Assistir</button>
        </header>
        <div class="corpo">
          <section class="fala"><h3>Narração</h3><blockquote>${esc(c.fala || '(sem fala)')}</blockquote></section>
          <section class="tela"><h3>Na tela</h3>${naTela(c)}</section>
        </div>
      </article>`).join('');

const fontesHtml = fontes.map((f) => `
        <tr>
          <td>${esc(f.afirmacao)}</td>
          <td><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.fonte)}</a></td>
          <td>${f.conferido_em ? `<span class="chip ok">Conferido em ${esc(f.conferido_em)}</span>` : '<span class="chip pend">A conferir</span>'}</td>
        </tr>`).join('');

const avisosHtml = [...erros.map((e) => ['erro', e]), ...avisos.map((a) => ['aviso', a])]
  .map(([t, m]) => `<li class="${t}"><span class="chip ${t === 'erro' ? 'erro' : 'pend'}">${t === 'erro' ? 'Erro' : 'Aviso'}</span> ${esc(m)}</li>`).join('');

const html = `<title>${esc(roteiro.titulo)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTES_CSS}">
<style>
/* Folha de roteiro: player do Reels fixo à esquerda, decupagem cena a cena à direita. */
:root {
  --fundo: #f3f4f7; --papel: #ffffff; --tinta: #14213a; --suave: #5b6478; --linha: #dde1ea;
  --ouro: #8f6d12; --ouro-fundo: #f6eed7; --ok: #1f7a4d; --ok-fundo: #e2f3ea; --pend: #9a5b00; --pend-fundo: #fbefd9;
  --erro: #b3261e; --erro-fundo: #fbe3e1; --telefone: #0b1626;
  --display: "Playfair Display", Georgia, "Times New Roman", serif;
  --texto: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --fundo: #0c121d; --papel: #131c2b; --tinta: #e8ecf3; --suave: #9aa6bb; --linha: #253148;
  --ouro: #d9b545; --ouro-fundo: #2c2715; --ok: #6fd3a0; --ok-fundo: #15301f; --pend: #f0b45c; --pend-fundo: #33260f;
  --erro: #ff8a80; --erro-fundo: #3a1714; --telefone: #000000; color-scheme: dark; } }
:root[data-theme="dark"] {
  --fundo: #0c121d; --papel: #131c2b; --tinta: #e8ecf3; --suave: #9aa6bb; --linha: #253148;
  --ouro: #d9b545; --ouro-fundo: #2c2715; --ok: #6fd3a0; --ok-fundo: #15301f; --pend: #f0b45c; --pend-fundo: #33260f;
  --erro: #ff8a80; --erro-fundo: #3a1714; --telefone: #000000; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--fundo); color: var(--tinta); font: 400 1rem/1.55 var(--texto); margin: 0; }
.pagina { max-width: 1180px; margin: 0 auto; padding-block: 2rem 4rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.topo { display: grid; gap: .75rem; margin-bottom: 2rem; }
.rotulo { font: 600 .75rem/1 var(--texto); letter-spacing: .12em; text-transform: uppercase; color: var(--ouro); }
h1 { font: 800 clamp(1.9rem, 4.5vw, 3rem)/1.1 var(--display); margin: 0; text-wrap: balance; }
.meta { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; color: var(--suave); font-size: .9rem; }
.meta b { color: var(--tinta); font-weight: 600; }
.grade { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 2.5rem; align-items: start; }
.player { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 1rem); display: grid; gap: .75rem; }
.telefone { background: var(--telefone); border-radius: 28px; padding: 10px; box-shadow: 0 20px 50px rgba(10, 20, 40, .25); }
.telefone canvas { display: block; width: 100%; aspect-ratio: 9 / 16; border-radius: 20px; background: #0b1626; cursor: pointer; }
.controles { display: grid; grid-template-columns: auto 1fr auto; gap: .75rem; align-items: center; }
.controles button, .ver, .copiar { font: 600 .85rem/1 var(--texto); color: var(--tinta); background: var(--papel);
  border: 1px solid var(--linha); border-radius: 999px; padding: .55rem .9rem; cursor: pointer; }
.controles button:hover, .ver:hover, .copiar:hover { border-color: var(--ouro); color: var(--ouro); }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--ouro); outline-offset: 2px; }
#barra { width: 100%; accent-color: var(--ouro); }
.tempo { font: 500 .8rem/1 var(--mono); color: var(--suave); font-variant-numeric: tabular-nums; }
.nota { font-size: .8rem; color: var(--suave); margin: 0; }
.coluna { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; min-width: 0; }
h2 { font: 700 1.35rem/1.2 var(--display); margin: 0 0 1rem; }
.cenas { display: grid; gap: .75rem; }
.cena { background: var(--papel); border: 1px solid var(--linha); border-radius: 14px; padding: 1rem 1.15rem; transition: border-color .2s; }
.cena.ativa { border-color: var(--ouro); box-shadow: 0 0 0 3px var(--ouro-fundo); }
.cena header { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
.num { font: 800 1.1rem/1 var(--display); color: var(--ouro); min-width: 1.2rem; }
.tipo { font: 600 .72rem/1 var(--texto); letter-spacing: .1em; text-transform: uppercase; }
.tc { font: 500 .78rem/1 var(--mono); color: var(--suave); font-variant-numeric: tabular-nums; }
.ver { margin-left: auto; padding: .4rem .75rem; font-size: .78rem; }
.corpo { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.25rem; }
h3 { font: 600 .7rem/1 var(--texto); letter-spacing: .1em; text-transform: uppercase; color: var(--suave); margin: 0 0 .45rem; }
blockquote { margin: 0; font: 400 1.05rem/1.5 var(--display); font-style: italic; }
dl { margin: 0; display: grid; gap: .4rem; font-size: .88rem; }
dl div { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: .5rem; }
dt { color: var(--suave); }
dd { margin: 0; overflow-wrap: anywhere; }
.itens { margin: 0; padding-left: 1.1rem; }
.vazio { margin: 0; font-size: .88rem; color: var(--suave); }
code { font: 500 .85em var(--mono); }
.tabela { overflow-x: auto; background: var(--papel); border: 1px solid var(--linha); border-radius: 14px; }
table { border-collapse: collapse; width: 100%; font-size: .88rem; min-width: 560px; }
th, td { text-align: left; padding: .75rem 1rem; border-bottom: 1px solid var(--linha); vertical-align: top; }
th { font: 600 .7rem/1 var(--texto); letter-spacing: .1em; text-transform: uppercase; color: var(--suave); }
tr:last-child td { border-bottom: 0; }
a { color: var(--ouro); }
.chip { display: inline-block; font: 600 .72rem/1 var(--texto); padding: .35rem .55rem; border-radius: 999px; white-space: nowrap; }
.chip.ok { color: var(--ok); background: var(--ok-fundo); }
.chip.pend { color: var(--pend); background: var(--pend-fundo); }
.chip.erro { color: var(--erro); background: var(--erro-fundo); }
.avisos { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; font-size: .9rem; }
.post { background: var(--papel); border: 1px solid var(--linha); border-radius: 14px; padding: 1rem 1.15rem; display: grid; gap: .75rem; }
.post pre { margin: 0; white-space: pre-wrap; font: 400 .95rem/1.55 var(--texto); }
.copiar { justify-self: start; }
.resumo { padding: .9rem 1.1rem; border-radius: 12px; background: var(--pend-fundo); color: var(--pend); font-size: .92rem; }
.resumo.ok { background: var(--ok-fundo); color: var(--ok); }
@media (max-width: 860px) {
  .grade { grid-template-columns: minmax(0, 1fr); }
  .player { position: static; max-width: 340px; width: 100%; margin: 0 auto; }
  .corpo { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .cena { transition: none; } }
</style>

<div class="pagina">
  <header class="topo">
    <span class="rotulo">Roteiro para aprovação · ${esc(roteiro.area || 'Direito')}</span>
    <h1>${esc(roteiro.titulo)}</h1>
    <div class="meta">
      <span><b>${tl.cenas.length}</b> cenas</span>
      <span>Duração estimada <b>${Math.round(tl.duracao)} s</b></span>
      <span>Tema <b>${esc(roteiro.tema || tl.marca.tema_padrao || 'toga')}</b></span>
      <span>Público <b>${esc(roteiro.publico || 'geral')}</b></span>
      <span>Perfil <b>${esc(tl.marca.arroba || '')}</b></span>
    </div>
  </header>

  <div class="grade">
    <aside class="player" aria-label="Prévia animada">
      <div class="telefone"><canvas id="saida" width="1080" height="1920" aria-label="Prévia do vídeo"></canvas></div>
      <div class="controles">
        <button type="button" id="tocar">Pausar</button>
        <input type="range" id="barra" min="0" max="${tl.duracao.toFixed(2)}" step="0.05" value="0" aria-label="Posição no vídeo">
        <span class="tempo" id="tempo">00:00</span>
      </div>
      <p class="nota">Prévia sem narração, com o tempo de fala estimado. No vídeo final a voz define o ritmo.</p>
    </aside>

    <main class="coluna">
      <section>
        <div class="resumo ${pendentes || erros.length ? '' : 'ok'}">${
          erros.length ? `${erros.length} erro(s) no roteiro. Corrija antes de renderizar.`
            : pendentes ? `${pendentes} de ${fontes.length} fontes ainda precisam ser conferidas no texto oficial antes de publicar.`
            : 'Fontes conferidas. Roteiro pronto para render.'}</div>
      </section>

      <section>
        <h2>Cena a cena</h2>
        <div class="cenas">${cenasHtml}
        </div>
      </section>

      <section>
        <h2>Fontes</h2>
        <div class="tabela"><table>
          <thead><tr><th>Afirmação no vídeo</th><th>Base legal</th><th>Status</th></tr></thead>
          <tbody>${fontesHtml}
          </tbody>
        </table></div>
      </section>

      <section>
        <h2>Texto do post</h2>
        <div class="post">
          <pre id="textoPost">${esc(post)}</pre>
          <button type="button" class="copiar" id="copiar">Copiar texto</button>
        </div>
      </section>

      ${avisosHtml ? `<section><h2>Revisão automática</h2><ul class="avisos">${avisosHtml}</ul></section>` : ''}
    </main>
  </div>
</div>

<script>
window.__MODO__ = 'embutido';
window.__FONTES_EXTERNAS__ = true;
window.__TIMELINE__ = ${JSON.stringify(tlPagina).replace(/</g, '\\u003c')};
</script>
<script type="module">
${motorEmbutido()}

// ---- controles da página ----
const botao = document.getElementById('tocar');
const barra = document.getElementById('barra');
const tempo = document.getElementById('tempo');
const cartoes = [...document.querySelectorAll('.cena')];
const fmt = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
let arrastando = false;
botao.addEventListener('click', () => (window.estudio.pausado ? window.estudio.tocar() : window.estudio.pausar()));
barra.addEventListener('input', () => { arrastando = true; window.estudio.irPara(Number(barra.value)); });
barra.addEventListener('change', () => { arrastando = false; });
document.querySelectorAll('.ver').forEach((b) => b.addEventListener('click', () => {
  window.estudio.irPara(Number(b.dataset.t) + 0.01);
  window.estudio.tocar();
  if (matchMedia('(max-width: 860px)').matches) document.querySelector('.player').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
let ativa = -1;
window.estudio.aoTempo((t, pausado) => {
  botao.textContent = pausado ? 'Tocar' : 'Pausar';
  if (!arrastando) barra.value = t.toFixed(2);
  tempo.textContent = fmt(t);
  const i = cartoes.findIndex((c) => t >= Number(c.dataset.inicio) && t < Number(c.dataset.fim));
  if (i !== ativa) { cartoes[ativa]?.classList.remove('ativa'); cartoes[i]?.classList.add('ativa'); ativa = i; }
});
document.getElementById('copiar').addEventListener('click', async (e) => {
  const texto = document.getElementById('textoPost').textContent;
  try { await navigator.clipboard.writeText(texto); e.target.textContent = 'Copiado'; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById('textoPost')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.target.textContent = 'Texto selecionado: copie com Ctrl+C'; }
  setTimeout(() => { e.target.textContent = 'Copiar texto'; }, 2500);
});
</script>
`;

const destino = path.join(out, 'roteiro.html');
fs.writeFileSync(destino, html);
console.log(`Página de revisão: ${path.relative(process.cwd(), destino)}`);
if (erros.length) console.log(`${erros.length} erro(s) no roteiro (aparecem na página).`);
