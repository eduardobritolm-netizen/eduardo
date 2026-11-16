"""Despesas da PGE e do FUNDPGE a partir dos Dados Abertos de Execução Orçamentária
da SEFAZ-AM. O CSV oficial é baixado automaticamente, todo dia, pela interface pública
do portal (baixar_execucao_sefaz.py, via navegador headless — o portal entrega o arquivo
como download/blob). Processa apenas as UGs 011103 (PGE) e 011706 (FUNDPGE), sem publicar
a base bruta estadual. Se a coleta falhar, usa o último CSV local e, na ausência dele,
preserva o data/despesas.json anterior. Licença da fonte: CC BY-NC 4.0."""
import csv, glob, os
from collections import defaultdict
from comum import RAIZ, salvar, hoje
from baixar_execucao_sefaz import baixar

UG = {'011103': 'PGE', '011706': 'FUNDPGE'}
PASTA = os.path.join(RAIZ, 'fontes', 'sefaz')
MES = {'01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez'}

def num(s):
    try:
        v = str(s or '0').strip().strip('"').replace(' ', '')
        if ',' in v and '.' in v: v = v.replace('.', '').replace(',', '.')  # 1.234.567,89 -> 1234567.89
        elif ',' in v: v = v.replace(',', '.')                              # 1234,56 -> 1234.56
        return float(v or 0)
    except (ValueError, TypeError): return 0.0

def arquivo_local():
    fs = sorted(glob.glob(os.path.join(PASTA, '*.csv')), key=os.path.getmtime)
    return fs[-1] if fs else None

def obter_csv():
    """Baixa o CSV oficial do dia; se falhar, cai para o último CSV local.
    Retorna None quando não há nenhuma fonte — aí o despesas.json anterior é preservado."""
    try:
        return baixar()
    except Exception as e:
        print(f'SEFAZ execução: download automático falhou ({type(e).__name__}: {str(e)[:120]})')
        local = arquivo_local()
        if local:
            print(f'SEFAZ execução: usando o último CSV local — {os.path.basename(local)}')
        return local

def ler(caminho):
    for enc in ('cp1252', 'latin-1', 'utf-8-sig'):
        try:
            with open(caminho, encoding=enc, newline='') as f:
                amostra = f.read(8192); f.seek(0)
                delim = ';' if amostra.count(';') >= amostra.count(',') else ','
                return [r for r in csv.DictReader(f, delimiter=delim)
                        if (r.get('codUnidadeGestora') or '').strip().strip('"') in UG]
        except UnicodeDecodeError: pass
    return []

def top(rows, campo, metrica, n=10):
    d = defaultdict(float)
    for r in rows: d[r[campo].strip()] += num(r[metrica])
    return [[k, round(v, 2)] for k, v in sorted(d.items(), key=lambda x: -x[1]) if v > 0][:n]

def main():
    cam = obter_csv()
    if not cam:
        print('SEFAZ execução: sem CSV disponível — mantido o data/despesas.json anterior.'); return
    rows = ler(cam)
    if not rows:
        print('SEFAZ execução: CSV sem linhas da PGE/FUNDPGE — mantido o arquivo anterior.'); return
    norm = lambda r, c: (r.get(c) or '').strip().strip('"')
    for r in rows:  # normaliza os campos-chave usados abaixo
        r['codUnidadeGestora'] = norm(r, 'codUnidadeGestora')
        r['anoExercicio'] = norm(r, 'anoExercicio')
        r['mesReferencia'] = norm(r, 'mesReferencia').zfill(2)
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
