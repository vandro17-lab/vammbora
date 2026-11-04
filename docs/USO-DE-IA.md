# Declaração de Uso de IA — Vambora

_Exigência do regulamento do Ideathon Fatec 2026: declarar uso de IA, bibliotecas, templates e fontes._

## Ferramenta de IA utilizada

- **Assistente:** Claude (Anthropic), via Claude Code, atuando como engenheiro/arquiteto assistente.
- **Como foi usado:** scaffold do projeto, implementação do design system e das telas, escrita de
  testes, geração de ícones do PWA, redação da documentação e organização do repositório, seguindo
  as **instruções mestras** definidas pela equipe.

## O que é humano e o que é assistido

- A **visão de produto**, as regras de negócio, as decisões de escopo e a direção do projeto são da
  **equipe Van Bora** (documento mestre e instruções).
- A IA **ajudou na implementação** segundo essas instruções. Nenhuma decisão de produto foi tomada
  pela IA sem estar prevista nas instruções da equipe.

## Honestidade dos dados

- Os motoristas, escolas e telefones exibidos são **dados de demonstração**, claramente marcados.
- Nenhum dado real de menores foi usado.
- Nenhuma métrica, avaliação, pesquisa ou verificação foi inventada como se fosse real.

## Autoria e commits (Ideathon)

- O Ideathon exige **commits autênticos de pelo menos 3 integrantes reais**, cada um com sua conta.
- Os commits de assistência de IA são atribuídos ao **coordenador** como autor, com a IA como
  **co-autora** declarada.
- **Ação necessária da equipe:** cada integrante deve contribuir com sua própria conta Git
  (código, pesquisa, documentação, testes) para que a entrega reflita o trabalho real do grupo.
  Ver `docs/GUIA-PARA-INICIANTES.md`.

## Bibliotecas e licenças

Todas de código aberto e licença permissiva (MIT/ISC). Lista em `docs/DECISOES.md` (ADR-001) e
`package.json`.

## Fontes de dados externas (quando forem usadas)

- **Escolas:** Censo Escolar / INEP (a importar, guardando fonte, data e código). Ver
  `docs/pesquisas/escolas-inep/`.
- **Mapas/endereços:** OpenStreetMap e serviços compatíveis, respeitando licença e atribuição
  (a integrar). Até lá, confirmação manual de ponto.
