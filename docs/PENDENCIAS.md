# Pendências, Riscos e Dívidas Técnicas — Vambora

Lista honesta do que **falta**, o que é **risco** e o que é **dívida técnica**. Atualizar sempre.

## 🧭 Estado por categoria (revisão 04/11/2026)

**Implementado e testado (build + vitest + Playwright nesta sessão):**
- Vitrine lê do Supabase com estados reais (carregando/pronto/erro + "tentar de novo"); sem
  fallback escondido quando o Supabase está ativo.
- Jornada da busca preserva critérios (escola, turno, mensal/avulso, data, ida/volta) até o perfil
  e na volta; mensagem de WhatsApp com critérios e **sem** enviar o endereço livre.
- Lista de interesse distingue gravação real × simulação; não promete aviso automático.
- Admin verifica cada gravação (sucesso/erro) e tem retry no carregamento.
- Linguagem honesta (horário "informado pelo motorista"; sem afirmar cálculo de rota/passagem).
- 20 testes unitários (lógica + WhatsApp + parâmetros de busca).

**Implementado, pendente de validação de ponta a ponta no navegador real:**
- Leitura/gravação via Supabase (o sandbox bloqueia `supabase.co`; validar no Vercel).
- Migração 0006 (gatilho de proteção de campos do motorista) foi **APLICADA** no projeto, mas o
  **teste automatizado de acessos não foi executado** (autorização do conector não respondida).
  Script pronto em `supabase/tests/permissoes_driver.sql`.

**Depende de configuração do usuário:**
- Variáveis no Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_SUPABASE`).

**Ainda é demonstração (sem Supabase configurado):**
- Dados de exemplo locais (motoristas/escolas fictícios) e lista de interesse apenas simulada.

## 🔴 Bloqueios / dependem de arquivos ou decisões externas

| # | Item | Impacto | O que precisa |
|---|---|---|---|
| 1 | **Motor de encaixe real** — especificado em `docs/ESPEC-MOTOR-DE-ENCAIXE.md`, implementação isolada em andamento (externa). Compatibilidade atual é SIMULADA (`src/lib/matching.ts`) | Busca usa filtro simples (cidade/destino/turno/vaga), não o encaixe real | Receber `src/engine/*` prontos, rodar testes, criar adaptador e ligar na busca |
| 2 | **Documento mestre e PDF do Ideathon ausentes** | Risco de divergência de regras/cronograma | Adicionar ao repo; revisar `PLANO-MESTRE.md` |
| 3 | ~~Projeto Supabase não criado~~ ✅ CRIADO, APLICADO e vitrine integrada (ref `rnulmjdsvvuirqijemzy`) | Banco real no ar; vitrine lê do banco | Falta: variáveis no Vercel para o site publicado ler do banco |
| 4 | **Requisitos legais de transporte escolar (Araçatuba)** | Não podemos afirmar conformidade | Pesquisa documental (municipal/estadual/federal); status "pendente de verificação" |

## 🟡 A fazer nas próximas etapas

- **Etapa 2 — Parte A/B (FEITAS):** núcleo, RLS, buckets, RPCs, seed aplicados; vitrine lê do banco;
  admin (login + papel) com CRUD inicial (publicar/ocultar, editar vagas). Falta variáveis no Vercel.
- **Admin — ampliar CRUD:** editar nome/preço/descrição do motorista, destinos, fotos (bucket),
  revisão documental com registro (quem/quando/validade), e rotas (ver tabelas de rota pendentes).
- **Tabelas de rota (`routes`/`route_stops`):** NÃO criadas (a migração chegou a ser escrita mas a
  aplicação ficou pendente de autorização). Necessárias para o editor de rotas e para alimentar o
  motor/simulador. Alinhar com `docs/ESPEC-MOTOR-DE-ENCAIXE.md`.
- **Rate-limit das RPCs públicas:** `solicitar_contato_whatsapp`/`registrar_interesse` precisam de
  limite por IP/app na borda (ex.: Edge Function ou proteção do Supabase) para evitar abuso.
- **Etapa 3 (Motorista):** onboarding completo, cadastro de veículo/rotas visual, vagas por trecho,
  oportunidades agregadas (sem expor dados das famílias), simulador com o **motor real** (quando entregue).
- **Importação INEP:** escolas reais com `fonte`, `data` e `codigoInep` verdadeiros.
- **Mapas/geocodificação:** Leaflet + OpenStreetMap, respeitando licença/atribuição/limites;
  confirmação manual de pino enquanto não houver serviço confiável.

## 🟢 Dívidas técnicas conhecidas (não urgentes)

- `npm audit` relata vulnerabilidades em **dependências de desenvolvimento** (cadeia do Vite).
  Não afetam o site publicado. Revisar com `npm audit` antes do deploy final; não rodar
  `npm audit fix --force` sem testar (pode quebrar versões).
- Sem testes de componente/E2E ainda (só lógica). Avaliar Testing Library/Playwright na Etapa 4.
- Catálogo de escolas/faculdades pequeno (demo). Ampliar com dados reais.
- Sem CI configurada ainda (lint/test automáticos em cada PR). Avaliar GitHub Actions.

## ⚠️ Parâmetros a validar (não tratar como lei confirmada)

- **Limite de 60 min a bordo**: parâmetro **pendente de validação legal**, não lei confirmada.
- Janela contratada (ref. −3/+7) e margens de chegada: confirmar com o motor real e a legislação.

## 🔒 Lembretes de segurança/privacidade

- Nunca commitar `.env`, chaves `service_role`/secret, ou dados pessoais reais.
- Nunca publicar endereço completo de aluno.
- Selo "documentação verificada" só com evidência real registrada.
