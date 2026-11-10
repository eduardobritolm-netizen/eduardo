# Ilustrador Jurídico

Estúdio de vídeos jurídicos verticais operado pelo **Claude Code** (ou Codex). Você escreve o tema
numa frase; o assistente pesquisa a base legal, confere as fontes, escreve o roteiro, narra e
monta as cenas animadas (com peças 3D). Você revisa e posta.

**Saída de cada vídeo** (`projetos/<tema>/saida/`):
- `video.mp4`: 1080x1920, narrado, legenda que acende palavra por palavra
- `capa.png`: capa do Reels
- `carrossel/01.png …`: carrossel 1080x1350 do mesmo tema
- `post.txt`: legenda do post, hashtags, fontes e aviso legal

## Como usar

1. Instale Node 18+ e ffmpeg.
2. Na pasta do projeto: `npm install` e `npx playwright install chromium`.
3. Abra a pasta no Claude Code e escreva: **"comece pelos primeiros passos"**.
4. Depois peça: *"faz um vídeo sobre o direito de arrependimento em compras online"*.

Teste sem IA nem voz: `npm run exemplo` (gera o vídeo de exemplo sobre férias).

## Cenas jurídicas

`abertura` (martelo 3D) · `artigo` (texto de lei com marca-texto) · `numero` (prazos e valores
com cubos 3D) · `balanca` (balança 3D que pende) · `lista` · `linha_do_tempo` ·
`jurisprudencia` · `alerta` · `comparacao` · `frase` · `encerramento`.

Temas visuais: `toga`, `vade-mecum`, `tribunal`, `noir` (em `motor/temas.json`).

## Comandos

| comando | o que faz |
|---|---|
| `npm run validar -- projetos/x/roteiro.json` | confere estrutura, fontes e alertas de publicidade (OAB) |
| `npm run html -- projetos/x/roteiro.json` | página HTML de revisão (animação, cenas, fontes, post) antes do render |
| `npm run preview -- projetos/x/roteiro.json` | prévia ao vivo no navegador |
| `npm run render -- projetos/x/roteiro.json` | vídeo + capa + carrossel + post |
| `… --rapido` / `--sem-voz` / `--sem-carrossel` / `--so-carrossel` | variações do render |

## Voz

Copie `.env.exemplo` para `.env` e escolha `elevenlabs` (legenda sincronizada pelo áudio) ou
`fish`. Sem chave, o vídeo sai sem narração (bom para rascunho).

## Responsabilidade

O conteúdo é informativo. Confira cada fonte antes de publicar e siga as regras de publicidade da
advocacia (Código de Ética e Disciplina da OAB e Provimento 205/2021). O validador só aponta
expressões de risco; a revisão final é sua.
