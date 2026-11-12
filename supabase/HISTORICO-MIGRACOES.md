# Histórico de migrações — repositório × produção

Levantado em 12/11/2026 no projeto Supabase `vambora` (`rnulmjdsvvuirqijemzy`), apenas com leitura do
catálogo e de `supabase_migrations.schema_migrations`.

> ⚠️ **Não rode `supabase db push` enquanto este histórico não for reconciliado.** As versões dos
> arquivos `20260104…` não existem no histórico de produção: a CLI as trataria como pendentes e
> tentaria reaplicá-las em produção.

## Situação

O histórico de produção registra **8** migrações, com versões e nomes diferentes dos arquivos. Várias
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
| `20261112220000_perfil_motorista_real.sql` | — | **preparada, NÃO aplicada** (Etapa 2C). Ao aplicar, renomear o arquivo para a versão registrada |

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
