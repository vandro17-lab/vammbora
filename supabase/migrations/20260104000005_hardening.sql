-- ============================================================================
-- Vambora — Migração 0005: endurecimento de segurança (linter)
-- ----------------------------------------------------------------------------
-- Ajustes após rodar o Security Advisor do Supabase na aplicação inicial.
-- ============================================================================

-- Fixa o search_path do gatilho de updated_at (remove WARN do linter).
alter function public.set_updated_at() set search_path = public;

-- handle_new_user é só gatilho (roda no cadastro do Auth): não deve ser
-- chamável via API REST por anon/authenticated.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Observações sobre avisos que PERMANECEM e são INTENCIONAIS:
--  * `public_listings` é SECURITY DEFINER de propósito: é o que esconde o
--    telefone/documentos e mostra só motoristas publicados. Testado: como
--    anon, a view devolve os registros e a tabela `drivers` devolve 0 linhas.
--  * `solicitar_contato_whatsapp` e `registrar_interesse` são públicas de
--    propósito (a validação de consentimento está dentro delas).
--  * `is_admin`/`has_role` precisam ser executáveis pelos papéis para que as
--    políticas RLS que as usam funcionem.
