// Biblioteca de cenas jurídicas. Cada cena recebe o contexto `c`:
//   c.ctx (canvas 2D), c.u (tempo local, s), c.d (duração, s), c.p (parâmetros do roteiro),
//   c.W, c.H, c.S (escala: 1 = 1080 px de largura), c.area {x,y,w,h} (onde desenhar),
//   c.tema, c.marca, c.tres(nome, x, y, tamanho, extra) -> projetar(v3) em px.
import {
  clamp, lerp, easeOut, easeInOut, easeBack, entrada, fonte, quebrar, ajustar,
  retangulo, comAlpha, tracar, formatarNumero,
} from './util.js';

const TITULO = (t) => t.fonteTitulo;
const TEXTO = (t) => t.fonteTexto;

// ---------- peças compartilhadas ----------

function selo(c, texto, cx, y, k = 1) {
  const { ctx, S, tema } = c;
  if (!texto) return 0;
  fonte(ctx, 28 * S, 700, TEXTO(tema));
  const txt = String(texto).toUpperCase();
  ctx.save();
  ctx.letterSpacing = `${4 * S}px`;
  const w = ctx.measureText(txt).width + 56 * S;
  const h = 58 * S;
  ctx.globalAlpha *= k;
  ctx.translate(0, (1 - k) * 20 * S);
  retangulo(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = comAlpha(tema.destaque, 0.14);
  ctx.fill();
  ctx.lineWidth = 2 * S;
  ctx.strokeStyle = comAlpha(tema.destaque, 0.8);
  ctx.stroke();
  ctx.fillStyle = tema.destaque;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, cx, y + h / 2 + 1 * S);
  ctx.restore();
  return h;
}

/** Título com palavras que sobem uma a uma; `destaque` ganha a cor de destaque e sublinhado. */
function tituloAnimado(c, { texto, destaque, x, y, w, max = 96, min = 54, linhas = 4, ini = 0, alinhar = 'center', cor }) {
  const { ctx, S, tema, u } = c;
  const px = ajustar(ctx, texto, w, max * S, min * S, linhas, 800, TITULO(tema));
  const alvo = destaque ? marcarPalavras(texto, destaque) : new Set();
  // peso fino no texto e negrito no destaque quando o tema pede (ex.: tema "eduardo-brito")
  const pesoBase = tema.pesoTitulo ?? 800;
  const pesoDe = (i) => (alvo.has(i) ? 800 : pesoBase);
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const ls = [];
  let atual = { palavras: [], w: 0 };
  palavras.forEach((txt, i) => {
    fonte(ctx, px, pesoDe(i), TITULO(tema));
    const pw = ctx.measureText(txt).width;
    const esp = ctx.measureText(' ').width;
    const quebraAntes = tema.quebraDestaque && alvo.has(i) && !alvo.has(i - 1) && i > 0;
    const novoW = atual.palavras.length ? atual.w + esp + pw : pw;
    if (atual.palavras.length && (novoW > w || quebraAntes)) { ls.push(atual); atual = { palavras: [], w: 0 }; }
    const px0 = atual.palavras.length ? atual.w + esp : 0;
    atual.palavras.push({ txt, x: px0, w: pw, i });
    atual.w = px0 + pw;
  });
  if (atual.palavras.length) ls.push(atual);
  const lh = px * 1.12;
  ls.forEach((linha, li) => {
    const x0 = alinhar === 'center' ? x + (w - linha.w) / 2 : x;
    linha.palavras.forEach((p) => {
      const k = entrada(u, ini + p.i * 0.07, 0.55, easeBack);
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.4);
      ctx.translate(0, (1 - clamp(k)) * 40 * S);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const em = alvo.has(p.i);
      fonte(ctx, px, pesoDe(p.i), TITULO(tema));
      ctx.fillStyle = em ? tema.destaque : (cor || tema.texto);
      ctx.fillText(p.txt, x0 + p.x, y + px + li * lh);
      if (em && tema.sublinhado !== false) {
        const ks = entrada(u, ini + 0.35 + p.i * 0.07, 0.5);
        ctx.fillStyle = tema.destaque;
        ctx.fillRect(x0 + p.x, y + px + li * lh + 12 * S, p.w * ks, 7 * S);
      }
      ctx.restore();
    });
  });
  return ls.length * lh + px * 0.25;
}

/** Índices das palavras de `texto` que fazem parte do trecho `destaque`. */
function marcarPalavras(texto, destaque) {
  const res = new Set();
  if (!destaque) return res;
  const norm = (s) => s.toLowerCase();
  const pos = norm(texto).indexOf(norm(destaque));
  if (pos < 0) return res;
  const fim = pos + destaque.length;
  let cursor = 0;
  String(texto).split(/\s+/).filter(Boolean).forEach((p, i) => {
    const ini = texto.indexOf(p, cursor);
    cursor = ini + p.length;
    if (ini < fim && cursor > pos) res.add(i);
  });
  return res;
}

function paragrafo(c, texto, x, y, w, { px = 42, peso = 500, cor, familia, alinhar = 'left', lh = 1.35, k = 1, estilo } = {}) {
  const { ctx, S, tema } = c;
  fonte(ctx, px * S, peso, familia || TEXTO(tema), estilo);
  const ls = quebrar(ctx, texto, w);
  ctx.save();
  ctx.fillStyle = cor || tema.texto;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ls.forEach((l, i) => {
    const kk = clamp(k * ls.length - i);
    if (kk <= 0) return;
    ctx.globalAlpha = clamp(kk);
    const x0 = alinhar === 'center' ? x + (w - l.w) / 2 : x;
    ctx.fillText(l.palavras.map((p) => p.txt).join(' '), x0, y + px * S + i * px * S * lh);
  });
  ctx.restore();
  return ls.length * px * S * lh;
}

function cartao(c, x, y, w, h, { cor, borda, sombra = true, raio = 28 } = {}) {
  const { ctx, S, tema } = c;
  ctx.save();
  if (sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 40 * S;
    ctx.shadowOffsetY = 16 * S;
  }
  retangulo(ctx, x, y, w, h, raio * S);
  ctx.fillStyle = cor || tema.cartao;
  ctx.fill();
  ctx.restore();
  if (borda) {
    ctx.save();
    retangulo(ctx, x, y, w, h, raio * S);
    ctx.lineWidth = 3 * S;
    ctx.strokeStyle = borda;
    ctx.stroke();
    ctx.restore();
  }
}

function iconeCheck(c, cx, cy, r, k, tipo = 'certo') {
  const { ctx, S, tema } = c;
  const corIcone = tipo === 'errado' ? tema.alerta : tipo === 'numerada' ? tema.destaque : tema.ok;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 2);
  ctx.beginPath();
  ctx.arc(cx, cy, r * easeBack(k), 0, Math.PI * 2);
  ctx.fillStyle = comAlpha(corIcone, 0.18);
  ctx.fill();
  ctx.lineWidth = 3 * S;
  ctx.strokeStyle = corIcone;
  ctx.stroke();
  ctx.lineWidth = 7 * S;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = corIcone;
  const kt = clamp((k - 0.3) / 0.7);
  if (tipo === 'numerada') {
    // o número é desenhado pela própria cena
  } else if (tipo === 'errado') {
    tracar(ctx, [[cx - r * 0.35, cy - r * 0.35], [cx + r * 0.35, cy + r * 0.35]], kt * 2);
    tracar(ctx, [[cx + r * 0.35, cy - r * 0.35], [cx - r * 0.35, cy + r * 0.35]], kt * 2 - 1);
  } else {
    tracar(ctx, [[cx - r * 0.4, cy + r * 0.02], [cx - r * 0.1, cy + r * 0.32], [cx + r * 0.42, cy - r * 0.3]], kt);
  }
  ctx.restore();
}

function ondas(c, x, y, u0, cor) {
  const { ctx, S, u } = c;
  const v = u - u0;
  if (v < 0 || v > 1.4) return;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const k = clamp((v - i * 0.12) / 0.9);
    if (k <= 0) continue;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.lineWidth = (10 - i * 3) * S;
    ctx.strokeStyle = cor;
    ctx.beginPath();
    ctx.ellipse(x, y, 140 * S + k * 380 * S, (40 + k * 110) * S, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- cenas ----------

export const CENAS = {
  /** Gancho: martelo 3D bate e o título aparece. {kicker, titulo, destaque} */
  abertura: {
    obrigatorios: ['titulo'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      const cx = area.x + area.w / 2;
      let y = area.y;
      y += selo(c, p.kicker, cx, y, entrada(u, 0.05)) + 10 * S;
      const tam = Math.min(area.w * 0.95, area.h * 0.5);
      const proj = c.tres('martelo', cx - tam / 2, y + 10 * S, tam);
      const impacto = proj.projetar(proj.obj.pontoImpacto);
      if (u > proj.obj.golpe && u < proj.obj.golpe + 0.12) {
        ctx.save();
        ctx.globalAlpha = 1 - (u - proj.obj.golpe) / 0.12;
        ctx.fillStyle = comAlpha(tema.destaque, 0.25);
        ctx.fillRect(0, 0, c.W, c.H);
        ctx.restore();
      }
      ondas(c, impacto.x, impacto.y, proj.obj.golpe, tema.destaque);
      y += tam * 0.82;
      tituloAnimado(c, { texto: p.titulo, destaque: p.destaque, x: area.x, y, w: area.w, ini: 0.6, max: 100, linhas: 4 });
    },
  },

  /** Texto de lei num papel, digitado, com marca-texto no trecho. {lei, artigo, texto, destaque} */
  artigo: {
    obrigatorios: ['artigo', 'texto'],
    desenhar(c) {
      const { ctx, u, d, p, S, area, tema } = c;
      const k = entrada(u, 0, 0.6, easeBack);
      const pad = 56 * S;
      const w = area.w;
      const larguraTexto = w - pad * 2;
      const pxT = ajustar(ctx, p.texto, larguraTexto, 46 * S, 30 * S, 9, 400, TITULO(tema));
      const linhas = quebrar(ctx, p.texto, larguraTexto);
      const lh = pxT * 1.5;
      const h = pad * 2 + 60 * S + 90 * S + 40 * S + linhas.length * lh;
      const x = area.x, y = area.y + Math.max(0, (area.h - h) / 2);
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.5);
      ctx.translate(x + w / 2, y + h / 2 + (1 - k) * 80 * S);
      ctx.rotate((1 - k) * -0.06 + Math.sin(u * 0.8) * 0.004);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      cartao(c, x, y, w, h, { cor: tema.papel, raio: 10 });
      // margem vermelha e pautas de papel
      ctx.save();
      retangulo(ctx, x, y, w, h, 10 * S);
      ctx.clip();
      ctx.strokeStyle = comAlpha(tema.tinta, 0.06);
      ctx.lineWidth = 2 * S;
      for (let yy = y + pad + 190 * S; yy < y + h; yy += lh) {
        ctx.beginPath(); ctx.moveTo(x, yy + 10 * S); ctx.lineTo(x + w, yy + 10 * S); ctx.stroke();
      }
      fonte(ctx, 420 * S, 400, TITULO(tema));
      ctx.fillStyle = comAlpha(tema.tinta, 0.05);
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('§', x + w - 250 * S, y + 360 * S);
      ctx.restore();

      let yy = y + pad;
      fonte(ctx, 28 * S, 600, TEXTO(tema));
      ctx.save();
      ctx.letterSpacing = `${2 * S}px`;
      ctx.fillStyle = comAlpha(tema.tinta, 0.6);
      ctx.textBaseline = 'top';
      ctx.fillText(String(p.lei || '').toUpperCase(), x + pad, yy);
      ctx.restore();
      yy += 60 * S;
      ajustar(ctx, p.artigo, w - pad * 2, 72 * S, 40 * S, 1, 800, TITULO(tema));
      ctx.fillStyle = tema.tinta;
      ctx.textBaseline = 'top';
      ctx.fillText(p.artigo, x + pad, yy);
      yy += 90 * S;
      ctx.fillStyle = tema.destaque;
      ctx.fillRect(x + pad, yy, 120 * S * entrada(u, 0.3, 0.5), 6 * S);
      yy += 40 * S;

      // digitação + marca-texto
      const fimDigitar = Math.min(d * 0.5, 0.5 + p.texto.length * 0.025);
      const chars = Math.floor(p.texto.length * clamp((u - 0.45) / Math.max(0.3, fimDigitar - 0.45)));
      const alvo = marcarPalavras(p.texto, p.destaque);
      const ordem = [...alvo];
      const kMarca = clamp((u - fimDigitar - 0.15) / 0.9);
      let contador = 0;
      let marcadas = 0;
      fonte(ctx, pxT, 400, TITULO(tema));
      linhas.forEach((linha, li) => {
        const by = yy + li * lh;
        linha.palavras.forEach((pl) => {
          if (alvo.has(pl.i) && kMarca > 0) {
            const idx = ordem.indexOf(pl.i);
            const kk = clamp(kMarca * ordem.length - idx);
            if (kk > 0) {
              ctx.fillStyle = comAlpha(tema.marcaTexto, 0.85);
              ctx.fillRect(x + pad + pl.x - 6 * S, by + pxT * 0.12, (pl.w + 12 * S) * kk, pxT * 1.08);
            }
            marcadas++;
          }
        });
        linha.palavras.forEach((pl) => {
          const visivel = Math.max(0, Math.min(pl.txt.length, chars - contador));
          contador += pl.txt.length + 1;
          if (!visivel) return;
          ctx.fillStyle = tema.tinta;
          fonte(ctx, pxT, alvo.has(pl.i) && kMarca > 0 ? 700 : 400, TITULO(tema));
          ctx.textBaseline = 'top';
          ctx.fillText(pl.txt.slice(0, visivel), x + pad + pl.x, by + pxT * 0.2);
        });
      });
      // cursor
      if (chars < p.texto.length && u > 0.45 && Math.floor(u * 3) % 2 === 0) {
        ctx.fillStyle = tema.tinta;
        ctx.fillRect(x + w - pad, y + h - pad, 4 * S, pxT);
      }
      ctx.restore();
    },
  },

  /** Número grande que conta, com cubos 3D. {numero, prefixo, sufixo, casas, unidade, legenda, cubos} */
  numero: {
    obrigatorios: ['numero'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      const alvo = Number(p.numero);
      const prog = easeOut((u - 0.3) / 1.3);
      const cx = area.x + area.w / 2;
      let y = area.y;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 56, min: 40, linhas: 2 }) + 10 * S;
      if (p.cubos !== false && alvo > 0) {
        const tam = Math.min(area.w, area.h * 0.5);
        c.tres('cubos', cx - tam / 2, y - tam * 0.1, tam, { n: Math.round(alvo), progresso: prog });
        y += tam * 0.82;
      } else y += area.h * 0.15;
      const valor = `${p.prefixo || ''}${formatarNumero(alvo * prog, p.casas || 0)}${p.sufixo || ''}`;
      const kk = entrada(u, 0.2, 0.6, easeBack);
      ctx.save();
      ctx.globalAlpha *= clamp(kk * 1.5);
      const px = ajustar(ctx, valor, area.w, 220 * S, 90 * S, 1, 800, TEXTO(tema));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = tema.texto;
      ctx.translate(cx, y + px * 0.78);
      ctx.scale(0.8 + 0.2 * kk, 0.8 + 0.2 * kk);
      ctx.fillText(valor, 0, 0);
      ctx.restore();
      y += px * 0.95;
      if (p.unidade) {
        fonte(ctx, 50 * S, 800, TEXTO(tema));
        ctx.save();
        ctx.letterSpacing = `${3 * S}px`;
        ctx.globalAlpha *= entrada(u, 0.8);
        ctx.fillStyle = tema.destaque;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(String(p.unidade).toUpperCase(), cx, y + 10 * S);
        ctx.restore();
        y += 90 * S;
      }
      if (p.legenda) {
        ctx.save();
        ctx.globalAlpha *= entrada(u, 1.1);
        paragrafo(c, p.legenda, area.x + 30 * S, y, area.w - 60 * S, { px: 42, cor: tema.suave, alinhar: 'center' });
        ctx.restore();
      }
    },
  },

  /** Balança 3D que pende para um lado. {titulo, esquerda, direita, pende: esquerda|direita|equilibrio, conclusao} */
  balanca: {
    obrigatorios: ['esquerda', 'direita'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      const cx = area.x + area.w / 2;
      let y = area.y;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 64, min: 42, linhas: 2 });
      const tam = Math.min(area.w * 1.05, area.h * 0.62);
      const proj = c.tres('balanca', cx - tam / 2, y - tam * 0.05, tam, null);
      const pratos = proj.obj.pratos().map(proj.projetar);
      const lados = [p.esquerda, p.direita];
      const pesado = p.pende === 'esquerda' ? 0 : p.pende === 'direita' ? 1 : -1;
      pratos.forEach((pt, i) => {
        const k = entrada(u, 0.4 + i * 0.15, 0.5, easeBack);
        const w = area.w * 0.46;
        fonte(ctx, 36 * S, 700, TEXTO(tema));
        const ls = quebrar(ctx, lados[i], w - 40 * S);
        const h = ls.length * 46 * S + 44 * S;
        const x = i === 0 ? Math.min(area.x, pt.x - w / 2) : Math.max(area.x + area.w - w, pt.x - w / 2);
        const yy = pt.y + 18 * S;
        ctx.save();
        ctx.globalAlpha *= clamp(k * 1.5);
        ctx.translate(0, (1 - k) * 30 * S);
        const ganhou = pesado === i && u > 1.2;
        cartao(c, x, yy, w, h, { borda: ganhou ? tema.destaque : comAlpha(tema.texto, 0.15) });
        ctx.fillStyle = ganhou ? tema.destaque : tema.texto;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        fonte(ctx, 36 * S, 700, TEXTO(tema));
        ls.forEach((l, li) => ctx.fillText(l.palavras.map((q) => q.txt).join(' '), x + w / 2, yy + 22 * S + li * 46 * S));
        ctx.restore();
      });
      if (p.conclusao) {
        const yc = Math.max(...pratos.map((q) => q.y)) + 190 * S;
        ctx.save();
        ctx.globalAlpha *= entrada(u, 1.4);
        paragrafo(c, p.conclusao, area.x, yc, area.w, { px: 46, peso: 700, familia: TITULO(tema), alinhar: 'center' });
        ctx.restore();
      }
    },
  },

  /** Lista com ✓, ✗ ou números. {titulo, itens[], estilo: certo|errado|numerada} */
  lista: {
    obrigatorios: ['itens'],
    desenhar(c) {
      const { ctx, u, d, p, S, area, tema } = c;
      let y = area.y;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 74, min: 48, linhas: 2, alinhar: 'left' }) + 20 * S;
      const itens = p.itens || [];
      const passo = Math.min(0.7, Math.max(0.25, (d - 1.2) / Math.max(1, itens.length)));
      const r = 34 * S;
      itens.forEach((txt, i) => {
        const k = entrada(u, 0.5 + i * passo, 0.5, easeBack);
        if (k <= 0) return;
        fonte(ctx, 42 * S, 600, TEXTO(tema));
        const ls = quebrar(ctx, txt, area.w - r * 2 - 90 * S);
        const h = Math.max(r * 2 + 36 * S, ls.length * 54 * S + 40 * S);
        ctx.save();
        ctx.globalAlpha *= clamp(k * 1.5);
        ctx.translate((1 - k) * -60 * S, 0);
        cartao(c, area.x, y, area.w, h, { sombra: true });
        iconeCheck(c, area.x + 30 * S + r, y + h / 2, r, k, p.estilo);
        if (p.estilo === 'numerada') {
          fonte(ctx, 34 * S, 800, TEXTO(tema));
          ctx.fillStyle = tema.destaque;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), area.x + 30 * S + r, y + h / 2 + 2 * S);
        }
        fonte(ctx, 42 * S, 600, TEXTO(tema));
        ctx.fillStyle = tema.texto;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const ty = y + (h - ls.length * 54 * S) / 2 + 4 * S;
        ls.forEach((l, li) => ctx.fillText(l.palavras.map((q) => q.txt).join(' '), area.x + r * 2 + 60 * S, ty + li * 54 * S));
        ctx.restore();
        y += h + 22 * S;
      });
    },
  },

  /** Linha do tempo com ponto que percorre as etapas. {titulo, etapas:[{titulo, detalhe}]} */
  linha_do_tempo: {
    obrigatorios: ['etapas'],
    desenhar(c) {
      const { ctx, u, d, p, S, area, tema } = c;
      let y = area.y;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 70, min: 46, linhas: 2, alinhar: 'left' }) + 30 * S;
      const etapas = p.etapas || [];
      const n = Math.max(1, etapas.length);
      const alto = area.y + area.h - y - 40 * S;
      const passo = Math.min(260 * S, alto / n);
      const lx = area.x + 46 * S;
      const pontos = etapas.map((_, i) => y + 40 * S + i * passo);
      const tEtapa = (i) => 0.5 + i * Math.min(1.1, (d - 1.2) / n);
      // trilho
      ctx.save();
      ctx.strokeStyle = comAlpha(tema.texto, 0.18);
      ctx.lineWidth = 6 * S;
      ctx.lineCap = 'round';
      tracar(ctx, [[lx, pontos[0]], [lx, pontos[n - 1]]], entrada(u, 0.1, 0.6));
      // trecho percorrido
      const ultimo = etapas.reduce((acc, _, i) => (u >= tEtapa(i) ? i : acc), -1);
      let yDot = pontos[0];
      if (ultimo >= 0) {
        const kSeg = ultimo < n - 1 ? easeInOut((u - tEtapa(ultimo)) / (tEtapa(ultimo + 1) - tEtapa(ultimo))) : 0;
        yDot = ultimo < n - 1 ? lerp(pontos[ultimo], pontos[ultimo + 1], kSeg) : pontos[n - 1];
        ctx.strokeStyle = tema.destaque;
        tracar(ctx, [[lx, pontos[0]], [lx, yDot]], 1);
      }
      ctx.restore();
      etapas.forEach((e, i) => {
        const k = entrada(u, tEtapa(i), 0.5, easeBack);
        const cy = pontos[i];
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, cy, 22 * S, 0, Math.PI * 2);
        ctx.fillStyle = k > 0 ? tema.destaque : tema.bloco;
        ctx.fill();
        ctx.lineWidth = 5 * S;
        ctx.strokeStyle = tema.bg[0];
        ctx.stroke();
        if (k > 0) {
          ctx.globalAlpha *= clamp(k * 1.5);
          ctx.translate((1 - k) * 50 * S, 0);
          fonte(ctx, 50 * S, 800, TITULO(tema));
          ctx.fillStyle = tema.texto;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(e.titulo || '', lx + 60 * S, cy - (e.detalhe ? 18 * S : 0));
          if (e.detalhe) {
            fonte(ctx, 38 * S, 500, TEXTO(tema));
            ctx.fillStyle = tema.suave;
            ctx.textBaseline = 'top';
            ctx.fillText(e.detalhe, lx + 60 * S, cy + 20 * S);
          }
        }
        ctx.restore();
      });
      // ponto que viaja
      ctx.save();
      ctx.shadowColor = tema.destaque;
      ctx.shadowBlur = 30 * S;
      ctx.beginPath();
      ctx.arc(lx, yDot, (12 + 3 * Math.sin(u * 8)) * S, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha *= entrada(u, 0.4);
      ctx.fill();
      ctx.restore();
    },
  },

  /** Cartão de tribunal com trecho de decisão ou súmula. {tribunal, referencia, trecho, data} */
  jurisprudencia: {
    obrigatorios: ['tribunal', 'referencia', 'trecho'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      const cx = area.x + area.w / 2;
      // fachada de tribunal desenhada a traço
      const fw = 360 * S, fh = 250 * S, fx = cx - fw / 2, fy = area.y + 10 * S;
      ctx.save();
      ctx.strokeStyle = tema.destaque;
      ctx.lineWidth = 6 * S;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      tracar(ctx, [[fx, fy + 80 * S], [cx, fy], [fx + fw, fy + 80 * S], [fx, fy + 80 * S]], entrada(u, 0, 0.6));
      for (let i = 0; i < 5; i++) {
        const xx = fx + 40 * S + i * ((fw - 80 * S) / 4);
        tracar(ctx, [[xx, fy + 105 * S], [xx, fy + fh - 40 * S]], entrada(u, 0.25 + i * 0.07, 0.4));
      }
      tracar(ctx, [[fx - 20 * S, fy + fh - 15 * S], [fx + fw + 20 * S, fy + fh - 15 * S]], entrada(u, 0.6, 0.4));
      tracar(ctx, [[fx - 40 * S, fy + fh + 10 * S], [fx + fw + 40 * S, fy + fh + 10 * S]], entrada(u, 0.7, 0.4));
      ctx.restore();
      let y = fy + fh + 50 * S;
      y += selo(c, p.tribunal, cx, y, entrada(u, 0.5)) + 24 * S;
      ctx.save();
      ctx.globalAlpha *= entrada(u, 0.6);
      fonte(ctx, 44 * S, 800, TEXTO(tema));
      ctx.fillStyle = tema.texto;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(p.referencia, cx, y);
      if (p.data) {
        fonte(ctx, 32 * S, 500, TEXTO(tema));
        ctx.fillStyle = tema.suave;
        ctx.fillText(p.data, cx, y + 58 * S);
      }
      ctx.restore();
      y += p.data ? 120 * S : 80 * S;
      const k = entrada(u, 0.8, 0.6, easeBack);
      const pad = 50 * S;
      const pxT = ajustar(ctx, p.trecho, area.w - pad * 2, 44 * S, 30 * S, 7, 400, TITULO(tema), 'italic');
      const ls = quebrar(ctx, p.trecho, area.w - pad * 2);
      const h = ls.length * pxT * 1.4 + pad * 2 + 30 * S;
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.5);
      ctx.translate(0, (1 - k) * 50 * S);
      cartao(c, area.x, y, area.w, h, {});
      ctx.fillStyle = tema.destaque;
      fonte(ctx, 200 * S, 800, TITULO(tema));
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText('“', area.x + 20 * S, y - 60 * S);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.5);
      ctx.translate(0, (1 - k) * 50 * S);
      paragrafo(c, p.trecho, area.x + pad, y + pad + 10 * S, area.w - pad * 2, {
        px: pxT / S, peso: 400, familia: TITULO(tema), estilo: 'italic', lh: 1.4, k: clamp((u - 1.0) / 1.2),
      });
      ctx.restore();
    },
  },

  /** Aviso de cuidado. {titulo, texto} */
  alerta: {
    obrigatorios: ['titulo'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      const cx = area.x + area.w / 2;
      const tremor = u > 0.35 ? Math.sin(u * 45) * 14 * S * Math.exp(-6 * (u - 0.35)) : 0;
      let y = area.y + area.h * 0.06;
      // triângulo
      const r = 150 * S;
      const pulso = 1 + 0.04 * Math.sin(u * 5);
      ctx.save();
      ctx.translate(cx + tremor, y + r);
      ctx.scale(pulso * easeBack(entrada(u, 0, 0.5, (k) => k)), pulso * easeBack(entrada(u, 0, 0.5, (k) => k)));
      ctx.shadowColor = tema.alerta;
      ctx.shadowBlur = 60 * S;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 1.1, r * 0.8);
      ctx.lineTo(-r * 1.1, r * 0.8);
      ctx.closePath();
      ctx.fillStyle = tema.alerta;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      retangulo(ctx, -12 * S, -r * 0.45, 24 * S, r * 0.75, 10 * S);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.5, 15 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      y += r * 2.1;
      ctx.save();
      ctx.translate(tremor, 0);
      y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 84, min: 50, linhas: 3, ini: 0.3, cor: tema.alerta });
      if (p.texto) {
        ctx.globalAlpha *= entrada(u, 0.9);
        paragrafo(c, p.texto, area.x + 20 * S, y + 10 * S, area.w - 40 * S, { px: 46, peso: 600, alinhar: 'center' });
      }
      ctx.restore();
    },
  },

  /** Duas colunas lado a lado. {titulo, esquerda:{titulo, itens[]}, direita:{titulo, itens[]}} */
  comparacao: {
    obrigatorios: ['esquerda', 'direita'],
    desenhar(c) {
      const { ctx, u, d, p, S, area, tema } = c;
      let y = area.y;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 70, min: 46, linhas: 2 }) + 20 * S;
      const gap = 30 * S;
      const w = (area.w - gap) / 2;
      const colunas = [p.esquerda, p.direita];
      const cores = [p.esquerda.cor ? tema[p.esquerda.cor] || p.esquerda.cor : tema.suave, p.direita.cor ? tema[p.direita.cor] || p.direita.cor : tema.destaque];
      const maxItens = Math.max(...colunas.map((col) => (col.itens || []).length), 1);
      const passo = Math.min(0.5, (d - 1.5) / (maxItens * 2));
      const hCol = Math.min(area.y + area.h - y, 140 * S + maxItens * 150 * S);
      colunas.forEach((col, ci) => {
        const x = area.x + ci * (w + gap);
        const k = entrada(u, 0.2 + ci * 0.2, 0.5, easeBack);
        ctx.save();
        ctx.globalAlpha *= clamp(k * 1.5);
        ctx.translate(0, (1 - k) * 60 * S);
        cartao(c, x, y, w, hCol, { borda: comAlpha(cores[ci], 0.7) });
        retangulo(ctx, x, y, w, 100 * S, 28 * S);
        ctx.fillStyle = comAlpha(cores[ci], 0.2);
        ctx.fill();
        fonte(ctx, 40 * S, 800, TEXTO(tema));
        ctx.fillStyle = cores[ci];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(col.titulo || '').toUpperCase(), x + w / 2, y + 52 * S);
        let yy = y + 130 * S;
        (col.itens || []).forEach((it, ii) => {
          const ki = entrada(u, 0.8 + (ii * 2 + ci) * passo, 0.4);
          if (ki <= 0) return;
          ctx.save();
          ctx.globalAlpha *= ki;
          const h = paragrafo(c, it, x + 30 * S, yy, w - 60 * S, { px: 36, peso: 600, alinhar: 'center' });
          ctx.restore();
          yy += Math.max(h, 50 * S) + 40 * S;
        });
        ctx.restore();
      });
      // selo VS
      const k = entrada(u, 0.6, 0.4, easeBack);
      ctx.save();
      ctx.translate(area.x + area.w / 2, y + Math.min(hCol / 2, 230 * S));
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.arc(0, 0, 44 * S, 0, Math.PI * 2);
      ctx.fillStyle = tema.destaque;
      ctx.fill();
      fonte(ctx, 34 * S, 800, TEXTO(tema));
      ctx.fillStyle = tema.bg[0];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', 0, 2 * S);
      ctx.restore();
    },
  },

  /** Uma frase forte, centralizada. {texto, destaque} */
  frase: {
    obrigatorios: ['texto'],
    desenhar(c) {
      const { ctx, u, p, S, area, tema } = c;
      fonte(ctx, 92 * S, 800, TITULO(tema));
      const ls = quebrar(ctx, p.texto, area.w);
      const h = ls.length * 92 * S * 1.12;
      const y = area.y + Math.max(0, (area.h - h) / 2 - 40 * S);
      ctx.save();
      ctx.globalAlpha *= entrada(u, 0, 0.5);
      ctx.fillStyle = tema.destaque;
      ctx.fillRect(area.x + area.w / 2 - 60 * S, y - 50 * S, 120 * S * entrada(u, 0.1, 0.6), 8 * S);
      ctx.restore();
      tituloAnimado(c, { texto: p.texto, destaque: p.destaque, x: area.x, y, w: area.w, max: 104, min: 56, linhas: 6, ini: 0.1 });
    },
  },

  /** Fechamento com marca e aviso. {titulo, cta} */
  encerramento: {
    obrigatorios: [],
    desenhar(c) {
      const { ctx, u, p, S, area, tema, marca } = c;
      const cx = area.x + area.w / 2;
      let y = area.y;
      const tam = Math.min(area.w * 0.8, area.h * 0.38);
      c.tres('livros', cx - tam / 2, y - tam * 0.1, tam);
      y += tam * 0.8;
      if (p.titulo) y += tituloAnimado(c, { texto: p.titulo, x: area.x, y, w: area.w, max: 80, min: 50, linhas: 3, ini: 0.3 }) + 20 * S;
      // avatar + nome
      const k = entrada(u, 0.6, 0.5, easeBack);
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.5);
      const r = 56 * S;
      fonte(ctx, 40 * S, 800, TEXTO(tema));
      const wNome = Math.max(ctx.measureText(marca.nome || '').width, (() => { fonte(ctx, 34 * S, 500, TEXTO(tema)); return ctx.measureText(marca.arroba || '').width; })());
      const total = r * 2 + 28 * S + wNome;
      const x0 = cx - total / 2;
      ctx.beginPath();
      ctx.arc(x0 + r, y + r, r, 0, Math.PI * 2);
      ctx.fillStyle = tema.destaque;
      ctx.fill();
      fonte(ctx, 44 * S, 800, TITULO(tema));
      ctx.fillStyle = tema.bg[0];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marca.iniciais || '§', x0 + r, y + r + 2 * S);
      ctx.textAlign = 'left';
      fonte(ctx, 40 * S, 800, TEXTO(tema));
      ctx.fillStyle = tema.texto;
      ctx.fillText(marca.nome || '', x0 + r * 2 + 28 * S, y + r - 22 * S);
      fonte(ctx, 34 * S, 500, TEXTO(tema));
      ctx.fillStyle = tema.suave;
      ctx.fillText(marca.arroba || '', x0 + r * 2 + 28 * S, y + r + 26 * S);
      ctx.restore();
      y += r * 2 + 40 * S;
      const cta = p.cta || marca.cta;
      if (cta) {
        const kc = entrada(u, 0.9, 0.5, easeBack);
        fonte(ctx, 40 * S, 800, TEXTO(tema));
        const w = Math.min(area.w, ctx.measureText(cta).width + 80 * S);
        ctx.save();
        ctx.globalAlpha *= clamp(kc * 1.5);
        ctx.translate(cx, y + 45 * S);
        ctx.scale(0.9 + 0.1 * kc + 0.02 * Math.sin(u * 4), 0.9 + 0.1 * kc + 0.02 * Math.sin(u * 4));
        retangulo(ctx, -w / 2, -45 * S, w, 90 * S, 45 * S);
        ctx.fillStyle = tema.destaque;
        ctx.fill();
        ctx.fillStyle = tema.bg[0];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cta, 0, 2 * S);
        ctx.restore();
      }
    },
  },
};
