"""Pesquisa de preços de mercado para a Gerência de Material.
Consulta os Preços Praticados do Compras.gov.br (dados abertos, SEGES/MGI) para os itens
listados em fontes/itens_precos.txt (uma linha: tipo;codigo;rotulo). Calcula a estatística
da IN SEGES/ME 65/2021 e grava data/precos.json.
A API roda do lado do servidor (Colab/GitHub Actions) — não tem CORS, então não funciona
direto do navegador. Sem rede, reusa o cache em fontes/precos_cache/<codigo>.json."""
import json, os, statistics as st, urllib.parse, urllib.request
from comum import RAIZ, DADOS, hoje

BASE = 'https://dadosabertos.compras.gov.br'
EP = {'material': '/modulo-pesquisa-preco/1_consultarMaterial',
      'servico': '/modulo-pesquisa-preco/3_consultarServico'}
LISTA = os.path.join(RAIZ, 'fontes', 'itens_precos.txt')
CACHE = os.path.join(RAIZ, 'fontes', 'precos_cache')
INI, FIM = '2024-01-01', hoje()

def baixar_precos(tipo, codigo):
    ep, reg, pagina = EP[tipo], [], 1
    while True:
        q = {'pagina': pagina, 'tamanhoPagina': 500, 'dataCompraInicio': INI, 'dataCompraFim': FIM}
        if tipo == 'material': q['tipo'] = 'codigoItemCatalogo'
        q['codigo' if tipo == 'material' else 'codigoItemCatalogo'] = codigo
        url = f'{BASE}{ep}?' + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'painel-pge-am/1.0'})
        with urllib.request.urlopen(req, timeout=90) as r:
            j = json.loads(r.read())
        reg += j.get('resultado', [])
        if pagina >= j.get('totalPaginas', 1): break
        pagina += 1
    return reg

def registros(tipo, codigo):
    cache = os.path.join(CACHE, f'{codigo}.json')
    try:
        reg = baixar_precos(tipo, codigo)
        if reg:
            os.makedirs(CACHE, exist_ok=True)
            json.dump(reg, open(cache, 'w', encoding='utf-8'), ensure_ascii=False)
        return reg, 'api'
    except Exception as e:
        if os.path.exists(cache):
            print(f'  item {codigo}: API falhou ({e}); usando cache.')
            return json.load(open(cache, encoding='utf-8')), 'cache'
        print(f'  item {codigo}: API falhou e sem cache — {e}'); return [], 'erro'

def estat(valores):
    v = sorted(x for x in valores if (x or 0) > 0)
    if not v: return None
    media, mediana = st.mean(v), st.median(v)
    dp = st.pstdev(v) if len(v) > 1 else 0.0
    cv = dp / media * 100 if media else 0
    li, ls = media - dp, media + dp
    san = [x for x in v if li <= x <= ls] or v
    m2 = st.mean(san); md2 = st.median(san)
    dp2 = st.pstdev(san) if len(san) > 1 else 0.0
    cv2 = dp2 / m2 * 100 if m2 else 0
    ref = md2 if cv2 > 25 else m2
    return {'n': len(v), 'menor': round(min(v), 4), 'maior': round(max(v), 4),
            'media': round(media, 4), 'mediana': round(mediana, 4), 'cv': round(cv, 1),
            'n_saneada': len(san), 'media_saneada': round(m2, 4), 'mediana_saneada': round(md2, 4),
            'cv_saneada': round(cv2, 1), 'referencia': round(ref, 4),
            'metodo': 'mediana (alta dispersão)' if cv2 > 25 else 'média'}

def main():
    if not os.path.exists(LISTA):
        print('Preços: fontes/itens_precos.txt não encontrado.'); return
    itens = []
    for ln in open(LISTA, encoding='utf-8'):
        ln = ln.strip()
        if not ln or ln.startswith('#'): continue
        p = [x.strip() for x in ln.split(';')]
        tipo, codigo = p[0], p[1]; rotulo = p[2] if len(p) > 2 else ''
        reg, origem = registros(tipo, codigo)
        e = estat([r.get('precoUnitario') for r in reg])
        tab = [[r.get('dataResultado', ''), r.get('precoUnitario'), r.get('nomeUnidadeFornecimento', ''),
                r.get('marca', '') or '', r.get('nomeFornecedor', ''), r.get('nomeOrgao', ''), r.get('estado', '')]
               for r in sorted(reg, key=lambda x: x.get('precoUnitario') or 0)]
        itens.append({'tipo': tipo, 'codigo': codigo, 'rotulo': rotulo,
                      'descricao': reg[0].get('descricaoItem', '') if reg else '',
                      'origem': origem, 'estat': e, 'compras': tab[:200]})
        print(f'  {codigo} ({rotulo or "?"}): {e["n"] if e else 0} preços · ref {e["referencia"] if e else "—"}')
    json.dump({'atualizado_em': hoje(), 'periodo': [INI, FIM],
               'fonte': 'Compras.gov.br — Preços Praticados (dados abertos)', 'itens': itens},
              open(os.path.join(DADOS, 'precos.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('  gravado precos.json')

if __name__ == '__main__':
    main()
