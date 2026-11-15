"""Banco de precedentes da LAI.
1. Decisões da CGU (3ª instância) e da CMRI (4ª instância) — dados abertos da CGU, atualização mensal.
2. Decisões da própria PGE-AM (recursos de 1ª e 2ª instância), mantidas à mão em fontes/precedentes_pge.csv.
Gera data/precedentes.json."""
import csv, io, json, os
from comum import RAIZ, DADOS, baixar, salvar, hoje

URL = 'https://dadosabertos-download.cgu.gov.br/BuscaPrecedentes/BuscaPrecedentes.csv'
PGE = os.path.join(RAIZ, 'fontes', 'precedentes_pge.csv')

def ler(bruto):
    for enc in ('utf-8-sig', 'latin-1'):
        try: t = bruto.decode(enc); break
        except UnicodeDecodeError: pass
    sep = ';' if t[:2000].count(';') > t[:2000].count(',') else ','
    return list(csv.DictReader(io.StringIO(t), delimiter=sep))

def campo(r, *chaves):
    for k, v in r.items():
        kk = (k or '').strip().lower()
        if any(c in kk for c in chaves): return (v or '').strip()
    return ''

def data_iso(s):
    s = s[:10]
    if len(s) == 10 and s[2] == '/': return f'{s[6:]}-{s[3:5]}-{s[:2]}'
    return s

def main():
    saida = os.path.join(DADOS, 'precedentes.json')
    antigo = json.load(open(saida, encoding='utf-8')) if os.path.exists(saida) else {}
    cgu = antigo.get('cgu', [])
    try:
        linhas = ler(baixar(URL))
        cgu = [[campo(r, 'nup'), campo(r, 'rg'), data_iso(campo(r, 'data')), campo(r, 'tipo'),
                campo(r, 'inst'), campo(r, 'link', 'arquivo')] for r in linhas]
        cgu.sort(key=lambda x: x[2], reverse=True)
        print(f'  CGU/CMRI: {len(cgu)} decisões')
    except Exception as e:
        print('  CGU/CMRI: falhou, mantidos os dados anteriores —', e)
    pge = []
    if os.path.exists(PGE):
        for r in csv.DictReader(open(PGE, encoding='utf-8-sig'), delimiter=';'):
            pge.append({k: (v or '').strip() for k, v in r.items()})
    salvar('precedentes.json', {'atualizado_em': hoje(), 'fonte_cgu': URL,
           'colunas_cgu': ['nup', 'orgao', 'data', 'tipo_decisao', 'instancia', 'link'], 'cgu': cgu, 'pge': pge})

if __name__ == '__main__':
    main()
