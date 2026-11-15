"""Atualiza data/contratacoes.json com a API pública de consulta do PNCP
(Portal Nacional de Contratações Públicas — Lei 14.133/2021).
Órgãos: PGE-AM e Fundo Especial da PGE (FUNDPGE)."""
import json, time, urllib.error
from datetime import date
from comum import baixar, salvar, hoje

API = 'https://pncp.gov.br/api/consulta/v1'
ORGAOS = {'19477848000134': 'PGE', '14877478000109': 'FUNDPGE'}
ANO_INICIAL = 2023
MODALIDADES = range(1, 14)

def get(url):
    for i in range(6):
        time.sleep(1.5)
        try:
            b = baixar(url, tentativas=1, timeout=120)
            return json.loads(b) if b.strip() else {}
        except Exception as e:
            msg = str(e)
            if '204' in msg: return {}
            print('  aguardando (', msg[:60], ')'); time.sleep(10 * (i + 1))
    return {}

def periodos():
    h = date.today()
    for a in range(ANO_INICIAL, h.year + 1):
        fim = h.strftime('%Y%m%d') if a == h.year else f'{a}1231'
        yield f'{a}0101', fim

def paginar(base):
    p, tp, out = 1, 1, []
    while p <= tp:
        j = get(f'{base}&pagina={p}')
        out += j.get('data') or []
        tp = j.get('totalPaginas') or 1; p += 1
    return out

def contratos():
    vistos, out = set(), []
    for cnpj, sigla in ORGAOS.items():
        for a, b in periodos():
            for x in paginar(f'{API}/contratos?dataInicial={a}&dataFinal={b}&cnpjOrgao={cnpj}&tamanhoPagina=200'):
                k = (sigla, x.get('anoContrato'), x.get('sequencialContrato'), (x.get('tipoContrato') or {}).get('nome'))
                if k in vistos: continue
                vistos.add(k)
                pf = x.get('tipoPessoa') == 'PF'
                out.append({'org': sigla, 'tipo': (x.get('tipoContrato') or {}).get('nome'), 'ano': x.get('anoContrato'),
                            'cat': (x.get('categoriaProcesso') or {}).get('nome'),
                            'forn': 'Pessoa física' if pf else (x.get('nomeRazaoSocialFornecedor') or '').strip(),
                            'valor': round(x.get('valorGlobal') or 0), 'inicio': (x.get('dataVigenciaInicio') or '')[:10],
                            'fim': (x.get('dataVigenciaFim') or '')[:10],
                            'objeto': ' '.join((x.get('objetoContrato') or '').split())[:160]})
    return out

def licitacoes():
    vistos, out = set(), []
    for cnpj, sigla in ORGAOS.items():
        for a, b in periodos():
            for m in MODALIDADES:
                for x in paginar(f'{API}/contratacoes/publicacao?dataInicial={a}&dataFinal={b}&codigoModalidadeContratacao={m}&cnpj={cnpj}&tamanhoPagina=50'):
                    k = x.get('numeroControlePNCP')
                    if k in vistos: continue
                    vistos.add(k)
                    out.append({'org': sigla, 'ano': x.get('anoCompra'), 'modalidade': x.get('modalidadeNome'),
                                'situacao': x.get('situacaoCompraNome'), 'estimado': round(x.get('valorTotalEstimado') or 0),
                                'homologado': round(x.get('valorTotalHomologado') or 0),
                                'publicacao': (x.get('dataPublicacaoPncp') or '')[:10],
                                'objeto': ' '.join((x.get('objetoCompra') or '').split())[:160]})
    return out

def main():
    c = contratos(); l = licitacoes()
    if not c and not l:
        raise RuntimeError('PNCP não retornou dados — mantidos os anteriores')
    salvar('contratacoes.json', {'atualizado_em': hoje(), 'contratos': c, 'licitacoes': l})

if __name__ == '__main__':
    main()
