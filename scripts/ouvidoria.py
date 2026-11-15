"""Atualiza data/ouvidoria.json com a base de manifestações de ouvidoria da CGU (Painel Resolveu? / Fala.BR).

Fontes, em ordem:
  1. Variável OUVIDORIA_URLS (configurada no GitHub): um ou mais links .zip/.csv separados por espaço,
     copiados da área de dados abertos do Painel Resolveu?.
  2. Arquivos colocados à mão na pasta fontes/ouvidoria/ (Manifestacoes_Ouvidoria_AAAA.csv ou .zip).
Se nenhuma fonte estiver disponível, o arquivo atual é mantido.
"""
import glob, io, os, zipfile, json
import pandas as pd
from comum import RAIZ, baixar, salvar

ORGAO = 'Procuradoria Geral do Estado - PGE'
UF = 'AM'

def ler_csv(bruto):
    df = pd.read_csv(io.BytesIO(bruto), sep=';', dtype=str, encoding='latin-1')
    df.columns = [c.strip().lower().replace('órgão', 'orgao').replace('Órgão'.lower(), 'orgao') for c in df.columns]
    return df

def carregar():
    blobs = []
    for u in os.environ.get('OUVIDORIA_URLS', '').split():
        print('  baixando', u); blobs.append((u, baixar(u)))
    for p in glob.glob(os.path.join(RAIZ, 'fontes', 'ouvidoria', '*')):
        blobs.append((p, open(p, 'rb').read()))
    partes = []
    for nome, b in blobs:
        if nome.lower().endswith('.zip'):
            z = zipfile.ZipFile(io.BytesIO(b))
            for n in z.namelist():
                if n.lower().endswith('.csv'): partes.append(ler_csv(z.read(n)))
        else:
            partes.append(ler_csv(b))
    return pd.concat(partes, ignore_index=True) if partes else None

def vc(s, n=10):
    s = s.fillna('Não informado').replace({'—': 'Não informado', 'Não Informado': 'Não Informado'})
    return [[k, int(v)] for k, v in s.value_counts().head(n).items()]

def main():
    d = carregar()
    if d is None:
        print('Ouvidoria: nenhuma fonte configurada — mantido o arquivo atual.'); return
    col = lambda k: next(c for c in d.columns if c.startswith(k))
    d = d[(d[col('uf do orgao')] == UF) & (d[col('esfera')] == 'Estadual')].copy()
    for c in ('data registro', 'data prazo resposta', 'data resposta'):
        d[c] = pd.to_datetime(d[c], format='%d/%m/%Y', errors='coerce')
    d['ano'] = d['data registro'].dt.year.astype('Int64').astype(str)
    d['dias'] = pd.to_numeric(d['dias para resolução'], errors='coerce')
    d['noprazo'] = d['data resposta'] <= d['data prazo resposta']
    d['mes'] = d['data registro'].dt.strftime('%Y-%m')
    org = col('nome orgao')
    p = d[d[org] == ORGAO]
    o = {'n': len(p), 'n_estado': len(d)}
    o['anos'] = [[a, int(len(g)), round(float(g['dias'].median()), 1), round(float(g['noprazo'].mean() * 100), 1)] for a, g in p.groupby('ano')]
    o['anos_estado'] = {a: [int(len(g)), round(float(g['dias'].median()), 1), round(float(g['noprazo'].mean() * 100), 1)] for a, g in d.groupby('ano')}
    o['tipo'] = vc(p['tipo manifestação']); o['assunto'] = vc(p['assunto'], 12); o['form'] = vc(p['formulário'])
    o['genero'] = vc(p['gênero']); o['raca'] = vc(p['raça/cor']); o['mun'] = vc(p['município manifestante'], 8)
    o['sat'] = vc(p['satisfação']); o['atend'] = vc(p['demanda atendida'])
    o['tipo_dias'] = [[t, round(float(g['dias'].median()), 1), round(float(g['dias'].mean()), 1)] for t, g in p.groupby('tipo manifestação')]
    o['prazo'] = round(float(p['noprazo'].mean() * 100), 1); o['prazo_estado'] = round(float(d['noprazo'].mean() * 100), 1)
    o['med'] = float(p['dias'].median()); o['med_estado'] = float(d['dias'].median()); o['media'] = round(float(p['dias'].mean()), 1)
    r = d[org].value_counts(); o['rank'] = int(list(r.index).index(ORGAO) + 1); o['norgaos'] = int(len(r))
    b = pd.cut(p['dias'], [-1, 10, 20, 30, 60, 10**6], labels=['até 10', '11–20', '21–30', '31–60', 'mais de 60'])
    o['faixas'] = [[str(k), int(v)] for k, v in b.value_counts().sort_index().items()]
    fim = p['data registro'].max().to_period('M')
    idx = pd.period_range(fim - 23, fim, freq='M').strftime('%Y-%m'); m = p.groupby('mes').size()
    o['mes'] = [[i, int(m.get(i, 0))] for i in idx]
    o['ultima'] = str(p['data registro'].max().date()); o['primeira'] = str(p['data registro'].min().date())
    o['tipo_ano'] = {a: {t: int(v) for t, v in g['tipo manifestação'].value_counts().items()} for a, g in p.groupby('ano')}
    o['ass_ano'] = {a: {k: int(v) for k, v in g['assunto'].value_counts().head(8).items()} for a, g in p.groupby('ano')}
    o['top_org'] = [[k, int(v)] for k, v in r.head(8).items()]
    salvar('ouvidoria.json', o)

if __name__ == '__main__':
    main()
