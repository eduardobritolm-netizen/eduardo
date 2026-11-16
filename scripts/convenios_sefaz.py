"""Baixa as Transferências Voluntárias de Saída (convênios de repasse em que
o órgão é concedente) do sistema sisconv da SEFAZ-AM e gera data/convenios.json.
Órgãos: PGE (011103) e FUNDPGE (011706).

Endpoint (código-fonte de ConvenioTransparencia.do):
  POST https://sistemas.sefaz.am.gov.br/sisconv/ConvenioTransparencia.do
  field(coUnidadegestora)=<UG>, field(txAno)=<ano>, method=Pesquisar
O filtro exige o ano; por isso varre-se ano a ano. Página em UTF-8.

Como o host da SEFAZ não é alcançável do ambiente de desenvolvimento, este
módulo roda de fato no GitHub Actions. Em caso de falha, mantém o JSON anterior."""
import html as htmlmod, re, urllib.parse
from datetime import date
import comum

URL = 'https://sistemas.sefaz.am.gov.br/sisconv/ConvenioTransparencia.do'
UGS = {'011103': 'PGE', '011706': 'FUNDPGE'}
ANO_INICIAL = 2019

def _texto(td):
    return re.sub(r'\s+', ' ', htmlmod.unescape(re.sub(r'<[^>]+>', ' ', td))).strip()

def num(s):
    s = (s or '').strip().replace('.', '').replace(',', '.')
    try: return round(float(s), 2)
    except Exception: return 0.0

def dt(s):
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', (s or '').strip())
    return f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else ''

def parte(s):
    """'13.272780/0001-70 - AADESAM' -> (cnpj, nome)."""
    m = re.match(r'\s*([\d./-]+)\s*-\s*(.+)', s or '')
    return (m.group(1).strip(), m.group(2).strip()) if m else ('', (s or '').strip())

def parse(html, org):
    itens = []
    mt = re.search(r'<tbody>(.*?)</tbody>', html, re.S)
    if not mt:
        return itens
    for bloco in re.findall(r'<tr[^>]*role="row"[^>]*>(.*?)</tr>', mt.group(1), re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', bloco, re.S)
        if len(tds) < 10:
            continue
        vig = _texto(tds[7])
        pini, pfim = ('', '')
        mv = re.search(r'(\d{2}/\d{2}/\d{4}).*?(\d{2}/\d{2}/\d{4})', vig)
        if mv:
            pini, pfim = dt(mv.group(1)), dt(mv.group(2))
        cnpj, nome = parte(_texto(tds[6]))
        fim = pfim
        itens.append({
            'org': org,
            'plano': _texto(tds[1]),
            'termo': _texto(tds[2]),
            'concedente': _texto(tds[3]),
            'titulo': _texto(tds[4]),
            'objeto': _texto(tds[5]),
            'cnpjConvenente': cnpj, 'convenente': nome,
            'inicio': pini, 'fim': fim,
            'emenda': _texto(tds[8]),
            'valor': num(_texto(tds[9])),
            'vigente': (fim >= date.today().isoformat()) if fim else True,
        })
    return itens

def baixar(ug, ano):
    campos = {'field(idIndice)': '', 'field(coUnidadegestora)': ug,
              'field(txAno)': str(ano), 'field(csEmendaParlamentar)': '', 'method': 'Pesquisar'}
    corpo = urllib.parse.urlencode(campos).encode('utf-8')
    b = comum.baixar(URL, dados=corpo,
                     cabecalhos={'Content-Type': 'application/x-www-form-urlencoded'},
                     tentativas=3, timeout=120)
    return b.decode('utf-8', 'replace')

def main():
    itens, vistos, ok = [], set(), 0
    hoje_ano = date.today().year
    for ug, org in UGS.items():
        for ano in range(ANO_INICIAL, hoje_ano + 1):
            try:
                html = baixar(ug, ano)
                ok += 1
            except Exception as e:
                print(f'convenios_sefaz: falha {org}/{ano} ({type(e).__name__}: {str(e)[:60]})')
                continue
            for it in parse(html, org):
                chave = (it['org'], it['plano'], it['termo'])
                if chave in vistos: continue
                vistos.add(chave); itens.append(it)
    if not ok:
        print('convenios_sefaz: host inacessível; mantido data/convenios.json anterior'); return
    itens.sort(key=lambda x: (not x['vigente'], x['fim'] or ''), reverse=False)
    resumo = {}
    for it in itens:
        r = resumo.setdefault(it['org'], {'total': 0, 'vigentes': 0, 'valor': 0.0})
        r['total'] += 1; r['valor'] = round(r['valor'] + it['valor'], 2)
        if it['vigente']: r['vigentes'] += 1
    comum.salvar('convenios.json', {
        'atualizado': comum.hoje(),
        'fonte': 'sisconv — Transferências Voluntárias de Saída (SEFAZ-AM)',
        'orgaos': UGS, 'resumo': resumo, 'itens': itens,
    })
    print(f'convenios_sefaz: {len(itens)} transferências → data/convenios.json')

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        h = open(sys.argv[1], encoding='utf-8', errors='replace').read()
        ls = parse(h, 'PGE')
        print(f'linhas: {len(ls)}')
        if ls: import json; print(json.dumps(ls[0], ensure_ascii=False)[:400])
    else:
        main()
