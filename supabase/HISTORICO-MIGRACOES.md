# Histórico de migrações — repositório × produção

Levantado em 12/11/2026 no projeto Supabase `vambora` (`rnulmjdsvvuirqijemzy`), apenas com leitura do
catálogo e de `supabase_migrations.schema_migrations`.

> ⚠️ **Não rode `supabase db push` enquanto este histórico não for reconciliado.** As versões dos
> arquivos `20260104…` não existem no histórico de produção: a CLI as trataria como pendentes e
> tentaria reaplicá-las em produção.

## Situação

O histórico de produção registra **9** migrações, com versões e nomes diferentes dos arquivos. Várias
migrações do repositório foram aplicadas **manualmente** (SQL Editor), sem registro, e uma nunca foi
aplicada.

| Arquivo no repositório | Registro em produção | Situação em produção |
|---|---|---|
| `20260104000001_core.sql` | `20261104011528` `core_schema` | aplicada e registrada |
| `20260104000002_rls.sql` | `20261104011600` `rls_policies` | aplicada e registrada |
| `20260104000003_storage.sql` | `20261104011614` `storage_buckets` | aplicada e registrada |
| `20260104000004_rpc.sql` | `20261104011628` `rpc_functions` | aplicada e registrada |
| `20260104000005_hardening.sql` | `20261104011856` `security_hardening` | aplicada e registrada |
| `20260104000006_proteger_campos_driver.sql` | `20261104094619` `proteger_campos_driver` | aplicada e registrada |
| `20260104000007_cadastro_motorista.sql` | — | objetos presentes, **sem registro** |
| `20260104000008_hardening_rotas.sql` | — | **sem registro** (só GRANT/REVOKE; não verificável por objeto) |
| `20260104000009_confirmar_encaixe_rota.sql` | — | **NÃO aplicada** (a função `confirmar_encaixe_rota` não existe) |
| `20260104000009_demo_sem_login.sql` | — | objetos presentes, **sem registro** |
| `20260104000010_compromisso_aluno.sql` | — | objetos presentes, **sem registro** |
| `20260104000011_app_assets.sql` | — | objetos presentes, **sem registro** |
| `20260104000012_app_ui_config.sql` | — | objetos presentes, **sem registro** |
| `20260104000013_busca_demo_colunas_indices.sql` | `20261107121233` `busca_demo_colunas_indices` | aplicada e registrada |
| `20260104000014_viagens.sql` | — | objetos presentes, **sem registro** |
| `20260104000015_busca_encaixe_etapa1.sql` | — | objetos presentes, **sem registro** |
| `20260104000016_abertura_escola.sql` | — | objetos presentes, **sem registro** |
| `20260104000017_interesse_com_contexto.sql` | — | objetos presentes, **sem registro** |
| `20261112194000_bloquear_escrita_public_listings.sql` | `20261112194000` `bloquear_escrita_public_listings` | aplicada e registrada — **mesma versão e mesmo conteúdo** (MD5 `64347e08312cd74269da04dba734dd57`) |
| `20261112205224_perfil_motorista_real.sql` | `20261112205224` `perfil_motorista_real` | aplicada e registrada em 12/11/2026 — **mesma versão e mesmo conteúdo** (MD5 `4e86823526289f0af9b713d8dc5ce476`). O cabeçalho do arquivo ainda diz "NÃO APLICADA" porque o conteúdo foi mantido idêntico ao registrado |
| `20261112224855_municipios_ibge.sql` | `20261112224855` `municipios_ibge` | aplicada e registrada em 12/11/2026 — **mesma versão e mesmo conteúdo** (MD5 `c1499fd505e9afac5ff7057a35a107eb`; 645 municípios de SP, MD5 dos dados `2bb9b4e259c68ee43667dff5f4e614be`). O cabeçalho ainda diz "NÃO APLICADA" e cita a versão provisória `20261112230000`, porque o conteúdo foi mantido idêntico ao registrado |
| `20261112224903_solicitacoes_familias.sql` | `20261112224903` `solicitacoes_familias` | aplicada e registrada em 12/11/2026 — **mesma versão e mesmo conteúdo** (MD5 `97b7b26aec00753efb2905dd9df956fb`). O cabeçalho ainda diz "NÃO APLICADA" e cita a versão provisória `20261112225900`, pelo mesmo motivo |

Observações:
- Há **dois arquivos com o número `000009`**.
- O número `20260104000018` está reservado pela branch não mergeada de pré-lançamento
  (`20260104000018_prelaunch_leads.sql`); a tabela `prelaunch_leads` não existe em produção.

## Regra a partir de agora

1. Toda migração nova é aplicada em produção pela ferramenta de migração do Supabase
   (`apply_migration`), que registra versão, nome e conteúdo.
2. O arquivo correspondente entra no repositório com **exatamente a versão registrada**
   (`<versão>_<nome>.sql`) e o mesmo conteúdo.
3. A reconciliação das linhas antigas (`supabase migration repair`) é uma tarefa separada e exige
   aprovação própria. Até lá, nada de `supabase db push`.

## Correção de 12/11/2026 — vitrine pública somente leitura

`20261112194000_bloquear_escrita_public_listings.sql` retira INSERT/UPDATE/DELETE/TRUNCATE de
`anon`, `authenticated` e PUBLIC na view `public.public_listings`, mantendo o SELECT.

- **ACL antes:** `{postgres=arwdDxtm,anon=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm}`
- **ACL depois:** `{postgres=arwdDxtm,anon=rxtm,authenticated=rxtm,service_role=arwdDxtm}`
- **Teste:** `supabase/tests/public_listings_somente_leitura.sql`. É somente leitura e seguro em
  produção: roda em `BEGIN READ ONLY` e testa a escrita com `EXPLAIN`.
- **Prova local:** `supabase/tests/rodar-public-listings-local.sh`.

**Cuidados para migrações futuras:**
- **Não usar `DROP` + `CREATE`** na view `public_listings`: os privilégios padrão do schema `public`
  devolvem a escrita a `anon`/`authenticated`. `CREATE OR REPLACE VIEW` mantém o bloqueio. Se recriar,
  repita o `REVOKE`.
- **Não revogar `EXECUTE` de `motorista_elegivel` para `anon`/`authenticated` sem redesenhar a view.**
  A view chama essa função, e numa view o `EXECUTE` de função é conferido com o papel de quem
  consulta. Sem ele, a vitrine pública para de funcionar.

## Etapa 3A — solicitações das famílias (aplicadas em 12/11/2026)

Duas migrações, aplicadas **nesta ordem** pela ferramenta de migração e registradas com as versões
abaixo (os arquivos foram renomeados para elas, sem mudar o conteúdo). Conferido depois da aplicação:
RLS ligada, `anon` sem acesso às solicitações, sem `DELETE`, nenhuma view sobre a tabela, vitrine
somente leitura e motoristas, rotas e escolas idênticos aos de antes.

1. `20261112224855_municipios_ibge.sql` cria `public.municipios`: os municípios do IBGE dos estados
   com área atendida — hoje os 645 de SP — (código, nome, UF, sede), leitura pública e sem escrita
   pela API. Ao abrir cobertura em outro estado, uma nova migração acrescenta os municípios dele. Fonte:
   github.com/kelvins/municipios-brasileiros (MIT). O app usa a mesma fonte em
   `src/data/municipios-cobertura.ts` (municípios com sede na área atendida).
2. `20261112224903_solicitacoes_familias.sql` cria `public.transport_requests` (abaixo).

- **Acesso:** RLS ligada; `anon` sem nenhum privilégio; `authenticated` só `SELECT`, `INSERT` e
  `UPDATE` das **próprias** linhas (`owner_id = auth.uid()`); sem `DELETE`/`TRUNCATE`. Nenhuma view
  ou RPC expõe a tabela.
- **Gatilho `proteger_solicitacao`:** criação sempre `ativa`; até 10 abertas por conta (o reenvio
  do mesmo pedido não conta); `encerrada` é definitiva; `owner_id`, `chave_envio` e `created_at` não
  mudam; o ponto confirmado precisa estar na área da cidade da solicitação.
- **Cobertura × município:** `city_id` é a ÁREA DE COBERTURA (`cities` ganha `area_*`, preenchida
  para `aracatuba-sp`); `origem_municipio_ibge` é o MUNICÍPIO real do embarque, identificado pelo
  serviço de mapas no ponto confirmado (`origem_municipio_fonte = 'mapa'`) ou confirmado pela família
  quando o mapa não identifica ou diverge (`'familia'`). O banco confere que o município existe e
  que a sede fica a até 60 km do ponto; o limite exato exige a malha do IBGE (não carregada).
  A escola pode ficar em outro município.
- **Escola:** só escola publicada e não demonstrativa (`is_published and not is_demo`).
- **Alunos:** `quantidade_alunos` de 1 a 8 (provisório): alunos com o mesmo embarque, a mesma escola
  e horários compatíveis; caso contrário, uma solicitação por aluno. **O Radar da Etapa 3B deve
  considerar o total de vagas pedido (`quantidade_alunos`), não uma vaga por solicitação.** O motor
  de encaixe não foi alterado.
- **Cliques repetidos:** `unique (owner_id, chave_envio)`; o app usa `upsert ... ignoreDuplicates`.
- **Radar (Etapa 3B):** colunas geradas `origem_lat_aprox`/`origem_lng_aprox` (grade de ~500 m) e
  índice das solicitações ativas por escola e sentido. O endereço exato nunca deve sair da tabela.
- **Prova local:** `supabase/tests/rodar-solicitacoes-local.sh` (aplica a migração duas vezes, roda
  `supabase/tests/solicitacoes.sql` e confere que motoristas, vans, rotas e a vitrine ficam intactos).
