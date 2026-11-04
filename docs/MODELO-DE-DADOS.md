# Modelo de Dados — Vambora

Este documento descreve as **entidades de domínio** já usadas no protótipo e o plano de evolução
até o banco real no **Supabase (PostgreSQL)**. Os tipos vivem em `src/types/index.ts`.

## Núcleo já implementado (em memória, Etapa 1)

| Entidade | Arquivo | Observações |
|---|---|---|
| `Cidade` | `data/cidades.ts` | Araçatuba/SP (piloto) |
| `Destino` | `data/destinos.ts` | escola / faculdade / curso; guarda `fonte` e `codigoInep` |
| `Motorista` | `data/motoristas.ts` | perfil, veículo, recursos, preço, janela, avaliação, `demo` |
| `CriteriosBusca` | tipo | o que a família informa na busca |
| `ResultadoCompatibilidade` | tipo | saída do adaptador do motor |
| `InteresseWaitlist` | tipo | lista de espera (ainda não persistida) |

### Campos de honestidade (importantes)

- `Destino.fonte` — origem do dado (ex.: `INEP`, `cadastro manual`, `demonstração`).
- `Destino.codigoInep` — só preenchido com código **real**; caso contrário `null`.
- `Motorista.documentacaoVerificada` — só `true` com verificação **real** registrada.
- `Motorista.demo` — marca registros de demonstração.

## Esquema no Supabase (Etapa 2 — Parte A: IMPLEMENTADO)

✅ O núcleo abaixo **já existe** em **migrações SQL versionadas** em `supabase/migrations/`
(com índices, FKs, constraints, RLS, storage e RPCs) e no seed `supabase/seed.sql`.
Falta apenas **aplicar** num projeto Supabase — ver [`GUIA-SUPABASE.md`](GUIA-SUPABASE.md).
Tabelas implementadas: `profiles`, `user_roles`, `cities`, `destinations`, `drivers`,
`driver_destinations`, `verification_reviews`, `leads`, `waitlist_requests`, `audit_events`,
mais a view pública `public_listings` e os buckets `public-media`/`driver-docs`.

Estrutura (resumo):

```
profiles (1:1 auth.users)
user_roles (familia | motorista | admin)
cities
neighborhoods
destinations (escolas INEP, faculdades, cursos)  ── destination_schedules
operators ── drivers ── vehicles ── vehicle_features
                               └─ vehicle_documents (bucket privado)
driver_documents (bucket privado)
verification_reviews (quem verificou, quando, o quê, validade)
routes ── route_destinations ── route_stops ── route_schedules ── route_segments
seat_availability
pricing_rules
public_listings (VIEW pública, sem telefone/endereço/doc sensível)
reviews
inquiries / leads (consentimento + retenção)
waitlist_requests (consentimento + retenção)
match_evaluations
audit_events
media_assets (imagens aprovadas em bucket público)
```

### Evolução futura (criar só quando necessário)

`students`/`passengers`, `guardianships`, `enrollments`, `trip_instances`, `boarding_events`,
`location_events`, `notifications`, `invoices`, `payments`, `maintenance_records`, `partners`,
`benefits`, `coupons`, `redemptions`, `support_cases`.

## Regras de segurança (resumo — detalhar na Etapa 2)

- **Dados públicos** só via VIEW/consulta específica (`public_listings`), **sem** telefone privado,
  documentos, endereço completo, rota detalhada ou dados de menores.
- **RLS por proprietário e papel**: motorista edita só o seu; admin via papel; família vê público.
- **Storage**: imagens aprovadas em bucket público; **documentos em bucket privado**.
- **Validação no servidor** para operações privilegiadas; constraints de unicidade/integridade.
- **Auditoria** da revisão documental; prevenção de abuso de avaliações e leads.
- **LGPD** e melhor interesse de crianças; **nunca** dados reais de menores na demonstração.

## Chave pública × secreta

- Chave **pública/publishable** (anon) pode ir ao frontend **somente com RLS correta**.
- `service_role` / secret **nunca** no frontend, Git ou logs.
- `.env.example` documenta as variáveis; o `.env` real fica fora do Git.
