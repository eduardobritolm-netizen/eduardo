import json, os, time, urllib.request
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, 'data')
UA = {'User-Agent': 'painel-pge-am/1.0 (+transparencia)'}

FALHAS = {}  # host -> nº de falhas seguidas; depois de 3, o host é abandonado nesta execução

def baixar(url, dados=None, cabecalhos=None, tentativas=3, timeout=90):
    host = url.split('/')[2]
    if FALHAS.get(host, 0) >= 3:
        raise RuntimeError(f'{host} indisponível nesta execução — pulando')
    h = dict(UA); h.update(cabecalhos or {})
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=dados, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                FALHAS[host] = 0
                return r.read()
        except Exception as e:
            print(f'  tentativa {i+1} falhou ({host}): {e}')
            time.sleep(5 * (i + 1))
    FALHAS[host] = FALHAS.get(host, 0) + 1
    raise RuntimeError(f'não foi possível baixar {url}')

def salvar(nome, obj):
    caminho = os.path.join(DADOS, nome)
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, caminho)
    print(f'  gravado {nome}')

def hoje():
    return time.strftime('%Y-%m-%d')
