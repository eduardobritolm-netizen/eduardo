# Painel de Dados da PGE-AM

Site estático no estilo Power BI que reúne, em um só lugar, dados abertos de interesse da
Procuradoria-Geral do Estado do Amazonas. É atualizado sozinho todo dia por um robô do GitHub
Actions e também publica uma API própria (JSON e CSV) para reuso dos dados.

## Páginas

| Página | O que mostra | Fonte dos dados | Atualização |
|---|---|---|---|
| **Início** (`index.html`) | Visão geral do painel e a tabela "Situação das fontes" | — | — |
| **Inteligência Processual** (`processual.html`) | Acervo, classes, assuntos, grau e período; Grandes Litigantes | DataJud/CNJ (API Pública do TJAM); Grandes Litigantes do CNJ (**manual**, `data/manual.json`) | automática, diária |
| **Ouvidoria** (`ouvidoria.html`) | Manifestações, prazos e temas | CGU — Fala.BR / Painel Resolveu? | automática quando houver link/base configurada |
| **Gestão e Transparência** (`transparencia.html`) | Remuneração de servidores, diárias e passagens | Portal da Transparência do AM | automática, diária |
| **Contratações** (`contratacoes.html`) | Abas **Contratos**, **Licitações**, **Convênios** e **Notas** | PNCP (contratos e licitações); Portal SGC da SEFAZ (contratos); sisconv (convênios/transferências) | automática, diária |
| **Despesas** (`despesas.html`) | Aba **Visão executiva** (KPIs, execução, rubricas, composição macro, execução por unidade) + aba **Despesas detalhadas** | Dados Abertos de Execução Orçamentária da SEFAZ-AM (UGs 011103 PGE e 011706 FUNDPGE) | automática, diária (ver ressalva abaixo) |
| **Pesquisa de preços** (`precos.html`) | Abas **Pesquisa de preços** e **Plano de Contratações (PCA)** | Compras.gov.br (preços praticados); PNCP (PCA) | automática, diária |
| **Precedentes LAI** (`precedentes.html`) | Precedentes de transparência/LAI | Base pública de precedentes | automática/periódica |
| **Dados abertos (API)** (`api.html`) | Documentação da API própria | Gerada pelo próprio robô | a cada execução |

## Despesas — Visão executiva

A página de despesas tem duas abas:

- **Visão executiva** — painel no estilo executivo, montado exclusivamente a partir de
  `data/despesas.json`: linha de KPIs (dotação autorizada, empenhado com % da dotação, liquidado,
  pago com % do empenhado e saldo a empenhar = autorizado − empenhado); medidor de execução
  financeira (pago / dotação autorizada); barras das maiores rubricas por elemento de despesa;
  rosca de composição macro por grupo de despesa; barras por programa e por função de governo;
  execução mês a mês (empenhado × pago); e a tabela de execução por unidade gestora (PGE 011103 e
  FUNDPGE 011706). Um seletor permite ver os KPIs consolidados ou por unidade. Empenhado, liquidado
  e pago são sempre tratados como estágios distintos.
- **Despesas detalhadas** — a visão original, com os mesmos dados em outro recorte (séries, unidade,
  elementos, fontes e programas).

Como `despesas.json` não traz o detalhamento por elemento/grupo separado por unidade, os gráficos de
rubricas, composição, programa, função e série mensal são consolidados (PGE + FUNDPGE); isso está
indicado nas notas de cada visual. Os KPIs e a tabela, esses sim, distinguem cada unidade.

## Coleta automática (GitHub Actions)

O robô (`.github/workflows/atualizar.yml`) roda todo dia às **02h17 de Manaus** (06h17 UTC),
executa `scripts/atualizar.py` e publica o resultado quando há mudança. Cada coletor é independente:
se uma fonte estiver fora do ar, o robô mantém o último dado daquela fonte e atualiza as demais.
O log fica em **Actions**; a data de cada fonte aparece na tabela "Situação das fontes" da página inicial.

Coletores em `scripts/`: `datajud.py`, `transparencia.py`, `ouvidoria.py` / `falabr_api.py`,
`pncp.py`, `contratos_sgc.py` / `contratos_sefaz.py`, `convenios_sefaz.py`, `precos.py`, `pca.py`,
`precedentes.py`, `sefaz_exec.py` / `baixar_execucao_sefaz.py`, `api.py` e o orquestrador `atualizar.py`.

### Ressalva honesta sobre as DESPESAS (SEFAZ — Dados Abertos)

O CSV oficial de Execução Orçamentária não tem URL estável de download: o portal de Dados Abertos
da SEFAZ entrega o arquivo como um download iniciado no navegador (blob). Por isso a coleta das
despesas é feita por **navegador headless** (Playwright/Chromium), automatizada no workflow.

**Essa automação é frágil:** se a SEFAZ mudar a estrutura da página de Dados Abertos (nomes de
campos, fluxo de download, proteções), a coleta pode falhar. Quando isso acontece, o robô usa o
último CSV local baixado e, na ausência dele, preserva o `data/despesas.json` anterior — ou seja, o
painel continua mostrando o último dado válido, sem inventar números. Não há garantia de que a
coleta funcione a cada execução; convém conferir a data em "Situação das fontes" e o log em Actions.

## API de Dados Abertos

A cada execução o robô gera a pasta `api/` com JSON e CSV de cada conjunto, o catálogo
(`api/catalogo.json`) e a especificação OpenAPI (`api/openapi.yaml`). Documentação para o público em
`api.html`. Endereço base: `https://eduardobritolm-netizen.github.io/eduardo/api/`.

## Endereço e publicação

Depois de ativado o GitHub Pages: **https://eduardobritolm-netizen.github.io/eduardo/**

Para colocar no ar (uma vez só):

1. **Settings → Pages** → *Source: Deploy from a branch* → branch `main`, pasta `/ (root)` → Save.
2. **Settings → Actions → General** → *Workflow permissions* → **Read and write permissions** → Save.
3. **Actions → Atualizar dados do painel → Run workflow** para testar na hora. Depois roda sozinho todo dia.

No site da PGE (WordPress), peça à Prodam para embutir:
```html
<iframe src="https://eduardobritolm-netizen.github.io/eduardo/" style="width:100%;height:1400px;border:0" title="Painel de Dados da PGE-AM"></iframe>
```

## Fontes manuais e opcionais

- **Grandes Litigantes (CNJ):** não há API. Uma vez por mês, abra o painel, filtre TJAM e anote os
  números em `data/manual.json` (editável direto no GitHub). O próprio arquivo explica cada campo.
- **Ouvidoria (CGU):** defina a variável `OUVIDORIA_URLS` (Settings → Secrets and variables →
  Actions → Variables) com os links dos arquivos `.zip`/`.csv`, ou coloque
  `Manifestacoes_Ouvidoria_AAAA.csv` em `fontes/ouvidoria/`. Sem nenhuma das duas, a página mantém os
  dados atuais.
- **Colab (alternativa):** se algum site recusar o robô do GitHub, rode a coleta pelo
  [Google Colab](https://colab.research.google.com/github/eduardobritolm-netizen/eduardo/blob/main/colab/atualizar_painel.ipynb)
  (execução manual, ~5 min, com um token fine-grained de Contents: Read and write só deste repositório).

## Estrutura

```
index.html  processual.html  ouvidoria.html  transparencia.html
contratacoes.html  despesas.html  precos.html  precedentes.html  api.html
assets/      ← identidade visual (redesign.css, logo.svg)
data/        ← JSON lidos pelas páginas (gerados pelo robô; manual.json é editado à mão)
api/         ← API pública (JSON, CSV, catálogo e OpenAPI), gerada pelo robô
scripts/     ← coletores em Python e o orquestrador atualizar.py
fontes/      ← insumos de coleta e referências (ex.: ouvidoria, referencia_sica.html)
colab/       ← notebook de coleta manual
.github/workflows/atualizar.yml  ← agendamento diário
```

## Licenças das fontes

As bases seguem as licenças de suas fontes de origem. Os dados de Execução Orçamentária da SEFAZ-AM
são publicados sob **CC BY-NC 4.0**. Agregação e apresentação: Coordenadoria de Transparência e
Ouvidoria da PGE-AM.
