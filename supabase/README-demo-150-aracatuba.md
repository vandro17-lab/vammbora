# Base demonstrativa "VB150" — Araçatuba

Pacote demonstrativo para a apresentação: **150 motoristas, 150 veículos, 300 rotas
(150 ida + 150 volta), 2045 paradas, 4072 passageiros**, cobrindo os **41 destinos
escolares reais** já cadastrados (37 escolas + 4 faculdades).

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
3. **Validação** (no fim do próprio seed, em comentário): confere 150/150/300/2045/4072 e 41 escolas.

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

## Roteiro de demonstração (pesquisas testadas que retornaram resultados)

Origem = ponto público real; destino = escola real. Todos retornaram encaixes
**compatíveis** calculados pelo motor (números dos testes de integração):

| Origem (lugar real) | Escola de destino | Sentido | Rotas avaliadas | Encaixes viáveis | Melhor (vagas / min a bordo) |
|---|---|---|---|---|---|
| Praça Getúlio Vargas (Higienópolis) | EE José Cândido | ida | 105 | 103 | 5 vagas / 1 min |
| Praça Mem de Sá (Jardim Nova Yorque) | Colégio Geração Raízes | ida | 62 | 61 | 5 vagas / 19 min |
| Bosque da Saudade (Aviação) | EMEB Apparecida Garcia Carvalho Rico | ida | 97 | 94 | 2 vagas / 6 min |

Mais exemplos (também testados): Praça Ikeda → EMEB Luiz A. Bertolucci; Praça Dr.
Bezerra de Menezes → EE José Arantes Terra.
