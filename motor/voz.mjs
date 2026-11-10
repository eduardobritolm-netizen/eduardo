// Narração: ElevenLabs, Fish Audio ou nenhuma (timing estimado).
// Cada fala é gerada uma vez e guardada em projetos/<p>/audio/ (cache por hash).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export function carregarEnv(raiz) {
  const arq = path.join(raiz, '.env');
  if (!fs.existsSync(arq)) return;
  for (const linha of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function duracaoAudio(arq) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]);
  return parseFloat(String(out).trim());
}

export const palavrasDe = (texto) => String(texto).split(/\s+/).filter(Boolean);

/** Distribui as palavras no intervalo, pesando pelo tamanho e por pausas de pontuação. */
export function timingProporcional(texto, duracao, inicio = 0) {
  const ps = palavrasDe(texto);
  const pesos = ps.map((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length + 2 + (/[.,;:?!]$/.test(p) ? 3 : 0));
  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  let t = inicio;
  return ps.map((p, i) => {
    const d = (pesos[i] / total) * duracao;
    const w = { p, t0: t, t1: t + d * 0.92 };
    t += d;
    return w;
  });
}

/** Duração estimada de uma fala sem áudio (~2,6 palavras/s, ritmo de Reels). */
export function estimarDuracao(texto) {
  const ps = palavrasDe(texto);
  const pausas = (String(texto).match(/[.,;:?!]/g) || []).length * 0.12;
  return ps.length / 2.6 + pausas;
}

function hash(...partes) {
  return crypto.createHash('sha1').update(partes.join('|')).digest('hex').slice(0, 16);
}

async function elevenlabs(texto, destino) {
  // no ambiente na nuvem a chave é injetada pelo proxy; no computador da pessoa vem do .env
  const chave = process.env.ELEVENLABS_API_KEY || 'chave-injetada-pelo-proxy';
  const voz = process.env.ELEVENLABS_VOICE_ID;
  if (!voz) throw new Error('Falta ELEVENLABS_VOICE_ID no .env (rode npm run clonar com a sua gravação)');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': chave, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  const j = await r.json();
  fs.writeFileSync(destino, Buffer.from(j.audio_base64, 'base64'));
  // alinhamento por caractere -> por palavra
  const a = j.alignment;
  if (!a?.characters) return null;
  const palavras = [];
  let atual = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (atual) palavras.push(atual); atual = null; return; }
    if (!atual) atual = { p: '', t0: a.character_start_times_seconds[i], t1: 0 };
    atual.p += ch;
    atual.t1 = a.character_end_times_seconds[i];
  });
  if (atual) palavras.push(atual);
  return palavras;
}

async function fish(texto, destino) {
  const chave = process.env.FISH_API_KEY;
  if (!chave) throw new Error('Defina FISH_API_KEY no .env');
  const corpo = { text: texto, format: 'mp3' };
  if (process.env.FISH_VOICE_ID) corpo.reference_id = process.env.FISH_VOICE_ID;
  const r = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json', model: process.env.FISH_MODEL || 's1' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`Fish Audio ${r.status}: ${await r.text()}`);
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return null;
}

/** Voz neural local (Kokoro): roda no computador, sem chave. Configure KOKORO_* no .env. */
async function kokoro(texto, destino) {
  const py = process.env.KOKORO_PYTHON || 'python3';
  const modelo = process.env.KOKORO_MODELO, vozes = process.env.KOKORO_VOZES;
  if (!modelo || !vozes) throw new Error('Defina KOKORO_MODELO e KOKORO_VOZES no .env (veja .env.exemplo)');
  const bruto = destino.replace(/\.mp3$/, '.bruto.wav');
  const script = path.join(path.dirname(new URL(import.meta.url).pathname), 'tts_local.py');
  execFileSync(py, [script, modelo, vozes, process.env.KOKORO_VOZ || 'pm_alex', process.env.KOKORO_VELOCIDADE || '1.0', bruto], { input: texto });
  // tratamento de locução: tira graves inúteis, dá presença, comprime e nivela para Reels
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', bruto, '-af',
    'highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9',
    '-ar', '44100', '-ac', '1', '-b:a', '192k', destino]);
  fs.rmSync(bruto);
  return null;
}

const PROVEDORES = { elevenlabs, fish, kokoro };

/**
 * Gera (ou reaproveita) o áudio da fala. Devolve { arquivo, duracao, palavras } com
 * tempos relativos ao início do áudio; ou null se o provedor for "nenhuma".
 */
export async function narrar(texto, provedor, pastaAudio) {
  if (!provedor || provedor === 'nenhuma') return null;
  const gerar = PROVEDORES[provedor];
  if (!gerar) throw new Error(`Provedor de voz desconhecido: ${provedor} (use elevenlabs, fish, kokoro ou nenhuma)`);
  fs.mkdirSync(pastaAudio, { recursive: true });
  const id = hash(provedor, process.env.ELEVENLABS_VOICE_ID || '', process.env.FISH_VOICE_ID || '', process.env.KOKORO_VOZ || '', process.env.KOKORO_VELOCIDADE || '', texto);
  const mp3 = path.join(pastaAudio, `${id}.mp3`);
  const meta = path.join(pastaAudio, `${id}.json`);
  if (!fs.existsSync(mp3)) {
    const palavras = await gerar(texto, mp3);
    fs.writeFileSync(meta, JSON.stringify({ texto, palavras }, null, 1));
  }
  const duracao = duracaoAudio(mp3);
  const salvo = JSON.parse(fs.readFileSync(meta, 'utf8'));
  const palavras = salvo.palavras?.length ? salvo.palavras : timingProporcional(texto, duracao);
  return { arquivo: mp3, duracao, palavras };
}
