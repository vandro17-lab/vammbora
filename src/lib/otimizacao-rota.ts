import type { Rota, Veiculo } from '@/types/motorista';
import type { MatrizViaria } from '@/engine/encaixe-geografico';
import { sugerirRotaMelhor, type SugestaoRota } from '@/engine/otimizador-rota';
import { montarRotaAncorada } from '@/lib/rota-para-encaixe';

/**
 * Sugestão de rota melhor para o motorista (VanBora 2.0). Somente LEITURA:
 * compara a ordem cadastrada com a melhor ordem encontrada e devolve a
 * diferença. Nada é gravado — aplicar a sugestão é decisão do motorista.
 */
export interface ParadaSugerida {
  /** Rótulo da parada (endereço/escola) — uso exclusivo do próprio motorista. */
  nome: string;
  chegadaMin: number;
  /** Chegada na ordem atual (null se a parada não tinha horário calculado). */
  antesMin: number | null;
  embarcam: string[];
  descem: string[];
}

export interface SugestaoDoCadastro {
  /** null quando não foi possível calcular (faltam coordenadas/trechos). */
  sugestao: SugestaoRota | null;
  /** true = só há ganho mudando horários além da tolerância (combinar com as famílias). */
  exigeCombinarHorarios: boolean;
  paradas: ParadaSugerida[];
  alunosComHorarioAlterado: number;
  maiorMudancaMin: number;
  motivo?: string;
}

export function sugerirRotaDoCadastro(rota: Rota, veiculo: Veiculo | null, matriz: MatrizViaria): SugestaoDoCadastro {
  const vazio = (motivo: string): SugestaoDoCadastro =>
    ({ sugestao: null, exigeCombinarHorarios: false, paradas: [], alunosComHorarioAlterado: 0, maiorMudancaMin: 0, motivo });
  const montada = montarRotaAncorada(rota, veiculo, matriz);
  if (!montada) return vazio('Confirme a localização de todas as paradas no mapa.');
  const { rotaOp, base, nomePorCompromisso } = montada;
  if (!base.valido) {
    return vazio(base.motivos.some((m) => m.includes('tempo/distância'))
      ? 'Não foi possível calcular o tempo de um trecho da rota.'
      : 'A rota atual tem inconsistências (capacidade ou horários); revise-a antes.');
  }

  // 1º: sem mexer no combinado (cada aluno dentro da tolerância/janela).
  let sugestao = sugerirRotaMelhor(rotaOp, matriz);
  let exigeCombinarHorarios = false;
  // 2º: se não houver ganho, mostra o que seria possível combinando novos horários.
  if (!sugestao.melhorou) {
    const livre = sugerirRotaMelhor(rotaOp, matriz, { toleranciaMin: null });
    if (livre.melhorou) { sugestao = livre; exigeCombinarHorarios = true; }
  }

  const casa = sugestao.alteracoes.filter((a) => a.id.startsWith(rota.sentido === 'ida' ? 'emb:' : 'des:'));
  const mudaram = casa.filter((a) => a.diferencaMin !== 0);
  const antes = new Map(base.eventos.map((e) => [e.compromisso.ponto.id, e.chegadaMin]));
  const paradas: ParadaSugerida[] = [];
  for (const e of sugestao.plano.eventos) {
    let p = paradas[paradas.length - 1];
    if (!p || p.nome !== e.compromisso.ponto.nome) {
      p = { nome: e.compromisso.ponto.nome, chegadaMin: e.chegadaMin + (e.esperaMin ?? 0), antesMin: antes.get(e.compromisso.ponto.id) ?? null, embarcam: [], descem: [] };
      paradas.push(p);
    }
    const nome = nomePorCompromisso[e.compromisso.id];
    if (nome && e.compromisso.tipo === 'embarque') p.embarcam.push(nome);
    if (nome && e.compromisso.tipo === 'desembarque') p.descem.push(nome);
  }
  return {
    sugestao, exigeCombinarHorarios, paradas,
    alunosComHorarioAlterado: mudaram.length,
    maiorMudancaMin: mudaram.reduce((m, a) => Math.max(m, Math.abs(a.diferencaMin)), 0),
  };
}
