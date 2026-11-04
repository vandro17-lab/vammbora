# Especificação do Motor de Encaixe (Vambora) — brief para implementação

> **Para a IA que vai implementar:** este documento é um pedido de implementação completo e
> autossuficiente. Entregue um **módulo TypeScript puro, determinístico e testado** que passe em
> **todos os testes** listados na Seção 6. Não invente dados externos, não use rede, não use mapas:
> distâncias e tempos chegam **prontos como entrada** (são tratados como simulados). Responda com
> os três arquivos pedidos na Seção 7, e nada mais.

---

## 1. Contexto (o que é o Vambora)

O Vambora é um marketplace de transporte escolar/universitário. Uma família busca uma van para
levar o aluno de casa até a escola/faculdade, no horário certo. O **motor de encaixe** decide, para
uma rota de uma van, se um **novo aluno cabe** naquela rota **sem prejudicar quem já viaja** —
considerando capacidade por trecho, horário de chegada antes da aula, janela contratada de embarque,
pior caso de trânsito e tempo a bordo.

**Princípio inegociável — honestidade:** se faltarem dados para garantir o encaixe, o motor **não**
declara "disponível". Ele diz "sob consulta" ou lista o que falta. Nada de inventar tempos,
distâncias ou vagas.

## 2. Requisitos técnicos

- **Linguagem:** TypeScript (ES2021+), tipado em modo `strict`.
- **Puro e determinístico:** funções puras, sem efeitos colaterais, sem `Date.now()`, sem aleatório,
  sem I/O, sem dependências externas (nada de npm além do runtime de testes).
- **Testes:** **Vitest**. Todos os testes da Seção 6 devem passar com `npx vitest run`.
- **Tempo é representado em MINUTOS desde a meia-noite** (ex.: `06:38` = `398`, `07:05` = `425`).
  Isso evita fuso horário e parsing. Forneça helpers se quiser, mas as funções públicas usam número.
- **Sem dependência do resto do app.** É um módulo isolado; a integração (adaptador) é feita depois.

## 3. Tipos de domínio (use exatamente estes nomes/estruturas)

```ts
/** Minuto desde a meia-noite. 06:38 => 398. */
export type Minutos = number;

export type Turno = 'manha' | 'tarde' | 'noite' | 'integral';
export type Contratacao = 'mensal' | 'avulso';
export type NivelEncaixe = 'disponivel' | 'sob_consulta' | 'indisponivel';

/** Um ponto na sequência da rota (em ordem de passagem). */
export interface PontoRota {
  id: string;
  /** Minuto planejado de passagem neste ponto, SEM trânsito extra. */
  horarioPlanejado: Minutos;
  /** Assentos já ocupados NO TRECHO seguinte a este ponto, antes do novo aluno. */
  ocupacaoTrechoSeguinte: number;
  /** Janela contratada deste passageiro existente (quanto ele tolera atrasar), em minutos. */
  toleranciaAtrasoMin: number;
}

export interface DestinoRota {
  id: string;
  /** Minuto de início da aula/compromisso. */
  horarioInicioAula: Minutos;
  /** Margem mínima para chegar ANTES da aula (minutos). */
  margemChegadaMin: number;
}

/** A rota de uma van, para um turno, já planejada. */
export interface RotaInstancia {
  id: string;
  turno: Turno;
  destino: DestinoRota;
  capacidadeVeiculo: number;
  /** Pontos em ordem de passagem (primeiro embarque -> último antes do destino). */
  pontos: PontoRota[];
  /** Minuto planejado de CHEGADA ao destino, SEM trânsito extra. */
  chegadaPlanejadaDestino: Minutos;
  /** Buffer de PIOR CASO de trânsito a somar aos tempos (minutos). >= 0. */
  bufferPiorCasoMin: number;
  /**
   * Limite de tempo a bordo em minutos. `null` = parâmetro AINDA NÃO validado legalmente:
   * nesse caso NÃO bloqueia o encaixe, apenas adiciona um alerta informativo.
   */
  limiteTempoABordoMin: number | null;
}

/** O pedido do novo aluno + como ele entraria na rota. */
export interface SolicitacaoAluno {
  destinoId: string;
  turno: Turno;
  contratacao: Contratacao;
  /** Data do serviço avulso (YYYY-MM-DD). Só quando contratacao === 'avulso'. */
  dataAvulso?: string;
  /**
   * Janela desejada de passagem do aluno no ponto dele (opcional).
   * Se informada, a passagem estimada precisa caber em [desejadoMin - antes, desejadoMin + depois].
   */
  janelaDesejada?: { desejadoMin: Minutos; antesMin: number; depoisMin: number };
  /** Como o aluno entra na rota (desvio já calculado por fora; aqui é entrada). */
  insercao: {
    /** Índice na sequência `pontos` onde o embarque do aluno entra (0..pontos.length). */
    indice: number;
    /** Minuto planejado de passagem no ponto do novo aluno, SEM buffer. */
    horarioPassagemPlanejado: Minutos;
    /** Minutos adicionais que o desvio para pegar este aluno soma ao RESTANTE da rota. >= 0. */
    atrasoAdicionalMin: number;
  };
  /** Para avulso: assentos de folga disponíveis naquele dia. undefined = não informado. */
  folgaAvulsoAssentos?: number;
}

export interface ImpactoEncaixe {
  /** Chegada ao destino (com buffer) ANTES de aceitar o aluno. */
  chegadaAntes: Minutos;
  /** Chegada ao destino (com buffer) DEPOIS de aceitar o aluno. */
  chegadaDepois: Minutos;
  /** Folga até a aula ANTES (margem positiva = chega com folga). */
  folgaAntesMin: number;
  /** Folga até a aula DEPOIS. */
  folgaDepoisMin: number;
}

export interface ResultadoEncaixe {
  elegivel: boolean;
  nivel: NivelEncaixe;
  /** Explicações honestas em pt-BR (uma ou mais frases curtas). */
  motivos: string[];
  /** Minuto estimado de passagem no ponto do aluno (COM buffer). */
  passagemEstimada?: Minutos;
  /** Tempo estimado do aluno dentro da van até o destino (minutos). */
  tempoABordoMin?: number;
  /** Chegada estimada ao destino com o novo aluno (COM buffer). */
  chegadaEstimadaDestino?: Minutos;
  impacto?: ImpactoEncaixe;
  /** true quando só encaixa RENEGOCIANDO a janela de alguém que já viaja. */
  precisaRenegociacao: boolean;
  /** Se vazio, há dados suficientes. Se não, NÃO declarar 'disponivel'. */
  dadosFaltantes: string[];
}
```

## 4. Funções públicas a implementar

```ts
/** Avalia se o aluno encaixa na rota. Função PURA. */
export function avaliarEncaixe(
  rota: RotaInstancia,
  solicitacao: SolicitacaoAluno,
): ResultadoEncaixe;

/**
 * Revalida imediatamente antes de confirmar a vaga (o estado pode ter mudado).
 * Mesma lógica de avaliarEncaixe; existe para deixar explícito o passo de revalidação.
 */
export function revalidarAntesDeConfirmar(
  rota: RotaInstancia,
  solicitacao: SolicitacaoAluno,
): ResultadoEncaixe;
```

## 5. Regras de negócio (semântica exata)

Aplique nesta ordem. Cada regra abaixo tem um teste correspondente na Seção 6.

**R1 — Compatibilidade básica.** Se `rota.turno !== solicitacao.turno` **ou**
`rota.destino.id !== solicitacao.destinoId` → `elegivel=false`, `nivel='indisponivel'`,
motivo "Turno ou destino incompatível". (A camada de UI NÃO mostra indisponíveis para a família.)

**R2 — Dados suficientes.** Se faltar algo essencial para o cálculo (ex.: `insercao` ausente,
`horarioInicioAula` ausente/≤0, `capacidadeVeiculo` ≤ 0), preencha `dadosFaltantes` e devolva
`nivel='sob_consulta'`, `elegivel=false`. **Nunca** devolva `'disponivel'` com dados faltando.

**R3 — Capacidade por trecho.** O aluno ocupa 1 assento em **todos os trechos** do ponto de
embarque (`insercao.indice`) até o destino. Para cada ponto `i >= insercao.indice`, exija
`pontos[i].ocupacaoTrechoSeguinte + 1 <= capacidadeVeiculo`. Se algum trecho estourar →
`nivel='indisponivel'`, motivo "Sem assento em um dos trechos".

**R4 — Tempos com pior caso de trânsito.**
- `passagemEstimada = insercao.horarioPassagemPlanejado + bufferPiorCasoMin`.
- `chegadaEstimadaDestino = chegadaPlanejadaDestino + insercao.atrasoAdicionalMin + bufferPiorCasoMin`.
- `tempoABordoMin = chegadaEstimadaDestino - passagemEstimada`.

**R5 — Chegar antes da aula com margem.** Exija
`chegadaEstimadaDestino <= horarioInicioAula - margemChegadaMin`.
- Se violar → `nivel='indisponivel'`, motivo "Chegaria tarde demais para a aula".
- O limite é inclusivo (igual ⇒ ainda válido).

**R6 — Janela contratada de quem já viaja.** O `atrasoAdicionalMin` atrasa os passageiros nos
pontos `> insercao.indice`. Para cada um desses pontos, compare `atrasoAdicionalMin` com
`toleranciaAtrasoMin`:
- Se `atrasoAdicionalMin <= toleranciaAtrasoMin` para todos → ok, sem renegociação.
- Se algum tem `atrasoAdicionalMin > toleranciaAtrasoMin` → **não** marque indisponível só por isso:
  marque `precisaRenegociacao=true` e `nivel='sob_consulta'`, motivo "Depende de renegociar o
  horário de outro passageiro". (O motorista pode ver como oportunidade.)

**R7 — Janela desejada do novo aluno.** Se `solicitacao.janelaDesejada` veio, exija
`passagemEstimada` dentro de `[desejadoMin - antesMin, desejadoMin + depoisMin]`. Se fora →
`precisaRenegociacao=true`, `nivel='sob_consulta'`, motivo "Fora da janela desejada do aluno".

**R8 — Tempo a bordo.** Se `limiteTempoABordoMin` for número e `tempoABordoMin > limite` →
`nivel='indisponivel'`, motivo "Tempo a bordo acima do limite". Se `limiteTempoABordoMin === null`
→ **não bloqueia**; adicione motivo informativo "Limite de tempo a bordo pendente de validação legal".

**R9 — Avulso usa folga.** Se `contratacao === 'avulso'`:
- Exija `folgaAvulsoAssentos` informado e `>= 1`; se `0`/ausente → `nivel='indisponivel'` (ou
  `sob_consulta` se ausente), motivo adequado.
- Mesmo passando em tudo, avulso **nunca** é `'disponivel'` automaticamente: é `'sob_consulta'`
  (depende de confirmação do motorista no dia), motivo "Avulso depende de confirmação do dia".

**R10 — Nível final e impacto.**
- `'disponivel'`: passou R1–R8, `contratacao === 'mensal'`, sem renegociação, sem dados faltantes.
- `'sob_consulta'`: elegível porém condicional (avulso; renegociação; limite pendente; dados
  parciais recuperáveis).
- `'indisponivel'`: falha dura (R1, R3, R5, R8-bloqueio, R9 sem folga).
- `elegivel = nivel !== 'indisponivel'`.
- Preencha `impacto` sempre que houver dados (chegadaAntes = chegadaPlanejadaDestino + buffer;
  chegadaDepois = chegadaEstimadaDestino; folga = horarioInicioAula - chegada).

**R11 — Horário original protegido.** O motor **não** altera `horarioPlanejado` dos pontos nem
"empurra" a rota para caber alguém. Ele avalia a inserção contra o planejamento atual. (Mudanças
sucessivas de horário são decisão humana, fora do motor.)

**R12 — Revalidação.** `revalidarAntesDeConfirmar` reusa exatamente a lógica de `avaliarEncaixe`
(mesma entrada ⇒ mesma saída). Serve para ser chamada logo antes de confirmar a vaga.

## 6. TESTES OBRIGATÓRIOS (escreva em `engine.test.ts` e faça todos passarem)

Use uma **rota base** nos testes e varie o necessário:

```ts
// Rota base para os testes (minutos: 07:00 = 420, 06:50 = 410, 06:30 = 390, 06:40 = 400)
const ROTA_BASE: RotaInstancia = {
  id: 'r1', turno: 'manha',
  destino: { id: 'esc1', horarioInicioAula: 420, margemChegadaMin: 10 },
  capacidadeVeiculo: 15,
  pontos: [
    { id: 'p1', horarioPlanejado: 380, ocupacaoTrechoSeguinte: 5, toleranciaAtrasoMin: 7 },
    { id: 'p2', horarioPlanejado: 390, ocupacaoTrechoSeguinte: 8, toleranciaAtrasoMin: 7 },
    { id: 'p3', horarioPlanejado: 400, ocupacaoTrechoSeguinte: 10, toleranciaAtrasoMin: 7 },
  ],
  chegadaPlanejadaDestino: 410,
  bufferPiorCasoMin: 8,
  limiteTempoABordoMin: 60,
};
// Solicitação base: entra no índice 2 (após p2), passa planejado 06:30 (390), desvio +2 min.
const SOL_BASE: SolicitacaoAluno = {
  destinoId: 'esc1', turno: 'manha', contratacao: 'mensal',
  insercao: { indice: 2, horarioPassagemPlanejado: 390, atrasoAdicionalMin: 2 },
};
```

Lista de casos (nome do teste → entrada → saída esperada). Cobre ~28 cenários:

1. **encaixe perfeito** → ROTA_BASE + SOL_BASE → `nivel='disponivel'`, `elegivel=true`,
   `precisaRenegociacao=false`, `dadosFaltantes=[]`.
2. **passagem estimada com buffer** → SOL_BASE → `passagemEstimada = 398` (390 + 8).
3. **chegada estimada com atraso+buffer** → SOL_BASE → `chegadaEstimadaDestino = 420` (410+2+8).
4. **tempo a bordo** → SOL_BASE → `tempoABordoMin = 22` (420 - 398).
5. **chega no limite exato da margem** → chegada 420 = inicio(420) - margem(0)… use
   `margemChegadaMin: 0` → ainda `disponivel` (limite inclusivo).
6. **chegaria tarde demais** → `atrasoAdicionalMin: 10` (chegada 428 > 410) → `indisponivel`,
   motivo de atraso.
7. **capacidade estourada num trecho** → p3.ocupacaoTrechoSeguinte = 15, inserção indice 2 →
   15+1 > 15 → `indisponivel`, motivo de assento.
8. **capacidade exata (borda)** → trecho com ocupação 14, cap 15 → 14+1=15 ok → não falha por R3.
9. **só ocupa do embarque em diante** → inserção indice 2: trechos 0 e 1 (ocup 5 e 8) NÃO contam;
   só do índice 2. Montar caso onde um trecho ANTES do embarque está cheio e mesmo assim encaixa.
10. **turno incompatível** → solicitacao.turno='tarde' → `indisponivel`, "Turno ou destino incompatível".
11. **destino incompatível** → solicitacao.destinoId='outra' → `indisponivel`.
12. **dados faltando (sem insercao válida)** → `horarioInicioAula: 0` → `dadosFaltantes` não vazio,
    `nivel='sob_consulta'`, `elegivel=false`, nunca 'disponivel'.
13. **capacidade <= 0 é dado inválido** → capacidadeVeiculo 0 → `dadosFaltantes` não vazio.
14. **atraso dentro da tolerância de todos** → atrasoAdicionalMin 7, tolerância 7 →
    `precisaRenegociacao=false`.
15. **atraso acima da tolerância de um existente** → atrasoAdicionalMin 9, tolerância 7 →
    `precisaRenegociacao=true`, `nivel='sob_consulta'`, motivo de renegociação.
16. **atraso só afeta pontos após o embarque** → inserir no índice 3 (último, nenhum ponto depois)
    com atraso grande → ninguém depois para atrasar → `precisaRenegociacao=false`.
17. **janela desejada atendida** → janelaDesejada {desejadoMin:390, antesMin:3, depoisMin:7};
    passagemEstimada 398 ∈ [387,397]? (398 > 397) → neste caso FORA; ajuste: use depoisMin:10 →
    398 ∈ [387,400] → ok, sem renegociação.
17b. **janela desejada estourada** → janelaDesejada depoisMin:5 → 398 > 395 →
    `precisaRenegociacao=true`, `nivel='sob_consulta'`, "Fora da janela desejada".
18. **tempo a bordo acima do limite** → limiteTempoABordoMin 20, tempoABordo 22 → `indisponivel`,
    "Tempo a bordo acima do limite".
19. **tempo a bordo no limite exato** → limite 22, tempoABordo 22 → não bloqueia (inclusivo).
20. **limite nulo não bloqueia** → limiteTempoABordoMin null, tempoABordo grande → não fica
    'indisponivel' por tempo; `motivos` inclui "pendente de validação legal".
21. **avulso com folga** → contratacao 'avulso', folgaAvulsoAssentos 2 → `nivel='sob_consulta'`,
    motivo "Avulso depende de confirmação do dia", `elegivel=true`.
22. **avulso sem folga** → folgaAvulsoAssentos 0 → `indisponivel`.
23. **avulso sem informar folga** → folgaAvulsoAssentos undefined → `sob_consulta` + dadosFaltantes
    inclui a folga (não declarar disponível).
24. **avulso nunca é 'disponivel'** → avulso que passa em tudo com folga → `nivel` é `'sob_consulta'`,
    nunca `'disponivel'`.
25. **impacto antes/depois** → SOL_BASE → impacto.chegadaAntes=418 (410+8),
    chegadaDepois=420, folgaAntesMin=2 (420-418), folgaDepoisMin=0 (420-420).
26. **mensal perfeito tem impacto preenchido** → `impacto` definido e coerente.
27. **revalidar = avaliar** → `revalidarAntesDeConfirmar(ROTA_BASE, SOL_BASE)` devolve o MESMO
    resultado de `avaliarEncaixe(ROTA_BASE, SOL_BASE)`.
28. **revalidar muda se o estado mudou** → aumentar ocupacaoTrechoSeguinte para estourar e
    revalidar → agora `indisponivel` (prova que revalida o estado atual).

> Onde um número exato depende de ajuste fino, use os valores calculados pelas fórmulas da Seção 5
> (R4) — eles são determinísticos. O importante é cada regra ter um teste que a exercite e um que
> teste a borda.

## 7. Entrega (o que me mandar de volta)

Entregue **exatamente estes três arquivos**, prontos para colar em `src/engine/`:

- `src/engine/types.ts` — os tipos da Seção 3.
- `src/engine/engine.ts` — `avaliarEncaixe` e `revalidarAntesDeConfirmar` (Seção 4–5).
- `src/engine/engine.test.ts` — os testes da Seção 6 (Vitest), todos passando.

Regras de entrega:
- TypeScript `strict`, sem dependências externas, sem `any` solto, funções puras.
- Rode `npx vitest run src/engine` e confirme **todos verdes** antes de enviar.
- Comente o código em português, de forma simples.
- **Não** altere nenhum outro arquivo do projeto. A integração com as telas é feita depois (por mim),
  via um adaptador que converte os dados do app (`Motorista`/`CriteriosBusca`) para `RotaInstancia`/
  `SolicitacaoAluno`.

---

### Como integro depois (para referência sua, coordenador)

Quando a outra IA devolver os três arquivos, você me manda aqui. Eu: (1) coloco em `src/engine/`,
(2) rodo os testes, (3) escrevo o adaptador `src/lib/matching.ts` → chama o motor real, (4) mantenho
o fallback simulado onde faltarem dados, e (5) ligo na busca. A vitrine passa a usar o motor real
sem reescrever as telas.
