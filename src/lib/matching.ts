// ============================================================================
// ÓRFÃO (auditoria "Algoritmo Supremo", Fase 1) — ADAPTADOR SIMULADO ANTIGO
// ----------------------------------------------------------------------------
// `buscarMotoristas` é um filtro simples (cidade/destino/turno/vagas) da Etapa 1.
// A busca pública hoje usa `src/lib/busca-encaixe.ts` (motor real), NÃO este
// módulo — só `matching.test.ts` o consome. Mantido sem remover; candidato a
// aposentadoria na Fase 8 após confirmar zero dependências. NÃO adicionar novos
// consumidores: use `busca-encaixe` / o motor geográfico.
// ============================================================================
import type {
  CriteriosBusca,
  Motorista,
  Destino,
  ResultadoCompatibilidade,
  NivelCompatibilidade,
} from '@/types';

/**
 * ADAPTADOR DE COMPATIBILIDADE — VERSÃO SIMULADA (Etapa 1).
 * ------------------------------------------------------------------
 * ATENÇÃO: isto NÃO é o motor de encaixe real do VanBora.
 * O motor real (`motor/` + `motor-van-bora.md`) não está no repositório
 * nesta fase, e a regra do projeto proíbe reimplementá-lo às cegas.
 *
 * Este adaptador existe apenas para a vitrine de demonstração: aplica
 * filtros honestos e óbvios (cidade, destino, turno, vagas) e classifica
 * cada motorista em um nível. Ele foi isolado de propósito atrás de uma
 * interface estável: quando o motor real estiver disponível, basta trocar
 * a implementação de `avaliarCompatibilidade` sem mexer nas telas.
 *
 * Regras respeitadas: não declarar compatibilidade sem dados suficientes;
 * demanda incompatível não aparece como elegível; diferenciar disponível,
 * sob consulta e indisponível. NÃO inventa tempos nem contagens.
 */

export interface ResultadoBusca {
  elegiveis: ResultadoCompatibilidade[];
  /** Quantos motoristas foram efetivamente consultados (para o loader honesto). */
  totalConsultados: number;
}

function avaliarCompatibilidade(
  motorista: Motorista,
  criterios: CriteriosBusca,
): ResultadoCompatibilidade | null {
  // 1) Cidade precisa bater.
  if (motorista.cidadeId !== criterios.cidadeId) return null;

  // 2) Destino: se informado, o motorista precisa atender esse destino.
  if (criterios.destinoId && !motorista.destinosIds.includes(criterios.destinoId)) {
    return null; // demanda incompatível não aparece como elegível
  }

  // 3) Turno: se informado e o motorista não cobre, é incompatível.
  if (criterios.turno && !motorista.turnos.includes(criterios.turno)) {
    return null;
  }

  // A partir daqui é elegível. Definimos o NÍVEL com honestidade.
  let nivel: NivelCompatibilidade;
  let resumo: string;

  if (motorista.vagasDisponiveis <= 0) {
    nivel = 'sob_consulta';
    resumo = 'Sem vaga aberta agora — entra na lista de interesse desta rota.';
  } else if (criterios.contratacao === 'avulso') {
    // Avulso usa folga disponível; depende de confirmação do motorista.
    nivel = 'sob_consulta';
    resumo = 'Avulso depende de folga no dia — confirme a data direto com o motorista.';
  } else {
    nivel = 'disponivel';
    resumo = `${motorista.vagasDisponiveis} ${
      motorista.vagasDisponiveis === 1 ? 'vaga disponível' : 'vagas disponíveis'
    } nesta rota.`;
  }

  return {
    motorista,
    nivel,
    resumo,
    // Horário informado PELO próprio motorista (dado real de cadastro, não inventado).
    passagemAproximada: motorista.janela.horario,
    // tempoABordoMin fica ausente de propósito: só o motor real calcula isso.
  };
}

/** Ordena: disponíveis primeiro, depois melhor avaliação, depois mais vagas. */
function ordenar(a: ResultadoCompatibilidade, b: ResultadoCompatibilidade): number {
  const peso: Record<NivelCompatibilidade, number> = {
    disponivel: 0,
    sob_consulta: 1,
    indisponivel: 2,
  };
  if (peso[a.nivel] !== peso[b.nivel]) return peso[a.nivel] - peso[b.nivel];
  if (b.motorista.avaliacao.media !== a.motorista.avaliacao.media) {
    return b.motorista.avaliacao.media - a.motorista.avaliacao.media;
  }
  return b.motorista.vagasDisponiveis - a.motorista.vagasDisponiveis;
}

export function buscarMotoristas(
  criterios: CriteriosBusca,
  motoristas: Motorista[],
  _destinos: Destino[],
): ResultadoBusca {
  // "Consultados" = motoristas na mesma cidade (foram efetivamente avaliados).
  const naCidade = motoristas.filter((m) => m.cidadeId === criterios.cidadeId);
  const elegiveis = naCidade
    .map((m) => avaliarCompatibilidade(m, criterios))
    .filter((r): r is ResultadoCompatibilidade => r !== null)
    .sort(ordenar);

  return { elegiveis, totalConsultados: naCidade.length };
}
