# 04 — Referência Visual

## ⚠️ IMPEDIMENTO: imagens de referência não recebidas
O pedido cita "imagens anexadas" que definem a experiência visual desejada, mas
**nenhuma imagem chegou junto desta execução** (apenas texto). Portanto, o
detalhamento visual tela-a-tela (paleta exata, tipografia, proporções, ícones,
cartões, gráficos, estados) **fica pendente** e será completado assim que os
arquivos forem enviados. **Não** inventamos uma referência visual: isso violaria
o pedido de "fidelidade extremamente próxima" e produziria um alvo errado.

### O que precisamos de você (imagens)
Envie as imagens (print/alta resolução), idealmente **uma por tela** e nomeadas
pela função (ex.: `entrada.png`, `dashboard.png`, `rotas.png`, `simulador.png`,
`financeiro.png`, `combustivel.png`, `clube.png`, `alugavan.png`, `perfil.png`).
Para cada imagem vamos extrair e registrar aqui: paleta (hex), tipografia,
hierarquia, espaçamento, ícones, cartões/sombras/gradientes, navegação inferior,
botões, gráficos e estados — e ligar cada tela à funcionalidade real/planejada.

Regra fixa já definida: **toda van ilustrada é uma van ESCOLAR brasileira**
(faixa amarela, identificação "ESCOLAR"); nunca van executiva/turística.
As imagens definem **apresentação**, nunca os resultados dos cálculos.

## Sistema visual atual (ponto de partida real)
- **Tailwind 3.4** com tema custom: `navy` (azul-marinho), `mint` (verde),
  `amber`; defaults (`sky`, etc.) disponíveis. Fontes via classes `font-display`.
- Componentes de marca já existentes: `StartupExperience` (abertura animada da
  van), `Layout` público, `MotoristaShell` (chrome do painel), cartões (`card`,
  `card-interactive`), botões (`btn`, `btn-primary`, `btn-ghost`, `btn-lg`),
  campos (`field-input`, `field-label`).
- `VamboraProPage` já traz uma **navegação inferior** (Início, Rotas, Vagas,
  Financeiro, Mais) e 16 módulos — é a base visual mais próxima do app desejado,
  porém **demonstrativa** (dados fixos). Ver `07`.

## Como o design system será definido (Fase 3)
Quando as imagens chegarem, a Fase 3 produzirá `04` completo + tokens (cores,
tipos, espaçamentos, raios, sombras) e um inventário de componentes reutilizáveis,
derivados das imagens, reaproveitando o que já existe no Tailwind/`index.css`.
Nada de telas nesta etapa.
