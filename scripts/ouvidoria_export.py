"""Atualiza data/ouvidoria.json a partir da EXPORTAÇÃO do Fala.BR (planilha .xlsx
'Export', uma linha por manifestação da PGE como órgão destinatário).

Esta é a base completa das manifestações da PGE (muito maior que a base pública do
'Painel Resolveu?'), mas é só da PGE: não traz comparação com o Estado nem os campos
de perfil (gênero, raça, satisfação, formulário). Em troca, traz canal de entrada e
resolutividade. O arquivo bruto fica em fontes/ouvidoria/ (gitignored); se não houver
export novo, o data/ouvidoria.json anterior é preservado.

Roda depois de ouvidoria.py no pipeline: quando há um export, ele é a fonte que vale.
"""
import glob, os
from collections import Counter, defaultdict
from datetime import datetime
import openpyxl
from comum import RAIZ, salvar, hoje

PASTA = os.path.join(RAIZ, 'fontes', 'ouvidoria')
ORG = 'Procuradoria Geral do Estado'


def achar_export():
    fs = [p for p in glob.glob(os.path.join(PASTA, '*.xlsx')) if not os.path.basename(p).startswith('~$')]
    return max(fs, key=os.path.getmtime) if fs else None


def _dt(v):
    return v if isinstance(v, datetime) else None


def top(cont, n=None):
    itens = cont.most_common(n)
    return [[k if k else 'Não informado', int(v)] for k, v in itens]


def gerar(caminho):
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    ws = wb['Export'] if 'Export' in wb.sheetnames else wb.worksheets[0]
    linhas = list(ws.iter_rows(values_only=True))
    hdr = [h for h in linhas[0]]
    idx = {}
    for i, h in enumerate(hdr):
        if h:
            idx[h] = i

    def ci(prefixo):
        for h, i in idx.items():
            if h.startswith(prefixo):
                return i
        return None

    cOrg = ci('Órgão Destinat'); cTipo = ci('Tipo'); cAss = ci('Assunto')
    cAb = ci('Data de Abertura'); cPz = ci('Prazo de Resp'); cResp = ci('Data Resp')
    cResol = ci('Resolutividade'); cCanal = ci('Canal de Entrada'); cMun = ci('Município do Local')
    cSit = ci('Situação')

    def g(r, i):
        return r[i] if (i is not None and i < len(r)) else None

    regs = []
    for r in linhas[1:]:
        org = g(r, cOrg); ab = _dt(g(r, cAb))
        if not org or not str(org).startswith(ORG) or ab is None:
            continue  # ignora rodapé "Filtros aplicados" e linhas vazias
        resp = _dt(g(r, cResp)); pz = _dt(g(r, cPz))
        dias = (resp - ab).days if resp else None
        noprazo = (resp <= pz) if (resp and pz) else None
        regs.append({
            'ano': str(ab.year), 'mes': ab.strftime('%Y-%m'),
            'tipo': (g(r, cTipo) or 'Não informado'),
            'assunto': (g(r, cAss) or 'Não informado'),
            'municipio': (g(r, cMun) or 'Não informado'),
            'canal': (g(r, cCanal) or 'Não informado'),
            'resol': (g(r, cResol) or '').strip(),
            'situacao': (g(r, cSit) or 'Não informado'),
            'dias': dias, 'noprazo': noprazo, 'data': ab,
        })
    if not regs:
        raise RuntimeError('Export do Fala.BR sem manifestações da PGE.')

    def mediana(xs):
        xs = sorted(x for x in xs if x is not None)
        if not xs:
            return None
        m = len(xs) // 2
        return (xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2)

    anos_ord = sorted({r['ano'] for r in regs})
    anos = []
    for a in anos_ord:
        g_ = [r for r in regs if r['ano'] == a]
        md = mediana([r['dias'] for r in g_])
        np_ = [r['noprazo'] for r in g_ if r['noprazo'] is not None]
        pct = round(sum(np_) / len(np_) * 100, 1) if np_ else 0.0
        anos.append([a, len(g_), round(md, 1) if md is not None else 0.0, pct])

    tipos = Counter(r['tipo'] for r in regs)
    tipo_dias = []
    for t in tipos:
        dd = [r['dias'] for r in regs if r['tipo'] == t]
        md = mediana(dd); mm = [x for x in dd if x is not None]
        tipo_dias.append([t, round(md, 1) if md is not None else 0.0,
                          round(sum(mm) / len(mm), 1) if mm else 0.0])

    todos_dias = [r['dias'] for r in regs if r['dias'] is not None]
    np_all = [r['noprazo'] for r in regs if r['noprazo'] is not None]
    faixas_lbl = [('até 10', -1, 10), ('11–20', 10, 20), ('21–30', 20, 30), ('31–60', 30, 60), ('mais de 60', 60, 10**9)]
    faixas = [[lbl, sum(1 for d in todos_dias if lo < d <= hi)] for lbl, lo, hi in faixas_lbl]

    # série dos últimos 24 meses
    fim = max(r['data'] for r in regs)
    meses_idx = []
    y, mo = fim.year, fim.month
    for _ in range(24):
        meses_idx.append(f'{y:04d}-{mo:02d}')
        mo -= 1
        if mo == 0:
            mo = 12; y -= 1
    meses_idx = list(reversed(meses_idx))
    mcount = Counter(r['mes'] for r in regs)
    mes = [[m, int(mcount.get(m, 0))] for m in meses_idx]

    resol_sim = sum(1 for r in regs if r['resol'].lower() == 'sim')
    resol_nao = sum(1 for r in regs if r['resol'].lower() == 'não' or r['resol'].lower() == 'nao')
    resol_base = resol_sim + resol_nao

    o = {
        'atualizado_em': hoje(),
        'fonte': 'Exportação do Fala.BR (CGU) — manifestações com a PGE-AM como órgão destinatário',
        'n': len(regs),
        'anos': anos,
        'tipo': top(tipos),
        'assunto': top(Counter(r['assunto'] for r in regs), 12),
        'mun': top(Counter(r['municipio'] for r in regs), 8),
        'canal': top(Counter(r['canal'] for r in regs)),
        'situacao': top(Counter(r['situacao'] for r in regs)),
        'resolut': [['Resolvida', resol_sim], ['Não resolvida', resol_nao],
                    ['Sem informação', len(regs) - resol_base]],
        'resolut_pct': round(resol_sim / resol_base * 100, 1) if resol_base else 0.0,
        'resolut_base': resol_base,
        'tipo_dias': tipo_dias,
        'prazo': round(sum(np_all) / len(np_all) * 100, 1) if np_all else 0.0,
        'med': mediana(todos_dias) or 0.0,
        'media': round(sum(todos_dias) / len(todos_dias), 1) if todos_dias else 0.0,
        'faixas': faixas,
        'mes': mes,
        'ultima': str(fim.date()),
        'primeira': str(min(r['data'] for r in regs).date()),
        'tipo_ano': {a: {t: int(c) for t, c in Counter(r['tipo'] for r in regs if r['ano'] == a).most_common()} for a in anos_ord},
        'ass_ano': {a: {t: int(c) for t, c in Counter(r['assunto'] for r in regs if r['ano'] == a).most_common(8)} for a in anos_ord},
    }
    salvar('ouvidoria.json', o)
    print(f'ouvidoria_export: {len(regs)} manifestações da PGE ({o["primeira"]} a {o["ultima"]}) → data/ouvidoria.json')


def main():
    caminho = achar_export()
    if not caminho:
        print('ouvidoria_export: nenhum .xlsx em fontes/ouvidoria/ — mantido o data/ouvidoria.json anterior.')
        return
    gerar(caminho)


if __name__ == '__main__':
    main()
