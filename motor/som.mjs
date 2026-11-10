// Desenho de som gerado no próprio computador (sem bancos de áudio de terceiros):
// whoosh na folha, cintilar no brilho, impacto grave na abertura, subida no fecho
// e uma cama grave discreta. Tudo sai num arquivo só, mixado depois com a narração.
import { spawn } from 'node:child_process';

const APELIDOS = { rasgo: 'folha', luz: 'brilho' };
const fundoDe = (c) => (c.fundo === 'papel' ? 'papel' : 'escuro');
function transicao(ant, cena) {
  if (!ant) return 'nenhuma';
  const t = cena.transicao ? (APELIDOS[cena.transicao] || cena.transicao) : null;
  return t || (fundoDe(ant) !== fundoDe(cena) ? 'folha' : 'padrao');
}

const FONTES = {
  impacto: 'aevalsrc=\'0.9*sin(2*PI*48*t)*exp(-3.2*t)+0.35*sin(2*PI*96*t)*exp(-6*t)\':d=1.6:s=48000',
  whoosh: 'anoisesrc=d=0.75:c=pink:a=0.6:r=48000,highpass=f=250,lowpass=f=3800,afade=t=in:d=0.4:curve=exp,afade=t=out:st=0.4:d=0.35',
  swish: 'anoisesrc=d=0.4:c=pink:a=0.3:r=48000,highpass=f=900,lowpass=f=6000,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.2',
  cintilar: 'anoisesrc=d=0.9:c=white:a=0.25:r=48000,highpass=f=6000,afade=t=in:d=0.45,afade=t=out:st=0.45:d=0.45',
  subida: 'aevalsrc=\'0.25*sin(2*PI*(160+220*t*t)*t)*(t/1.2)\':d=1.2:s=48000,afade=t=out:st=1.0:d=0.2',
  tique: 'aevalsrc=\'0.5*sin(2*PI*1800*t)*exp(-40*t)\':d=0.15:s=48000',
};

export function eventosDeSom(tl) {
  const ev = [];
  tl.cenas.forEach((c, i) => {
    const ant = tl.cenas[i - 1];
    const tr = transicao(ant, c);
    if (i === 0) ev.push({ som: 'impacto', t: 0.2, vol: 0.9 });
    if (tr === 'folha') ev.push({ som: 'whoosh', t: c.inicio - 0.15, vol: 0.55 });
    if (tr === 'brilho') ev.push({ som: 'cintilar', t: c.inicio - 0.45, vol: 0.5 });
    if (tr === 'padrao') ev.push({ som: 'swish', t: c.inicio - 0.1, vol: 0.25 });
    if (c.tipo === 'encerramento') ev.push({ som: 'subida', t: c.inicio - 0.2, vol: 0.45 });
    if (c.tipo === 'tipografia' && c.enfase?.length) {
      // tique sutil quando a ênfase entra (primeira palavra marcada)
      const limpa = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const enf = new Set(c.enfase.flatMap((e) => e.split(/\s+/)).map(limpa));
      const w = c.grupos.flatMap((g) => g.palavras).find((p) => enf.has(limpa(p.p)));
      if (w) ev.push({ som: 'tique', t: w.t0, vol: 0.35 });
    }
  });
  return ev.filter((e) => e.t >= 0);
}

export function gerarTrilha(tl, destino, { cama = true } = {}) {
  const ev = eventosDeSom(tl);
  const args = ['-y', '-v', 'error'];
  const filtros = [];
  ev.forEach((e, i) => {
    args.push('-f', 'lavfi', '-i', FONTES[e.som]);
    filtros.push(`[${i}:a]volume=${e.vol},adelay=${Math.round(e.t * 1000)}:all=1[e${i}]`);
  });
  let n = ev.length;
  if (cama) {
    // cama grave: acorde aberto bem baixo, com respiração lenta
    args.push('-f', 'lavfi', '-i', `aevalsrc='(0.5*sin(2*PI*55*t)+0.3*sin(2*PI*82.4*t)+0.2*sin(2*PI*110*t))*(0.6+0.4*sin(2*PI*0.08*t))':d=${tl.duracao.toFixed(2)}:s=48000`);
    filtros.push(`[${n}:a]volume=0.06,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, tl.duracao - 2).toFixed(2)}:d=2[e${n}]`);
    n++;
  }
  if (!n) return Promise.resolve(null);
  const mix = `${filtros.join(';')};${Array.from({ length: n }, (_, i) => `[e${i}]`).join('')}amix=inputs=${n}:normalize=0,apad=whole_dur=${tl.duracao.toFixed(2)},alimiter=limit=0.9[saida]`;
  args.push('-filter_complex', mix, '-map', '[saida]', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', destino);
  return new Promise((ok, falha) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? ok(destino) : falha(new Error(`ffmpeg (trilha) saiu com ${c}`))));
  });
}
