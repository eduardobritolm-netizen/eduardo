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
    # valores pagos por mês/categoria e meses de pagamento de cada pessoa
    pago_mes = defaultdict(lambda: {'estagiarios': 0.0, 'residentes': 0.0})   # mes -> cat -> R$
    meses_pessoa = {'estagiarios': defaultdict(set), 'residentes': defaultdict(set)}  # cat -> nome -> {meses}
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
        pago_mes[mes][cat] += num(r.get('pago'))
        meses_pessoa[cat][nome].add(mes)

    ordenados = sorted(pago_mes)
    if not ordenados:
        raise RuntimeError('Nenhum pagamento de estágio/residência encontrado no CSV.')

    # Roster de cada mês: pessoa ativa quando o mês está ENTRE o primeiro e o último
    # pagamento observado (preenche lacunas de competência paga com atraso — ex.: a
    # bolsa de agosto que cai numa OB de setembro). Só o período observado é usado.
    def rosters(cat):
        out = {m: [] for m in ordenados}
        for nome, ms in meses_pessoa[cat].items():
            lo, hi = min(ms), max(ms)
            for m in ordenados:
                if lo <= m <= hi:
                    out[m].append(nome)
        for m in out:
            out[m] = sorted(out[m], key=lambda n: n.casefold())
        return out

    r_est, r_res = rosters('estagiarios'), rosters('residentes')

    # mês de referência: o mês mais recente que não seja o mês-calendário corrente
    # (que costuma estar incompleto na data da exportação).
    corrente = date.today().strftime('%Y-%m')
    candidatos = [m for m in ordenados if m != corrente] or ordenados
    ref = candidatos[-1]

    serie = [[m, MES[m[5:7]][:3], len(r_est[m]), len(r_res[m]),
              round(pago_mes[m]['estagiarios'], 2), round(pago_mes[m]['residentes'], 2)]
             for m in ordenados]
    listas = {m: {'estagiarios': r_est[m], 'residentes': r_res[m]} for m in ordenados}

    dados = {
        'atualizado_em': hoje(),
        'fonte': 'Portal da Transparência do Amazonas — Despesas > Pagamentos (relação de pagamentos), UG 011103 (PGE)',
        'licenca': 'Dados públicos',
        'naturezas': NAT_NOME,
        'valor_bolsa': {'estagiarios': 1500.0, 'residentes': 3300.0},
        'referencia': ref,
        'referencia_rotulo': MES[ref[5:7]] + '/' + ref[:4],
        'gerado_de': os.path.basename(caminho),
        'meses': [[m, MES[m[5:7]] + '/' + m[:4]] for m in reversed(ordenados)],
        'serie_mensal': serie,
        'listas': listas,
        'estagiarios': r_est[ref],
        'residentes': r_res[ref],
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
