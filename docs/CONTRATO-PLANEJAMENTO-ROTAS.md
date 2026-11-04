# Planejamento e avaliação de sequência de rota

Implementação assistida por ChatGPT/Codex em 04/11/2026.
Branch de trabalho: `codex/planejamento-rotas`. Não altera telas, banco, matching público nem a API anterior.

## O que foi revisado

`engine.ts` mantém `avaliarEncaixe` e `revalidarAntesDeConfirmar`, com 62 testes existentes. Ele recebe ocupação pronta e trata um destino final. Não monta a sequência visual, não deriva ocupação de passageiros, não calcula saída reversa, não escolhe novas paradas e não calcula distâncias.

`planejamento.ts` acrescenta `planejarRota` e `avaliarRotaCandidata`, funções puras sem chamadas de rede, relógio, dados pessoais ou dependência de React/Supabase. O adaptador deve escolher conscientemente a API; não converter uma rota de várias escolas para o contrato antigo descartando suas restrições.

## Entrada do cadastro do Claude

- IDs estáveis de rota (na aplicação), paradas e passageiros; nomes/endereço ficam fora deste motor. Pessoas com nomes iguais têm IDs diferentes.
- `capacidadePassageiros`: todos os assentos de passageiros, SEM motorista, antes de descontar monitor.
- `assentosReservados`: assentos incluídos na capacidade que não podem receber alunos. Reserva constante durante toda esta rota. Se o monitor usa banco já excluído da capacidade, não descontar novamente.
- `paradas`: sequência completa; cada item contém `id`, `embarques`, `desembarques`, `atendimentoMin`, `janela?`.
- Passageiro embarca e desembarca exatamente uma vez nesta instância; ida e volta são instâncias separadas.
- `temposTrechosMin`: exatamente um tempo por parada: saída -> primeira parada, primeira -> segunda, etc. Fornecer tempos conservadores explícitos, incluindo o trânsito escolhido pelo adaptador. Zero é aceito para pontos coincidentes; ausência NÃO deve virar zero.
- `atendimentoMin`: duração na parada, da chegada à partida. O tempo a bordo inclui atendimento do embarque e das paradas intermediárias, não o atendimento após desembarque.
- `janela`: intervalo inclusivo de CHEGADA em minutos desde meia-noite. Escolas precisam do limite de chegada já descontada a margem, e famílias de suas janelas originais contratadas. Ausência não significa que o motor consultou uma escola e encontrou horário livre.
- `chegadaFinalAte`: chegada máxima à última parada, não seu horário de partida.
- `saidaPermitida`: menor e maior minuto de saída permitido. O dia não cruza meia-noite nesta versão.
- `limiteABordoMin`: limite operacional informado; `null` gera alerta e não autoriza disponibilidade confirmada. Nenhum valor é tratado como limite legal automaticamente.

O adaptador precisa verificar que TODAS as escolas relevantes têm restrições e que os tempos correspondem à sequência atual. Reordenar/endereço alterado invalida tempos anteriores. O motor não comprova a origem nem a atualidade desses dados.

## Planejamento

`planejarRota(rota)` encontra a última saída viável pela interseção de todas as janelas de chegada, considerando deslocamentos e atendimento. Uma escola intermediária pode exigir sair antes do que o limite da última escola exigiria.

Esta versão NÃO introduz esperas deliberadas para reconciliar janelas. Se seria necessário esperar em algum ponto, pode retornar inviável apesar de existir solução com espera. Essa limitação é conservadora: não prometer inviabilidade geográfica absoluta; pedir revisão do planejamento.

Ocupação é calculada pela sequência: passageiros desembarcam antes dos embarques no mesmo ponto. Cada trecho contém ocupação total (incluindo reservas) e lugares livres. Inclui o trecho saída -> primeira parada e não inventa um trecho depois da última parada. Lugares vagos em apenas um trecho não equivalem a vagas em todo o percurso.

A rota falha se houver duplicação, desembarque sem embarque anterior, capacidade excedida, passageiros sem destino, entrada inválida, ausência de passageiros ou limite a bordo excedido. Rascunhos continuam sendo salvos pelo cadastro, mas não produzem um plano operacional válido. Não devolver cálculos parciais como utilizáveis após erro.

O plano válido retorna saída, chegada/partida por ponto, passageiros a bordo, vagas por trecho e duração de viagem de cada passageiro. Ainda NÃO é autorização para publicação, transporte ou confirmação de assento.

## Encaixe em sequência candidata

`avaliarRotaCandidata(base, candidata, antecipacaoMaxMin)` recebe duas sequências completas. O adaptador constrói a candidata e fornece tempos recalculados dos trechos afetados. Esta função NÃO pesquisa endereços, não escolhe inserções nem otimiza a ordem de visitas.

- Preserva ordem relativa de todas as paradas existentes.
- Preserva embarques/desembarques existentes nas mesmas paradas.
- Mantém capacidade e reservas; não libera lugar removendo monitor/passageiro.
- Intersecta janelas candidatas com as ORIGINAIS, sem ampliá-las.
- Quando uma parada da base não tem janela, fixa a chegada calculada da referência, conservadoramente.
- Não permite saída posterior à referência, nem antecipação acima do limite ou fora do intervalo de saída autorizado.
- Revalida limite a bordo de todos, vagas e todas as restrições de horário.
- `disponivel` significa apenas compatibilidade com os dados fornecidos. Limite a bordo desconhecido fica `sob_consulta`, `compativel=false`.

O chamador deve preservar as janelas contratadas e a referência original na persistência. Nunca regenerar essas janelas a partir da última sugestão aceita, pois isso permitiria deslocamentos acumulados. Na primeira criação, persistir os horários confirmados antes de avaliar novas inserções.

Exemplo: base sai 06:40, chega à casa às 06:50 e à escola às 07:00. Uma nova parada antes dessa casa adiciona 5 minutos; sair 06:35 pode manter ambas as chegadas. Se o desvio acrescentar 5 minutos ENTRE a casa e a escola, antecipar saída não preserva necessariamente as duas janelas. O motor deve rejeitar esse caso quando não há folga contratada.

## O que falta na integração

- Adaptador do esquema real do cadastro para este contrato.
- Fonte de tempos/distâncias, confirmação de pontos e identificação de paradas inseridas.
- Gerador de candidatas e seleção de melhores inserções, se desejado.
- Regras de turno/destino, calendário e data efetiva do avulso no chamador. Não reutilizar ocupação mensal para presumir vaga em uma data.
- Verificação documental/publicação no servidor, independente deste cálculo.
- Revalidação com dados atuais e reserva transacional no servidor; nenhuma função daqui reserva vaga ou resolve concorrência.
- Mapa de demanda, sugestão de rotas novas, preços, combustível e GPS não foram implementados neste módulo.

## Verificação

36 novos testes cobrem múltiplas escolas, cálculo reverso, capacidade com monitor, vagas por trecho, atendimento, ida/volta, janelas, antecipação, entradas inválidas, imutabilidade e preservação dos passageiros existentes. Soma com 82 testes anteriores: 118.

Não houve integração com banco ou teste de mapa: alterações são exclusivamente de cálculo e contrato. Testes usam minutos/dados explícitos, sem fingir dados geográficos reais.
