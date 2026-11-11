import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, School, Home, Clock, Users, Route as RouteIcon, ShieldCheck, AlertTriangle,
  ArrowRight, Lock,
} from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';
import type { Rota, Veiculo } from '@/types/motorista';
import type { PontoGeo, MatrizViaria } from '@/engine/encaixe-geografico';
import { CampoEndereco } from '@/components/search/CampoEndereco';
import { ENDERECO_VAZIO, type EnderecoCampo } from '@/lib/endereco';
import { MARGEM_OPERACIONAL_MIN, type ResultadoSimulacao } from '@/lib/rota-para-encaixe';
import {
  ancoraHorarioEscola, avaliarRotaDetalhada, pontosDoPedido,
  type AvaliacaoDetalhada, type PedidoFamilia,
} from '@/lib/busca-rotas-reais';
import { obterMatrizViaria, FalhaMatriz } from '@/lib/matriz-viaria';
import { useVitrine } from '@/data/VitrineProvider';
import { escolasSimulaveis, seloDoResultado } from '@/lib/simulador-encaixe';
import { minutosParaTextoHora, horaParaMinutos, TURNO_LABEL, cn } from '@/lib/utils';

export function SimuladorEncaixePage() {
  return (
    <ExigirMotorista>
      <Simulador />
    </ExigirMotorista>
  );
}

function Simulador() {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [rotaId, setRotaId] = useState('');
  const [nomeAluno, setNomeAluno] = useState('');
  // Casa do novo aluno: mesmo campo de endereço do resto do app. Só há ponto
  // (e só dá para simular) com o endereço localizado ou marcado no mapa.
  const [endereco, setEndereco] = useState<EnderecoCampo>(ENDERECO_VAZIO);
  const casa = useMemo<PontoGeo | null>(
    () => (endereco.coord && !endereco.validando
      ? { id: 'novo-aluno-casa', nome: endereco.texto.trim() || 'Casa do novo aluno', lat: endereco.coord.lat, lng: endereco.coord.lng }
      : null),
    [endereco],
  );
  const [escolaId, setEscolaId] = useState('');
  const [horario, setHorario] = useState('');
  const [simulando, setSimulando] = useState(false);
  // Abertura do portão (ida), opcional: chegando antes, a van espera.
  const [abertura, setAbertura] = useState('');
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<AvaliacaoDetalhada | null>(null);
  const { destinosPorId } = useVitrine();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [rs, vs] = await Promise.all([
        listarRotas().catch(() => [] as Rota[]),
        listarVeiculos().catch(() => [] as Veiculo[]),
      ]);
      if (!vivo) return;
      const concluidas = rs.filter((r) => r.status === 'concluida' || r.paradas.length >= 2);
      setRotas(concluidas);
      setVeiculos(vs);
      if (concluidas.length === 1) setRotaId(concluidas[0].id);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const rota = useMemo(() => rotas.find((r) => r.id === rotaId) ?? null, [rotas, rotaId]);
  const veiculo = useMemo(() => veiculos.find((v) => v.id === rota?.veiculoId) ?? null, [veiculos, rota]);
  const escolas = useMemo(() => (rota ? escolasSimulaveis(rota, (id) => destinosPorId[id]?.nome) : []), [rota, destinosPorId]);

  // Ao trocar de rota, ajusta a escola escolhida e limpa os horários do aluno.
  useEffect(() => {
    setResultado(null);
    setErro('');
    setHorario('');
    setAbertura('');
    if (!rota) return;
    setEscolaId(escolasSimulaveis(rota)[0]?.id ?? '');
  }, [rota]);

  const paraMin = (h: string) => (/^\d{1,2}:\d{2}$/.test(h) ? horaParaMinutos(h) : null);
  const horarioMin = paraMin(horario);
  const aberturaMin = paraMin(abertura);
  // O MESMO pedido que a família faria na busca: casa, escola, sentido da rota e
  // o horário do aluno (ida: prazo de chegada; volta: liberação). É ele que
  // garante o mesmo resultado nas duas telas.
  const pedido = useMemo<PedidoFamilia | null>(() => {
    if (!rota || !casa || !escolaId) return null;
    const catalogo = destinosPorId[escolaId];
    return {
      origem: { lat: casa.lat, lng: casa.lng }, destinoId: escolaId,
      escolaPonto: catalogo && catalogo.lat != null && catalogo.lng != null ? { lat: catalogo.lat, lng: catalogo.lng } : null,
      sentido: rota.sentido, turno: rota.turno, contratacao: 'mensal',
      horarioFamiliaMin: horarioMin, aberturaEscolaMin: rota.sentido === 'ida' ? aberturaMin : null,
    };
  }, [rota, casa, escolaId, destinosPorId, horarioMin, aberturaMin]);
  // Horário DA ESCOLA nesta rota (base do cálculo) — vem do cadastro, não do campo do aluno.
  const ancora = useMemo(() => (rota && escolaId
    ? ancoraHorarioEscola(rota, { origem: null, destinoId: escolaId, sentido: rota.sentido, turno: rota.turno, horarioFamiliaMin: horarioMin })
    : null), [rota, escolaId, horarioMin]);
  const horarioInvalido = horario !== '' && horarioMin == null;
  const prontoParaSimular = !!pedido && !horarioInvalido && nomeAluno.trim().length > 0;

  async function onSimular() {
    if (!rota || !pedido) return;
    setSimulando(true); setErro(''); setResultado(null);
    try {
      // Pontos reais -> matriz viária real (nunca linha reta).
      const { pontos, faltamCoordenadas } = pontosDoPedido(rota, pedido);
      if (faltamCoordenadas.length > 0) {
        setResultado(avaliarRotaDetalhada(rota, veiculo, pedido, vazia()));
        return;
      }
      let matriz: MatrizViaria;
      try {
        matriz = await obterMatrizViaria(pontos);
      } catch (e) {
        if (e instanceof FalhaMatriz) { setErro(mensagemFalhaMatriz(e)); return; }
        throw e;
      }
      setResultado(avaliarRotaDetalhada(rota, veiculo, pedido, matriz));
    } catch (e) {
      setErro('Não foi possível concluir a simulação: ' + (e as Error).message);
    } finally {
      setSimulando(false);
    }
  }

  if (carregando) {
    return (
      <MotoristaShell titulo="Simular novo aluno" voltarPara="/painel/rotas">
        <div className="flex justify-center py-20 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </MotoristaShell>
    );
  }

  if (rotas.length === 0) {
    return (
      <MotoristaShell titulo="Simular novo aluno" voltarPara="/painel/rotas">
        <div className="card p-8 text-center">
          <RouteIcon className="mx-auto h-10 w-10 text-navy-300" />
          <h2 className="mt-3 font-display text-lg font-bold">Você ainda não tem rotas</h2>
          <p className="mt-2 text-navy-600">Monte uma rota primeiro para poder simular a inclusão de um aluno.</p>
        </div>
      </MotoristaShell>
    );
  }

  return (
    <MotoristaShell titulo="Simular novo aluno" voltarPara="/painel/rotas">
      <p className="mb-4 text-sm text-navy-600">
        Veja se dá para incluir um novo aluno sem atrapalhar quem já está na rota. Nada é salvo nesta tela — é só um teste.
      </p>

      {/* 1. Rota */}
      <div className="card p-5">
        <label className="field-label">Qual das suas rotas você quer testar?</label>
        <select className="field-input appearance-none" value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
          <option value="">Escolha a rota…</option>
          {rotas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome || 'Rota'} — {r.sentido === 'ida' ? 'ida (leva à escola)' : 'volta (traz da escola)'}{r.turno ? ` · ${TURNO_LABEL[r.turno]}` : ''}
            </option>
          ))}
        </select>
        {rota && (
          <p className="mt-2 text-xs text-navy-500">
            {rota.sentido === 'ida' ? 'Esta rota leva os alunos até a escola.' : 'Esta rota traz os alunos da escola para casa.'}
            {' '}Para avaliar o outro sentido, selecione a rota correspondente.
          </p>
        )}
      </div>

      {rota && (
        <>
          {/* 2+3. Aluno e endereço */}
          <div className="card mt-4 p-5">
            <label className="field-label">Como identificar o novo aluno?</label>
            <input className="field-input" placeholder="Ex.: João, Duda…" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} />

            <label className="field-label mt-4">Endereço de casa do novo aluno</label>
            <CampoEndereco
              valor={endereco} placeholder="Rua e número — Araçatuba"
              onChange={(e) => { setEndereco(e); setResultado(null); }}
            />
          </div>

          {/* 4. Escola + turno/horário */}
          <div className="card mt-4 p-5">
            <label className="field-label">Para qual escola?</label>
            <select className="field-input appearance-none" value={escolaId} onChange={(e) => { setEscolaId(e.target.value); setResultado(null); }}>
              {escolas.length === 0 && <option value="">Esta rota não tem escola cadastrada</option>}
              {escolas.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.origem === 'aceita' ? ' — você aceita incluir (ainda sem parada)' : ''}</option>)}
            </select>
            {escolas.find((e) => e.id === escolaId)?.origem === 'aceita' && (
              <p className="mt-1 text-xs text-navy-500">Esta escola ainda não é parada da rota: a casa e a escola do aluno são calculadas juntas, como na busca das famílias.</p>
            )}
            {ancora && (
              <p className="mt-2 text-xs text-navy-500">
                {ancora.min == null ? 'Esta rota não tem horário para esta escola: o resultado ficará sem cálculo.'
                  : ancora.fonte === 'turno' ? `Sem horário cadastrado para esta escola: usamos o padrão do período (${minutosParaTextoHora(ancora.min)}) e o resultado fica sob confirmação.`
                  : ancora.fonte === 'familia' ? 'O motorista não informou horário para esta escola: vale o horário do aluno, abaixo.'
                  : rota.sentido === 'ida'
                    ? `Limite de chegada desta escola na rota: ${minutosParaTextoHora(ancora.min)} (a van é planejada para chegar ${MARGEM_OPERACIONAL_MIN} min antes).`
                    : `Saída desta escola na rota: a partir de ${minutosParaTextoHora(ancora.min)}.`}
              </p>
            )}

            <label className="field-label mt-4">
              {rota.sentido === 'ida' ? 'O aluno precisa chegar à escola até (opcional)' : 'O aluno está liberado na escola a partir de (opcional)'}
            </label>
            <input className="field-input" type="time" value={horario} onChange={(e) => { setHorario(e.target.value); setResultado(null); }} />
            <p className="mt-1 text-xs text-navy-500">
              {rota.sentido === 'ida'
                ? 'É o prazo do novo aluno. Não muda o horário da escola na rota: calculamos se dá para chegar até ele com os ajustes permitidos, sem prejudicar os atuais. Em branco = o horário da escola.'
                : 'A van não busca o novo aluno antes deste horário. Em branco = o horário de saída da escola na rota.'}
            </p>

            {rota.sentido === 'ida' && (
              <>
                <label className="field-label mt-4">A escola abre o portão às (opcional)</label>
                <input className="field-input" type="time" value={abertura} onChange={(e) => { setAbertura(e.target.value); setResultado(null); }} />
                <p className="mt-1 text-xs text-navy-500">Se a van chegar antes de a escola abrir, ela espera — e a entrega só conta a partir da abertura.</p>
              </>
            )}
          </div>

          <button className="btn btn-lg btn-primary mt-4 w-full" disabled={!prontoParaSimular || simulando} onClick={onSimular}>
            {simulando ? <><Loader2 className="h-5 w-5 animate-spin" /> Calculando com as ruas reais…</> : <>Simular inclusão <ArrowRight className="h-5 w-5" /></>}
          </button>
          {!prontoParaSimular && <p className="mt-2 text-center text-xs text-navy-400">Preencha o aluno, o endereço e a escola para simular.</p>}

          {erro && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{erro}
            </p>
          )}

          {resultado && <ResultadoEncaixe avaliacao={resultado} nomeAluno={nomeAluno.trim()} sentido={rota.sentido} />}
        </>
      )}
    </MotoristaShell>
  );
}

const vazia = (): MatrizViaria => ({ origem: 'fixture-testada', obter: () => null });

function mensagemFalhaMatriz(e: FalhaMatriz): string {
  if (e.codigo === 'sem_sessao') return 'Entre na sua conta de motorista (com Supabase ativo) para calcular trajetos reais.';
  if (e.codigo === 'muitos_pontos') return 'Esta rota tem endereços demais para o cálculo automático: a avaliação não foi feita (isso não significa que o aluno não cabe).';
  return 'Não foi possível calcular os trajetos pelas ruas agora: a avaliação não foi feita (isso não significa que o aluno não cabe). Tente novamente em instantes.';
}

/* ------------------------------- resultado ------------------------------- */
function ResultadoEncaixe({ avaliacao, nomeAluno, sentido }: { avaliacao: AvaliacaoDetalhada; nomeAluno: string; sentido: 'ida' | 'volta' }) {
  const publico = avaliacao.publico;
  const selo = seloDoResultado(publico);
  const resultado: ResultadoSimulacao | null = avaliacao.simulacao;
  const cabecalho = (
    <div className={cn('flex items-center gap-3 p-5', selo.tom === 'ok' ? 'bg-mint-50 text-mint-900' : selo.tom === 'atencao' ? 'bg-amber-50 text-amber-900' : 'bg-navy-50 text-navy-900')}>
      {selo.tom === 'ok' ? <ShieldCheck className="h-7 w-7 shrink-0" /> : <AlertTriangle className="h-7 w-7 shrink-0" />}
      <div>
        <h2 className="font-display text-lg font-extrabold">{selo.titulo}{publico.status === 'compativel' || publico.status === 'sob_confirmacao' ? ` — ${nomeAluno || 'o aluno'}` : ''}</h2>
        <p className="text-sm">{selo.subtitulo}</p>
        <p className="mt-1 text-xs opacity-80">É o mesmo resultado que a família recebe na busca para este pedido.</p>
      </div>
    </div>
  );
  if (!resultado || !resultado.elegivel || !resultado.opcao) {
    return (
      <section className="card mt-5 overflow-hidden">
        {cabecalho}
        <div className="p-5">
          <ul className="space-y-2">
            {(resultado?.motivos.length ? resultado.motivos : [publico.motivo]).map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-navy-700">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{m}
              </li>
            ))}
          </ul>
          <Explicacao linhas={resultado?.explicacao} />
          <ConfirmacaoBloqueada elegivel={false} />
        </div>
      </section>
    );
  }

  const o = resultado.opcao;
  const nome = (id: string) => resultado.nomePorCompromisso[id] ?? 'Aluno';
  const alteracoesReais = o.alteracoes.filter((a) => a.diferencaMin !== 0);
  const horaBusca = minutosParaTextoHora(o.horarioBuscaMin);
  const horaEntrega = minutosParaTextoHora(o.horarioEntregaMin);

  return (
    <section className="card mt-5 overflow-hidden">
      {cabecalho}

      <div className="space-y-5 p-5">
        {resultado.classe && resultado.classe !== 'imediato' && (
          <p className={resultado.classe === 'pre_autorizado' ? 'rounded-xl bg-mint-50 p-3 text-sm text-mint-900' : 'rounded-xl bg-amber-50 p-3 text-sm text-amber-900'}>
            {resultado.classe === 'pre_autorizado'
              ? `Exige sair ${resultado.antecipacaoMin} min mais cedo — dentro da antecipação que você já cadastrou para esta rota.`
              : (resultado.antecipacaoMin ?? 0) > 0
                ? `Só cabe se você sair ${resultado.antecipacaoMin} min mais cedo, além do limite de antecipação cadastrado. A decisão é sua.`
                : 'Depende da sua aprovação. A decisão é sua.'}
          </p>
        )}
        {resultado.aprovacoes.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{resultado.aprovacoes.map((a, i) => <li key={i}>{a}</li>)}</ul>
        )}
        {resultado.vagasNoTrecho != null && (
          <p className="text-sm text-navy-600">{resultado.vagasNoTrecho} {resultado.vagasNoTrecho === 1 ? 'lugar livre' : 'lugares livres'} no trecho que o novo aluno ocupa (antes de incluí-lo).</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Metrica rotulo={sentido === 'ida' ? 'Busca em casa' : 'Busca na escola'} valor={horaBusca} icon={sentido === 'ida' ? Home : School} />
          <Metrica rotulo={sentido === 'ida' ? 'Chegada à escola' : 'Chegada em casa'} valor={horaEntrega} icon={sentido === 'ida' ? School : Home} />
          <Metrica rotulo="Tempo dentro da van" valor={`${Math.round(o.minutosABordo * 10) / 10} min`} icon={Clock} />
          <Metrica rotulo="Tempo a mais no percurso" valor={`${Math.round(o.desvioMin * 10) / 10} min`} icon={ArrowRight} />
        </div>

        {/* Alterações de horário dos alunos existentes */}
        <div>
          <h3 className="flex items-center gap-2 font-bold text-navy-800"><Users className="h-4 w-4" /> O que muda para quem já está na rota</h3>
          {alteracoesReais.length === 0 ? (
            <p className="mt-2 text-sm text-navy-600">Ninguém tem o horário alterado.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {alteracoesReais.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2">
                  <span className="text-navy-700">{nome(a.id)}</span>
                  <span className="text-navy-500">
                    {minutosParaTextoHora(a.antesMin)} → <strong className="text-navy-800">{minutosParaTextoHora(a.depoisMin)}</strong>
                    {' '}({a.diferencaMin > 0 ? '+' : ''}{Math.round(a.diferencaMin * 10) / 10} min)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ocupação por trecho */}
        <div>
          <h3 className="flex items-center gap-2 font-bold text-navy-800"><Users className="h-4 w-4" /> Como fica a van em cada parada</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {o.eventos.map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2">
                <span className="truncate text-navy-700">
                  {minutosParaTextoHora(e.chegadaMin)} · {e.compromisso.ponto.nome}
                  {' '}<span className="text-navy-400">({e.compromisso.tipo === 'embarque' ? 'embarca' : e.compromisso.tipo === 'desembarque' ? 'desce' : 'escola'})</span>
                </span>
                <span className="shrink-0 font-medium text-navy-800">{e.ocupacaoApos} a bordo</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-navy-100 p-4 text-sm">
          <div><p className="text-navy-500">Distância a mais</p><strong>{(o.desvioMetros / 1000).toFixed(1)} km</strong></div>
          <div><p className="text-navy-500">Distância do aluno na van</p><strong>{(o.distanciaABordoMetros / 1000).toFixed(1)} km</strong></div>
        </div>

        <Explicacao linhas={resultado.explicacao} />

        <p className="text-xs text-navy-500">
          Cálculo feito sobre os trajetos reais das ruas (estimativa, não garantia de trânsito). Esta simulação não reserva vaga nem matricula o aluno.
        </p>

        <ConfirmacaoBloqueada elegivel />
      </div>
    </section>
  );
}

/** Confirmação definitiva: mantida DESABILITADA até existir a gravação atômica
 *  no banco (migração fornecida, a ser revisada e aplicada pelo responsável). */
function ConfirmacaoBloqueada({ elegivel }: { elegivel: boolean }) {
  return (
    <div className="mt-5 rounded-xl border border-navy-200 bg-navy-50 p-4">
      <button type="button" disabled className="btn btn-lg w-full cursor-not-allowed bg-navy-200 text-navy-500" aria-disabled>
        <Lock className="h-5 w-5" /> Confirmar inclusão
      </button>
      <p className="mt-2 text-xs text-navy-500">
        {elegivel
          ? 'A confirmação definitiva ainda está desativada. Ela depende de uma gravação transacional no banco (migração já incluída no projeto) que precisa ser revisada e aplicada com segurança antes de liberar a reserva de vaga.'
          : 'Uma simulação inviável nunca pode ser confirmada.'}
      </p>
    </div>
  );
}

function Explicacao({ linhas }: { linhas?: string[] }) {
  if (!linhas?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-navy-100 p-4">
      <h3 className="text-sm font-bold text-navy-800">Por que este resultado</h3>
      <ul className="mt-2 space-y-1 text-sm text-navy-600">
        {linhas.map((l, i) => <li key={i}>• {l}</li>)}
      </ul>
    </div>
  );
}

function Metrica({ rotulo, valor, icon: Icon }: { rotulo: string; valor: string; icon: typeof Home }) {
  return (
    <div className="rounded-2xl bg-navy-50 p-4">
      <div className="flex items-center gap-2 text-xs text-navy-500"><Icon className="h-4 w-4" />{rotulo}</div>
      <p className="mt-1 font-display text-xl font-extrabold text-navy-900">{valor}</p>
    </div>
  );
}
