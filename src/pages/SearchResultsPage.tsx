import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { useVitrine } from '@/data/VitrineProvider';
import { buscarOfertasDemo, horarioPadrao, type OfertaDemo } from '@/features/family-search-demo/engine';
import { FamilyDemoResults } from '@/features/family-search-demo/FamilyDemoResults';

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
 return <main className="container-page py-8">
  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={17}/> Nova busca</Link>
  <div className="mt-5"><span className="rounded-full bg-[#FFC400] px-3 py-1 text-xs font-bold">Experiência demonstrativa</span></div>
  <h1 className="mt-3 text-3xl font-bold text-[#151515]">Vans para {destino?.nome||'sua escola'}</h1>
  <p className="mt-2 text-sm text-gray-600">Ofertas ilustrativas · localização e trajetos consultados em mapas reais.</p>
  <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/')}/>
 </main>;
}
