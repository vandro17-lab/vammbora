# Supabase — banco de dados do Vambora

Migrações SQL versionadas, políticas de segurança (RLS), storage e seed de demonstração.

> 👉 Para configurar passo a passo (inclusive para iniciantes), veja
> [`../docs/GUIA-SUPABASE.md`](../docs/GUIA-SUPABASE.md).

## Conteúdo

```
supabase/
├── migrations/
│   ├── 20260104000001_core.sql     # extensões, enums, tabelas, índices, triggers, funções de papel
│   ├── 20260104000002_rls.sql      # RLS + view pública (public_listings) sem dados sensíveis
│   ├── 20260104000003_storage.sql  # buckets public-media (público) e driver-docs (privado) + políticas
│   └── 20260104000004_rpc.sql      # RPCs públicas seguras: lead (WhatsApp) e lista de interesse
└── seed.sql                        # dados de demonstração idempotentes (is_demo = true)
```

## Como aplicar

**Opção A — Painel (recomendado p/ iniciante):** cole o conteúdo de cada arquivo no
**SQL Editor** do Supabase, na ordem acima, e rode. Depois rode `seed.sql`.

**Opção B — Supabase CLI:**
```bash
supabase link --project-ref <ref-do-projeto>
supabase db push          # aplica as migrações
# seed:
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Princípios de segurança

- **Vitrine pública** lê pela view `public_listings` — **sem telefone, sem documentos, sem endereço**.
- **Telefone** do motorista só é devolvido pela RPC `solicitar_contato_whatsapp`, que **registra o lead**.
- **RLS** em todas as tabelas: dono gerencia o seu; admin gerencia tudo; público só lê o permitido.
- **Documentos** vão para bucket **privado** (`driver-docs`); imagens aprovadas no bucket público.
- `service_role` / senha do banco **nunca** no front-end, no Git ou em logs.

## Status

As migrações estão **escritas, versionadas e consistentes**, mas ainda **não foram aplicadas** a um
projeto (depende de você criar o projeto Supabase — ver o guia). A validação de ponta a ponta
acontece após a aplicação.
