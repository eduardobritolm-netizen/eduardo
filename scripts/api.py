"""Gera a API de Dados Abertos da PGE-AM (pasta api/) a partir de data/*.json:
JSON e CSV por conjunto, catálogo (DCAT simplificado) e especificação OpenAPI."""
import csv, json, os, shutil
from comum import RAIZ, DADOS, hoje

API = os.path.join(RAIZ, 'api')
BASE = 'https://eduardobritolm-netizen.github.io/eduardo/api'
LICENCA = 'https://creativecommons.org/licenses/by/4.0/deed.pt-br'

def ler(n):
    p = os.path.join(DADOS, n)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None

def csv_out(nome, cab, linhas):
    with open(os.path.join(API, nome), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';'); w.writerow(cab); w.writerows(linhas)

def main():
    os.makedirs(API, exist_ok=True)
    cat = []
    def reg(id_, titulo, desc, fonte, atual, arquivos, campos):
        cat.append({'identificador': id_, 'titulo': titulo, 'descricao': desc, 'fonte': fonte,
                    'atualizado_em': atual, 'periodicidade': 'diária (quando a fonte publica)',
                    'licenca': LICENCA, 'publicador': 'Procuradoria Geral do Estado do Amazonas – Coordenadoria de Transparência e Ouvidoria',
                    'distribuicoes': [{'formato': a.rsplit('.', 1)[1].upper(), 'url': f'{BASE}/{a}'} for a in arquivos],
                    'campos': campos})

    P, M = ler('processual.json'), ler('manual.json')
    if P:
        shutil.copy(os.path.join(DADOS, 'processual.json'), os.path.join(API, 'processual-classes.json'))
        ln = []
        for k, c in P['classes'].items():
            for a, n in zip(P['anos_ref'], c['anos'] or []): ln.append([k, c['nome'], a, n])
        csv_out('processual-classes.csv', ['classe', 'nome', 'ano', 'processos_ajuizados'], ln)
        reg('processual-classes', 'Processos por classe e ano – TJAM', 'Ações ajuizadas no TJAM por classe processual (mandado de segurança, ação civil pública, juizado da Fazenda etc.).',
            'CNJ – API Pública do DataJud', P['atualizado_em'], ['processual-classes.json', 'processual-classes.csv'],
            {'classe': 'código interno da classe', 'nome': 'nome da classe (TPU/CNJ)', 'ano': 'ano de ajuizamento', 'processos_ajuizados': 'quantidade'})
    if M:
        shutil.copy(os.path.join(DADOS, 'manual.json'), os.path.join(API, 'estado-parte.json'))
        csv_out('estado-parte-orgaos.csv', ['orgao_julgador', 'grau', 'estado_reu', 'estado_autor'], M['U'])
        reg('estado-parte', 'Estado do Amazonas como parte – por órgão julgador e tribunal', 'Processos pendentes em que o Estado é réu ou autor, por unidade do TJAM, e comparação com TRT11 e TRF1.',
            'CNJ – Painel Grandes Litigantes (transcrição)', M['atualizado_em'], ['estado-parte.json', 'estado-parte-orgaos.csv'],
            {'orgao_julgador': 'unidade judiciária', 'grau': 'grau de jurisdição', 'estado_reu': 'pendentes com o Estado no polo passivo', 'estado_autor': 'pendentes com o Estado no polo ativo'})
    O = ler('ouvidoria.json')
    if O:
        shutil.copy(os.path.join(DADOS, 'ouvidoria.json'), os.path.join(API, 'ouvidoria.json'))
        csv_out('ouvidoria-anos.csv', ['ano', 'manifestacoes', 'mediana_dias_resposta', 'pct_no_prazo'], O['anos'])
        reg('ouvidoria', 'Manifestações de ouvidoria da PGE-AM', 'Manifestações recebidas pela PGE no Fala.BR, agregadas por ano, tipo, assunto e prazo de resposta. Sem dados pessoais.',
            'CGU – Painel Resolveu? / Fala.BR', O.get('ultima', ''), ['ouvidoria.json', 'ouvidoria-anos.csv'],
            {'ano': 'ano de registro', 'manifestacoes': 'quantidade', 'mediana_dias_resposta': 'mediana de dias até a resposta', 'pct_no_prazo': '% respondidas até a data-limite'})
    T = ler('transparencia.json')
    if T:
        shutil.copy(os.path.join(DADOS, 'transparencia.json'), os.path.join(API, 'pessoal.json'))
        csv_out('pessoal-folha.csv', ['mes', 'servidores', 'remuneracao_bruta', 'liquido'], T['folha'])
        csv_out('pessoal-diarias.csv', ['mes', 'diarias_qtd', 'diarias_valor', 'diarias_quantidade_dias', 'passagens_qtd', 'passagens_valor'], T['diarias'])
        reg('pessoal', 'Folha de pagamento, diárias e passagens da PGE-AM (agregados)', 'Totais mensais da folha (servidores, bruto, líquido) e de diárias e passagens. Sem identificação de servidores.',
            'Portal da Transparência do Governo do Estado do Amazonas (APIs de Remuneração e SCDP)', T['atualizado_em'], ['pessoal.json', 'pessoal-folha.csv', 'pessoal-diarias.csv'],
            {'mes': 'AAAA-MM', 'servidores': 'linhas na folha do mês', 'remuneracao_bruta': 'R$', 'liquido': 'R$'})
    K = ler('contratacoes.json')
    if K:
        shutil.copy(os.path.join(DADOS, 'contratacoes.json'), os.path.join(API, 'contratacoes.json'))
        ct = [x for x in K['contratos'] if x['tipo'] != 'Empenho']
        csv_out('contratos.csv', ['unidade', 'ano', 'categoria', 'fornecedor', 'valor_global', 'inicio_vigencia', 'fim_vigencia', 'objeto'],
                [[x['org'], x['ano'], x['cat'], x['forn'], x['valor'], x['inicio'], x['fim'], x['objeto']] for x in ct])
        csv_out('licitacoes.csv', ['unidade', 'ano', 'modalidade', 'situacao', 'valor_estimado', 'valor_homologado', 'data_publicacao', 'objeto'],
                [[x['org'], x['ano'], x['modalidade'], x['situacao'], x['estimado'], x['homologado'], x['publicacao'], x['objeto']] for x in K['licitacoes']])
        reg('contratacoes', 'Contratos e licitações da PGE-AM e do FUNDPGE', 'Contratos, processos de contratação e empenhos publicados no PNCP (Lei 14.133/2021).',
            'PNCP – Portal Nacional de Contratações Públicas', K['atualizado_em'], ['contratacoes.json', 'contratos.csv', 'licitacoes.csv'],
            {'unidade': 'PGE ou FUNDPGE', 'valor_global': 'R$', 'modalidade': 'modalidade de contratação', 'situacao': 'situação no PNCP'})

    R = ler('precedentes.json')
    if R:
        shutil.copy(os.path.join(DADOS, 'precedentes.json'), os.path.join(API, 'precedentes-lai.json'))
        csv_out('precedentes-pge.csv', ['numero', 'data', 'instancia', 'tema', 'dispositivo', 'decisao', 'ementa', 'link'],
                [[p.get(k, '') for k in ('numero', 'data', 'instancia', 'tema', 'dispositivo', 'decisao', 'ementa', 'link')] for p in R['pge']])
        reg('precedentes-lai', 'Precedentes em recursos da Lei de Acesso à Informação', 'Decisões recursais da PGE-AM e, como referência, decisões da CGU (3ª instância) e da CMRI (4ª instância) do Executivo federal.',
            'PGE-AM e CGU – Busca de Precedentes (dados abertos)', R['atualizado_em'], ['precedentes-lai.json', 'precedentes-pge.csv'],
            {'numero': 'número da decisão', 'instancia': 'instância recursal', 'tema': 'assunto', 'dispositivo': 'fundamento legal', 'decisao': 'resultado', 'ementa': 'síntese'})
    json.dump({'titulo': 'API de Dados Abertos da Procuradoria Geral do Estado do Amazonas', 'gerado_em': hoje(),
               'licenca': LICENCA, 'conjuntos': cat}, open(os.path.join(API, 'catalogo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    linhas = ['openapi: 3.0.3', 'info:', '  title: API de Dados Abertos da PGE-AM', '  version: "1.0"',
              '  description: Arquivos estáticos (JSON e CSV) atualizados diariamente. Leitura livre, sem cadastro. Licença CC BY 4.0.',
              'servers:', f'  - url: {BASE}', 'paths:']
    for c in [{'distribuicoes': [{'url': f'{BASE}/catalogo.json', 'formato': 'JSON'}], 'titulo': 'Catálogo de conjuntos de dados'}] + cat:
        for d in c['distribuicoes']:
            nome = d['url'].rsplit('/', 1)[1]; mt = 'application/json' if nome.endswith('json') else 'text/csv'
            linhas += [f'  /{nome}:', '    get:', f'      summary: "{c["titulo"]} ({d["formato"]})"',
                       '      responses:', '        "200":', '          description: OK', '          content:', f'            {mt}: {{}}']
    open(os.path.join(API, 'openapi.yaml'), 'w', encoding='utf-8').write('\n'.join(linhas) + '\n')
    print(f'  API gerada: {len(cat)} conjuntos')

if __name__ == '__main__':
    main()
