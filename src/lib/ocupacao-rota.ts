import type { Rota, Veiculo, PassageiroRota } from '@/types/motorista';

/**
 * Capacidade de ALUNOS da rota (derivada): lugares do veículo menos o lugar do
 * monitor (se ocupar) e os lugares reservados. O motorista nunca conta.
 */
export function capacidadeAlunos(rota: Rota, veiculo: Veiculo | null): number {
  const base = veiculo?.lugaresPassageiro ?? 0;
  const monitor = rota.monitor && rota.monitorOcupaLugar ? 1 : 0;
  return Math.max(0, base - monitor - rota.lugaresReservados);
}

/** Índice de ordem de uma parada pelo id. */
function ordemDe(rota: Rota, paradaId: string | null): number | null {
  if (!paradaId) return null;
  const p = rota.paradas.find((x) => x.id === paradaId);
  return p ? p.ordem : null;
}

/**
 * Ocupação (nº de alunos a bordo) NO TRECHO logo após cada parada, em ordem.
 * Um passageiro ocupa do embarque (inclusive) até o desembarque (exclusive).
 * Passageiro sem desembarque continua a bordo (conta até o fim).
 */
export function ocupacaoPorTrecho(rota: Rota): { paradaId: string; ordem: number; ocupacao: number }[] {
  const paradas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  return paradas.map((p) => {
    const ocupacao = rota.passageiros.filter((pax) => {
      const emb = ordemDe(rota, pax.embarqueParadaId);
      if (emb === null) return false;
      const des = ordemDe(rota, pax.desembarqueParadaId);
      return emb <= p.ordem && (des === null || des > p.ordem);
    }).length;
    return { paradaId: p.id, ordem: p.ordem, ocupacao };
  });
}

/** Estado determinístico da van após cada parada, inclusive nomes e vagas.
 * A ordem dos assentos exibidos é uma representação, não uma atribuição física.
 * Recalcular a partir das paradas/passageiros persistidos evita estados divergentes.
 */
export function estadoDaVanPorTrecho(rota: Rota, veiculo: Veiculo | null) {
  const capacidade = capacidadeAlunos(rota, veiculo);
  return [...rota.paradas].sort((a, b) => a.ordem - b.ordem).map((parada) => {
    const passageiros = aBordoEm(rota, parada.ordem);
    return {
      paradaId: parada.id,
      ordem: parada.ordem,
      passageiros,
      ocupados: passageiros.length,
      livres: Math.max(0, capacidade - passageiros.length),
      excedeuCapacidade: passageiros.length > capacidade,
    };
  });
}

/** Maior ocupação em qualquer trecho (pico). */
export function picoOcupacao(rota: Rota): number {
  return ocupacaoPorTrecho(rota).reduce((m, t) => Math.max(m, t.ocupacao), 0);
}

/**
 * Vagas REAIS para novos alunos = capacidade de passageiros − pico de ocupação.
 * É o 1º filtro de elegibilidade da busca: uma van com 15 lugares e 13 ocupados
 * tem 2 vagas. Usa o pico (trecho mais cheio), não um total ingênuo, porque a
 * capacidade precisa valer em TODOS os trechos.
 */
export function vagasParaNovos(rota: Rota, veiculo: Veiculo | null): number {
  return Math.max(0, capacidadeAlunos(rota, veiculo) - picoOcupacao(rota));
}

/** Passageiros a bordo no trecho APÓS a parada indicada. Desembarques nessa parada já saíram. */
export function aBordoEm(rota: Rota, paradaOrdem: number): PassageiroRota[] {
  return rota.passageiros.filter((pax) => {
    const emb = ordemDe(rota, pax.embarqueParadaId);
    if (emb === null || emb > paradaOrdem) return false;
    const des = ordemDe(rota, pax.desembarqueParadaId);
    return des === null || des > paradaOrdem;
  });
}

export interface ProblemaRota {
  tipo:
    | 'capacidade'
    | 'desembarque_antes'
    | 'sem_destino'
    | 'nao_confirmada'
    | 'sem_passageiros'
    | 'a_bordo';
  mensagem: string;
}

/** Valida a consistência da rota e lista problemas concretos. */
export function validarRota(rota: Rota, veiculo: Veiculo | null): ProblemaRota[] {
  const problemas: ProblemaRota[] = [];
  const cap = capacidadeAlunos(rota, veiculo);

  // Capacidade por trecho
  const pico = picoOcupacao(rota);
  if (veiculo && pico > cap) {
    problemas.push({
      tipo: 'capacidade',
      mensagem: `Em um trecho há ${pico} alunos, mas a van tem ${cap} lugar(es) para alunos.`,
    });
  }

  for (const pax of rota.passageiros) {
    const emb = ordemDe(rota, pax.embarqueParadaId);
    const des = ordemDe(rota, pax.desembarqueParadaId);
    if (des !== null && emb !== null && des <= emb) {
      problemas.push({
        tipo: 'desembarque_antes',
        mensagem: `${pax.identificacao} desce antes (ou no mesmo ponto) de embarcar.`,
      });
    }
    if (des === null) {
      problemas.push({
        tipo: 'a_bordo',
        mensagem: `Ainda falta deixar ${pax.identificacao}.`,
      });
    }
  }

  // Paradas escola sem destino / não confirmadas
  for (const p of rota.paradas) {
    if (p.tipo === 'escola' && !p.destinoId) {
      problemas.push({ tipo: 'sem_destino', mensagem: `Uma parada de escola está sem escola escolhida.` });
    }
    if (!p.confirmado) {
      problemas.push({ tipo: 'nao_confirmada', mensagem: `A parada "${p.rotulo || 'sem nome'}" não foi confirmada.` });
    }
  }

  if (rota.passageiros.length === 0) {
    problemas.push({ tipo: 'sem_passageiros', mensagem: 'Adicione pelo menos um aluno.' });
  }

  return problemas;
}

/** Pode finalizar? (sem problemas que bloqueiam). */
export function podeFinalizar(rota: Rota, veiculo: Veiculo | null): boolean {
  return validarRota(rota, veiculo).length === 0;
}
