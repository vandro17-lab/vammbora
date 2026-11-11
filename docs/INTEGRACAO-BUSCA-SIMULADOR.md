# Busca da família e simulador: regras de encaixe integradas

Etapa concluída em 11/11/2026. Integra as regras do motor ("incluir um aluno
reprograma a viagem inteira") à busca das famílias e ao simulador do motorista.

## O que mudou

**Uma regra só.** `avaliarRotaDetalhada` (`src/lib/busca-rotas-reais.ts`) é a
única avaliação operacional. A busca (servidor) usa a parte pública; o simulador
usa a mesma chamada e mostra também o detalhe privado. Mesmo pedido, rota,
regras e matriz dão o mesmo resultado.

**Quais rotas entram.** As que já visitam a escola e as que o motorista
informou aceitar incluí-la. A escola aceita não passa por nenhum raio. O recorte
em linha reta (3 km) só vale para cadastro antigo, que nunca revisou a lista, e
nesse caso incluir a escola depende de aprovação.

**Horário da família.**

| Pedido | Campo | Significado |
|---|---|---|
| Só ida | `horario` | prazo: chegar à escola até |
| Só volta | `horario` | liberado na escola a partir de |
| Ida e volta | `horario` + `horarioVolta` | um para cada sentido |

O horário da família é exigência só do novo aluno. Não muda o horário da escola
na rota nem os compromissos dos atuais. Na ida é um prazo exato: a margem de
segurança (5 min) protege o limite da escola e não é descontada de novo do prazo
da família. Rota com limite 7h00 e pedido "até 6h50" é calculada: cabe se a van
puder sair mais cedo dentro do que o motorista autorizou e da flexibilidade dos
alunos atuais; além do autorizado, fica sob confirmação do motorista.

**Abertura da escola.** Quando informada (`aberturaMin`), a van espera a
abertura e a entrega conta a partir dela. Prazo da família anterior à abertura é
incompatível comprovado.

**Fila de consultas viárias** (`src/lib/busca-avaliacao-servidor.ts`).

- A estimativa por distância só ordena a fila. Não confirma nem recusa.
- O que não depende de trajeto (van sem cadastro, sem lugar, parada sem
  coordenada, rota sem horário) sai definitivo sem gastar consulta.
- `BUSCAR_ROTAS_MAX_VIARIAS` passa a contar requisições por chamada. O que não
  coube volta em `continuacao` (posição na fila + rotas a repetir).
- Continuar calcula primeiro as ainda não tentadas; as que falharam são
  repetidas com o que sobrar do orçamento.
- Rotas de 26 a 50 pontos são calculadas em blocos (4 requisições). Acima de 50
  ficam como avaliação incompleta.
- Falha de uma rota, de um bloco ou de um sentido não apaga os outros resultados.

**Resultado em quatro situações distintas.**

| Situação | Quando | Repetir resolve? |
|---|---|---|
| Ausência de oferta | nenhuma rota do sentido visita ou aceita a escola | não |
| Incompatibilidade | calculado com tempos reais, não cabe | não |
| Dados insuficientes | falta cadastro na rota | não |
| Avaliação incompleta | sem consulta, consulta falhou, trecho ausente, rota extensa | sim (exceto rota extensa) |

**Vagas.** O cartão mostra os lugares livres no trecho calculado para a família.
Sem encaixe calculado não há número; o pico global não é mais usado.

**Ida e volta.** Cada sentido tem a sua seção. Se só um tem opção, a tela avisa
que não é um pacote de ida e volta.

**Privacidade.** A resposta pública tem uma lista fechada de campos (testada).
Não saem nomes, endereços, coordenadas, horários nem alterações dos alunos atuais.

## Testes

Todos os testes automatizados desta etapa são **simulados**. Nenhum usou ruas
reais: o ambiente de desenvolvimento não tem chave do provedor viário nem acesso
de rede a um roteador.

| Arquivo | Tempos de trajeto | Cobre |
|---|---|---|
| `busca-integrada.test.ts` | malha fictícia (`cidade-simulada.fixture.ts`) | mesma coordenada, mesma rua, pequeno desvio, escola aceita sem parada, chegada até 6h50, margem, abertura, volta, vagas, categorias, família = simulador |
| `busca-avaliacao-servidor.test.ts` | provedor simulado sobre a mesma malha | fila, viável fora do primeiro lote, matriz parcial, excesso de pontos, falhas externas |
| `busca-cliente-sentidos.test.ts` | servidor de mentira (`fetch`) | horários separados, múltiplos sentidos, preservação, continuação, textos |
| `busca-rotas-handler.test.ts` | Supabase e Geoapify de mentira | endpoint, privacidade, vagas |
| `ruas-reais.test.ts` | **Geoapify real** | pulado sem `RUAS_REAIS=1` e `GEOAPIFY_API_KEY` |

A malha fictícia anda só na horizontal e na vertical a 400 m/min. Serve para
conferir as regras à mão; não diz nada sobre o traçado ou o trânsito de Araçatuba.

## Limitações

1. **Ruas reais não foram exercitadas.** Rodar `ruas-reais.test.ts` com a chave
   e fazer uma busca no ambiente de teste antes de liberar.
2. **Blocos da matriz.** Rotas com mais de 25 pontos pedem ao Geoapify tabelas
   origens × destinos (até 25 de cada lado). Isso só foi testado com o provedor
   simulado; falta confirmar contra o serviço real.
3. **Abertura da escola não tem campo no cadastro.** O motor, a busca e o
   simulador a respeitam; hoje ela só pode ser informada no simulador. A migração
   `20260104000016_abertura_escola.sql` (colunas + RPC) está escrita e **não foi
   aplicada nem testada em banco**.
4. **Dias da semana** da escola aceita não são filtrados: a família não informa dias.
5. **Cursor da continuação** é uma posição numa fila ordenada. Se rotas forem
   criadas ou alteradas entre duas chamadas, uma rota pode ser pulada ou
   repetida; uma busca nova corrige.
6. **Ida e volta não são pareadas por motorista.** A tela mostra os dois
   sentidos separados e avisa quando falta um.
7. **Modo demonstração local** (sem servidor) continua usando estimativa: os
   cartões saem "sob confirmação" com o aviso de horário aproximado.
8. **Viagem à parte.** O motor pode propor buscar o novo aluno e levá-lo à
   escola antes da viagem habitual (a escola é visitada duas vezes). Isso sempre
   sai como "depende do motorista", nunca como compatível direto.
9. **Rota sem nenhum horário** recebendo escola nova passa a ser "dados
   insuficientes" (antes era calculada a partir da meia-noite).
