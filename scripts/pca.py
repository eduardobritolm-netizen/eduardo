"""Gera data/pca.json a partir dos CSVs do Plano de Contratações Anual (PCA)
exportados do PNCP (pncp.gov.br/app/pca/<cnpj>/<ano>).
Órgãos: PGE-AM (19477848000134) e Fundo Especial da PGE — FUNDPGE (14877478000109).

Cada item do PCA já traz o Código do Item (CATMAT/CATSER), o que permite
ao painel comparar o valor unitário estimado com o preço de mercado da API
do Compras.gov.br (feito no navegador, em precos.html)."""
import csv, glob, json, os, re
import comum

COLS = ['Unidade Responsável','UASG','Id do item no PCA','Categoria do Item',
 'Identificador da Futura Contratação','Nome da Futura Contratação','Catálogo Utilizado',
 'Classificação do Catálogo','Código da Classificação Superior (Classe/Grupo)',
 'Nome da Classificação Superior (Classe/Grupo)','Código do PDM do Item','Nome do PDM do Item',
 'Código do Item','Descrição do Item','Unidade de Fornecimento','Quantidade Estimada',
 'Valor Unitário Estimado (R$)','Valor Total Estimado (R$)',
 'Valor orçamentário estimado para o exercício (R$)','Data Desejada']

def num(s):
    s = (s or '').strip().replace('.', '').replace(',', '.')
    try: return round(float(s), 4)
    except Exception: return 0.0

def orgao(unid):
    u = (unid or '').upper()
    return 'FUNDPGE' if 'FUND' in u else 'PGE'

def titulo(desc):
    """Primeiro trecho da descrição, até a vírgula/'Descrição:' — serve de rótulo curto."""
    d = re.split(r',|\bDescrição:|\bFunções:|\bCor:', desc, maxsplit=1)[0].strip()
    return (d[:90] + '…') if len(d) > 92 else d

def processar(caminhos):
    itens, vistos = [], set()
    for cam in caminhos:
        with open(cam, encoding='utf-8-sig') as f:
            for r in csv.DictReader(f, delimiter=';'):
                cod = (r.get('Código do Item') or '').strip()
                idpca = (r.get('Id do item no PCA') or '').strip()
                if idpca in vistos: continue
                vistos.add(idpca)
                tipo = (r.get('Classificação do Catálogo') or '').strip()
                itens.append({
                    'org': orgao(r.get('Unidade Responsável')),
                    'uasg': (r.get('UASG') or '').strip(),
                    'idpca': idpca,
                    'categoria': (r.get('Categoria do Item') or '').strip(),
                    'tipo': 'S' if tipo.lower().startswith('serv') else 'M',
                    'classe': (r.get('Código da Classificação Superior (Classe/Grupo)') or '').strip(),
                    'nomeClasse': (r.get('Nome da Classificação Superior (Classe/Grupo)') or '').strip(),
                    'cod': cod,
                    'titulo': titulo(r.get('Descrição do Item') or ''),
                    'descricao': (r.get('Descrição do Item') or '').strip(),
                    'unidade': (r.get('Unidade de Fornecimento') or '').strip(),
                    'qtd': num(r.get('Quantidade Estimada')),
                    'vUnit': num(r.get('Valor Unitário Estimado (R$)')),
                    'vTotal': num(r.get('Valor Total Estimado (R$)')),
                    'data': (r.get('Data Desejada') or '').strip(),
                })
    return itens

def resumo(itens):
    por_org = {}
    for it in itens:
        o = por_org.setdefault(it['org'], {'itens': 0, 'valor': 0.0, 'mat': 0, 'serv': 0})
        o['itens'] += 1; o['valor'] = round(o['valor'] + it['vTotal'], 2)
        o['mat' if it['tipo'] == 'M' else 'serv'] += 1
    return por_org

def main(caminhos=None):
    caminhos = caminhos or sorted(glob.glob(os.path.join(comum.RAIZ, 'fontes', 'pca_*.csv')))
    if not caminhos:
        print('pca: nenhum CSV em fontes/pca_*.csv — pulando'); return
    itens = processar(caminhos)
    comum.salvar('pca.json', {
        'ano': 2026,
        'atualizado': comum.hoje(),
        'fonte': 'PNCP — Plano de Contratações Anual (pncp.gov.br)',
        'orgaos': {'PGE': '19477848000134', 'FUNDPGE': '14877478000109'},
        'resumo': resumo(itens),
        'itens': itens,
    })
    print(f'pca: {len(itens)} itens → data/pca.json')

if __name__ == '__main__':
    import sys
    main(sys.argv[1:] or None)
