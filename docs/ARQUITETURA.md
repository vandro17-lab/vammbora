# Arquitetura — Vambora

## Visão geral

Aplicação **SPA (Single Page Application)** em React + TypeScript, servida como site estático e
instalável como **PWA**. Na Etapa 1 todos os dados vêm de uma camada local de demonstração; a
camada real (Supabase) entra na Etapa 2 **sem reescrever as telas**, graças ao isolamento abaixo.

```
┌─────────────────────────────────────────────┐
│                    Telas (pages)             │
│  Home · Resultados · Perfil · Motorista · 404│
└───────────────┬─────────────────────────────┘
                │ usa
┌───────────────▼─────────────────────────────┐
│        Componentes de UI (design system)     │
│  marca · layout · home · busca · resultados  │
└───────────────┬─────────────────────────────┘
                │ chama
┌───────────────▼─────────────────────────────┐
│                  lib/ (lógica)               │
│  matching(simulado) · whatsapp · searchParams│
└───────────────┬─────────────────────────────┘
                │ lê
┌───────────────▼─────────────────────────────┐
│   Fonte de dados  (hoje: data/ local)        │
│   amanhã: adaptador Supabase (mesma forma)   │
└─────────────────────────────────────────────┘
```

## Princípios de isolamento (chave para evoluir sem refazer)

1. **Tipos de domínio** (`src/types/`) descrevem as entidades de forma independente da fonte.
   As telas dependem dos tipos, não do Supabase nem do array local.
2. **Motor de compatibilidade** vive atrás de `buscarMotoristas()` / `avaliarCompatibilidade()`
   em `src/lib/matching.ts`. Trocar a implementação (simulada → motor real) não afeta a UI.
3. **Fonte de dados** hoje é `src/data/*`. Na Etapa 2 criaremos `src/data/supabase/*` com a mesma
   assinatura, e a flag `VITE_USE_SUPABASE` decide qual usar.
4. **WhatsApp** é montado por funções puras e testadas (`src/lib/whatsapp.ts`), sem efeitos
   colaterais até o clique.

## Design System

Tokens centrais em `tailwind.config.ts` e `src/index.css`:

- **Cores:** `navy` (azul-marinho, marca), `mint` (verde-menta, avançar/confiança), `amber`
  (avisos/demo), além de branco e cinzas neutros.
- **Tipografia:** Plus Jakarta Sans (títulos) + Inter (texto).
- **Componentes utilitários:** `.btn`, `.card`, `.chip`, `.field-input`, `.demo-ribbon`.
- **Motion:** Framer Motion, sempre respeitando `prefers-reduced-motion`.
- **Acessibilidade:** foco visível global, "pular para conteúdo", `aria-live` no loader, contraste.

## PWA

- `vite-plugin-pwa` gera o **service worker versionado** (Workbox) com `cleanupOutdatedCaches`.
- Apenas o app-shell (JS/CSS/HTML/ícones) é pré-cacheado. **Nenhum dado privado** é cacheado.
- Atualização de versão é **oferecida ao usuário** (`ReloadPrompt`), nunca forçada em silêncio.
- Ícones 192/512 **any** + **maskable**, gerados por `scripts/generate-icons.mjs` (sharp).

## Rotas

| Caminho | Tela |
|---|---|
| `/` | Home (landing + busca) |
| `/resultados` | Resultados (critérios na URL, compartilhável) |
| `/van/:slug` | Perfil do motorista |
| `/motorista` | Entrada + prévia do painel do motorista |
| `*` | 404 |

## Decisões técnicas relevantes

Registradas em [`DECISOES.md`](DECISOES.md). Destaques:

- SPA estática + PWA (sem servidor próprio na Etapa 1): funciona no navegador/celular **sem
  instalação** e sem serviço pago — requisito do Ideathon.
- Dados de busca na **URL** (não só em memória): busca recarregável e compartilhável.
- Componentes acessíveis escritos à mão com Tailwind, em vez de arrastar uma biblioteca grande,
  para manter o bundle enxuto ("biblioteca premium não significa paga/pesada").
