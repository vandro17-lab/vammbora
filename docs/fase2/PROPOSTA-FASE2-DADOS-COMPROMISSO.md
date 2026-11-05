# Proposta — Fase 2: dados do compromisso de atendimento por aluno

> **Status: PROPOSTA.** Nada foi aplicado no banco nem em produção. Este documento
> entrega o desenho, o SQL aditivo, os arquivos a alterar, os riscos, a estratégia
> de compatibilidade e os testes. Executar só após sua aprovação.

## 1. O que a Fase 2 precisa registrar (DEC-012, DEC-020..023)
Por aluno, no seu compromisso de uma rota:
1. **Horário habitual** de atendimento.
2. **Tolerância de antecipação** (minutos antes).
3. **Tolerância de atraso** (minutos depois).
4. **Tempo de atendimento** (minutos parado servindo aquele aluno).
5. **Origem da estimativa** do tempo de atendimento (informado / provisório / desconhecido).

## 2. Onde esses campos devem morar — e por quê

**Decisão: em `route_passengers` (o compromisso do aluno na rota), NÃO em `route_stops`, NÃO em tabela nova.**

Modelo atual (confirmado no banco):
- `route_stops` = **lugar físico** da parada: `lat/lng`, `label`, `type`, `destination_id`, `ordem`, `leg_time_min`. Uma parada é **compartilhada** por vários alunos (via `board_stop_id`/`alight_stop_id`).
- `route_passengers` = **o vínculo aluno↔rota↔(parada de embarque, parada de desembarque)**: já é exatamente "o compromisso do aluno naquele sentido".

Por que **não** na parada (`route_stops`):
- A sua pergunta-chave: **vários alunos podem compartilhar o mesmo endereço**. Se os campos ficassem na parada, todos os alunos daquele ponto teriam forçosamente o mesmo horário/tolerância/tempo — o que **DEC-006 §3.1 e DEC-022 proíbem** ("Dois alunos no mesmo endereço podem ter condições diferentes"; "a duração pertence ao atendimento individual do aluno na parada e no sentido").

Por que resolve **ida e volta** naturalmente:
- Ida e volta são **rotas separadas** (já é assim hoje) ⇒ **linhas `route_passengers` separadas** por sentido ⇒ cada linha carrega o valor do seu sentido, sem ambiguidade. Na ida, o horário/tempo se referem ao **embarque na casa**; na volta, ao **desembarque na casa** (documentado nos `COMMENT`s). Um único conjunto de campos por linha basta porque cada linha é um sentido.

Por que **não** criar tabela nova (vínculo aluno-parada):
- `route_passengers` **já é** esse vínculo (tem `board_stop_id` e `alight_stop_id`). Uma tabela à parte duplicaria o relacionamento — "estrutura desnecessária", que você pediu para evitar.

**Sem duplicar dados existentes:**
- `drivers.boarding_time`, `drivers.tolerance_before_min/after_min` são **padrões do motorista** (nível motorista/exibição). `routes.last_dropoff_min`/`early_leave_limit_min` são **limites da rota**. Os novos campos são **por aluno** e não substituem nem repetem esses — os `COMMENT`s deixam a distinção explícita.

## 3. SQL proposto (aditivo, não destrutivo)
Arquivo completo: [`proposta_migracao_compromisso_aluno.sql`](./proposta_migracao_compromisso_aluno.sql). Resumo:

```sql
alter table public.route_passengers
  add column if not exists horario_habitual_min int,
  add column if not exists ajuste_antes_min     int,
  add column if not exists ajuste_depois_min    int,
  add column if not exists atendimento_min       int,
  add column if not exists atendimento_origem    text;
-- + CHECKs idempotentes (faixas 0..1439 / 0..120 / 0..60 / enum de origem), aceitando NULL
-- + COMMENTs explicando semântica, sentido (ida/volta) e a diferença vs. campos de motorista/rota
```

Todas as colunas **NULLABLE, sem default** ⇒ linha sem valor = **não informado** (nunca "confirmado").
Ao aprovar, este arquivo vira `supabase/migrations/20260104000010_compromisso_aluno.sql`.

## 4. Arquivos que precisarão ser alterados (na execução, após aprovação)

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20260104000010_compromisso_aluno.sql` | **Novo** — a migração acima. |
| `supabase/migrations/..._rpc` (ou nova 0011) — `salvar_rota_completa` | **CREATE OR REPLACE** incluindo os 5 campos no `insert ... route_passengers`, lendo do JSON com `nullif(...)::int`. Retrocompatível: payload antigo sem as chaves ⇒ `NULL`. |
| `src/types/motorista.ts` (`PassageiroRota`) | Novos campos **opcionais**: `horarioHabitualMin?`, `ajusteAntesMin?`, `ajusteDepoisMin?`, `atendimentoMin?`, `atendimentoOrigem?: 'informado'\|'provisorio'\|'desconhecido'\|null`. |
| `src/data/motorista-store.ts` | `listarRotas`: incluir as 5 colunas no `select` de `route_passengers`. `mapRotaDoBanco`: ler os campos. `rotaParaBanco`: escrever os campos no JSON enviado à RPC. |
| `src/lib/rota-para-encaixe.ts` | `montarBase`: usar `atendimento_min` por passageiro (substituindo o `ATENDIMENTO_PADRAO_MIN` fixo); quando `NULL`, usar um provisório **marcado como estimativa** (não confirmado). |
| `src/lib/rota-para-motor.ts` | Trocar `DEFAULT_ATENDIMENTO_MIN = 1` fixo pelo `atendimento_min` do passageiro (coalescência provisória sinalizada); mapear `horario_habitual ± ajuste` para `ParadaPlanejamento.janela` (o motor `planejamento.ts` já aceita `janela`). |
| `src/lib/encaixe.ts` (`rotaOperacionalDeCadastro`) | Idem: `atendimentoMin` por passageiro em vez de `1`. |

**Dependências de UI (fora do escopo desta fase, listadas para visibilidade):** coletar os dados no cadastro
(`RotaBuilderPage.tsx` → `FormCasa`): "Ajuste de horário" (Fixo/5/10/Outro, DEC-006) e "tempo habitual de
embarque" (faixas de DEC-021). Enquanto a UI não coletar, os valores ficam `NULL` (provisório), nunca confirmados.

## 5. Estratégia de compatibilidade
- **Dados atuais:** `route_passengers` está **vazia hoje** (0 linhas — a importação demo de rotas ainda não foi aplicada; só os 6 motoristas-semente e destinos estão no banco). Logo, a migração é de **risco zero** para dados existentes.
- **Importação demo futura** (`supabase/seed-aracatuba-demo.sql`): não seta os novos campos ⇒ ficam `NULL` (provisório) ⇒ consistente. Nada a mudar lá; opcionalmente podemos preencher `atendimento_origem='provisorio'` na importação demo.
- **Rotas reais já cadastradas por motoristas** (quando houver): `NULL` = não informado; o painel pede os dados na próxima edição.
- **RPC retrocompatível:** `nullif(v_pax->>'campo','')::int` ⇒ payloads antigos do front continuam funcionando (inserem `NULL`).
- **Tipos opcionais (`?`)** ⇒ o código atual compila sem mudanças forçadas.
- **Regra de honestidade:** no motor e na UI, `NULL`/`provisorio` nunca aparecem como confirmados; o resultado correspondente é "estimativa" / "indeterminado", conforme já faz o motor.

## 6. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Aplicar a migração por engano | Arquivo fica em `docs/fase2/`, fora de `supabase/migrations/`, e marcado "NÃO APLICAR". |
| Quebrar a RPC para clientes antigos | `CREATE OR REPLACE` aditivo + `nullif` ⇒ payload sem as chaves insere `NULL`. |
| CHECK rejeitar escrita futura | Faixas amplas (0..1439 / 0..120 / 0..60) e enum de origem; só barra valor claramente inválido. |
| Apresentar provisório como confirmado | `atendimento_origem` + regra de UI/motor: provisório/NULL ⇒ "estimativa". |
| Confundir com campos de motorista/rota | `COMMENT`s explícitos; nomes distintos; sem reaproveitar `boarding_time`/`tolerance_*`. |
| Semântica de minuto do dia (fuso) | Minuto local 0..1439, sem timezone (como o resto do projeto). |

## 7. Testes necessários (na execução)
- **Unitários (vitest), puros:** `rotaParaBanco`/`mapRotaDoBanco` levam e trazem os 5 campos (ida e volta); dois alunos na **mesma parada** com valores **diferentes** preservam valores distintos.
- **Adaptador:** `atendimento_min` por aluno muda os horários calculados (p.ex. 1 vs 3 min altera chegada); `NULL` ⇒ provisório sinalizado (não confirmado).
- **Janela individual:** `horario_habitual ± ajuste` vira `janela` no `planejamento.ts` e um horário no limite é válido, 1 min fora é inválido.
- **Compatibilidade (integração/manual no SQL Editor de staging):** migração aplica em base com linhas antigas ⇒ colunas `NULL`; RPC com payload antigo insere `NULL`; CHECKs barram valores inválidos; `seed-aracatuba-demo.sql` roda sem erro.
- **RLS:** leitura pública (`is_demo`) e dono/admin seguem valendo para as novas colunas (sem política nova).

## 8. O que falta decidir (recomendação já embutida)
- **Default de `atendimento_origem`:** recomendo **sem default** (`NULL` = desconhecido) para não marcar linhas antigas como algo que o motorista não informou. (Alternativa: default `'desconhecido'` — também honesto; escolho `NULL` por simplicidade.)
- **Valor provisório de atendimento quando desconhecido:** recomendo **1 min** no motor, **sempre sinalizado** como estimativa (mantém o comportamento atual, agora explicitamente provisório). O valor definitivo de DEC-021 fica a seu critério.
