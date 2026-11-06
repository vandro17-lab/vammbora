import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Loader2, MapPin, Home, School, Plus, Check, X, ArrowUp, ArrowDown, Trash2, Users, Flag, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarVeiculos, obterRota, salvarRota, novoId } from '@/data/motorista-store';
import type { Rota, Veiculo, ParadaRota, TipoParada } from '@/types/motorista';
import type { Turno } from '@/types';
import { useVitrine } from '@/data/VitrineProvider';
import { capacidadeAlunos, aBordoEm, estadoDaVanPorTrecho, validarRota, podeFinalizar } from '@/lib/ocupacao-rota';
import { embarcarAluno, desembarcarAlunos } from '@/lib/montagem-rota';
import { PlanoMotor } from '@/components/motorista/PlanoMotor';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { SeletorPontoMapa } from '@/components/motorista/SeletorPontoMapa';
import { AutocompleteEndereco } from '@/components/search/AutocompleteEndereco';
import { locaisDeDestinos, geocodificarPreciso, reverseGeocodificar, type SugestaoEndereco, type Precisao } from '@/lib/geocode';
import { TURNO_LABEL, cn, minutosParaTextoHora, horaParaMinutos, nomeDestinoParaExibicao } from '@/lib/utils';

const DIAS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex']] as const;
const TURNOS: Turno[] = ['manha', 'tarde', 'noite', 'integral'];

export function rotaNova(): Rota {
  return {
    id: '', nome: '', sentido: 'ida', turno: 'manha', dias: ['seg', 'ter', 'qua', 'qui', 'sex'],
    veiculoId: null, monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: null, limiteAntecipacaoMin: null, status: 'rascunho',
    paradas: [], passageiros: [], atualizadoEm: new Date().toISOString(),
  };
}

export function RotaBuilderPage() {
  return (
    <ExigirMotorista>
      <Builder />
    </ExigirMotorista>
  );
}

function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { destinos } = useVitrine();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rota, setRota] = useState<Rota>(rotaNova());
  const [etapa, setEtapa] = useState<'preparacao' | 'construindo' | 'horarios'>('preparacao');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Parada em foco: coordena a representação da van e o destaque no mapa (3.2/3.4).
  const [paradaSel, setParadaSel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Van recebida do fluxo guiado VM (handoff), reaproveitada sem persistir aqui.
      const vanRecebida = (location.state as { veiculo?: Veiculo } | null)?.veiculo ?? null;
      const vs = await listarVeiculos().catch(() => [] as Veiculo[]);
      const lista = vanRecebida && !vs.some((v) => v.id === vanRecebida.id) ? [vanRecebida, ...vs] : vs;
      let r = rotaNova();
      if (id && id !== 'nova') {
        const existente = await obterRota(id).catch(() => null);
        if (existente) r = existente;
      }
      if (!r.veiculoId) r.veiculoId = vanRecebida?.id ?? (lista.length === 1 ? lista[0].id : null);
      if (vivo) {
        setVeiculos(lista);
        setRota(r);
        setEtapa(r.paradas.length > 0 ? 'construindo' : 'preparacao');
        setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  const veiculo = useMemo(() => veiculos.find((v) => v.id === rota.veiculoId) ?? null, [veiculos, rota.veiculoId]);
  const capacidade = capacidadeAlunos(rota, veiculo);
  const problemas = validarRota(rota, veiculo);
  const ultimaOrdem = rota.paradas.reduce((m, p) => Math.max(m, p.ordem), -1);
  const aBordoFinal = ultimaOrdem >= 0 ? aBordoEm(rota, ultimaOrdem) : [];
  const locaisBusca = useMemo(() => locaisDeDestinos(destinos), [destinos]);

  // Preenche os minutos de cada trecho a partir do trajeto real do mapa (OSRM),
  // só quando todas as paradas estão localizadas. Guardado contra laços.
  const aplicarTempos = useCallback((temposMin: number[]) => {
    setRota((prev) => {
      const ordenadas = [...prev.paradas].sort((a, b) => a.ordem - b.ordem);
      if (ordenadas.length !== temposMin.length + 1) return prev;
      let mudou = false;
      const novas = ordenadas.map((p, i) => {
        const t = i < temposMin.length ? temposMin[i] : null;
        if (p.tempoAteProximaMin !== t) mudou = true;
        return { ...p, tempoAteProximaMin: t };
      });
      return mudou ? { ...prev, paradas: novas } : prev;
    });
  }, []);

  async function salvar(status: Rota['status'], rotaAtualizada: Rota = rota) {
    setSalvando(true);
    setAviso(null);
    try {
      const nome = rotaAtualizada.nome || `Rota ${rotaAtualizada.sentido === 'ida' ? 'de ida' : 'de volta'}`;
      const salva = await salvarRota({ ...rotaAtualizada, nome, status });
      setRota(salva);
      if (status === 'concluida') {
        navigate('/painel/rotas');
      } else {
        setAviso('Rascunho salvo. Você pode continuar depois.');
      }
    } catch (e) {
      setAviso('Não foi possível salvar: ' + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <MotoristaShell titulo="Criar rota" voltarPara="/painel/rotas">
        <div className="flex justify-center py-20 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </MotoristaShell>
    );
  }

  if (!veiculo && veiculos.length === 0) {
    return (
      <MotoristaShell titulo="Criar rota" voltarPara="/painel/rotas">
        <div className="card p-8 text-center">
          <School className="mx-auto h-10 w-10 text-navy-300" />
          <h2 className="mt-3 font-display text-lg font-bold">Cadastre sua van primeiro</h2>
          <p className="mt-2 text-navy-600">Para montar a rota, precisamos saber quantos lugares sua van tem.</p>
          <button className="btn btn-lg btn-primary mt-5" onClick={() => navigate('/painel/veiculos')}>Cadastrar van</button>
        </div>
      </MotoristaShell>
    );
  }

  return (
    <MotoristaShell titulo="Criar rota" voltarPara="/painel/rotas">
      {aviso && <p className="mb-4 rounded-xl bg-mint-50 p-3 text-sm text-mint-800">{aviso}</p>}

      {etapa === 'preparacao' ? (
        <Preparacao rota={rota} setRota={setRota} veiculos={veiculos} veiculo={veiculo} capacidade={capacidade}
          onComecar={() => setEtapa('construindo')} />
      ) : (
        <>
          {/* Van + ocupação por trecho (coordenada com o mapa) */}
          <VanViz capacidade={capacidade} rota={rota} veiculo={veiculo}
            paradaSelecionadaId={paradaSel} onSelecionarParada={setParadaSel} />

          {/* Linha do percurso */}
          <LinhaPercurso rota={rota} setRota={setRota} paradaSelecionadaId={paradaSel} onSelecionarParada={setParadaSel} />

          {/* Mapa interativo: carrega sozinho e desenha o trajeto pelas ruas. */}
          {rota.paradas.length > 0 && <MapaInterativoRota paradas={rota.paradas} onTempos={aplicarTempos} destacarParadaId={paradaSel} />}

          {/* Motor real: horários da viagem (quando há paradas suficientes) */}
          {rota.paradas.length >= 2 && <PlanoMotor rota={rota} setRota={setRota} veiculo={veiculo} />}

          {/* Ação */}
          {etapa === 'construindo' && (
            <AcaoParada rota={rota} setRota={setRota} destinos={destinos} locais={locaisBusca} aBordo={aBordoFinal} capacidade={capacidade} />
          )}

          {etapa === 'horarios' && (
            <Horarios rota={rota} setRota={setRota} onConfirmar={(atualizada) => salvar('concluida', atualizada)} salvando={salvando} />
          )}

          {/* Rodapé de ações */}
          {etapa === 'construindo' && (
            <div className="mt-6 space-y-3">
              {problemas.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  {problemas.slice(0, 3).map((p, i) => (
                    <p key={i} className="inline-flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {p.mensagem}</p>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-lg btn-primary flex-1" disabled={!podeFinalizar(rota, veiculo)} onClick={() => setEtapa('horarios')}>
                  <Flag className="h-5 w-5" /> Finalizar rota
                </button>
                <button className="btn btn-lg btn-ghost" onClick={() => salvar('rascunho')} disabled={salvando}>
                  {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar e continuar depois'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </MotoristaShell>
  );
}

/* ----------------------------- Preparação ----------------------------- */
function Preparacao({ rota, setRota, veiculos, veiculo, capacidade, onComecar }: {
  rota: Rota; setRota: (r: Rota) => void; veiculos: Veiculo[]; veiculo: Veiculo | null; capacidade: number; onComecar: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="font-display text-lg font-bold">Vamos preparar sua rota</h2>
        <p className="mt-1 text-sm text-navy-600">Poucas perguntas antes de montar o percurso.</p>

        {veiculos.length > 1 && (
          <div className="mt-4">
            <p className="field-label">Qual van vai nesta rota?</p>
            <div className="flex flex-wrap gap-2">
              {veiculos.map((v) => (
                <Chip key={v.id} ativo={rota.veiculoId === v.id} onClick={() => setRota({ ...rota, veiculoId: v.id })}>
                  {v.modelo || 'Van'} ({v.lugaresPassageiro})
                </Chip>
              ))}
            </div>
          </div>
        )}

        {veiculo && (
          <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-700">
            Sua van tem <strong>{veiculo.lugaresPassageiro}</strong> lugares para passageiros.
          </p>
        )}

        <div className="mt-4">
          <p className="field-label">Vai um monitor nesta rota?</p>
          <div className="flex gap-2">
            <Chip ativo={rota.monitor} onClick={() => setRota({ ...rota, monitor: true })}>Sim</Chip>
            <Chip ativo={!rota.monitor} onClick={() => setRota({ ...rota, monitor: false, monitorOcupaLugar: false })}>Não</Chip>
          </div>
        </div>
        {rota.monitor && (
          <div className="mt-3">
            <p className="field-label">O monitor ocupa um dos lugares?</p>
            <div className="flex gap-2">
              <Chip ativo={rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: true })}>Sim</Chip>
              <Chip ativo={!rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: false })}>Não</Chip>
            </div>
          </div>
        )}
        {veiculo && (
          <p className="mt-3 text-sm text-navy-500">Lugares para alunos: <strong>{capacidade}</strong></p>
        )}
      </div>

      <div className="card p-5">
        <p className="field-label">Sentido</p>
        <div className="flex gap-2">
          <Chip ativo={rota.sentido === 'ida'} onClick={() => setRota({ ...rota, sentido: 'ida' })}>Ida (leva à escola)</Chip>
          <Chip ativo={rota.sentido === 'volta'} onClick={() => setRota({ ...rota, sentido: 'volta' })}>Volta (traz da escola)</Chip>
        </div>
        <p className="field-label mt-4">Período</p>
        <div className="flex flex-wrap gap-2">
          {TURNOS.map((t) => <Chip key={t} ativo={rota.turno === t} onClick={() => setRota({ ...rota, turno: t })}>{TURNO_LABEL[t]}</Chip>)}
        </div>
        <p className="field-label mt-4">Dias</p>
        <div className="flex flex-wrap gap-2">
          {DIAS.map(([k, label]) => (
            <Chip key={k} ativo={rota.dias.includes(k)} onClick={() => setRota({ ...rota, dias: rota.dias.includes(k) ? rota.dias.filter((d) => d !== k) : [...rota.dias, k] })}>{label}</Chip>
          ))}
        </div>
        <div className="mt-4">
          <label className="field-label">Nome da rota (pode mudar depois)</label>
          <input className="field-input" placeholder={`Rota ${rota.sentido === 'ida' ? 'de ida' : 'de volta'}`} value={rota.nome} onChange={(e) => setRota({ ...rota, nome: e.target.value })} />
        </div>
      </div>

      <button className="btn btn-lg btn-primary w-full" disabled={!veiculo} onClick={onComecar}>Começar a montar</button>
    </div>
  );
}

/* ----------------------------- Van visual ----------------------------- */
/** Primeiro nome/apelido curto para caber no assento (identificação acessível, não documento). */
function nomeAssento(s: string): string {
  const first = (s.trim().split(/\s+/)[0] || s).trim();
  return first.length > 7 ? first.slice(0, 6) + '…' : first;
}

/** Rótulo curto de uma parada, para o seletor de trecho. */
function rotuloParada(p: ParadaRota): string {
  if (p.tipo === 'saida') return 'Saída';
  if (p.tipo === 'escola') return p.destinoNome || 'Escola';
  return p.rotulo?.split(',')[0] || 'Casa';
}

/**
 * Representação da van coordenada com o mapa. Mostra a ocupação REAL no trecho
 * logo após a parada em foco (vinda de `estadoDaVanPorTrecho`), com os nomes de
 * quem está a bordo, o lugar do monitor e os lugares reservados. O motorista
 * escolhe o trecho; a mesma parada é destacada no mapa.
 */
export function VanViz({ capacidade, rota, veiculo, paradaSelecionadaId, onSelecionarParada }: {
  capacidade: number; rota: Rota; veiculo: Veiculo | null;
  paradaSelecionadaId?: string | null; onSelecionarParada?: (id: string) => void;
}) {
  const estados = estadoDaVanPorTrecho(rota, veiculo);
  const paradas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  // Trecho em foco: o escolhido, senão o último (visão do fim da rota).
  const sel = estados.find((e) => e.paradaId === paradaSelecionadaId) ?? estados[estados.length - 1] ?? null;
  const paradaSel = paradas.find((p) => p.id === sel?.paradaId) ?? null;
  const aBordoPax = sel?.passageiros ?? [];
  const aBordo = aBordoPax.length;
  const livres = sel ? sel.livres : capacidade;
  const excedeu = sel?.excedeuCapacidade ?? false;
  const monitorSeat = rota.monitor && rota.monitorOcupaLugar ? 1 : 0;
  const reservados = Math.max(0, rota.lugaresReservados);
  const livresRender = Math.max(0, capacidade - aBordo);

  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-bold">Sua van</h2>
        <span className="truncate text-xs text-navy-500">{veiculo?.modelo || 'Van'} · {capacidade} p/ alunos</span>
      </div>

      {/* Seletor de trecho — coordena van e mapa */}
      {paradas.length > 1 && (
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Ver ocupação por parada">
          {paradas.map((p, i) => {
            const on = p.id === sel?.paradaId;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={on}
                onClick={() => onSelecionarParada?.(p.id)}
                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  on ? 'bg-navy-900 text-white shadow-card' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100 hover:bg-navy-100')}>
                <span className={cn('grid h-4 w-4 place-items-center rounded-full text-[10px]', on ? 'bg-white/25' : 'bg-navy-200 text-navy-700')}>{i}</span>
                {rotuloParada(p)}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-navy-900 p-4">
        {paradaSel && (
          <p className="mb-3 text-xs font-medium text-white/70">
            {paradaSel.tipo === 'saida' ? 'Na saída' : <>Depois de <span className="text-white">{rotuloParada(paradaSel)}</span></>}
          </p>
        )}
        {/* assentos: ocupados (com nome), livres, reservados e monitor */}
        <div className="flex flex-wrap gap-2" aria-label={`${aBordo} de ${capacidade} lugares de aluno ocupados neste trecho`}>
          {aBordoPax.map((pax) => (
            <span key={pax.id} title={pax.identificacao}
              className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg bg-mint-400 px-1.5 text-[10px] font-bold leading-none text-navy-900">
              {nomeAssento(pax.identificacao)}
            </span>
          ))}
          {Array.from({ length: livresRender }).map((_, i) => (
            <span key={`livre-${i}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/30 ring-1 ring-white/10" aria-label="Lugar livre" />
          ))}
          {Array.from({ length: reservados }).map((_, i) => (
            <span key={`res-${i}`} title="Lugar reservado"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[9px] font-bold text-white/50 ring-1 ring-dashed ring-white/25">RES</span>
          ))}
          {monitorSeat > 0 && (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300 text-[10px] font-bold text-navy-900" title="Lugar do monitor">MON</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-mint-300"><Users className="h-4 w-4" /> {aBordo} a bordo</span>
          <span className={cn(excedeu ? 'font-semibold text-red-300' : 'text-white/70')}>
            {excedeu ? `${aBordo - capacidade} além da capacidade` : `${livres} livre(s) neste trecho`}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy-400">A ocupação é por trecho: toque em uma parada para ver quem está a bordo ali. Lugares livres em um trecho não são "vagas" do percurso todo.</p>
    </div>
  );
}

/* ----------------------------- Linha do percurso ----------------------------- */
export function LinhaPercurso({ rota, setRota, paradaSelecionadaId, onSelecionarParada }: {
  rota: Rota; setRota: (r: Rota) => void;
  paradaSelecionadaId?: string | null; onSelecionarParada?: (id: string) => void;
}) {
  if (rota.paradas.length === 0) return null;
  const paradas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);

  function mover(ordem: number, delta: number) {
    const arr = [...paradas];
    const i = arr.findIndex((p) => p.ordem === ordem);
    const j = i + delta;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setRota({ ...rota, paradas: arr.map((p, idx) => ({ ...p, ordem: idx })) });
  }
  function excluir(id: string) {
    const nova = paradas.filter((p) => p.id !== id).map((p, idx) => ({ ...p, ordem: idx }));
    const pax = rota.passageiros.filter((p) => p.embarqueParadaId !== id).map((p) => (p.desembarqueParadaId === id ? { ...p, desembarqueParadaId: null, destinoId: null } : p));
    setRota({ ...rota, paradas: nova, passageiros: pax });
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Percurso</h2>
      <ol className="mt-3 space-y-2">
        {paradas.map((p, idx) => {
          const embarcam = rota.passageiros.filter((x) => x.embarqueParadaId === p.id);
          const descem = rota.passageiros.filter((x) => x.desembarqueParadaId === p.id);
          const selecionada = p.id === paradaSelecionadaId;
          return (
            <li key={p.id} className={cn('flex items-center gap-3 rounded-xl p-3 transition', selecionada ? 'bg-navy-900/5 ring-2 ring-navy-900/20' : 'bg-navy-50')}>
              <button type="button" aria-label={`Ver ocupação depois de ${rotuloParada(p)}`} aria-pressed={selecionada}
                onClick={() => onSelecionarParada?.(p.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{idx}</button>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy-700 ring-1 ring-navy-100">
                {p.tipo === 'saida' ? <MapPin className="h-4 w-4" /> : p.tipo === 'escola' ? <School className="h-4 w-4" /> : <Home className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelecionarParada?.(p.id)}>
                <p className="truncate text-sm font-semibold text-navy-900">
                  {p.tipo === 'saida' ? 'Saída' : p.tipo === 'escola' ? (p.destinoNome || 'Escola') : (p.rotulo || 'Casa')}
                </p>
                <p className="truncate text-xs text-navy-500">
                  {embarcam.length > 0 && `Embarca: ${embarcam.map((x) => x.identificacao).join(', ')}`}
                  {embarcam.length > 0 && descem.length > 0 && ' · '}
                  {descem.length > 0 && `Desce: ${descem.map((x) => x.identificacao).join(', ')}`}
                  {embarcam.length === 0 && descem.length === 0 && (p.confirmado ? 'Confirmada' : 'Sem confirmação')}
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-navy-600" onClick={(e) => e.stopPropagation()}>
                  <span className="shrink-0">Chegada habitual</span>
                  <input type="time" aria-label={`Horário habitual de chegada: ${p.rotulo}`}
                    className="field-input !py-1.5 text-sm w-full min-w-0 max-w-[8rem]"
                    value={p.horarioChegadaMin == null ? '' : `${String(Math.floor(p.horarioChegadaMin / 60)).padStart(2, '0')}:${String(p.horarioChegadaMin % 60).padStart(2, '0')}`}
                    onChange={(e) => {
                      const valor = e.target.value;
                      const minutos = /^([01]\\d|2[0-3]):[0-5]\\d$/.test(valor) ? horaParaMinutos(valor) : null;
                      setRota({ ...rota,
                        paradas: rota.paradas.map((s) => s.id === p.id ? { ...s, horarioChegadaMin: minutos } : s),
                        passageiros: rota.passageiros.map((aluno) =>
                          p.tipo === 'casa' && (rota.sentido === 'ida' ? aluno.embarqueParadaId === p.id : aluno.desembarqueParadaId === p.id)
                            ? { ...aluno, horarioHabitualMin: minutos } : aluno),
                      });
                    }} />
                </label>
              </div>
              {p.tipo !== 'saida' && (
                <div className="flex shrink-0 items-center gap-1">
                  <button className="btn btn-sm btn-ghost !px-2" aria-label="Subir" onClick={() => mover(p.ordem, -1)}><ArrowUp className="h-4 w-4" /></button>
                  <button className="btn btn-sm btn-ghost !px-2" aria-label="Descer" onClick={() => mover(p.ordem, 1)}><ArrowDown className="h-4 w-4" /></button>
                  <button className="btn btn-sm btn-ghost !px-2 text-red-600" aria-label="Excluir" onClick={() => excluir(p.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------- Ação: adicionar parada ----------------------------- */
export function AcaoParada({ rota, setRota, destinos, locais, aBordo, capacidade }: {
  rota: Rota; setRota: (r: Rota) => void;
  destinos: { id: string; nome: string; bairro: string; lat?: number | null; lng?: number | null }[];
  locais: SugestaoEndereco[];
  aBordo: { id: string; identificacao: string }[]; capacidade: number;
}) {
  const [modo, setModo] = useState<null | TipoParada>(null);
  const temSaida = rota.paradas.some((p) => p.tipo === 'saida');

  function proxOrdem() { return rota.paradas.reduce((m, p) => Math.max(m, p.ordem), -1) + 1; }

  function addSaida(rotulo: string, coord?: { lat: number; lng: number }) {
    const parada: ParadaRota = { id: novoId(), ordem: 0, tipo: 'saida', rotulo, confirmado: true, lat: coord?.lat, lng: coord?.lng };
    setRota({ ...rota, paradas: [parada, ...rota.paradas.map((p) => ({ ...p, ordem: p.ordem + 1 }))] });
    setModo(null);
  }

  if (!temSaida) {
    return <FormEndereco titulo="De onde sua van sai?" dica="Esse endereço fica privado, mesmo que seja sua casa." botao="Confirmar saída" locais={locais} onConfirmar={addSaida} onCancelar={null} />;
  }

  if (modo === 'casa') {
    return <FormCasa rota={rota} setRota={setRota} locais={locais} proxOrdem={proxOrdem()} capacidade={capacidade} aBordo={aBordo} onFechar={() => setModo(null)} />;
  }
  if (modo === 'escola') {
    return <FormEscola rota={rota} setRota={setRota} destinos={destinos} proxOrdem={proxOrdem()} capacidade={capacidade} aBordo={aBordo} onFechar={() => setModo(null)} />;
  }

  const volta = rota.sentido === 'volta';
  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Adicionar próxima parada</h2>
      <p className="mt-1 text-xs text-navy-500">
        {volta ? 'Na volta, a van pega os alunos na escola e deixa cada um em casa.' : 'Na ida, a van pega os alunos em casa e deixa na escola.'}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button className="card card-interactive flex flex-col items-center gap-2 p-5 text-center" onClick={() => setModo('casa')}>
          <Home className="h-7 w-7 text-mint-600" />
          <span className="font-semibold text-navy-900">{volta ? 'Casa (deixa aluno)' : 'Casa de aluno'}</span>
        </button>
        <button className="card card-interactive flex flex-col items-center gap-2 p-5 text-center" onClick={() => setModo('escola')}>
          <School className="h-7 w-7 text-navy-700" />
          <span className="font-semibold text-navy-900">{volta ? 'Escola (pega alunos)' : 'Escola'}</span>
        </button>
      </div>
    </div>
  );
}

/* Formulário de endereço com autocomplete + número que GEOCODIFICA com precisão
 * (respeita o número da casa) e deixa o motorista arrastar o alfinete no mapa. */
function FormEndereco({ titulo, dica, botao, locais, onConfirmar, onCancelar }: {
  titulo: string; dica?: string; botao: string; locais: SugestaoEndereco[];
  onConfirmar: (rotulo: string, coord?: { lat: number; lng: number }) => void;
  onCancelar: (() => void) | null;
}) {
  const [texto, setTexto] = useState('');
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [precisao, setPrecisao] = useState<Precisao | undefined>(undefined);
  const [buscandoExato, setBuscandoExato] = useState(false);
  const [enderecoNoMapa, setEnderecoNoMapa] = useState<string | null>(null);

  function montarRotulo(): string {
    return texto.trim();
  }

  // A busca atual aceita rua e número no mesmo campo. Preserva a geocodificação
  // estruturada do proxy, que extrai o número do texto automaticamente.
  useEffect(() => {
    const endereco = texto.trim();
    if (endereco.length < 3) return;
    const ctrl = new AbortController();
    let vivo = true;
    setBuscandoExato(true);
    const t = setTimeout(async () => {
      try {
        const p = await geocodificarPreciso(endereco, '', ctrl.signal);
        if (!vivo) return;
        if (p) { setCoord({ lat: p.lat, lng: p.lng }); setPrecisao(p.precisao); setEnderecoNoMapa(p.rotulo || null); }
      } finally {
        if (vivo) setBuscandoExato(false);
      }
    }, 600);
    return () => { vivo = false; ctrl.abort(); clearTimeout(t); };
  }, [texto]);

  // Arraste manual do alfinete: assume o ponto e confirma o endereço embaixo dele.
  function aoArrastar(lat: number, lng: number) {
    setCoord({ lat, lng });
    setPrecisao('ajustado');
    setEnderecoNoMapa(null);
    reverseGeocodificar(lat, lng).then((r) => { if (r) setEnderecoNoMapa(r); }).catch(() => {});
  }

  const temPonto = !!coord;
  const aviso = buscandoExato
    ? { c: 'bg-navy-50 text-navy-700', t: 'Localizando o número exato no mapa…' }
    : !temPonto
      ? { c: 'bg-amber-50 text-amber-800', t: 'Informe rua e número no mesmo campo, ou marque o ponto no mapa.' }
      : precisao === 'exato'
        ? { c: 'bg-mint-50 text-mint-800', t: 'Número localizado ✓ — confira no mapa e ajuste se precisar.' }
        : precisao === 'ajustado'
          ? { c: 'bg-sky-50 text-sky-800', t: 'Ponto ajustado à mão ✓' }
          : { c: 'bg-amber-50 text-amber-800', t: 'Localizamos a rua. Arraste o alfinete até o número certo.' };

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">{titulo}</h2>
      {dica && <p className="mt-1 text-sm text-navy-500">{dica}</p>}

      <div className="mt-3">
        <label className="field-label">Endereço (rua e número)</label>
        <AutocompleteEndereco
          value={texto}
          locais={locais}
          placeholder="Ex.: Rua José Geraldo, 580"
          onChange={(t, c) => {
            setTexto(t);
            // Sugestão escolhida: ponto provisório (nível de rua) até a geocodificação precisa.
            if (c) { setCoord(c); setPrecisao('rua'); setEnderecoNoMapa(null); }
            else if (!t.trim()) { setCoord(null); setPrecisao(undefined); setEnderecoNoMapa(null); }
          }}
        />
        <p className="mt-1 text-xs text-navy-400">Digite rua e número juntos. Confira o ponto localizado no mapa.</p>
      </div>

      <p className={cn('mt-3 rounded-xl p-2.5 text-sm', aviso.c)}>{aviso.t}</p>

      <div className="mt-3">
        <SeletorPontoMapa ponto={coord} precisao={precisao} onMover={aoArrastar} />
        {enderecoNoMapa && <p className="mt-1 text-xs text-navy-500">No mapa: {enderecoNoMapa}</p>}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="btn btn-lg btn-primary flex-1"
          disabled={!texto.trim() || !coord}
          onClick={() => onConfirmar(montarRotulo(), coord ?? undefined)}
        >
          {botao}
        </button>
        {onCancelar && <button className="btn btn-lg btn-ghost" onClick={onCancelar}>Cancelar</button>}
      </div>

      {texto.trim() && !coord && (
        <button
          className="mt-3 w-full text-center text-xs font-medium text-navy-400 hover:text-navy-700"
          onClick={() => onConfirmar(montarRotulo(), undefined)}
        >
          Não encontrei no mapa — confirmar só pelo endereço digitado
        </button>
      )}
    </div>
  );
}

/** Seleção de quem DESCE (desembarca) numa parada. Escola na ida, casa na volta. */
function SeletorQuemDesce({ aBordo, selec, setSelec }: {
  aBordo: { id: string; identificacao: string }[];
  selec: string[]; setSelec: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  if (aBordo.length === 0) {
    return <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-500">Nenhum aluno a bordo para descer aqui ainda.</p>;
  }
  return (
    <>
      <p className="field-label mt-4">Quem desce aqui?</p>
      <div className="flex flex-wrap gap-2">
        {aBordo.map((p) => {
          const on = selec.includes(p.id);
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => setSelec((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium', on ? 'bg-mint-500 text-white' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100')}>
              {on ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />} {p.identificacao}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Adiciona alunos que EMBARCAM numa parada. Casa na ida, escola na volta. */
function AddAlunosEmbarque({ rota, setRota, paradaId, capacidade, aBordoAntes, onFechar, rotuloPronto }: {
  rota: Rota; setRota: (r: Rota) => void; paradaId: string; capacidade: number;
  aBordoAntes: number; onFechar: () => void; rotuloPronto: string;
}) {
  const [nome, setNome] = useState('');
  const [adicionados, setAdicionados] = useState(0);

  function addAluno(outroAqui: boolean) {
    if (!nome.trim()) return;
    const lotado = aBordoAntes + adicionados + 1 >= capacidade;
    setRota(embarcarAluno(rota, paradaId, nome));
    setNome('');
    setAdicionados((n) => n + 1);
    if (!outroAqui && !lotado) onFechar();
  }

  const semVaga = aBordoAntes + adicionados >= capacidade;
  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Como podemos identificar esse aluno?</h2>
      <p className="mt-1 text-sm text-navy-500">Primeiro nome ou apelido curto. Não precisa nome completo nem documento.</p>
      <input className="field-input mt-3" placeholder="Ex.: João, Duda, Pedro…" value={nome} onChange={(e) => setNome(e.target.value)} />
      {semVaga && <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">A van já está na capacidade neste trecho ({capacidade} lugares). Reveja antes de adicionar mais.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn btn-lg btn-primary flex-1" disabled={!nome.trim()} onClick={() => addAluno(false)}>
          <Plus className="h-5 w-5" /> Adicionar aluno
        </button>
        <button className="btn btn-lg btn-ghost" disabled={!nome.trim()} onClick={() => addAluno(true)}>Adicionar outro aqui</button>
      </div>
      <button className="mt-3 w-full text-center text-sm text-navy-500" onClick={onFechar}>{rotuloPronto}</button>
    </div>
  );
}

function FormCasa({ rota, setRota, locais, proxOrdem, capacidade, aBordo, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void; locais: SugestaoEndereco[]; proxOrdem: number; capacidade: number;
  aBordo: { id: string; identificacao: string }[]; onFechar: () => void;
}) {
  const volta = rota.sentido === 'volta';
  const [etapa, setEtapa] = useState<'endereco' | 'aluno' | 'desce'>('endereco');
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [selec, setSelec] = useState<string[]>([]); // volta: quem desce nesta casa

  function confirmarEndereco(rotulo: string, coord?: { lat: number; lng: number }) {
    const pid = novoId();
    setRota({ ...rota, paradas: [...rota.paradas, { id: pid, ordem: proxOrdem, tipo: 'casa', rotulo, confirmado: true, lat: coord?.lat, lng: coord?.lng }] });
    setParadaId(pid);
    setEtapa(volta ? 'desce' : 'aluno');
  }

  // VOLTA: a casa é um DESEMBARQUE — escolhe quem desce aqui dentre os que vieram da escola.
  function confirmarDesembarque() {
    if (!paradaId) return;
    setRota(desembarcarAlunos(rota, paradaId, selec));
    onFechar();
  }

  if (etapa === 'endereco') {
    return <FormEndereco titulo={volta ? 'Onde você deixa o aluno?' : 'Onde você busca o aluno?'} botao="Confirmar endereço" locais={locais} onConfirmar={confirmarEndereco} onCancelar={onFechar} />;
  }

  if (etapa === 'desce') {
    return (
      <div className="card mt-4 p-5">
        <h2 className="font-display font-bold">Quem desce nesta casa?</h2>
        <p className="mt-1 text-sm text-navy-500">Marque os alunos que você deixa neste endereço.</p>
        <SeletorQuemDesce aBordo={aBordo} selec={selec} setSelec={setSelec} />
        <div className="mt-5 flex gap-3">
          <button className="btn btn-lg btn-primary flex-1" disabled={selec.length === 0} onClick={confirmarDesembarque}>
            <CheckCircle2 className="h-5 w-5" /> Confirmar desembarque
          </button>
          <button className="btn btn-lg btn-ghost" onClick={onFechar}><X className="h-5 w-5" /></button>
        </div>
      </div>
    );
  }

  // IDA: a casa é um EMBARQUE — cadastra os alunos buscados aqui.
  return (
    <AddAlunosEmbarque rota={rota} setRota={setRota} paradaId={paradaId!} capacidade={capacidade}
      aBordoAntes={aBordo.length} onFechar={onFechar} rotuloPronto="Pronto nesta casa" />
  );
}

function FormEscola({ rota, setRota, destinos, proxOrdem, capacidade, aBordo, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void;
  destinos: { id: string; nome: string; bairro: string; lat?: number | null; lng?: number | null }[];
  proxOrdem: number; capacidade: number; aBordo: { id: string; identificacao: string }[]; onFechar: () => void;
}) {
  const volta = rota.sentido === 'volta';
  const [etapa, setEtapa] = useState<'escola' | 'aluno'>('escola');
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState('');
  const [selec, setSelec] = useState<string[]>(aBordo.map((p) => p.id)); // ida: por padrão todos descem
  const destino = destinos.find((d) => d.id === destinoId) ?? null;

  function novaParadaEscola(pid: string): ParadaRota {
    const lat = destino?.lat ?? undefined;
    const lng = destino?.lng ?? undefined;
    return {
      id: pid, ordem: proxOrdem, tipo: 'escola', rotulo: destino?.nome ?? 'Escola', confirmado: true,
      destinoId, destinoNome: destino?.nome ?? null,
      lat: lat == null ? undefined : lat, lng: lng == null ? undefined : lng,
    };
  }

  // IDA: escola é DESEMBARQUE — cria a parada e marca quem desce.
  function confirmarIda() {
    if (!destinoId) return;
    const pid = novoId();
    const comParada: Rota = { ...rota, paradas: [...rota.paradas, novaParadaEscola(pid)] };
    setRota(desembarcarAlunos(comParada, pid, selec));
    onFechar();
  }

  // VOLTA: escola é EMBARQUE — cria a parada e segue para cadastrar os alunos pegos aqui.
  function confirmarVolta() {
    if (!destinoId) return;
    const pid = novoId();
    setRota({ ...rota, paradas: [...rota.paradas, novaParadaEscola(pid)] });
    setParadaId(pid);
    setEtapa('aluno');
  }

  if (etapa === 'aluno' && paradaId) {
    return (
      <AddAlunosEmbarque rota={rota} setRota={setRota} paradaId={paradaId} capacidade={capacidade}
        aBordoAntes={aBordo.length} onFechar={onFechar} rotuloPronto="Pronto nesta escola" />
    );
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">{volta ? 'De qual escola você pega os alunos?' : 'Qual escola?'}</h2>
      <select className="field-input mt-3 appearance-none" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
        <option value="">Escolha a escola…</option>
        {destinos.map((d) => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)} — {d.bairro}</option>)}
      </select>
      {destino && <p className="mt-2 text-xs text-navy-500">{nomeDestinoParaExibicao(destino.nome)} · {destino.bairro}</p>}
      <p className="mt-2 text-xs text-navy-400">Não achou a escola? Salve como rascunho e avise a equipe — não inventamos escolas.</p>

      {!volta && <SeletorQuemDesce aBordo={aBordo} selec={selec} setSelec={setSelec} />}

      <div className="mt-5 flex gap-3">
        <button className="btn btn-lg btn-primary flex-1" disabled={!destinoId} onClick={volta ? confirmarVolta : confirmarIda}>
          <CheckCircle2 className="h-5 w-5" /> {volta ? 'Confirmar escola e pegar alunos' : 'Confirmar parada na escola'}
        </button>
        <button className="btn btn-lg btn-ghost" onClick={onFechar}><X className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/* ----------------------------- Horários ----------------------------- */
export function Horarios({ rota, setRota, onConfirmar, salvando }: { rota: Rota; setRota: (r: Rota) => void; onConfirmar: (rotaAtualizada: Rota) => void; salvando: boolean }) {
  const [hora, setHora] = useState(rota.ultimoDesembarqueMin != null ? minutosParaTextoHora(rota.ultimoDesembarqueMin).replace('h', ':') : '');
  const [antecip, setAntecip] = useState(rota.limiteAntecipacaoMin != null ? String(rota.limiteAntecipacaoMin) : '');

  function confirmar() {
    const min = /^\d{1,2}:\d{2}$/.test(hora) ? horaParaMinutos(hora) : null;
    const atualizada = { ...rota, ultimoDesembarqueMin: min, limiteAntecipacaoMin: antecip ? Number(antecip) : null };
    setRota(atualizada);
    onConfirmar(atualizada);
  }
  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display text-lg font-bold">Horários</h2>
      <div className="mt-4">
        <label className="field-label">A que horas você precisa deixar o último aluno?</label>
        <input className="field-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </div>
      <div className="mt-4">
        <label className="field-label">Se precisar, você pode sair mais cedo? Quantos minutos antes?</label>
        <input className="field-input" inputMode="numeric" placeholder="Ex.: 10" value={antecip} onChange={(e) => setAntecip(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="mt-3 text-xs text-navy-400">A previsão de horário de cada parada é calculada pelo sistema de compatibilidade (em preparação). Sair mais cedo não garante que um novo aluno caiba.</p>
      <button className="btn btn-lg btn-primary mt-5 w-full" onClick={confirmar} disabled={salvando}>
        {salvando ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando…</> : 'Concluir rota'}
      </button>
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('rounded-full px-4 py-2 text-sm font-medium transition-all', ativo ? 'bg-navy-900 text-white shadow-card' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100 hover:bg-navy-100')}>
      {children}
    </button>
  );
}
