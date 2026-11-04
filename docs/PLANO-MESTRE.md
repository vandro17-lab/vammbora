# Plano Mestre — Vambora

> Este documento **organiza a execução**. Ele **não substitui** a visão de produto original
> `van-bora-completo.md` (1.729 linhas) nem resume as regras a ponto de perdê-las.
>
> ⚠️ **Registro de ausência (auditoria 03–04/11/2026):** no momento da Etapa 1, os seguintes
> documentos **não estavam presentes** no repositório nem foram anexados:
> `van-bora-completo.md`, `Ideathon - Fatec 2026.pdf`, `motor-van-bora.md`, `pesquisa-motores.md`
> e a pasta `motor/`. A única fonte recebida foi `CLAUDE-VAMBORA-INSTRUCOES-MESTRAS.md`.
> Por isso, **o motor de encaixe real não foi reimplementado** — ver seção "Motor".
> Assim que esses arquivos forem adicionados, este plano deve ser revisto.

## 1. Visão em uma frase

Conectar famílias e estudantes de Araçatuba a vans com **rota compatível**, horário e vaga,
com contato direto e transparente — preparando o terreno para pagamentos, verificação e
operação SaaS no futuro, sem prometer o que ainda não existe.

## 2. Prioridade de implementação

| Ordem | Bloco | Status |
|---|---|---|
| A | Marketplace da família | ✅ Etapa 1 entregue |
| B | Painel inicial do motorista | 🟡 prévia/estrutura entregue; completo na Etapa 3 |
| C | Administração básica | ⬜ Etapa 2 |
| D | Infraestrutura Supabase | ⬜ Etapa 2 (SQL preparado) |
| E | PWA instalável | ✅ Etapa 1 entregue |

**Fora de escopo agora** (documentar, não construir): GPS em segundo plano, cobrança financeira
real, compartilhamento de dados de crianças, clube de parceiros, AlugaVan, substituição
emergencial de vans.

## 3. Etapas

- **Etapa 0 — Auditoria** ✅ — inspeção do repositório (vazio), registro de ausências, escolha de
  stack e arquitetura. Ver `docs/DIARIO-DE-DESENVOLVIMENTO.md`.
- **Etapa 1 — Fundação e UI premium** ✅ — scaffold, design system, PWA, home, busca, resultados,
  perfil, WhatsApp, estados, animação da van, dados de exemplo, testes.
- **Etapa 2 — Supabase** ⬜ — migrações do núcleo, RLS, buckets, seed, integração real, CRUD/admin,
  autenticação por papel (busca pública continua sem login).
- **Etapa 3 — Motorista** ⬜ — onboarding, veículo, escolas, rota visual, vagas, oportunidades,
  simulador usando o **motor real** (quando disponível).
- **Etapa 4 — Validação** ⬜ — integração, testes, acessibilidade, segurança, responsividade,
  fluxo de demo, deploy, material de apresentação.

## 4. Motor de encaixe

O motor real do Van Bora (`motor/` + `motor-van-bora.md`) **não pode ser reimplementado às cegas**.
Nesta fase usamos um **adaptador simulado** (`src/lib/matching.ts`), isolado atrás de uma interface
estável. Quando o motor real chegar, trocamos apenas a implementação de `avaliarCompatibilidade`,
sem mexer nas telas.

Regras documentadas a respeitar quando o motor for integrado (lista em
`docs/PENDENCIAS.md`): chegada antes da aula com margem; janela contratada (ref. −3/+7); capacidade
por trecho; sequência de embarque/desembarque; pior caso de trânsito; limite de tempo a bordo
(60 min é **parâmetro pendente de validação legal**); horário original protegido; revalidação antes
de confirmar vaga; avulso usando folga; demanda incompatível não aparece; oportunidade que depende
de renegociação visível ao motorista.

## 5. Divergências conhecidas (preservar histórico, aplicar decisão mais recente)

1. **Marca:** `EncontraVan` (histórico) → **Vambora** (experiência pública) / **Van Bora** (acadêmico).
2. **Prioridade:** orientação ao motorista (set/2025) → **marketplace da família primeiro** (nov/2025).
3. **Selo de exemplo vs. regulamento:** o regulamento exige dados **explicitamente simulados**;
   cumprimos com identificação discreta e profissional ("Demonstração").
4. **Cronograma:** prevalece o PDF oficial do Ideathon; divergências do documento mestre devem ser
   destacadas ao usuário quando o PDF estiver disponível.

## 6. Princípio final

Confiabilidade acima do efeito visual. Um protótipo **honesto**, testado e compreensível vale mais
que telas ficticiamente funcionais.
