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

function area() {
  if (modo === 'carrossel') return { x: 90 * S, y: 130 * S, w: W - 180 * S, h: H * 0.62 };
  return { x: 80 * S, y: H * 0.115, w: W - 160 * S, h: H * 0.58 };
}

function fundo(c2, t) {
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
    ctx: c2, u, d: cena.dur, p: cena, W, H, S, area: area(), tema, marca, modo,
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

function desenharCena(c2, cena, u) {
  const def = CENAS[cena.tipo];
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

function moldura(t) {
  // barra de progresso e @ no topo
  ctx.save();
  ctx.fillStyle = comAlpha(tema.texto, 0.12);
  ctx.fillRect(80 * S, 70 * S, W - 160 * S, 6 * S);
  ctx.fillStyle = tema.destaque;
  ctx.fillRect(80 * S, 70 * S, (W - 160 * S) * clamp(t / timeline.duracao), 6 * S);
  fonte(ctx, 30 * S, 700, tema.fonteTexto);
  ctx.fillStyle = comAlpha(tema.texto, 0.75);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(marca.arroba || '', W / 2, 100 * S);
  // aviso jurídico no fim
  const ultima = timeline.cenas[timeline.cenas.length - 1];
  if (marca.aviso && t > ultima.inicio + 0.6) {
    ctx.globalAlpha = easeOut((t - ultima.inicio - 0.6) / 0.5);
    fonte(ctx, 28 * S, 500, tema.fonteTexto);
    ctx.fillStyle = comAlpha(tema.texto, 0.7);
    const ls = quebrar(ctx, marca.aviso, W - 200 * S);
    ls.forEach((l, i) => ctx.fillText(l.palavras.map((p) => p.txt).join(' '), W / 2, H * 0.9 + i * 38 * S));
  }
  ctx.restore();
}

/** Desenha o instante t (segundos) do vídeo. */
function desenhar(t, { comLegenda = true } = {}) {
  fundo(ctx, t);
  const i = cenaEm(t);
  const cena = timeline.cenas[i];
  const u = t - cena.inicio;
  // cena anterior saindo
  if (i > 0 && u < TRANS) {
    const ant = timeline.cenas[i - 1];
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
  const k = i === 0 ? 1 : easeOut(u / TRANS);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 80 * S);
  ctx.drawImage(camada, 0, 0);
  ctx.restore();
  moldura(t);
  if (comLegenda) legendas(t);
}

/** Slide de carrossel: a cena i em estado final, com o texto da fala de apoio. */
function slide(i) {
  const n = timeline.cenas.length;
  const cena = timeline.cenas[i];
  fundo(ctx, 0);
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
