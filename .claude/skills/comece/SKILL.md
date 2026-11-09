---
name: comece
description: Primeiros passos do Ilustrador Jurídico. Use quando a pessoa disser "comece", "primeiros passos", "instala", ou for a primeira conversa no projeto.
---
# Primeiros passos

1. Confira o computador: `node -v` (precisa 18+), `ffmpeg -version`. Se faltar, explique como
   instalar no sistema da pessoa (Mac: `brew install node ffmpeg`; Windows: `winget install
   OpenJS.NodeJS.LTS Gyan.FFmpeg`) e rode você mesmo quando puder.
2. `npm install` e depois `npx playwright install chromium` (só na primeira vez).
3. Teste sem voz: `npm run exemplo`. Mostre `projetos/exemplo-ferias/saida/video.mp4`.
4. Marca: pergunte nome, @, iniciais, cor e se quer número da OAB no rodapé; grave em `marca.json`.
   Pergunte o tema visual preferido (toga, vade-mecum, tribunal, noir).
5. Voz (opcional): explique ElevenLabs (tem plano grátis; legenda sincronizada) e Fish Audio
   (paga por uso). Peça para a pessoa criar o `.env` a partir do `.env.exemplo` e colar a chave lá,
   nunca no chat.
6. Peça o primeiro tema numa frase e siga o fluxo do CLAUDE.md.
