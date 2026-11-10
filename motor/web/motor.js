// Motor do vídeo: lê a timeline, desenha qualquer instante t num canvas e
// expõe window.estudio para o render (Playwright) e para a prévia no navegador.
import { criar3D } from './tres.js';
import { CENAS } from './cenas.js';
import { clamp, easeOut, fonte, retangulo, comAlpha, aleatorio, quebrar } from './util.js';

const qs = new URLSearchParams(location.search);
// video | preview | carrossel | embutido (página HTML de revisão, ver motor/html.mjs)
const modo = window.__MODO__ || qs.get('modo') || 'video';
const timeline = window.__TIMELINE__ ?? await (await fetch(qs.get('timeline'), { cache: 'no-store' })).json();
const { tema, marca } = timeline;

const W = modo === 'carrossel' ? timeline.carrossel.w : timeline.w;
const H = modo === 'carrossel' ? timeline.carrossel.h : timeline.h;
const S = W / 1080;

// ---------- fontes locais ----------
const FS = '/node_modules/@fontsource';
const fontes = [
  ['Inter', `${FS}/inter/files/inter-latin-400-normal.woff2`, '400', 'normal'],
  ['Inter', `${FS}/inter/files/inter-latin-500-normal.woff2`, '500', 'normal'],
  ['Inter', `${FS}/inter/files/inter-latin-600-normal.woff2`, '600', 'normal'],
  ['Inter', `${FS}/inter/files/inter-latin-700-normal.woff2`, '700', 'normal'],
  ['Inter', `${FS}/inter/files/inter-latin-800-normal.woff2`, '800', 'normal'],
  ['Playfair Display', `${FS}/playfair-display/files/playfair-display-latin-400-normal.woff2`, '400', 'normal'],
  ['Playfair Display', `${FS}/playfair-display/files/playfair-display-latin-700-normal.woff2`, '700', 'normal'],
  ['Playfair Display', `${FS}/playfair-display/files/playfair-display-latin-800-normal.woff2`, '800', 'normal'],
  ['Playfair Display', `${FS}/playfair-display/files/playfair-display-latin-400-italic.woff2`, '400', 'italic'],
  ...['300', '400', '500', '600', '700', '800'].map((w) => ['Montserrat', `${FS}/montserrat/files/montserrat-latin-${w}-normal.woff2`, w, 'normal']),
];
if (window.__FONTES_EXTERNAS__) {
  // página de revisão: as fontes vêm do Google Fonts, só espera carregarem
  await Promise.all(fontes.map(([fam, , weight, style]) => document.fonts.load(`${style} ${weight} 40px "${fam}"`)));
} else {
  await Promise.all(fontes.map(async ([fam, url, weight, style]) => {
    const f = new FontFace(fam, `url(${url})`, { weight, style });
    document.fonts.add(await f.load());
  }));
}

// ---------- logo do escritório (marca.json: logo e monograma) ----------
async function carregarImagem(dado, caminho) {
  const src = dado || (caminho ? '/' + caminho.replace(/^\//, '') : null);
  if (!src) return null;
  const img = new Image();
  img.src = src;
  try { await img.decode(); return img; } catch { return null; }
}
marca.imgLogo = await carregarImagem(marca.logoData, marca.logo);
marca.imgMono = await carregarImagem(marca.monogramaData, marca.monograma);
marca.imgMonoPapel = await carregarImagem(marca.monogramaPapelData, marca.monograma_papel);

// ---------- canvases ----------
const saida = document.getElementById('saida');
saida.width = W;
saida.height = H;
const ctx = saida.getContext('2d');
const camada = document.createElement('canvas');
camada.width = W;
camada.height = H;
const cctx = camada.getContext('2d');
const g3 = criar3D(tema);

// textura de grão, gerada uma vez
const grao = document.createElement('canvas');
grao.width = grao.height = 256;
{
  const g = grao.getContext('2d');
  const img = g.createImageData(256, 256);
  const rnd = aleatorio(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 18;
  }
  g.putImageData(img, 0, 0);
}

// textura de papel amassado, gerada uma vez (fundo claro: cena.fundo = 'papel')
const papel = document.createElement('canvas');
papel.width = W;
papel.height = H;
{
  const g = papel.getContext('2d');
  const rnd = aleatorio(31);
  g.fillStyle = tema.paletaPapel?.bg?.[0] || '#ECEBE7';
  g.fillRect(0, 0, W, H);
  // facetas do amassado
  for (let i = 0; i < 260; i++) {
    const cx = rnd() * W, cy = rnd() * H, r = (80 + rnd() * 260) * S;
    g.beginPath();
    for (let j = 0; j < 3; j++) {
      const a = rnd() * Math.PI * 2;
      g[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * 0.035})` : `rgba(255,255,255,${rnd() * 0.12})`;
    g.fill();
  }
  // vincos: linha escura com brilho ao lado
  for (let i = 0; i < 70; i++) {
    let x = rnd() * W, y = rnd() * H;
    const pts = [[x, y]];
    for (let j = 0; j < 3; j++) { x += (rnd() - 0.5) * 380 * S; y += (rnd() - 0.5) * 380 * S; pts.push([x, y]); }
    for (const [cor, dx] of [[`rgba(0,0,0,${0.04 + rnd() * 0.06})`, 0], [`rgba(255,255,255,${0.25 + rnd() * 0.3})`, 2 * S]]) {
      g.beginPath();
      pts.forEach(([px, py], k) => g[k ? 'lineTo' : 'moveTo'](px + dx, py + dx));
      g.strokeStyle = cor;
      g.lineWidth = (1 + rnd()) * S;
      g.stroke();
    }
  }
  g.fillStyle = g.createPattern(grao, 'repeat');
  g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(60,50,30,0.22)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

const temaBase = tema;
const temaPapel = { ...tema, ...(tema.paletaPapel || {}), fundoPapel: true };
const temaDa = (cena) => (cena.fundo === 'papel' ? temaPapel : tema);
const fundoDe = (cena) => (cena.fundo === 'papel' ? 'papel' : 'escuro');

function area() {
  if (modo === 'carrossel') return { x: 90 * S, y: 130 * S, w: W - 180 * S, h: H * 0.62 };
  return { x: 80 * S, y: H * 0.115, w: W - 160 * S, h: H * 0.58 };
}

function fundo(c2, t, tema = temaBase) {
  if (tema.fundoPapel) {
    // papel com leve deriva, para não parecer estático
    const dx = Math.sin(t * 0.3) * 6 * S, dy = Math.cos(t * 0.25) * 6 * S;
    c2.drawImage(papel, -10 * S + dx, -10 * S + dy, W + 20 * S, H + 20 * S);
    return;
  }
  const g = c2.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, tema.bg[0]);
  g.addColorStop(1, tema.bg[1]);
  c2.fillStyle = g;
  c2.fillRect(0, 0, W, H);
  c2.save();
  if (tema.padrao === 'linhas') {
    c2.strokeStyle = comAlpha(tema.texto, 0.035);
    c2.lineWidth = 2 * S;
    const passo = 90 * S;
    const off = (t * 12 * S) % passo;
    for (let x = -H; x < W + H; x += passo) {
      c2.beginPath();
      c2.moveTo(x + off, 0);
      c2.lineTo(x + off + H * 0.5, H);
      c2.stroke();
    }
  } else if (tema.padrao === 'grade') {
    c2.strokeStyle = comAlpha(tema.texto, 0.05);
    c2.lineWidth = 2 * S;
    const passo = 72 * S;
    const off = (t * 8 * S) % passo;
    for (let x = -passo; x < W + passo; x += passo) { c2.beginPath(); c2.moveTo(x + off, 0); c2.lineTo(x + off, H); c2.stroke(); }
    for (let y = -passo; y < H + passo; y += passo) { c2.beginPath(); c2.moveTo(0, y + off); c2.lineTo(W, y + off); c2.stroke(); }
  }
  c2.fillStyle = c2.createPattern(grao, 'repeat');
  c2.fillRect(0, 0, W, H);
  const v = c2.createRadialGradient(W / 2, H * 0.42, H * 0.2, W / 2, H * 0.5, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${tema.vinheta ?? 0.35})`);
  c2.fillStyle = v;
  c2.fillRect(0, 0, W, H);
  c2.restore();
}

function contexto(c2, cena, u) {
  const c = {
    ctx: c2, u, d: cena.dur, p: cena, W, H, S, area: area(), tema: temaDa(cena), marca, modo,
    tres(nome, x, y, tam, extra) {
      const r = g3.render(nome, u, cena.dur, cena, extra);
      c2.drawImage(g3.canvas, x, y, tam, tam);
      return {
        obj: r.obj,
        projetar: (v) => { const q = r.projetar(v); return { x: x + q.x * tam, y: y + q.y * tam }; },
      };
    },
  };
  return c;
}

function desenharCena(c2, cena, u, comFundo = false) {
  const def = CENAS[cena.tipo];
  if (comFundo) fundo(c2, cena.inicio + u, temaDa(cena));
  c2.save();
  if (!def) {
    fonte(c2, 40 * S, 700, tema.fonteTexto);
    c2.fillStyle = tema.alerta;
    c2.fillText(`Cena desconhecida: ${cena.tipo}`, 80 * S, H / 2);
  } else def.desenhar(contexto(c2, cena, u));
  c2.restore();
}

const TRANS = 0.35;

function cenaEm(t) {
  const cenas = timeline.cenas;
  let i = cenas.findIndex((c) => t < c.inicio + c.dur);
  if (i < 0) i = cenas.length - 1;
  return i;
}

function legendas(t) {
  if (timeline.legenda === false) return;
  const i = cenaEm(t);
  const cena = timeline.cenas[i];
  if (cena.legenda === false || cena.tipo === 'tipografia') return;
  const grupos = cena.grupos || [];
  const g = grupos.find((gr) => t >= gr.t0 - 0.05 && t < gr.t1 + 0.12) ;
  if (!g) return;
  const px = 66 * S;
  fonte(ctx, px, 800, tema.fonteTexto);
  const espaco = ctx.measureText(' ').width;
  const larguras = g.palavras.map((p) => ctx.measureText(p.p).width);
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (g.palavras.length - 1);
  let x = (W - total) / 2;
  const y = H * 0.80;
  const kIn = easeOut((t - g.t0 + 0.05) / 0.18);
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.globalAlpha = kIn;
  g.palavras.forEach((p, idx) => {
    const ativa = t >= p.t0 && t < p.t1 + 0.05;
    const dita = t >= p.t0;
    const w = larguras[idx];
    if (ativa) {
      ctx.save();
      retangulo(ctx, x - 14 * S, y - px * 0.68, w + 28 * S, px * 1.36, 18 * S);
      ctx.fillStyle = tema.destaque;
      ctx.fill();
      ctx.restore();
    }
    ctx.lineWidth = 12 * S;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    if (!ativa) ctx.strokeText(p.p, x, y);
    ctx.fillStyle = ativa ? tema.textoSobreDestaque : dita ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.fillText(p.p, x, y);
    x += w + espaco;
  });
  ctx.restore();
}

function moldura(t, tema) {
  // barra de progresso e @ no topo
  ctx.save();
  const mono = tema.fundoPapel && marca.imgMonoPapel ? marca.imgMonoPapel : marca.imgMono;
  ctx.fillStyle = comAlpha(tema.texto, 0.12);
  ctx.fillRect(80 * S, 70 * S, W - 160 * S, 6 * S);
  ctx.fillStyle = tema.destaque;
  ctx.fillRect(80 * S, 70 * S, (W - 160 * S) * clamp(t / timeline.duracao), 6 * S);
  fonte(ctx, 30 * S, 700, tema.fonteTexto);
  ctx.fillStyle = comAlpha(tema.texto, 0.75);
  ctx.textBaseline = 'top';
  if (mono) {
    // logo à esquerda e @ à direita, como nos posts
    const mh = 58 * S, mw = mh * mono.width / mono.height;
    ctx.drawImage(mono, 80 * S, 96 * S, mw, mh);
    ctx.textAlign = 'right';
    ctx.fillText(marca.arroba || '', W - 80 * S, 114 * S);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(marca.arroba || '', W / 2, 100 * S);
  }
  // aviso jurídico no fim
  const ultima = timeline.cenas[timeline.cenas.length - 1];
  if (marca.aviso && t > ultima.inicio + 0.6) {
    ctx.globalAlpha = easeOut((t - ultima.inicio - 0.6) / 0.5);
    fonte(ctx, 28 * S, 500, tema.fonteTexto);
    ctx.textAlign = 'center';
    ctx.fillStyle = comAlpha(tema.texto, 0.7);
    const ls = quebrar(ctx, marca.aviso, W - 200 * S);
    ls.forEach((l, i) => ctx.fillText(l.palavras.map((p) => p.txt).join(' '), W / 2, H * 0.9 + i * 38 * S));
  }
  ctx.restore();
}

// ---------- transições ----------

/** Borda de papel rasgado na altura y (determinística por cena). */
function bordaRasgo(seed, y) {
  const rnd = aleatorio(seed * 97 + 13);
  const pts = [];
  for (let x = -20 * S; x <= W + 20 * S; x += 22 * S) pts.push([x, y + (rnd() - 0.5) * 34 * S + Math.sin(x / (140 * S) + seed) * 14 * S]);
  return pts;
}

function rasgo(i, ant, cena, u, dur) {
  const k = easeInOut(u / dur);
  const y = H * 1.06 - k * H * 1.2;
  // cena anterior, inteira
  desenharCena(ctx, ant, ant.dur + u, true);
  // cena nova sobe por baixo da borda rasgada
  cctx.clearRect(0, 0, W, H);
  desenharCena(cctx, cena, u, true);
  const borda = bordaRasgo(i, y);
  ctx.save();
  ctx.beginPath();
  borda.forEach(([x, yy], j) => ctx[j ? 'lineTo' : 'moveTo'](x, yy));
  ctx.lineTo(W + 20 * S, H + 20 * S);
  ctx.lineTo(-20 * S, H + 20 * S);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(camada, 0, 0);
  ctx.restore();
  // faixa de fibra branca na borda, com sombra
  const rnd = aleatorio(i * 31 + 7);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24 * S;
  ctx.shadowOffsetY = -6 * S;
  ctx.beginPath();
  borda.forEach(([x, yy], j) => ctx[j ? 'lineTo' : 'moveTo'](x, yy));
  for (let j = borda.length - 1; j >= 0; j--) ctx.lineTo(borda[j][0], borda[j][1] + (8 + rnd() * 16) * S);
  ctx.closePath();
  ctx.fillStyle = '#F6F4EF';
  ctx.fill();
  ctx.restore();
}

/** Clarão de luz (vazamento de filme). v = segundos em relação ao corte (negativo = antes). */
function clarao(v) {
  const a = v < 0 ? Math.exp(-Math.pow(v / 0.18, 2)) : Math.exp(-v / 0.22);
  if (a < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(W * 0.85, H * 0.25, 0, W * 0.85, H * 0.25, H * 0.95);
  g.addColorStop(0, `rgba(255,236,190,${a})`);
  g.addColorStop(0.35, `rgba(255,170,80,${a * 0.85})`);
  g.addColorStop(0.7, `rgba(210,80,60,${a * 0.5})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(255,238,205,${a * 0.55})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function tipoTransicao(ant, cena) {
  if (!ant) return 'nenhuma';
  return cena.transicao || (fundoDe(ant) !== fundoDe(cena) ? 'rasgo' : 'padrao');
}

/** Desenha o instante t (segundos) do vídeo. */
function desenhar(t, { comLegenda = true } = {}) {
  const i = cenaEm(t);
  const cena = timeline.cenas[i];
  const u = t - cena.inicio;
  const ant = i > 0 ? timeline.cenas[i - 1] : null;
  const prox = timeline.cenas[i + 1];
  const trans = tipoTransicao(ant, cena);
  const DUR_RASGO = 0.75;
  if (trans === 'rasgo' && u < DUR_RASGO) {
    rasgo(i, ant, cena, u, DUR_RASGO);
  } else {
    fundo(ctx, t, temaDa(cena));
    const mesmoFundo = ant && fundoDe(ant) === fundoDe(cena);
    const suave = mesmoFundo && trans !== 'corte' && u < TRANS;
    if (suave) {
      cctx.clearRect(0, 0, W, H);
      desenharCena(cctx, ant, ant.dur + u);
      ctx.save();
      const k = easeOut(u / TRANS);
      ctx.globalAlpha = 1 - k;
      ctx.translate(0, -k * 60 * S);
      ctx.drawImage(camada, 0, 0);
      ctx.restore();
    }
    cctx.clearRect(0, 0, W, H);
    desenharCena(cctx, cena, u);
    const k = suave ? easeOut(u / TRANS) : 1;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 80 * S);
    ctx.drawImage(camada, 0, 0);
    ctx.restore();
  }
  if (trans === 'luz') clarao(u);
  if (prox && tipoTransicao(cena, prox) === 'luz') clarao(-(cena.dur - u));
  // durante o rasgo, o topo ainda é da cena anterior até a borda passar
  const bordaY = H * 1.06 - easeInOut(u / DUR_RASGO) * H * 1.2;
  const temaTopo = trans === 'rasgo' && u < DUR_RASGO && bordaY > 170 * S ? temaDa(ant) : temaDa(cena);
  moldura(t, temaTopo);
  if (comLegenda) legendas(t);
}

/** Slide de carrossel: a cena i em estado final, com o texto da fala de apoio. */
function slide(i) {
  const n = timeline.cenas.length;
  const cena = timeline.cenas[i];
  const tema = temaDa(cena);
  fundo(ctx, 0, tema);
  cctx.clearRect(0, 0, W, H);
  desenharCena(cctx, cena, Math.max(cena.dur, 4));
  ctx.drawImage(camada, 0, 0);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  fonte(ctx, 28 * S, 700, tema.fonteTexto);
  ctx.fillStyle = comAlpha(tema.texto, 0.75);
  ctx.fillText(marca.arroba || '', W / 2, 50 * S);
  const apoio = cena.apoio ?? (cena.tipo === 'abertura' || cena.tipo === 'encerramento' ? '' : cena.fala);
  if (apoio) {
    fonte(ctx, 38 * S, 500, tema.fonteTexto);
    ctx.fillStyle = tema.texto;
    const ls = quebrar(ctx, apoio, W - 200 * S);
    const y0 = H - 110 * S - ls.length * 52 * S;
    ls.forEach((l, li) => ctx.fillText(l.palavras.map((p) => p.txt).join(' '), W / 2, y0 + li * 52 * S));
  }
  fonte(ctx, 26 * S, 700, tema.fonteTexto);
  ctx.fillStyle = comAlpha(tema.texto, 0.55);
  ctx.textAlign = 'right';
  ctx.fillText(i === 0 ? `${i + 1}/${n}  ARRASTE →` : `${i + 1}/${n}`, W - 70 * S, H - 70 * S);
  if (i === n - 1 && marca.aviso) {
    ctx.textAlign = 'left';
    fonte(ctx, 24 * S, 500, tema.fonteTexto);
    const ls = quebrar(ctx, marca.aviso, W * 0.62);
    ls.forEach((l, li) => ctx.fillText(l.palavras.map((p) => p.txt).join(' '), 70 * S, H - 70 * S - (ls.length - 1 - li) * 32 * S));
  }
  ctx.restore();
}

const jpeg = (q = 0.92) => saida.toDataURL('image/jpeg', q).split(',')[1];
const png = () => saida.toDataURL('image/png').split(',')[1];

window.estudio = {
  timeline,
  quadro(t, q) { desenhar(t); return jpeg(q); },
  capa() {
    const c0 = timeline.cenas[0];
    desenhar(c0.inicio + Math.min(c0.dur - 0.05, 2.6), { comLegenda: false });
    return png();
  },
  slide(i) { slide(i); return png(); },
  pronto: true,
};

// ---------- reprodução ao vivo (prévia e página de revisão) ----------
if (modo === 'preview' || modo === 'embutido') {
  if (modo === 'preview') {
    document.body.style.background = '#111';
    const ajustarTela = () => {
      const k = Math.min(innerWidth / W, innerHeight / H);
      saida.style.transform = `scale(${k})`;
      saida.style.marginLeft = `${(innerWidth - W * k) / 2}px`;
    };
    addEventListener('resize', ajustarTela);
    ajustarTela();
  } else {
    saida.style.width = '100%';
    saida.style.height = 'auto';
  }
  const audio = timeline.audio ? new Audio(timeline.audio) : null;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inicio = performance.now(), pausado = modo === 'embutido' && reduzido, tPausa = 0;
  const ouvintes = [];
  const agora = () => (pausado ? tPausa : ((performance.now() - inicio) / 1000) % timeline.duracao);
  const tocar = () => { if (!pausado) return; inicio = performance.now() - tPausa * 1000; pausado = false; audio?.play().catch(() => {}); };
  const pausar = () => { if (pausado) return; tPausa = agora(); pausado = true; audio?.pause(); };
  const irPara = (t) => {
    t = clamp(t, 0, timeline.duracao - 0.01);
    inicio = performance.now() - t * 1000;
    tPausa = t;
    if (audio) audio.currentTime = t;
  };
  Object.assign(window.estudio, { tocar, pausar, irPara, aoTempo(fn) { ouvintes.push(fn); } });
  Object.defineProperty(window.estudio, 'pausado', { get: () => pausado });
  saida.addEventListener('click', () => (pausado ? tocar() : pausar()));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') irPara(agora() + (e.key === 'ArrowRight' ? 2 : -2));
  });
  let ultimo = -1;
  const laco = () => {
    const t = agora();
    if (audio && !pausado && Math.abs(audio.currentTime - t) > 0.25) audio.currentTime = t;
    if (t !== ultimo) { desenhar(t); ultimo = t; }
    ouvintes.forEach((fn) => fn(t, pausado));
    requestAnimationFrame(laco);
  };
  if (modo === 'preview') audio?.play().catch(() => {});
  if (pausado) tPausa = Math.min(2.6, timeline.cenas[0].dur - 0.05);
  laco();
}
