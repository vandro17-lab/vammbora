# Base demonstrativa "VB150" — Araçatuba

Pacote demonstrativo para a apresentação: **533 motoristas, 533 veículos, 1066 rotas
(533 ida + 533 volta), 4900 paradas, 9594 passageiros**, cobrindo os **41 destinos
escolares reais** já cadastrados (37 escolas + 4 faculdades), com MUITAS vans por
escola/turno (fan-out) para dar opções variadas de horário e preço em qualquer busca.

A busca usa o **motor de encaixe existente** (`buscarEmRotasReais`, o mesmo do
endpoint `/api/buscar-rotas`). Nada de resultado inventado no frontend.

## Fontes geográficas (verificáveis, sem invenção)

- **Escolas**: apenas **referenciadas por id** (não recadastradas). Coordenadas e
  `source` oficiais já no banco (educacao.sp.gov.br, aracatuba.sp.gov.br, cps.sp.gov.br, unesp.br).
- **Pontos de embarque**: **217 locais públicos reais do OpenStreetMap** em Araçatuba
  (pontos de ônibus, praças/parques, farmácias, UBS, terminal, etc.), cada um com
  `osm_type/osm_id` no rótulo da parada como prova. **Nunca sobre a coordenada da
  escola** e **nunca residências reais**. Passageiros têm identificadores anônimos.

## Arquivos e ORDEM de execução (no SQL Editor do Supabase)

1. `migrations/20260104000013_busca_demo_colunas_indices.sql` — **só se o banco for
   novo/limpo**. Alinha o schema (`routes.is_published`, `route_stops.habitual_arrival_min`)
   e cria o índice da busca. No projeto atual essas colunas **já existem** → é no-op seguro.
2. `seed-demo-150-aracatuba.sql` — importa a base (idempotente, transacional).
3. **Validação** (no fim do próprio seed, em comentário): confere 533/533/1066/4900/9594 e 41 escolas.

Remoção (desfaz **apenas** este pacote, sem tocar em dados reais/demos anteriores):
`remover-demo-150-aracatuba.sql`.

> Os identificadores do pacote têm prefixo de uuid `b150d0`, usado pela remoção.
> O seed **não** cria usuários no Supabase Auth (dono placeholder = admin/1º profile existente).

## Ativar o modo demonstração na busca (§6.1)

A busca de produção **exclui** rotas demonstrativas. O modo demo é ligado **só pelo
servidor** (nunca por parâmetro do navegador):

- Variável de ambiente no servidor/Vercel: **`BUSCAR_ROTAS_DEMO=1`**.

Com isso, `/api/buscar-rotas` passa a incluir as rotas `is_demo=true` e marca cada
resultado com `demo=true` (selo "Demonstração" no cartão). Sem a variável, o
comportamento de produção é preservado.

## Variáveis necessárias no Vercel

- `VITE_SUPABASE_URL` — URL do projeto (já usada).
- `VITE_USE_SUPABASE=true`.
- `SUPABASE_SERVICE_ROLE_KEY` — **secreta**, só no servidor (sem ela a busca responde 503).
- `BUSCAR_ROTAS_DEMO=1` — liga o modo demonstração.

(`VITE_SUPABASE_ANON_KEY` segue como hoje.)

## Regenerar os SQLs

Os SQLs são gerados a partir de um único ponto de verdade (o mesmo usado pelos testes):

```
node scripts/demo-aracatuba/build-sql.mjs
```

## Roteiro de demonstração (pesquisas validadas pelo motor)

Informe a origem, selecione o destino e **informe o horário de entrada** (ou o
turno). Resultados medidos nos testes de integração (estimativa por coordenadas):

| Origem (região) | Destino | Entrada | Vans viáveis | Melhor embarque → chegada |
|---|---|---|---|---|
| Jardim Ipanema (perto da Fatec, ~600 m) | Fatec Araçatuba | 07:00 | ~100 | 06:57 → 07:00 |
| Sul (Pça Dr. Bezerra de Menezes, ~6 km) | Fatec Araçatuba | 07:00 | ~78 | 06:27 → 06:49 |
| Centro (Pça Rui Barbosa) | Colégio Canarinho (Ipanema) | 12:30 | ~55 | 12:13 → 12:26 |

Observações da lógica (§ eficiência):
- IDA ordena por **sair de casa o mais perto possível** do horário de entrada
  (ainda chegando no horário). Perto da escola ⇒ embarque mais tarde (~06:55);
  mais longe ⇒ um pouco antes (~06:25) — nunca "1 hora antes".
- Há um **teto de antecedência** amarrado à distância real: descarta encaixes em
  que o aluno ficaria tempo demais a caminho (ex.: pegar a van 05:40 para 07:00).
- Só mostra rotas do **período compatível** com o horário de entrada informado.
