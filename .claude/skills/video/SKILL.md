---
name: video
description: Renderiza o vídeo, a capa e o carrossel de um roteiro aprovado. Use quando a pessoa aprovar o roteiro ou pedir "renderiza", "gera o vídeo".
---
# Vídeo

1. `npm run validar -- projetos/<slug>/roteiro.json` (pare se houver erro).
2. Rascunho: `npm run render -- projetos/<slug>/roteiro.json --rapido --sem-voz`.
   Final: `npm run render -- projetos/<slug>/roteiro.json`.
   Outras opções: `--sem-carrossel`, `--so-carrossel`.
3. Confira você mesmo antes de entregar: extraia alguns quadros
   (`ffmpeg -ss 5 -i saida/video.mp4 -frames:v 1 /tmp/q.png`) e olhe texto cortado,
   sobreposição e legibilidade. Olhe também `saida/carrossel/*.png`.
4. Se algo não coube: encurte o texto da cena (títulos ≤ 8 palavras, itens ≤ 6 palavras).
5. Entregue: `saida/video.mp4`, `saida/capa.png`, `saida/carrossel/`, `saida/post.txt`.
