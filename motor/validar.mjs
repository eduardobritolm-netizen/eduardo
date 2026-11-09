// Confere o roteiro antes do render: estrutura, fontes jurídicas e cuidados de publicidade da advocacia.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarRoteiro } from './timeline.mjs';
import { estimarDuracao } from './voz.mjs';

export const TIPOS = {
  abertura: ['titulo'],
  artigo: ['artigo', 'texto'],
  numero: ['numero'],
  balanca: ['esquerda', 'direita'],
  lista: ['itens'],
  linha_do_tempo: ['etapas'],
  jurisprudencia: ['tribunal', 'referencia', 'trecho'],
  alerta: ['titulo'],
  comparacao: ['esquerda', 'direita'],
  frase: ['texto'],
  encerramento: [],
};

// Expressões que costumam esbarrar nas regras de publicidade da advocacia
// (Código de Ética e Disciplina da OAB e Provimento 205/2021). É só um alerta: revise.
const SENSIVEIS = [
  [/garant(o|imos|ido|ia de) (ganho|resultado|vit[oó]ria|sucesso)/i, 'promessa de resultado'],
  [/\b100\s?% (garantido|de sucesso|de chance)/i, 'promessa de resultado'],
  [/ganhe (sua|a) (causa|a[cç][aã]o)/i, 'promessa de resultado'],
  [/(o|a) melhor advogad[oa]|melhor escrit[oó]rio/i, 'autopromoção comparativa'],
  [/contrate (j[aá]|agora|hoje)|liga(r)? (j[aá]|agora)|chame (no|meu) (whats|direct)/i, 'captação direta de clientela'],
  [/consulta gr[aá]tis|honor[aá]rios? (baixos?|a partir de|promocion)/i, 'oferta de preço/gratuidade'],
  [/\b(processe|processa) (j[aá]|agora)/i, 'incentivo ao litígio'],
];

export function validar(arqRoteiro) {
  const erros = [];
  const avisos = [];
  let dados;
  try { dados = carregarRoteiro(arqRoteiro); } catch (e) { return { erros: [e.message], avisos }; }
  const { roteiro } = dados;
  if (!Array.isArray(roteiro.cenas) || !roteiro.cenas.length) erros.push('O roteiro precisa de "cenas" (lista não vazia).');
  (roteiro.cenas || []).forEach((c, i) => {
    const onde = `cena ${i + 1} (${c.tipo})`;
    if (!TIPOS[c.tipo]) { erros.push(`${onde}: tipo desconhecido. Tipos: ${Object.keys(TIPOS).join(', ')}`); return; }
    for (const campo of TIPOS[c.tipo]) if (c[campo] === undefined || c[campo] === '') erros.push(`${onde}: falta o campo "${campo}".`);
    if (!c.fala) avisos.push(`${onde}: sem "fala" (a cena fica muda e sem legenda).`);
    if (c.tipo === 'numero' && Number.isNaN(Number(c.numero))) erros.push(`${onde}: "numero" precisa ser numérico (use prefixo/sufixo para R$, %).`);
    if (c.tipo === 'artigo' && c.destaque && !String(c.texto).toLowerCase().includes(String(c.destaque).toLowerCase()))
      erros.push(`${onde}: o "destaque" não aparece literalmente no "texto" da lei.`);
    if (c.tipo === 'lista' && (c.itens || []).length > 5) avisos.push(`${onde}: mais de 5 itens não cabe bem na tela.`);
    const texto = JSON.stringify(c);
    for (const [re, motivo] of SENSIVEIS) if (re.test(texto)) avisos.push(`${onde}: possível ${motivo} — revise à luz do Provimento OAB 205/2021.`);
  });

  const fontes = roteiro.fontes || [];
  if (!fontes.length) erros.push('Sem "fontes". Todo vídeo jurídico precisa citar a base legal (lei, súmula, decisão) com link oficial.');
  fontes.forEach((f, i) => {
    if (!f.fonte || !f.url) erros.push(`fonte ${i + 1}: precisa de "fonte" e "url".`);
    if (!f.conferido_em) avisos.push(`fonte ${i + 1}: sem "conferido_em" — confira o texto na fonte oficial antes de publicar.`);
    if (f.url && !/planalto\.gov\.br|stf\.jus\.br|stj\.jus\.br|tst\.jus\.br|jus\.br|camara\.leg\.br|senado\.leg\.br|lexml\.gov\.br|gov\.br/.test(f.url))
      avisos.push(`fonte ${i + 1}: o link não parece ser de fonte oficial (${f.url}).`);
  });

  const total = (roteiro.cenas || []).reduce((a, c) => a + Math.max(2.4, estimarDuracao(c.fala || '') + 0.6), 0);
  if (total > 95) avisos.push(`Duração estimada ${total.toFixed(0)} s: longa para Reels (ideal 30–60 s).`);
  if (total < 15) avisos.push(`Duração estimada ${total.toFixed(0)} s: curta demais.`);
  if (roteiro.cenas?.[0]?.tipo !== 'abertura') avisos.push('A primeira cena ideal é "abertura" (gancho nos 2 primeiros segundos).');
  return { erros, avisos, duracaoEstimada: total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arq = process.argv[2];
  if (!arq) { console.error('Uso: npm run validar -- projetos/<tema>/roteiro.json'); process.exit(2); }
  const { erros, avisos, duracaoEstimada } = validar(arq);
  for (const e of erros) console.log(`ERRO   ${e}`);
  for (const a of avisos) console.log(`AVISO  ${a}`);
  if (duracaoEstimada) console.log(`Duração estimada: ~${duracaoEstimada.toFixed(0)} s`);
  console.log(erros.length ? `\n${erros.length} erro(s). Corrija antes de renderizar.` : '\nRoteiro ok.');
  process.exit(erros.length ? 1 : 0);
}
