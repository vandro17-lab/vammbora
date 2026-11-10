# Checklist final — Ideathon Fatec 2026

Status: **Evidenciado** = artefato/código encontrado, não necessariamente certificado; **Parcial** = existe material mas a exigência toda não está comprovada; **Pendente** = não localizado ou confirmação necessária. A auditoria baseia-se no checklist transcrito em `docs/INSTRUCOES-MANUS-IDEATHON-2026.md` e no repositório observado em 2026-11-09.

| Exigência | Status | Evidência / pendência |
|---|---|---|
| Desafio real de mobilidade/sustentabilidade, solução acessível, eficiente e viável | Parcial | Problema/proposta descritos em `README.md`; mobilidade/sustentabilidade sem pesquisa concluída em `docs/pesquisas/mobilidade-sustentabilidade/README.md` (“a iniciar”). Não há impacto comprovado. |
| Cronograma 03/11 presencial; 04–06/11 online; 09/11 presencial | Pendente de confirmação | Datas são as informadas no regulamento transcrito. Presença/participação não foi comprovada no repositório. |
| Canvas de problema em uma página (problema, público, evidência) | Parcial | Síntese documental em [01-problema-escopo-equipe.md](01-problema-escopo-equipe.md); evidência empírica não encontrada, pastas de entrevistas “a iniciar”. |
| Escopo: 1 problema, 1 solução, 3 funcionalidades núcleo e exclusões | Evidenciado como documento | [01-problema-escopo-equipe.md](01-problema-escopo-equipe.md); estados técnicos conferidos nos fontes citados. |
| Papéis nominais da equipe | Pendente | Nomes fornecidos em [01-problema-escopo-equipe.md](01-problema-escopo-equipe.md); papéis, grafia e participação devem ser confirmados, não inferidos. |
| Checkpoint de 2 min: problema, público e aposta | Pendente | Nenhum roteiro/registro de checkpoint localizado; preparar e confirmar equipe. |
| User flow simples | Evidenciado como diagrama | [02-fluxo-wireframes.md](02-fluxo-wireframes.md), Mermaid; validar caminho final usado na apresentação. |
| Pelo menos 3 wireframes | Evidenciado como esquemas documentais | Três wireframes de baixa fidelidade em [02-fluxo-wireframes.md](02-fluxo-wireframes.md); não são telas React nem validação com usuários. |
| Arquitetura, stack e justificativas | Evidenciado documentalmente | [03-arquitetura-dados-recursos.md](03-arquitetura-dados-recursos.md) e `docs/ARQUITETURA.md`; disponibilidade em produção não certificada. |
| Backlog MoSCoW com cortes explícitos | Evidenciado como documento | [04-backlog-limitacoes.md](04-backlog-limitacoes.md). |
| Protótipo navegável com ≥3 telas e uma funcionalidade real/simulada | Parcial | Rotas/telas React em `src/App.tsx`; busca demonstrativa e simulação em `src/features/family-search-demo/` e `src/engine/`. Ensaio do protótipo navegável no dispositivo do evento ainda requer validação humana. |
| Repositório, commits do dia e README inicial | Parcial | Repositório e README existem. Histórico possui commits em 03/11 e posteriores; isso não comprova autoria de três integrantes nem presença no evento. |
| Pitch final de 5 min e demo ao vivo de 3 min | Pendente | Deck/roteiro e ensaio não localizados nesta auditoria. Preparação da equipe. |
| Link acessível do protótipo | Pendente de verificação | Nenhum teste de URL/deploy público foi feito nesta auditoria. README cita Vercel, o que não prova disponibilidade atual. Inserir URL confirmada pela equipe. |
| README: problema, solução, execução, limitações, próximos passos | Parcial/Evidenciado | README tem problema, proposta, stack, instruções, caráter demonstrativo e limitações gerais; próximos passos mais claros em `docs/ENTREGA-FINAL.md` e [04-backlog-limitacoes.md](04-backlog-limitacoes.md). |
| Pitch deck ≤6 slides | Pendente | Arquivo/evidência não localizado; produzir/confirmar fora desta auditoria. |
| Vídeo backup 1–2 min | Pendente | Arquivo/evidência não localizado; produzir/confirmar. |
| Declaração de originalidade e IA (ferramentas, finalidade, materiais gerados) | Parcial | `docs/USO-DE-IA.md` cita Claude e finalidades gerais; [05-originalidade-ia.md](05-originalidade-ia.md) registra limites. Ferramentas/materiais específicos precisam de confirmação humana. |
| Origem dos dados de mobilidade; dados simulados declarados | Parcial/Evidenciado | Código `src/data/motoristas.ts` e `src/data/motorista-demo.ts` declara ficção; fontes de destinos em `src/data/destinos.ts`; serviços listados em [03-arquitetura-dados-recursos.md](03-arquitetura-dados-recursos.md). Auditoria de cada dado/fonte não concluída. |
| Execução por navegador/celular, sem instalação obrigatória, serviço pago ou chave privada para demo | Parcial | Projeto web/PWA e serviços sem chave em partes do fluxo aparecem no código; Geoapify pode depender de chave/configuração. Não testado end-to-end no dispositivo/rede do evento; confirmar que o roteiro escolhido funciona sem segredo. |
| Sem login obrigatório ou conta demo funcional | Pendente de validação | Código inclui fluxos de login e modo demo, mas a conta/entrada sem login efetiva para demonstração não foi ensaiada nesta auditoria. Não publicar credenciais. |
| Dados reais ou claramente simulados, sem ficção como fato | Parcial/Evidenciado | Dados de busca marcados demo nos fontes e README; conferir todos os rótulos da jornada de palco antes de apresentar. |
| Commits de pelo menos 3 integrantes | Pendente / não comprovado | `git log` consultado mostra autores `vandro17-lab` e `Claude`/`Claude Code`; aliases de e-mail não provam pessoas distintas. Equipe precisa confirmar contribuições genuínas. |
| Acessibilidade mínima (contraste, texto redimensionável, não depender só de cor) | Pendente de auditoria | Nenhuma auditoria completa de acessibilidade feita nesta tarefa. Revisar manualmente e corrigir apenas em trabalho autorizado apropriado; esta branch da tarefa é documental. |
| Declaração de bibliotecas e templates | Parcial | Dependências listadas em `package.json` e resumidas em [03-arquitetura-dados-recursos.md](03-arquitetura-dados-recursos.md). Origem/licença de todos ativos/templates externos não está confirmada. |
| Uso de IA declarado e materiais gerados registrados | Parcial | `docs/USO-DE-IA.md` e [05-originalidade-ia.md](05-originalidade-ia.md); registro específico requer confirmação dos integrantes. |
| Presença mínima nos checkpoints | Pendente | Não há evidência suficiente em repositório; confirmar registros com a equipe. |
| Projeto preexistente proibido; repositório criado no evento | Pendente de confirmação | Histórico contém commits desde 03/11, mas não comprova independentemente quando ideia/projeto começou. Confirmação humana e registros do evento necessários. |
| Datas preservadas: 06/11 “quinta-feira” conforme transcrição, sem corrigir regulamento | Observado | Esta auditoria usa as datas/termos exatamente como transcritos no arquivo de instruções e não tenta corrigir o regulamento. |

## Referências e limite de confiança

Evidências técnicas principais: `README.md`; `docs/ARQUITETURA.md`; `docs/ENTREGA-FINAL.md`; `docs/USO-DE-IA.md`; `docs/pesquisas/`; `src/App.tsx`; `src/data/source.ts`; `src/data/motoristas.ts`; `src/data/motorista-demo.ts`; `src/data/destinos.ts`; `src/lib/geocode.ts`; `api/mapas.ts`; `src/engine/`; `package.json`; histórico Git da branch. “Não localizado” descreve somente os materiais examinados no repositório e não exclui artefato fora dele.
