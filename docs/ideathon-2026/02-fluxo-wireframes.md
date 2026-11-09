# Fluxo e wireframes documentais

Estes diagramas são documentação estática, não novos componentes de interface. O fluxo abaixo resume as rotas/jornadas localizadas em `src/App.tsx`, `src/components/search/SearchForm.tsx`, `src/pages/SearchResultsPage.tsx`, `src/features/family-search-demo/FamilyDemoResults.tsx` e no painel do motorista. Os wireframes são de baixa fidelidade e representam a estrutura/jornada, não uma especificação pixel-perfect nem prova de teste com usuários.

## User flow — família (busca demonstrativa)

```mermaid
flowchart TD
  A[Início /] --> B[Informar embarque ou região]
  B --> C[Selecionar destino / escola]
  C --> D[Definir horário, turno e modalidade]
  D --> E[Enviar pesquisa]
  E --> F{Dados e serviços disponíveis?}
  F -->|Sim| G[Resultados demonstrativos]
  F -->|Erro| H[Estado de erro / tentar novamente]
  G --> I[Ver perfil demonstrativo]
  I --> J[Contato / WhatsApp demonstrativo]
  J --> K[Combinar diretamente; disponibilidade não garantida]
```

A interface pode recorrer a serviços externos para localizar endereços/rotas. A busca demonstrativa não confirma vaga nem cria uma reserva real. Se a consulta de dados Supabase falha quando configurado, `VitrineProvider` marca erro; não se deve descrever isso como fallback silencioso.

## User flow — motorista (sintético)

```mermaid
flowchart TD
  A[Entrada do motorista] --> B[Conta / autenticação ou modo de demonstração]
  B --> C[Painel do motorista]
  C --> D[Veículos]
  C --> E[Rotas]
  E --> F[Criar/editar rota e paradas]
  F --> G[Planejamento / simulação de encaixe]
  G --> H[Revisar horários e capacidade]
  H --> I[Salvar conforme modo/configuração]
  I --> J[Visualizar rota / navegação]
```

O código contém múltiplas áreas e níveis de implementação. O modo de demonstração de motorista pode usar armazenamento local e não equivale à conta/serviço operacional. Evidência: `src/pages/motorista/`, `src/data/motorista-store.ts`, `src/lib/supabase.ts`.

## Wireframe 1 — pesquisa da família

```text
┌──────────────────────────────────┐
│ VanBora                 [Menu]   │
│ Encontre transporte escolar      │
├──────────────────────────────────┤
│ Embarque / bairro                │
│ [____________________________]   │
│ Escola ou destino                │
│ [____________________________]   │
│ Horário / turno                  │
│ [___________]   ( ) Ida ( ) Volta│
│ Contratação: [Mensal] [Avulso]   │
│                                  │
│ [       Buscar opções       ]    │
│ Dados demonstrativos identificados│
└──────────────────────────────────┘
```

## Wireframe 2 — resultados

```text
┌──────────────────────────────────┐
│ [←] Resultados da busca          │
│ Critérios resumidos / [Editar]   │
├──────────────────────────────────┤
│ DEMONSTRAÇÃO                     │
│ Perfil fictício · veículo        │
│ região / horário informado      │
│ R$ exemplo · vagas exemplo       │
│ [Ver perfil]                     │
├──────────────────────────────────┤
│ DEMONSTRAÇÃO                     │
│ Outra opção fictícia             │
│ [Ver perfil]                     │
│                                  │
│ Valores e disponibilidade não reais│
└──────────────────────────────────┘
```

## Wireframe 3 — organização de rota do motorista

```text
┌──────────────────────────────────┐
│ Painel do motorista              │
│ [Resumo] [Veículos] [Rotas]      │
├──────────────────────────────────┤
│ Minhas rotas                     │
│ [ + Criar rota ]                 │
│                                  │
│ Rota · turno · estado            │
│ Paradas: origem → embarques →    │
│ destino                          │
│ [Editar] [Planejar] [Mapa]       │
│                                  │
│ Cenário de demonstração, se ativo│
└──────────────────────────────────┘
```

## Confirmação necessária

A equipe deve revisar se estes esquemas correspondem ao fluxo que pretende demonstrar em 09/11, especialmente qual caminho será usado no palco e quais páginas funcionam sem credenciais/configuração externa. Não foram criados screenshots, nem foi alegado teste de usabilidade.
