// Render: roteiro.json -> video.mp4 (1080x1920), capa.png, carrossel/*.png e post.txt
// Uso: node motor/render.mjs projetos/<tema>/roteiro.json [--rapido] [--sem-voz] [--sem-carrossel] [--so-carrossel]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { montarTimeline, RAIZ } from './timeline.mjs';
import { validar } from './validar.mjs';
import { servir } from './servidor.mjs';
import { gerarTrilha } from './som.mjs';

const args = process.argv.slice(2);
const arq = args.find((a) => !a.startsWith('--'));
const flag = (f) => args.includes(f);
if (!arq) {
  console.error('Uso: npm run render -- projetos/<tema>/roteiro.json [--rapido] [--sem-voz] [--sem-carrossel] [--so-carrossel]');
  process.exit(2);
}
const rapido = flag('--rapido');
const fps = rapido ? 24 : 30;
const pasta = path.dirname(path.resolve(arq));
const out = path.join(pasta, 'saida');
fs.mkdirSync(out, { recursive: true });

const { erros, avisos } = validar(arq);
avisos.forEach((a) => console.log(`aviso: ${a}`));
if (erros.length) {
  erros.forEach((e) => console.error(`erro: ${e}`));
  process.exit(1);
}

console.log('1/5 Montando timeline e narração...');
const tl = await montarTimeline(arq, { semVoz: flag('--sem-voz'), fps });
const rel = (p) => '/' + path.relative(RAIZ, p).split(path.sep).join('/');

// trilha de narração única (cada fala no seu tempo)
let narracao = null;
if (tl.trilhas.length) {
  narracao = path.join(out, 'narracao.m4a');
  const entradas = tl.trilhas.flatMap((t) => ['-i', t.arquivo]);
  const filtros = tl.trilhas.map((t, i) => `[${i}:a]adelay=${Math.round(t.inicio * 1000)}:all=1[a${i}]`).join(';');
  const mix = `${filtros};${tl.trilhas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${tl.trilhas.length}:normalize=0,apad=whole_dur=${tl.duracao.toFixed(2)}[saida]`;
  await executar('ffmpeg', ['-y', '-v', 'error', ...entradas, '-filter_complex', mix, '-map', '[saida]', '-c:a', 'aac', '-b:a', '192k', narracao]);
  tl.audio = rel(narracao);
}
const arqTimeline = path.join(out, 'timeline.json');
fs.writeFileSync(arqTimeline, JSON.stringify(tl, null, 1));
console.log(`   ${tl.cenas.length} cenas, ${tl.duracao.toFixed(1)} s, voz: ${tl.provedor}`);

const { srv, porta } = await servir();
const base = `http://127.0.0.1:${porta}/motor/web/index.html?timeline=${encodeURIComponent(rel(arqTimeline))}`;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function abrir(modo, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('erro na página:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`${base}&modo=${modo}`);
  await page.waitForFunction(() => window.estudio?.pronto, null, { timeout: 60000 });
  return page;
}

try {
  if (!flag('--so-carrossel')) {
    console.log('2/5 Renderizando quadros...');
    const page = await abrir('video', tl.w, tl.h);
    const semAudio = path.join(out, 'video-sem-audio.mp4');
    const ff = spawn('ffmpeg', [
      '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', rapido ? 'veryfast' : 'medium', '-crf', rapido ? '23' : '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', semAudio,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.ceil(tl.duracao * fps);
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const b64 = await page.evaluate(([t, q]) => window.estudio.quadro(t, q), [f / fps, rapido ? 0.85 : 0.94]);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((ok) => ff.stdin.once('drain', ok));
      if (f % fps === 0 || f === total - 1) {
        const pct = (((f + 1) / total) * 100).toFixed(0);
        process.stdout.write(`\r   quadro ${f + 1}/${total} (${pct}%) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }
    ff.stdin.end();
    await new Promise((ok, falha) => ff.on('close', (c) => (c === 0 ? ok() : falha(new Error(`ffmpeg saiu com ${c}`)))));
    process.stdout.write('\n');

    console.log('3/5 Juntando narração...');
    const final = path.join(out, 'video.mp4');
    // desenho de som (efeitos + cama), a menos que o roteiro peça "trilha": false
    const roteiroSom = JSON.parse(fs.readFileSync(arq, 'utf8'));
    const sfx = roteiroSom.trilha === false || flag('--sem-trilha') ? null
      : await gerarTrilha(tl, path.join(out, 'efeitos.m4a'), { cama: roteiroSom.cama !== false });
    const entradasAudio = [narracao, sfx].filter(Boolean);
    if (entradasAudio.length === 2) {
      // narração por cima; efeitos abaixam quando a voz fala (sidechain)
      await executar('ffmpeg', ['-y', '-v', 'error', '-i', semAudio, '-i', narracao, '-i', sfx, '-filter_complex',
        '[2:a][1:a]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=300[sfxd];[1:a][sfxd]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]',
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
      fs.rmSync(semAudio);
    } else if (entradasAudio.length === 1) {
      await executar('ffmpeg', ['-y', '-v', 'error', '-i', semAudio, '-i', entradasAudio[0], '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', final]);
      fs.rmSync(semAudio);
    } else fs.renameSync(semAudio, final);

    console.log('4/5 Capa...');
    const capa = await page.evaluate(() => window.estudio.capa());
    fs.writeFileSync(path.join(out, 'capa.png'), Buffer.from(capa, 'base64'));
    await page.close();
  }

  if (!flag('--sem-carrossel')) {
    console.log('5/5 Carrossel 1080x1350...');
    const pastaCar = path.join(out, 'carrossel');
    fs.rmSync(pastaCar, { recursive: true, force: true });
    fs.mkdirSync(pastaCar, { recursive: true });
    const page = await abrir('carrossel', tl.carrossel.w, tl.carrossel.h);
    for (let i = 0; i < tl.cenas.length; i++) {
      const b64 = await page.evaluate((n) => window.estudio.slide(n), i);
      fs.writeFileSync(path.join(pastaCar, `${String(i + 1).padStart(2, '0')}.png`), Buffer.from(b64, 'base64'));
    }
    await page.close();
  }
} finally {
  await browser.close();
  srv.close();
}

// texto do post (legenda + fontes)
const roteiro = JSON.parse(fs.readFileSync(arq, 'utf8'));
const post = [
  roteiro.legenda_post || roteiro.titulo || '',
  '',
  roteiro.hashtags?.length ? roteiro.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '',
  '',
  'Fontes:',
  ...(roteiro.fontes || []).map((f) => `• ${f.fonte}${f.url ? ` — ${f.url}` : ''}`),
  '',
  tl.marca.aviso || '',
].join('\n').replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(path.join(out, 'post.txt'), post.trim() + '\n');
console.log(`\nPronto: ${path.relative(process.cwd(), out)}/`);

function executar(cmd, a) {
  return new Promise((ok, falha) => {
    const p = spawn(cmd, a, { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? ok() : falha(new Error(`${cmd} saiu com ${c}`))));
  });
}
