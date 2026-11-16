"""Gera data/contratos.json a partir dos exports do Portal SGC
(Sistema de Gestão de Contratos / SEFAZ-AM).
Órgãos: PGE (UG 011103) e FUNDPGE (UG 011706).

Marca cada termo como vigente/encerrado a partir da data de Término,
tendo a data de hoje como referência. Os CSVs são baixados do portal
manualmente (não há API aberta) e deixados em fontes/contratos_*.csv."""
import csv, glob, os, re
from datetime import date
import comum

def num(s):
    s = (s or '').strip().replace('.', '').replace(',', '.')
    try: return round(float(s), 2)
    except Exception: return 0.0

def dt(s):
    s = (s or '').strip()
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', s)
    return f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else ''

def limpa(s):
    """Colapsa o excesso de espaços/tabs do campo Termo do portal."""
    return re.sub(r'\s+', ' ', (s or '').strip())

TIPOS = {  # prefixo do termo -> rótulo
    'CT': 'Contrato', 'NE': 'Nota de empenho', 'CV': 'Convênio', 'ACo': 'Acordo',
    'TCT': 'Termo de cooperação', 'TC': 'Termo de cooperação', 'TCom': 'Comodato',
    'TD': 'Termo de doação', 'PI': 'Protocolo de intenções', 'PC': 'Protocolo',
}

def processar(caminhos, hoje):
    itens, vistos = [], set()
    for cam in caminhos:
        with open(cam, encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                termo_bruto = limpa(r.get('Termo'))
                m = re.match(r'([A-Za-z]+)\s+(\d+/\d+)', termo_bruto)
                sigla = m.group(1) if m else ''
                termo = f'{sigla} {m.group(2)}' if m else termo_bruto[:20]
                adit = re.search(r'(\d+)\s*aditivo', termo_bruto)
                ocor = re.search(r'(\d+)\s*ocorr', termo_bruto)
                fim = dt(r.get('Término'))
                chave = (r.get('UG'), termo, r.get('CNPJ/CPFfornecedor'), r.get('Início'))
                if chave in vistos: continue
                vistos.add(chave)
                vigente = (fim >= hoje) if fim else True  # sem término = em aberto
                itens.append({
                    'org': 'FUNDPGE' if (r.get('Nome UG') or '').strip().upper().startswith('FUND') else 'PGE',
                    'termo': termo, 'sigla': sigla, 'tipo': TIPOS.get(sigla, 'Outro'),
                    'processo': (r.get('Processo e-Compras') or '').strip(),
                    'cnpj': (r.get('CNPJ/CPFfornecedor') or '').strip(),
                    'fornecedor': (r.get('Nomefornecedor') or '').strip(),
                    'inicio': dt(r.get('Início')), 'fim': fim,
                    'assinatura': dt(r.get('Dataassinatura')),
                    'objeto': (r.get('Objeto') or '').strip(),
                    'vMensal': num(r.get('Valor mensal')), 'vAtual': num(r.get('Valor atual')),
                    'local': (r.get('Local deexecução') or '').strip(),
                    'aditivos': int(adit.group(1)) if adit else 0,
                    'ocorrencias': int(ocor.group(1)) if ocor else 0,
                    'vigente': vigente,
                })
    itens.sort(key=lambda x: (not x['vigente'], x['fim'] or '9999'), reverse=False)
    return itens

def resumo(itens):
    r = {}
    for it in itens:
        o = r.setdefault(it['org'], {'total': 0, 'vigentes': 0, 'valor_vigente': 0.0})
        o['total'] += 1
        if it['vigente']:
            o['vigentes'] += 1; o['valor_vigente'] = round(o['valor_vigente'] + it['vAtual'], 2)
    return r

def main(caminhos=None):
    hoje = date.today().isoformat()
    caminhos = caminhos or sorted(glob.glob(os.path.join(comum.RAIZ, 'fontes', 'contratos_*.csv')))
    if not caminhos:
        print('contratos_sgc: nenhum CSV em fontes/contratos_*.csv — pulando'); return
    itens = processar(caminhos, hoje)
    comum.salvar('contratos.json', {
        'atualizado': comum.hoje(),
        'referencia_vigencia': hoje,
        'fonte': 'Portal SGC — Sistema de Gestão de Contratos (SEFAZ-AM)',
        'orgaos': {'PGE': '011103', 'FUNDPGE': '011706'},
        'resumo': resumo(itens),
        'itens': itens,
    })
    v = sum(1 for i in itens if i['vigente'])
    print(f'contratos_sgc: {len(itens)} termos ({v} vigentes) → data/contratos.json')

if __name__ == '__main__':
    import sys
    main(sys.argv[1:] or None)
