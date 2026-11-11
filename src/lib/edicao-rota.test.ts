import { describe, it, expect } from 'vitest';
import type { Rota, Veiculo } from '@/types/motorista';
import {
  adicionarAluno, adicionarEscola, alunosDaCasa, atualizarAluno, atualizarEscola, candidatosADescer, definirSaida,
  excluirParada, moverParada, podeMover, removerAlunoDaRota,
} from './edicao-rota';
import { rotaNova } from '@/pages/motorista/ConstrutorRotaPage';
import { capacidadeAlunos, picoOcupacao, podeFinalizar, validarRota } from './ocupacao-rota';
import { planejarRotaDoCadastro } from './rota-para-motor';
import { pendenciasDeRevisao } from './cadastro-rota';
import { normalizarRotaParaSalvar, validarRotaParaSalvar } from '@/data/motorista-store';

/**
 * A SEQUÊNCIA DO CONSTRUTOR, de ponta a ponta, sobre as regras reais:
 * saída → aluno → outro aluno → escola → editar uma parada → concluir.
 */
let n = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const VAN: Veiculo = { id: '11111111-1111-4111-8111-111111111111', modelo: 'Van', lugaresPassageiro: 2, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };
const P = (lat: number, lng: number) => ({ lat, lng });
const nomes = (r: Rota) => [...r.paradas].sort((a, b) => a.ordem - b.ordem).map((p) => (p.tipo === 'casa' ? alunosDaCasa(r, p.id).map((x) => x.identificacao).join('+') : p.tipo));
const semAluno = { horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null, atendimentoMin: null, atendimentoOrigem: null };

function ateDoisAlunos(): Rota {
  let r: Rota = { ...rotaNova(), veiculoId: VAN.id, turno: 'manha', periodoConfirmado: true, saidaHabitualMin: 390 };
  r = definirSaida(r, { rotulo: 'Rua José Geraldo, 580', ponto: P(-21.2, -50.44) }, novoId);
  r = adicionarAluno(r, { nome: 'Ana', endereco: { rotulo: 'Rua das Flores, 120', ponto: P(-21.205, -50.435) }, escolaParadaId: null, ...semAluno, horarioHabitualMin: 400, atendimentoMin: 1, ajusteAntesMin: 10, ajusteDepoisMin: 10 }, novoId).rota;
  r = adicionarAluno(r, { nome: 'João', endereco: { rotulo: 'Rua dos Ipês, 355', ponto: P(-21.21, -50.43) }, escolaParadaId: null, ...semAluno, horarioHabitualMin: 415, atendimentoMin: 0.75, ajusteAntesMin: 0, ajusteDepoisMin: 0 }, novoId).rota;
  return r;
}
function comEscola(): { rota: Rota; escolaId: string } {
  const r = ateDoisAlunos();
  const e = adicionarEscola(r, { destinoId: 'esc-1', nome: 'Escola Um', pontoCatalogo: P(-21.215, -50.425), limiteChegadaMin: 425, liberacaoMin: null, atendimentoGrupoMin: null, descemIds: r.passageiros.map((x) => x.id) }, novoId);
  return { rota: e.rota, escolaId: e.paradaId };
}

describe('construtor de rotas — sequência completa (ida)', () => {
  it('saída é sempre a primeira parada; corrigir o endereço não cria outra', () => {
    let r = definirSaida(rotaNova(), { rotulo: 'Rua A, 1', ponto: P(-21.2, -50.4) }, novoId);
    r = definirSaida(r, { rotulo: 'Rua A, 10', ponto: P(-21.21, -50.41) }, novoId);
    expect(r.paradas).toHaveLength(1);
    expect(r.paradas[0]).toMatchObject({ tipo: 'saida', ordem: 0, rotulo: 'Rua A, 10', lat: -21.21, confirmado: true });
  });

  it('cada aluno confirmado vira uma parada com o compromisso DELE (tempos e tolerâncias diferentes)', () => {
    const r = ateDoisAlunos();
    expect(nomes(r)).toEqual(['saida', 'Ana', 'João']);
    const [ana, joao] = r.passageiros;
    expect(ana).toMatchObject({ horarioHabitualMin: 400, atendimentoMin: 1, ajusteAntesMin: 10, ajusteDepoisMin: 10, atendimentoOrigem: 'informado', desembarqueParadaId: null });
    expect(joao).toMatchObject({ horarioHabitualMin: 415, atendimentoMin: 0.75, ajusteAntesMin: 0, ajusteDepoisMin: 0 });
    // Sem escola ainda: as regras de sempre avisam que falta deixar os dois.
    expect(validarRota(r, VAN).filter((p) => p.tipo === 'a_bordo').map((p) => p.alunoId)).toEqual([ana.id, joao.id]);
  });

  it('a escola entra como parada do percurso, com limite de chegada, e quem está a bordo desce nela', () => {
    const { rota: r, escolaId } = comEscola();
    expect(nomes(r)).toEqual(['saida', 'Ana', 'João', 'escola']);
    expect(r.paradas.find((p) => p.id === escolaId)).toMatchObject({ tipo: 'escola', destinoId: 'esc-1', limiteChegadaMin: 425, portaoEspecifico: false });
    expect(r.passageiros.every((x) => x.desembarqueParadaId === escolaId && x.destinoId === 'esc-1')).toBe(true);
    expect(validarRota(r, VAN)).toEqual([]);
    expect(podeFinalizar(r, VAN)).toBe(true);
  });

  it('aluno esquecido entra ANTES da escola dele e já desce nela (sem ficar “a bordo”)', () => {
    const { rota, escolaId } = comEscola();
    const r = adicionarAluno(rota, { nome: 'Bia', endereco: { rotulo: 'Rua C, 9', ponto: P(-21.212, -50.428) }, escolaParadaId: escolaId, ...semAluno }, novoId).rota;
    expect(nomes(r)).toEqual(['saida', 'Ana', 'João', 'Bia', 'escola']);
    expect(r.passageiros.at(-1)).toMatchObject({ identificacao: 'Bia', desembarqueParadaId: escolaId, destinoId: 'esc-1', horarioHabitualMin: null, atendimentoMin: null });
    // Capacidade continua valendo: a van tem 2 lugares e agora são 3 a bordo.
    expect(picoOcupacao(r)).toBe(3);
    expect(capacidadeAlunos(r, VAN)).toBe(2);
    expect(validarRota(r, VAN).some((p) => p.tipo === 'capacidade')).toBe(true);
    expect(podeFinalizar(r, VAN)).toBe(false);
  });

  it('editar UMA parada não mexe nas outras', () => {
    const { rota } = comEscola();
    const [ana, joao] = rota.passageiros;
    const r = atualizarAluno(rota, ana.id, { horarioHabitualMin: 402, atendimentoMin: 2 }, novoId);
    expect(r.passageiros.find((x) => x.id === ana.id)).toMatchObject({ horarioHabitualMin: 402, atendimentoMin: 2, ajusteAntesMin: 10, ajusteDepoisMin: 10 });
    // A parada da Ana acompanha o horário dela; João, a escola e a saída ficam idênticos.
    expect(r.paradas.find((p) => p.id === ana.embarqueParadaId)!.horarioChegadaMin).toBe(402);
    expect(r.passageiros.find((x) => x.id === joao.id)).toEqual(joao);
    for (const p of rota.paradas.filter((x) => x.id !== ana.embarqueParadaId)) expect(r.paradas.find((x) => x.id === p.id)).toEqual(p);
  });

  it('corrigir o endereço de um aluno zera só os trechos vizinhos (o mapa recalcula) e mantém ids e vínculos', () => {
    let { rota } = comEscola();
    rota = { ...rota, paradas: rota.paradas.map((p) => ({ ...p, tempoAteProximaMin: p.tipo === 'escola' ? null : 5 })) };
    const joao = rota.passageiros[1];
    const r = atualizarAluno(rota, joao.id, { endereco: { rotulo: 'Rua dos Ipês, 400', ponto: P(-21.211, -50.431) } }, novoId);
    const ord = [...r.paradas].sort((a, b) => a.ordem - b.ordem);
    expect(ord.map((p) => p.tempoAteProximaMin)).toEqual([5, null, null, null]);
    expect(ord[2]).toMatchObject({ id: joao.embarqueParadaId, rotulo: 'Rua dos Ipês, 400', lat: -21.211 });
    expect(r.passageiros[1]).toMatchObject({ id: joao.id, embarqueParadaId: joao.embarqueParadaId, desembarqueParadaId: joao.desembarqueParadaId });
  });

  it('dois alunos na mesma casa: mudar o endereço de um dá a ele uma parada própria, sem levar o irmão', () => {
    const { rota, escolaId } = comEscola();
    const casaAna = rota.passageiros[0].embarqueParadaId!;
    let r = adicionarAluno(rota, { nome: 'Caio', endereco: { rotulo: '', ponto: null }, escolaParadaId: escolaId, naCasaId: casaAna, ...semAluno }, novoId).rota;
    expect(nomes(r)).toEqual(['saida', 'Ana+Caio', 'João', 'escola']);
    const caio = r.passageiros.at(-1)!;
    r = atualizarAluno(r, caio.id, { endereco: { rotulo: 'Rua Nova, 5', ponto: P(-21.206, -50.436) } }, novoId);
    expect(nomes(r)).toEqual(['saida', 'Ana', 'Caio', 'João', 'escola']);
    expect(r.paradas.find((p) => p.id === casaAna)).toMatchObject({ rotulo: 'Rua das Flores, 120' });
  });

  it('escola: portão marcado mantém a unidade; desmarcar quem desce devolve o aviso “falta deixar”', () => {
    const { rota, escolaId } = comEscola();
    const [ana, joao] = rota.passageiros;
    let r = atualizarEscola(rota, escolaId, { portao: P(-21.2151, -50.4252), atendimentoGrupoMin: 0.5, limiteChegadaMin: 420 });
    expect(r.paradas.find((p) => p.id === escolaId)).toMatchObject({ destinoId: 'esc-1', portaoEspecifico: true, lat: -21.2151, atendimentoGrupoMin: 0.5, limiteChegadaMin: 420 });
    r = atualizarEscola(r, escolaId, { portao: null, pontoCatalogo: P(-21.215, -50.425) });
    expect(r.paradas.find((p) => p.id === escolaId)).toMatchObject({ portaoEspecifico: false, lat: -21.215, atendimentoGrupoMin: 0.5 });
    r = atualizarEscola(r, escolaId, { descemIds: [ana.id] });
    expect(r.passageiros.find((x) => x.id === joao.id)).toMatchObject({ desembarqueParadaId: null, destinoId: null });
    expect(validarRota(r, VAN).map((p) => p.alunoId)).toEqual([joao.id]);
    expect(candidatosADescer(r, r.paradas.find((p) => p.id === escolaId)!.ordem, escolaId).map((x) => x.identificacao)).toEqual(['Ana', 'João']);
  });

  it('escola do percurso sai da lista de “aceito incluir”; as demais aceitas continuam fora das paradas', () => {
    const base = { ...ateDoisAlunos(), escolasDisponiveis: [{ id: 'a', destinoId: 'esc-1', dias: null }, { id: 'b', destinoId: 'esc-2', dias: null }], disponibilidadeRevisada: true };
    const r = adicionarEscola(base, { destinoId: 'esc-1', nome: 'Escola Um', pontoCatalogo: P(-21.215, -50.425), limiteChegadaMin: null, liberacaoMin: null, atendimentoGrupoMin: null, descemIds: [] }, novoId).rota;
    expect(r.escolasDisponiveis!.map((e) => e.destinoId)).toEqual(['esc-2']);
    expect(r.paradas.filter((p) => p.tipo === 'escola').map((p) => p.destinoId)).toEqual(['esc-1']);
  });

  it('mover e excluir seguem as regras de sempre', () => {
    const { rota, escolaId } = comEscola();
    const [ana, joao] = rota.passageiros;
    const saida = rota.paradas.find((p) => p.tipo === 'saida')!;
    expect(podeMover(rota, saida.id, 1)).toBe(false);
    expect(podeMover(rota, ana.embarqueParadaId!, -1)).toBe(false); // não passa à frente da saída
    const movida = moverParada(rota, joao.embarqueParadaId!, -1);
    expect(nomes(movida)).toEqual(['saida', 'João', 'Ana', 'escola']);
    expect(movida.paradas.every((p) => p.tempoAteProximaMin == null)).toBe(true);
    // Excluir a casa tira o aluno dela; excluir a escola deixa os alunos sem desembarque.
    expect(excluirParada(rota, ana.embarqueParadaId!).passageiros.map((x) => x.identificacao)).toEqual(['João']);
    const semEscola = excluirParada(rota, escolaId);
    expect(semEscola.passageiros.every((x) => x.desembarqueParadaId == null && x.destinoId == null)).toBe(true);
    expect(excluirParada(rota, saida.id)).toBe(rota);
    // Tirar um aluno leva junto a casa que ficou vazia — e só ela.
    expect(nomes(removerAlunoDaRota(rota, ana.id))).toEqual(['saida', 'João', 'escola']);
  });

  it('a rota montada pelo construtor passa pelo motor de horários e pela gravação, sem dados inventados', () => {
    let { rota } = comEscola();
    // O mapa informa os minutos de cada trecho; o motorista informa o limite do ponto final.
    rota = { ...rota, ultimoDesembarqueMin: 425, paradas: rota.paradas.map((p) => ({ ...p, tempoAteProximaMin: p.tipo === 'escola' ? null : 4 })) };
    const { plano } = planejarRotaDoCadastro(rota, VAN);
    expect(plano?.valido).toBe(true);
    // 3 trechos de 4 min + embarques de 1 min e 45 s + parada na escola (padrão provisório).
    expect(plano!.paradas.at(-1)!.chegada).toBeLessThanOrEqual(425);
    const pronta = normalizarRotaParaSalvar({ ...rota, status: 'concluida' });
    expect(validarRotaParaSalvar(pronta)).toBeNull();
    expect(pronta.passageiros.map((x) => [x.identificacao, x.atendimentoMin, x.ajusteAntesMin])).toEqual([['Ana', 1, 10], ['João', 0.75, 0]]);
    // O que não foi informado continua aparecendo como pendência (nada foi preenchido sozinho).
    const faltas = pendenciasDeRevisao(pronta).flatMap((p) => p.faltas);
    expect(faltas).toContain('tempo de atendimento do grupo');
    expect(faltas).toContain('quanto você autoriza antecipar a saída (0 se não autoriza)');
  });
});

describe('construtor de rotas — volta', () => {
  it('o aluno embarca na escola e desce em casa; a casa entra no fim do percurso', () => {
    let r: Rota = { ...rotaNova(), sentido: 'volta', veiculoId: VAN.id };
    r = definirSaida(r, { rotulo: 'Garagem', ponto: P(-21.2, -50.44) }, novoId);
    const e = adicionarEscola(r, { destinoId: 'esc-1', nome: 'Escola Um', pontoCatalogo: P(-21.215, -50.425), limiteChegadaMin: null, liberacaoMin: 720, atendimentoGrupoMin: 2, descemIds: ['ignorado-na-volta'] }, novoId);
    r = adicionarAluno(e.rota, { nome: 'Ana', endereco: { rotulo: 'Rua das Flores, 120', ponto: P(-21.205, -50.435) }, escolaParadaId: e.paradaId, ...semAluno, horarioHabitualMin: 735 }, novoId).rota;
    expect(nomes(r)).toEqual(['saida', 'escola', 'Ana']);
    expect(r.passageiros[0]).toMatchObject({ embarqueParadaId: e.paradaId, destinoId: 'esc-1', horarioHabitualMin: 735 });
    expect(r.passageiros[0].desembarqueParadaId).toBe(r.paradas.find((p) => p.tipo === 'casa')!.id);
    expect(r.paradas.find((p) => p.id === e.paradaId)).toMatchObject({ liberacaoMin: 720, atendimentoGrupoMin: 2 });
    expect(validarRota(r, VAN)).toEqual([]);
  });
});
