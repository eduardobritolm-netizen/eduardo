# Painel de Dados da PGE-AM

Site estático com quatro páginas no estilo Power BI, atualizado sozinho todo dia por um robô do GitHub Actions.

| Página | Fonte | Atualização |
|---|---|---|
| Inteligência Processual | CNJ – API Pública do DataJud (TJAM) | automática, diária |
| | CNJ – Grandes Litigantes (Estado por vara e tribunal) | **manual** – editar `data/manual.json` |
| Ouvidoria | CGU – Painel Resolveu? / Fala.BR | automática quando houver link configurado (ver abaixo) |
| Gestão e Transparência | Portal da Transparência do AM – APIs de Remuneração de Servidores e de Diárias e Passagens | automática, diária |

## Endereço

Depois de ativado o GitHub Pages: **https://eduardobritolm-netizen.github.io/eduardo/**

## Como colocar no ar (uma vez só, ~10 minutos)

Os arquivos já estão neste repositório. Falta só ligar duas chaves:

1. **Settings → Pages** → *Source: Deploy from a branch* → branch `main`, pasta `/ (root)` → Save.
   Em 1–2 minutos o site fica em `https://eduardobritolm-netizen.github.io/eduardo/`.
2. **Settings → Actions → General** → *Workflow permissions* → marque **Read and write permissions** → Save.
3. **Actions → Atualizar dados do painel → Run workflow** para testar na hora.
   Depois disso ele roda sozinho todo dia às 02h17 (horário de Manaus).

Quando a PGE tiver conta institucional no GitHub, transfira o repositório em **Settings → Transfer ownership**.

## Ouvidoria (CGU)

A CGU publica a base anual de manifestações para download. Para o robô buscar sozinho:
**Settings → Secrets and variables → Actions → aba Variables → New repository variable**
- Nome: `OUVIDORIA_URLS`
- Valor: o(s) link(s) do arquivo `.zip`/`.csv` do ano corrente e anteriores, separados por espaço
  (copie o link do botão de download no Painel Resolveu?).

Alternativa sem link: coloque os arquivos `Manifestacoes_Ouvidoria_AAAA.csv` na pasta `fontes/ouvidoria/`
(cuidado: arquivos acima de 100 MB não sobem pelo GitHub; nesse caso use o link).
Sem nenhuma das duas, a página mantém os dados atuais.

## Grandes Litigantes (manual)

O painel do CNJ não tem API. Uma vez por mês, abra o painel, filtre TJAM e anote os números em
`data/manual.json` (edite direto no GitHub, botão do lápis). O próprio arquivo explica cada campo.

## No site da PGE (WordPress)

Peça à Prodam para incluir numa página:
```html
<iframe src="https://eduardobritolm-netizen.github.io/eduardo/" style="width:100%;height:1400px;border:0" title="Painel de Dados da PGE-AM"></iframe>
```

## Se algo falhar

Cada fonte é independente: se uma API estiver fora do ar, o robô mantém os dados anteriores daquela fonte
e atualiza as outras. O log fica em **Actions**. A data de cada fonte aparece na tabela "Situação das fontes"
da página inicial.

## Estrutura
```
index.html  processual.html  ouvidoria.html  transparencia.html
data/        ← JSON lidos pelas páginas (gerados pelo robô; manual.json é editado à mão)
scripts/     ← coletores em Python (datajud.py, transparencia.py, ouvidoria.py, atualizar.py)
fontes/      ← arquivos de ouvidoria colocados à mão (opcional)
.github/workflows/atualizar.yml  ← agendamento diário
```
