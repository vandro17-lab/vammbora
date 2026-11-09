# Auditoria documental — Ideathon Fatec 2026

**Projeto:** VanBora · **Repositório:** `vandro17-lab/vammbora` · **Branch:** `docs/ideathon-entrega-final-2026`  
**Data da auditoria:** 2026-11-09. Esta pasta registra evidências encontradas no repositório e pendências que exigem confirmação humana. Não substitui os documentos técnicos existentes.

## Documentos

1. [Problema, escopo e equipe](01-problema-escopo-equipe.md)
2. [Fluxo e wireframes documentais](02-fluxo-wireframes.md)
3. [Arquitetura, dados e recursos](03-arquitetura-dados-recursos.md)
4. [Backlog, limitações e próximos passos](04-backlog-limitacoes.md)
5. [Originalidade e declaração de IA](05-originalidade-ia.md)
6. [Checklist de entrega e evidências](06-checklist-final.md)

## Síntese honesta

O VanBora é um protótipo acadêmico de busca de transporte escolar e organização de rotas. Há funcionalidades implementadas no código, mas a busca de famílias usa motoristas, preços, vagas, avaliações e outros detalhes explicitamente demonstrativos; o painel operacional possui caminhos com persistência local/Supabase conforme a configuração. Destinos e serviços de mapas têm fontes declaradas no código, mas isso não equivale a uma auditoria externa de cada registro nem validação de serviço em produção.

A pesquisa de entrevistas, preços, concorrentes, mobilidade/sustentabilidade, LGPD e testes com usuários consta como “a iniciar” em `docs/pesquisas/`; não foi convertida em resultado. O histórico Git consultado identifica autores `vandro17-lab` (contas/e-mails associados ao mesmo nome) e `Claude`/`Claude Code`; não comprova três integrantes humanos distintos. Deck, vídeo, presença em checkpoints, originalidade institucional e contribuições individuais requerem confirmação/evidências da equipe.

## Método e limites

Foram examinados README, documentação existente em `docs/`, `package.json`, rotas React, camada de dados, fixtures demonstrativas, chamadas de mapas e histórico de commits disponíveis na branch. A descrição do regulamento foi tomada do checklist transcrito em `docs/INSTRUCOES-MANUS-IDEATHON-2026.md`. Não foram alterados arquivos de código/configuração nem feitas migrações, testes destrutivos ou mudanças no banco. A auditoria documental não certifica funcionamento em produção, conformidade legal, acessibilidade, origem de todos os ativos, nem identidade real dos autores.
