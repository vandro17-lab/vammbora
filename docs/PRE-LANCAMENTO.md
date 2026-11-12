# Pré-lançamento — captação de interessados

Camada **pública** que substitui a página inicial enquanto o aplicativo não é
lançado. Capta manifestações de interesse de **motoristas** e **famílias**. O
aplicativo existente (busca, painel do motorista, rotas, admin) continua no
código e nas mesmas rotas — nada foi removido.

## Rotas

| Rota | O que é |
| --- | --- |
| `/` | Página inicial: dois caminhos (motorista / família) |
| `/interesse/motorista` | Formulário do motorista |
| `/interesse/familia` | Formulário da família |
| `/privacidade` | Política de Privacidade (sem login) |
| `/admin` | Painel existente + seção **Interessados no lançamento** (só admin) |

A confirmação ("Prontinho! Seu interesse foi registrado.") não tem URL própria:
ela só aparece na mesma tela depois que o servidor confirma a gravação.

## Fluxo de gravação

```
navegador ──POST /api/interesse──▶ função serverless (Vercel)
   valida                              valida de novo (mesmas regras)
                                       hash do IP (HMAC com segredo do servidor)
                                       └─ service_role ─▶ registrar_interesse_lancamento()
                                                            limite de envios (no banco)
                                                            valida de novo + CHECKs
                                                            INSERT em prelaunch_leads
   ◀── 201 { ok: true } ── só depois de o banco confirmar
```

- Regras de máscara, normalização e validação: `src/lib/interesse.ts` (uma só
  fonte para navegador e servidor).
- Núcleo do endpoint (testável sem rede): `src/lib/interesse-servidor.ts`;
  adaptador da Vercel: `api/interesse.ts`.
- Banco: `supabase/migrations/20260104000018_prelaunch_leads.sql`.

### Segurança

- `prelaunch_leads` tem RLS ligada e **nenhuma** política para visitante: sem
  leitura, listagem, escrita, alteração ou exclusão públicas.
- A gravação só acontece pela função `registrar_interesse_lancamento`, executável
  **apenas** por `service_role` (a chave fica só no servidor da Vercel).
- Admin (`public.is_admin()`): lista, altera **apenas** a coluna `status` e
  exclui (pedido do titular). Não edita os dados do titular.
- Limite de envios dentro do banco: 5 por visitante em 10 min, 20 em 24 h e
  300/h no total. O visitante é identificado por um hash do IP (sem IP em
  claro), apagado em 24 h. O endpoint ainda tem um limite rápido em memória.
- Campo-isca invisível contra robôs; corpo limitado a 8 KB; só `POST` JSON;
  sem cabeçalhos CORS e recusa de `Origin` de outro site.
- **Não há CAPTCHA.** Se houver abuso, o próximo passo é adicionar um desafio
  (ex.: Cloudflare Turnstile) — exige criar chaves.

### Duplicidade

- Chave única: `(lead_type, whatsapp_e164)`. O mesmo WhatsApp pode se inscrever
  como motorista **e** como família.
- Reenvio no mesmo perfil: o cadastro original **não é alterado**; o último
  reenvio fica em `last_resubmission` / `resubmitted_at` para a equipe conferir
  (selo "reenviado" no admin). A resposta ao visitante é a mesma confirmação —
  não revela que o número já existia.

## Variáveis de ambiente (Vercel)

| Variável | Onde | Obrigatória | Observação |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | **sim** | Segredo. Sem ela `/api/interesse` responde 503 e o formulário mostra erro (nunca sucesso falso). É a mesma já usada por `/api/buscar-rotas`. |
| `VITE_SUPABASE_URL` | build/servidor | não | Há padrão no código. |
| `LEADS_IP_SALT` | servidor | não | Segredo para o hash do IP; sem ela usa a service role. |

Nenhuma chave secreta vai para o navegador.

## Publicação (ordem)

1. Revisar e aprovar a migração `20260104000018_prelaunch_leads.sql`.
2. Aplicar a migração no Supabase (projeto `vambora`).
3. Conferir que `SUPABASE_SERVICE_ROLE_KEY` existe na Vercel (Production e Preview).
4. Preencher `src/lib/controlador-privacidade.ts` (responsável e canal de
   privacidade) — a política mostra um aviso de pendência enquanto estiver vazio.
5. Fazer o merge/deploy e enviar **um** cadastro real de conferência (o seu),
   verificando-o em `/admin` › Interessados no lançamento.

## Testes

```bash
npm run lint && npm test && npm run build      # tipos, 741+ testes, build
supabase/tests/rodar-prelancamento-local.sh    # migração + RLS + função (PostgreSQL local descartável)

# ponta a ponta no navegador (celular), gravando no PostgreSQL local:
MANTER=1 supabase/tests/rodar-prelancamento-local.sh   # imprime PGHOST/PGPORT
PGHOST=... PGPORT=... npx vite-node scripts/e2e-prelancamento.ts
```

Os testes de banco e de ponta a ponta usam contatos fictícios e **nunca** devem
ser apontados para o Supabase de produção.
