// Clona a voz da pessoa na ElevenLabs a partir de gravações dela (voz própria, com autorização dela).
// Uso: npm run clonar -- gravacao1.m4a [gravacao2.m4a ...] [--nome "Eduardo Brito"]
// 1) limpa o áudio (corta graves, reduz ruído, normaliza volume) em marca/voz/
// 2) envia para a ElevenLabs (Instant Voice Cloning) e grava ELEVENLABS_VOICE_ID no .env
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RAIZ } from './timeline.mjs';
import { carregarEnv } from './voz.mjs';

carregarEnv(RAIZ);
const args = process.argv.slice(2);
const iNome = args.indexOf('--nome');
const nome = iNome >= 0 ? args[iNome + 1] : 'Narração do escritório';
const arquivos = args.filter((a, i) => !a.startsWith('--') && i !== iNome + 1);
if (!arquivos.length) { console.error('Uso: npm run clonar -- gravacao.m4a [mais.m4a] [--nome "Seu nome"]'); process.exit(2); }

const pasta = path.join(RAIZ, 'marca', 'voz');
fs.mkdirSync(pasta, { recursive: true });
const limpos = arquivos.map((a, i) => {
  const destino = path.join(pasta, `amostra-${i + 1}.mp3`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', a, '-af',
    'highpass=f=80,lowpass=f=12000,afftdn=nf=-25,silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '44100', '-ac', '1', '-b:a', '192k', destino]);
  const dur = parseFloat(String(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', destino])));
  console.log(`amostra ${i + 1}: ${dur.toFixed(0)} s -> ${path.relative(RAIZ, destino)}`);
  return { destino, dur };
});
const total = limpos.reduce((a, b) => a + b.dur, 0);
if (total < 45) console.log(`Aviso: ${total.toFixed(0)} s de áudio. O ideal é de 1 a 3 minutos de fala corrida.`);

const form = new FormData();
form.append('name', nome);
form.append('description', 'Voz própria do titular do escritório, usada só nos vídeos do perfil.');
form.append('remove_background_noise', 'true');
for (const { destino } of limpos) form.append('files', new Blob([fs.readFileSync(destino)], { type: 'audio/mpeg' }), path.basename(destino));
// fora deste ambiente a chave vem do .env; aqui o proxy injeta a chave salva
const chave = process.env.ELEVENLABS_API_KEY || 'chave-injetada-pelo-proxy';
const r = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': chave }, body: form });
const corpo = await r.text();
if (!r.ok) { console.error(`ElevenLabs ${r.status}: ${corpo}`); process.exit(1); }
const { voice_id } = JSON.parse(corpo);
const env = path.join(RAIZ, '.env');
let txt = fs.existsSync(env) ? fs.readFileSync(env, 'utf8') : fs.readFileSync(path.join(RAIZ, '.env.exemplo'), 'utf8');
txt = /^ELEVENLABS_VOICE_ID=.*$/m.test(txt) ? txt.replace(/^ELEVENLABS_VOICE_ID=.*$/m, `ELEVENLABS_VOICE_ID=${voice_id}`) : txt + `\nELEVENLABS_VOICE_ID=${voice_id}\n`;
txt = txt.replace(/^VOZ_PROVEDOR=.*$/m, 'VOZ_PROVEDOR=elevenlabs');
fs.writeFileSync(env, txt);
console.log(`Voz criada: ${voice_id} (gravada no .env). Os próximos renders já saem com ela.`);
