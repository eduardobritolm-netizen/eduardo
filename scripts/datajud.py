"""Atualiza data/processual.json com a API Pública do DataJud (CNJ) — TJAM."""
import json, time
from comum import baixar, salvar, hoje

URL = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search'
# Chave pública divulgada pelo CNJ na Wiki do DataJud. Se o CNJ trocar, atualize aqui.
CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
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

def main():
    anos = list(range(ANO_INICIAL, int(hoje()[:4]) + 1))
    classes = {}
    for chave, (nome, codigo) in CLASSES.items():
        print('DataJud:', nome)
        aggs = {'anos': {'filters': {'filters': {str(a): {'range': {'dataAjuizamento': {
            'gte': a * 10**10, 'lt': (a + 1) * 10**10}}} for a in anos}}}}
        corpo = json.dumps({'size': 0, 'track_total_hits': True,
                            'query': {'match': {'classe.codigo': codigo}}, 'aggs': aggs}).encode()
        j = json.loads(baixar(URL, corpo, {'Authorization': 'APIKey ' + CHAVE,
                                           'Content-Type': 'application/json'}))
        b = j['aggregations']['anos']['buckets']
        classes[chave] = {'nome': nome, 'total': j['hits']['total']['value'],
                          'anos': [b[str(a)]['doc_count'] for a in anos] if chave != 'AcaoPopular' else None}
        time.sleep(5)
    salvar('processual.json', {'atualizado_em': hoje(), 'anos_ref': anos, 'classes': classes})

if __name__ == '__main__':
    main()
