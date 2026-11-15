import json, os, time, urllib.request
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, 'data')
UA = {'User-Agent': 'painel-pge-am/1.0 (+transparencia)'}

def baixar(url, dados=None, cabecalhos=None, tentativas=5, timeout=300):
    h = dict(UA); h.update(cabecalhos or {})
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=dados, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            print(f'  tentativa {i+1} falhou: {e}')
            time.sleep(10 * (i + 1))
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
