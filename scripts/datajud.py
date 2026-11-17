"""Atualiza data/processual.json com a API Pública do DataJud (CNJ) — TJAM.

Além das classes fixas (compatíveis com versões anteriores), descobre na própria API as
classes com mais processos no TJAM, agrupa por natureza e detalha cada uma por ano de
ajuizamento, assunto (a causa), grau e órgão julgador.
"""
import json, re, time, unicodedata
from comum import baixar, salvar, hoje, DADOS
import os

URL = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search'
# Chave pública divulgada pelo CNJ na Wiki do DataJud. Se o CNJ trocar, atualize aqui.
CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
# Classes sempre coletadas (as chaves são usadas pela API aberta do painel — não renomear).
CLASSES = {
    'MS': ('Mandado de Segurança', 120),
    'JEFazPub': ('Juizado Especial da Fazenda Pública', 14695),
    'ACP': ('Ação Civil Pública', 65),
    'Improbidade': ('Improbidade Administrativa', 64),
    'AcaoPopular': ('Ação Popular', 66),
    # Classes coletivas acompanhadas pelo Cacol (CNJ), que também usa o DataJud como fonte
    'MSColetivo': ('Mandado de Segurança Coletivo', 119),
    'ACColetiva': ('Ação Civil Coletiva', 63),
}
ANO_INICIAL = 2015
DESCOBRIR = 80      # quantas classes (por volume) pedir à API antes de filtrar
MAX_CLASSES = 45    # teto de classes detalhadas por execução
PAUSA = 3           # segundos entre consultas (a API pública limita requisições)
GRAUS = {'G1': '1º Grau', 'JE': 'Juizado Especial', 'G2': '2º Grau', 'TR': 'Turma Recursal'}

# Classes sem relação com a atuação da Fazenda Pública (criminal, família, infância etc.)
FORA = ('penal', 'crimin', 'crime', 'inquerito', 'flagrante', 'habeas corpus', 'circunstanciado',
        'juri', 'protetiva', 'sentido estrito', 'toxico', 'infracional', 'socioeducativ',
        'execucao da pena', 'alimentos', 'divorcio', 'guarda', 'inventario', 'arrolamento',
        'interdicao', 'curatela', 'adocao', 'familia', 'paternidade', 'uniao estavel',
        'carta precatoria', 'carta de ordem', 'alienacao fiduciaria', 'despejo', 'alvara',
        'retificacao', 'registro civil', 'falencia', 'recuperacao judicial', 'insolvencia')
# (grupo, termos) — a primeira regra que casar define o grupo; a ordem importa.
GRUPOS = [
    ('Mandamentais e constitucionais', ('mandado de seguranca', 'habeas data', 'mandado de injuncao', 'acao popular')),
    ('Coletivas e improbidade', ('acao civil publica', 'improbidade', 'acao civil coletiva')),
    ('Execução fiscal e dívida ativa', ('execucao fiscal', 'cautelar fiscal')),
    ('Recursos', ('apelacao', 'agravo', 'remessa necessaria', 'recurso', 'embargos de declaracao', 'embargos infringentes')),
    ('Controle de constitucionalidade e incidentes', ('inconstitucionalidade', 'incidente', 'reclamacao', 'conflito de competencia', 'rescisoria', 'uniformizacao')),
    ('Tutelas, cautelares e suspensões', ('tutela', 'cautelar', 'suspensao', 'producao antecipada')),
    ('Cumprimento, precatórios e execução', ('cumprimento', 'precatorio', 'pequeno valor', 'execucao', 'liquidacao')),
    ('Posse, propriedade e desapropriação', ('desapropriacao', 'posse', 'usucapiao', 'demarcacao', 'reivindicatoria')),
    ('Conhecimento — procedimento comum e juizados', ('procedimento comum', 'procedimento do juizado', 'juizado especial', 'procedimento sumario', 'procedimento ordinario')),
]
OUTRAS = 'Outras classes cíveis'


def norm(s):
    return unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()


def grupo_de(nome):
    """Devolve o grupo da classe, ou None se a classe fica fora do painel."""
    n = norm(nome)
    if any(t in n for t in FORA):
        return None
    for g, termos in GRUPOS:
        if any(t in n for t in termos):
            return g
    return OUTRAS


def consultar(corpo):
    return json.loads(baixar(URL, json.dumps(corpo).encode(),
                             {'Authorization': 'APIKey ' + CHAVE, 'Content-Type': 'application/json'}))


def descobrir():
    """Classes com mais processos no TJAM: [(codigo, nome, total)], já sem as de fora do painel."""
    j = consultar({'size': 0, 'aggs': {'c': {
        'terms': {'field': 'classe.codigo', 'size': DESCOBRIR},
        'aggs': {'n': {'top_hits': {'size': 1, '_source': ['classe.nome']}}}}}})
    saida = []
    for b in j['aggregations']['c']['buckets']:
        try:
            nome = b['n']['hits']['hits'][0]['_source']['classe']['nome']
        except (KeyError, IndexError, TypeError):
            continue
        if grupo_de(nome):
            saida.append((int(b['key']), nome.strip(), b['doc_count']))
    return saida


def aggs_anos(anos):
    return {'anos': {'filters': {'filters': {str(a): {'range': {'dataAjuizamento': {
        'gte': a * 10**10, 'lt': (a + 1) * 10**10}}} for a in anos}}}}


def aggs_detalhe():
    return {
        'graus': {'filters': {'filters': {g: {'match': {'grau': g}} for g in GRAUS}}},
        'assuntos': {'terms': {'field': 'assuntos.codigo', 'size': 12},
                     'aggs': {'n': {'top_hits': {'size': 1, '_source': ['assuntos']}}}},
        'orgaos': {'terms': {'field': 'orgaoJulgador.codigo', 'size': 8},
                   'aggs': {'n': {'top_hits': {'size': 1, '_source': ['orgaoJulgador.nome']}}}},
    }


def nome_assunto(bucket):
    """Acha, no processo de exemplo, o nome do assunto cujo código é o do bucket."""
    try:
        lista = bucket['n']['hits']['hits'][0]['_source'].get('assuntos') or []
    except (KeyError, IndexError):
        return None
    pilha = list(lista) if isinstance(lista, list) else [lista]
    while pilha:
        a = pilha.pop()
        if isinstance(a, list):
            pilha.extend(a)
        elif isinstance(a, dict) and str(a.get('codigo')) == str(bucket['key']):
            return a.get('nome')
    return None


def titulo(nome):
    """Nomes que vêm em caixa alta do tribunal passam a caixa de título."""
    nome = (nome or '').strip()
    if nome != nome.upper():
        return nome
    t = nome.title()
    for p in ('Da', 'De', 'Do', 'Das', 'Dos', 'E'):
        t = re.sub(rf'(?<=\s){p}(?=\s)', p.lower(), t)
    return t


def detalhar(ag):
    d = {}
    if 'graus' in ag:
        d['graus'] = {GRAUS[g]: b['doc_count'] for g, b in ag['graus']['buckets'].items() if b['doc_count']}
    if 'assuntos' in ag:
        d['assuntos'] = [[int(b['key']), nome_assunto(b) or f'Assunto {b["key"]}', b['doc_count']]
                         for b in ag['assuntos']['buckets']]
    if 'orgaos' in ag:
        org = []
        for b in ag['orgaos']['buckets']:
            try:
                nome = b['n']['hits']['hits'][0]['_source']['orgaoJulgador']['nome']
            except (KeyError, IndexError, TypeError):
                nome = f'Órgão {b["key"]}'
            org.append([titulo(nome), b['doc_count']])
        d['orgaos'] = org
    return d


def anterior():
    try:
        with open(os.path.join(DADOS, 'processual.json'), encoding='utf-8') as f:
            return json.load(f).get('classes', {})
    except Exception:
        return {}


def main():
    anos = list(range(ANO_INICIAL, int(hoje()[:4]) + 1))
    velho = anterior()
    fixas = {cod: (ch, nome) for ch, (nome, cod) in CLASSES.items()}

    # 1) lista de classes: fixas + descobertas na API (se a descoberta falhar, ficam só as fixas)
    alvo = [(ch, nome, cod, None) for ch, (nome, cod) in CLASSES.items()]
    try:
        print('DataJud: descobrindo classes com mais processos')
        for cod, nome, _ in descobrir():
            if cod not in fixas and len(alvo) < MAX_CLASSES:
                alvo.append((f'c{cod}', nome, cod, nome))
        time.sleep(PAUSA)
    except Exception as e:
        print('  descoberta de classes falhou — mantendo só as classes fixas:', e)
        for ch, c in velho.items():  # não perde as classes que já estavam publicadas
            if ch not in CLASSES and c.get('codigo'):
                alvo.append((ch, c['nome'], c['codigo'], c.get('nome_tpu')))

    # 2) detalhe de cada classe
    classes, com_detalhe = {}, True
    for chave, nome, codigo, nome_tpu in alvo:
        print('DataJud:', nome)
        q = {'size': 0, 'track_total_hits': True, 'query': {'match': {'classe.codigo': codigo}}}
        j = None
        if com_detalhe:
            try:
                j = consultar({**q, 'aggs': {**aggs_anos(anos), **aggs_detalhe()}})
            except Exception as e:
                print('  consulta detalhada falhou — seguindo só com a série anual:', e)
                com_detalhe = False
        if j is None:
            try:
                j = consultar({**q, 'aggs': aggs_anos(anos)})
            except Exception as e:
                print('  falhou; mantendo o dado anterior:', e)
                if chave in velho:
                    classes[chave] = velho[chave]
                continue
        ag = j['aggregations']
        b = ag['anos']['buckets']
        c = {'nome': nome, 'codigo': codigo, 'grupo': grupo_de(nome_tpu or nome) or OUTRAS,
             'total': j['hits']['total']['value'], 'anos': [b[str(a)]['doc_count'] for a in anos]}
        if nome_tpu:
            c['nome_tpu'] = nome_tpu
        det = detalhar(ag)
        for k in ('graus', 'assuntos', 'orgaos'):  # se o detalhe não veio hoje, guarda o último
            if det.get(k):
                c[k] = det[k]
            elif velho.get(chave, {}).get(k):
                c[k] = velho[chave][k]
        classes[chave] = c
        time.sleep(PAUSA)

    if not classes:
        raise RuntimeError('DataJud: nenhuma classe coletada')
    salvar('processual.json', {'atualizado_em': hoje(), 'anos_ref': anos, 'classes': classes})


if __name__ == '__main__':
    main()
