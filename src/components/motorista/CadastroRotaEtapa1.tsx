import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Plus, School, Trash2 } from 'lucide-react';
import type { Turno } from '@/types';
import type { EscolaDisponivel, ParadaRota, Rota } from '@/types/motorista';
import { novoId } from '@/data/motorista-store';
import { SeletorPontoMapa } from '@/components/motorista/SeletorPontoMapa';
import {
  DIA_LABEL, diasDaDisponibilidade, duracaoDasPartes, escolasNoPercurso, horaDoCampo,
  horarioReferenciaDoPeriodo, inteiroInformado, minutosDoCampo, partesDaDuracao, pendenciasDeRevisao,
  sugerirPeriodo, totalDePendencias,
} from '@/lib/cadastro-rota';
import { TURNO_LABEL, cn, nomeDestinoParaExibicao } from '@/lib/utils';

/**
 * Campos do cadastro de rotas da ETAPA 1 da busca/encaixe. Regra de todos eles:
 * campo VAZIO = não informado; "0" = zero informado. Nenhum preenche sozinho.
 */

export interface DestinoCatalogo { id: string; nome: string; bairro: string; lat?: number | null; lng?: number | null }

const TURNOS: Turno[] = ['manha', 'tarde', 'noite', 'integral'];

function Chip({ ativo, onClick, children, pequeno = false }: { ativo: boolean; onClick: () => void; children: React.ReactNode; pequeno?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('rounded-full font-medium transition-all', pequeno ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        ativo ? 'bg-navy-900 text-white shadow-card' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100 hover:bg-navy-100')}>
      {children}
    </button>
  );
}

/* ------------------------------- campos base ------------------------------- */

/** Horário (minuto do dia). Vazio = não informado. */
export function CampoHora({ rotulo, valor, onChange, dica }: { rotulo: string; valor: number | null | undefined; onChange: (min: number | null) => void; dica?: string }) {
  return (
    <label className="block text-xs font-semibold text-navy-700">
      {rotulo}
      <input type="time" className="field-input mt-1 !py-1.5 text-sm" value={horaDoCampo(valor)} onChange={(e) => onChange(minutosDoCampo(e.target.value))} />
      {dica && <span className="mt-0.5 block text-[11px] font-normal text-navy-400">{dica}</span>}
    </label>
  );
}

/** Minutos inteiros. Vazio = não informado; 0 = zero. */
export function CampoMinutos({ rotulo, valor, onChange, max = 120, dica }: { rotulo: string; valor: number | null | undefined; onChange: (min: number | null) => void; max?: number; dica?: string }) {
  return (
    <label className="block text-xs font-semibold text-navy-700">
      {rotulo}
      <span className="mt-1 flex items-center gap-1.5">
        <input className="field-input !w-20 !py-1.5 text-center text-sm" inputMode="numeric" placeholder="—" aria-label={rotulo}
          value={valor == null ? '' : String(valor)} onChange={(e) => onChange(inteiroInformado(e.target.value.replace(/\D/g, ''), max))} />
        <span className="text-xs font-normal text-navy-400">min</span>
      </span>
      {dica && <span className="mt-0.5 block text-[11px] font-normal text-navy-400">{dica}</span>}
    </label>
  );
}

/** Duração em minutos e segundos (aceita menos de 1 minuto). Os dois vazios = não informado. */
export function CampoDuracao({ rotulo, valor, onChange, dica }: { rotulo: string; valor: number | null | undefined; onChange: (min: number | null) => void; dica?: string }) {
  // Texto digitado fica local: assim dá para apagar um campo de cada vez e
  // voltar a "não informado" (os dois vazios), sem o zero reaparecer sozinho.
  const [partes, setPartes] = useState(() => partesDaDuracao(valor));
  useEffect(() => {
    setPartes((atual) => (duracaoDasPartes(atual.min, atual.seg) === (valor ?? null) ? atual : partesDaDuracao(valor)));
  }, [valor]);
  const mudar = (minBruto: string, segBruto: string) => {
    const min = minBruto.replace(/\D/g, '').slice(0, 2), seg = segBruto.replace(/\D/g, '').slice(0, 2);
    setPartes({ min, seg });
    onChange(duracaoDasPartes(min, seg));
  };
  return (
    <div className="text-xs font-semibold text-navy-700">
      {rotulo}
      <span className="mt-1 flex items-center gap-1.5">
        <input className="field-input !w-14 !px-1 !py-1.5 text-center text-sm" inputMode="numeric" placeholder="—" aria-label={`${rotulo}: minutos`}
          value={partes.min} onChange={(e) => mudar(e.target.value, partes.seg)} />
        <span className="text-xs font-normal text-navy-400">min</span>
        <input className="field-input !w-14 !px-1 !py-1.5 text-center text-sm" inputMode="numeric" placeholder="—" aria-label={`${rotulo}: segundos`}
          value={partes.seg} onChange={(e) => mudar(partes.min, e.target.value)} />
        <span className="text-xs font-normal text-navy-400">s</span>
      </span>
      {dica && <span className="mt-0.5 block text-[11px] font-normal text-navy-400">{dica}</span>}
    </div>
  );
}

/* ------------------------------ período escolar ------------------------------ */

/**
 * PERÍODO ESCOLAR, separado do sentido. Sugere pelo horário (uma volta ao
 * meio-dia é da manhã), mas quem decide é o motorista: escolher um período ou
 * tocar em "Confirmar" marca como confirmado.
 */
export function PeriodoEscolar({ rota, setRota }: { rota: Rota; setRota: (r: Rota) => void }) {
  const sugestao = sugerirPeriodo(rota.sentido, horarioReferenciaDoPeriodo(rota));
  const escolher = (t: Turno) => setRota({ ...rota, turno: t, periodoConfirmado: true });
  const confirmado = !!rota.turno && !!rota.periodoConfirmado;
  return (
    <div>
      <p className="field-label">Período escolar dos alunos</p>
      <div className="flex flex-wrap gap-2">
        {TURNOS.map((t) => (
          <Chip key={t} ativo={rota.turno === t} onClick={() => escolher(t)}>
            {TURNO_LABEL[t]}{confirmado && rota.turno === t ? ' ✓' : ''}
          </Chip>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-navy-400">
        O período é o das aulas, não o horário da viagem: a volta do meio-dia leva alunos da <strong>manhã</strong>.
      </p>
      {!confirmado && (
        <div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
          {rota.turno ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Período cadastrado: <strong>{TURNO_LABEL[rota.turno]}</strong>. Confirme se está certo{sugestao && sugestao !== rota.turno ? ` — pelo horário, parece ser ${TURNO_LABEL[sugestao]}` : ''}.</span>
              <button type="button" className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-bold text-white" onClick={() => escolher(rota.turno!)}>Confirmar {TURNO_LABEL[rota.turno]}</button>
            </div>
          ) : sugestao ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Pelo horário, sugerimos <strong>{TURNO_LABEL[sugestao]}</strong>.</span>
              <button type="button" className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-bold text-white" onClick={() => escolher(sugestao)}>Confirmar {TURNO_LABEL[sugestao]}</button>
            </div>
          ) : (
            <span>Escolha o período escolar desta rota.</span>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------- saída e antecipação --------------------------- */

/** Horário habitual de saída da van e quanto o motorista autoriza antecipar. */
export function SaidaEAntecipacao({ rota, setRota }: { rota: Rota; setRota: (r: Rota) => void }) {
  const saida = [...rota.paradas].sort((a, b) => a.ordem - b.ordem).find((p) => p.tipo === 'saida');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CampoHora rotulo="Horário habitual de saída da van" valor={rota.saidaHabitualMin} onChange={(m) => setRota({ ...rota, saidaHabitualMin: m })}
        dica={saida ? `Saindo de: ${saida.rotulo || 'endereço de saída'}` : 'O endereço de saída é a primeira parada da rota.'} />
      <CampoMinutos rotulo="Quanto você autoriza antecipar a saída?" valor={rota.limiteAntecipacaoMin} onChange={(m) => setRota({ ...rota, limiteAntecipacaoMin: m })}
        dica="0 = não autorizo sair antes. Vazio = ainda não informei." />
    </div>
  );
}

/* ------------------------------ visita à escola ------------------------------ */

/** Limite de chegada (ida) ou liberação (volta) e tempo de atendimento do grupo. */
export function CamposDaVisita({ sentido, visita, onChange }: {
  sentido: Rota['sentido']; visita: Pick<ParadaRota, 'limiteChegadaMin' | 'liberacaoMin' | 'atendimentoGrupoMin'>;
  onChange: (mudanca: Pick<ParadaRota, 'limiteChegadaMin' | 'liberacaoMin' | 'atendimentoGrupoMin'>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {sentido === 'ida'
        ? <CampoHora rotulo="Chegar até (limite)" valor={visita.limiteChegadaMin} onChange={(m) => onChange({ ...visita, limiteChegadaMin: m })} />
        : <CampoHora rotulo="Liberação dos alunos" valor={visita.liberacaoMin} onChange={(m) => onChange({ ...visita, liberacaoMin: m })} />}
      <CampoDuracao rotulo="Atendimento do grupo" valor={visita.atendimentoGrupoMin} onChange={(m) => onChange({ ...visita, atendimentoGrupoMin: m })} dica="Tempo parado na escola." />
    </div>
  );
}

/** Marca o PORTÃO no mapa. A escola continua sendo a mesma unidade do catálogo. */
export function CampoPortao({ ponto, especifico, pontoDoCatalogo, onMover, onUsarCatalogo }: {
  ponto: { lat: number; lng: number } | null; especifico: boolean; pontoDoCatalogo: { lat: number; lng: number } | null;
  onMover: (lat: number, lng: number) => void; onUsarCatalogo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const base = ponto ?? pontoDoCatalogo;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-navy-500">{especifico ? 'Portão marcado por você.' : 'Usando o ponto do catálogo da escola.'}</span>
        <button type="button" className="font-bold text-mint-700" onClick={() => setAberto((v) => !v)}>{aberto ? 'Fechar mapa' : 'Marcar o portão no mapa'}</button>
        {especifico && pontoDoCatalogo && <button type="button" className="font-bold text-navy-500" onClick={onUsarCatalogo}>Voltar ao ponto do catálogo</button>}
      </div>
      {aberto && (
        base
          ? <div className="mt-2"><SeletorPontoMapa ponto={base} precisao={especifico ? 'ajustado' : 'exato'} onMover={onMover} altura="h-48" legenda="Arraste o alfinete até o portão usado pela van." /></div>
          : <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">Esta escola ainda não tem ponto no mapa do catálogo.</p>
      )}
    </div>
  );
}

/* ----------------------- escolas que aceita incluir ----------------------- */

/**
 * ESCOLAS QUE O MOTORISTA ACEITA INCLUIR nesta rota (além das que já estão no
 * percurso). Não criam parada nem mudam horários. Valem só para ESTA rota —
 * período, sentido e dias dela; a lista geral do motorista aparece apenas como
 * sugestão de preenchimento.
 */
export function EscolasDisponiveis({ rota, setRota, destinos, listaGeral = [] }: {
  rota: Rota; setRota: (r: Rota) => void; destinos: DestinoCatalogo[]; listaGeral?: string[];
}) {
  const [escolhida, setEscolhida] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = rota.escolasDisponiveis ?? [];
  const porId = new Map(destinos.map((d) => [d.id, d]));
  const noPercurso = escolasNoPercurso(rota);
  const usadas = new Set([...noPercurso, ...lista.map((e) => e.destinoId)]);
  const livres = destinos.filter((d) => !usadas.has(d.id));
  const sugestoes = listaGeral.filter((id) => !usadas.has(id) && porId.has(id));
  const nome = (id: string) => nomeDestinoParaExibicao(porId.get(id)?.nome ?? 'Escola do catálogo');

  const gravar = (escolasDisponiveis: EscolaDisponivel[], revisada = true) => setRota({ ...rota, escolasDisponiveis, disponibilidadeRevisada: revisada });
  function adicionar(destinoId: string) {
    if (!destinoId || usadas.has(destinoId)) return;
    gravar([...lista, { id: novoId(), destinoId, destinoNome: porId.get(destinoId)?.nome ?? null, dias: null }]);
    setEscolhida('');
  }
  const mudar = (id: string, m: Partial<EscolaDisponivel>) => gravar(lista.map((e) => (e.id === id ? { ...e, ...m } : e)));
  function alternarDia(e: EscolaDisponivel, dia: string) {
    const atuais = diasDaDisponibilidade(rota, e);
    const novos = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : rota.dias.filter((d) => d === dia || atuais.includes(d));
    if (novos.length === 0) return; // sem dia nenhum não é disponibilidade: remova a escola
    mudar(e.id, { dias: novos.length === rota.dias.length ? null : novos });
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-display font-bold">Escolas que você aceita incluir nesta rota</h2>
      <p className="mt-1 text-sm text-navy-600">
        Além das escolas do percurso, quais você toparia atender nesta rota se aparecer um aluno? Elas <strong>não viram parada</strong> e não mudam seus horários de hoje.
      </p>
      <p className="mt-1 text-[11px] text-navy-400">
        Vale só para esta rota ({rota.sentido === 'ida' ? 'ida' : 'volta'}{rota.turno ? `, ${TURNO_LABEL[rota.turno].toLowerCase()}` : ''}{rota.dias.length ? `, ${rota.dias.map((d) => DIA_LABEL[d] ?? d).join(' ')}` : ''}). Suas outras rotas não são autorizadas por aqui.
      </p>

      {noPercurso.length > 0 && (
        <p className="mt-3 text-xs text-navy-500">
          <strong>Já no percurso:</strong> {noPercurso.map(nome).join(', ')}.
        </p>
      )}

      {lista.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lista.map((e) => {
            const dias = diasDaDisponibilidade(rota, e);
            const doCatalogo = porId.get(e.destinoId);
            const pontoCat = doCatalogo && typeof doCatalogo.lat === 'number' && typeof doCatalogo.lng === 'number' ? { lat: doCatalogo.lat, lng: doCatalogo.lng } : null;
            const portao = typeof e.portaoLat === 'number' && typeof e.portaoLng === 'number' ? { lat: e.portaoLat, lng: e.portaoLng } : null;
            return (
              <li key={e.id} className="rounded-xl bg-navy-50 p-3">
                <div className="flex items-center gap-2">
                  <School className="h-4 w-4 shrink-0 text-navy-500" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAberta((a) => (a === e.id ? null : e.id))} aria-expanded={aberta === e.id}>
                    <span className="block truncate text-sm font-semibold text-navy-900">{nome(e.destinoId)}</span>
                    <span className="block text-[11px] text-navy-500">{dias.length ? dias.map((d) => DIA_LABEL[d] ?? d).join(' ') : 'nenhum dia da rota'} · toque para detalhes</span>
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost !px-2 text-red-600" aria-label={`Remover ${nome(e.destinoId)}`} onClick={() => gravar(lista.filter((x) => x.id !== e.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
                {aberta === e.id && (
                  <div className="mt-2.5 space-y-2.5 border-t border-navy-100 pt-2.5">
                    <div>
                      <p className="text-xs font-semibold text-navy-700">Em quais dias desta rota?</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {rota.dias.map((d) => <Chip key={d} pequeno ativo={dias.includes(d)} onClick={() => alternarDia(e, d)}>{DIA_LABEL[d] ?? d}</Chip>)}
                      </div>
                    </div>
                    <p className="text-[11px] text-navy-400">Opcional — se já souber as condições da visita:</p>
                    <CamposDaVisita sentido={rota.sentido} visita={e} onChange={(m) => mudar(e.id, m)} />
                    <CampoPortao ponto={portao} especifico={!!portao} pontoDoCatalogo={pontoCat}
                      onMover={(lat, lng) => mudar(e.id, { portaoLat: lat, portaoLng: lng })}
                      onUsarCatalogo={() => mudar(e.id, { portaoLat: null, portaoLng: null })} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sugestoes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-navy-700">Da sua lista geral de escolas (toque para incluir nesta rota):</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sugestoes.map((id) => (
              <button key={id} type="button" onClick={() => adicionar(id)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-navy-700 ring-1 ring-navy-200">
                <Plus className="h-3 w-3" /> {nome(id)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <select className="field-input min-w-0 flex-1 appearance-none" value={escolhida} onChange={(e) => setEscolhida(e.target.value)} aria-label="Escola do catálogo">
          <option value="">Escolher escola do catálogo…</option>
          {livres.map((d) => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)} — {d.bairro}</option>)}
        </select>
        <button type="button" className="btn btn-md btn-primary" disabled={!escolhida} onClick={() => adicionar(escolhida)}><Plus className="h-4 w-4" /> Incluir</button>
      </div>

      <div className="mt-3">
        {rota.disponibilidadeRevisada ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-mint-700">
            <CheckCircle2 className="h-4 w-4" /> {lista.length ? `Lista confirmada: ${lista.length} escola(s).` : 'Confirmado: nesta rota você não aceita incluir outras escolas.'}
          </p>
        ) : (
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-white" onClick={() => gravar(lista)}>
            <Check className="h-4 w-4" /> {lista.length ? 'Confirmar esta lista' : 'Não aceito incluir outras escolas nesta rota'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ precisa de revisão ------------------------------ */

/** Lista o que ainda não foi informado. Nada é preenchido automaticamente. */
export function PendenciasRevisao({ rota, destinos, compacto = false }: { rota: Rota; destinos: DestinoCatalogo[]; compacto?: boolean }) {
  const [tudo, setTudo] = useState(false);
  const porId = new Map(destinos.map((d) => [d.id, d.nome]));
  const pendencias = pendenciasDeRevisao(rota, (id) => porId.get(id));
  const total = totalDePendencias(pendencias);
  if (total === 0) {
    return compacto ? null : (
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-mint-50 px-3 py-2 text-sm font-semibold text-mint-800"><CheckCircle2 className="h-4 w-4" /> Cadastro completo: nada a revisar nesta rota.</p>
    );
  }
  const visiveis = tudo ? pendencias : pendencias.slice(0, 4);
  return (
    <div className={cn('rounded-xl bg-amber-50 p-3 text-sm text-amber-900', !compacto && 'mt-4')}>
      <p className="inline-flex items-center gap-1.5 font-bold"><AlertCircle className="h-4 w-4" /> Precisa de revisão ({total})</p>
      <p className="mt-0.5 text-xs">Não preenchemos nada por conta própria. Falta você informar:</p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {visiveis.map((p, i) => <li key={`${p.alvo}-${p.id ?? i}`}><strong>{p.titulo}:</strong> {p.faltas.join('; ')}.</li>)}
      </ul>
      {pendencias.length > 4 && <button type="button" className="mt-1.5 text-xs font-bold underline" onClick={() => setTudo((v) => !v)}>{tudo ? 'ver menos' : `ver todas (${pendencias.length})`}</button>}
    </div>
  );
}
