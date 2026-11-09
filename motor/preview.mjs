// Prévia ao vivo no navegador (sem render). Clique pausa; setas pulam 2 s.
// Uso: npm run preview -- projetos/<tema>/roteiro.json [--carrossel]
import fs from 'node:fs';
import path from 'node:path';
import { montarTimeline, RAIZ } from './timeline.mjs';
import { servir } from './servidor.mjs';

const arq = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!arq) { console.error('Uso: npm run preview -- projetos/<tema>/roteiro.json'); process.exit(2); }
const out = path.join(path.dirname(path.resolve(arq)), 'saida');
fs.mkdirSync(out, { recursive: true });

const tl = await montarTimeline(arq, { semVoz: !process.argv.includes('--com-voz') });
const arqTl = path.join(out, 'timeline-preview.json');
fs.writeFileSync(arqTl, JSON.stringify(tl));
const rel = '/' + path.relative(RAIZ, arqTl).split(path.sep).join('/');
const { porta } = await servir(Number(process.env.PORTA) || 4173);
console.log(`Prévia (${tl.duracao.toFixed(1)} s): http://127.0.0.1:${porta}/motor/web/index.html?modo=preview&timeline=${encodeURIComponent(rel)}`);
console.log('Ctrl+C para sair.');
