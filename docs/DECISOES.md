# Registro de Decisões (ADR) — Vambora

Cada decisão relevante fica aqui, com data e justificativa. Conflitos ficam explícitos.

---

### ADR-001 — Stack: React + TypeScript + Vite + Tailwind
**Data:** 03/11/2026 · **Status:** aceita
**Contexto:** precisamos de UI premium, responsiva, acessível, instalável e de rápida evolução.
**Decisão:** React 18 + TypeScript + Vite; Tailwind para o design system; Framer Motion para
animação; Lucide para ícones; React Router para navegação; Vitest para testes.
**Justificativa:** ecossistema maduro, tipagem segura, build rápido, tudo com licença MIT.
**Consequências:** curva de aprendizado baixa para a equipe; bundle enxuto.

### ADR-002 — PWA com vite-plugin-pwa (Workbox)
**Data:** 03/11/2026 · **Status:** aceita
**Decisão:** service worker versionado via Workbox; pré-cache só do app-shell; atualização
oferecida ao usuário.
**Justificativa:** instalação onde o navegador permitir, sem cachear dados sensíveis.
**Consequências:** funciona offline o básico; dados privados sempre via rede.

### ADR-003 — Não reimplementar o motor de encaixe
**Data:** 04/11/2026 · **Status:** aceita (restrição do projeto)
**Contexto:** `motor/` e `motor-van-bora.md` ausentes na auditoria.
**Decisão:** usar um **adaptador simulado** isolado (`src/lib/matching.ts`), marcado como simulação.
**Justificativa:** a regra proíbe reimplementar o motor sem ler o código real.
**Consequências:** compatibilidade da demo é simplificada e honesta; troca sem mexer na UI.

### ADR-004 — Marca Vambora (pública) / Van Bora (acadêmico)
**Data:** 04/11/2026 · **Status:** aceita
**Decisão:** usar "Vambora" na experiência pública; "Van Bora" no contexto acadêmico. `EncontraVan`
é histórico e não gera marca paralela.
**Justificativa:** decisão mais recente (nov/2025) prevalece sobre a de set/2025.

### ADR-005 — Dados de exemplo identificados como "Demonstração"
**Data:** 04/11/2026 · **Status:** aceita
**Contexto:** tensão entre "sem selo de exemplo nas telas" (doc mestre) e o regulamento do Ideathon
(dados explicitamente simulados).
**Decisão:** cumprir o regulamento com identificação **discreta e profissional** ("Demonstração").
**Justificativa:** honestidade é requisito da banca e do projeto.

### ADR-006 — Fotos: ilustrações SVG originais, sem pessoas reais
**Data:** 04/11/2026 · **Status:** aceita
**Decisão:** avatares e "fotos de van" são ilustrações geradas no código.
**Justificativa:** não usar imagens de pessoas reais sem licença; evita risco de direitos.
**Consequências:** quando houver fotos reais licenciadas, os campos `fotoUrl`/`vanFotoUrl` já existem.

### ADR-007 — Critérios de busca na URL
**Data:** 04/11/2026 · **Status:** aceita
**Decisão:** serializar a busca em query params (`/resultados?...`).
**Justificativa:** busca recarregável e compartilhável; bom para a demo e para o usuário.

### ADR-008 — Autoria dos commits
**Data:** 04/11/2026 · **Status:** aceita
**Decisão:** commits de assistência de IA atribuídos ao coordenador como autor e à IA como
co-autora, com declaração em `docs/USO-DE-IA.md`.
**Justificativa:** honestidade do Ideathon; cada integrante deve commitar com sua própria conta
para que a entrega tenha contribuições autênticas de pelo menos 3 pessoas.
