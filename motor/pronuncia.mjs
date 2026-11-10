// Português padrão na tela, fala natural na voz.
// A `fala` do roteiro é escrita como se escreve em texto jurídico ("Lei nº 14.230/2021",
// "art. 1º, § 2º", "20%"). Este módulo gera o texto que a voz lê ("Lei número catorze mil,
// duzentos e trinta, de dois mil e vinte e um") e um mapa token escrito -> nº de palavras faladas,
// para a legenda mostrar a forma escrita no tempo certo.

const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ORD = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono'];
const ORD_F = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona'];

function ate999(n) {
  if (n < 20) return UNI[n];
  if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNI[n % 10] : '');
  if (n === 100) return 'cem';
  return CEM[Math.floor(n / 100)] + (n % 100 ? ' e ' + ate999(n % 100) : '');
}

/** Número por extenso (inteiros até bilhões), no padrão brasileiro. */
export function extenso(n) {
  n = Math.floor(Math.abs(n));
  if (n < 1000) return ate999(n);
  const partes = [];
  const grupos = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']];
  let resto = n;
  for (const [base, sing, plur] of grupos) {
    const q = Math.floor(resto / base);
    if (!q) continue;
    partes.push(base === 1e3 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? sing : plur}`);
    resto %= base;
  }
  if (resto) partes.push(ate999(resto));
  // "e" antes do último grupo quando ele é < 100 ou centena exata (dois mil e vinte; mil e quinhentos)
  if (partes.length > 1 && (resto < 100 || resto % 100 === 0)) {
    const ult = partes.pop();
    return partes.join(' ') + ' e ' + ult;
  }
  return partes.join(' ');
}

function romano(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]], b = v[s[i + 1]] || 0;
    t += a < b ? -a : a;
  }
  return t;
}

const num = (s) => parseInt(String(s).replace(/\./g, ''), 10);

/** Ordinal até 9 (1º primeiro), cardinal a partir de 10 — leitura usual de artigos e parágrafos. */
const ordinalLegal = (n, fem = false) => (n <= 9 ? (fem ? ORD_F : ORD)[n] : extenso(n));

// siglas que a voz costuma ler mal
const SIGLAS = {
  LINDB: 'Lindibê', STF: 'ésse tê éfe', STJ: 'ésse tê jota', TCU: 'tê cê u', TCE: 'tê cê é',
  TSE: 'tê ésse é', TRE: 'tê érre é', CF: 'Constituição Federal', LIA: 'Lei de Improbidade',
  CPC: 'cê pê cê', CLT: 'cê éle tê', LRF: 'Lei de Responsabilidade Fiscal', MP: 'Ministério Público',
};

/**
 * Converte um token escrito em palavras faladas, olhando o contexto anterior.
 * Devolve string (pode ter várias palavras) ou null se o token fica igual.
 */
function falarToken(tok, ant, ant2) {
  const m0 = tok.match(/^([("“]*)(.*?)([)"”.,;:!?]*)$/);
  const [, pre, nucleo, pos] = m0;
  const p = (s) => pre + s + pos;
  const baseAnt = (ant || '').toLowerCase().replace(/[^\p{L}º§]/gu, '');
  if (!nucleo) return null;
  // nº 14.230/2021  |  14.230/2021
  let m = nucleo.match(/^(\d{1,3}(?:\.\d{3})*)\/(\d{2,4})$/);
  if (m) return p(`${extenso(num(m[1]))}, de ${extenso(num(m[2].length === 2 ? '19' + m[2] : m[2]))}`);
  if (/^n[º°]$/i.test(nucleo) || /^n\.$/i.test(nucleo + pos.slice(0, 1)) && pos.startsWith('.') && nucleo === 'n') return p('número');
  if (/^arts?\.$/i.test(nucleo + pos.slice(0, 1)) || /^arts?$/i.test(nucleo) && pos.startsWith('.'))
    return pre + (nucleo.toLowerCase() === 'arts' ? 'artigos' : 'artigo') + pos.slice(1);
  if (nucleo === '§') return p('parágrafo');
  if (nucleo === '§§') return p('parágrafos');
  if (/^inc\.?$/i.test(nucleo)) return p('inciso');
  // ordinais: 1º, 2ª
  m = nucleo.match(/^(\d+)([º°ª])$/);
  if (m) return p(ordinalLegal(num(m[1]), m[2] === 'ª'));
  // número logo após art. / § : 10 -> dez (cardinal), 1 -> primeiro
  m = nucleo.match(/^(\d{1,4})(-[A-Z])?$/);
  if (m && /^(artigo|artigos|art|arts|§|parágrafo)$/.test(baseAnt)) {
    const n = num(m[1]);
    return p(ordinalLegal(n) + (m[2] ? ' ' + m[2].slice(1).toLowerCase() : ''));
  }
  // percentuais e dinheiro
  m = nucleo.match(/^(\d{1,3}(?:\.\d{3})*)(?:,(\d+))?%$/);
  if (m) return p(`${extenso(num(m[1]))}${m[2] ? ' vírgula ' + extenso(num(m[2])) : ''} por cento`);
  if (/^R\$$/.test(nucleo)) return '';
  m = nucleo.match(/^(\d{1,3}(?:\.\d{3})*)(?:,(\d{2}))?$/);
  if (m && ant === 'R$') {
    const reais = num(m[1]);
    return p(`${extenso(reais)} ${reais === 1 ? 'real' : 'reais'}${m[2] && num(m[2]) ? ' e ' + extenso(num(m[2])) + ' centavos' : ''}`);
  }
  // incisos em romano: depois de "inciso" ou de "art. 5º," / "1º,"
  m = nucleo.match(/^([IVXLC]+)$/);
  if (m && (baseAnt === 'inciso' || baseAnt === 'incisos')) return p(extenso(romano(m[1])));
  if (m && /[º\d],$/.test(ant || '')) return p('inciso ' + extenso(romano(m[1])));
  // números comuns (inclui anos)
  m = nucleo.match(/^(\d{1,3}(?:\.\d{3})+|\d+)$/);
  if (m) return p(extenso(num(m[1])));
  // siglas
  if (SIGLAS[nucleo]) return p(SIGLAS[nucleo]);
  return null;
}

/**
 * Prepara uma fala: devolve { escrito: [tokens], falado: string, mapa: [nº de palavras faladas por token] }.
 */
export function preparar(texto) {
  const escrito = String(texto).split(/\s+/).filter(Boolean);
  const faladas = [];
  const mapa = [];
  escrito.forEach((tok, i) => {
    const f = falarToken(tok, escrito[i - 1], escrito[i - 2]);
    const palavras = (f === null ? tok : f).split(/\s+/).filter(Boolean);
    mapa.push(palavras.length);
    faladas.push(...palavras);
  });
  return { escrito, falado: faladas.join(' '), mapa };
}

/** Converte tempos por palavra falada em tempos por token escrito (para a legenda). */
export function tempoEscrito(prep, tempos) {
  const res = [];
  let j = 0;
  prep.escrito.forEach((tok, i) => {
    const n = prep.mapa[i];
    if (!n) {
      // token sem fala (ex.: "R$"): cola no próximo
      const prox = tempos[j] || tempos[tempos.length - 1];
      res.push({ p: tok, t0: prox.t0, t1: prox.t0 + 0.01 });
      return;
    }
    const ini = tempos[j], fim = tempos[Math.min(j + n - 1, tempos.length - 1)];
    res.push({ p: tok, t0: ini.t0, t1: fim.t1 });
    j += n;
  });
  return res;
}
