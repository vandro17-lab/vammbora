# Construtor de rotas — cadastro guiado no mapa

Tela única para criar e editar rotas (`/painel/rota/:id` e `/app/rotas/nova`), em
`src/pages/motorista/ConstrutorRotaPage.tsx`. **É só interface**: nenhuma regra de negócio mora nela.

| Responsabilidade | Onde fica |
|---|---|
| Incluir/alterar/mover/excluir paradas, alunos e escolas | `src/lib/edicao-rota.ts` (funções puras, testadas) |
| Capacidade, ocupação por trecho e avisos que impedem concluir | `src/lib/ocupacao-rota.ts` |
| Horários previstos (motor real) | `src/lib/rota-para-motor.ts` |
| O que ainda falta informar | `src/lib/cadastro-rota.ts` |
| Gravação (rascunho/concluída) | `src/data/motorista-store.ts` |
| Mapa, trajeto e tempos de trecho | `src/components/motorista/MapaInterativoRota.tsx` |

## Como a tela se organiza

- **Mapa sempre visível** no topo (ao lado, em telas largas). O endereço em cadastro aparece como
  alfinete arrastável; tocar no mapa também marca o ponto. Paradas confirmadas ficam numeradas, com
  o nome do aluno ou da escola; escolas têm marcador próprio.
- **Painel do meio**: só o cadastro atual. Depois de confirmar, o formulário some e volta a lista
  compacta das paradas (toque para ver, corrigir, mover ou excluir).
- **Rodapé**: a ação principal do momento.
- A altura acompanha o teclado do celular (`useAlturaVisivel`), para o mapa e o botão não sumirem.

Etapas: **Dados** (saída, horário de saída, sentido, período, nome; van/dias/monitor recolhidos) →
**Paradas** (alunos e escolas do percurso) → **Escolas** (visitas do percurso + escolas que o
motorista aceita incluir, em seção separada) → **Revisão** (avisos com “Corrigir”, horários
informados × previstos, ordem, ocupação e conclusão).

## Horários, sem confundir

- **Habitual**: informado pelo motorista (aluno, saída) — aparece em destaque.
- **Previsto**: calculado pelo motor com o trajeto do mapa e os tempos de embarque — aparece menor,
  com a palavra “previsto”. Nunca é digitado nem simulado.
- **Tempo de embarque/desembarque**: por aluno. **Tolerância**: por aluno (antes/depois).
- **Escola**: limite de chegada (ida) ou liberação (volta) e tempo de parada do grupo.
- **Deslocamento entre paradas**: vem do mapa; o ajuste manual continua na Revisão.

## Identidade visual

Logo oficial em `public/brand/vanbora-logo.png`. `npm run icons` gera, a partir dela, o emblema, a
versão horizontal dos cabeçalhos e os ícones do PWA. A arte é sobre preto (sem transparência): o
componente `Logo` a mostra numa placa preta. Amarelo oficial `#FFC700` (`mint-400` no Tailwind).
