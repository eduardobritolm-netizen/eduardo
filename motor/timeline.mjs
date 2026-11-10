// Monta a timeline (o que aparece e quando) a partir do roteiro, da marca e da voz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { narrar, estimarDuracao, timingProporcional, carregarEnv } from './voz.mjs';
import { preparar, tempoEscrito } from './pronuncia.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ler = (arq) => JSON.parse(fs.readFileSync(arq, 'utf8'));

const INICIO = 0.25;      // respiro antes da primeira fala
const FOLGA = 0.45;       // respiro depois de cada fala
const MINIMO = { abertura: 3.2, artigo: 5, encerramento: 3.5 };

/** Agrupa palavras em blocos curtos de legenda (até ~20 caracteres, quebra em pontuação). */
function agrupar(palavras) {
  const grupos = [];
  let atual = [];
  let chars = 0;
  palavras.forEach((w, i) => {
    if (atual.length && (chars + w.p.length > 20 || atual.length >= 4)) {
      grupos.push(atual); atual = []; chars = 0;
    }
    atual.push(w);
    chars += w.p.length + 1;
    if (/[.?!;:]$/.test(w.p) || (/,$/.test(w.p) && atual.length >= 2)) { grupos.push(atual); atual = []; chars = 0; }
  });
  if (atual.length) grupos.push(atual);
  return grupos.map((g, i) => ({
    palavras: g,
    t0: g[0].t0,
    t1: grupos[i + 1] ? Math.min(g[g.length - 1].t1, grupos[i + 1][0].t0) : g[g.length - 1].t1,
  }));
}

export function carregarRoteiro(arqRoteiro) {
  const roteiro = ler(arqRoteiro);
  const marca = { ...ler(path.join(RAIZ, 'marca.json')), ...(roteiro.marca || {}) };
  const temas = ler(path.join(RAIZ, 'motor', 'temas.json'));
  const nomeTema = roteiro.tema || marca.tema_padrao || 'toga';
  if (!temas[nomeTema]) throw new Error(`Tema "${nomeTema}" não existe. Opções: ${Object.keys(temas).join(', ')}`);
  const tema = { ...temas[nomeTema], ...(roteiro.tema_ajustes || {}) };
  if (marca.cor) tema.destaque = marca.cor;
  return { roteiro, marca, tema, nomeTema };
}

export async function montarTimeline(arqRoteiro, { semVoz = false, fps = 30 } = {}) {
  carregarEnv(RAIZ);
  const pasta = path.dirname(path.resolve(arqRoteiro));
  const { roteiro, marca, tema } = carregarRoteiro(arqRoteiro);
  const provedor = semVoz ? 'nenhuma' : (roteiro.voz?.provedor || process.env.VOZ_PROVEDOR || 'nenhuma');
  const velocidade = roteiro.ritmo || 1;

  let t = 0;
  const cenas = [];
  const trilhas = [];
  for (const [i, cena] of roteiro.cenas.entries()) {
    const fala = cena.fala || '';
    // a legenda mostra a forma escrita (Lei nº 14.230/2021); a voz lê a forma falada
    const prep = preparar(fala);
    const falado = cena.fala_voz || prep.falado;
    const audio = fala ? await narrar(falado, provedor, path.join(pasta, 'audio')) : null;
    const durFala = audio ? audio.duracao : estimarDuracao(falado) / velocidade;
    const atraso = i === 0 ? INICIO : 0.15; // a fala entra logo depois da transição
    const inicioFala = t + atraso;
    let temposFalados = audio
      ? audio.palavras.map((w) => ({ p: w.p, t0: inicioFala + w.t0, t1: inicioFala + w.t1 }))
      : timingProporcional(falado, durFala, inicioFala);
    const totalFalado = prep.mapa.reduce((a, b) => a + b, 0);
    if (!cena.fala_voz && temposFalados.length !== totalFalado) temposFalados = timingProporcional(prep.falado, durFala, inicioFala);
    const palavras = fala ? (cena.fala_voz ? timingProporcional(fala, durFala, inicioFala) : tempoEscrito(prep, temposFalados)) : [];
    const dur = Math.max(MINIMO[cena.tipo] || 2.4, cena.duracao || 0, atraso + durFala + FOLGA);
    if (audio) trilhas.push({ arquivo: audio.arquivo, inicio: inicioFala });
    cenas.push({ ...cena, inicio: t, dur, voz: falado, grupos: agrupar(palavras) });
    t += dur;
  }
  const duracao = t;
  return {
    w: 1080, h: 1920, fps,
    carrossel: { w: 1080, h: 1350 },
    duracao,
    titulo: roteiro.titulo,
    tema, marca,
    legenda: roteiro.legenda_na_tela !== false,
    provedor,
    trilhas,
    cenas,
  };
}
