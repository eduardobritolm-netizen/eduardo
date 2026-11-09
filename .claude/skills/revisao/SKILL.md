---
name: revisao
description: Revisão jurídica e ética do roteiro antes do render (fontes, precisão, publicidade da advocacia). Use antes de todo render final.
---
# Revisão

Rode `npm run validar -- projetos/<slug>/roteiro.json` e depois confira manualmente:

**Precisão**
- Cada afirmação da fala tem fonte em `fontes`? A redação é a vigente?
- Generalizou algo que tem exceção relevante (convenção coletiva, regime especial, Súmula)?
  Se sim, diga "em regra" na fala.
- Números, prazos (dias corridos x úteis) e valores batem com a fonte?

**Publicidade da advocacia** (Código de Ética e Disciplina da OAB, arts. 39 a 47, e
Provimento 205/2021) — a pessoa deve conferir as regras vigentes da sua seccional:
- Caráter informativo, discreto e sóbrio. Nada de promessa de resultado ou de êxito.
- Sem oferta de preço, "consulta gratuita" ou captação direta ("chama no direct que eu resolvo").
- Sem comparar com colegas nem se autoproclamar "o melhor".
- Sem expor casos de clientes nem dados pessoais.
- Sem incentivar litígio.

Mostre o resultado em lista curta: o que corrigiu e o que a pessoa precisa decidir.
