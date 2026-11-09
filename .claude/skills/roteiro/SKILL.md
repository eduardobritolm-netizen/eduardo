---
name: roteiro
description: Pesquisa a base legal, confere as fontes e escreve projetos/<slug>/roteiro.json. Use quando a pessoa der um tema de vídeo jurídico.
---
# Roteiro

1. Liste as afirmações jurídicas que o vídeo vai fazer (cada número, prazo, requisito).
2. Para cada uma, ache a fonte oficial e confira o texto atual (leis mudam; veja a redação
   vigente, não a revogada riscada no Planalto). Prefira: planalto.gov.br, stf.jus.br,
   stj.jus.br, tst.jus.br, lexml.gov.br. Confira em 2 fontes quando houver dúvida.
3. Preencha `fontes` com `afirmacao`, `fonte`, `url` e `conferido_em` (data de hoje).
   Sem acesso à fonte: `conferido_em: null` e avise a pessoa.
4. Escreva as cenas seguindo as regras do CLAUDE.md:
   - Cena 1 `abertura` com pergunta ou contradição. Cena final `encerramento`.
   - Varie os tipos (não use o mesmo tipo duas vezes seguidas, exceto `numero`).
   - Use `artigo` quando a letra da lei for o argumento; `destaque` é trecho literal do `texto`.
   - `legenda_post`: 2 a 4 frases, sem promessa, terminando com convite a salvar/compartilhar.
5. Slug: tema em minúsculas com hífen (`projetos/direito-de-arrependimento/`).
6. Mostre à pessoa o roteiro em texto corrido (fala por cena + o que aparece na tela) e
   as fontes. Só renderize depois do ok.
