"""Despesas da PGE e do FUNDPGE a partir do arquivo de Execução Orçamentária do Portal da
Transparência Fiscal do Amazonas (SEFAZ). O arquivo é baixado à mão (uma vez por período) e
colocado em fontes/sefaz/ ou enviado pelo Colab — o download é protegido e não é automatizado.
Licença da fonte: CC BY-NC 4.0. Gera data/despesas.json (apenas totais agregados da PGE)."""
import csv, glob, os
from collections import defaultdict
from comum import RAIZ, salvar, hoje

UG = {'011103': 'PGE', '011706': 'FUNDPGE'}
PASTA = os.path.join(RAIZ, 'fontes', 'sefaz')
MES = {'01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez'}

def num(s): 
    try: return float(str(s).replace(',', '.') or 0)
    except ValueError: return 0.0

def arquivo():
    fs = sorted(glob.glob(os.path.join(PASTA, '*.csv')), key=os.path.getmtime)
    return fs[-1] if fs else None

def ler(caminho):
    for enc in ('latin-1', 'utf-8-sig'):
        try:
            with open(caminho, encoding=enc) as f:
                return [r for r in csv.DictReader(f, delimiter=';') if r.get('codUnidadeGestora') in UG]
        except UnicodeDecodeError: pass
    return []

def top(rows, campo, metrica, n=10):
    d = defaultdict(float)
    for r in rows: d[r[campo].strip()] += num(r[metrica])
    return [[k, round(v, 2)] for k, v in sorted(d.items(), key=lambda x: -x[1]) if v > 0][:n]

def main():
    cam = arquivo()
    if not cam:
        print('SEFAZ execução: nenhum arquivo em fontes/sefaz/ — mantido o arquivo atual.'); return
    rows = ler(cam)
    if not rows:
        print('SEFAZ execução: arquivo sem linhas da PGE/FUNDPGE.'); return
    ano = rows[0].get('anoExercicio', '')
    meses = sorted(set(r['mesReferencia'] for r in rows))
    serie = []
    for m in meses:
        mr = [r for r in rows if r['mesReferencia'] == m]
        serie.append([f'{ano}-{m}', MES.get(m, m),
                      round(sum(num(r['vaempenhado']) for r in mr), 2),
                      round(sum(num(r['valiquidado']) for r in mr), 2),
                      round(sum(num(r['vapago']) for r in mr), 2)])
    por_ug = {}
    for cod, nome in UG.items():
        u = [r for r in rows if r['codUnidadeGestora'] == cod]
        por_ug[nome] = {k: round(sum(num(r[k]) for r in u), 2) for k in
                        ('vadotacaoinicial', 'vaautorizado', 'vaempenhado', 'valiquidado', 'vapago')}
    salvar('despesas.json', {
        'atualizado_em': hoje(), 'ano': ano, 'licenca': 'CC BY-NC 4.0',
        'fonte': 'Portal da Transparência Fiscal do Amazonas (SEFAZ) — Execução Orçamentária',
        'referencia': f'{MES.get(meses[-1], meses[-1])}/{ano}',
        'totais': {k: round(sum(num(r[k]) for r in rows), 2) for k in
                   ('vadotacaoinicial', 'vaautorizado', 'vaempenhado', 'valiquidado', 'vapago')},
        'por_ug': por_ug, 'serie_mensal': serie,
        'por_elemento': top(rows, 'desElementoDespesa', 'vapago'),
        'por_funcao': top(rows, 'desFuncao', 'vapago'),
        'por_programa': top(rows, 'desPrograma', 'vapago'),
        'por_fonte': top(rows, 'desFonteMae', 'vapago'),
        'por_grupo': top(rows, 'desGrupoDespesa', 'vapago', 6)})

if __name__ == '__main__':
    main()
