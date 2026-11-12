# Configurar a demonstração (Araçatuba) e o login com Google

Este guia conclui 3 coisas:

1. Colocar os **30 motoristas + rotas de Araçatuba** no banco, **já aprovados** (sem login/cadastro).
2. Ligar o site para **ler do banco** (Supabase) em vez dos dados locais.
3. Ativar o **login com Google** para o motorista.

> Observação importante: eu (assistente) consigo **ler** o banco automaticamente, mas
> as **escritas** (importar dados / alterar schema) exigem uma confirmação que, nesta
> sessão na nuvem, é cancelada automaticamente. Por isso o **Passo 1** você roda uma vez,
> com um clique. É só colar e executar — já está tudo pronto.

---

## O que já foi feito no código (nesta branch)

- **Regra de elegibilidade** mudada: motorista **de demonstração** (`is_demo`) aparece na
  vitrine só com *publicado + não suspenso* — **sem** precisar de login, cadastro ou
  aprovação de documentos. Motorista **real** continua no fluxo completo (cadastro,
  documentos aprovados, rota concluída).
- **Login com Google** implementado na tela do motorista (`/motorista/conta`). O Apple
  ficou **preparado no código** (`entrarComProvedor('apple')`), desligado, para ligar depois.
- **Front ligado ao Supabase** por variável de ambiente (`VITE_USE_SUPABASE=true`).
- Dados de demonstração ficam **escondidos do painel** de motoristas reais (filtro `is_demo`).

Arquivos SQL prontos no repositório:

- `supabase/aplicar-demo-aracatuba.sql` — **tudo em um** (schema + dados). Use este.
- `supabase/migrations/20260104000009_demo_sem_login.sql` — só o schema (para `supabase db push`).
- `supabase/seed-aracatuba-demo.sql` — só os dados.

---

## Passo 1 — Importar os dados no banco (1 clique)

1. Abra o **Supabase** → projeto **vambora** → menu **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/aplicar-demo-aracatuba.sql` deste repositório, **copie tudo**
   e **cole** no editor.
3. Clique em **Run**.

Pronto. Isso cria/atualiza (idempotente — pode rodar de novo sem duplicar):

- 1 cidade (Araçatuba), 41 destinos (escolas/faculdades)
- 30 motoristas (`is_demo`, já aprovados), 30 vínculos motorista↔escola
- 30 veículos, 112 rotas, 446 paradas, 697 passageiros (marcados como `is_demo`)

**Conferir:** rode no SQL Editor

```sql
select count(*) from public.public_listings;   -- deve mostrar os motoristas visíveis
```

---

## Passo 2 — Ativar o login com Google

O Google precisa de credenciais criadas por você (é gratuito). Passos:

### 2.1 Criar as credenciais no Google Cloud
1. Acesse <https://console.cloud.google.com/> → crie/selecione um projeto.
2. **APIs e serviços → Tela de consentimento OAuth**: configure (tipo *Externo*),
   preencha nome do app e e-mail de suporte, e publique.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** →
   tipo **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, adicione exatamente:

   ```
   https://rnulmjdsvvuirqijemzy.supabase.co/auth/v1/callback
   ```
5. Salve e copie o **Client ID** e o **Client Secret**.

### 2.2 Ligar o provedor no Supabase
1. Supabase → projeto **vambora** → **Authentication → Providers → Google**.
2. Ative, cole o **Client ID** e o **Client Secret**, salve.
3. Em **Authentication → URL Configuration**:
   - **Site URL**: a URL do seu site (ex.: `https://SEU-SITE.vercel.app`).
   - **Redirect URLs**: adicione `https://SEU-SITE.vercel.app/painel` e, para testar
     local, `http://localhost:5173/painel`.

Depois disso, o botão **"Entrar com o Google"** em `/motorista/conta` funciona de ponta a ponta.

### 2.3 Retorno das FAMÍLIAS (Etapa 3A)
A família entra só ao confirmar uma solicitação e volta para o formulário. O app pede o retorno
para `https://vammboraa.vercel.app/familia/solicitacoes/nova` (Google e link de confirmação do
e-mail) ou para `/familia/solicitacoes...`. Em **Authentication → URL Configuration → Redirect URLs**,
mantenha as entradas existentes (ex.: `/painel`) e **acrescente**:

- `https://vammboraa.vercel.app/familia/**`

Sem ela, o Supabase manda a pessoa para a **Site URL** (a tela inicial): a conta é criada, mas a
família não volta ao formulário (o rascunho continua guardado e reaparece em "Nova solicitação").
Se o modelo do e-mail de confirmação (**Authentication → Email Templates → Confirm signup**) foi
personalizado, ele precisa usar `{{ .ConfirmationURL }}`, que respeita o retorno pedido.
O Google não precisa de mudança: o endereço autorizado continua sendo
`https://rnulmjdsvvuirqijemzy.supabase.co/auth/v1/callback`.

---

## Passo 3 — Variáveis de ambiente na Vercel

No projeto da Vercel → **Settings → Environment Variables**, adicione (Production e Preview):

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://rnulmjdsvvuirqijemzy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(chave anon pública do projeto — veja `.env.example`)* |
| `VITE_USE_SUPABASE` | `true` |

Depois, faça **Redeploy**. A partir daí a vitrine lê do banco e mostra os motoristas da demo.

> Enquanto essas variáveis não estiverem na Vercel, o site continua no **modo demo local**
> (dados de exemplo), sem quebrar.

---

## Resumo do que cada parte resolve

- **"Precisa estar logado / fazer cadastro"** → resolvido: os motoristas da demo estão
  `is_demo` e a regra os deixa **pré-aprovados**, sem login/cadastro/documentos.
- **"Os demais vão para o cadastro"** → mantido: motoristas reais continuam no fluxo
  completo (cadastro, documentos, aprovação do admin, rota concluída).
- **"Login pelo Google"** → implementado; só falta ligar as credenciais (Passo 2).
