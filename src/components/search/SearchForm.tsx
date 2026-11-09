import { nomeDestinoParaExibicao } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin, Search } from 'lucide-react';
import type { Contratacao, ModalidadeTrajeto, Turno } from '@/types';
import { CIDADE_PADRAO } from '@/data/cidades';
import { useVitrine } from '@/data/VitrineProvider';
import { TURNO_LABEL, cn } from '@/lib/utils';
import { criteriosParaParams } from '@/lib/searchParams';
import { AutocompleteEndereco } from '@/components/search/AutocompleteEndereco';
import { locaisDeDestinos, geocodificarPreciso, separarRuaNumero } from '@/lib/geocode';
import { Loader2 } from 'lucide-react';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';

const TITULOS = ['De onde vamos sair?', 'Qual é o destino?', 'Como é sua rotina?'];
const DESCRICOES = ['Comece pelo bairro de embarque.', 'Escolha a escola ou a faculdade.', 'Falta pouco para encontrar suas opções.'];

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { destinos, carregando, erro } = useVitrine();

  // Lugares conhecidos de Araçatuba para o autocomplete funcionar sem depender
  // do serviço externo de mapas: cada escola/faculdade e um ponto por bairro.
  const locaisBusca = useMemo(() => locaisDeDestinos(destinos), [destinos]);

  const [passo, setPasso] = useState(0);
  const [endereco, setEndereco] = useState('');
  const [erroEndereco, setErroEndereco] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [turno, setTurno] = useState<Turno | ''>('');
  const [contratacao, setContratacao] = useState<Contratacao>('mensal');
  const [dataAvulso, setDataAvulso] = useState('');
  const [modalidade, setModalidade] = useState<ModalidadeTrajeto>('ida');
  const [localizando, setLocalizando] = useState(false);
  const [horario, setHorario] = useState('07:00');
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  // Ao trocar de passo, focamos o título (acessibilidade). `preventScroll` tenta
  // evitar que a página role ao focar — mas iOS antigo o ignora e a tela "foge
  // para o lado". Por isso também RESTAURAMOS a posição de rolagem (x e y) logo
  // após o foco, garantindo que a tela não se desloque horizontalmente.
  function ir(n: number) {
    const x = window.scrollX, y = window.scrollY;
    setPasso(n);
    requestAnimationFrame(() => {
      titulo.current?.focus({ preventScroll: true });
      if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = endereco.trim();
    if (passo === 0) {
      const { num } = separarRuaNumero(texto, '');
      if (!num) {
        setErroEndereco('Informe o número do imóvel para localizar o ponto exato no mapa.');
        return;
      }
      setErroEndereco('');
      ir(1);
      return;
    }
    if (passo < 2) { ir(passo + 1); return; }
    if (localizando) return;

    const { num } = separarRuaNumero(texto, '');
    if (!num) {
      setErroEndereco('Informe o número do imóvel para localizar o ponto exato no mapa.');
      ir(0);
      return;
    }

    // A pesquisa só começa depois de confirmar a coordenada exata do endereço
    // numerado. Nunca prosseguir com o pino aproximado da rua ou do bairro.
    setErroEndereco('');
    setLocalizando(true);
    const ctrl = new AbortController();
    const limite = window.setTimeout(() => ctrl.abort(), 7000);
    let ponto = null;
    try {
      ponto = await geocodificarPreciso(texto, '', ctrl.signal);
    } catch { /* erro tratado abaixo com orientação para corrigir/repetir */ }
    finally { clearTimeout(limite); setLocalizando(false); }

    if (!ponto || ponto.precisao !== 'exato' || !Number.isFinite(ponto.lat) || !Number.isFinite(ponto.lng)) {
      setErroEndereco('Não localizamos o número exato. Confira o nome da rua e o número e tente novamente.');
      ir(0);
      return;
    }

    sessionStorage.setItem('vambora.busca.transicao', '1');
    sessionStorage.setItem('vambora.busca.iniciadaEm', String(Date.now()));
    setMostrarBusca(true);
    const paramsBase = criteriosParaParams({ cidadeId: CIDADE_PADRAO.id, endereco: texto, destinoId: destinoId || null, turno: turno || null, contratacao, dataAvulso: contratacao === 'avulso' ? dataAvulso : undefined, modalidade, origemLat: ponto.lat, origemLng: ponto.lng });
    const params = new URLSearchParams(paramsBase);
    params.set('horario', horario);
    navigate(`/resultados?${params.toString()}`, { preventScrollReset: true });
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
          <div><label className="field-label" htmlFor="endereco">Endereço ou bairro de embarque</label><AutocompleteEndereco id="endereco" value={endereco} locais={locaisBusca} placeholder="Ex.: Rua José Geraldo, 450 — Centro" onChange={(texto) => { setEndereco(texto); setErroEndereco(''); }} /><p className="mt-2 text-xs text-navy-500">Informe rua e número do imóvel. O mapa precisa confirmar o número antes de buscar; bairro ou rua sem número não são suficientes.</p>{erroEndereco && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{erroEndereco}</p>}</div>
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
          <div><label className="field-label" htmlFor="horario-escolar">{modalidade === 'volta' ? 'Horário de saída da escola' : 'Horário em que precisa chegar'}</label><input id="horario-escolar" className="field-input" type="time" value={horario} required onChange={e => setHorario(e.target.value)} /><p className="mt-1 text-xs text-navy-500">O horário escolhido será usado para calcular o trajeto.</p></div>
          <fieldset><legend className="field-label">Contratação</legend><div className="flex gap-2">{(['mensal', 'avulso'] as const).map(c => <Segment key={c} ativo={contratacao === c} onClick={() => setContratacao(c)}>{c === 'mensal' ? 'Mensal' : 'Avulso'}</Segment>)}</div>
            {contratacao === 'avulso' && <div className="mt-3"><label htmlFor="data-avulso" className="field-label">Data da viagem</label><input id="data-avulso" type="date" required className="field-input" value={dataAvulso} onChange={e => setDataAvulso(e.target.value)} /></div>}
          </fieldset>
          <fieldset><legend className="field-label">Trajeto</legend><div className="flex flex-wrap gap-2">{([['ida', 'Só ida'], ['volta', 'Só volta'], ['ambos', 'Ida e volta']] as const).map(([v, label]) => <Segment key={v} ativo={modalidade === v} onClick={() => setModalidade(v)}>{label}</Segment>)}</div></fieldset>
        </div>}
      </div>
      <div className="mt-7 flex gap-3">{passo > 0 && <button type="button" onClick={() => ir(passo - 1)} className="btn btn-lg btn-ghost px-4" aria-label="Voltar à etapa anterior"><ArrowLeft className="h-5 w-5" /></button>}
        <button type="submit" className="btn btn-lg btn-primary flex-1" disabled={localizando} aria-busy={localizando}>{passo === 2 ? (localizando ? <><Loader2 className="h-4 w-4 animate-spin" /> Localizando endereço…</> : <><Search className="h-4 w-4" /> Encontrar vans</>) : <>Continuar <ArrowRight className="h-4 w-4" /></>}</button>
      </div>
      <p className="mt-4 text-center text-xs text-navy-500">Sem criar conta. No seu tempo.</p>
      {mostrarBusca && <SearchLoadingScreen cidade={CIDADE_PADRAO.nome} />}
    </form>
  );
}
function Segment({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={ativo} className={cn('rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', ativo ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100')}>{children}</button>;
}
