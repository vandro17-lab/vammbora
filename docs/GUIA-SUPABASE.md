# Guia do Supabase — passo a passo para iniciante

Este guia liga o VanBora a um banco de dados real e seguro (Supabase), **de graça**.
A vitrine da demonstração **continua funcionando sem isso** — este passo é para ter
**persistência de verdade** (salvar leads/lista de interesse, cadastros, admin).

> 🔒 **Regra de ouro:** você vai usar só a **chave pública (anon)**. **Nunca** cole no chat,
> no código ou no front-end a chave **`service_role`** nem a **senha do banco**. A segurança
> real vem das políticas RLS que já estão prontas nas migrações.

---

## Parte 1 — Criar o projeto (uma vez)

1. Acesse **`https://supabase.com`** → **"Start your project"** → entre com o GitHub.
2. **"New project"**.
   - **Name:** `vambora`
   - **Database Password:** clique em **"Generate a password"** e **guarde num lugar seguro**
     (gerenciador de senhas). Você quase não vai usá-la. **Não precisa colar aqui.**
   - **Region:** escolha **South America (São Paulo)**.
   - Clique em **"Create new project"** e espere ~2 minutos (fica "Setting up").
   - ✅ *Deu certo:* abre o painel do projeto.

## Parte 2 — Criar as tabelas e a segurança (rodar o SQL)

No menu lateral, abra **"SQL Editor"** → **"New query"**. Vamos rodar **5 arquivos, na ordem**.
Para cada um: abra o arquivo no repositório, **copie todo o conteúdo**, cole no editor e clique
em **"Run"** (ou `Ctrl/Cmd + Enter`). Deve aparecer **"Success. No rows returned"**.

Ordem (está tudo na pasta `supabase/`):
1. `supabase/migrations/20260104000001_core.sql`  → tabelas
2. `supabase/migrations/20260104000002_rls.sql`   → segurança (RLS) + vitrine pública
3. `supabase/migrations/20260104000003_storage.sql` → espaços de arquivos (fotos/documentos)
4. `supabase/migrations/20260104000004_rpc.sql`   → funções seguras (lead/interesse)
5. `supabase/seed.sql`                              → dados de demonstração

- ✅ *Conferir:* abra **"Table Editor"**. Devem existir as tabelas `drivers`, `destinations`,
  `cities`, `leads`, `waitlist_requests` etc. A tabela `drivers` deve ter 6 linhas de demonstração.

> ℹ️ O "Security Advisor" do Supabase pode avisar que a view `public_listings` é "SECURITY DEFINER".
> Isso é **intencional e seguro aqui**: é justamente o que esconde o telefone e mostra só os dados
> públicos. Pode ignorar esse aviso específico.

## Parte 3 — Pegar a URL e a chave pública

1. Menu lateral → **"Project Settings"** (engrenagem) → **"API"**.
2. Copie dois valores:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **Project API keys → `anon` `public`** (uma chave longa). Essa é a **pública**, pode usar
     no front-end.
3. **NÃO** use a chave **`service_role`** em lugar nenhum do site.

## Parte 4 — Ligar no site

### a) No seu computador (opcional, para testar local)
1. Na pasta do projeto, copie o arquivo `.env.example` para um novo arquivo chamado **`.env`**.
2. Preencha:
   ```
   VITE_SUPABASE_URL=cole-aqui-a-project-url
   VITE_SUPABASE_ANON_KEY=cole-aqui-a-chave-anon-public
   VITE_USE_SUPABASE=true
   ```
3. Rode `npm run dev`. O site agora fala com o Supabase.

### b) No Vercel (para o site publicado)
1. No painel do Vercel, abra o projeto **vammbora** → **"Settings"** → **"Environment Variables"**.
2. Adicione **três** variáveis (uma por vez), marcando os ambientes **Production** e **Preview**:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | a Project URL |
   | `VITE_SUPABASE_ANON_KEY` | a chave `anon public` |
   | `VITE_USE_SUPABASE` | `true` |
3. Vá em **"Deployments"** → no último deploy, menu **⋯** → **"Redeploy"**.
   - ✅ *Deu certo:* o site recarrega lendo do Supabase.

## Parte 5 — Testar se está gravando de verdade

1. No site, faça uma busca que **não ache van** (ex.: um destino sem motorista) para abrir a
   **lista de interesse**.
2. Preencha nome e WhatsApp, marque o consentimento e envie.
3. No Supabase → **Table Editor** → tabela **`waitlist_requests`**: deve aparecer **uma linha nova**.
   - ✅ Se apareceu, a integração real está funcionando!

---

## Perguntas comuns

- **Preciso disso para a apresentação do Ideathon?** Não. A demo roda sem Supabase. Isto é um
  diferencial de maturidade (mostra que o produto tem banco real e seguro).
- **A chave `anon` vazar é problema?** Ela é **pública por design**. O que protege os dados são as
  políticas RLS. O que **nunca** pode vazar é a `service_role` e a senha do banco.
- **Posso me tornar admin?** Sim: depois de criar seu login no app (Etapa 3), rode no SQL Editor
  `insert into user_roles (user_id, role) values ('SEU_UUID', 'admin');` (seu UUID aparece em
  Authentication → Users). Eu te ajudo quando chegarmos lá.
