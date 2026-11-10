/**
 * Cenários representativos do VanBora 2.0, escritos contra a API pública do
 * motor (`simularRota` + `encontrarEncaixesProgressivo`) para poderem ser
 * rodados tanto no motor novo quanto no antigo (comparação lado a lado).
 * Malha em linha, 1 unidade = 1 min: G0 N0(1) A4 B8 N10 C12 S1(16) P17 S2(20).
 */
import type * as Motor from './encaixe-geografico';

type P = Motor.PontoGeo;
const X: Record<string, number> = { G: 0, N0: 1, A: 4, B: 8, N: 10, C: 12, S1: 16, P: 17, S2: 20 };
const pt = (n: string): P => ({ id: n, nome: n, lat: 0, lng: X[n] / 1000 });
const matriz = (fator = 1, faltando: string[] = []): Motor.MatrizViaria => ({
  origem: 'fixture-testada',
  obter: (a, b) => (faltando.includes(a.id + '>' + b.id) ? null : { minutos: Math.ceil(Math.abs(X[a.id] - X[b.id]) * fator), metros: 500 * Math.abs(X[a.id] - X[b.id]) }),
});
const emb = (al: string, onde: string, h: number, extra: Partial<Motor.Compromisso> = {}): Motor.Compromisso => ({ id: 'e' + al, ponto: pt(onde), tipo: 'embarque', alunoId: al, horarioBaseMin: h, atendimentoMin: 1, ...extra });
const des = (al: string, onde: string, lim: number): Motor.Compromisso => ({ id: 'd' + al, ponto: pt(onde), tipo: 'desembarque', alunoId: al, limiteEscolaMin: lim, atendimentoMin: 0 });
/** Base: sai 06:00; A 06:04, B 06:09, C 06:14; escola S1 06:19. */
const rota = (lim: number, cap = 6, extra: Partial<Motor.RotaOperacional> = {}): Motor.RotaOperacional => ({
  id: 'r', versao: 1, sentido: 'ida', inicio: pt('G'), partidaMin: 360, capacidade: cap, ocupacaoInicial: 0, toleranciaMin: 10,
  compromissos: [emb('a', 'A', 364), emb('b', 'B', 369), emb('c', 'C', 374), des('a', 'S1', lim), des('b', 'S1', lim), des('c', 'S1', lim)], ...extra,
});
const ped = (casa: string, escola: string, h: number): Motor.PedidoEncaixe => ({ alunoId: 'novo', casa: pt(casa), escola: pt(escola), horarioEscolaMin: h, atendimentoMin: 1 });

export interface ResumoCenario {
  classificacao: string;
  classe?: string;
  /** Partida usada pela melhor opção (derivada do 1º evento). */
  partida?: number;
  busca?: number;
  entrega?: number;
  escolaInserida?: boolean;
  robusta?: boolean | null;
}

export function rodarCenarios(m: typeof Motor): Record<string, ResumoCenario | number[]> {
  const resumo = (r: Motor.ResultadoEncaixeProgressivo): ResumoCenario => {
    const o = r.opcoes[0];
    if (!o) return { classificacao: r.classificacao };
    const e0 = o.eventos[0];
    return {
      classificacao: r.classificacao, classe: o.classe, partida: e0.chegadaMin - X[e0.compromisso.ponto.id],
      busca: o.horarioBuscaMin, entrega: o.horarioEntregaMin, escolaInserida: r.escolaInserida, robusta: o.robusta,
    };
  };
  const busca = (r: Motor.RotaOperacional, p: Motor.PedidoEncaixe, o: Motor.OpcoesEncaixeProgressivo = {}, mz = matriz()) =>
    resumo(m.encontrarEncaixesProgressivo(r, p, mz, { reorganizar: false, ...o }));
  const comEscola = (cap: number): Motor.RotaOperacional => ({
    ...rota(420, cap),
    compromissos: [emb('a', 'A', 364), emb('b', 'B', 369), emb('c', 'C', 374), { id: 'esc', ponto: pt('S1'), tipo: 'escola', limiteEscolaMin: 420, atendimentoMin: 1 }],
  });
  const janelaFixa = rota(381, 6);
  janelaFixa.compromissos[0] = emb('a', 'A', 364, { janela: { inicioMin: 364, fimMin: 364 } });

  return {
    // 1. Encaixe simples: casa no caminho, folga de sobra, partida fixa.
    encaixe_simples: busca(rota(420), ped('N', 'S1', 420)),
    // 2. Vários alunos na mesma escola: o novo desce junto; a van esvazia na escola.
    mesma_escola_ocupacao: m.encontrarEncaixesProgressivo(rota(420), ped('N', 'S1', 420), matriz(), { reorganizar: false }).opcoes[0]?.eventos.map((e) => e.ocupacaoApos) ?? [],
    // 3. Liberação de assentos quando a escola é uma parada do tipo 'escola'.
    liberacao_assentos: m.simularRota(comEscola(3), matriz()).eventos.map((e) => e.ocupacaoApos),
    // 4. Capacidade por trecho: van cheia até S1; novo aluno embarca depois, rumo a S2.
    capacidade_trecho_livre: busca(comEscola(3), ped('P', 'S2', 450)),
    capacidade_trecho_cheio: busca(rota(381, 3), ped('N', 'S1', 381)),
    // 5. Antecipação: ligada, nunca pode atrasar a partida nem eliminar o que já cabia.
    antecipacao_com_folga: busca(rota(420), ped('N', 'S1', 420), { anteciparPartida: true }),
    antecipacao_folga_8min: busca(rota(387), ped('N', 'S1', 387), { anteciparPartida: true }),
    // 6. Janelas: aluno "a" com horário FIXO (06:04). Novo embarque antes dele.
    janela_fixa_partida_fixa: busca(janelaFixa, ped('N0', 'S1', 381)),
    janela_fixa_antecipando: busca(janelaFixa, ped('N0', 'S1', 381), { anteciparPartida: true, antecipacaoAutorizadaMin: 5 }),
    // 7. Escola adicional: S2 não está no itinerário e entra como nova parada.
    escola_adicional: busca(rota(420), ped('P', 'S2', 450)),
    // 8. Rota impossível: sem folga, partida fixa. E trecho sem dado => indeterminado.
    impossivel: busca(rota(379), ped('N', 'S1', 379)),
    indeterminado_sem_trecho: busca(rota(420), ped('N', 'S1', 420), {}, matriz(1, ['B>N', 'G>N', 'A>N', 'C>N', 'S1>N'])),
    // 9. Viável com autorização: sem folga, cabe saindo 2 min antes.
    autorizacao_nao_cadastrada: busca(rota(379), ped('N', 'S1', 379), { anteciparPartida: true }),
    autorizacao_cadastrada: busca(rota(379), ped('N', 'S1', 379), { anteciparPartida: true, antecipacaoAutorizadaMin: 5 }),
    // 10. Margem de segurança (5 min) e confiabilidade com tempos 25% piores.
    margem_exigida: busca(rota(384, 6, { margemSegurancaMin: 5 }), ped('N', 'S1', 384), { anteciparPartida: true, antecipacaoAutorizadaMin: 5, matrizConservadora: matriz(1.25) }),
    sem_margem: busca(rota(381), ped('N', 'S1', 381), { anteciparPartida: true, matrizConservadora: matriz(1.25) }),
  };
}
