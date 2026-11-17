"""Bloco DIÁRIO da ouvidoria — só PGE.

Lê fontes/ouvidoria/api/manifestacoes.json (coletado por falabr_api.py, direto da API
autenticada do Fala.BR, que já devolve a caixa da própria ouvidoria da PGE) e calcula
os indicadores que batem com o Painel Resolveu? (total, respondidas/concluídas, tempo
médio de resposta). NÃO calcula nada estadual nem ranking — isso é cópia do portal.

Os nomes dos campos da API são resolvidos na hora, a partir de uma lista de candidatos,
e o mapeamento escolhido é impresso no log. Se a fonte não existir, o arquivo atual é
mantido (não inventa dados).
"""
import datetime as dt, json, os
from collections import Counter
from comum import RAIZ, salvar

FONTE = os.path.join(RAIZ, 'fontes', 'ouvidoria', 'api', 'manifestacoes.json')
JANELA_PADRAO = 365

# candidatos de nome de campo (a API usa PascalCase; cobrimos variações por segurança)
CAND = {
    'registro':  ['DataCadastro', 'DataRegistro', 'dataCadastro', 'data_cadastro', 'DataAbertura', 'DataRecebimento'],
    'resposta':  ['DataResposta', 'dataResposta', 'DataConclusao', 'DataEncerramento', 'data_resposta'],
    'prazo':     ['DataPrazoResposta', 'DataLimiteResposta', 'DataVencimento', 'DataPrazo'],
    'situacao':  ['Situacao', 'SituacaoAtual', 'DescricaoSituacao', 'Status', 'situacao'],
    'tipo':      ['TipoManifestacao', 'DescricaoTipo', 'Tipo', 'Especie', 'tipo'],
    'assunto':   ['Assunto', 'AssuntoClassificacao', 'DescricaoAssunto', 'assunto'],
}
CONCLUIDA = ('conclu', 'respond', 'encerr', 'finaliz', 'arquiv')  # situações que contam como respondida


def resolver(reg):
    """Descobre o nome real de cada campo a partir do 1º registro."""
    m = {}
    for alvo, cands in CAND.items():
        m[alvo] = next((c for c in cands if c in reg), None)
    return m


def data(v):
    if not v:
        return None
    s = str(v)[:10].strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def main():
    if not os.path.exists(FONTE):
        print('Ouvidoria diário: sem fontes/ouvidoria/api/manifestacoes.json — mantido o arquivo atual.')
        return
    regs = json.load(open(FONTE, encoding='utf-8'))
    if not isinstance(regs, list) or not regs:
        print('Ouvidoria diário: manifestacoes.json vazio — mantido o arquivo atual.')
        return
    m = resolver(regs[0])
    print('Ouvidoria diário: campos resolvidos ->', {k: v for k, v in m.items()})
    if not m['registro']:
        print('  AVISO: não achei o campo de data de registro; campos disponíveis:', sorted(regs[0])[:25])
        return

    linhas = []
    for r in regs:
        dr = data(r.get(m['registro']))
        if not dr:
            continue
        dres = data(r.get(m['resposta'])) if m['resposta'] else None
        sit = str(r.get(m['situacao']) or '').strip() if m['situacao'] else ''
        respondida = bool(dres) or any(t in sit.lower() for t in CONCLUIDA)
        linhas.append({
            'registro': dr,
            'resposta': dres,
            'respondida': respondida,
            'situacao': sit or 'Não informado',
            'tipo': str(r.get(m['tipo']) or 'Não informado').strip() if m['tipo'] else 'Não informado',
            'assunto': str(r.get(m['assunto']) or 'Não informado').strip() if m['assunto'] else 'Não informado',
            'dias': (dres - dr).days if dres else None,
        })
    if not linhas:
        print('Ouvidoria diário: nenhum registro com data válida — mantido o arquivo atual.')
        return

    total = len(linhas)
    resp = [l for l in linhas if l['respondida']]
    dias = [l['dias'] for l in resp if l['dias'] is not None and l['dias'] >= 0]
    ultima = max(l['registro'] for l in linhas)
    cont = lambda campo, n=10: [[k, v] for k, v in Counter(l[campo] for l in linhas).most_common(n)]

    # últimos 12 meses (a partir do registro mais recente)
    fim = ultima.replace(day=1)
    meses = []
    y, mo = fim.year, fim.month
    seq = []
    for _ in range(12):
        seq.append(f'{y:04d}-{mo:02d}')
        mo -= 1
        if mo == 0:
            mo = 12
            y -= 1
    cm = Counter(l['registro'].strftime('%Y-%m') for l in linhas)
    meses = [[k, cm.get(k, 0)] for k in reversed(seq)]

    o = {
        'atualizado': dt.date.today().isoformat(),
        'janela_dias': int(os.environ.get('OUVIDORIA_DIAS', JANELA_PADRAO)),
        'total': total,
        'respondidas': len(resp),
        'pendentes': total - len(resp),
        'tempo_medio': round(sum(dias) / len(dias), 1) if dias else None,
        'por_tipo': cont('tipo'),
        'por_situacao': cont('situacao'),
        'por_assunto': cont('assunto', 12),
        'por_mes': meses,
        'ultima': ultima.isoformat(),
    }
    salvar('ouvidoria_diario.json', o)
    tm = f"{o['tempo_medio']} dias" if o['tempo_medio'] is not None else '—'
    print(f"Ouvidoria diário (PGE): {total} manifestações · {len(resp)} respondidas · tempo médio {tm} · última {o['ultima']}")


if __name__ == '__main__':
    main()
