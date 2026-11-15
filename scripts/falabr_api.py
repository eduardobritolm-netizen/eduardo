"""Coleta manifestações da PGE direto da API do Fala.BR (CGU).
Só roda se os segredos FALABR_CLIENT_ID, FALABR_CLIENT_SECRET, FALABR_USUARIO e FALABR_SENHA
estiverem configurados no GitHub (Settings → Secrets → Actions). Sem eles, não faz nada.
Documentação: https://falabr.cgu.gov.br/help — token OAuth2 válido por 1 dia;
consultas acima de 1000 registros exigem janelas de no máximo 5 dias de cadastro."""
import datetime as dt, json, os, urllib.parse, urllib.request
from comum import RAIZ

BASE = os.environ.get('FALABR_BASE', 'https://falabr.cgu.gov.br')
SAIDA = os.path.join(RAIZ, 'fontes', 'ouvidoria', 'api')

def req(url, dados=None, token=None):
    h = {'Accept': 'application/json', 'User-Agent': 'painel-pge-am/1.0'}
    if token: h['Authorization'] = 'Bearer ' + token
    corpo = urllib.parse.urlencode(dados).encode() if dados else None
    with urllib.request.urlopen(urllib.request.Request(url, corpo, h), timeout=90) as r:
        return json.loads(r.read() or b'null')

def main(dias=365):
    e = os.environ
    if not all(e.get(k) for k in ('FALABR_CLIENT_ID', 'FALABR_CLIENT_SECRET', 'FALABR_USUARIO', 'FALABR_SENHA')):
        print('Fala.BR API: credenciais não configuradas — usando a base pública do Painel Resolveu?.'); return False
    tok = req(BASE + '/oauth/token', {'client_id': e['FALABR_CLIENT_ID'], 'client_secret': e['FALABR_CLIENT_SECRET'],
              'grant_type': 'password', 'username': e['FALABR_USUARIO'], 'password': e['FALABR_SENHA']})['access_token']
    fim, todos = dt.date.today(), []
    ini = fim - dt.timedelta(days=dias)
    while ini <= fim:
        ate = min(ini + dt.timedelta(days=4), fim); pos = 0
        while True:
            q = urllib.parse.urlencode({'DataCadastroInicio': ini.strftime('%d/%m/%Y'), 'DataCadastroFim': ate.strftime('%d/%m/%Y'),
                                        'MaxResultados': 1000, 'PosInicioPagina': pos})
            r = req(f'{BASE}/api/manifestacoes?{q}', token=tok) or []
            lote = r if isinstance(r, list) else r.get('Manifestacoes') or r.get('manifestacoes') or []
            todos += lote
            if len(lote) < 1000: break
            pos += 1000
        ini = ate + dt.timedelta(days=1)
    os.makedirs(SAIDA, exist_ok=True)
    json.dump(todos, open(os.path.join(SAIDA, 'manifestacoes.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'Fala.BR API: {len(todos)} manifestações baixadas (campos: {sorted(todos[0])[:15] if todos else "—"})')
    return True

if __name__ == '__main__':
    main()
