# INSTRUÇÕES PARA O MANUS — Auditoria documental Ideathon Fatec 2026

**Repositório:** `vandro17-lab/vammbora`  
**Branch de trabalho JÁ CRIADA:** `docs/ideathon-entrega-final-2026`  
**Branch principal intocável:** `main`  
**Escopo:** documentação acadêmica, somente.

## 0. Leia antes de começar — limites inegociáveis

**NÃO CRIE OUTRA BRANCH.** Esta branch já foi criada para a tarefa. Trabalhe somente nela. Não faça merge, não abra pull request automaticamente e não faça push na `main`.

**NÃO MODIFIQUE O CÓDIGO-FONTE, SOB NENHUMA CIRCUNSTÂNCIA.** É permitido ler o repositório inteiro para auditar, mas as **únicas alterações autorizadas** são:
- adicionar/editar documentos Markdown e diagramas estáticos **dentro de `docs/`**;
- complementar o `README.md` da raiz, apenas se necessário, preservando seu conteúdo correto.

**PROIBIDO** criar, modificar, excluir, mover ou renomear qualquer arquivo em `src/`, `public/`, `supabase/`, `scripts/`, arquivos de configuração, `package.json`, lockfiles, arquivos de ambiente, workflows, testes e quaisquer outros caminhos fora da lista autorizada. Não executar migrações, não instalar dependências, não alterar banco, serviços, autenticação, Vercel, GitHub settings ou funcionalidades. Não reescrever histórico, nem fabricar commits de integrantes.

Se uma tarefa exigir mudança fora desses caminhos, **não a faça**: registre como pendência e informe o usuário.

## 1. Referência oficial — transcrição operacional do PDF entregue pelo usuário

O documento `Ideathon - Fatec 2026.pdf` possui 12 páginas. Abaixo estão as exigências que você deve usar como checklist. O PDF não está necessariamente dentro do repositório; **não exija que o usuário o envie novamente**: esta seção contém os requisitos textuais necessários à auditoria.

**Objetivo (págs. 2–3):** desafio real de mobilidade urbana e sustentabilidade; solução inovadora, acessível, eficiente e viável; colaboração, pesquisa, planejamento e comunicação.

**Cronograma (pág. 4):** 03/11 presencial; 04, 05 e 06/11 online; 09/11 presencial para apresentações.

**03/11 — descoberta e aposta (pág. 5):**
- Canvas do problema em uma página: problema, público afetado e evidência.
- Declaração de escopo: 1 problema, 1 solução, 3 funcionalidades núcleo e exclusões.
- Definição nominal dos papéis da equipe.
- Checkpoint de 2 minutos: problema, público, aposta.

**04/11 — design e arquitetura (pág. 6):**
- User flow em um diagrama simples.
- Pelo menos 3 wireframes de telas.
- Diagrama de arquitetura técnica, stack e justificativa das escolhas.
- Backlog MoSCoW ou similar, com corte explícito do que não será feito.

**05 e 06/11 — construção (págs. 7–8):**
- Protótipo navegável com pelo menos 3 telas e uma funcionalidade real ou simulada com dados.
- Repositório, commits do dia e README inicial.

**09/11 — apresentação (pág. 9):** pitch final de 5 minutos e demonstração ao vivo de 3 minutos.

**Entrega final (pág. 10):**
- Link acessível do protótipo.
- README com problema, solução, como executar, limitações conhecidas e próximos passos.
- Pitch deck de **no máximo 6 slides**.
- Vídeo de backup de **1 a 2 minutos**.
- Declaração de originalidade e uso de IA: ferramentas, finalidade e o que foi gerado.
- Registro da origem dos dados de mobilidade; dados simulados devem ser declarados explicitamente.

**Regras técnicas (pág. 11):**
- Navegador ou celular, sem instalação obrigatória, serviço pago ou chave privada para a demonstração.
- Sem login obrigatório ou com conta de demonstração funcional.
- Dados reais ou claramente simulados; nunca apresentar dados inventados como reais.
- Git com commits de **pelo menos 3 integrantes**.
- Acessibilidade mínima: contraste legível, texto redimensionável, navegação que não dependa só de cores.
- Declaração de bibliotecas e templates utilizados.

**Processo e integridade (pág. 12):**
- Uso de IA permitido, porém declarado, com registro do que foi gerado.
- Presença mínima nos checkpoints.
- Proibida entrega de projeto preexistente: repositório criado no evento.

**Nota de fidelidade:** a página 8 repete a indicação "quinta-feira" para 06/11; preserve as datas e não invente correções no regulamento.

## 2. Procedimento de auditoria

1. Leia o README, todos os documentos em `docs/`, os manifestos de dependências, os componentes e a lógica relevantes, e o histórico de commits. Pode ler qualquer arquivo, mas não editar código.
2. Não confunda "não encontrado por busca" com "inexistente": procure documentos equivalentes e evidências em diferentes pastas/nomes.
3. Verifique as afirmações do README e da arquitetura contra o código existente, distinguindo funcionalidade implementada, demonstrativa, parcial e planejada.
4. Verifique o histórico de commits e os autores; não atribua contribuições a integrantes sem evidência. Pelo menos três autores precisam ser comprovados para marcar o requisito como atendido.
5. Registre evidências verificáveis: caminhos de arquivos, links, datas e limites do que pôde confirmar.
6. Antes de criar documentos, aproveite os materiais existentes. Não duplique informação desnecessariamente.

## 3. Documentação autorizada a criar/complementar

Organize, preferencialmente em `docs/ideathon-2026/`, documentos para:

1. **Canvas do problema** (1 página; problema, público, evidências).
2. **Escopo** (1 problema, 1 solução, 3 funcionalidades centrais, fora de escopo).
3. **Equipe e responsabilidades** (nomes conhecidos: Evandro Cardoso, Cíntia Oliveira, Alysson, Robson, Thaís, Rebeca; não invente sobrenomes ou atribuições não comprovadas).
4. **User flow** (diagrama simples, fiel ao fluxo real).
5. **Três wireframes** (baixa fidelidade, documentais; não alterar as telas React).
6. **Arquitetura e stack** (diagrama, justificativas, referências à documentação existente).
7. **Backlog MoSCoW** (Must, Should, Could, Won't; indicar estado real).
8. **Declaração de originalidade e IA** (nomes das ferramentas e materiais gerados apenas quando verificáveis; lacunas como pendência de confirmação humana).
9. **Fontes de dados** (reais, simulados, mapas, origem não verificada; não inventar).
10. **Bibliotecas, templates e recursos externos** (basear-se em dependências e evidências reais).
11. **Limitações e próximos passos** (realistas, sem alegar funcionalidades não testadas).
12. **Checklist final** (cada exigência do PDF, status, evidência/link e pendência).

Você pode consolidar documentos equivalentes se for mais claro. Atualize o `README.md` da raiz apenas com links e complementos documentais indispensáveis. Preserve a redação existente que estiver correta.

## 4. Restrições de integridade

- Não invente entrevistas, pesquisas, orçamentos, validações, depoimentos, dados, prints, fontes, vídeos, apresentações ou testes.
- Pastas de pesquisa com status "a iniciar" não devem virar "concluído" sem prova.
- Não declare que o pitch deck ou vídeo existem sem localizar os arquivos ou evidências.
- Não simule presença em checkpoints ou colaboração no Git.
- O protótipo demonstra motoristas, preços e vagas fictícios: descreva explicitamente o que for simulado, conforme evidência do projeto.
- Não afirme conformidade técnica sem verificação. Se testes em navegador forem necessários, faça apenas verificações não destrutivas e não altere arquivos.
- Não inclua credenciais, chaves ou dados pessoais de crianças na documentação.

## 5. Validação obrigatória antes do commit

Execute e confira:

```bash
git status --short
git diff --name-status main...HEAD
git diff --name-status
```

Inclua também arquivos novos ainda não rastreados no controle de alterações. **Somente** `README.md` e caminhos `docs/**` podem constar como criados/modificados. Não pode haver exclusão ou renomeação de arquivos existentes, nem alterações fora dos caminhos autorizados.

Se houver qualquer mudança proibida, não a inclua em commit, não a publique e informe o usuário. Não execute comandos destrutivos para tentar escondê-la.

Faça commits **somente documentais** na branch existente. Não faça merge na `main`.

## 6. Entrega ao usuário

Forneça: link da branch; lista dos documentos criados/alterados; checklist com evidências; pendências dependentes de pessoas (vídeo, pitch, autoria, pesquisa etc.); resultado do diff de segurança; confirmação de que `main` e código-fonte não foram alterados.

**Princípio final:** sua missão é DOCUMENTAR e AUDITAR o VanBora, nunca reprogramá-lo. Se não puder confirmar algo, declare a incerteza em vez de inventar.
