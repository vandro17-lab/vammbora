# Pendências, Riscos e Dívidas Técnicas — Vambora

Lista honesta do que **falta**, o que é **risco** e o que é **dívida técnica**. Atualizar sempre.

## 🔴 Bloqueios / dependem de arquivos ou decisões externas

| # | Item | Impacto | O que precisa |
|---|---|---|---|
| 1 | **Motor de encaixe real ausente** (`motor/`, `motor-van-bora.md`) | Compatibilidade é simulada | Receber os arquivos, ler a API real, rodar os testes, criar adaptador |
| 2 | **Documento mestre e PDF do Ideathon ausentes** | Risco de divergência de regras/cronograma | Adicionar ao repo; revisar `PLANO-MESTRE.md` |
| 3 | **Projeto Supabase não configurado** | Sem persistência real | Criar projeto, obter URL + chave publishable, aplicar migrações |
| 4 | **Requisitos legais de transporte escolar (Araçatuba)** | Não podemos afirmar conformidade | Pesquisa documental (municipal/estadual/federal); status "pendente de verificação" |

## 🟡 A fazer nas próximas etapas

- **Etapa 2 (Supabase):** migrações do núcleo, RLS, buckets (público p/ imagens, privado p/
  documentos), seed idempotente, integração real, CRUD/admin mínimo, auth por papel.
  Persistir `waitlist_requests` e `leads` (hoje o formulário de interesse só confirma localmente).
- **Etapa 3 (Motorista):** onboarding completo, cadastro de veículo/rotas visual, vagas por trecho,
  oportunidades agregadas (sem expor dados das famílias), simulador com o **motor real**.
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
