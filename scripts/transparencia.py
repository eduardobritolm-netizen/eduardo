"""Atualiza data/transparencia.json com as APIs do Portal da Transparência do Amazonas:
folha de pagamento (Remuneração de Servidores) e diárias e passagens (SCDP) da PGE."""
import csv, io, json, urllib.parse
from collections import Counter
from comum import baixar, salvar, hoje

BASE = 'https://www.transparencia.am.gov.br'
ANO_INICIAL = 2023
J = {'Accept': 'application/json'}

def num(v):
    v = (v or '').strip().replace('.', '').replace(',', '.') if ',' in (v or '') else (v or '').strip()
    try: return float(v)
    except ValueError: return 0.0

def orgao_folha():
    lista = json.loads(baixar(BASE + '/wp-admin/admin-ajax.php?action=get_orgaos'))
    return next(o['id'] for o in lista if o['nome_orgao'].strip().upper() == 'PGE')

def orgao_scdp():
    lista = json.loads(baixar(BASE + '/servicos/scdp/orgaos', cabecalhos=J))
    return next(o['id'] for o in lista if o['sigla'].strip().upper() == 'PGE')

def folha(ano_fim):
    oid = orgao_folha(); meses = []; ultimo = None
    for ano in range(ANO_INICIAL, ano_fim + 1):
        corpo = urllib.parse.urlencode({'action': 'get_meses_docs', 'orgao_id': oid, 'ano': ano}).encode()
        docs = json.loads(baixar(BASE + '/wp-admin/admin-ajax.php', corpo))
        for d in docs:
            url = next((a['url'] for a in d['arquivos'] if a['extensao'] == '.csv'), None)
            if not url: continue
            bruto = baixar(url)
            try: txt = bruto.decode('utf-8')
            except UnicodeDecodeError: txt = bruto.decode('latin-1')
            linhas = [r for r in csv.reader(io.StringIO(txt), delimiter=';')][1:]
            linhas = [r for r in linhas if len(r) > 13 and r[0].strip()]
            mes = f'{ano}-{d["mes"]}'
            meses.append([mes, len(linhas), round(sum(num(r[9]) for r in linhas)), round(sum(num(r[13]) for r in linhas))])
            ultimo = (mes, Counter(r[8].strip() for r in linhas), Counter(r[2].strip() for r in linhas))
    return meses, ultimo

NOMES_VINC = {'ESTATUTARIO': 'Estatutário', 'CARGO COMISSION.S/VINCULO': 'Comissionado sem vínculo',
              'DISP. OUTROS ESFERAS': 'Disposição de outras esferas'}

def cargo(c):
    c = c.replace('-PGE', '').strip().title()
    return c.replace('3A Classe', '3ª classe').replace('2A Classe', '2ª classe').replace('1A Classe', '1ª classe').replace(' Do ', ' do ')

def diarias(ano_fim, mes_fim):
    oid = orgao_scdp(); meses = []; dest = Counter(); meio = Counter()
    for ano in range(ANO_INICIAL, ano_fim + 1):
        for m in range(1, 13):
            if ano == ano_fim and m > mes_fim: break
            linha = [f'{ano}-{m:02d}', 0, 0.0, 0.0, 0, 0.0]
            for tipo in ('diarias', 'passagens'):
                arr = json.loads(baixar(f'{BASE}/servicos/scdp/{tipo}/{oid}/{ano}/{m}', cabecalhos=J) or b'[]')
                for x in arr:
                    if tipo == 'diarias':
                        linha[1] += 1; linha[2] += num(str(x.get('valor_total_diaria'))); linha[3] += num(str(x.get('qtd_diaria')))
                    else:
                        linha[4] += 1; linha[5] += num(str(x.get('valor_total_passagem')))
                        meio[(x.get('meio_transporte') or '?').strip().capitalize()] += 1
                    for c in (x.get('cidade_destino') or '').upper().split('/'):
                        c = c.strip()
                        if c and c != 'MANAUS': dest[c.title()] += 1
            linha[2] = round(linha[2]); linha[5] = round(linha[5])
            meses.append(linha)
    return meses, dest.most_common(8), meio.most_common()

def main():
    h = hoje(); ano, mes = int(h[:4]), int(h[5:7])
    print('Transparência AM: folha'); f, ult = folha(ano)
    print('Transparência AM: diárias e passagens'); dp, dest, meio = diarias(ano, mes)
    salvar('transparencia.json', {
        'atualizado_em': h, 'folha': f, 'folha_ref': ult[0],
        'vinculo': [[NOMES_VINC.get(k, k.title()), v] for k, v in ult[1].most_common()],
        'cargos': [[cargo(k), v] for k, v in ult[2].most_common(10)],
        'diarias': dp, 'destinos': dest, 'meio': meio})

if __name__ == '__main__':
    main()
