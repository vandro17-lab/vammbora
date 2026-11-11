# Revisão dos fluxos afetados pela integração das regras de encaixe

Revisão feita em 11/11/2026, na branch `ccr-13c55018-1op6qi`, sobre a etapa
descrita em `INTEGRACAO-BUSCA-SIMULADOR.md`. Nada foi mesclado, publicado nem
aplicado em banco.

## O que foi encontrado e o que mudou

### 1. Edição da rota e Minha Van

Não existe disponibilidade guardada: a busca e o simulador recalculam tudo a
cada pedido. O que ficava velho era o que já estava na tela.

| Onde | Antes | Agora |
|---|---|---|
| Busca com "Continuar avaliação" | a continuação seguia valendo mesmo se um motorista editasse a rota no meio | cada resposta traz a assinatura das rotas e vans; se mudou, o servidor recomeça a fila e a tela descarta os resultados antigos, com aviso |
| Simulador | usava a rota carregada ao abrir a tela | relê rota e van salvas a cada simulação e avisa quando mudaram |
| Minha Van / Vans | salvar outro número de lugares não dizia nada | lista as rotas afetadas (menos lugares, sem lugar, lotação excedida); nenhuma rota é alterada |
| Cartão e pedido de interesse | sem referência ao que foi calculado | levam a `versao` (resumo opaco de rota + van) |

A versão muda com passageiros, paradas, escolas visitadas ou aceitas, horários,
antecipação, veículo, lugares, reservas e monitor. Não muda com o nome da rota.

### 2. Último aluno de uma escola

| Operação | Antes | Agora |
|---|---|---|
| Tirar aluno, trocar a escola dele ou excluir a casa (construtor) | a visita ficava, sem pergunta | a visita fica e o app pergunta |
| Tirar aluno na montagem da volta | a visita era apagada em silêncio | a visita fica e o app pergunta |

As três respostas: continuar passando (nada muda); parar de passar mas aceitar
incluir (a escola vai para a lista de aceitas com portão, limite, abertura,
liberação e tempo do grupo); tirar a escola da rota. Concluir a rota fica
bloqueado enquanto houver pergunta sem resposta; salvar rascunho continua livre.

Limitação: "continuar passando" não tem coluna própria no banco. Uma visita sem
alunos já salva é tratada como mantida; a pergunta só aparece na sessão em que a
escola foi esvaziada.

### 3. Perfil, WhatsApp e lista de interesse

- A mensagem de WhatsApp passa a levar o horário de cada sentido e a frase de
  que não reserva vaga. Continua sem o endereço e só é enviada pela família.
- O cartão de rota real não tinha nenhum caminho de contato. Ganhou "Tenho
  interesse nesta rota", que abre o formulário de interesse já existente com o
  contexto: sentido, horário, rota, horários calculados, situação e versão.
- Rota de demonstração não recebe pedidos.
- Gravação: `registrar_interesse_v2` (migração 0017). Sem a migração, o app usa a
  função antiga e acrescenta um resumo do contexto ao campo de região.

O pedido não reserva vaga, não altera a rota e não avisa o motorista: o contato
continua manual, pela equipe.

### 4. Confirmação

O botão "Confirmar inclusão" do simulador **continua desativado**. A função
`confirmar_encaixe_rota` (migração 0009) existe, mas não dá as garantias pedidas:

| Garantia | Migração 0009 |
|---|---|
| Só o dono confirma | sim |
| Trava da rota e conferência de versão (`updated_at`) | sim |
| Atomicidade parada + aluno | sim |
| Revalidar horários no servidor | não: confia no navegador |
| Revalidar capacidade por trecho dentro da transação | não |
| Conferir a van (lugares, reservas, monitor) usada na simulação | não |
| Renumerar a ordem das paradas ao inserir no meio | não |
| Gravar horário, flexibilidade e atendimento do aluno | não |
| Incluir a escola junto, quando ela é aceita e ainda não é parada | não |
| Registrar aprovação do motorista quando o encaixe depende dela | não |

A trava com conferência de versão impede duas inclusões simultâneas na mesma
vaga, mas sem a capacidade conferida no servidor uma simulação velha ou forjada
ainda gravaria. A chave `CONFIRMACAO_DE_ENCAIXE_HABILITADA` fica `false`, com os
requisitos listados no código e na tela. O caminho para incluir um aluno
continua sendo editar a rota no construtor.

### 5. Navegação

- A viagem em andamento era retomada com a rota salva naquele momento; se a rota
  tivesse sido editada, o índice da parada apontava para outra parada. Agora a
  viagem guarda a rota do início e segue por ela até o fim, com aviso de que a
  alteração vale a partir da próxima viagem.
- Percurso de simulação (`?simular=1`) abria uma viagem real no histórico. Agora
  não grava nada.
- O histórico já guardava cópia do nome e do endereço de cada evento; editar a
  rota não reescreve viagens passadas.
- Simular um encaixe nunca gravou nada na rota; isso foi conferido por teste.

Limitação: a rota do início fica guardada no aparelho. Retomar a viagem em outro
aparelho usa a rota salva.

### 6. Montagem da volta

- Horários, flexibilidade, saída, antecipação e escolas aceitas já não eram
  copiados. O tempo de atendimento do aluno ainda era; deixou de ser.
- A ordem das entregas era calculada em linha reta. A tela agora pede os
  trajetos reais e refaz a ordem; se o mapa não responde, mantém a aproximação e
  diz isso.
- A volta só é salva como concluída com a liberação de cada escola informada.
  Faltando algo, vira rascunho e a tela lista o que falta.
- **Defeito corrigido:** a volta sugerida não tem parada de saída, e o cálculo
  tratava a primeira parada como garagem. A visita à escola e os embarques
  sumiam, e a busca avaliava a escola da própria rota como "escola nova". Rota
  sem saída agora começa no ponto da primeira parada, que continua sendo atendida.
- **Defeito corrigido:** volta sem liberação usava o padrão do turno, que é um
  horário de chegada da ida (7h00). Agora é "dados insuficientes".

Monitor e lugares reservados continuam vindo da ida, por serem da van.

### 7. Oportunidades, inteligência, planejamento e otimização

| Consumidor | Situação | Ação |
|---|---|---|
| Oportunidades (`vm/encaixe.ts`) | motor antigo, limite único, estimativa apresentada como "motor real"; custo com `desvio × 2` e 1,5 km inventado quando não cabia | passa a usar a mesma avaliação da busca, sempre como estimativa; custo só do trajeto avaliado, ida e volta cada uma na sua rota; volta não avaliada fica fora do total e a tela diz |
| Painel (indicador de vagas) | capacidade da primeira rota aplicada a todas | cada rota com o seu monitor e as suas reservas |
| Otimizador de ordem | ignorava o ponto final obrigatório | não sugere parada depois dele |
| Planejador do construtor (`rota-para-motor`) | planeja de trás para frente só pelo limite do ponto final; não usa saída habitual, limite por escola, liberação nem abertura | mantido; a revisão do construtor ganhou uma conferência pelas regras de encaixe, que diz se a rota fecha e por quê |
| Sugestão de rota melhor | já usava as regras atuais; estimativa rotulada | nenhuma |
| Inteligência | só indicadores de custo sobre as rotas cadastradas | nenhuma |
| `busca-encaixe.ts`, `matching.ts` | sem uso no app (só testes) | nenhuma |
| VanBora Pro e Laboratório | demonstrações com dados fictícios e motor antigo, rotuladas | nenhuma |

### 8. Demonstração

- A busca exclui rotas de demonstração, salvo `BUSCAR_ROTAS_DEMO` no servidor.
- Com essa variável ligada, as demonstrativas apareciam misturadas na contagem.
  Agora são contadas à parte, não entram em "rotas encontradas" nem no aviso de
  ida e volta, e não recebem pedidos.
- Oportunidades só existem no modo demonstração e estão rotuladas como fictícias.

## Migrações preparadas (nenhuma aplicada)

| Arquivo | Conteúdo | Sem ela |
|---|---|---|
| `20260104000016_abertura_escola.sql` | coluna de abertura em paradas e escolas aceitas; RPC de salvar rota com a coluna | abertura só informada no simulador |
| `20260104000017_interesse_com_contexto.sql` | `context` e `route_id` em `waitlist_requests`; `registrar_interesse_v2` | contexto vai resumido no campo de região |

As duas são aditivas e não foram executadas em nenhum banco. A 0016 recria
`salvar_rota_completa`; teste salvar e reabrir uma rota antes de qualquer outro
ambiente.

## Testes

| Arquivo | Cobre |
|---|---|
| `fluxos-afetados.test.ts` | os oito itens e o percurso cadastro → busca → simulador → proposta → operação |
| `interesse-contexto.test.ts` | gravação do interesse com e sem a função nova |

Todos simulados (malha fictícia, provedor e Supabase de mentira).

Testes anteriores alterados nesta revisão, todos por mudança deliberada de
contrato e não de regra:

- asserções da continuação passaram de igualdade exata para conferência dos
  campos `inicio` e `repetir`, porque a continuação ganhou `assinatura`;
- a lista fechada de campos públicos do endpoint ganhou `versao`.

## Conferido no navegador

Com servidor e banco simulados: página de resultados com o cartão, o pedido de
interesse com contexto, a rota de demonstração sem botão e a queda para a função
antiga quando a nova não existe.

## Não executado

- Ruas reais: sem chave do provedor e sem rede para roteador.
- Banco real: nenhuma migração aplicada, nenhuma RPC chamada de verdade.
- Telas do motorista no navegador (construtor, volta, Minha Van, simulador,
  navegação): cobertas por testes das regras e pelo build, não por uso em tela.
- GPS e viagem real na rua.

## Riscos

1. As telas do motorista alteradas não foram exercitadas em navegador.
2. A ordenação da volta pelas ruas depende de `/api/mapas` com sessão; sem ela
   cai na aproximação, com aviso.
3. A versão é um resumo de 64 bits sem criptografia. Serve para detectar
   mudança, não como prova.
4. No modo sem a migração 0017, o resumo do contexto fica junto do texto de
   região que a família digitou, visível no painel administrativo.
5. Volta já salva como concluída sem liberação passa a sair como "dados
   insuficientes" na busca. Antes saía com horários sem sentido.
6. Rota sem parada de saída muda de resultado: a primeira parada agora conta.
7. O construtor insere a casa de um aluno novo logo antes da escola dele, sem
   olhar o mapa. A rota pode ficar inconsistente até o motorista reordenar; a
   conferência nova mostra isso, mas não corrige.
8. O cenário de demonstração do motorista usa uma "volta" que é a ida com o
   sentido trocado. Não foi alterado; nas oportunidades essa volta sai como não
   avaliada.

## Como validar

1. `npm test` e `npm run build`.
2. Em ambiente de teste, aplicar 0016 e 0017, salvar e reabrir uma rota, e
   registrar um interesse a partir de um cartão.
3. Com a chave do provedor: `RUAS_REAIS=1 GEOAPIFY_API_KEY=... npx vitest run src/lib/ruas-reais.test.ts`.
4. Construtor: tirar o último aluno de uma escola e conferir as três respostas.
5. Montar a volta de uma ida: conferir o aviso de ordem pelas ruas, tirar todos
   os alunos de uma escola, salvar sem liberação (deve virar rascunho).
6. Minha Van: reduzir os lugares abaixo da lotação de uma rota.
7. Busca: abrir resultados com mais rotas que o orçamento, editar uma rota em
   outra aba e tocar em "Continuar avaliação".
8. Navegação: iniciar uma viagem, editar a rota em outra aba, recarregar a
   navegação. Depois abrir com `?simular=1` e conferir que nada foi ao histórico.
