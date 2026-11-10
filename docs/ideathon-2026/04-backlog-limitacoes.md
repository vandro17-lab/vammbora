# Backlog, limitações e próximos passos

Os estados abaixo refletem a existência de código/documentação na branch auditada, não certificam disponibilidade em produção nem qualidade de experiência. `Implementado no repositório` significa evidência de código; `parcial/não verificado` significa que não se deve prometer sem teste do cenário específico.

## MoSCoW

| Prioridade | Item | Estado evidenciado | Pendência/limite |
|---|---|---|---|
| **Must** | Explicar problema, solução e caráter de protótipo | Documentado em `README.md`, `docs/ENTREGA-FINAL.md` | Apresentador deve separar proposta de resultado validado. |
| **Must** | Busca de família e resultados claramente demonstrativos | Código em `src/features/family-search-demo/`, `src/data/motoristas.ts` | Validar percurso de demonstração no dispositivo/rede do evento; não é oferta real. |
| **Must** | Criar/organizar rotas e simular planejamento | Código em `src/pages/motorista/`, `src/engine/`, `src/lib/` | Persistência, serviços externos e configurações variam; não prometer navegação/resultado garantido. |
| **Must** | Três telas visíveis e uma interação real ou simulada declarada | Existem muitas rotas/telas em `src/App.tsx`; busca e simulação são demonstrativas | Equipe deve definir e testar ao vivo o recorte final, incluindo plano offline. |
| **Must** | Informar origem dos dados e separar real de simulado | Demonstração explicitada em código e README; fontes de destinos no código | Conferir conteúdo visível e validar individualmente dados externos/fontes antes de alegar oficialidade. |
| **Must** | Não apresentar dados inventados como reais | Dados demo marcados nos fontes; README declara motoristas/preços/vagas fictícios | Manter identificação visível durante o pitch e a demo. |
| **Should** | Confirmar autoria de pelo menos três integrantes via histórico | Não atendido pela evidência disponível | Git visível associa alterações a `vandro17-lab` e `Claude`/`Claude Code`; registrar contribuições humanas verdadeiras, sem fabricar commits. |
| **Should** | Acessibilidade mínima: contraste, redimensionamento, interação sem depender só de cor | Não auditado integralmente nesta tarefa | Fazer revisão manual com critérios do regulamento; não declarar conformidade sem comprovação. |
| **Should** | Pesquisa com famílias/motoristas e evidência de mobilidade sustentável | Pastas de pesquisa relevantes com status “a iniciar” | Coletar e registrar método, fonte, data, autor e limitações; pendente. |
| **Should** | README com como executar, limitações e próximos passos | Já contém instruções e explicitação de demo; `docs/ENTREGA-FINAL.md` complementa | Verificar que comando funciona em máquina de apresentação; não instalar dependências nesta auditoria. |
| **Could** | Pesquisa filtrada por escola/turno/modalidade e mapas externos | Código presente em busca/geocode | Dependência de internet/provedores; protótipo não garante resultado. |
| **Could** | Persistência operacional real e conta de demonstração funcional | Caminhos Supabase/local presentes | Conta/configuração de demo e credenciais funcionais não foram validadas; não divulgar credenciais. |
| **Won’t** | Pagamento, reserva ou garantia de serviço na entrega acadêmica | Não confirmado como fluxo concluído | Fora do escopo demonstrativo. |
| **Won’t** | Alegar entrevistas, testes, redução de emissões ou validação já concluídos | Sem evidência documental de conclusão | Não declarar até existir evidência real. |

## Limitações observadas

1. A vitrine de famílias contém personagens/dados fictícios; preços, vagas, notas e disponibilidade não representam ofertas de mercado.
2. A aplicação tem áreas com modos de dados diferentes (demo/local, Supabase configurado e serviços externos). Uma tela presente não comprova integração ponta a ponta.
3. Serviços de mapas/geocodificação dependem de rede e terceiros; rotas/tempos calculados são estimativas.
4. A busca de campo por entrevistas, preços, concorrentes, mobilidade/sustentabilidade, aspectos legais/LGPD e testes com usuários não está comprovada como concluída nas pastas consultadas.
5. O histórico examinado não comprova três autores humanos distintos nem papéis individuais.
6. Não foi localizado no inventário consultado arquivo/evidência de pitch deck de até seis slides ou vídeo de backup de 1–2 minutos. Isso significa “não localizado nesta auditoria”, não prova de que não exista fora do repositório.
7. Não foi feita auditoria completa de acessibilidade, teste de compatibilidade de dispositivo, validação do deploy público, nem teste ao vivo de credenciais/serviços.

## Próximos passos recomendados à equipe

- Confirmar os seis nomes, grafia, participação e papéis; garantir evidência de contribuição de ao menos três integrantes no Git sem fabricar histórico.
- Executar e ensaiar um roteiro de demonstração de 3 minutos, com alternativa caso rede/serviço externo falhe; não expor dados pessoais nem credenciais.
- Produzir e verificar o deck (máximo 6 slides) e vídeo (1–2 minutos), se exigidos para a entrega, guardando-os no local previsto pela equipe.
- Concluir ou declarar pendentes pesquisas, validação de usuários, acessibilidade e fontes; não converter pastas “a iniciar” em conclusão por esta auditoria.
- Revisar as declarações de IA, templates, bibliotecas e origem/licença dos ativos com as pessoas que os produziram.
- Atualizar README/documentos apenas com resultados confirmados.
