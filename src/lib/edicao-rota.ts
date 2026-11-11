import type { ParadaRota, PassageiroRota, Rota } from '@/types/motorista';

/**
 * EDIÇÃO DA ROTA NO CONSTRUTOR (funções puras, sem rede).
 *
 * São as MESMAS operações que o construtor sempre fez — definir a saída,
 * incluir aluno numa casa, incluir escola e dizer quem desce, mover e excluir
 * paradas —, reunidas aqui para o cadastro passo a passo e para os testes.
 * Nenhuma regra de cálculo mora aqui: horários, ocupação e validação continuam
 * em `rota-para-motor`, `ocupacao-rota` e `cadastro-rota`.
 *
 * Toda função devolve uma rota nova e só mexe na parada/aluno indicado.
 */

type Ponto = { lat: number; lng: number };
export type GerarId = () => string;

const emOrdem = (r: Pick<Rota, 'paradas'>) => [...r.paradas].sort((a, b) => a.ordem - b.ordem);
const renumerar = (paradas: ParadaRota[]) => paradas.map((p, i) => ({ ...p, ordem: i }));
/** Mudou o ponto/ordem: o tempo de trecho informado deixa de valer e o mapa recalcula. */
const semTempo = (p: ParadaRota): ParadaRota => ({ ...p, tempoAteProximaMin: null });

export interface Endereco { rotulo: string; ponto: Ponto | null }

/** Compromisso do aluno (tudo opcional: vazio = não informado; zero = zero). */
export type CompromissoAluno = Pick<PassageiroRota, 'horarioHabitualMin' | 'ajusteAntesMin' | 'ajusteDepoisMin' | 'atendimentoMin' | 'atendimentoOrigem'>;
/** Dados da visita a uma escola. */
export type VisitaEscola = Pick<ParadaRota, 'limiteChegadaMin' | 'liberacaoMin' | 'atendimentoGrupoMin'>;

/* --------------------------------- saída --------------------------------- */

/** Define (ou corrige) o ponto de saída da van: sempre a primeira parada. */
export function definirSaida(rota: Rota, endereco: Endereco, novoId: GerarId): Rota {
  const atual = rota.paradas.find((p) => p.tipo === 'saida');
  const dados = { rotulo: endereco.rotulo.trim(), lat: endereco.ponto?.lat, lng: endereco.ponto?.lng, confirmado: true };
  if (atual) {
    const mudouPonto = atual.lat !== dados.lat || atual.lng !== dados.lng;
    return { ...rota, paradas: rota.paradas.map((p) => (p.id === atual.id ? { ...(mudouPonto ? semTempo(p) : p), ...dados } : p)) };
  }
  const saida: ParadaRota = { id: novoId(), ordem: 0, tipo: 'saida', ...dados };
  return { ...rota, paradas: renumerar([saida, ...emOrdem(rota)]) };
}

/* --------------------------------- alunos --------------------------------- */

/** Paradas de escola, na ordem do percurso. */
export const escolasDaRota = (rota: Pick<Rota, 'paradas'>) => emOrdem(rota).filter((p) => p.tipo === 'escola');

/** Id da parada que é a CASA do aluno (ida: onde embarca; volta: onde desce). */
export const casaDoAluno = (rota: Pick<Rota, 'sentido'>, aluno: PassageiroRota): string | null =>
  rota.sentido === 'ida' ? aluno.embarqueParadaId : aluno.desembarqueParadaId;
/** Id da parada de ESCOLA do aluno (ida: onde desce; volta: onde embarca). */
export const escolaParadaDoAluno = (rota: Pick<Rota, 'sentido'>, aluno: PassageiroRota): string | null =>
  rota.sentido === 'ida' ? aluno.desembarqueParadaId : aluno.embarqueParadaId;

/** Alunos atendidos numa casa (ida: embarcam; volta: desembarcam). */
export function alunosDaCasa(rota: Rota, paradaId: string): PassageiroRota[] {
  return rota.passageiros.filter((x) => casaDoAluno(rota, x) === paradaId);
}

export interface NovoAluno extends CompromissoAluno {
  nome: string;
  endereco: Endereco;
  /** Parada de escola do aluno, quando já existe no percurso. `null` = a escola
   *  será incluída depois (na ida, ele fica a bordo até lá). */
  escolaParadaId: string | null;
  /** Casa já existente onde o aluno entra/desce junto (mesmo endereço). */
  naCasaId?: string | null;
}

/**
 * Inclui um aluno com a casa dele.
 *  - IDA: a casa entra antes da escola dele (ou no fim do percurso, se a escola
 *    ainda não foi incluída); ele embarca na casa e desce na escola.
 *  - VOLTA: a casa entra no fim do percurso; ele embarca na escola e desce em casa.
 * O horário habitual é do ALUNO; a parada acompanha quando ainda não tem o seu.
 */
export function adicionarAluno(rota: Rota, novo: NovoAluno, novoId: GerarId): { rota: Rota; paradaId: string; alunoId: string } {
  const ida = rota.sentido === 'ida';
  const ordenadas = emOrdem(rota);
  const escola = novo.escolaParadaId ? ordenadas.find((p) => p.id === novo.escolaParadaId && p.tipo === 'escola') ?? null : null;
  const compromisso: CompromissoAluno = {
    horarioHabitualMin: novo.horarioHabitualMin ?? null, ajusteAntesMin: novo.ajusteAntesMin ?? null,
    ajusteDepoisMin: novo.ajusteDepoisMin ?? null, atendimentoMin: novo.atendimentoMin ?? null,
    atendimentoOrigem: novo.atendimentoMin == null ? null : 'informado',
  };

  let paradas = ordenadas;
  let paradaId = novo.naCasaId && ordenadas.some((p) => p.id === novo.naCasaId && p.tipo === 'casa') ? novo.naCasaId : null;
  if (!paradaId) {
    paradaId = novoId();
    const casa: ParadaRota = {
      id: paradaId, ordem: 0, tipo: 'casa', rotulo: novo.endereco.rotulo.trim(), confirmado: true,
      lat: novo.endereco.ponto?.lat, lng: novo.endereco.ponto?.lng, horarioChegadaMin: compromisso.horarioHabitualMin,
    };
    // Ida: antes da escola do aluno. Sem escola (ou na volta): no fim do percurso.
    const pos = ida && escola ? ordenadas.findIndex((p) => p.id === escola.id) : ordenadas.length;
    paradas = [...ordenadas.slice(0, pos).map((p, i, arr) => (i === arr.length - 1 ? semTempo(p) : p)), casa, ...ordenadas.slice(pos)];
  } else if (compromisso.horarioHabitualMin != null) {
    paradas = ordenadas.map((p) => (p.id === paradaId && p.horarioChegadaMin == null ? { ...p, horarioChegadaMin: compromisso.horarioHabitualMin } : p));
  }

  const alunoId = novoId();
  const aluno: PassageiroRota = {
    id: alunoId, identificacao: novo.nome.trim(), destinoId: escola?.destinoId ?? null,
    embarqueParadaId: ida ? paradaId : escola?.id ?? null,
    desembarqueParadaId: ida ? escola?.id ?? null : paradaId,
    ...compromisso,
  };
  return { rota: { ...rota, paradas: renumerar(paradas), passageiros: [...rota.passageiros, aluno] }, paradaId, alunoId };
}

export interface EdicaoAluno extends Partial<CompromissoAluno> {
  nome?: string;
  /** Novo endereço da casa. Casa dividida com outro aluno: ele ganha parada própria logo depois. */
  endereco?: Endereco;
  /** Troca a escola (parada de escola do percurso) do aluno. */
  escolaParadaId?: string | null;
}

/** Altera UM aluno. Os demais alunos e paradas ficam exatamente como estavam. */
export function atualizarAluno(rota: Rota, alunoId: string, m: EdicaoAluno, novoId: GerarId): Rota {
  const aluno = rota.passageiros.find((x) => x.id === alunoId);
  if (!aluno) return rota;
  const ida = rota.sentido === 'ida';
  let paradas = emOrdem(rota);
  let casaId = casaDoAluno(rota, aluno);
  const casa = paradas.find((p) => p.id === casaId);

  if (m.endereco && casa) {
    const dados = { rotulo: m.endereco.rotulo.trim(), lat: m.endereco.ponto?.lat, lng: m.endereco.ponto?.lng, confirmado: true };
    const mudou = casa.rotulo !== dados.rotulo || casa.lat !== dados.lat || casa.lng !== dados.lng;
    const dividida = rota.passageiros.some((x) => x.id !== alunoId && casaDoAluno(rota, x) === casa.id);
    if (mudou && !dividida) {
      const i = paradas.findIndex((p) => p.id === casa.id);
      paradas = paradas.map((p, k) => (k === i ? { ...semTempo(p), ...dados } : k === i - 1 ? semTempo(p) : p));
    } else if (mudou) {
      casaId = novoId();
      const i = paradas.findIndex((p) => p.id === casa.id);
      const nova: ParadaRota = { id: casaId, ordem: 0, tipo: 'casa', ...dados, horarioChegadaMin: null };
      paradas = [...paradas.slice(0, i).concat(semTempo(paradas[i])), nova, ...paradas.slice(i + 1)];
    }
  }

  const escola = m.escolaParadaId === undefined
    ? undefined
    : m.escolaParadaId ? paradas.find((p) => p.id === m.escolaParadaId && p.tipo === 'escola') ?? null : null;

  const antigoHorario = aluno.horarioHabitualMin ?? null;
  const novoHorario = m.horarioHabitualMin === undefined ? antigoHorario : m.horarioHabitualMin;
  // A parada acompanha o horário do aluno enquanto for o mesmo (ou não tiver o seu).
  paradas = paradas.map((p) => (p.id === casaId && (p.horarioChegadaMin == null || p.horarioChegadaMin === antigoHorario)
    ? { ...p, horarioChegadaMin: novoHorario } : p));

  const passageiros = rota.passageiros.map((x) => {
    if (x.id !== alunoId) return x;
    const atendimento = m.atendimentoMin === undefined ? x.atendimentoMin ?? null : m.atendimentoMin;
    return {
      ...x,
      identificacao: m.nome === undefined ? x.identificacao : m.nome.trim(),
      horarioHabitualMin: novoHorario,
      ajusteAntesMin: m.ajusteAntesMin === undefined ? x.ajusteAntesMin ?? null : m.ajusteAntesMin,
      ajusteDepoisMin: m.ajusteDepoisMin === undefined ? x.ajusteDepoisMin ?? null : m.ajusteDepoisMin,
      atendimentoMin: atendimento,
      atendimentoOrigem: m.atendimentoMin === undefined ? x.atendimentoOrigem ?? null : atendimento == null ? null : 'informado' as const,
      embarqueParadaId: ida ? casaId : escola === undefined ? x.embarqueParadaId : escola?.id ?? null,
      desembarqueParadaId: ida ? (escola === undefined ? x.desembarqueParadaId : escola?.id ?? null) : casaId,
      destinoId: escola === undefined ? x.destinoId ?? null : escola?.destinoId ?? null,
    };
  });
  return { ...rota, paradas: renumerar(paradas), passageiros };
}

/** Tira um aluno. A casa que ficar sem ninguém sai junto; escolas e saída ficam. */
export function removerAlunoDaRota(rota: Rota, alunoId: string): Rota {
  const aluno = rota.passageiros.find((x) => x.id === alunoId);
  if (!aluno) return rota;
  const passageiros = rota.passageiros.filter((x) => x.id !== alunoId);
  const casaId = casaDoAluno(rota, aluno);
  const casaVazia = !!casaId && !passageiros.some((x) => casaDoAluno(rota, x) === casaId);
  const ordenadas = emOrdem(rota);
  const i = ordenadas.findIndex((p) => p.id === casaId);
  const paradas = casaVazia && i >= 0
    ? ordenadas.filter((p) => p.id !== casaId).map((p, k) => (k === i - 1 ? semTempo(p) : p))
    : ordenadas;
  return { ...rota, paradas: renumerar(paradas), passageiros };
}

/* --------------------------------- escolas --------------------------------- */

export interface NovaEscola extends VisitaEscola {
  /** ID da unidade no catálogo (o mesmo das famílias). */
  destinoId: string;
  nome: string;
  /** Ponto do catálogo. */
  pontoCatalogo: Ponto | null;
  /** Portão marcado pelo motorista (a unidade continua a mesma). */
  portao?: Ponto | null;
  /** IDA: alunos a bordo que descem nesta escola. */
  descemIds?: string[];
}

/**
 * Inclui uma escola NO PERCURSO (no fim da sequência). Na ida, os alunos
 * indicados passam a descer nela. A escola deixa a lista de "aceito incluir",
 * porque agora já faz parte do percurso.
 */
export function adicionarEscola(rota: Rota, nova: NovaEscola, novoId: GerarId): { rota: Rota; paradaId: string } {
  const paradaId = novoId();
  const ponto = nova.portao ?? nova.pontoCatalogo;
  const parada: ParadaRota = {
    id: paradaId, ordem: 0, tipo: 'escola', rotulo: nova.nome, confirmado: true,
    destinoId: nova.destinoId, destinoNome: nova.nome, lat: ponto?.lat, lng: ponto?.lng, portaoEspecifico: !!nova.portao,
    limiteChegadaMin: nova.limiteChegadaMin ?? null, liberacaoMin: nova.liberacaoMin ?? null, atendimentoGrupoMin: nova.atendimentoGrupoMin ?? null,
  };
  const ordenadas = emOrdem(rota);
  const descem = new Set(rota.sentido === 'ida' ? nova.descemIds ?? [] : []);
  return {
    paradaId,
    rota: {
      ...rota,
      paradas: renumerar([...ordenadas.map((p, i) => (i === ordenadas.length - 1 ? semTempo(p) : p)), parada]),
      passageiros: rota.passageiros.map((x) => (descem.has(x.id) ? { ...x, desembarqueParadaId: paradaId, destinoId: nova.destinoId } : x)),
      escolasDisponiveis: (rota.escolasDisponiveis ?? []).filter((e) => e.destinoId !== nova.destinoId),
    },
  };
}

export interface EdicaoEscola extends Partial<VisitaEscola> {
  /** `null` = voltar ao ponto do catálogo (informe `pontoCatalogo`). */
  portao?: Ponto | null;
  pontoCatalogo?: Ponto | null;
  /** IDA: conjunto de alunos que descem nesta escola (substitui o atual). */
  descemIds?: string[];
}

/** Altera a visita de UMA escola do percurso. A unidade (ID do catálogo) não muda. */
export function atualizarEscola(rota: Rota, paradaId: string, m: EdicaoEscola): Rota {
  const escola = rota.paradas.find((p) => p.id === paradaId && p.tipo === 'escola');
  if (!escola) return rota;
  const ordenadas = emOrdem(rota);
  const i = ordenadas.findIndex((p) => p.id === paradaId);
  let paradas = ordenadas.map((p) => (p.id === paradaId ? {
    ...p,
    limiteChegadaMin: m.limiteChegadaMin === undefined ? p.limiteChegadaMin ?? null : m.limiteChegadaMin,
    liberacaoMin: m.liberacaoMin === undefined ? p.liberacaoMin ?? null : m.liberacaoMin,
    atendimentoGrupoMin: m.atendimentoGrupoMin === undefined ? p.atendimentoGrupoMin ?? null : m.atendimentoGrupoMin,
  } : p));
  if (m.portao !== undefined) {
    const ponto = m.portao ?? m.pontoCatalogo ?? null;
    if (ponto && (ponto.lat !== escola.lat || ponto.lng !== escola.lng || !!m.portao !== !!escola.portaoEspecifico)) {
      paradas = paradas.map((p, k) => (k === i ? { ...semTempo(p), lat: ponto.lat, lng: ponto.lng, portaoEspecifico: !!m.portao } : k === i - 1 ? semTempo(p) : p));
    }
  }
  let passageiros = rota.passageiros;
  if (m.descemIds && rota.sentido === 'ida') {
    const descem = new Set(m.descemIds);
    passageiros = passageiros.map((x) => {
      if (descem.has(x.id)) return { ...x, desembarqueParadaId: paradaId, destinoId: escola.destinoId ?? null };
      // Quem descia aqui e foi desmarcado volta a ficar "a bordo" (falta escola).
      return x.desembarqueParadaId === paradaId ? { ...x, desembarqueParadaId: null, destinoId: null } : x;
    });
  }
  return { ...rota, paradas, passageiros };
}

/** IDA: alunos que podem descer numa escola — embarcam antes dela e ainda não desceram antes. */
export function candidatosADescer(rota: Rota, escolaOrdem: number, escolaParadaId: string | null = null): PassageiroRota[] {
  const ordem = new Map(rota.paradas.map((p) => [p.id, p.ordem]));
  return rota.passageiros.filter((x) => {
    const e = x.embarqueParadaId ? ordem.get(x.embarqueParadaId) : undefined;
    if (e == null || e >= escolaOrdem) return false;
    if (!x.desembarqueParadaId || x.desembarqueParadaId === escolaParadaId) return true;
    const d = ordem.get(x.desembarqueParadaId);
    return d == null || d > escolaOrdem;
  });
}

/* --------------------------- mover e excluir paradas --------------------------- */

/**
 * Exclui uma parada, como o construtor sempre fez: quem embarcava nela sai da
 * rota; quem descia nela volta a ficar sem desembarque (o app avisa). A saída
 * não é excluída por aqui.
 */
export function excluirParada(rota: Rota, paradaId: string): Rota {
  const alvo = rota.paradas.find((p) => p.id === paradaId);
  if (!alvo || alvo.tipo === 'saida') return rota;
  const ordenadas = emOrdem(rota);
  const i = ordenadas.findIndex((p) => p.id === paradaId);
  const paradas = ordenadas.filter((p) => p.id !== paradaId).map((p, k) => (k === i - 1 ? semTempo(p) : p));
  const passageiros = rota.passageiros
    .filter((x) => x.embarqueParadaId !== paradaId)
    .map((x) => (x.desembarqueParadaId === paradaId ? { ...x, desembarqueParadaId: null, destinoId: null } : x));
  return { ...rota, paradas: renumerar(paradas), passageiros };
}

/** Sobe (−1) ou desce (+1) uma parada na ordem. A saída fica sempre em primeiro. */
export function moverParada(rota: Rota, paradaId: string, delta: -1 | 1): Rota {
  const arr = emOrdem(rota);
  const i = arr.findIndex((p) => p.id === paradaId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= arr.length || arr[i].tipo === 'saida' || arr[j].tipo === 'saida') return rota;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  // A ordem mudou: os tempos de trecho antigos não valem mais (o mapa recalcula).
  return { ...rota, paradas: renumerar(arr.map(semTempo)) };
}

/** Pode subir/descer? (para habilitar os botões) */
export function podeMover(rota: Rota, paradaId: string, delta: -1 | 1): boolean {
  return moverParada(rota, paradaId, delta) !== rota;
}

/* ------------------- escola que ficou sem nenhum aluno ------------------- */

/**
 * Paradas de ESCOLA em que ninguém embarca nem desce. Acontece quando o último
 * aluno daquela escola sai da rota, troca de escola ou tem a casa excluída.
 * O app NÃO decide sozinho o que fazer com a visita: ver `DecisaoEscolaVazia`.
 */
export function escolasSemAlunos(rota: Pick<Rota, 'paradas' | 'passageiros'>): ParadaRota[] {
  const emUso = new Set(rota.passageiros.flatMap((x) => [x.embarqueParadaId, x.desembarqueParadaId]));
  return emOrdem(rota).filter((p) => p.tipo === 'escola' && !emUso.has(p.id));
}

/** Escolas que ficaram sem aluno POR CAUSA de uma edição (não estavam vazias antes). */
export function escolasEsvaziadas(antes: Pick<Rota, 'paradas' | 'passageiros'>, depois: Pick<Rota, 'paradas' | 'passageiros'>): ParadaRota[] {
  const jaVazias = new Set(escolasSemAlunos(antes).map((p) => p.id));
  return escolasSemAlunos(depois).filter((p) => !jaVazias.has(p.id));
}

/**
 * O que o MOTORISTA quer fazer com a visita a uma escola que ficou sem alunos:
 *  - manter ......... a van continua passando na escola (a parada, o horário e
 *                     o tempo do grupo ficam como estão);
 *  - remover ........ a van deixa de passar; a escola sai da rota e NÃO fica
 *                     como aceita — famílias dela deixam de encontrar esta rota;
 *  - disponibilidade  a van deixa de passar hoje, mas o motorista continua
 *                     aceitando incluir a escola: ela vai para a lista de
 *                     escolas aceitas, levando portão, limite/liberação,
 *                     abertura e tempo do grupo que ele já tinha informado.
 */
export type DecisaoEscolaVazia = 'manter' | 'remover' | 'disponibilidade';

/** Aplica a decisão do motorista. Não mexe em nenhuma outra parada nem aluno. */
export function resolverEscolaSemAlunos(rota: Rota, paradaId: string, decisao: DecisaoEscolaVazia, novoId: GerarId): Rota {
  const escola = rota.paradas.find((p) => p.id === paradaId && p.tipo === 'escola');
  if (!escola || decisao === 'manter') return rota;
  // Só se resolve escola realmente vazia: com aluno, excluir a parada é outra operação.
  if (!escolasSemAlunos(rota).some((p) => p.id === paradaId)) return rota;
  const ordenadas = emOrdem(rota);
  const i = ordenadas.findIndex((p) => p.id === paradaId);
  const paradas = renumerar(ordenadas.filter((p) => p.id !== paradaId).map((p, k) => (k === i - 1 ? semTempo(p) : p)));
  if (decisao === 'remover' || !escola.destinoId) return { ...rota, paradas };
  // Outra visita à mesma escola continua no percurso: ela já está "no percurso".
  const aindaNoPercurso = paradas.some((p) => p.tipo === 'escola' && p.destinoId === escola.destinoId);
  const jaAceita = (rota.escolasDisponiveis ?? []).some((e) => e.destinoId === escola.destinoId);
  if (aindaNoPercurso || jaAceita) return { ...rota, paradas };
  const temPonto = typeof escola.lat === 'number' && typeof escola.lng === 'number';
  return {
    ...rota, paradas,
    escolasDisponiveis: [...(rota.escolasDisponiveis ?? []), {
      id: novoId(), destinoId: escola.destinoId, destinoNome: escola.destinoNome ?? null, dias: null,
      // Portão só quando o motorista marcou um específico; senão vale o ponto do catálogo.
      portaoLat: escola.portaoEspecifico && temPonto ? escola.lat! : null,
      portaoLng: escola.portaoEspecifico && temPonto ? escola.lng! : null,
      limiteChegadaMin: escola.limiteChegadaMin ?? null, aberturaMin: escola.aberturaMin ?? null,
      liberacaoMin: escola.liberacaoMin ?? null, atendimentoGrupoMin: escola.atendimentoGrupoMin ?? null,
    }],
  };
}
