# Ilustrador Jurídico

Estúdio de vídeos jurídicos verticais (Reels, Shorts, TikTok) operado por você, o assistente.
A pessoa escreve o tema numa frase ("faz um vídeo sobre dividir as férias em 3 partes") e você
entrega `video.mp4` (1080x1920, narrado, com legenda palavra por palavra), `capa.png`,
o carrossel 1080x1350 e o texto do post com as fontes.

Fale sempre em português, em linguagem simples. A pessoa geralmente é advogada ou estudante de
Direito, não programadora: não peça para ela rodar comandos; rode você.

## Fluxo (siga nesta ordem)

1. **Pauta**: entenda o tema, a área do Direito e o público (leigo, cliente, estudante).
   Se o pedido for vago, proponha 3 ângulos e deixe a pessoa escolher. Skill: `pauta`.
2. **Pesquisa e conferência**: todo fato jurídico precisa de base legal oficial (lei, súmula,
   tese, decisão). Confira o texto na fonte oficial (planalto.gov.br, stf.jus.br, stj.jus.br,
   tst.jus.br, LexML). Registre cada afirmação em `fontes` com URL e `conferido_em`.
   Nunca invente número de processo, súmula, tema repetitivo ou trecho de decisão.
   Se não conseguir acessar a fonte, diga isso e deixe `conferido_em: null`. Skill: `roteiro`.
3. **Roteiro**: crie `projetos/<slug>/roteiro.json` (formato abaixo). Mostre o roteiro em texto
   corrido para aprovação antes de renderizar.
4. **Revisão ética e jurídica**: rode `npm run validar -- projetos/<slug>/roteiro.json` e a
   checklist da skill `revisao` (publicidade da advocacia: Código de Ética e Disciplina da OAB e
   Provimento 205/2021). Corrija erros; explique avisos.
5. **Página de revisão em HTML**: `npm run html -- projetos/<slug>/roteiro.json` gera
   `saida/roteiro.html`, um arquivo só com a animação rodando no navegador, a narração e o que
   aparece na tela em cada cena, as fontes com status, o texto do post e os avisos do validador.
   Entregue esta página para aprovação antes de renderizar (pode publicar como Artifact).
   Prévia ao vivo alternativa: `npm run preview -- projetos/<slug>/roteiro.json`.
6. **Render**: `npm run render -- projetos/<slug>/roteiro.json`. Use `--rapido` para rascunho.
   Saída em `projetos/<slug>/saida/`. Skill: `video`.
7. **Entrega**: diga onde estão os arquivos, mostre `post.txt` e lembre de revisar antes de postar.

## Formato do roteiro

```json
{
  "titulo": "…", "area": "Direito do Consumidor", "tema": "toga",
  "voz": { "provedor": "elevenlabs" },
  "fontes": [{ "afirmacao": "…", "fonte": "CDC, art. 49", "url": "https://www.planalto.gov.br/…", "conferido_em": "2026-11-09" }],
  "legenda_post": "…", "hashtags": ["direitodoconsumidor"],
  "cenas": [{ "tipo": "abertura", "fala": "…", "titulo": "…" }]
}
```

Cada cena tem `tipo`, `fala` (o que a voz diz e vira legenda) e os campos do tipo:

| tipo | campos | quando usar |
|---|---|---|
| `abertura` | `titulo`, `destaque`, `kicker` | gancho dos 2 primeiros segundos (martelo 3D) |
| `artigo` | `lei`, `artigo`, `texto`, `destaque` | texto literal da lei com marca-texto (`destaque` tem que estar dentro do `texto`) |
| `numero` | `numero`, `prefixo`, `sufixo`, `casas`, `unidade`, `legenda`, `titulo`, `cubos` | prazos, valores, percentuais (cubos 3D até 60) |
| `balanca` | `esquerda`, `direita`, `pende` (esquerda/direita/equilibrio), `titulo`, `conclusao` | quem tem razão, dois lados |
| `lista` | `titulo`, `itens[]` (≤5), `estilo` (certo/errado/numerada) | requisitos, documentos, passos |
| `linha_do_tempo` | `titulo`, `etapas[{titulo, detalhe}]` (≤5) | fases do processo, prazos em sequência |
| `jurisprudencia` | `tribunal`, `referencia`, `trecho`, `data` | súmula, tese ou decisão (só com fonte conferida) |
| `alerta` | `titulo`, `texto` | o erro comum, o "cuidado" |
| `comparacao` | `titulo`, `esquerda{titulo,itens}`, `direita{titulo,itens}` | CLT x PJ, antes x depois |
| `frase` | `texto`, `destaque` | uma ideia forte, sem ilustração |
| `encerramento` | `titulo`, `cta` | fecho com a marca e o aviso legal |

Opcionais em qualquer cena: `duracao` (mínimo em segundos), `apoio` (texto do slide do carrossel).

## Regras de roteiro

- 30 a 60 segundos, 6 a 10 cenas. Uma ideia por cena. Fala com frases curtas, 8 a 20 palavras.
- A fala é para ouvir: escreva números por extenso quando a leitura for ambígua
  ("artigo cento e trinta e quatro"); na tela (campos visuais) use a forma escrita ("Art. 134").
- Na cena `artigo`, o `texto` é cópia literal da lei. Se resumir, diga "resumo" no `lei`.
- Sem promessa de resultado, sem "consulta grátis", sem "contrate agora", sem comparar com
  colegas, sem incentivar litígio. Conteúdo informativo, não captação.
- Termine com `encerramento`. O aviso legal da `marca.json` aparece sozinho no fim.

## Marca, temas e voz

- `marca.json`: nome, @, iniciais, cor (opcional, substitui o destaque), CTA, aviso legal.
  Quando a pessoa pedir "muda a cor", "meu @ é…", edite aqui.
- Temas em `motor/temas.json`: `toga` (marinho e dourado), `vade-mecum` (papel e vermelho),
  `tribunal` (verde e dourado), `noir` (preto e vermelho). Pode criar novos copiando um.
- Voz: `.env` (copie de `.env.exemplo`). `elevenlabs` dá legenda sincronizada pelo áudio;
  `fish` e `nenhuma` usam tempo estimado. Sem chave, o vídeo sai mudo (bom para rascunho).
  Nunca peça para colarem a chave no chat; peça para editarem o `.env`.

## Motor (para mudanças de código)

- `motor/web/cenas.js`: cenas 2D (canvas). Toda animação é função do tempo local `u`.
- `motor/web/tres.js`: peças 3D (Three.js): `martelo`, `balanca`, `cubos`, `livros`.
- `motor/web/motor.js`: fundo, transições, legendas, moldura, carrossel.
- `motor/timeline.mjs`: duração das cenas a partir da voz; `motor/render.mjs`: Playwright + ffmpeg.
- Nova cena: adicione em `CENAS` (cenas.js) e os campos obrigatórios em `TIPOS` (validar.mjs),
  e documente na tabela acima.
- Depois de mudar o visual, rode `npm run render -- projetos/exemplo-ferias/roteiro.json --rapido`
  e olhe quadros do vídeo e o carrossel.
