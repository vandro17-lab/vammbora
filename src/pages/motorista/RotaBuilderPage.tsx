import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader2, MapPin, Home, School, Plus, Check, X, ArrowUp, ArrowDown, Trash2, Users, Flag, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarVeiculos, obterRota, salvarRota, novoId } from '@/data/motorista-store';
import type { Rota, Veiculo, ParadaRota, TipoParada } from '@/types/motorista';
import type { Turno } from '@/types';
import { useVitrine } from '@/data/VitrineProvider';
import { capacidadeAlunos, aBordoEm, validarRota, podeFinalizar } from '@/lib/ocupacao-rota';
import { PlanoMotor } from '@/components/motorista/PlanoMotor';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { SeletorPontoMapa } from '@/components/motorista/SeletorPontoMapa';
import { AutocompleteEndereco } from '@/components/search/AutocompleteEndereco';
import { locaisDeDestinos, geocodificarPreciso, reverseGeocodificar, type SugestaoEndereco, type Precisao } from '@/lib/geocode';
import { TURNO_LABEL, cn, minutosParaTextoHora, horaParaMinutos, nomeDestinoParaExibicao } from '@/lib/utils';

const DIAS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex']] as const;
const TURNOS: Turno[] = ['manha', 'tarde', 'noite', 'integral'];

function rotaNova(): Rota {
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
  const { destinos } = useVitrine();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rota, setRota] = useState<Rota>(rotaNova());
  const [etapa, setEtapa] = useState<'preparacao' | 'construindo' | 'horarios'>('preparacao');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const vs = await listarVeiculos().catch(() => [] as Veiculo[]);
      let r = rotaNova();
      if (id && id !== 'nova') {
        const existente = await obterRota(id).catch(() => null);
        if (existente) r = existente;
      }
      if (!r.veiculoId && vs.length === 1) r.veiculoId = vs[0].id;
      if (vivo) {
        setVeiculos(vs);
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

  async function salvar(status: Rota['status']) {
    setSalvando(true);
    setAviso(null);
    try {
      const nome = rota.nome || `Rota ${rota.sentido === 'ida' ? 'de ida' : 'de volta'}`;
      const salva = await salvarRota({ ...rota, nome, status });
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
          {/* Van + ocupação */}
          <VanViz capacidade={capacidade} aBordo={aBordoFinal.length} rota={rota} veiculo={veiculo} />

          {/* Linha do percurso */}
          <LinhaPercurso rota={rota} setRota={setRota} />

          {/* Mapa interativo: carrega sozinho e desenha o trajeto pelas ruas. */}
          {rota.paradas.length > 0 && <MapaInterativoRota paradas={rota.paradas} onTempos={aplicarTempos} />}

          {/* Motor real: horários da viagem (quando há paradas suficientes) */}
          {rota.paradas.length >= 2 && <PlanoMotor rota={rota} setRota={setRota} veiculo={veiculo} />}

          {/* Ação */}
          {etapa === 'construindo' && (
            <AcaoParada rota={rota} setRota={setRota} destinos={destinos} locais={locaisBusca} aBordo={aBordoFinal} capacidade={capacidade} />
          )}

          {etapa === 'horarios' && (
            <Horarios rota={rota} setRota={setRota} onConfirmar={() => salvar('concluida')} salvando={salvando} />
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
function VanViz({ capacidade, aBordo, rota, veiculo }: { capacidade: number; aBordo: number; rota: Rota; veiculo: Veiculo | null }) {
  const livres = Math.max(0, capacidade - aBordo);
  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">Sua van</h2>
        <span className="text-sm text-navy-500">{veiculo?.modelo || 'Van'} · {capacidade} lugares p/ alunos</span>
      </div>
      <div className="mt-4 rounded-2xl bg-navy-900 p-4">
        {/* assentos */}
        <div className="flex flex-wrap gap-2" aria-label={`${aBordo} de ${capacidade} lugares ocupados`}>
          {Array.from({ length: Math.max(capacidade, aBordo) }).map((_, i) => (
            <span key={i} className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold',
              i < aBordo ? 'bg-mint-400 text-navy-900' : 'bg-white/10 text-white/40 ring-1 ring-white/10')}>
              {i < aBordo ? '•' : ''}
            </span>
          ))}
          {rota.monitor && rota.monitorOcupaLugar && (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300 text-[10px] font-bold text-navy-900" title="Lugar do monitor">MON</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-mint-300"><Users className="h-4 w-4" /> {aBordo} a bordo</span>
          <span className="text-white/70">{livres} livre(s) agora</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy-400">A disponibilidade por trecho é calculada ao longo da rota — bancos livres agora não são "vagas" do percurso todo.</p>
    </div>
  );
}

/* ----------------------------- Linha do percurso ----------------------------- */
function LinhaPercurso({ rota, setRota }: { rota: Rota; setRota: (r: Rota) => void }) {
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
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-navy-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{idx}</span>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy-700 ring-1 ring-navy-100">
                {p.tipo === 'saida' ? <MapPin className="h-4 w-4" /> : p.tipo === 'escola' ? <School className="h-4 w-4" /> : <Home className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900">
                  {p.tipo === 'saida' ? 'Saída' : p.tipo === 'escola' ? (p.destinoNome || 'Escola') : (p.rotulo || 'Casa')}
                </p>
                <p className="truncate text-xs text-navy-500">
                  {embarcam.length > 0 && `Embarca: ${embarcam.map((x) => x.identificacao).join(', ')}`}
                  {embarcam.length > 0 && descem.length > 0 && ' · '}
                  {descem.length > 0 && `Desce: ${descem.map((x) => x.identificacao).join(', ')}`}
                  {embarcam.length === 0 && descem.length === 0 && (p.confirmado ? 'Confirmada' : 'Sem confirmação')}
                </p>
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
function AcaoParada({ rota, setRota, destinos, locais, aBordo, capacidade }: {
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
    return <FormEscola rota={rota} setRota={setRota} destinos={destinos} proxOrdem={proxOrdem()} aBordo={aBordo} onFechar={() => setModo(null)} />;
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Adicionar próxima parada</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button className="card card-interactive flex flex-col items-center gap-2 p-5 text-center" onClick={() => setModo('casa')}>
          <Home className="h-7 w-7 text-mint-600" /><span className="font-semibold text-navy-900">Casa de aluno</span>
        </button>
        <button className="card card-interactive flex flex-col items-center gap-2 p-5 text-center" onClick={() => setModo('escola')}>
          <School className="h-7 w-7 text-navy-700" /><span className="font-semibold text-navy-900">Escola</span>
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
  const [numero, setNumero] = useState('');
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [precisao, setPrecisao] = useState<Precisao | undefined>(undefined);
  const [buscandoExato, setBuscandoExato] = useState(false);
  const [enderecoNoMapa, setEnderecoNoMapa] = useState<string | null>(null);

  function montarRotulo(): string {
    const base = texto.trim();
    const n = numero.trim();
    if (!n) return base;
    return new RegExp(`\\b${n}\\b`).test(base) ? base : `${base}, nº ${n}`;
  }

  // Geocodificação PRECISA (estruturada) sempre que há rua + número: move o
  // alfinete para o número informado, não para o meio da rua.
  useEffect(() => {
    const rua = texto.trim();
    if (rua.length < 3 || !numero.trim()) return;
    const ctrl = new AbortController();
    let vivo = true;
    setBuscandoExato(true);
    const t = setTimeout(async () => {
      const p = await geocodificarPreciso(rua, numero.trim(), ctrl.signal);
      if (!vivo) return;
      if (p) { setCoord({ lat: p.lat, lng: p.lng }); setPrecisao(p.precisao); setEnderecoNoMapa(p.rotulo || null); }
      setBuscandoExato(false);
    }, 600);
    return () => { vivo = false; ctrl.abort(); clearTimeout(t); };
  }, [texto, numero]);

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
      ? { c: 'bg-amber-50 text-amber-800', t: 'Informe a rua e o número, ou toque no mapa para marcar o ponto.' }
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
        <label className="field-label">Endereço (rua e bairro)</label>
        <AutocompleteEndereco
          value={texto}
          locais={locais}
          placeholder="Comece a digitar a rua — Araçatuba"
          onChange={(t, c) => {
            setTexto(t);
            // Sugestão escolhida: ponto provisório (nível de rua) até a geocodificação precisa.
            if (c) { setCoord(c); setPrecisao('rua'); setEnderecoNoMapa(null); }
            else if (!t.trim()) { setCoord(null); setPrecisao(undefined); setEnderecoNoMapa(null); }
          }}
        />
        <p className="mt-1 text-xs text-navy-400">Escolha uma sugestão; o número abaixo fixa o ponto exato.</p>
      </div>

      <div className="mt-3">
        <label className="field-label" htmlFor="numero-parada">Número</label>
        <input id="numero-parada" className="field-input" inputMode="numeric" placeholder="Ex.: 450 (ou s/n)" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>

      <p className={cn('mt-3 rounded-xl p-2.5 text-sm', aviso.c)}>{aviso.t}</p>

      <div className="mt-3">
        <SeletorPontoMapa ponto={coord} precisao={precisao} onMover={aoArrastar} />
        {enderecoNoMapa && <p className="mt-1 text-xs text-navy-500">No mapa: {enderecoNoMapa}</p>}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="btn btn-lg btn-primary flex-1"
          disabled={!texto.trim() || !numero.trim() || !coord}
          onClick={() => onConfirmar(montarRotulo(), coord ?? undefined)}
        >
          {botao}
        </button>
        {onCancelar && <button className="btn btn-lg btn-ghost" onClick={onCancelar}>Cancelar</button>}
      </div>

      {texto.trim() && numero.trim() && !coord && (
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

function FormCasa({ rota, setRota, locais, proxOrdem, capacidade, aBordo, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void; locais: SugestaoEndereco[]; proxOrdem: number; capacidade: number; aBordo: { id: string }[]; onFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<'endereco' | 'aluno'>('endereco');
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [nome, setNome] = useState('');

  function confirmarEndereco(rotulo: string, coord?: { lat: number; lng: number }) {
    const pid = novoId();
    setRota({ ...rota, paradas: [...rota.paradas, { id: pid, ordem: proxOrdem, tipo: 'casa', rotulo, confirmado: true, lat: coord?.lat, lng: coord?.lng }] });
    setParadaId(pid);
    setEtapa('aluno');
  }
  function addAluno(outroAqui: boolean) {
    if (!paradaId || !nome.trim()) return;
    const lotado = aBordo.length + 1 > capacidade;
    setRota({
      ...rota,
      passageiros: [...rota.passageiros, { id: novoId(), identificacao: nome.trim(), embarqueParadaId: paradaId, desembarqueParadaId: null }],
    });
    setNome('');
    if (!outroAqui && !lotado) onFechar();
  }

  if (etapa === 'endereco') {
    return <FormEndereco titulo="Onde você busca o aluno?" botao="Confirmar endereço" locais={locais} onConfirmar={confirmarEndereco} onCancelar={onFechar} />;
  }
  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Como podemos identificar esse aluno?</h2>
      <p className="mt-1 text-sm text-navy-500">Primeiro nome ou apelido curto. Não precisa nome completo nem documento.</p>
      <input className="field-input mt-3" placeholder="Ex.: João, Duda, Pedro…" value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn btn-lg btn-primary flex-1" disabled={!nome.trim()} onClick={() => addAluno(false)}>
          <Plus className="h-5 w-5" /> Adicionar aluno
        </button>
        <button className="btn btn-lg btn-ghost" disabled={!nome.trim()} onClick={() => addAluno(true)}>Adicionar outro aqui</button>
      </div>
      <button className="mt-3 w-full text-center text-sm text-navy-500" onClick={onFechar}>Pronto nesta casa</button>
    </div>
  );
}

function FormEscola({ rota, setRota, destinos, proxOrdem, aBordo, onFechar }: {
  rota: Rota; setRota: (r: Rota) => void;
  destinos: { id: string; nome: string; bairro: string; lat?: number | null; lng?: number | null }[];
  proxOrdem: number; aBordo: { id: string; identificacao: string }[]; onFechar: () => void;
}) {
  const [destinoId, setDestinoId] = useState('');
  const [selec, setSelec] = useState<string[]>(aBordo.map((p) => p.id)); // por padrão todos descem
  const destino = destinos.find((d) => d.id === destinoId) ?? null;

  function confirmar() {
    if (!destinoId) return;
    const pid = novoId();
    // A escola já tem geolocalização no catálogo: aproveita para o mapa.
    const lat = destino?.lat ?? undefined;
    const lng = destino?.lng ?? undefined;
    const parada: ParadaRota = {
      id: pid, ordem: proxOrdem, tipo: 'escola', rotulo: destino?.nome ?? 'Escola', confirmado: true,
      destinoId, destinoNome: destino?.nome ?? null,
      lat: lat == null ? undefined : lat, lng: lng == null ? undefined : lng,
    };
    const passageiros = rota.passageiros.map((p) => (selec.includes(p.id) ? { ...p, desembarqueParadaId: pid, destinoId } : p));
    setRota({ ...rota, paradas: [...rota.paradas, parada], passageiros });
    onFechar();
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Qual escola?</h2>
      <select className="field-input mt-3 appearance-none" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
        <option value="">Escolha a escola…</option>
        {destinos.map((d) => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)} — {d.bairro}</option>)}
      </select>
      {destino && <p className="mt-2 text-xs text-navy-500">{nomeDestinoParaExibicao(destino.nome)} · {destino.bairro}</p>}
      <p className="mt-2 text-xs text-navy-400">Não achou a escola? Salve como rascunho e avise a equipe — não inventamos escolas.</p>

      {aBordo.length > 0 ? (
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
      ) : (
        <p className="mt-4 rounded-xl bg-navy-50 p-3 text-sm text-navy-500">Nenhum aluno a bordo para descer aqui ainda.</p>
      )}

      <div className="mt-5 flex gap-3">
        <button className="btn btn-lg btn-primary flex-1" disabled={!destinoId} onClick={confirmar}>
          <CheckCircle2 className="h-5 w-5" /> Confirmar parada na escola
        </button>
        <button className="btn btn-lg btn-ghost" onClick={onFechar}><X className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/* ----------------------------- Horários ----------------------------- */
function Horarios({ rota, setRota, onConfirmar, salvando }: { rota: Rota; setRota: (r: Rota) => void; onConfirmar: () => void; salvando: boolean }) {
  const [hora, setHora] = useState(rota.ultimoDesembarqueMin != null ? minutosParaTextoHora(rota.ultimoDesembarqueMin).replace('h', ':') : '');
  const [antecip, setAntecip] = useState(rota.limiteAntecipacaoMin != null ? String(rota.limiteAntecipacaoMin) : '');

  function confirmar() {
    const min = /^\d{1,2}:\d{2}$/.test(hora) ? horaParaMinutos(hora) : null;
    setRota({ ...rota, ultimoDesembarqueMin: min, limiteAntecipacaoMin: antecip ? Number(antecip) : null });
    onConfirmar();
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
