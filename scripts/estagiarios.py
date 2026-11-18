"""Listas de estagiários e residentes jurídicos da PGE a partir da relação de
pagamentos do Portal da Transparência do Amazonas (Despesas > Pagamentos).

A classificação é feita pela NATUREZA DE DESPESA, que já separa as duas categorias:
  - 33903607  Estagiários
  - 33903648  Bolsas Auxílio para Residentes Jurídicos
O valor da bolsa (≈1.500 estagiário / ≈3.300 residente) é usado só como conferência.

Observação honesta: a coluna "data" do pagamento é a data da ordem bancária (OB),
NÃO a competência da bolsa. Por isso a lista de um mês = favorecidos PAGOS naquele
mês, o que é quase igual — mas não idêntico — à lista por vínculo (um pagamento
proporcional, retroativo ou atrasado pode cair em outro mês). Os valores mensais
("valor pago") são reais, independentemente da competência.

Fonte do CSV: exportação da "relação de pagamentos" (um clique no portal). O arquivo
bruto fica em fontes/pagamentos/ (fora do repositório); aqui gravamos só agregados e
os nomes — que já são públicos nas listas mensais da PGE. CPF não é armazenado.
"""
import csv, glob, os
from collections import defaultdict
from datetime import date
from comum import RAIZ, salvar, hoje

PASTA = os.path.join(RAIZ, 'fontes', 'pagamentos')
UG_PGE = '011103'
NAT = {'33903607': 'estagiarios', '33903648': 'residentes'}
NAT_NOME = {'estagiarios': '33903607 Estagiários',
            'residentes': '33903648 Bolsas Auxílio para Residentes Jurídicos'}
MES = {'01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril', '05': 'Maio',
       '06': 'Junho', '07': 'Julho', '08': 'Agosto', '09': 'Setembro', '10': 'Outubro',
       '11': 'Novembro', '12': 'Dezembro'}


def num(s):
    try:
        return float(str(s or '0').strip().replace('.', '').replace(',', '.'))
    except (ValueError, TypeError):
        return 0.0


def arquivo_recente():
    fs = sorted(glob.glob(os.path.join(PASTA, '*.[cC][sS][vV]')), key=os.path.getmtime)
    return fs[-1] if fs else None


def ler(caminho):
    for enc in ('latin-1', 'cp1252', 'utf-8-sig'):
        try:
            with open(caminho, encoding=enc, newline='') as f:
                return list(csv.DictReader(f, delimiter=';'))
        except UnicodeDecodeError:
            continue
    raise RuntimeError('Não consegui ler o CSV de pagamentos (codificação).')


def gerar(caminho):
    linhas = ler(caminho)
    # por mês e categoria: {mes: {cat: {nome: valor_somado}}}
    meses = defaultdict(lambda: {'estagiarios': defaultdict(float), 'residentes': defaultdict(float)})
    for r in linhas:
        if (r.get('Cód. Órgão') or '').strip() != UG_PGE:
            continue
        cat = NAT.get((r.get('Cód. Natureza de Despesa') or '').strip())
        if not cat:
            continue
        d = (r.get('data') or '').strip()          # DD/MM/AAAA
        if len(d) != 10:
            continue
        mes = d[6:10] + '-' + d[3:5]
        nome = ' '.join((r.get('Favorecido') or '').split()).strip()
        if not nome:
            continue
        meses[mes][cat][nome] += num(r.get('pago'))

    ordenados = sorted(meses)
    if not ordenados:
        raise RuntimeError('Nenhum pagamento de estágio/residência encontrado no CSV.')

    # mês de referência para as listas nominais: o mês mais recente que não seja o
    # mês-calendário corrente (que costuma estar incompleto na data da exportação).
    corrente = date.today().strftime('%Y-%m')
    candidatos = [m for m in ordenados if m != corrente] or ordenados
    ref = candidatos[-1]

    serie = []
    for m in ordenados:
        est, res = meses[m]['estagiarios'], meses[m]['residentes']
        serie.append([m, MES[m[5:7]][:3], len(est), len(res),
                      round(sum(est.values()), 2), round(sum(res.values()), 2)])

    def roster(cat):
        return sorted(meses[ref][cat].keys(), key=lambda n: n.casefold())

    dados = {
        'atualizado_em': hoje(),
        'fonte': 'Portal da Transparência do Amazonas — Despesas > Pagamentos (relação de pagamentos), UG 011103 (PGE)',
        'licenca': 'Dados públicos',
        'naturezas': NAT_NOME,
        'valor_bolsa': {'estagiarios': 1500.0, 'residentes': 3300.0},
        'referencia': ref,
        'referencia_rotulo': MES[ref[5:7]] + '/' + ref[:4],
        'gerado_de': os.path.basename(caminho),
        'serie_mensal': serie,
        'estagiarios': roster('estagiarios'),
        'residentes': roster('residentes'),
    }
    salvar('estagiarios.json', dados)
    print(f'estagiários/residentes: ref {dados["referencia_rotulo"]} — '
          f'{len(dados["estagiarios"])} estagiários, {len(dados["residentes"])} residentes '
          f'(fonte {dados["gerado_de"]})')
    return dados


def main():
    caminho = arquivo_recente()
    if not caminho:
        print('estagiarios.py: nenhum CSV em fontes/pagamentos/ — preservando dado anterior.')
        return
    gerar(caminho)


if __name__ == '__main__':
    main()
