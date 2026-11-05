import { nomeDestinoParaExibicao } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin, Search } from 'lucide-react';
import type { Contratacao, ModalidadeTrajeto, Turno } from '@/types';
import { CIDADE_PADRAO } from '@/data/cidades';
import { useVitrine } from '@/data/VitrineProvider';
import { TURNO_LABEL, cn } from '@/lib/utils';
import { criteriosParaParams } from '@/lib/searchParams';
import { AutocompleteEndereco, type SugestaoEndereco } from '@/components/search/AutocompleteEndereco';

const TITULOS = ['De onde vamos sair?', 'Qual é o destino?', 'Como é sua rotina?'];
const DESCRICOES = ['Comece pelo bairro de embarque.', 'Escolha a escola ou a faculdade.', 'Falta pouco para encontrar suas opções.'];

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { destinos, carregando, erro } = useVitrine();

  // Lugares conhecidos de Araçatuba para o autocomplete funcionar sem depender
  // do serviço externo de mapas: cada escola/faculdade e um ponto por bairro.
  const locaisBusca = useMemo<SugestaoEndereco[]>(() => {
    const porBairro = new Map<string, { lat: number; lng: number; n: number }>();
    const escolas: SugestaoEndereco[] = [];
    for (const d of destinos) {
      const lat = d.lat;
      const lng = d.lng;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat === 0 && lng === 0) continue;
      escolas.push({ rotulo: `${nomeDestinoParaExibicao(d.nome)} — ${d.bairro}`, lat, lng });
      if (d.bairro) {
        const c = porBairro.get(d.bairro) ?? { lat: 0, lng: 0, n: 0 };
        porBairro.set(d.bairro, { lat: c.lat + lat, lng: c.lng + lng, n: c.n + 1 });
      }
    }
    const bairros: SugestaoEndereco[] = [...porBairro.entries()]
      .map(([b, v]) => ({ rotulo: `${b} (bairro)`, lat: v.lat / v.n, lng: v.lng / v.n }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
    return [...bairros, ...escolas];
  }, [destinos]);

  const [passo, setPasso] = useState(0);
  const [endereco, setEndereco] = useState('');
  const [origemCoord, setOrigemCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [destinoId, setDestinoId] = useState('');
  const [turno, setTurno] = useState<Turno | ''>('');
  const [contratacao, setContratacao] = useState<Contratacao>('mensal');
  const [dataAvulso, setDataAvulso] = useState('');
  const [modalidade, setModalidade] = useState<ModalidadeTrajeto>('ida');
  const titulo = useRef<HTMLHeadingElement>(null);
  function ir(n: number) { setPasso(n); requestAnimationFrame(() => titulo.current?.focus()); }
  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (passo < 2) { ir(passo + 1); return; }
    const params = criteriosParaParams({ cidadeId: CIDADE_PADRAO.id, endereco: endereco.trim(), destinoId: destinoId || null, turno: turno || null, contratacao, dataAvulso: contratacao === 'avulso' ? dataAvulso : undefined, modalidade, origemLat: origemCoord?.lat, origemLng: origemCoord?.lng });
    navigate(`/resultados?${params}`);
  }
  return (
    <form onSubmit={enviar} className={cn('search-panel rounded-[1.75rem] bg-white p-6 sm:p-8', compact ? '' : 'shadow-float')} aria-label="Buscar van">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Encontre sua van</span><span className="text-xs font-medium text-navy-500">{passo + 1} de 3</span>
      </div>
      <ol className="my-6 flex items-center gap-2" aria-label="Etapas da busca">
        {['Embarque', 'Destino', 'Rotina'].map((nome, i) => <li key={nome} className="flex-1">
          <button type="button" disabled={i > passo} onClick={() => ir(i)} aria-current={i === passo ? 'step' : undefined} className={cn('w-full border-t-2 pt-2 text-left text-xs font-semibold transition-colors', i <= passo ? 'border-mint-500 text-mint-700' : 'border-navy-100 text-navy-400')}>
            {i < passo ? <Check className="mr-1 inline h-3 w-3" /> : `${i + 1}. `}{nome}
          </button>
        </li>)}
      </ol>
      <div className="min-h-[245px]">
        <h2 ref={titulo} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight outline-none">{TITULOS[passo]}</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-500">{DESCRICOES[passo]}</p>
        {passo === 0 && <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-navy-50 p-4"><MapPin className="h-5 w-5 text-mint-700" /><div><span className="block text-xs text-navy-500">Sua cidade</span><span className="text-sm font-semibold">Araçatuba, SP</span></div></div>
          <div><label className="field-label" htmlFor="endereco">Endereço ou bairro de embarque</label><AutocompleteEndereco id="endereco" value={endereco} locais={locaisBusca} placeholder="Ex.: Centro, Vila Mendonça, escola…" onChange={(texto, coord) => { setEndereco(texto); setOrigemCoord(coord ?? null); }} /><p className="mt-2 text-xs text-navy-500">Digite para ver sugestões de Araçatuba. O ponto exato você combina com o motorista.</p></div>
        </div>}
        {passo === 1 && <div className="mt-6">
          <label className="field-label" htmlFor="destino">Escola, faculdade ou destino</label>
          <select id="destino" className="field-input" value={destinoId} onChange={e => setDestinoId(e.target.value)} disabled={carregando}>
            <option value="">{carregando ? 'Carregando destinos…' : 'Explorar todos os destinos'}</option>
            {destinos.map(d => <option key={d.id} value={d.id}>{nomeDestinoParaExibicao(d.nome)} — {d.bairro}</option>)}
          </select>
          <p className="mt-4 rounded-xl bg-mint-50 p-4 text-sm leading-relaxed text-mint-800">{erro ? 'Não foi possível carregar os destinos. Você ainda pode explorar as vans da cidade.' : 'Você pode explorar as opções e confirmar o trajeto diretamente com o motorista.'}</p>
        </div>}
        {passo === 2 && <div className="mt-5 space-y-5">
          <fieldset><legend className="field-label">Turno</legend><div className="flex flex-wrap gap-2">{(['', 'manha', 'tarde', 'noite', 'integral'] as const).map(t => <Segment key={t} ativo={turno === t} onClick={() => setTurno(t)}>{t ? TURNO_LABEL[t] : 'Qualquer'}</Segment>)}</div></fieldset>
          <fieldset><legend className="field-label">Contratação</legend><div className="flex gap-2">{(['mensal', 'avulso'] as const).map(c => <Segment key={c} ativo={contratacao === c} onClick={() => setContratacao(c)}>{c === 'mensal' ? 'Mensal' : 'Avulso'}</Segment>)}</div>
            {contratacao === 'avulso' && <div className="mt-3"><label htmlFor="data-avulso" className="field-label">Data da viagem</label><input id="data-avulso" type="date" required className="field-input" value={dataAvulso} onChange={e => setDataAvulso(e.target.value)} /></div>}
          </fieldset>
          <fieldset><legend className="field-label">Trajeto</legend><div className="flex flex-wrap gap-2">{([['ida', 'Só ida'], ['volta', 'Só volta'], ['ambos', 'Ida e volta']] as const).map(([v, label]) => <Segment key={v} ativo={modalidade === v} onClick={() => setModalidade(v)}>{label}</Segment>)}</div></fieldset>
        </div>}
      </div>
      <div className="mt-7 flex gap-3">{passo > 0 && <button type="button" onClick={() => ir(passo - 1)} className="btn btn-lg btn-ghost px-4" aria-label="Voltar à etapa anterior"><ArrowLeft className="h-5 w-5" /></button>}
        <button type="submit" className="btn btn-lg btn-primary flex-1">{passo === 2 ? <><Search className="h-4 w-4" /> Encontrar vans</> : <>Continuar <ArrowRight className="h-4 w-4" /></>}</button>
      </div>
      <p className="mt-4 text-center text-xs text-navy-500">Sem criar conta. No seu tempo.</p>
    </form>
  );
}
function Segment({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={ativo} className={cn('rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', ativo ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100')}>{children}</button>;
}
