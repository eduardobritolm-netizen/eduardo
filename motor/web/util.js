// Funções pequenas usadas por todas as cenas. Tudo é função do tempo:
// o mesmo t sempre gera o mesmo quadro (render determinístico).

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = (k) => Math.pow(clamp(k), 3);
export const easeInOut = (k) => {
  k = clamp(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
export const easeBack = (k) => {
  k = clamp(k);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
/** progresso 0..1 de uma entrada que começa em `ini` e dura `dur` */
export const entrada = (u, ini, dur = 0.5, ease = easeOut) => ease((u - ini) / dur);

export function fonte(ctx, px, peso, familia, estilo = 'normal') {
  ctx.font = `${estilo} ${peso} ${Math.round(px)}px "${familia}"`;
}

/** Quebra texto em linhas de no máximo `largura`. Devolve [{palavras:[{txt,x,w,i}], w}] */
export function quebrar(ctx, texto, largura) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const espaco = ctx.measureText(' ').width;
  const linhas = [];
  let atual = { palavras: [], w: 0 };
  palavras.forEach((txt, i) => {
    const w = ctx.measureText(txt).width;
    const novoW = atual.palavras.length ? atual.w + espaco + w : w;
    if (novoW > largura && atual.palavras.length) {
      linhas.push(atual);
      atual = { palavras: [], w: 0 };
    }
    const x = atual.palavras.length ? atual.w + espaco : 0;
    atual.palavras.push({ txt, x, w, i });
    atual.w = x + w;
  });
  if (atual.palavras.length) linhas.push(atual);
  return linhas;
}

/** Acha o maior tamanho de fonte (até `max`) que cabe em `maxLinhas` linhas. */
export function ajustar(ctx, texto, largura, max, min, maxLinhas, peso, familia, estilo) {
  let px = max;
  while (px > min) {
    fonte(ctx, px, peso, familia, estilo);
    if (quebrar(ctx, texto, largura).length <= maxLinhas) break;
    px -= 2;
  }
  fonte(ctx, px, peso, familia, estilo);
  return px;
}

export function retangulo(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function comAlpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Desenha um traço progressivo (0..1) por uma lista de pontos. */
export function tracar(ctx, pontos, k) {
  if (k <= 0 || pontos.length < 2) return;
  let total = 0;
  const seg = [];
  for (let i = 1; i < pontos.length; i++) {
    const d = Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let resta = total * clamp(k);
  ctx.beginPath();
  ctx.moveTo(pontos[0][0], pontos[0][1]);
  for (let i = 1; i < pontos.length && resta > 0; i++) {
    const d = seg[i - 1];
    const f = Math.min(1, resta / d);
    ctx.lineTo(lerp(pontos[i - 1][0], pontos[i][0], f), lerp(pontos[i - 1][1], pontos[i][1], f));
    resta -= d;
  }
  ctx.stroke();
}

/** Ruído determinístico (para textura de papel/grão). */
export function aleatorio(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function formatarNumero(n, casas = 0) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
