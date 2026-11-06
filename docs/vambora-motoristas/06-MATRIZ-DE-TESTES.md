# 06 — Matriz de Testes de Regressão

Status atual verificado em `main`/PR #14. "Não verificado" = depende de auth,
Supabase real ou provider habilitado que não está disponível no ambiente de
planejamento. Nunca marcar como aprovado o que não foi executado.

| # | Fluxo | Como testar | Fase que valida | Status hoje |
|---|-------|-------------|-----------------|-------------|
| 1 | Cadastro de motorista | `/motorista/conta` criar conta; checar `profiles`/sessão | 4 | Não verificado (auth) |
| 2 | Login Google | `entrarComProvedor('google')`; callback | 4 | Não verificado (provider) |
| 3 | Sessão autenticada | recarregar; `AuthProvider` mantém sessão | 4 | Não verificado |
| 4 | Cadastro de van | `/painel/veiculos` salvar → `vehicles` | 5 | Não verificado (Supabase) |
| 5 | Edição de van | editar e reler `vehicles` | 5 | Não verificado |
| 6 | Persistência de características | AC/acessível/cintos/lugares/fotos persistem | 5 | Não verificado |
| 7 | **Exibição no marketplace** | editar van/perfil → `public_listings` reflete | 5 | **FALHA conhecida (GAP-1)** |
| 8 | Filtros do marketplace | `buscarMotoristas` por cidade/destino/turno/vagas | 5/8 | Parcial: recursos **não** filtram (GAP-2) |
| 9 | Cadastro de rota | `/painel/rota/new` salvar via RPC | 7 | Não verificado (Supabase + 0010) |
| 10 | Edição de rota | reabrir e salvar; **conferir ids preservados** | 7 | **Risco (RPC apaga-e-recria)** |
| 11 | Paradas | ordem/tipo/coords persistem | 7 | Não verificado |
| 12 | Escolas | parada escola + `destination_id` | 7 | Não verificado |
| 13 | Passageiros | embarque/desembarque + compromissos | 7/11 | Depende de 0010 |
| 14 | Capacidade | `ocupacao-rota.ts` + reservados/monitor | 7 | Verificável por testes unitários |
| 15 | Ida e volta | sentido e limites | 7 | Testado nos motores |
| 16 | Horários | planejamento/último desembarque/antecipação | 7 | Testado nos motores |
| 17 | Matriz viária | `api/mapas.ts` op `matriz` (login) | 7/8 | Não verificado (chave) |
| 18 | Motor de encaixe | `encontrarEncaixes`/progressivo vs referência | 8 | Testado (vitest) |
| 19 | Simulação sem gravação | simular não escreve no banco | 8 | Verificável |
| 20 | Real × demonstrativo | nenhum cálculo demo apresentado como real | 9/13 | A garantir (`07`) |
| 21 | Navegação do app | todos os módulos acessíveis, sem duplicar | 2/12 | A implementar |
| 22 | Redirecionamentos antigos | `/painel/*`, `/pro` continuam válidos | 2 | A garantir |
| 23 | Responsividade | mobile 390px, sem scroll horizontal | 12 | A garantir |
| 24 | Build | `npm run build` exit 0 | todas | ✅ (209 testes/ build na linha PR #14) |
| 25 | Testes automatizados | `vitest run`, `tsc --noEmit` | todas | ✅ atualmente verdes |

## Comandos padrão por fase
```
npx vitest run         # testes
npx tsc --noEmit       # typecheck/lint
npm run build          # build de produção (tsc -b + vite)
```
Fluxos de auth/banco/mapa (itens 1–13, 17) exigem `VITE_USE_SUPABASE=true`,
`VITE_SUPABASE_URL/ANON_KEY`, provider OAuth habilitado e `GEOAPIFY_API_KEY` —
quando ausentes, registrar como **não verificado**, não como aprovado.
