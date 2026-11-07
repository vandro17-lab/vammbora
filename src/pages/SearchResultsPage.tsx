import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { useVitrine } from '@/data/VitrineProvider';
import { buscarOfertasDemo, horarioPadrao, type OfertaDemo } from '@/features/family-search-demo/engine';
import { FamilyDemoResults } from '@/features/family-search-demo/FamilyDemoResults';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';

/**
 * Mostra o overlay SOMENTE quando a busca real demora além de um limiar
 * (evita "piscar" em buscas instantâneas) e, uma vez visível, o mantém por um
 * tempo mínimo (evita sumiço brusco). Não adiciona atraso à busca em si: só
 * controla a VISIBILIDADE do indicador. Garante desmontagem quando `ativo`
 * vira falso (sucesso, erro ou cancelamento).
 */
function useOverlayCarregamento(ativo: boolean) {
  const [mostrar, setMostrar] = useState(false);
  const inicio = useRef(0);
  useEffect(() => {
    let aparecer: number | undefined;
    let sumir: number | undefined;
    if (ativo) {
      aparecer = window.setTimeout(() => { inicio.current = Date.now(); setMostrar(true); }, 160);
    } else {
      setMostrar((visivel) => {
        if (!visivel) return false;
        const restante = 450 - (Date.now() - inicio.current);
        if (restante > 0) { sumir = window.setTimeout(() => setMostrar(false), restante); return true; }
        return false;
      });
    }
    return () => { if (aparecer) clearTimeout(aparecer); if (sumir) clearTimeout(sumir); };
  }, [ativo]);
  return mostrar;
}

export function SearchResultsPage(){
 const [sp]=useSearchParams();
 const parametros=sp.toString();
 const criterios=useMemo(()=>paramsParaCriterios(new URLSearchParams(parametros)),[parametros]);
 const {destinosPorId}=useVitrine();
 const destino=criterios.destinoId?destinosPorId[criterios.destinoId]??null:null;
 const horario=sp.get('horario')||horarioPadrao(criterios.turno,criterios.modalidade);
 const [ofertas,setOfertas]=useState<OfertaDemo[]>([]);
 const [carregando,setCarregando]=useState(true);
 const [erro,setErro]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  setCarregando(true);setErro('');setOfertas([]);
  if(!criterios.origemLat||!criterios.origemLng){
   setErro('Selecione um endereço reconhecido pelo mapa para calcular as opções.');
   setCarregando(false);
   return()=>ctrl.abort();
  }
  if(!destino||destino.lat==null||destino.lng==null){
   setErro('Escolha uma escola com localização disponível para calcular o trajeto.');
   setCarregando(false);
   return()=>ctrl.abort();
  }
  buscarOfertasDemo({criterios,destino,horario},ctrl.signal)
   .then(lista=>{if(!ctrl.signal.aborted){setOfertas(lista);if(!lista.length)setErro('Não foi possível confirmar rotas viárias compatíveis. Verifique o endereço ou tente novamente mais tarde.');}})
   .catch(()=>{if(!ctrl.signal.aborted)setErro('Falha ao consultar o serviço de trajetos. Tente novamente.');})
   .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
  return()=>ctrl.abort();
 },[criterios,destino,horario]);
 const mostrarOverlay=useOverlayCarregamento(carregando);
 return <main className="container-page py-8">
  <AnimatePresence>{mostrarOverlay&&<SearchLoadingScreen key="busca-loading" totalConsultados={0} cidade="Araçatuba" />}</AnimatePresence>
  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-navy-900"><ArrowLeft size={17}/> Nova busca</Link>
  <div className="mt-5"><span className="chip bg-mint-100 font-bold text-mint-800 ring-1 ring-mint-200">Experiência demonstrativa</span></div>
  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">Vans para {destino?.nome||'sua escola'}</h1>
  <p className="mt-2 text-sm text-navy-500">Ofertas ilustrativas · localização e trajetos consultados em mapas reais.</p>
  <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/')}/>
 </main>;
}
