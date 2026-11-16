"""Baixa os contratos do Portal SGC (SEFAZ-AM) direto do servidor e grava
fontes/contratos_<org>.csv — no mesmo formato do export manual do portal.
Assim o robô (GitHub Actions) atualiza os contratos sozinho; contratos_sgc.py
depois processa esses CSVs e gera data/contratos.json.

Endpoint descoberto no código-fonte da página de Contratos:
  POST https://sistemas.sefaz.am.gov.br/sgc-am/contratos.do
  campo counidadegestora = 011103 (PGE) / 011706 (FUNDPGE), method=Consultar
O servidor devolve a tabela #tabela inteira no HTML (todos os registros).

Observação: o host da SEFAZ não é alcançável do ambiente de desenvolvimento;
este módulo roda de fato no GitHub Actions. Se a coleta falhar, os CSVs
anteriores são mantidos e contratos_sgc.py segue com eles."""
import csv, html as htmlmod, os, re, urllib.parse
import comum

URL = 'https://sistemas.sefaz.am.gov.br/sgc-am/contratos.do'
UGS = {'011103': 'pge', '011706': 'fundpge'}
COLS = ['UG', 'Nome UG', 'Termo', 'Processo e-Compras', 'CNPJ/CPFfornecedor',
        'Nomefornecedor', 'Início', 'Término', 'Dataassinatura', 'Objeto',
        'Valor mensal', 'Valor atual', 'Local deexecução', 'Motivação/Justificativa', 'Itens']

def _texto(td):
    t = re.sub(r'<[^>]+>', ' ', td)
    return re.sub(r'\s+', ' ', htmlmod.unescape(t)).strip()

def parse(html):
    """Extrai as linhas da tabela #tabela. Cada <tr data-id> tem 15 <td>
    na ordem das colunas acima (o 15º é o botão de itens)."""
    linhas = []
    for bloco in re.findall(r'<tr[^>]*\bdata-id="[^"]*"[^>]*>(.*?)</tr>', html, re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', bloco, re.S)
        if len(tds) < 14:
            continue
        linha = [_texto(t) for t in tds[:14]]
        linha.append('')  # coluna Itens (botão) — fica vazia, como no export
        linhas.append(linha)
    return linhas

def total_informado(html):
    m = re.search(r'de\s+([\d.]+)\s+registros', html)
    return m.group(1) if m else '?'

def baixar_ug(ug):
    campos = {
        'inTipoPesquisaUG': '', 'counidadegestora': ug, 'nmNomeContratado': '',
        'nrNumeroTermo': '', 'txAnoTermo': '', 'idClassificacaoContrato': '',
        'nrProcessoEcompras': '', 'idFormaAquisicao': '', 'inSituacao': '',
        'csContratoCovid': '', 'csContratoVacinaCovid': '', 'inTipoContrato': '',
        'idIndice': '', 'method': 'Consultar',
    }
    corpo = urllib.parse.urlencode(campos).encode('iso-8859-1')
    bruto = comum.baixar(URL, dados=corpo,
                         cabecalhos={'Content-Type': 'application/x-www-form-urlencoded'},
                         tentativas=3, timeout=120)
    return bruto.decode('iso-8859-1', 'replace')

def gravar_csv(nome, linhas):
    caminho = os.path.join(comum.RAIZ, 'fontes', nome)
    with open(caminho, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(COLS)
        w.writerows(linhas)

def main():
    ok = 0
    for ug, slug in UGS.items():
        try:
            html = baixar_ug(ug)
            linhas = parse(html)
            if not linhas:
                print(f'contratos_sefaz: {ug} veio sem linhas (total informado: {total_informado(html)}) — mantido o CSV anterior')
                continue
            gravar_csv(f'contratos_{slug}.csv', linhas)
            print(f'contratos_sefaz: {ug} → {len(linhas)} contratos (portal informa {total_informado(html)}) → fontes/contratos_{slug}.csv')
            ok += 1
        except Exception as e:
            print(f'contratos_sefaz: falha ao baixar {ug} ({type(e).__name__}: {str(e)[:80]}) — mantido o CSV anterior')
    if not ok:
        print('contratos_sefaz: nenhuma UG baixada; contratos_sgc seguirá com os CSVs existentes')

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:  # modo teste: python3 contratos_sefaz.py arquivo.html
        h = open(sys.argv[1], encoding='utf-8', errors='replace').read()
        ls = parse(h)
        print(f'linhas extraídas: {len(ls)} (total informado: {total_informado(h)})')
        if ls: print('primeira:', ls[0][:8])
    else:
        main()
