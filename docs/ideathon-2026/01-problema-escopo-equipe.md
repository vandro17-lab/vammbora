# Problema, escopo e equipe

## Canvas do problema (síntese documental)

| Elemento | Registro auditável |
|---|---|
| Problema | Encontrar transporte escolar compatível com endereço/região, instituição, horário, modalidade e disponibilidade é descrito no README como fragmentado entre grupos, redes sociais e indicações. Motoristas também podem ter dificuldade de encontrar passageiros dentro das rotas. Trata-se da formulação do projeto, não de resultado de pesquisa de campo. |
| Público | Famílias que procuram transporte escolar em Araçatuba e motoristas/operadores de transporte escolar. A interface/código também contempla instituições de ensino superior, mas o foco do problema descrito é transporte escolar. |
| Evidência documental | `README.md` (seções “Como surgiu a ideia” e “Nossa proposta”); telas e lógica em `src/pages/SearchResultsPage.tsx`, `src/components/search/SearchForm.tsx`, `src/features/family-search-demo/`; funcionalidades de rotas em `src/pages/motorista/` e `src/engine/`. |
| Evidência empírica | Não comprovada nesta auditoria. As pastas `docs/pesquisas/entrevistas-familias/`, `entrevistas-motoristas/`, `precos/`, `concorrentes/`, `mobilidade-sustentabilidade/` e `resultados-testes/` informam status “a iniciar”. |
| Hipótese de solução | Uma pesquisa que filtra/compara opções demonstrativas por critérios de trajeto e um ambiente para motoristas organizarem veículos, paradas, passageiros e rotas. Não é evidência de adoção nem de impacto em mobilidade. |
| Restrição de integridade | Não apresentar pessoas, preços, avaliações, vagas ou disponibilidade fictícias como reais; não alegar validação de demanda, redução de tráfego ou emissões sem pesquisa. |

**One-liner:** O VanBora propõe facilitar a descoberta de transporte escolar por critérios de trajeto e apoiar a organização de rotas dos motoristas; nesta versão, a vitrine de famílias é demonstrativa e a necessidade ainda depende de pesquisa com usuários.

## Declaração de escopo

**Um problema:** dificuldade de localizar e comparar transporte escolar compatível, junto à dificuldade do motorista de organizar rotas e identificar encaixes.

**Uma solução:** protótipo web/PWA com uma jornada de busca para famílias e uma área de organização/planejamento para motoristas.

**Três funcionalidades centrais (estado observado no repositório):**

1. **Busca demonstrativa da família** por região/endereço, escola/destino, horário e modalidade; a ordenação usa regras implementadas, mas os perfis, preços, vagas e avaliações da vitrine de demonstração são fictícios. Evidência: `src/features/family-search-demo/`, `src/lib/matching.ts`, `src/data/motoristas.ts`.
2. **Cadastro/organização de veículos, paradas e rotas**, com caminhos no painel do motorista e persistência condicional (localStorage em modo demo; Supabase em configuração/caminho real). Não se certifica aqui o funcionamento de produção. Evidência: `src/pages/motorista/`, `src/data/motorista-store.ts`, `src/lib/supabase.ts`.
3. **Planejamento/simulação de encaixe de rota**, com regras de capacidade/horário e apoio de rotas viárias externas em partes do sistema. Simular não equivale a reservar serviço ou garantir horário. Evidência: `src/engine/`, `src/lib/encaixe.ts`, `src/pages/motorista/SimuladorEncaixePage.tsx`.

**Fora de escopo desta entrega (não prometer):** serviço comercial em operação; oferta real de vagas; reserva/pagamento confirmado; garantia de chegada/horário; redução comprovada de emissões/congestionamento; validação com entrevistas ou testes de usuários não documentados; verificação legal/documental real de motoristas; integração completa de todos os módulos/telas com dados reais.

## Equipe e responsabilidades

Os nomes abaixo foram fornecidos nas instruções de auditoria. Não atribuímos funções individuais sem evidência verificável no repositório. Nomes, grafia, participação e responsabilidades devem ser confirmados pela equipe antes da apresentação.

| Integrante informado | Responsabilidade comprovada por evidência individual? | Registro seguro |
|---|---:|---|
| Evandro Cardoso | Não | Papel a confirmar pelo próprio integrante/equipe. |
| Cíntia Oliveira | Não | Papel a confirmar pelo próprio integrante/equipe. |
| Alysson | Não | Sobrenome e papel não informados; não inferir. |
| Robson | Não | Sobrenome e papel não informados; não inferir. |
| Thaís | Não | Sobrenome e papel não informados; não inferir. |
| Rebeca | Não | Sobrenome e papel não informados; não inferir. |

O histórico Git consultado não comprova autoria individual dos seis nomes. Há commits atribuídos a `vandro17-lab` e a `Claude`/`Claude Code`; as formas de e-mail/nome associadas a `vandro17-lab` não são prova de autores humanos diferentes. Não usar o número de commits como substituto de confirmação de participação.
